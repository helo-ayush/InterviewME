import { apiForward } from '@/lib/api';

export async function GET() {
  const { status, data } = await apiForward('/api/profile');
  return Response.json(data, { status });
}

export async function PUT(req) {
  const payload = await req.json();
  const { status, data } = await apiForward('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
    contentType: 'application/json',
  });
  return Response.json(data, { status });
}
