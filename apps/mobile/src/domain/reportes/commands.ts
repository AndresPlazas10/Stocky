import type { ReportesPeriod, ReportesSnapshot } from './contracts';
import { listReportesByBusinessId } from './queries';

export async function mutateReportes({
  businessId,
  period = '30d',
}: {
  businessId: string;
  period?: ReportesPeriod;
}): Promise<ReportesSnapshot> {
  return listReportesByBusinessId(businessId, { period });
}
