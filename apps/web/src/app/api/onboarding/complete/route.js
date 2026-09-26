import { apiForward } from '@/lib/api';

export async function POST() {
  const { status, data } = await apiForward('/api/onboarding/complete', { method: 'POST' });
  return Response.json(data, { status });
}
