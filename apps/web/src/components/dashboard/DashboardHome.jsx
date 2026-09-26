'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const formatDuration = (sec) => `${Math.round(sec / 60)} min`;

export default function DashboardHome({ profile }) {
  const router = useRouter();
  const [presets, setPresets] = useState([]);
  const [durations, setDurations] = useState([]);
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/presets')
      .then((r) => r.json())
      .then((data) => {
        setPresets(data.presets || []);
        setDurations(data.durations || []);
        setDuration((data.durations || [])[1] || null);
      })
      .catch(() => setError('Could not load topics.'));
  }, []);

  const start = async () => {
    if (!topic.trim() || !duration || busy) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), duration_sec: duration }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.detail || 'Could not start the interview.');
      return;
    }
    router.push(`/interview/${data.id}`);
  };

  return (
    <main className="dash-home">
      <div className="dash-home-inner">
        <span className="dash-eyebrow">InterviewME</span>
        <h1>
          Ready when you are, {profile.name?.split(' ')[0] || 'there'}.
        </h1>
        <p className="dash-home-sub">
          Pick a topic — or type your own — choose how long you want to talk, and the interviewer
          takes it from there.
        </p>

        <div className="dash-input-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            placeholder="Try any topic to start an interview right now…"
            aria-label="Interview topic"
          />
          <button className="onb-cta" type="button" onClick={start} disabled={busy || !topic.trim() || !duration}>
            {busy ? 'Starting…' : 'Start interview'}
          </button>
        </div>

        <div className="dash-chips" aria-label="Preset topics">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`dash-chip${topic === preset ? ' is-active' : ''}`}
              onClick={() => setTopic(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="dash-durations" role="group" aria-label="Interview duration">
          {durations.map((sec) => (
            <button
              key={sec}
              type="button"
              className={`dash-duration${duration === sec ? ' is-active' : ''}`}
              onClick={() => setDuration(sec)}
            >
              {formatDuration(sec)}
            </button>
          ))}
        </div>

        {error && <p className="onb-error">{error}</p>}
      </div>
    </main>
  );
}
