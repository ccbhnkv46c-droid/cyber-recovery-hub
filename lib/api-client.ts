/**
 * Browser-safe API helpers.
 * Always uses same-origin relative paths — no API_URL / new URL() in the client.
 */

export function apiPath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw new Error('API path must be a non-empty string');
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!normalized.startsWith('/api/') && normalized !== '/api') {
    return `/api${normalized}`;
  }
  return normalized;
}

/** Dev-only logging of the exact endpoint being called */
export function logApiCall(method: string, path: string): void {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.log(`[CRH API] ${method} ${apiPath(path)}`);
  }
}

export function safeAppRoute(route: string | undefined | null, fallback: string): string {
  if (!route || typeof route !== 'string') return fallback;
  const trimmed = route.trim();
  if (!trimmed.startsWith('/') || trimmed.includes('://')) return fallback;
  return trimmed;
}

export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, ' ');
    const hint = preview.startsWith('<!')
      ? 'Server returned HTML instead of JSON — ensure the Express API is running and /api rewrites target http://127.0.0.1:3001 on Railway.'
      : `Unexpected response: ${preview}`;

    throw new Error(
      res.ok
        ? `Invalid JSON from server. ${hint}`
        : `Request failed (${res.status}). ${hint}`
    );
  }
}
