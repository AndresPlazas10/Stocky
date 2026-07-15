export declare function isMesaOccupied(status: string | null | undefined): boolean;
export declare function normalizeTableIdentifier(value: string | number | null | undefined): string;
export declare function compareMesaTableIdentifiers(left: {
    table_number?: string | number | null;
    table_name?: string | null;
    id?: string;
}, right: {
    table_number?: string | number | null;
    table_name?: string | null;
    id?: string;
}): number;
export declare function resolveMesaSyncVersion(mesa: {
    sync_version?: number | null;
} | null | undefined): number;
export declare function mesaDisplayName(mesa: {
    table_name?: string | null;
    table_number?: string | number | null;
    id: string;
}, tablePrefix?: string): string;
//# sourceMappingURL=mesaUtils.d.ts.map