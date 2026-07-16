/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ORIGIN = process.env.VITE_APP_URL;

/**
 * Normalizes a URL string to its origin
 * @param {string} value - The URL to normalize
 * @returns {string|null} The origin or null if invalid
 */
export function normalizeOrigin(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the allowed CORS origin for a request
 * @param {import('http').IncomingMessage} req - The request object
 * @returns {string|null} The allowed origin
 */
export function resolveAllowedOrigin(req) {
  const configuredOrigin = normalizeOrigin(APP_ORIGIN);
  const requestOrigin = normalizeOrigin(req?.headers?.origin);
  if (!requestOrigin) return configuredOrigin;

  const isLocalDevOrigin = (
    requestOrigin === 'http://localhost:5173'
    || requestOrigin === 'http://127.0.0.1:5173'
  );

  if (requestOrigin === configuredOrigin || isLocalDevOrigin) {
    return requestOrigin;
  }

  return configuredOrigin;
}

/**
 * Applies CORS headers to a response
 * @param {import('http').IncomingMessage} req - The request object
 * @param {import('http').ServerResponse} res - The response object
 * @param {Object} [options] - Configuration options
 * @param {string} [options.methods='OPTIONS,POST'] - Allowed HTTP methods
 * @param {string} [options.headers='Content-Type, Authorization'] - Allowed headers
 */
export function applyCors(req, res, options = {}) {
  const { methods = 'OPTIONS,POST', headers = 'Content-Type, Authorization' } = options;
  const allowedOrigin = resolveAllowedOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}

/**
 * Extracts a Bearer token from the request Authorization header
 * @param {import('http').IncomingMessage} req - The request object
 * @returns {string|null} The token or null if not present
 */
export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

/**
 * Creates a Supabase admin client with service role key
 * @returns {import('@supabase/supabase-js').SupabaseClient} The admin client
 */
export function createSupabaseAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });
}

/**
 * Creates a Supabase client authenticated with a JWT token
 * @param {string} jwt - The JWT token
 * @returns {import('@supabase/supabase-js').SupabaseClient} The authenticated client
 */
export function createAuthClient(jwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    fetch,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/**
 * Gets the authenticated user from a JWT token
 * @param {string} jwt - The JWT token
 * @returns {Promise<Object>} The user object
 * @throws {Error} If authentication fails
 */
export async function getUserFromToken(jwt) {
  const authClient = createAuthClient(jwt);
  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }
  return data.user;
}

/**
 * Checks if a user has access to a business (owner or active employee)
 * @param {import('@supabase/supabase-js').SupabaseClient} admin - The admin client
 * @param {string} userId - The user ID to check
 * @param {string} businessId - The business ID to check access for
 * @returns {Promise<boolean>} True if the user has access
 */
export async function userCanAccessBusiness(admin, userId, businessId) {
  const [{ data: owner }, { data: employee }] = await Promise.all([
    admin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('created_by', userId)
      .limit(1),
    admin
      .from('employees')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1),
  ]);

  return (owner && owner.length > 0) || (employee && employee.length > 0);
}

/**
 * Normalizes a text value to a trimmed string
 * @param {*} value - The value to normalize
 * @param {string} [fallback=''] - Default value if empty
 * @returns {string} The normalized string
 */
export function normalizeText(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

/**
 * Normalizes an ID array input
 * @param {*} value - The value to normalize
 * @returns {string[]} Array of normalized IDs
 */
export function normalizeIdArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

/**
 * Normalizes a numeric value
 * @param {*} value - The value to normalize
 * @param {number} [fallback=0] - Default value if invalid
 * @returns {number} The normalized number
 */
export function normalizeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Formats a number as Colombian peso currency
 * @param {number} value - The value to format
 * @returns {string} The formatted currency string
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
}

/**
 * Checks if the environment is properly configured
 * @returns {boolean} True if all required env vars are set
 */
export function isEnvConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);
}

/**
 * Returns the environment configuration status
 * @returns {Object} Configuration status
 */
export function getEnvConfig() {
  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    APP_ORIGIN,
  };
}

/**
 * Sends an error response
 * @param {import('http').ServerResponse} res - The response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 */
export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

/**
 * Sends a success response
 * @param {import('http').ServerResponse} res - The response object
 * @param {Object} data - Response data
 */
export function sendSuccess(res, data) {
  res.status(200).json({ ok: true, ...data });
}
