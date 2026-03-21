// ============================================
// 🧹 Supabase Edge Function: delete-account
// ============================================
// Elimina el usuario autenticado y revoca su acceso.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Supabase env no configurado.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Token requerido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return new Response(
      JSON.stringify({ error: 'Sesión inválida' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Revocar acceso como owner (bloquea negocio) y limpiar empleado.
  const businessesUpdate = await adminClient
    .from('businesses')
    .update({ is_active: false })
    .eq('created_by', userId);

  if (businessesUpdate.error && businessesUpdate.error.code !== '42P01') {
    return new Response(
      JSON.stringify({ error: businessesUpdate.error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const employeeDelete = await adminClient
    .from('employees')
    .delete()
    .eq('user_id', userId);

  if (employeeDelete.error && employeeDelete.error.code !== '42P01') {
    return new Response(
      JSON.stringify({ error: employeeDelete.error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const deleteResult = await adminClient.auth.admin.deleteUser(userId);
  if (deleteResult.error) {
    return new Response(
      JSON.stringify({ error: deleteResult.error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
