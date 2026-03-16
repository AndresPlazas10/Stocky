-- Security audit logs for tracking sensitive actions
create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  user_id uuid not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_logs_business_id_idx
  on public.security_audit_logs (business_id);

create index if not exists security_audit_logs_created_at_idx
  on public.security_audit_logs (created_at desc);

alter table public.security_audit_logs enable row level security;

drop policy if exists security_audit_logs_select_policy on public.security_audit_logs;
create policy security_audit_logs_select_policy
  on public.security_audit_logs
  for select
  using (public.can_access_business(business_id));

drop policy if exists security_audit_logs_insert_policy on public.security_audit_logs;
create policy security_audit_logs_insert_policy
  on public.security_audit_logs
  for insert
  with check (
    auth.uid() = user_id
    and public.can_access_business(business_id)
  );
