import { apiForward } from '@/lib/api';

export async function GET(req, { params }) {
  const { id } = await params;
  const { status, data } = await apiForward(`/api/interviews/${id}/review`);
  return Response.json(data, { status });
}
