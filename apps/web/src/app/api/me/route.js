import { apiForward } from '@/lib/api';

export async function GET() {
  const { status, data } = await apiForward('/api/me');
  return Response.json(data, { status });
}
