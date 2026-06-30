import { SaleSuccessAlert } from '../../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../../ui/SaleErrorAlert';
import { SaleUpdateAlert } from '../../ui/SaleUpdateAlert';
import { PrintReceiptConfirmModal } from '../../ui/PrintReceiptConfirmModal';
import type { MesasAlertsProps } from '@/types/components';

export function MesasAlerts({
  isGeneratingSplitSales,
  isClosingOrder,
  success,
  alertType,
  successTitle,
  successDetails,
  error,
  showPrintModal,
  isPrintingReceipt,
  printCustomerName,
  onPrintConfirm,
  onPrintCancel,
  onPrintCustomerNameChange,
  onSuccessClose,
  onErrorClose,
}: MesasAlertsProps) {
  return (
    <>
      <SaleUpdateAlert
        key="split-sales-loading"
        isVisible={isGeneratingSplitSales}
        onClose={() => {}}
        title="Generando ventas..."
        details={[]}
        duration={600000}
      />
      <SaleUpdateAlert
        key="order-close-loading"
        isVisible={isClosingOrder && !isGeneratingSplitSales}
        onClose={() => {}}
        title="Generando venta..."
        details={[]}
        duration={600000}
      />
      <SaleSuccessAlert
        key="sale-success"
        isVisible={success && alertType === 'success'}
        onClose={onSuccessClose}
        title={successTitle}
        details={successDetails}
        duration={6000}
      />
      <SaleSuccessAlert
        key="table-update-success"
        isVisible={success && alertType === 'update'}
        onClose={onSuccessClose}
        title={successTitle}
        details={successDetails}
        duration={5000}
      />
      <SaleErrorAlert
        key="sale-error"
        isVisible={!!error}
        onClose={onErrorClose}
        title="Error"
        message={error || ''}
        details={[]}
        duration={7000}
      />
      <PrintReceiptConfirmModal
        key="print-receipt-confirm"
        isOpen={showPrintModal}
        onConfirm={onPrintConfirm}
        onCancel={onPrintCancel}
        isLoading={isPrintingReceipt}
        customerName={printCustomerName}
        onCustomerNameChange={onPrintCustomerNameChange}
      />
    </>
  );
}
