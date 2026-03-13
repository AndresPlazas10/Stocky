-- Allow reusing a device push token across users (token can be reassigned).
-- Keep a non-unique index for lookup and cleanup.
DROP INDEX IF EXISTS public.idx_mobile_push_tokens_push_token_unique;

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_push_token
  ON public.mobile_push_tokens (push_token);
