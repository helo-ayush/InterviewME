import { apiForward } from '@/lib/api';

export async function POST(req) {
  const form = await req.formData();
  const { status, data } = await apiForward('/api/onboarding/resume', {
    method: 'POST',
    body: form,
  });
  return Response.json(data, { status });
}
