BEGIN;

-- Force security invoker for views flagged by Supabase linter (0010).
ALTER VIEW public.v_sales_with_invoices SET (security_invoker = true);
ALTER VIEW public.deprecated_invoicing_summary SET (security_invoker = true);
ALTER VIEW public.v_pending_invoicing_requests SET (security_invoker = true);
ALTER VIEW public.v_business_invoicing_status SET (security_invoker = true);
ALTER VIEW public.sales_receipts SET (security_invoker = true);

COMMIT;
