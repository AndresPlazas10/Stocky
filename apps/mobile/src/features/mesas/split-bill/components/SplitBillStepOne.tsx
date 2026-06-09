import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STOCKY_COLORS } from '../../../../theme/tokens';
import { MAX_SUB_ACCOUNTS, type AccountState } from '../splitBillUtils';
import { splitBillStyles as styles } from '../splitBillStyles';

interface SplitBillStepOneProps {
  accounts: AccountState[];
  onAddAccount: () => void;
  onRemoveAccount: (accountId: number) => void;
}

export function SplitBillStepOne({ accounts, onAddAccount, onRemoveAccount }: SplitBillStepOneProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>1. Configura cuentas</Text>
      <Text style={styles.helper}>
        Define cuántas cuentas pagarán esta orden.
      </Text>
      <View style={styles.counterCard}>
        <Text style={styles.counterLabel}>Número de cuentas</Text>
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
            style={[styles.counterButton, accounts.length >= MAX_SUB_ACCOUNTS && styles.actionButtonDisabled]}
            onPress={onAddAccount}
            disabled={accounts.length >= MAX_SUB_ACCOUNTS}
          >
            <Ionicons name="add" size={18} color={STOCKY_COLORS.primary900} />
          </Pressable>
        </View>
        <Text style={styles.counterHint}>Máximo {MAX_SUB_ACCOUNTS} cuentas</Text>
      </View>
      <View style={styles.accountsPreview}>
        {accounts.map((account, index) => (
          <View key={account.id} style={styles.accountsPreviewChip}>
            <Text style={styles.accountsPreviewText}>{`Cuenta ${index + 1}`}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
