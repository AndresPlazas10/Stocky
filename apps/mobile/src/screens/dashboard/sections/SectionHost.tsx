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
import { ImpresionSection } from './ImpresionSection';
import { InventarioSection } from './InventarioSection';
import { ProveedoresSection } from './ProveedoresSection';
import { ReportesSection } from './ReportesSection';
import { VentasSection } from './VentasSection';
import { SectionComingSoon } from './SectionComingSoon';
import { StockyErrorBoundary } from '../../../ui/StockyErrorBoundary';

export function SectionHost({ sectionId }: { sectionId: SectionId }) {
  const navigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const enabled = isSectionEnabled(sectionId);

  if (sectionId === 'home') {
    return (
      <StockyErrorBoundary>
        <HomeSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'ventas' && enabled) {
    return (
      <StockyErrorBoundary>
        <VentasSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'compras' && enabled) {
    return (
      <StockyErrorBoundary>
        <ComprasSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'inventario' && enabled) {
    return (
      <StockyErrorBoundary>
        <InventarioSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'combos' && enabled) {
    return (
      <StockyErrorBoundary>
        <CombosSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'proveedores' && enabled) {
    return (
      <StockyErrorBoundary>
        <ProveedoresSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'empleados' && enabled) {
    return (
      <StockyErrorBoundary>
        <EmpleadosSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'reportes' && enabled) {
    return (
      <StockyErrorBoundary>
        <ReportesSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'configuracion' && enabled) {
    return (
      <StockyErrorBoundary>
        <ConfiguracionSection />
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'impresion' && enabled) {
    return (
      <StockyErrorBoundary>
        <ImpresionSection />
      </StockyErrorBoundary>
    );
  }

  return (
    <SectionComingSoon
      sectionId={sectionId}
      disabledByFlag={!enabled}
      onGoHome={() => navigation.navigate('home')}
    />
  );
}
