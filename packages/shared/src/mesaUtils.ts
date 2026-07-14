export function isMesaOccupied(status: string | null | undefined): boolean {
  return (
    String(status || '')
      .trim()
      .toLowerCase() === 'occupied'
  );
}

export function normalizeTableIdentifier(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

export function compareMesaTableIdentifiers(
  left: { table_number?: string | number | null; table_name?: string | null; id?: string },
  right: { table_number?: string | number | null; table_name?: string | null; id?: string },
): number {
  const leftId = normalizeTableIdentifier(left?.table_number ?? left?.table_name ?? left?.id);
  const rightId = normalizeTableIdentifier(right?.table_number ?? right?.table_name ?? right?.id);

  return leftId.localeCompare(rightId, 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function resolveMesaSyncVersion(
  mesa: { sync_version?: number | null } | null | undefined,
): number {
  const raw = Number(mesa?.sync_version);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function mesaDisplayName(
  mesa: { table_name?: string | null; table_number?: string | number | null; id: string },
  tablePrefix?: string,
): string {
  if (mesa.table_name && String(mesa.table_name).trim()) return String(mesa.table_name).trim();
  const prefix = tablePrefix || 'Mesa';
  if (
    mesa.table_number !== null &&
    mesa.table_number !== undefined &&
    String(mesa.table_number).trim()
  ) {
    return `${prefix} ${String(mesa.table_number).trim()}`;
  }
  return `${prefix} ${mesa.id.slice(0, 6)}`;
}
