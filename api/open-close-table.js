// api/open-close-table.js - Serverless function to open/close a table (idempotent, minimal payload)
// Deploy this as a Vercel serverless function or Supabase Edge Function.
import { createClient } from '@supabase/supabase-js';

// Allow fetch global in Edge runtimes
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Service role key not configured on server' });
  }

  try {
    const { table_id, action, user_id, tenant_id } = req.body || {};
    if (!table_id || !action) return res.status(400).json({ error: 'Missing params' });

    // Normalize action
    const act = action === 'open' ? 'open' : action === 'close' ? 'close' : null;
    if (!act) return res.status(400).json({ error: 'Invalid action' });

    // Minimal, idempotent update using WHERE to avoid unnecessary writes
    if (act === 'open') {
      const { data, error } = await supabase
        .from('tables')
        .update({ status: 'open', opened_by: user_id || null, opened_at: new Date().toISOString(), version: supabase.raw('coalesce(version,0) + 1') })
        .eq('id', table_id)
        .eq('tenant_id', tenant_id)
        .neq('status', 'open')
        .select('id,status,opened_at,updated_at,version')
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        const { data: current } = await supabase.from('tables').select('id,status,opened_at,updated_at,version').eq('id', table_id).limit(1);
        return res.status(200).json({ ok: true, data: current?.[0] || null });
      }
      return res.status(200).json({ ok: true, data: data[0] });
    }

    if (act === 'close') {
      const { data, error } = await supabase
        .from('tables')
        .update({ status: 'closed', closed_by: user_id || null, closed_at: new Date().toISOString(), version: supabase.raw('coalesce(version,0) + 1') })
        .eq('id', table_id)
        .eq('tenant_id', tenant_id)
        .neq('status', 'closed')
        .select('id,status,closed_at,updated_at,version')
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        const { data: current } = await supabase.from('tables').select('id,status,closed_at,updated_at,version').eq('id', table_id).limit(1);
        return res.status(200).json({ ok: true, data: current?.[0] || null });
      }
      return res.status(200).json({ ok: true, data: data[0] });
    }

    return res.status(400).json({ error: 'Unhandled action' });
  } catch (err) {
    console.error('open-close-table error', err?.message || err);
    return res.status(500).json({ error: (err && err.message) || 'server error' });
  }
}
