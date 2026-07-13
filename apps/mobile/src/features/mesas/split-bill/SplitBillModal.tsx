import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StockyModal } from '../../../ui/StockyModal';
import type { MesaOrderItem } from '../../../services/mesaOrderService';
import type { SplitSubAccount } from '../../../services/mesaCheckoutService';
import { useSplitBillAccounts } from './hooks/useSplitBillAccounts';
import { useSplitBillNavigation } from './hooks/useSplitBillNavigation';
import { SplitBillStepper } from './components/SplitBillStepper';
import { SplitBillStepOne } from './components/SplitBillStepOne';
import { SplitBillStepTwo } from './components/SplitBillStepTwo';
import { splitBillStyles as styles } from './splitBillStyles';

type Props = {
  visible: boolean;
  orderItems: MesaOrderItem[];
  resolveItemName?: (item: MesaOrderItem) => string;
  submitting?: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (payload: { subAccounts: SplitSubAccount[] }) => void;
};

export const SplitBillModalRN = React.memo(function SplitBillModalRN({
  visible,
  orderItems,
  resolveItemName,
  submitting = false,
  onBack,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation('mesas');
  const {
    accounts,
    itemAssignments,
    subAccounts,
    canConfirm,
    addAccount,
    removeAccount,
    updateAccountPaymentMethod,
    adjustItemQuantityForAccount,
    getItemExpectedQuantity,
  } = useSplitBillAccounts({ visible, orderItems });

  const {
    currentStep,
    currentAccountIndex,
    currentAccount,
    isPaymentMenuOpen,
    setIsPaymentMenuOpen,
    primaryButtonLabel,
    secondaryButtonLabel,
    isPrimaryDisabled,
    handlePrimaryAction,
    handleSecondaryAction,
  } = useSplitBillNavigation({
    accountsCount: accounts.length,
    submitting,
    canConfirm,
    subAccounts,
    onBack,
    onConfirm,
  });

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={14}
      deferContent
      deferBehavior="hide"
      sheetStyle={styles.modalSheet}
      contentContainerStyle={styles.modalContent}
      contentStyle={styles.modalScroll}
      bodyFlex
      headerSlot={
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderIcon}>
            <Ionicons name="receipt-outline" size={20} color="#4F46E5" />
          </View>
          <View style={styles.modalHeaderTextWrap}>
            <Text style={styles.modalHeaderTitle}>{t('splitBill.title')}</Text>
            <Text style={styles.modalHeaderSubtitle}>
              {t('splitBill.subtitle', {
                defaultValue: 'Distribuye productos por cuenta y confirma.',
              })}
            </Text>
          </View>
        </View>
      }
      onClose={onClose}
      footerStyle={styles.modalFooter}
      footer={
        <View style={styles.footerRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleSecondaryAction}
            disabled={submitting}
          >
            <Text style={styles.secondaryButtonText}>{secondaryButtonLabel}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButtonWrap, isPrimaryDisabled && styles.actionButtonDisabled]}
            onPress={handlePrimaryAction}
            disabled={isPrimaryDisabled}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButton}
            >
              <Ionicons
                name={
                  currentStep === 2 && currentAccountIndex >= accounts.length - 1
                    ? 'checkmark-circle-outline'
                    : 'arrow-forward-circle-outline'
                }
                size={18}
                color="#E9D5FF"
              />
              <Text style={styles.actionButtonText}>{primaryButtonLabel}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      {currentStep === 1 ? <SplitBillStepper currentStep={currentStep} /> : null}

      {currentStep === 1 ? (
        <SplitBillStepOne
          accounts={accounts}
          onAddAccount={addAccount}
          onRemoveAccount={removeAccount}
        />
      ) : null}

      {currentStep === 2 ? (
        <SplitBillStepTwo
          currentAccountIndex={currentAccountIndex}
          accountsCount={accounts.length}
          currentAccount={currentAccount}
          orderItems={orderItems}
          itemAssignments={itemAssignments}
          isPaymentMenuOpen={isPaymentMenuOpen}
          resolveItemName={resolveItemName}
          onTogglePaymentMenu={() => setIsPaymentMenuOpen((prev) => !prev)}
          onSelectPaymentMethod={(method) =>
            currentAccount && updateAccountPaymentMethod(currentAccount.id, method)
          }
          onAdjustQuantity={adjustItemQuantityForAccount}
          getItemExpectedQuantity={getItemExpectedQuantity}
        />
      ) : null}
    </StockyModal>
  );
});
