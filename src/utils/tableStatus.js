export function normalizeTableStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'open') return 'occupied';
  if (raw === 'closed') return 'available';
  if (raw === 'occupied' || raw === 'available') return raw;
  return 'available';
}

export function normalizeTableRecord(table) {
  if (!table || typeof table !== 'object') return table;
  return {
    ...table,
    status: normalizeTableStatus(table.status)
  };
}

export function isTableOccupied(status) {
  return normalizeTableStatus(status) === 'occupied';
}

export function isTableAvailable(status) {
  return normalizeTableStatus(status) === 'available';
}
