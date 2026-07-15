import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { type EmpleadoRecord } from '../../../services/empleadosService';
import { empleadosStyles as s } from '../empleadosStyles';
import { formatRoleLabel } from '../empleadosUtils';

interface EmployeeCardProps {
  employee: EmpleadoRecord;
  userId: string;
  canManageEmployees: boolean;
  checkingPermissions: boolean;
  deleting: boolean;
  onDelete: (employee: EmpleadoRecord) => void;
}

export const EmployeeCard = memo(function EmployeeCard({
  employee,
  userId,
  canManageEmployees,
  checkingPermissions,
  deleting,
  onDelete,
}: EmployeeCardProps) {
  const { t } = useTranslation();
  const initial =
    String(employee.full_name || '?')
      .trim()
      .charAt(0)
      .toUpperCase() || '?';
  const isSelfUser = Boolean(employee.user_id && employee.user_id === userId);
  const deleteDisabled = !canManageEmployees || checkingPermissions || deleting || isSelfUser;

  return (
    <View style={s.employeeCard}>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderText, s.cellEmployee]}>{t('empleados.card.employee')}</Text>
        <Text style={[s.tableHeaderText, s.cellUser]}>{t('empleados.card.username')}</Text>
      </View>

      <View style={s.tableRow}>
        <View style={[s.tableCell, s.cellEmployee]}>
          <View style={s.initialBadge}>
            <Text style={s.initialBadgeText}>{initial}</Text>
          </View>
          <Text style={s.employeeName}>{employee.full_name}</Text>
        </View>
        <View style={[s.tableCell, s.cellUser]}>
          <Ionicons name="person-outline" size={24} color="#6B7280" />
          <Text style={s.employeeUsername}>{employee.username}</Text>
        </View>
      </View>

      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderText, s.cellStatus]}>{t('empleados.card.status')}</Text>
        <Text style={[s.tableHeaderText, s.cellRole]}>{t('empleados.card.role')}</Text>
        <Text style={[s.tableHeaderText, s.cellAction]}>{t('empleados.card.action')}</Text>
      </View>

      <View style={s.tableRow}>
        <View style={[s.tableCell, s.cellStatus]}>
          <View style={[s.statusBadge, employee.is_active ? s.statusActive : s.statusInactive]}>
            <Ionicons
              name={employee.is_active ? 'checkmark-circle-outline' : 'close-circle-outline'}
              size={22}
              color={employee.is_active ? '#047857' : '#6B7280'}
            />
            <Text
              style={[
                s.statusBadgeText,
                employee.is_active ? s.statusActiveText : s.statusInactiveText,
              ]}
            >
              {employee.is_active ? t('empleados.card.active') : t('empleados.card.inactive')}
            </Text>
          </View>
        </View>

        <View style={[s.tableCell, s.cellRole]}>
          <Text style={s.roleValue}>{formatRoleLabel(employee.role)}</Text>
        </View>

        <View style={[s.tableCell, s.cellAction]}>
          {canManageEmployees ? (
            <Pressable
              style={[s.deleteActionPill, deleteDisabled && s.buttonDisabled]}
              onPress={() => {
                if (deleteDisabled) return;
                onDelete(employee);
              }}
              disabled={deleteDisabled}
            >
              <Ionicons name="trash-outline" size={18} color="#9F1239" />
              <Text style={s.deleteActionText}>{isSelfUser ? t('empleados.card.yourUser') : t('empleados.card.delete')}</Text>
            </Pressable>
          ) : (
            <Text style={s.roleValue}>-</Text>
          )}
        </View>
      </View>
    </View>
  );
});
