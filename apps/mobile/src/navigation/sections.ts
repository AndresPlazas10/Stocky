import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

export type SectionId =
  | 'home'
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'combos'
  | 'proveedores'
  | 'empleados'
  | 'reportes'
  | 'configuracion'
  | 'impresion';

export type SectionGroup = 'principal' | 'gestion' | 'sistema';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type SectionMeta = {
  id: SectionId;
  label: string;
  group: SectionGroup;
  icon: IconName;
};

export const SECTION_IDS: SectionId[] = [
  'home',
  'ventas',
  'compras',
  'inventario',
  'combos',
  'proveedores',
  'empleados',
  'reportes',
  'configuracion',
  'impresion',
];

export const ADMIN_SECTION_IDS: SectionId[] = [...SECTION_IDS];

// Paridad con web: dashboard de empleado solo expone estas 3 vistas.
export const EMPLOYEE_SECTION_IDS: SectionId[] = ['home', 'ventas', 'inventario', 'impresion'];

export function getSectionsBySource(source: 'owner' | 'employee' | null | undefined): SectionId[] {
  if (source === 'employee') return EMPLOYEE_SECTION_IDS;
  return ADMIN_SECTION_IDS;
}

export function useSectionMeta(): SectionMeta[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      { id: 'home', label: t('navigation.home'), group: 'principal', icon: 'home-outline' },
      { id: 'ventas', label: t('navigation.sales'), group: 'principal', icon: 'cart-outline' },
      {
        id: 'compras',
        label: t('navigation.purchases'),
        group: 'principal',
        icon: 'bag-handle-outline',
      },
      {
        id: 'inventario',
        label: t('navigation.inventory'),
        group: 'principal',
        icon: 'cube-outline',
      },
      { id: 'combos', label: t('navigation.combos'), group: 'principal', icon: 'layers-outline' },
      {
        id: 'proveedores',
        label: t('navigation.suppliers'),
        group: 'gestion',
        icon: 'business-outline',
      },
      {
        id: 'empleados',
        label: t('navigation.employees'),
        group: 'gestion',
        icon: 'people-outline',
      },
      {
        id: 'reportes',
        label: t('navigation.reports'),
        group: 'sistema',
        icon: 'stats-chart-outline',
      },
      {
        id: 'configuracion',
        label: t('navigation.settings'),
        group: 'sistema',
        icon: 'settings-outline',
      },
      { id: 'impresion', label: t('navigation.printing'), group: 'sistema', icon: 'print-outline' },
    ],
    [t],
  );
}

export function useSectionGroupLabels(): Record<SectionGroup, string> {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      principal: t('navigation.main'),
      gestion: t('navigation.management'),
      sistema: t('navigation.system'),
    }),
    [t],
  );
}
