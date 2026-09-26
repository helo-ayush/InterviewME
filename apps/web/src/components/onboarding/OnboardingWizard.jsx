'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const EXPERIENCE_LEVELS = [
  'Student',
  'Junior (0-2 yrs)',
  'Mid (2-5 yrs)',
  'Senior (5-8 yrs)',
  'Lead (8+ yrs)',
];

const STEPS = ['Profile', 'Resume', 'GitHub'];

export default function OnboardingWizard({ profile }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStep = profile?.resume ? 3 : profile?.name ? 2 : 1;
  const [step, setStep] = useState(initialStep);
  const [form, setForm] = useState({
    name: profile?.name || '',
    role: profile?.role || '',
    experience_level: profile?.experience_level || EXPERIENCE_LEVELS[0],
    skills: (profile?.skills || []).join(', '),
  });
  const [resumeName, setResumeName] = useState(profile?.resume?.filename || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const githubConnected = Boolean(profile?.github);
  const githubJustConnected = searchParams.get('github') === 'connected';

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/onboarding/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        role: form.role.trim(),
        experience_level: form.experience_level,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.detail || 'Could not save profile.');
      return;
    }
    setStep(2);
  };

  const uploadResume = async (e) => {
    e.preventDefault();
    const file = e.target.resume.files?.[0];
    if (!file) {
      setError('Pick your CV or resume file first.');
      return;
    }
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/onboarding/resume', { method: 'POST', body: fd });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.detail || 'Upload failed.');
      return;
    }
    const data = await res.json();
    setResumeName(data.filename);
    setStep(3);
  };

  const connectGithub = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/github/start');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setBusy(false);
      setError(data.detail || 'Could not start GitHub connect.');
      return;
    }
    window.location.href = data.url;
  };

  const finish = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/onboarding/complete', { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.detail || 'Could not finish onboarding.');
      return;
    }
    router.push('/dashboard');
  };

  return (
    <main className="onb-page">
      <div className="onb-card">
        <div className="onb-steps" aria-label="Onboarding progress">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step || (n === 3 && githubConnected) ? 'done' : n === step ? 'current' : 'todo';
            return (
              <span key={label} className={`onb-step is-${state}`}>
                <span className="onb-step-dot">{state === 'done' ? '✓' : n}</span>
                {label}
              </span>
            );
          })}
        </div>

        {step === 1 && (
          <form className="onb-form" onSubmit={saveProfile}>
            <h1>Tell us about yourself</h1>
            <p className="onb-sub">The bare minimum — your interviewer uses this to pitch questions right.</p>

            <label className="onb-field">
              Full name
              <input value={form.name} onChange={set('name')} required placeholder="Ayush Kumar" />
            </label>

            <label className="onb-field">
              Target role
              <input value={form.role} onChange={set('role')} required placeholder="Backend Engineer, ML Intern…" />
            </label>

            <label className="onb-field">
              Experience level
              <select value={form.experience_level} onChange={set('experience_level')}>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </label>

            <label className="onb-field">
              Skills (comma separated)
              <input value={form.skills} onChange={set('skills')} placeholder="Python, React, FastAPI, PyTorch" />
            </label>

            <button className="onb-cta" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
            {error && <p className="onb-error">{error}</p>}
          </form>
        )}

        {step === 2 && (
          <form className="onb-form" onSubmit={uploadResume}>
            <h1>Upload your CV or resume</h1>
            <p className="onb-sub">PDF or DOCX. We parse it so the interviewer knows your story before asking.</p>

            <label className="onb-drop">
              <input type="file" name="resume" accept=".pdf,.docx" required />
              <span>
                {resumeName ? `Attached: ${resumeName}` : 'Choose file — PDF or DOCX, up to 10 MB'}
              </span>
            </label>

            <div className="onb-row">
              <button className="onb-ghost" type="button" onClick={() => setStep(1)}>Back</button>
              <button className="onb-cta" type="submit" disabled={busy}>
                {busy ? 'Parsing…' : 'Upload & continue'}
              </button>
            </div>
            {error && <p className="onb-error">{error}</p>}
          </form>
        )}

        {step === 3 && (
          <div className="onb-form">
            <h1>Connect GitHub</h1>
            <p className="onb-sub">
              The interviewer reads your repos during the conversation — only what it needs, only
              when it needs it.
            </p>

            {githubConnected ? (
              <p className="onb-ok">Connected as {profile.github.login}.</p>
            ) : (
              <button className="onb-cta" type="button" onClick={connectGithub} disabled={busy}>
                {busy ? 'Redirecting…' : 'Connect GitHub'}
              </button>
            )}

            {githubJustConnected && !githubConnected && (
              <p className="onb-error">GitHub connect did not finish — try again.</p>
            )}

            <div className="onb-row">
              <button className="onb-ghost" type="button" onClick={() => setStep(2)}>Back</button>
              <button className="onb-cta" type="button" onClick={finish} disabled={busy || !githubConnected}>
                Enter dashboard
              </button>
            </div>
            {error && <p className="onb-error">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
