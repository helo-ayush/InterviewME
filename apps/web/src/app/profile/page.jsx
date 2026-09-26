'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const EXPERIENCE_LEVELS = [
  'Junior (0-2 yrs)',
  'Mid-Level (2-5 yrs)',
  'Senior (5-8 yrs)',
  'Lead / Staff (8+ yrs)',
  'Principal / Architect',
];

const SUGGESTED_SKILLS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'FastAPI',
  'Node.js',
  'PostgreSQL',
  'System Design',
  'Docker',
  'Kubernetes',
  'AWS',
  'Go',
  'GraphQL',
  'Redis',
  'Tailwind CSS',
];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState(EXPERIENCE_LEVELS[1]);
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [githubInfo, setGithubInfo] = useState(null);
  const [resumeSummary, setResumeSummary] = useState('');
  const [resumeFilename, setResumeFilename] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        if (cancelled) return;

        setName(data.name || '');
        setRole(data.role || '');
        setExperienceLevel(data.experience_level || EXPERIENCE_LEVELS[1]);
        setSkills(data.skills || []);
        if (data.github) {
          setGithubInfo(data.github);
          setGithubUsername(data.github.login || '');
        }
        if (data.resume) {
          setResumeSummary(data.resume.summary || '');
          setResumeFilename(data.resume.filename || '');
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load profile');
          setLoading(false);
        }
      }
    }
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const addSkill = (skillToAdd) => {
    const trimmed = (skillToAdd || skillInput).trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput('');
  };

  const removeSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        name: name.trim(),
        role: role.trim(),
        experience_level: experienceLevel,
        skills,
        github_username: githubUsername.trim() || null,
        resume_summary: resumeSummary.trim() || null,
      };

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update profile');
      }

      if (data.github) {
        setGithubInfo(data.github);
      }
      setMessage('Profile updated successfully! AI interviewer context has been synced.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const syncGithubProfile = async () => {
    const raw = githubUsername.trim();
    if (!raw) {
      setError('Please provide a GitHub username or profile link.');
      return;
    }
    setSyncingGithub(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/onboarding/github-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Could not sync GitHub profile');
      }

      setGithubInfo({
        login: data.login,
        repos_count: data.repos ? data.repos.length : 0,
        tech_stack: data.tech_stack || [],
      });
      setGithubUsername(data.login);
      setMessage(`Successfully synced GitHub profile @${data.login} with ${data.repos?.length || 0} repositories!`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to sync GitHub profile');
    } finally {
      setSyncingGithub(false);
    }
  };

  if (loading) {
    return (
      <main className="iv-page">
        <div className="onb-card iv-card" style={{ maxWidth: '680px', width: '100%', textAlign: 'center', padding: '60px 30px' }}>
          <div className="iv-pulse-loader" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Loading Candidate Profile…</h2>
          <p className="onb-sub">Fetching your background, skills, and interview configuration.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="iv-page" style={{ padding: '40px 16px', alignItems: 'flex-start' }}>
      <div className="onb-card iv-card prof-container" style={{ maxWidth: '860px', width: '100%', textAlign: 'left', margin: '0 auto' }}>
        
        {/* Top Header & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="iv-status is-live" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                Profile Editor
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Context used by AI Interviewer
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', margin: 0, color: '#17213c' }}>Candidate Profile</h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/dashboard" className="onb-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.86rem' }}>
              ← Dashboard
            </Link>
            <button
              type="button"
              className="onb-btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ minHeight: '38px', padding: '0 20px', fontSize: '0.88rem' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {message && (
          <div className="prof-alert is-success" style={{ marginBottom: '20px' }}>
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="prof-alert is-error" style={{ marginBottom: '20px' }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Section 1: Basic Information */}
          <div className="prof-card-panel" style={{ marginBottom: '24px' }}>
            <h2 className="rev-section-title" style={{ marginTop: 0, marginBottom: '16px' }}>
              Basic Information
            </h2>
            <div className="prof-grid-2">
              <div>
                <label className="prof-label" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  className="prof-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                />
              </div>

              <div>
                <label className="prof-label" htmlFor="role">Target Role</label>
                <input
                  id="role"
                  type="text"
                  className="prof-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label className="prof-label">Experience Level</label>
              <div className="prof-levels-grid">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`prof-level-btn ${experienceLevel === lvl ? 'is-active' : ''}`}
                    onClick={() => setExperienceLevel(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Technical Skills */}
          <div className="prof-card-panel" style={{ marginBottom: '24px' }}>
            <h2 className="rev-section-title" style={{ marginTop: 0, marginBottom: '8px' }}>
              Core Technical Skills ({skills.length})
            </h2>
            <p className="onb-sub" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              The interviewer tailors problem scenarios and probing questions to your listed stack.
            </p>

            <div className="prof-skills-wrap">
              {skills.map((skill) => (
                <span key={skill} className="prof-chip">
                  <span>{skill}</span>
                  <button
                    type="button"
                    className="prof-chip-del"
                    onClick={() => removeSkill(skill)}
                    title={`Remove ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Input to add custom skill */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', maxWidth: '420px' }}>
              <input
                type="text"
                className="prof-input"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill (e.g. Docker, Redis)…"
                style={{ padding: '8px 12px', fontSize: '0.88rem' }}
              />
              <button
                type="button"
                className="onb-btn-secondary"
                onClick={() => addSkill()}
                style={{ padding: '0 16px', fontSize: '0.86rem', whiteSpace: 'nowrap' }}
              >
                + Add
              </button>
            </div>

            {/* Suggested skill chips */}
            <div style={{ marginTop: '14px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginRight: '8px', fontWeight: '500' }}>
                Suggestions:
              </span>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="prof-sug-chip"
                    onClick={() => addSkill(s)}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: GitHub Integration */}
          <div className="prof-card-panel" style={{ marginBottom: '24px' }}>
            <h2 className="rev-section-title" style={{ marginTop: 0, marginBottom: '8px' }}>
              GitHub Repositories & Activity
            </h2>
            <p className="onb-sub" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              The interviewer will cite and ask questions about your actual open-source repositories and code structures.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  className="prof-input"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="https://github.com/your-username or username"
                />
              </div>
              <button
                type="button"
                className="onb-btn-secondary"
                onClick={syncGithubProfile}
                disabled={syncingGithub || !githubUsername.trim()}
                style={{ padding: '0 18px', fontSize: '0.88rem' }}
              >
                {syncingGithub ? 'Syncing…' : 'Sync Public Repos'}
              </button>
            </div>

            {githubInfo && (
              <div className="prof-github-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <div>
                  <div style={{ fontWeight: '600', color: '#17213c' }}>
                    @{githubInfo.login} — {githubInfo.repos_count || 0} public repositories indexed
                  </div>
                  {githubInfo.tech_stack && githubInfo.tech_stack.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                      Detected Languages: {githubInfo.tech_stack.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Resume & Background Summary */}
          <div className="prof-card-panel" style={{ marginBottom: '28px' }}>
            <h2 className="rev-section-title" style={{ marginTop: 0, marginBottom: '8px' }}>
              Interview Context & Resume Summary
            </h2>
            <p className="onb-sub" style={{ fontSize: '0.85rem', marginBottom: '14px' }}>
              {resumeFilename ? `Extracted from: ${resumeFilename}. ` : ''}
              Feel free to tweak key accomplishments, projects, and architecture experience for the interviewer to probe.
            </p>

            <textarea
              className="prof-textarea"
              rows={6}
              value={resumeSummary}
              onChange={(e) => setResumeSummary(e.target.value)}
              placeholder="Add key career highlights, major production systems built, technologies used, or specific topics you want to practice in mock interviews…"
            />
          </div>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Link href="/dashboard" className="onb-btn-secondary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
              Cancel
            </Link>
            <button
              type="submit"
              className="onb-btn-primary"
              disabled={saving}
              style={{ minHeight: '44px', padding: '0 28px', fontSize: '0.95rem' }}
            >
              {saving ? 'Saving changes…' : 'Save Profile & Sync'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
