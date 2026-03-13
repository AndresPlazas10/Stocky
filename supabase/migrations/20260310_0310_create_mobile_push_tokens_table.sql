BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT mobile_push_tokens_user_installation_unique UNIQUE (user_id, installation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_push_tokens_push_token_unique
  ON public.mobile_push_tokens (push_token);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_user_active
  ON public.mobile_push_tokens (user_id, is_active, updated_at DESC);

ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_push_tokens'
      AND policyname = 'mobile_push_tokens_select_own'
  ) THEN
    CREATE POLICY mobile_push_tokens_select_own
      ON public.mobile_push_tokens
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_push_tokens'
      AND policyname = 'mobile_push_tokens_insert_own'
  ) THEN
    CREATE POLICY mobile_push_tokens_insert_own
      ON public.mobile_push_tokens
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_push_tokens'
      AND policyname = 'mobile_push_tokens_update_own'
  ) THEN
    CREATE POLICY mobile_push_tokens_update_own
      ON public.mobile_push_tokens
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.mobile_push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mobile_push_tokens TO service_role;

COMMIT;

