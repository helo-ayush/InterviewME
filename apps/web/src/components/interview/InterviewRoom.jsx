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

export default function InterviewRoom({ sessionId }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef(null);

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
        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setIsSpeaking(speakers.length > 0);
        });

        await room.connect(data.livekit_url, data.token);
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(!room.localParticipant.isMicrophoneEnabled);

        if (!cancelled) setState('live');
      } catch (err) {
        console.error('Failed to connect to LiveKit voice room:', err);
        if (!cancelled) {
          setState('error');
          setError('Could not connect to the voice room. Please verify network permissions.');
        }
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
    };
  }, [sessionId]);

  useEffect(() => {
    if (state !== 'live') return undefined;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  const toggleMic = async () => {
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
      roomRef.current?.disconnect();
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
    <main className="iv-page">
      <div className="onb-card iv-card" style={{ maxWidth: '640px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span className={`iv-status is-${state}`}>{STATE_LABEL[state]}</span>
          {state === 'live' && (
            <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: '600', letterSpacing: '0.02em' }}>
              ● LIVE CALL
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

        {/* Visualizer when live */}
        {state === 'live' && (
          <div>
            <div className="iv-visualizer">
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
              <div className={`iv-wave-bar ${isSpeaking ? 'is-speaking' : ''}`} />
            </div>
            <p className="iv-hint" style={{ marginTop: '8px' }}>
              {isSpeaking ? 'Voice detected' : isMuted ? 'Microphone is muted' : 'Listening… speak naturally'}
            </p>
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
