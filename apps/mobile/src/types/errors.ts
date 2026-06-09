export type SupabaseErrorLike = {
  message?: string;
  code?: string;
  hint?: string;
  details?: string;
  status?: number;
} | null | undefined;
