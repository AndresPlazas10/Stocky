import { supabaseAdapter } from '../adapters/supabaseAdapter';

export async function createInvoicingRequest({
  businessId,
  contactMethod,
  message = null,
  nitProvided = null
}) {
  const { error } = await supabaseAdapter.insertInvoicingRequest({
    business_id: businessId,
    status: 'pending',
    nit_provided: nitProvided,
    contact_method: contactMethod,
    message
  });

  if (error) throw error;
  return true;
}
