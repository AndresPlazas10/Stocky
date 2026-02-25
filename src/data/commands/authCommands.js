import { supabaseAdapter } from '../adapters/supabaseAdapter';

export function normalizeUsernameToEmail(username) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  return {
    cleanUsername,
    email: `${cleanUsername}@stockly-app.com`
  };
}

export async function signInWithUsernamePassword({
  username,
  password
}) {
  const { cleanUsername, email } = normalizeUsernameToEmail(username);
  const { data, error } = await supabaseAdapter.signInWithPassword({
    email,
    password
  });
  if (error) {
    throw new Error('❌ Usuario o contraseña incorrectos');
  }
  return {
    user: data?.user || null,
    session: data?.session || null,
    username: cleanUsername
  };
}

export async function signUpBusinessOwner({
  username,
  password,
  businessName,
  emailRedirectTo
}) {
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
    authData: data || null,
    cleanUsername,
    cleanEmail: email
  };
}

export async function signOutSession() {
  const { error } = await supabaseAdapter.signOut();
  if (error) throw error;
  return true;
}

export async function signOutGlobalSession() {
  const { error } = await supabaseAdapter.signOutGlobal();
  if (error) throw error;
  return true;
}

export async function createBusinessRecord(payload) {
  const rpcPayload = {
    p_name: payload?.name || null,
    p_nit: payload?.nit || null,
    p_address: payload?.address || null,
    p_phone: payload?.phone || null,
    p_email: payload?.email || null,
    p_username: payload?.username || null
  };

  const { data: rpcData, error: rpcError } = await supabaseAdapter.createBusinessForCurrentUserRpc(rpcPayload);
  if (!rpcError) return rpcData || null;

  const rpcMessage = String(rpcError?.message || '').toLowerCase();
  const rpcMissing = rpcMessage.includes('does not exist') || rpcMessage.includes('not found');
  if (!rpcMissing) throw rpcError;

  const { data, error } = await supabaseAdapter.insertBusiness(payload);
  if (error) throw error;
  return data || null;
}

export async function createEmployeeRecord(payload) {
  const { data, error } = await supabaseAdapter.insertEmployee(payload);
  if (error) throw error;
  return data || null;
}
