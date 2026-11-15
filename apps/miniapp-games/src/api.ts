// Calls to the games bot's API (mounted by the server at /api/games). Every request carries the
// raw initData; the server validates it (ADR 0007), never initDataUnsafe.
import { initData } from '@tma.js/sdk-react';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  let res: Response;
  try {
    res = await fetch(`/api/games${path}`, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `tma ${initData.raw() ?? ''}`,
        ...(init.body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  if (!res.ok) throw new ApiError(res.status, body.code ?? 'error');
  return body as T;
}
