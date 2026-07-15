export function isMesaOccupied(status) {
    return (String(status || '')
        .trim()
        .toLowerCase() === 'occupied');
}
export function normalizeTableIdentifier(value) {
    return String(value ?? '').trim();
}
export function compareMesaTableIdentifiers(left, right) {
    const leftId = normalizeTableIdentifier(left?.table_number ?? left?.table_name ?? left?.id);
    const rightId = normalizeTableIdentifier(right?.table_number ?? right?.table_name ?? right?.id);
    return leftId.localeCompare(rightId, 'es', {
        numeric: true,
        sensitivity: 'base',
    });
}
export function resolveMesaSyncVersion(mesa) {
    const raw = Number(mesa?.sync_version);
    if (!Number.isFinite(raw))
        return 0;
    return Math.max(0, Math.floor(raw));
}
export function mesaDisplayName(mesa, tablePrefix) {
    if (mesa.table_name && String(mesa.table_name).trim())
        return String(mesa.table_name).trim();
    const prefix = tablePrefix || 'Mesa';
    if (mesa.table_number !== null &&
        mesa.table_number !== undefined &&
        String(mesa.table_number).trim()) {
        return `${prefix} ${String(mesa.table_number).trim()}`;
    }
    return `${prefix} ${mesa.id.slice(0, 6)}`;
}
//# sourceMappingURL=mesaUtils.js.map