import { isMissingColumnError } from '../data/adapters/supabaseAdapter/shared';

export function resolveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return String(err.message || '').trim() || fallback;
  }
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
    const details = (err as { details?: unknown }).details;
    if (typeof details === 'string' && details.trim()) return details.trim();
  }
  if (typeof err === 'string' && err.trim()) return err.trim();
  return fallback;
}

export function isRpcBadRequestError(error) {
  const code = error?.code || '';
  const status = error?.status || error?.statusCode || 0;
  return status === 400 || code === 'PGRST100' || code === 'PGRST116' || code === 'PGRST301';
}

export function isMissingRpcError(error, rpcName) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(rpcName) && (message.includes('does not exist') || message.includes('could not find'));
}

export { isMissingColumnError };
