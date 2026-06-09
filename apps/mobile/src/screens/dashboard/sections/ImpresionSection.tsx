import { useDashboardContext } from '../DashboardContext';
import { ImpresionPanel } from '../../../features/impresion/ImpresionPanel';

export function ImpresionSection() {
  const { businessContext } = useDashboardContext();
  return (
    <ImpresionPanel
      businessName={businessContext?.businessName ?? undefined}
    />
  );
}
