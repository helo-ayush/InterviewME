'use client';

import { useEffect, useRef, useState } from 'react';
import { Room } from 'livekit-client';

const pad = (n) => String(n).padStart(2, '0');
const clock = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

const STATE_LABEL = {
  loading: 'Loading session…',
  connecting: 'Connecting to voice room…',
  live: 'Interview live',
  hold: 'Voice stack on hold',
  error: 'Problem',
};

export default function InterviewRoom({ sessionId }) {
  const [session, setSession] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const roomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/interviews/${sessionId}`);
      if (!res.ok) {
        setState('error');
        setError('Interview not found.');
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setSession(data);

      if (!data.token) {
        setState('hold');
        return;
      }

      setState('connecting');
      try {
        const room = new Room();
        roomRef.current = room;
        await room.connect(data.livekit_url, data.token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (!cancelled) setState('live');
      } catch {
        if (!cancelled) {
          setState('error');
          setError('Could not connect to the voice room.');
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

  const remaining = session ? Math.max(0, session.duration_sec - elapsed) : 0;

  return (
    <main className="iv-page">
      <div className="onb-card iv-card">
        <span className={`iv-status is-${state}`}>{STATE_LABEL[state]}</span>

        {session && (
          <>
            <h1>{session.topic}</h1>
            <p className="onb-sub">
              {clock(remaining)} left of {Math.round(session.duration_sec / 60)} minutes.
            </p>
          </>
        )}

        {state === 'live' && (
          <p className="iv-hint">
            Microphone is on — the interviewer joins the moment the agent worker is running
            (next milestone).
          </p>
        )}

        {state === 'hold' && (
          <p className="iv-hint">
            LiveKit keys are not configured on the API yet, so the voice room cannot be minted.
            Everything up to this point worked — add the keys and this page connects on its own.
          </p>
        )}

        {state === 'error' && <p className="onb-error">{error}</p>}
      </div>
    </main>
  );
}
