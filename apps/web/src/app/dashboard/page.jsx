import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

async function getProfile(token) {
  try {
    const res = await fetch(`${process.env.API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const profile = await getProfile(token);

  if (!profile?.onboarding_complete) redirect('/onboarding');

  return (
    <main className="dash-page">
      <div className="dash-card">
        <span className="dash-eyebrow">InterviewME</span>
        <h1>Welcome, {profile.name?.split(' ')[0] || 'there'}</h1>
        <p>
          You&apos;re all set. The interview builder — pick a topic, choose a duration, talk to the
          AI — lands here in the next milestone.
        </p>
      </div>
    </main>
  );
}
