import { apiForward } from '@/lib/api';

export async function POST(req) {
  const payload = await req.json();
  const { status, data } = await apiForward('/api/onboarding/github-username', {
    method: 'POST',
    body: JSON.stringify(payload),
    contentType: 'application/json',
  });
  return Response.json(data, { status });
}
