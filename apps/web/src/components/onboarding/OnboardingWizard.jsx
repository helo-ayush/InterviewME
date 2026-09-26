'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const EXPERIENCE_LEVELS = [
  'Student',
  'Junior (0-2 yrs)',
  'Mid (2-5 yrs)',
  'Senior (5-8 yrs)',
  'Lead (8+ yrs)',
];

const POPULAR_ROLES = [
  'Full Stack Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'AI / ML Engineer',
  'System Design',
  'DevOps & Cloud',
];

const POPULAR_SKILLS = [
  'Python',
  'React',
  'TypeScript',
  'Next.js',
  'FastAPI',
  'PostgreSQL',
  'Docker',
  'System Design',
];

const STEPS = [
  { id: 1, label: 'Profile' },
  { id: 2, label: 'Resume' },
  { id: 3, label: 'GitHub' },
];

export default function OnboardingWizard({ profile }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const githubParam = searchParams.get('github');
  const initialStep = (githubParam || profile?.github) ? 3 : profile?.resume ? 3 : profile?.name ? 2 : 1;
  const [step, setStep] = useState(initialStep);
  const [form, setForm] = useState({
    name: profile?.name || '',
    role: profile?.role || '',
    experience_level: profile?.experience_level || EXPERIENCE_LEVELS[0],
    skills: (profile?.skills || []).join(', '),
  });
  const [resumeName, setResumeName] = useState(profile?.resume?.filename || '');
  const [resumeStats, setResumeStats] = useState(null);
  const [githubUser, setGithubUser] = useState(profile?.github?.login || '');
  const [githubStats, setGithubStats] = useState({
    repos_count: profile?.github?.repos_count || 0,
    tech_stack: profile?.github?.tech_stack || [],
  });
  const [manualGithub, setManualGithub] = useState('');
  const [oauthConfigured, setOauthConfigured] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const githubConnected = Boolean(githubUser);

  useEffect(() => {
    if (githubParam === 'connected') {
      setSuccessMsg('GitHub account connected successfully via OAuth!');
      setStep(3);
    } else if (githubParam === 'failed') {
      setError('GitHub authorization was cancelled or failed. You can connect by pasting your profile link below.');
      setStep(3);
    }

    // Check if OAuth is configured on server
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.oauth_configured === 'boolean') {
          setOauthConfigured(d.oauth_configured);
        }
      })
      .catch(() => {});
  }, [githubParam]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError('');
  };

  const toggleSkill = (skill) => {
    const list = form.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let nextList;
    if (list.includes(skill)) {
      nextList = list.filter((s) => s !== skill);
    } else {
      nextList = [...list, skill];
    }
    setForm((f) => ({ ...f, skills: nextList.join(', ') }));
  };

  const activeSkillsList = form.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const saveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim() || !form.role.trim()) {
      setError('Please fill in your name and target role.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim(),
          experience_level: form.experience_level,
          skills: activeSkillsList,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data?.detail || 'Could not save profile.');
        return;
      }
      setStep(2);
    } catch {
      setBusy(false);
      setError('Network error saving profile.');
    }
  };

  const uploadResume = async (e) => {
    e.preventDefault();
    const file = e.target.resume.files?.[0];
    if (!file) {
      setError('Select a PDF, DOCX, TXT, or MD file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/onboarding/resume', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data?.detail || 'Upload failed.');
        return;
      }
      setResumeName(data.filename || file.name);
      if (data.words) {
        setResumeStats(`${data.words} words extracted`);
      }
      setStep(3);
    } catch {
      setBusy(false);
      setError('Failed to upload file.');
    }
  };

  const connectGithub = async () => {
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/github/start');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setBusy(false);
        if (res.status === 503) {
          setError('GitHub OAuth is not configured on the server yet. You can instantly link your profile using your GitHub link or username below!');
        } else {
          setError(data.detail || 'Could not start GitHub connect.');
        }
        return;
      }
      window.location.href = data.url;
    } catch {
      setBusy(false);
      setError('Failed to reach GitHub connect service.');
    }
  };

  const linkManualGithub = async (e) => {
    if (e) e.preventDefault();
    const raw = manualGithub.trim();
    if (!raw) {
      setError('Please enter a GitHub profile URL or username.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/onboarding/github-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: raw }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data.detail || 'Could not link GitHub profile. Please check the username or link.');
        return;
      }
      setGithubUser(data.login);
      setGithubStats({
        repos_count: data.repos_count || 0,
        tech_stack: data.tech_stack || [],
      });
      setManualGithub('');
      const reposCount = data.repos_count || 0;
      const countLabel = reposCount === 1 ? '1 repository' : `${reposCount} repositories`;
      const stackList = (data.tech_stack || []).slice(0, 4).join(', ');
      const stackLabel = stackList ? ` (${stackList})` : '';
      setSuccessMsg(`Linked @${data.login} successfully — ${countLabel} indexed${stackLabel}.`);
    } catch {
      setBusy(false);
      setError('Failed to link GitHub profile. Please check your network connection.');
    }
  };

  const disconnectGithub = async () => {
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/onboarding/github', { method: 'DELETE' });
      setBusy(false);
      if (!res.ok) {
        setError('Failed to disconnect GitHub account.');
        return;
      }
      setGithubUser('');
      setGithubStats({ repos_count: 0, tech_stack: [] });
      setSuccessMsg('GitHub account disconnected. You can link another account or profile link.');
    } catch {
      setBusy(false);
      setError('Failed to disconnect GitHub account.');
    }
  };

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data?.detail || 'Could not complete onboarding.');
        return;
      }
      router.push('/dashboard');
    } catch {
      setBusy(false);
      setError('Failed to complete onboarding.');
    }
  };

  return (
    <div className="onb-bright-page">
      <div className="onb-bright-container">
        {/* Minimalist Stepper */}
        <nav className="onb-min-stepper" aria-label="Onboarding Progress">
          {STEPS.map((s, index) => {
            const isDone = s.id < step || (s.id === 3 && githubConnected);
            const isActive = s.id === step;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className={`onb-min-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
                  <span className="onb-min-step-num">
                    {isDone ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </span>
                  <span>{s.label}</span>
                </div>
                {index < STEPS.length - 1 && <span className="onb-min-divider" />}
              </div>
            );
          })}
        </nav>

        {/* Main Card Canvas */}
        <div className="onb-bright-card">
          {step === 1 && (
            <form onSubmit={saveProfile}>
              <div className="onb-bright-header">
                <h1>Tell us about yourself</h1>
                <p>The bare minimum — your interviewer uses this to pitch questions and difficulty right.</p>
              </div>

              {/* 2-Column Grid: Name & Role */}
              <div className="onb-grid-2">
                <div className="onb-group">
                  <label className="onb-label">Full name</label>
                  <input
                    className="onb-input"
                    value={form.name}
                    onChange={set('name')}
                    required
                    placeholder="Ayush Kumar"
                    autoFocus
                  />
                </div>

                <div className="onb-group">
                  <label className="onb-label">Target role</label>
                  <input
                    className="onb-input"
                    value={form.role}
                    onChange={set('role')}
                    required
                    placeholder="Backend Engineer, Full Stack…"
                  />
                </div>
              </div>

              {/* Role Presets */}
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600' }}>
                  Popular roles:
                </span>
                <div className="onb-pills-wrap">
                  {POPULAR_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`onb-pill-btn ${form.role === r ? 'is-active' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, role: r }))}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div className="onb-group">
                <label className="onb-label">Experience level</label>
                <div className="onb-exp-row">
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`onb-exp-card ${form.experience_level === lvl ? 'is-active' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, experience_level: lvl }))}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="onb-group" style={{ marginTop: '12px' }}>
                <label className="onb-label">
                  <span>Skills</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 'normal' }}>
                    Comma separated or select below
                  </span>
                </label>
                <input
                  className="onb-input"
                  value={form.skills}
                  onChange={set('skills')}
                  placeholder="Python, React, FastAPI, PostgreSQL…"
                />
                <div className="onb-pills-wrap">
                  {POPULAR_SKILLS.map((sk) => {
                    const selected = activeSkillsList.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        className={`onb-pill-btn ${selected ? 'is-active' : ''}`}
                        onClick={() => toggleSkill(sk)}
                      >
                        {selected ? '✓ ' : '+ '}
                        {sk}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="onb-alert-error">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="onb-bottom-actions">
                <span style={{ fontSize: '0.78rem', color: '#8a93a6' }}>
                  Step 1 of 3
                </span>
                <button className="onb-btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={uploadResume}>
              <div className="onb-bright-header">
                <h1>Upload your CV or resume</h1>
                <p>We extract and store only the text content in the database to save storage space.</p>
              </div>

              <label className="onb-min-dropzone">
                <input type="file" name="resume" accept=".pdf,.docx,.txt,.md" required />
                <div className="onb-min-drop-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div style={{ fontWeight: '600', color: '#17213c', fontSize: '0.94rem' }}>
                  {resumeName ? `Attached: ${resumeName}${resumeStats ? ' — ' + resumeStats : ''}` : 'Choose file — PDF, DOCX, TXT, or MD (up to 10 MB)'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Click to browse or drag and drop
                </div>
              </label>

              {error && (
                <div className="onb-alert-error">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="onb-bottom-actions">
                <button className="onb-btn-secondary" type="button" onClick={() => setStep(1)}>
                  Back
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button className="onb-btn-skip" type="button" onClick={() => setStep(3)}>
                    Skip for now
                  </button>
                  <button className="onb-btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Uploading…' : 'Upload & continue'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 3 && (
            <div>
              <div className="onb-bright-header">
                <h1>Connect your GitHub</h1>
                <p>
                  Your AI interviewer explores your real repositories and tech stack to ask contextual, tailored technical questions.
                </p>
              </div>

              {githubConnected ? (
                <div className="onb-github-connected-card">
                  <div className="onb-github-connected-header">
                    <div className="onb-github-connected-badge">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span>
                        Connected as <strong>@{githubUser}</strong>
                        {githubStats.repos_count > 0 && (
                          <span style={{ fontWeight: 'normal', color: '#4b5563', marginLeft: '6px' }}>
                            • {githubStats.repos_count} {githubStats.repos_count === 1 ? 'repository' : 'repositories'} indexed
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      className="onb-btn-sm-ghost"
                      type="button"
                      onClick={disconnectGithub}
                      disabled={busy}
                      title="Disconnect or link a different profile"
                    >
                      {busy ? '…' : 'Change'}
                    </button>
                  </div>

                  {githubStats.tech_stack && githubStats.tech_stack.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>
                        Detected tech stack:
                      </div>
                      <div className="onb-github-tags">
                        {githubStats.tech_stack.map((tech) => (
                          <span key={tech} className="onb-github-tag">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="onb-github-box">
                  {/* Option 1: Profile Link or Username (Primary & Instant) */}
                  <form onSubmit={linkManualGithub}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: '600', color: '#17213c' }}>
                          GitHub Profile Link or Username
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          Paste your profile link or @handle — instant snapshot of public repos with zero setup.
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1' }}>
                        Recommended
                      </span>
                    </div>

                    <div className="onb-github-input-row" style={{ marginTop: '12px' }}>
                      <input
                        className="onb-input"
                        value={manualGithub}
                        onChange={(e) => {
                          setManualGithub(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="https://github.com/your-username or octocat"
                        disabled={busy}
                      />
                      <button
                        className="onb-btn-primary"
                        type="submit"
                        disabled={busy || !manualGithub.trim()}
                        style={{ minHeight: '42px', padding: '0 20px', fontSize: '0.86rem' }}
                      >
                        {busy ? 'Indexing…' : 'Link Profile'}
                      </button>
                    </div>
                  </form>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(23,33,60,0.08)' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>
                      Or connect via OAuth
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(23,33,60,0.08)' }} />
                  </div>

                  {/* Option 2: OAuth */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#17213c', fontSize: '0.88rem' }}>
                        Official GitHub OAuth
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {oauthConfigured === false
                          ? 'OAuth credentials not set in .env (use profile link above)'
                          : 'Connect and authorize directly with your GitHub account'}
                      </div>
                    </div>
                    <button
                      className="onb-btn-secondary"
                      type="button"
                      onClick={connectGithub}
                      disabled={busy}
                      style={{ minHeight: '40px', padding: '0 18px', fontSize: '0.84rem' }}
                    >
                      {busy ? 'Connecting…' : 'Authorize GitHub'}
                    </button>
                  </div>
                </div>
              )}

              {successMsg && <div className="onb-alert-success">{successMsg}</div>}
              {error && (
                <div className="onb-alert-error">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="onb-bottom-actions">
                <button className="onb-btn-secondary" type="button" onClick={() => setStep(2)}>
                  Back
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {!githubConnected && (
                    <button className="onb-btn-skip" type="button" onClick={finish} disabled={busy}>
                      Skip for now
                    </button>
                  )}
                  <button className="onb-btn-primary" type="button" onClick={finish} disabled={busy}>
                    {busy ? 'Entering…' : 'Enter dashboard'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
