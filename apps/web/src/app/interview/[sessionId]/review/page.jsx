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
        <div className="onb-card iv-card" style={{ maxWidth: '680px', width: '100%', textAlign: 'center', padding: '60px 30px' }}>
          <div className="iv-pulse-loader" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Generating Interview Performance Review…</h2>
          <p className="onb-sub" style={{ maxWidth: '440px', margin: '0 auto' }}>
            Our AI reviewer is analyzing your technical accuracy, communication clarity, problem-solving, and spoken transcript.
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="iv-page">
        <div className="onb-card iv-card" style={{ maxWidth: '580px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#f87171', marginBottom: '10px' }}>Evaluation Unavailable</h2>
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
  const score = review.overall_score || 75;
  const recommendation = review.recommendation || 'Hire';
  const categories = review.category_scores || {
    technical_accuracy: 75,
    communication_clarity: 80,
    problem_solving: 70,
    practical_application: 75,
  };

  const isHire = recommendation.toLowerCase().includes('hire');
  const recBadgeColor = recommendation === 'Strong Hire' ? '#34d399' : isHire ? '#60a5fa' : '#fbbf24';

  return (
    <main className="iv-page" style={{ padding: '40px 16px', alignItems: 'flex-start' }}>
      <div className="onb-card iv-card rev-container" style={{ maxWidth: '860px', width: '100%', textAlign: 'left', margin: '0 auto' }}>
        
        {/* Navigation & Topic Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="iv-status is-live" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
                Completed Interview
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                {Math.round((data.duration_sec || 1200) / 60)} min session
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', margin: 0, color: '#fff' }}>{data.topic}</h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/dashboard" className="onb-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.86rem' }}>
              Dashboard
            </Link>
          </div>
        </div>

        {/* Top Scorecard & Verdict */}
        <div className="rev-hero-card">
          <div className="rev-score-circle">
            <span className="rev-score-num">{score}</span>
            <span className="rev-score-label">/ 100</span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="rev-rec-pill" style={{ borderColor: recBadgeColor, color: recBadgeColor }}>
                ★ {recommendation}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Overall Hiring Decision</span>
            </div>
            <p className="rev-summary-text">
              {review.summary || 'Solid technical interview session. Good fundamentals and communication.'}
            </p>
          </div>
        </div>

        {/* Category Breakdown Bars */}
        <div style={{ margin: '28px 0' }}>
          <h2 className="rev-section-title">Evaluation Dimensions</h2>
          <div className="rev-grid-2">
            {Object.entries({
              'Technical Accuracy & Depth': categories.technical_accuracy ?? 75,
              'Communication Clarity': categories.communication_clarity ?? 80,
              'Problem Solving & Logic': categories.problem_solving ?? 75,
              'Practical Application': categories.practical_application ?? 70,
            }).map(([label, val]) => (
              <div key={label} className="rev-metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.86rem' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '500' }}>{label}</span>
                  <span style={{ color: '#60a5fa', fontWeight: '700' }}>{val}%</span>
                </div>
                <div className="iv-progress-wrap" style={{ margin: 0, height: '8px' }}>
                  <div
                    className="iv-progress-fill"
                    style={{
                      width: `${val}%`,
                      background: val >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
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
                : ['Clear technical communication.', 'Active listening and engagement.']
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
                : ['Provide deeper edge-case analysis.', 'Elaborate more on architectural trade-offs.']
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
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px', color: '#fff' }}>Interview Transcript</h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
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
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px' }}>
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
            className="iv-btn-control is-active"
            style={{ background: '#2563eb', borderColor: '#3b82f6', color: '#fff', minHeight: '44px', padding: '0 24px' }}
            onClick={() => router.push('/dashboard')}
          >
            Start Another Mock Interview
          </button>
          <Link href="/profile" className="iv-btn-control">
            Edit Profile & Skills
          </Link>
        </div>

      </div>
    </main>
  );
}
