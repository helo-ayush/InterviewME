import { apiForward } from '@/lib/api';

export async function GET() {
  const { status, data } = await apiForward('/api/github/oauth/start');
  return Response.json(data, { status });
}
