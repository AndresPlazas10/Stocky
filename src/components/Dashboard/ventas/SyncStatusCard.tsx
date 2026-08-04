import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { retryAllSalesOutboxErrorEvents } from '@/data/commands/salesCommands';

interface SyncStatusCardProps {
  salesOutboxState: any;
  lastSuccessfulSyncText: string;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  t: (key: string, options?: any) => string;
}

export function SyncStatusCard({ salesOutboxState, lastSuccessfulSyncText, showError, showSuccess, t }: SyncStatusCardProps) {
  return (
    <Card className="mb-6 rounded-2xl border border-accent-200 bg-white shadow-sm">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent-700">{t('ventas:sync.title')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('ventas:sync.description')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('ventas:sync.lastSync')} {lastSuccessfulSyncText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-800 border border-slate-200">{t('ventas:sync.queue')} {salesOutboxState.total}</Badge>
          <Badge className="bg-amber-100 text-amber-800 border border-amber-200">{t('ventas:sync.pending')} {salesOutboxState.pending}</Badge>
          <Badge className="bg-gray-100 text-gray-800 border border-gray-200">{t('ventas:sync.processing')} {salesOutboxState.processing}</Badge>
          <Badge className="bg-red-100 text-red-800 border border-red-200">{t('ventas:sync.errors')} {salesOutboxState.error}</Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={salesOutboxState.error <= 0}
            className="h-8 border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
            onClick={() => {
              const retried = retryAllSalesOutboxErrorEvents();
              if (retried <= 0) {
                showError('Error', t('ventas:sync.noErrors'));
                return;
              }
              showSuccess(t('ventas:sync.retryStarted'), `${t('ventas:title')}: ${retried}`);
            }}
          >
            {t('ventas:buttons.retryErrors')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
