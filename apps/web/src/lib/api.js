import { auth } from '@clerk/nextjs/server';

export async function apiForward(path, { method = 'GET', body, contentType } = {}) {
  const { getToken } = await auth();
  const token = await getToken();

  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers['Content-Type'] = contentType;

  const res = await fetch(`${process.env.API_URL}${path}`, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
