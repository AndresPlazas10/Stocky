export interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string | unknown;
  hint?: string;
}

export function isFunctionUnavailableError(
  errorLike: SupabaseErrorLike | null | undefined,
  functionName: string,
): boolean {
  if (!errorLike) return false;
  const code = String(errorLike.code || '').toLowerCase();
  const message = String(errorLike.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === 'pgrst202' ||
    message.includes(`function "${functionName}"`) ||
    message.includes(`function ${functionName}`) ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the function')
  );
}

export function isMissingColumnError(
  errorLike: SupabaseErrorLike | null | undefined,
  options?: { tableName?: string; columnName?: string },
): boolean {
  if (!errorLike) return false;
  const message = errorLike.message || '';
  const matchesColumn = options?.columnName ? message.includes(options.columnName) : true;
  const matchesTable = options?.tableName ? message.includes(options.tableName) : true;
  return errorLike.code === '42703' && matchesColumn && matchesTable;
}

export function wrapDbError(
  errorLike: SupabaseErrorLike | null | undefined,
  fallbackMessage: string,
): Error & { code?: string } {
  const message = errorLike?.message || fallbackMessage;
  const code = errorLike?.code;
  const error = new Error(message) as Error & { code?: string };
  if (code) error.code = code;
  return error;
}
