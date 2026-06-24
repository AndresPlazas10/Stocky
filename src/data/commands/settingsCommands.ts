import { supabaseAdapter } from '../adapters/supabaseAdapter';

export async function createInvoicingRequest({
  businessId,
  contactMethod,
  message = null,
  nitProvided = null
}: {
  businessId: string;
  contactMethod: string;
  message?: string | null;
  nitProvided?: string | null;
}): Promise<boolean> {
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
