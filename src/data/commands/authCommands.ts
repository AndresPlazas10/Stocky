import { supabaseAdapter } from '../adapters/supabaseAdapter';
import type { Business } from '../../types';

interface NormalizeUsernameResult {
  cleanUsername: string;
  email: string;
}

interface SignInResult {
  user: Record<string, unknown> | null;
  session: Record<string, unknown> | null;
  username: string;
}

interface SignUpResult {
  authData: Record<string, unknown> | null;
  cleanUsername: string;
  cleanEmail: string;
}

export function normalizeUsernameToEmail(username: string): NormalizeUsernameResult {
  const cleanUsername = String(username || '').trim().toLowerCase();
  return {
    cleanUsername,
    email: `${cleanUsername}@stockly-app.com`
  };
}

export async function signInWithUsernamePassword({
  username,
  password
}: {
  username: string;
  password: string;
}): Promise<SignInResult> {
  const { cleanUsername, email } = normalizeUsernameToEmail(username);
  const { data, error } = await supabaseAdapter.signInWithPassword({
    email,
    password
  });
  if (error) {
    throw new Error('❌ Usuario o contraseña incorrectos');
  }
  return {
    user: (data?.user as unknown as Record<string, unknown>) || null,
    session: (data?.session as unknown as Record<string, unknown>) || null,
    username: cleanUsername
  };
}

export async function signUpBusinessOwner({
  username,
  password,
  businessName,
  emailRedirectTo
}: {
  username: string;
  password: string;
  businessName: string;
  emailRedirectTo?: string;
}): Promise<SignUpResult> {
  const { cleanUsername, email } = normalizeUsernameToEmail(username);

  const { data, error } = await supabaseAdapter.signUpWithPassword({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        username: cleanUsername,
        business_name: businessName
      }
    }
  });

  if (error) throw error;
  return {
    authData: (data as Record<string, unknown>) || null,
    cleanUsername,
    cleanEmail: email
  };
}

export async function signOutSession(): Promise<boolean> {
  const { error } = await supabaseAdapter.signOut();
  if (error) throw error;
  return true;
}

export async function signOutGlobalSession(): Promise<boolean> {
  const { error } = await supabaseAdapter.signOutGlobal();
  if (error) throw error;
  return true;
}

interface BusinessPayload {
  name?: string;
  nit?: string;
  address?: string;
  phone?: string;
  email?: string;
  username?: string;
  created_at?: string;
  [key: string]: unknown;
}

export async function createBusinessRecord(payload: BusinessPayload): Promise<Partial<Business> | null> {
  const createdAt = String(payload?.created_at || '').trim() || new Date().toISOString();
  const normalizedPayload = {
    ...payload,
    created_at: createdAt
  };

  const rpcPayload = {
    p_name: normalizedPayload?.name || null,
    p_nit: normalizedPayload?.nit || null,
    p_address: normalizedPayload?.address || null,
    p_phone: normalizedPayload?.phone || null,
    p_email: normalizedPayload?.email || null,
    p_username: normalizedPayload?.username || null
  };

  const { data: rpcData, error: rpcError } = await supabaseAdapter.createBusinessForCurrentUserRpc(rpcPayload);
  if (!rpcError) {
    if (rpcData?.id && !rpcData?.created_at) {
      const { data: patchedBusiness, error: patchError } = await supabaseAdapter.updateBusinessById(
        rpcData.id,
        { created_at: createdAt }
      );
      if (!patchError && patchedBusiness) {
        return patchedBusiness;
      }
    }
    return rpcData || null;
  }

  const rpcMessage = String(rpcError?.message || '').toLowerCase();
  const rpcMissing = rpcMessage.includes('does not exist') || rpcMessage.includes('not found');
  if (!rpcMissing) throw rpcError;

  const { data, error } = await supabaseAdapter.insertBusiness(normalizedPayload);
  if (error) throw error;
  return data || null;
}

export async function createEmployeeRecord(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdapter.insertEmployee(payload);
  if (error) throw error;
  return data || null;
}
