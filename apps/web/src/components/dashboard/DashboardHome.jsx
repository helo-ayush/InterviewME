'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [interviews, setInterviews] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    // 1. Fetch presets
    fetch('/api/presets')
      .then((r) => r.json())
      .then((data) => {
        setPresets(data.presets || []);
        setDurations(data.durations || []);
        setDuration((data.durations || [])[1] || null);
      })
      .catch(() => setError('Could not load topics.'));

    // 2. Fetch past interviews & reviews
    fetch('/api/interviews')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setInterviews(Array.isArray(data) ? data : []);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
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

  const getRecommendationBadge = (rec) => {
    if (!rec) return null;
    const isHire = rec.toLowerCase().includes('hire');
    const color = rec === 'Strong Hire' ? '#34d399' : isHire ? '#60a5fa' : '#fbbf24';
    return (
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          padding: '2px 8px',
          borderRadius: '999px',
          border: `1px solid ${color}`,
          color: color,
          background: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        ★ {rec}
      </span>
    );
  };

  return (
    <main className="dash-home">
      <div className="dash-home-inner" style={{ maxWidth: '820px', width: '100%' }}>
        
        {/* Candidate Profile Quick Status */}
        <div className="dash-profile-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="dash-eyebrow" style={{ margin: 0 }}>InterviewME</span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>
              Targeting <strong style={{ color: '#e2e8f0' }}>{profile.role || 'Software Engineer'}</strong> ({profile.experience_level || 'Mid-Level'})
            </span>
          </div>
          <Link href="/profile" className="dash-profile-edit-btn">
            Edit Profile & Skills →
          </Link>
        </div>

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

        {/* Recent Interviews & Performance Reviews Section */}
        <section className="dash-history-section" style={{ marginTop: '50px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px', color: '#fff' }}>
                Recent Interviews & AI Reviews
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
                Scorecards, hiring evaluations, and feedback from past spoken sessions.
              </p>
            </div>
            {interviews.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {interviews.length} total {interviews.length === 1 ? 'session' : 'sessions'}
              </span>
            )}
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.88rem' }}>
              Loading interview history…
            </div>
          ) : interviews.length === 0 ? (
            <div className="dash-empty-history">
              <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>🎙️</div>
              <p style={{ margin: '0 0 4px', color: '#e2e8f0', fontWeight: '500' }}>No past mock interviews yet</p>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
                Choose or type a topic above to practice your first voice interview.
              </p>
            </div>
          ) : (
            <div className="dash-history-grid">
              {interviews.map((iv) => {
                const isCompleted = iv.status === 'completed';
                const hasScore = typeof iv.overall_score === 'number';

                return (
                  <div key={iv.id} className="dash-iv-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span
                            className={`iv-status ${isCompleted ? 'is-live' : 'is-hold'}`}
                            style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                          >
                            {isCompleted ? 'Completed' : iv.status}
                          </span>
                          {iv.recommendation && getRecommendationBadge(iv.recommendation)}
                          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                            {formatDuration(iv.duration_sec || 1200)}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: '#f8fafc', fontWeight: '600' }}>
                          {iv.topic}
                        </h3>
                        {iv.summary && (
                          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.4 }}>
                            {iv.summary.slice(0, 130)}{iv.summary.length > 130 ? '…' : ''}
                          </p>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {iv.turns_count || 0} spoken turns
                          {iv.created_at && ` • ${new Date(iv.created_at).toLocaleDateString()}`}
                        </span>
                      </div>

                      {/* Score Badge */}
                      {hasScore ? (
                        <div className="dash-score-badge">
                          <span className="dash-score-val">{iv.overall_score}</span>
                          <span className="dash-score-denom">/ 100</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Action link */}
                    <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                      {isCompleted || hasScore ? (
                        <Link href={`/interview/${iv.id}/review`} className="dash-review-link">
                          View Performance Scorecard →
                        </Link>
                      ) : (
                        <Link href={`/interview/${iv.id}`} className="dash-review-link">
                          Continue Session →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
