import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase client for testing
 */
export function createTestClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Creates an admin Supabase client for test setup/teardown
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/**
 * Creates a test user with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object, error: object|null}>}
 */
export async function createTestUser(email, password) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  return { user: data?.user, error };
}

/**
 * Deletes a test user by ID
 * @param {string} userId
 */
export async function deleteTestUser(userId) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}

/**
 * Signs in a test user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{session: object|null, error: object|null}>}
 */
export async function signInTestUser(email, password) {
  const client = createTestClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  return { session: data?.session, error };
}

/**
 * Creates a test business
 * @param {string} userId - The owner's user ID
 * @param {string} name - Business name
 * @returns {Promise<object>}
 */
export async function createTestBusiness(userId, name) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('businesses')
    .insert({
      name,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deletes a test business and its related data
 * @param {string} businessId
 */
export async function deleteTestBusiness(businessId) {
  const admin = createAdminClient();
  // Delete related data first
  await admin.from('employees').delete().eq('business_id', businessId);
  await admin.from('products').delete().eq('business_id', businessId);
  await admin.from('tables').delete().eq('business_id', businessId);
  await admin.from('orders').delete().eq('business_id', businessId);
  await admin.from('businesses').delete().eq('id', businessId);
}

/**
 * Generates a unique test email
 * @param {string} prefix
 * @returns {string}
 */
export function generateTestEmail(prefix = 'test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}@test.example.com`;
}

/**
 * Test password that meets Supabase requirements
 */
export const TEST_PASSWORD = 'TestPassword123!';

/**
 * Waits for Supabase auth to be ready
 */
export async function waitForAuthReady() {
  const client = createTestClient();
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.auth.getSession();
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Supabase auth not ready after retries');
}
