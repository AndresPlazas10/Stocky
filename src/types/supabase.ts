export interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: PostgrestError | Error | null;
}

export interface SupabaseListResponse<T> {
  data: T[] | null;
  error: PostgrestError | Error | null;
  count?: number;
}

export interface RpcResult<T = unknown> {
  data?: T;
  error?: string | null;
}

export interface MutationResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ServiceListResult<T> {
  data: T[];
  count: number;
  error: string | null;
}

export type TFunction = (key: string, options?: Record<string, unknown>) => string;
