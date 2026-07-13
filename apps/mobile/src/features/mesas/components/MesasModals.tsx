import React from 'react';
import type { Session } from '@supabase/supabase-js';

import type { MesaOrderCatalogItem, MesaOrderItem } from '../../../services/mesaOrderService';
import type { BusinessContext, MesaRecord } from '../../../services/mesasService';
import type { PaymentMethod, SplitSubAccount } from '../../../services/mesaCheckoutService';
import { OrderModal } from './OrderModal';
import { CreateMesaModal } from './CreateMesaModal';
import { DeleteMesaModal } from './DeleteMesaModal';
import { CloseOrderChoiceModal } from './CloseOrderChoiceModal';
import { PaymentModal } from './PaymentModal';
import { SplitBillModalRN } from '../SplitBillModalRN';
import type { ComboComponentShortage, StockShortage } from '../../../services/mesaOrderService';

type OrderState = {
  selectedMesa: MesaRecord | null;
  orderModalTitle: string;
  orderTotal: number;
  orderItems: MesaOrderItem[];
  filteredCatalog: MesaOrderCatalogItem[];
  searchCatalog: string;
  isCatalogLoading: boolean;
  loadingOrder: boolean;
  isSavingOrder: boolean;
  isClosingOrder: boolean;
  releasingEmptyOrder: boolean;
  isPrintInProgress: boolean;
  mutatingOrderItemId: string | null;
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
};

type Actions = {
  onDismiss: () => void;
  onSaveOrder: () => void;
  onPrintKitchen: () => void;
  onCloseOrder: () => void;
  onCatalogItemPress: (item: MesaOrderCatalogItem) => void;
  onUpdateOrderItemQuantity: (item: MesaOrderItem, delta: number) => void;
  onSearchChange: (query: string) => void;
  resolveOrderItemDisplayName: (item: MesaOrderItem) => string;
};

type CashChangeData = {
  isValid: boolean;
  change: number;
  paid: number;
  reason: 'invalid' | 'insufficient' | 'empty' | null;
};

export interface MesasModalsProps {
  session: Session;
  context: BusinessContext | null;
  isKeyboardVisible: boolean;

  showCreateMesaModal: boolean;
  isCreatingMesa: boolean;
  newTableNumber: string;
  mesaPreviewName: string;
  onChangeNumber: (value: string) => void;
  onSubmitCreateMesa: () => void;
  onCancelCreateMesa: () => void;

  showDeleteMesaModal: boolean;
  mesaToDelete: MesaRecord | null;
  isDeletingMesa: boolean;
  onCancelDeleteMesa: () => void;
  onConfirmDeleteMesa: () => void;

  showOrderModal: boolean;
  orderState: OrderState;
  actions: Actions;

  showCloseOrderChoiceModal: boolean;
  orderTotal: number;
  isClosingOrder: boolean;
  releasingEmptyOrder: boolean;
  onCloseCloseOrderChoice: () => void;
  onPayAllTogether: () => void;
  onSplitBill: () => void;

  showPaymentModal: boolean;
  paymentMethod: PaymentMethod;
  amountReceived: string;
  cashChangeData: CashChangeData | null;
  showPaymentMethodMenu: boolean;
  onClosePayment: () => void;
  onTogglePaymentMenu: () => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onAmountReceivedChange: (value: string) => void;
  onConfirmPayment: () => void;

  showSplitBillModal: boolean;
  orderItems: MesaOrderItem[];
  resolveItemName?: (item: MesaOrderItem) => string;
  isClosingSplitBill: boolean;
  onBackSplitBill: () => void;
  onCloseSplitBill: () => void;
  onConfirmSplitBill: (payload: { subAccounts: SplitSubAccount[] }) => void;
}

export const MesasModals = React.memo(function MesasModals(props: MesasModalsProps) {
  return (
    <>
      <CreateMesaModal
        visible={props.showCreateMesaModal}
        isCreatingMesa={props.isCreatingMesa}
        newTableNumber={props.newTableNumber}
        mesaPreviewName={props.mesaPreviewName}
        isKeyboardVisible={props.isKeyboardVisible}
        onChangeNumber={props.onChangeNumber}
        onSubmit={props.onSubmitCreateMesa}
        onCancel={props.onCancelCreateMesa}
      />

      <DeleteMesaModal
        visible={props.showDeleteMesaModal}
        mesaToDelete={props.mesaToDelete}
        isDeletingMesa={props.isDeletingMesa}
        onCancel={props.onCancelDeleteMesa}
        onConfirm={props.onConfirmDeleteMesa}
      />

      <OrderModal
        visible={props.showOrderModal}
        session={props.session}
        context={props.context}
        orderState={props.orderState}
        actions={props.actions}
        isKeyboardVisible={props.isKeyboardVisible}
      />

      <CloseOrderChoiceModal
        visible={props.showCloseOrderChoiceModal}
        orderTotal={props.orderTotal}
        isClosingOrder={props.isClosingOrder}
        releasingEmptyOrder={props.releasingEmptyOrder}
        onClose={props.onCloseCloseOrderChoice}
        onPayAllTogether={props.onPayAllTogether}
        onSplitBill={props.onSplitBill}
      />

      <PaymentModal
        visible={props.showPaymentModal}
        isClosing={props.isClosingOrder}
        paymentMethod={props.paymentMethod}
        amountReceived={props.amountReceived}
        orderTotal={props.orderTotal}
        cashChangeData={props.cashChangeData}
        showMenu={props.showPaymentMethodMenu}
        onClose={props.onClosePayment}
        onToggleMenu={props.onTogglePaymentMenu}
        onPaymentMethodChange={props.onPaymentMethodChange}
        onAmountReceivedChange={props.onAmountReceivedChange}
        onConfirm={props.onConfirmPayment}
      />

      <SplitBillModalRN
        visible={props.showSplitBillModal}
        orderItems={props.orderItems}
        resolveItemName={props.resolveItemName}
        submitting={props.isClosingSplitBill}
        onBack={props.onBackSplitBill}
        onClose={props.onCloseSplitBill}
        onConfirm={props.onConfirmSplitBill}
      />
    </>
  );
});
