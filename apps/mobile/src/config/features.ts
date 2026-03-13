import type { SectionId } from '../navigation/sections';

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export const SECTION_FEATURES: Record<SectionId, boolean> = {
  home: parseFlag(process.env.EXPO_PUBLIC_FEATURE_HOME, true),
  ventas: parseFlag(process.env.EXPO_PUBLIC_FEATURE_VENTAS, false),
  compras: parseFlag(process.env.EXPO_PUBLIC_FEATURE_COMPRAS, false),
  inventario: parseFlag(process.env.EXPO_PUBLIC_FEATURE_INVENTARIO, false),
  combos: parseFlag(process.env.EXPO_PUBLIC_FEATURE_COMBOS, false),
  proveedores: parseFlag(process.env.EXPO_PUBLIC_FEATURE_PROVEEDORES, false),
  empleados: parseFlag(process.env.EXPO_PUBLIC_FEATURE_EMPLEADOS, false),
  reportes: parseFlag(process.env.EXPO_PUBLIC_FEATURE_REPORTES, false),
  configuracion: parseFlag(process.env.EXPO_PUBLIC_FEATURE_CONFIGURACION, false),
};

export function isSectionEnabled(sectionId: SectionId): boolean {
  return SECTION_FEATURES[sectionId];
}
