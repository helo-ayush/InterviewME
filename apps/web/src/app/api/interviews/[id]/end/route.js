import { apiForward } from '@/lib/api';

export async function POST(req, { params }) {
  const { id } = await params;
  const { status, data } = await apiForward(`/api/interviews/${id}/end`, {
    method: 'POST',
  });
  return Response.json(data, { status });
}
