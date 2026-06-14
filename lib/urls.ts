export {
  normalizeAbsoluteUrl,
  resolveAppUrl,
  resolveCorsOrigins,
  resolveApiRewriteUrl,
  buildApiPath,
  joinUrl,
  validateProductionUrls,
} from './urls.cjs';

export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, ' ');
    const hint = preview.startsWith('<!')
      ? 'The server returned HTML instead of JSON — check API_URL /api rewrites and that the Express API is running.'
      : `Unexpected response: ${preview}`;

    throw new Error(
      res.ok
        ? `Invalid JSON from server. ${hint}`
        : `Request failed (${res.status}). ${hint}`
    );
  }
}
