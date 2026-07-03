import { normalizeReference } from './normalization';
import type { MesaRecord, MesaEditLock, MesaStatus } from '../services/mesasService';

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  error?: string;
};

export function normalizeTableIdentifier(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

export function isMesaOccupied(status: string | null | undefined): boolean {
  return (
    String(status || '')
      .trim()
      .toLowerCase() === 'occupied'
  );
}

export function compareMesaTableIdentifiers(left: MesaRecord, right: MesaRecord): number {
  const leftId = normalizeTableIdentifier(left?.table_number ?? left?.table_name ?? left?.id);
  const rightId = normalizeTableIdentifier(right?.table_number ?? right?.table_name ?? right?.id);

  return leftId.localeCompare(rightId, 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function resolveMesaSyncVersion(mesa: Partial<MesaRecord> | null | undefined): number {
  const raw = Number(mesa?.sync_version);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function mesaDisplayName(mesa: MesaRecord): string {
  if (mesa.table_name && String(mesa.table_name).trim()) return String(mesa.table_name).trim();
  if (
    mesa.table_number !== null &&
    mesa.table_number !== undefined &&
    String(mesa.table_number).trim()
  ) {
    return `Mesa ${String(mesa.table_number).trim()}`;
  }
  return `Mesa ${mesa.id.slice(0, 6)}`;
}

export function normalizeDisplayName(value: unknown, fallback = 'Usuario'): string {
  const normalized = normalizeReference(value);
  return normalized || fallback;
}

export function mesaEditorDisplayNameCacheKey(businessId: string, userId: string): string {
  return `${String(businessId || '').trim()}::${String(userId || '').trim()}`;
}

export function createMesaLockToken(): string {
  const random = Math.random().toString(36).slice(2, 11);
  return `${Date.now()}-${random}`;
}

export function normalizeMesaStatus(value: unknown): MesaStatus {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'occupied') return 'occupied';
  if (normalized === 'available') return 'available';
  return normalized || 'available';
}

export function normalizeMesaRow(row: Record<string, unknown>): MesaRecord {
  const hasOrderUnits = Boolean(row && typeof row === 'object' && 'order_units' in row);
  const rawOrderUnits = row?.order_units;
  const normalizedOrderUnits =
    rawOrderUnits === null || rawOrderUnits === undefined || String(rawOrderUnits).trim() === ''
      ? Number.NaN
      : Number(rawOrderUnits);
  const rawSyncVersion = Number(row?.sync_version);
  const rawTableNumber = row?.table_number;
  const rawTableName = row?.table_name;
  const ordersRecord =
    row.orders && typeof row.orders === 'object' && row.orders !== null
      ? (row.orders as Record<string, unknown>)
      : null;

  return {
    id: String(row?.id || ''),
    business_id: String(row?.business_id || ''),
    table_number:
      typeof rawTableNumber === 'string' || typeof rawTableNumber === 'number'
        ? rawTableNumber
        : null,
    table_name: typeof rawTableName === 'string' ? rawTableName : null,
    status: normalizeMesaStatus(row?.status),
    current_order_id: row?.current_order_id ? String(row.current_order_id) : null,
    order_units:
      hasOrderUnits && Number.isFinite(normalizedOrderUnits)
        ? Math.max(0, Math.floor(normalizedOrderUnits))
        : undefined,
    sync_version: Number.isFinite(rawSyncVersion)
      ? Math.max(0, Math.floor(rawSyncVersion))
      : undefined,
    orders: ordersRecord
      ? {
          id: ordersRecord.id as string | undefined,
          status: (ordersRecord.status as string | undefined) ?? undefined,
          total: Number(ordersRecord.total || 0),
        }
      : null,
  };
}

export function normalizeMesaEditLock(row: Record<string, unknown>): MesaEditLock {
  return {
    table_id: String(row?.table_id || ''),
    business_id: String(row?.business_id || ''),
    lock_owner_user_id: String(row?.lock_owner_user_id || ''),
    lock_owner_name: normalizeDisplayName(row?.lock_owner_name),
    lock_token: normalizeReference(row?.lock_token),
    lock_expires_at: normalizeReference(row?.lock_expires_at),
    updated_at: normalizeReference(row?.updated_at),
  };
}

export function hasSyncVersionField(rows: Record<string, unknown>[]): boolean {
  return (Array.isArray(rows) ? rows : []).some(
    (row) =>
      row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'sync_version'),
  );
}

export function formatErrorMessage(errorLike: unknown, fallback = 'Operacion fallida'): string {
  if (errorLike instanceof Error) {
    const message = String(errorLike.message || '').trim();
    return message || fallback;
  }

  if (typeof errorLike === 'string') {
    const message = errorLike.trim();
    return message || fallback;
  }

  if (!errorLike || typeof errorLike !== 'object') {
    return fallback;
  }

  const candidate = errorLike as {
    message?: unknown;
    error?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  const parts = [
    candidate.message,
    candidate.error,
    candidate.details,
    candidate.hint,
    candidate.code ? `code=${String(candidate.code)}` : null,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(' | ');

  try {
    return JSON.stringify(errorLike);
  } catch {
    return fallback;
  }
}

export function isDuplicateKeyError(errorLike: SupabaseErrorLike): boolean {
  return String(errorLike?.code || '').trim() === '23505';
}

export function isMissingColumnInRelationError(
  errorLike: SupabaseErrorLike,
  opts: { tableName: string; columnName: string },
): boolean {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column') &&
    message.includes(`"${opts.columnName}"`) &&
    message.includes('relation') &&
    message.includes(`"${opts.tableName}"`) &&
    message.includes('does not exist')
  );
}

export function isMissingTableEditLocksRelationError(errorLike: SupabaseErrorLike): boolean {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('relation') &&
    message.includes('"table_edit_locks"') &&
    message.includes('does not exist')
  );
}

export function isMissingTableEditLocksColumnError(
  errorLike: SupabaseErrorLike,
  columnName: string,
): boolean {
  return isMissingColumnInRelationError(errorLike, {
    tableName: 'table_edit_locks',
    columnName,
  });
}
