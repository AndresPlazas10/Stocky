-- ============================================
-- STOCKY - ROLLBACK OPERATIVO A 100% ONLINE
-- Enfoque conservador
-- Fecha: 2026-02-27
-- ============================================

begin;

-- 1) Verificar RPCs online críticas (no borrar idempotencia)
do $$
begin
  if to_regprocedure('public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid)') is null then
    raise exception 'Falta RPC requerida: public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid)';
  end if;
end $$;

-- 2) Asegurar permisos de ejecución para clientes autenticados
do $$
begin
  if to_regprocedure('public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid)') is not null then
    revoke all on function public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) from public;
    revoke all on function public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) from anon;
    grant execute on function public.create_sale_complete(uuid,uuid,text,text,jsonb,uuid,uuid) to authenticated;
  end if;

  if to_regprocedure('public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text)') is not null then
    revoke all on function public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text) from public;
    revoke all on function public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text) from anon;
    grant execute on function public.create_sale_complete_idempotent(uuid,uuid,text,text,jsonb,uuid,uuid,text) to authenticated;
  end if;

  if to_regprocedure('public.create_split_sales_complete_idempotent(uuid,uuid,jsonb,uuid,uuid,text)') is not null then
    revoke all on function public.create_split_sales_complete_idempotent(uuid,uuid,jsonb,uuid,uuid,text) from public;
    revoke all on function public.create_split_sales_complete_idempotent(uuid,uuid,jsonb,uuid,uuid,text) from anon;
    grant execute on function public.create_split_sales_complete_idempotent(uuid,uuid,jsonb,uuid,uuid,text) to authenticated;
  end if;
end $$;

-- 3) Desactivar cron de reconciliación automática (si existe)
-- (No elimina funciones; solo evita job periódico ligado al enfoque de auto-sync/reconcile)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'stocky_reconcile_tables_orders_consistency';
  end if;
exception
  when others then
    raise notice 'No se pudo desprogramar cron (continuando): %', sqlerrm;
end $$;

-- 4) Limpieza opcional de tabla idempotency_requests (NO borrar estructura)
-- Mantiene idempotencia online, solo limpia basura histórica.
do $$
begin
  if to_regclass('public.idempotency_requests') is not null then
    delete from public.idempotency_requests
    where created_at < now() - interval '14 days';
  end if;
end $$;

commit;
