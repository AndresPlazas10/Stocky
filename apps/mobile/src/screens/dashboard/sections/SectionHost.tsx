import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { SectionId } from '../../../navigation/sections';
import type { RootDrawerParamList } from '../../../navigation/types';
import { isSectionEnabled } from '../../../config/features';
import { HomeSection } from './HomeSection';
import { CombosSection } from './CombosSection';
import { ComprasSection } from './ComprasSection';
import { ConfiguracionSection } from './ConfiguracionSection';
import { EmpleadosSection } from './EmpleadosSection';
import { InventarioSection } from './InventarioSection';
import { ProveedoresSection } from './ProveedoresSection';
import { ReportesSection } from './ReportesSection';
import { VentasSection } from './VentasSection';
import { SectionComingSoon } from './SectionComingSoon';

export function SectionHost({ sectionId }: { sectionId: SectionId }) {
  const navigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const enabled = isSectionEnabled(sectionId);

  if (sectionId === 'home') {
    return <HomeSection />;
  }

  if (sectionId === 'ventas' && enabled) {
    return <VentasSection />;
  }

  if (sectionId === 'compras' && enabled) {
    return <ComprasSection />;
  }

  if (sectionId === 'inventario' && enabled) {
    return <InventarioSection />;
  }

  if (sectionId === 'combos' && enabled) {
    return <CombosSection />;
  }

  if (sectionId === 'proveedores' && enabled) {
    return <ProveedoresSection />;
  }

  if (sectionId === 'empleados' && enabled) {
    return <EmpleadosSection />;
  }

  if (sectionId === 'reportes' && enabled) {
    return <ReportesSection />;
  }

  if (sectionId === 'configuracion' && enabled) {
    return <ConfiguracionSection />;
  }

  return (
    <SectionComingSoon
      sectionId={sectionId}
      disabledByFlag={!enabled}
      onGoHome={() => navigation.navigate('home')}
    />
  );
}
