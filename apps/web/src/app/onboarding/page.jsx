import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

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

export default async function OnboardingPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const profile = await getProfile(token);

  if (profile?.onboarding_complete) redirect('/dashboard');

  return (
    <Suspense fallback={null}>
      <OnboardingWizard profile={profile} />
    </Suspense>
  );
}
