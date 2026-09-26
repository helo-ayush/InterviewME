import { apiForward } from '@/lib/api';

export async function GET() {
  const { status, data } = await apiForward('/api/presets');
  return Response.json(data, { status });
}
