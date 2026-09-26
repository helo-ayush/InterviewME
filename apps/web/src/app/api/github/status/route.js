import { apiForward } from '@/lib/api';

export async function GET() {
  const { status, data } = await apiForward('/api/github/status');
  return Response.json(data, { status });
}
