'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function InterviewReviewPage({ params }) {
  const unwrappedParams = use(params);
  const sessionId = unwrappedParams.sessionId;
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadReview() {
      try {
        const res = await fetch(`/api/interviews/${sessionId}/review`);
        if (!res.ok) {
          throw new Error('Failed to load interview review');
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load interview review');
          setLoading(false);
        }
      }
    }
    loadReview();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <main className="iv-page">
        <div className="iv-card" style={{ maxWidth: '640px', width: '100%', textAlign: 'center', padding: '60px 30px' }}>
          <div className="iv-pulse-loader" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#17213c' }}>Generating Performance Review…</h2>
          <p className="onb-sub" style={{ maxWidth: '440px', margin: '0 auto' }}>
            Our AI reviewer is analyzing your technical accuracy, problem-solving, and communication.
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="iv-page">
        <div className="iv-card" style={{ maxWidth: '580px', width: '100%', textAlign: 'center', padding: '40px 30px' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '10px' }}>Evaluation Unavailable</h2>
          <p className="onb-sub">{error || 'Could not find this interview review.'}</p>
          <div style={{ marginTop: '24px' }}>
            <Link href="/dashboard" className="onb-btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const review = data.review || {};
  const score = review.overall_score ?? 0;
  const recommendation = review.recommendation || 'Needs Improvement';
  const categories = review.category_scores || {
    technical_accuracy: 0,
    communication_clarity: 0,
    problem_solving: 0,
    practical_application: 0,
  };

  const recBadgeStyles = {
    'Strong Hire': { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
    'Hire': { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
    'Leaning Hire': { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    'Needs Improvement': { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  }[recommendation] || { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' };

  return (
    <main className="iv-page" style={{ padding: '40px 16px', alignItems: 'flex-start' }}>
      <div className="iv-card rev-container" style={{ maxWidth: '860px', width: '100%', textAlign: 'left', margin: '0 auto', padding: '36px 40px' }}>
        
        {/* Navigation & Topic Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="iv-status is-live" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                Completed Interview
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                {Math.round((data.duration_sec || 1200) / 60)} min session
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', margin: 0, color: '#17213c' }}>{data.topic}</h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/dashboard" className="onb-btn-secondary" style={{ padding: '8px 18px', fontSize: '0.86rem' }}>
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Top Scorecard & Verdict */}
        <div className="rev-hero-card">
          <div
            className="rev-score-circle"
            style={{
              borderColor: score >= 75 ? '#16a34a' : score >= 45 ? '#2563eb' : '#dc2626',
            }}
          >
            <span className="rev-score-num">{score}</span>
            <span className="rev-score-label">/ 100</span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                className="rev-rec-pill"
                style={{
                  background: recBadgeStyles.bg,
                  borderColor: recBadgeStyles.border,
                  color: recBadgeStyles.text,
                }}
              >
                ★ {recommendation}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Overall Hiring Decision</span>
            </div>
            <p className="rev-summary-text">
              {review.summary || 'Interview concluded.'}
            </p>
          </div>
        </div>

        {/* Category Breakdown Bars */}
        <div style={{ margin: '28px 0' }}>
          <h2 className="rev-section-title">Evaluation Dimensions</h2>
          <div className="rev-grid-2">
            {Object.entries({
              'Technical Accuracy & Depth': categories.technical_accuracy ?? 0,
              'Communication Clarity': categories.communication_clarity ?? 0,
              'Problem Solving & Logic': categories.problem_solving ?? 0,
              'Practical Application': categories.practical_application ?? 0,
            }).map(([label, val]) => (
              <div key={label} className="rev-metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.86rem' }}>
                  <span style={{ color: '#1e293b', fontWeight: '600' }}>{label}</span>
                  <span style={{ color: val >= 70 ? '#16a34a' : val >= 40 ? '#2563eb' : '#dc2626', fontWeight: '700' }}>
                    {val}%
                  </span>
                </div>
                <div className="iv-progress-wrap" style={{ margin: 0, height: '8px' }}>
                  <div
                    className="iv-progress-fill"
                    style={{
                      width: `${val}%`,
                      background: val >= 75
                        ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                        : val >= 40
                        ? 'linear-gradient(90deg, #2563eb, #3b82f6)'
                        : 'linear-gradient(90deg, #dc2626, #ef4444)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="rev-grid-2" style={{ marginBottom: '28px' }}>
          {/* Strengths */}
          <div className="rev-card-panel">
            <div className="rev-panel-header is-positive">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Key Strengths</span>
            </div>
            <ul className="rev-list">
              {(review.strengths && review.strengths.length > 0
                ? review.strengths
                : ['No notable technical strengths demonstrated in this session.']
              ).map((s, idx) => (
                <li key={idx}>
                  <span className="rev-bullet-icon is-green">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="rev-card-panel">
            <div className="rev-panel-header is-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Areas for Improvement</span>
            </div>
            <ul className="rev-list">
              {(review.improvements && review.improvements.length > 0
                ? review.improvements
                : ['Answer technical questions and explain problem-solving approaches in full.']
              ).map((imp, idx) => (
                <li key={idx}>
                  <span className="rev-bullet-icon is-amber">→</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actionable Recommendations */}
        {review.actionable_tips && review.actionable_tips.length > 0 && (
          <div className="rev-card-panel" style={{ marginBottom: '28px' }}>
            <div className="rev-panel-header is-action">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Actionable Advice for Future Interviews</span>
            </div>
            <ul className="rev-list">
              {review.actionable_tips.map((tip, idx) => (
                <li key={idx}>
                  <span className="rev-bullet-icon is-blue">★</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Spoken Transcript Drawer Toggle */}
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(23, 33, 60, 0.08)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px', color: '#17213c' }}>Interview Transcript</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                {data.transcript ? data.transcript.length : 0} conversation turns recorded
              </p>
            </div>
            <button
              type="button"
              className="onb-btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              onClick={() => setShowTranscript(!showTranscript)}
            >
              {showTranscript ? 'Hide Transcript ▲' : 'View Full Transcript ▼'}
            </button>
          </div>

          {showTranscript && (
            <div className="iv-transcript-box" style={{ marginTop: '16px' }}>
              <div className="iv-transcript-body" style={{ maxHeight: '350px' }}>
                {data.transcript && data.transcript.length > 0 ? (
                  data.transcript.map((item, idx) => {
                    const isAgent = ['agent', 'interviewer', 'assistant'].includes(item.role);
                    return (
                      <div key={idx} className={`iv-msg-row ${isAgent ? 'is-agent' : 'is-user'}`}>
                        <div className="iv-msg-badge">
                          {isAgent ? 'Interviewer' : 'You'}
                        </div>
                        <div className="iv-msg-bubble">
                          {item.text}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: '#64748b', fontSize: '0.88rem', textAlign: 'center', padding: '20px' }}>
                    No transcript recorded for this session.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', gap: '14px', marginTop: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            className="onb-btn-primary"
            style={{ minHeight: '44px', padding: '0 26px' }}
            onClick={() => router.push('/dashboard')}
          >
            Start Another Mock Interview
          </button>
          <Link href="/profile" className="onb-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Edit Profile & Skills
          </Link>
        </div>

      </div>
    </main>
  );
}
