import React, { Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { SectionId } from '../../../navigation/sections';
import type { RootDrawerParamList } from '../../../navigation/types';
import { isSectionEnabled } from '../../../config/features';
import { SectionComingSoon } from './SectionComingSoon';
import { StockyErrorBoundary } from '../../../ui/StockyErrorBoundary';

const HomeSection = React.lazy(() => import('./HomeSection').then((m) => ({ default: m.HomeSection })));
const VentasSection = React.lazy(() => import('./VentasSection').then((m) => ({ default: m.VentasSection })));
const ComprasSection = React.lazy(() => import('./ComprasSection').then((m) => ({ default: m.ComprasSection })));
const InventarioSection = React.lazy(() => import('./InventarioSection').then((m) => ({ default: m.InventarioSection })));
const CombosSection = React.lazy(() => import('./CombosSection').then((m) => ({ default: m.CombosSection })));
const ProveedoresSection = React.lazy(() => import('./ProveedoresSection').then((m) => ({ default: m.ProveedoresSection })));
const EmpleadosSection = React.lazy(() => import('./EmpleadosSection').then((m) => ({ default: m.EmpleadosSection })));
const ReportesSection = React.lazy(() => import('./ReportesSection').then((m) => ({ default: m.ReportesSection })));
const ConfiguracionSection = React.lazy(() => import('./ConfiguracionSection').then((m) => ({ default: m.ConfiguracionSection })));
const ImpresionSection = React.lazy(() => import('./ImpresionSection').then((m) => ({ default: m.ImpresionSection })));

const SectionFallback = () => (
  <ActivityIndicator size="large" color="#0AC946" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />
);

export function SectionHost({ sectionId }: { sectionId: SectionId }) {
  const navigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const enabled = isSectionEnabled(sectionId);

  if (sectionId === 'home') {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <HomeSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'ventas' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <VentasSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'compras' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <ComprasSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'inventario' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <InventarioSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'combos' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <CombosSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'proveedores' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <ProveedoresSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'empleados' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <EmpleadosSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'reportes' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <ReportesSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'configuracion' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <ConfiguracionSection />
        </Suspense>
      </StockyErrorBoundary>
    );
  }

  if (sectionId === 'impresion' && enabled) {
    return (
      <StockyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <ImpresionSection />
        </Suspense>
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
