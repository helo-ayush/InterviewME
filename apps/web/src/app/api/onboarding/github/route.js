import { apiForward } from '@/lib/api';

export async function DELETE() {
  const { status, data } = await apiForward('/api/onboarding/github', {
    method: 'DELETE',
  });
  return Response.json(data, { status });
}

export async function POST() {
  const { status, data } = await apiForward('/api/onboarding/github/disconnect', {
    method: 'POST',
  });
  return Response.json(data, { status });
}
