/**
 * Shared URL utilities for Next.js rewrites, Express config, and client API calls.
 * Plain CJS so next.config.js can require this module at build time.
 */

function normalizeAbsoluteUrl(value, label, options = {}) {
  const { defaultScheme = 'https' } = options;

  if (!value || typeof value !== 'string') {
    throw new Error(
      `${label} is required and must be an absolute URL (e.g. https://cyber-recovery-hub-production.up.railway.app)`
    );
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty. Use an absolute URL with https://`);
  }

  if (trimmed.startsWith('/')) {
    throw new Error(
      `${label} must be an absolute URL with a scheme, not a relative path: "${trimmed}"`
    );
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `${defaultScheme}://${candidate.replace(/^\/+/, '')}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      `${label} is malformed: "${value}". Expected an absolute URL like https://your-app.railway.app`
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use http:// or https://, got: ${parsed.protocol}`);
  }

  const origin = parsed.origin;
  const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '';
  return `${origin}${path}`;
}

function resolveAppUrl(env = process.env) {
  const explicit = env.APP_URL || env.NEXT_PUBLIC_APP_URL;
  if (explicit) {
    const isProd = env.NODE_ENV === 'production';
    return normalizeAbsoluteUrl(explicit, 'APP_URL', {
      defaultScheme: isProd ? 'https' : 'http',
    });
  }

  if (env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

function resolveCorsOrigins(env = process.env) {
  const origins = new Set();
  const isProd = env.NODE_ENV === 'production';

  if (env.CORS_ORIGINS) {
    for (const part of env.CORS_ORIGINS.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      origins.add(
        normalizeAbsoluteUrl(trimmed, 'CORS_ORIGINS', {
          defaultScheme: isProd ? 'https' : 'http',
        })
      );
    }
  }

  try {
    origins.add(resolveAppUrl(env));
  } catch {
    // APP_URL may be unset in local dev
  }

  if (env.RAILWAY_PUBLIC_DOMAIN) {
    origins.add(`https://${env.RAILWAY_PUBLIC_DOMAIN}`);
  }

  if (env.VERCEL_URL) {
    origins.add(`https://${env.VERCEL_URL}`);
  }

  if (!origins.size) {
    origins.add('http://localhost:3000');
  }

  return [...origins];
}

/**
 * Destination for Next.js /api/* rewrites.
 * Monolith hosts (Railway, Docker) must proxy to the internal Express port.
 */
function resolveApiRewriteUrl(env = process.env) {
  const apiPort = env.API_PORT || '3001';
  const internal = `http://127.0.0.1:${apiPort}`;
  const explicit = env.API_URL?.trim();

  const isMonolith =
    env.USE_INTERNAL_API === 'true' ||
    env.RAILWAY_ENVIRONMENT ||
    env.RAILWAY_PUBLIC_DOMAIN ||
    !explicit;

  if (isMonolith) {
    return internal;
  }

  try {
    const normalized = normalizeAbsoluteUrl(explicit, 'API_URL', {
      defaultScheme: env.NODE_ENV === 'production' ? 'https' : 'http',
    });

    // API_URL set to the public app URL breaks monolith rewrites (loops through Next.js)
    try {
      const appUrl = resolveAppUrl(env);
      if (new URL(normalized).origin === new URL(appUrl).origin) {
        console.warn(
          `[config] API_URL (${normalized}) matches APP_URL on a monolith host — ` +
            `using internal API rewrite target ${internal}`
        );
        return internal;
      }
    } catch {
      // APP_URL unset during build — still prefer internal on Railway
      if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PUBLIC_DOMAIN) {
        return internal;
      }
    }

    return normalized;
  } catch (err) {
    console.warn(`[config] ${err.message} — falling back to internal API at ${internal}`);
    return internal;
  }
}

/**
 * @deprecated Browser code must use lib/api-client.ts apiPath() for relative /api paths.
 * Kept for server-side use only.
 */
function buildApiPath(path, env = process.env) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalized.startsWith('/api') ? normalized : `/api${normalized}`;

  const publicBase = env.NEXT_PUBLIC_API_URL?.trim();
  if (!publicBase || publicBase === 'undefined' || publicBase === 'null') {
    return apiPath;
  }

  try {
    const base = normalizeAbsoluteUrl(publicBase, 'NEXT_PUBLIC_API_URL', {
      defaultScheme: env.NODE_ENV === 'production' ? 'https' : 'http',
    });
    return `${base.replace(/\/$/, '')}${apiPath}`;
  } catch (err) {
    console.warn(`[config] ${err.message} — using relative ${apiPath}`);
    return apiPath;
  }
}

function joinUrl(base, path) {
  const normalizedBase = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function validateProductionUrls(env = process.env) {
  const warnings = [];
  const errors = [];

  if (env.NODE_ENV !== 'production') {
    return { warnings, errors };
  }

  for (const [label, value] of [
    ['APP_URL', env.APP_URL || env.NEXT_PUBLIC_APP_URL],
    ['CORS_ORIGINS', env.CORS_ORIGINS],
    ['API_URL', env.API_URL],
    ['NEXT_PUBLIC_API_URL', env.NEXT_PUBLIC_API_URL],
  ]) {
    if (!value) continue;
    const parts = label === 'CORS_ORIGINS' ? value.split(',') : [value];
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        const url = normalizeAbsoluteUrl(trimmed, label);
        if (env.NODE_ENV === 'production' && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
          warnings.push(`${label} should use https:// in production: ${url}`);
        }
      } catch (err) {
        errors.push(err.message);
      }
    }
  }

  return { warnings, errors };
}

module.exports = {
  normalizeAbsoluteUrl,
  resolveAppUrl,
  resolveCorsOrigins,
  resolveApiRewriteUrl,
  buildApiPath,
  joinUrl,
  validateProductionUrls,
};
