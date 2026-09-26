'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Room, RoomEvent } from 'livekit-client';

const pad = (n) => String(n).padStart(2, '0');
const clock = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

const STATE_LABEL = {
  loading: 'Loading session…',
  connecting: 'Connecting to voice room…',
  live: 'Interview in progress',
  hold: 'Voice room on hold',
  finishing: 'Finishing interview…',
  error: 'Session error',
};

// Smart transcript merger: prevents duplicate boxes and merges incremental sentences in-place
const mergeTranscript = (prev, newMsg) => {
  if (!newMsg.text || !newMsg.text.trim()) return prev;
  const trimmed = newMsg.text.trim();

  // 1. Exact ID match: update bubble in place
  const existingIdx = prev.findIndex((m) => m.id === newMsg.id);
  if (existingIdx !== -1) {
    const copy = [...prev];
    copy[existingIdx] = { ...copy[existingIdx], text: trimmed, final: newMsg.final ?? true };
    return copy;
  }

  // 2. Prevent consecutive duplicates or sentence fragments from the same role
  const lastIdx = prev.length - 1;
  if (lastIdx >= 0) {
    const last = prev[lastIdx];
    if (last.role === newMsg.role) {
      // Identical text: ignore duplicate
      if (last.text.toLowerCase() === trimmed.toLowerCase()) {
        return prev;
      }
      // Sentence expansion: "Okay" -> "Okay, can you start the interview?"
      if (trimmed.toLowerCase().startsWith(last.text.toLowerCase())) {
        const copy = [...prev];
        copy[lastIdx] = { ...last, id: newMsg.id || last.id, text: trimmed };
        return copy;
      }
      // Sentence substring: ignore if a shorter fragment arrives later
      if (last.text.toLowerCase().startsWith(trimmed.toLowerCase())) {
        return prev;
      }
    }
  }

  // 3. Brand new message turn
  return [
    ...prev,
    {
      id: newMsg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: newMsg.role,
      text: trimmed,
      final: newMsg.final ?? true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ];
};

export default function InterviewRoom({ sessionId }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakerName, setActiveSpeakerName] = useState('');
  const [transcripts, setTranscripts] = useState([]);
  const [liveInterim, setLiveInterim] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const roomRef = useRef(null);
  const transcriptEndRef = useRef(null);

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, liveInterim]);

  // Unlock audio helper
  const unlockAudio = async () => {
    if (roomRef.current && !roomRef.current.canPlaybackAudio) {
      try {
        await roomRef.current.startAudio();
        setAudioBlocked(false);
        console.log('[LiveKit] Audio unlocked successfully');
      } catch (err) {
        console.warn('[LiveKit] Could not unlock audio yet:', err);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/interviews/${sessionId}`);
      if (!res.ok) {
        setState('error');
        setError('Interview session could not be found.');
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setSession(data);

      if (!data.token || !data.livekit_url) {
        setState('hold');
        return;
      }

      setState('connecting');
      try {
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        // 1. Play remote audio tracks (Agent voice)
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'audio') {
            console.log('[LiveKit] Subscribed to remote audio track from', participant.identity);
            const audioElement = track.attach();
            audioElement.id = `audio-${participant.identity}`;
            audioElement.autoplay = true;
            document.body.appendChild(audioElement);
            audioElement.play().catch((err) => {
              console.warn('[LiveKit] Browser blocked autoplay:', err);
              setAudioBlocked(true);
            });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

        // 2. Audio playback status
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!room.canPlaybackAudio);
        });

        // 3. Active speaker detection
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setIsSpeaking(speakers.length > 0);
          if (speakers.length > 0) {
            const spk = speakers[0];
            const isAgent = spk.identity?.includes('agent');
            setActiveSpeakerName(isAgent ? 'Interviewer' : 'You');
          } else {
            setActiveSpeakerName('');
          }
        });

        // 4. Real-time transcript data broadcasts from agent worker
        room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          try {
            const str = new TextDecoder().decode(payload);
            const msg = JSON.parse(str);

            if (msg.type === 'interim') {
              // Live speaking preview in single active bubble (no new box)
              if (msg.role === 'candidate') {
                setLiveInterim(msg.text);
              }
              return;
            }

            if (msg.type === 'transcript' && msg.text) {
              const role = msg.role || (participant?.identity?.includes('agent') ? 'agent' : 'candidate');

              // Clear interim on final candidate sentence
              if (role === 'candidate') {
                setLiveInterim('');
              }

              setTranscripts((prev) => mergeTranscript(prev, { ...msg, role }));
            }
          } catch (err) {
            console.warn('[LiveKit] Failed to parse data message:', err);
          }
        });

        // 5. LiveKit native STT fallback: ONLY process final segments to prevent interim box duplicates
        room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
          const isAgent = participant ? participant.identity.includes('agent') : false;
          const role = isAgent ? 'agent' : 'candidate';

          setTranscripts((prev) => {
            let updated = prev;
            for (const seg of segments) {
              if (!seg.text || !seg.final) continue;
              updated = mergeTranscript(updated, {
                id: seg.id,
                role,
                text: seg.text,
                final: true,
              });
            }
            return updated;
          });
        });

        // Connect to room
        await room.connect(data.livekit_url, data.token);
        console.log('[LiveKit] Connected successfully to room:', room.name);

        // Attempt audio unlock immediately
        await room.startAudio().catch((e) => console.log('startAudio deferred:', e));
        setAudioBlocked(!room.canPlaybackAudio);

        // Enable candidate microphone
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);

        if (!cancelled) setState('live');
      } catch (err) {
        console.error('Failed to connect to LiveKit voice room:', err);
        if (!cancelled) {
          setState('error');
          setError('Could not connect to the voice room. Please verify network and microphone permissions.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.remoteParticipants.forEach((p) => {
          p.audioTrackPublications.forEach((pub) => {
            if (pub.track) pub.track.detach().forEach((el) => el.remove());
          });
        });
        roomRef.current.disconnect();
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (state !== 'live') return undefined;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  const toggleMic = async () => {
    unlockAudio();
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;
    try {
      const nextState = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextState);
      setIsMuted(nextState);
    } catch (err) {
      console.error('Failed to toggle mic:', err);
    }
  };

  const endInterview = async () => {
    if (busy) return;
    setBusy(true);
    setState('finishing');

    try {
      if (roomRef.current) {
        roomRef.current.remoteParticipants.forEach((p) => {
          p.audioTrackPublications.forEach((pub) => {
            if (pub.track) pub.track.detach().forEach((el) => el.remove());
          });
        });
        roomRef.current.disconnect();
      }
      await fetch(`/api/interviews/${sessionId}/end`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to end interview:', err);
    }
    router.push('/dashboard');
  };

  const totalDuration = session?.duration_sec || 1200;
  const remaining = Math.max(0, totalDuration - elapsed);
  const progressPercent = Math.min(100, Math.round((elapsed / totalDuration) * 100));

  return (
    <main className="iv-page" onClick={unlockAudio}>
      <div className="onb-card iv-card" style={{ maxWidth: '780px', width: '100%' }}>
        {/* Audio blocked unlock banner */}
        {audioBlocked && (
          <button
            type="button"
            className="iv-audio-unlock-banner"
            onClick={(e) => {
              e.stopPropagation();
              unlockAudio();
            }}
          >
            🔊 Click here to unmute AI voice (Browser Audio Permission)
          </button>
        )}

        {/* Top Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span className={`iv-status is-${state}`}>{STATE_LABEL[state]}</span>
          {state === 'live' && (
            <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: '600', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="iv-live-dot" /> LIVE CALL
            </span>
          )}
        </div>

        {session && (
          <div style={{ marginTop: '18px' }}>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>{session.topic}</h1>
            <p className="onb-sub" style={{ margin: '4px 0 14px' }}>
              {clock(remaining)} remaining of {Math.round(totalDuration / 60)} minutes
            </p>

            {/* Time progress bar */}
            <div className="iv-progress-wrap" aria-label="Interview progress">
              <div className="iv-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        {/* Audio Visualizer & Speaking status */}
        {state === 'live' && (
          <div style={{ marginBottom: '16px' }}>
            <div className="iv-visualizer">
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
            </div>
            <p className="iv-hint" style={{ marginTop: '6px', fontSize: '0.86rem' }}>
              {isSpeaking
                ? `${activeSpeakerName || 'Speaking'}…`
                : isMuted
                ? 'Microphone is muted'
                : 'Listening… speak naturally'}
            </p>
          </div>
        )}

        {/* Live Conversation Transcript Panel */}
        {state === 'live' && (
          <div className="iv-transcript-box">
            <div className="iv-transcript-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ fontWeight: '600', fontSize: '0.84rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Live Transcript
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {transcripts.length} {transcripts.length === 1 ? 'turn' : 'turns'}
              </span>
            </div>

            <div className="iv-transcript-body">
              {transcripts.length === 0 && !liveInterim ? (
                <div className="iv-empty-transcript">
                  <div className="iv-pulse-loader" />
                  <p>Connecting with interviewer… Spoken conversation will appear here in clean turns.</p>
                </div>
              ) : (
                transcripts.map((item) => {
                  const isAgent = item.role === 'agent';
                  return (
                    <div key={item.id} className={`iv-msg-row ${isAgent ? 'is-agent' : 'is-user'}`}>
                      <div className="iv-msg-badge">
                        {isAgent ? 'Interviewer' : 'You'}
                        {item.time && <span className="iv-msg-time">{item.time}</span>}
                      </div>
                      <div className="iv-msg-bubble">
                        {item.text}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Single active sentence bubble while candidate is actively speaking */}
              {liveInterim && (
                <div className="iv-msg-row is-user is-interim">
                  <div className="iv-msg-badge">
                    You <span className="iv-msg-time">Speaking…</span>
                  </div>
                  <div className="iv-msg-bubble iv-bubble-interim">
                    {liveInterim}
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {state === 'hold' && (
          <div style={{ marginTop: '16px' }}>
            <p className="iv-hint">
              LiveKit credentials are not yet configured in <code>apps/api/.env</code>.
              Your interview record and candidate context have been created in the database.
            </p>
            <div style={{ marginTop: '20px' }}>
              <button className="onb-btn-secondary" type="button" onClick={() => router.push('/dashboard')}>
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div style={{ marginTop: '16px' }}>
            <p className="onb-error">{error}</p>
            <div style={{ marginTop: '20px' }}>
              <button className="onb-btn-secondary" type="button" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Active controls during call */}
        {(state === 'live' || state === 'connecting') && (
          <div className="iv-controls">
            <button
              className={`iv-btn-control ${isMuted ? 'is-active' : ''}`}
              type="button"
              onClick={toggleMic}
              disabled={busy}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  <span>Mute</span>
                </>
              )}
            </button>

            <button
              className="iv-btn-end"
              type="button"
              onClick={endInterview}
              disabled={busy}
            >
              {busy ? 'Ending…' : 'End Interview'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
