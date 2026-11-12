export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
    ...options,
  });
  if (res.status === 204) return null;
  let data: any = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: (path: string, body?: any) => request(path, { method: 'DELETE', body: JSON.stringify(body ?? {}) }),
};

export const ZONES = ['Ground Zone', 'Zero Zone', 'High Zone', 'General'] as const;
export const GENDERS = ['Boys', 'Girls'] as const;
export type Zone = typeof ZONES[number];
export type Gender = typeof GENDERS[number];
