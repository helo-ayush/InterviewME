import { apiForward } from '@/lib/api';

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await req.text();
  const { status, data } = await apiForward(`/api/interviews/${id}/end`, {
    method: 'POST',
    body,
    contentType: 'application/json',
  });
  return Response.json(data, { status });
}
