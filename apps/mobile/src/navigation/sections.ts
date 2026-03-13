import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type SectionId =
  | 'home'
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'combos'
  | 'proveedores'
  | 'empleados'
  | 'reportes'
  | 'configuracion';

export type SectionGroup = 'principal' | 'gestion' | 'sistema';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type SectionMeta = {
  id: SectionId;
  label: string;
  group: SectionGroup;
  icon: IconName;
};

export const SECTION_META: SectionMeta[] = [
  { id: 'home', label: 'Inicio', group: 'principal', icon: 'home-outline' },
  { id: 'ventas', label: 'Ventas', group: 'principal', icon: 'cart-outline' },
  { id: 'compras', label: 'Compras', group: 'principal', icon: 'bag-handle-outline' },
  { id: 'inventario', label: 'Inventario', group: 'principal', icon: 'cube-outline' },
  { id: 'combos', label: 'Combos', group: 'principal', icon: 'layers-outline' },
  { id: 'proveedores', label: 'Proveedores', group: 'gestion', icon: 'business-outline' },
  { id: 'empleados', label: 'Empleados', group: 'gestion', icon: 'people-outline' },
  { id: 'reportes', label: 'Reportes', group: 'sistema', icon: 'stats-chart-outline' },
  { id: 'configuracion', label: 'Configuración', group: 'sistema', icon: 'settings-outline' },
];

export const SECTION_GROUP_LABELS: Record<SectionGroup, string> = {
  principal: 'Principal',
  gestion: 'Gestión',
  sistema: 'Sistema',
};

export const SECTION_BY_ID = SECTION_META.reduce<Record<SectionId, SectionMeta>>((acc, section) => {
  acc[section.id] = section;
  return acc;
}, {} as Record<SectionId, SectionMeta>);

export const SECTION_IDS = SECTION_META.map((section) => section.id);

export const ADMIN_SECTION_IDS: SectionId[] = [...SECTION_IDS];

// Paridad con web: dashboard de empleado solo expone estas 3 vistas.
export const EMPLOYEE_SECTION_IDS: SectionId[] = ['home', 'ventas', 'inventario'];

export function getSectionsBySource(source: 'owner' | 'employee' | null | undefined): SectionId[] {
  if (source === 'employee') return EMPLOYEE_SECTION_IDS;
  return ADMIN_SECTION_IDS;
}
