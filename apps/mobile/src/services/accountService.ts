import { getSupabaseClient } from '../lib/supabase';

export async function deleteCurrentAccount(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.functions.invoke('delete-account', { body: {} });
  if (error) {
    throw error;
  }
}
