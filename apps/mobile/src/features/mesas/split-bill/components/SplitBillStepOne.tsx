import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS } from '../../../../theme/tokens';
import { MAX_SUB_ACCOUNTS, type AccountState } from '../splitBillUtils';
import { splitBillStyles as styles } from '../splitBillStyles';

interface SplitBillStepOneProps {
  accounts: AccountState[];
  onAddAccount: () => void;
  onRemoveAccount: (accountId: number) => void;
}

export function SplitBillStepOne({
  accounts,
  onAddAccount,
  onRemoveAccount,
}: SplitBillStepOneProps) {
  const { t } = useTranslation('mesas');

  return (
    <>
      <Text style={styles.sectionTitle}>1. {t('splitBill.addAccount')}</Text>
      <Text style={styles.helper}>
        {t('splitBill.subtitle', { defaultValue: 'Define cuántas cuentas pagarán esta orden.' })}
      </Text>
      <View style={styles.counterCard}>
        <Text style={styles.counterLabel}>
          {t('splitBill.addAccount', { defaultValue: 'Número de cuentas' })}
        </Text>
        <View style={styles.counterRow}>
          <Pressable
            style={[styles.counterButton, accounts.length <= 1 && styles.actionButtonDisabled]}
            onPress={() => onRemoveAccount(accounts[accounts.length - 1]?.id ?? 1)}
            disabled={accounts.length <= 1}
          >
            <Ionicons name="remove" size={18} color={STOCKY_COLORS.primary900} />
          </Pressable>
          <Text style={styles.counterValue}>{accounts.length}</Text>
          <Pressable
            style={[
              styles.counterButton,
              accounts.length >= MAX_SUB_ACCOUNTS && styles.actionButtonDisabled,
            ]}
            onPress={onAddAccount}
            disabled={accounts.length >= MAX_SUB_ACCOUNTS}
          >
            <Ionicons name="add" size={18} color={STOCKY_COLORS.primary900} />
          </Pressable>
        </View>
        <Text style={styles.counterHint}>
          {t('splitBill.maxAccounts', { count: MAX_SUB_ACCOUNTS })}
        </Text>
      </View>
      <View style={styles.accountsPreview}>
        {accounts.map((account, index) => (
          <View key={account.id} style={styles.accountsPreviewChip}>
            <Text style={styles.accountsPreviewText}>
              {t('splitBill.accountName', { number: index + 1 })}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}
