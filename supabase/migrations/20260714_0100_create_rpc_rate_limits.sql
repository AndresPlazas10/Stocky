-- Migration: Create rpc_rate_limits table and check_rate_limit function
-- Purpose: Rate limiting for critical RPCs to prevent abuse

-- Create the rate limits table
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rpc_name text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rpc_name, window_start)
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_window_start 
  ON public.rpc_rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own rate limits
CREATE POLICY rpc_rate_limits_select_policy ON public.rpc_rate_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY rpc_rate_limits_insert_policy ON public.rpc_rate_limits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY rpc_rate_limits_update_policy ON public.rpc_rate_limits
  FOR UPDATE USING (user_id = auth.uid());

-- Create the check_rate_limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_rpc_name text,
  p_max_requests integer DEFAULT 30,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_window_start timestamptz;
  v_current_count integer;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate window start
  v_window_start := date_trunc('minute', now());

  -- Try to get existing count for this window
  SELECT request_count INTO v_current_count
  FROM public.rpc_rate_limits
  WHERE user_id = v_user_id
    AND rpc_name = p_rpc_name
    AND window_start = v_window_start;

  IF v_current_count IS NULL THEN
    -- First request in this window
    INSERT INTO public.rpc_rate_limits (user_id, rpc_name, window_start, request_count)
    VALUES (v_user_id, p_rpc_name, v_window_start, 1)
    ON CONFLICT (user_id, rpc_name, window_start)
    DO UPDATE SET request_count = 1;
    RETURN true;
  END IF;

  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    RETURN false;
  END IF;

  -- Increment counter
  UPDATE public.rpc_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = v_user_id
    AND rpc_name = p_rpc_name
    AND window_start = v_window_start;

  RETURN true;
END;
$$;

-- Create cleanup function for old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rpc_rate_limits
  WHERE window_start < now() - interval '5 minutes';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO authenticated;

-- Add comment
COMMENT ON TABLE public.rpc_rate_limits IS 'Tracks RPC request counts per user for rate limiting';
COMMENT ON FUNCTION public.check_rate_limit IS 'Checks if a user has exceeded the rate limit for a specific RPC. Returns true if request is allowed.';
