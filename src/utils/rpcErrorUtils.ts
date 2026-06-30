import { isMissingColumnError } from '../data/adapters/supabaseAdapter/shared';

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
