export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options?: { method?: string; body?: unknown; csrf?: string; signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.csrf ? { 'X-CSRF-Token': options.csrf } : {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
    cache: 'no-store',
  });
  const value = await response.json();
  if (!response.ok)
    throw new ApiError(
      value.error?.code ?? 'REQUEST_FAILED',
      value.error?.message ?? 'Permintaan gagal. Silakan coba lagi.',
    );
  return value.data as T;
}
