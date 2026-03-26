import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../../lib/supabase';
import {
  createEmployeeWithRpc,
  deleteEmployeeWithRpcFallback,
  getBusinessUsernameById,
  isEmployeeUsernameTaken,
  isOwnerRole,
  listEmployeesForManagement,
  type EmpleadoRecord,
} from '../../services/empleadosService';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyModal } from '../../ui/StockyModal';
import { StockyStatusToast } from '../../ui/StockyStatusToast';
import { StockyButton } from '../../ui/StockyButton';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

type EmployeeFormState = {
  full_name: string;
  username: string;
  password: string;
};

const INITIAL_FORM: EmployeeFormState = {
  full_name: '',
  username: '',
  password: '',
};
const EMPLOYEES_PAGE_SIZE = 40;

function normalizeRole(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function formatRoleLabel(role: string): string {
  const normalized = normalizeRole(role);
  if (normalized === 'owner' || normalized === 'propietario') return 'Propietario';
  if (normalized === 'admin' || normalized === 'administrador') return 'Administrador';
  return 'Empleado';
}

export function EmpleadosPanel({ businessId, businessName, userId, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmpleadoRecord[]>([]);
  const [canManageEmployees, setCanManageEmployees] = useState(source === 'owner');

  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(INITIAL_FORM);
  const [showEmployeeCreatedToast, setShowEmployeeCreatedToast] = useState(false);
  const [employeeToastName, setEmployeeToastName] = useState('');
  const [employeeToastUsername, setEmployeeToastUsername] = useState('');
  const [showEmployeeDeletedToast, setShowEmployeeDeletedToast] = useState(false);
  const [employeeDeletedName, setEmployeeDeletedName] = useState('');
  const [employeeDeletedUsername, setEmployeeDeletedUsername] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmpleadoRecord | null>(null);

  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    fullName: string;
    username: string;
    password: string;
  } | null>(null);
  const employeesRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(1);
  const [hasMoreEmployees, setHasMoreEmployees] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: 0,
      });
      setEmployees(list.filter((employee) => !isOwnerRole(employee.role)));
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de empleados.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const refreshEmployees = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: 0,
      });
      setEmployees(list.filter((employee) => !isOwnerRole(employee.role)));
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la lista de empleados.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  const refreshEmployeesSilently = useCallback(async () => {
    try {
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: 0,
      });
      setEmployees(list.filter((employee) => !isOwnerRole(employee.role)));
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(1);
    } catch {
      // no-op
    }
  }, [businessId]);

  const loadMoreEmployees = useCallback(async () => {
    if (loadingMore || !hasMoreEmployees) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: (nextPage - 1) * EMPLOYEES_PAGE_SIZE,
      });
      const normalized = list.filter((employee) => !isOwnerRole(employee.role));
      setEmployees((prev) => [...prev, ...normalized]);
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(nextPage);
    } catch {
      // no-op
    } finally {
      setLoadingMore(false);
    }
  }, [businessId, hasMoreEmployees, loadingMore, page]);

  const checkManagePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanManageEmployees(true);
      return;
    }

    setCheckingPermissions(true);
    try {
      const client = getSupabaseClient();
      const { data, error: roleError } = await client
        .from('employees')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (roleError) throw roleError;
      const role = normalizeRole(data?.role);
      setCanManageEmployees(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageEmployees(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    loadData();
    checkManagePermission();
  }, [checkManagePermission, loadData]);

  useEffect(() => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) return undefined;

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    const scheduleEmployeesRefresh = () => {
      if (cancelled || employeesRealtimeRefreshTimerRef.current) return;
      employeesRealtimeRefreshTimerRef.current = setTimeout(() => {
        employeesRealtimeRefreshTimerRef.current = null;
        void refreshEmployeesSilently();
      }, 120);
    };

    const channel = client
      .channel(`mobile-empleados:${normalizedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employees',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleEmployeesRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleEmployeesRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      scheduleEmployeesRefresh();
    }, 20000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (employeesRealtimeRefreshTimerRef.current) {
        clearTimeout(employeesRealtimeRefreshTimerRef.current);
        employeesRealtimeRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [businessId, refreshEmployeesSilently]);

  const openCreateModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setShowFormModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowFormModal(false);
    setForm(INITIAL_FORM);
  }, []);

  const submitCreateEmployee = useCallback(async () => {
    if (creating || !canManageEmployees) return;

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      if (!businessId) {
        throw new Error('No se detecto un negocio activo.');
      }

      const cleanFullName = String(form.full_name || '').trim();
      const cleanUsername = String(form.username || '').trim().toLowerCase();
      const cleanPassword = String(form.password || '').trim();

      if (!cleanFullName) throw new Error('El nombre del empleado es requerido.');
      if (/^\d+$/.test(cleanFullName)) throw new Error('El nombre no puede ser solo numeros.');
      if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(cleanFullName)) throw new Error('El nombre debe contener al menos una letra.');
      if (cleanFullName.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres.');

      if (!cleanUsername) throw new Error('El username es requerido.');
      if (/^\d+$/.test(cleanUsername)) throw new Error('El username no puede ser solo numeros.');
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        throw new Error('El username solo puede contener letras minusculas, numeros y guion bajo.');
      }

      if (!cleanPassword) throw new Error('La contraseña es requerida.');
      if (cleanPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

      const usernameTaken = await isEmployeeUsernameTaken({
        businessId,
        username: cleanUsername,
      });
      if (usernameTaken) {
        throw new Error('Ya existe un empleado con ese username.');
      }

      const businessUsername = await getBusinessUsernameById(businessId);
      if (businessUsername && businessUsername.toLowerCase() === cleanUsername) {
        throw new Error('No puedes usar el username del negocio.');
      }

      const created = await createEmployeeWithRpc({
        businessId,
        fullName: cleanFullName,
        username: cleanUsername,
        password: cleanPassword,
        role: 'employee',
      });

      setGeneratedCredentials({
        fullName: created.fullName,
        username: created.username,
        password: created.password,
      });
      setEmployeeToastName(created.fullName || cleanFullName);
      setEmployeeToastUsername(created.username || cleanUsername);
      setShowEmployeeCreatedToast(true);
      setShowCredentialsModal(true);
      setSuccess('Empleado creado correctamente.');
      closeCreateModal();
      await refreshEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el empleado.');
    } finally {
      setCreating(false);
    }
  }, [businessId, canManageEmployees, closeCreateModal, creating, form, refreshEmployees]);

  const askDeleteEmployee = useCallback((employee: EmpleadoRecord) => {
    if (!canManageEmployees) return;
    setEmployeeToDelete(employee);
    setShowDeleteModal(true);
  }, [canManageEmployees]);

  const confirmDeleteEmployee = useCallback(async () => {
    if (!employeeToDelete?.id || deleting || !canManageEmployees) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const deletedName = employeeToDelete.full_name || 'Empleado';
      const deletedUsername = employeeToDelete.username || 'usuario';
      if (employeeToDelete.user_id && employeeToDelete.user_id === userId) {
        throw new Error('No puedes eliminar tu propio usuario desde este modulo.');
      }

      await deleteEmployeeWithRpcFallback({
        employeeId: employeeToDelete.id,
        businessId,
      });
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      setEmployeeDeletedName(deletedName);
      setEmployeeDeletedUsername(deletedUsername);
      setShowEmployeeDeletedToast(true);
      setSuccess('Empleado eliminado correctamente.');
      await refreshEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el empleado.');
    } finally {
      setDeleting(false);
    }
  }, [businessId, canManageEmployees, deleting, employeeToDelete, refreshEmployees, userId]);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Ionicons name="people-outline" size={56} color="#C9CBD2" />
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Empleados</Text>
              <Text style={styles.heroSubtitle}>Gestiona empleados y accesos</Text>
            </View>
          </View>

          <Pressable
            style={[styles.heroInviteButtonWrap, (!canManageEmployees || checkingPermissions) && styles.buttonDisabled]}
            onPress={openCreateModal}
            disabled={!canManageEmployees || checkingPermissions}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroInviteButton}
            >
              <Ionicons name="person-add-outline" size={22} color="#D1D5DB" />
              <Text style={styles.heroInviteButtonText}>Invitar Empleado</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {(loading || refreshing) ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={styles.loadingText}>Cargando empleados...</Text>
          </View>
        ) : employees.length === 0 ? (
          <Text style={styles.emptyText}>No hay empleados registrados.</Text>
        ) : (
          <>
            {employees.map((employee) => {
              const initial = String(employee.full_name || '?').trim().charAt(0).toUpperCase() || '?';
              const isSelfUser = Boolean(employee.user_id && employee.user_id === userId);
              const deleteDisabled = !canManageEmployees || checkingPermissions || deleting || isSelfUser;
              return (
                <View key={employee.id} style={styles.employeeCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.cellEmployee]}>EMPLEADO</Text>
                  <Text style={[styles.tableHeaderText, styles.cellUser]}>USUARIO</Text>
                </View>

                <View style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.cellEmployee]}>
                    <View style={styles.initialBadge}>
                      <Text style={styles.initialBadgeText}>{initial}</Text>
                    </View>
                    <Text style={styles.employeeName}>{employee.full_name}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellUser]}>
                    <Ionicons name="person-outline" size={24} color="#6B7280" />
                    <Text style={styles.employeeUsername}>{employee.username}</Text>
                  </View>
                </View>

                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.cellStatus]}>ESTADO</Text>
                  <Text style={[styles.tableHeaderText, styles.cellRole]}>ROL</Text>
                  <Text style={[styles.tableHeaderText, styles.cellAction]}>ACCIÓN</Text>
                </View>

                <View style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.cellStatus]}>
                    <View style={[styles.statusBadge, employee.is_active ? styles.statusActive : styles.statusInactive]}>
                      <Ionicons
                        name={employee.is_active ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        size={22}
                        color={employee.is_active ? '#047857' : '#6B7280'}
                      />
                      <Text style={[styles.statusBadgeText, employee.is_active ? styles.statusActiveText : styles.statusInactiveText]}>
                        {employee.is_active ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.tableCell, styles.cellRole]}>
                    <Text style={styles.roleValue}>{formatRoleLabel(employee.role)}</Text>
                  </View>

                  <View style={[styles.tableCell, styles.cellAction]}>
                    {canManageEmployees ? (
                      <Pressable
                        style={[styles.deleteActionPill, deleteDisabled && styles.buttonDisabled]}
                        onPress={() => {
                          if (deleteDisabled) return;
                          askDeleteEmployee(employee);
                        }}
                        disabled={deleteDisabled}
                      >
                        <Ionicons name="trash-outline" size={18} color="#9F1239" />
                        <Text style={styles.deleteActionText}>{isSelfUser ? 'Tu usuario' : 'Eliminar'}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.roleValue}>-</Text>
                    )}
                  </View>
                </View>
                </View>
              );
            })}
            {hasMoreEmployees ? (
              <View style={styles.loadMoreWrap}>
                <Text style={styles.loadMoreHint}>Mostrando {employees.length} empleados</Text>
                <StockyButton onPress={loadMoreEmployees} loading={loadingMore} variant="ghost">
                  Cargar más empleados
                </StockyButton>
              </View>
            ) : null}
          </>
        )}
      </View>

      <StockyModal
        visible={showFormModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="none"
        bodyFlex
        sheetStyle={styles.employeeFormSheet}
        onClose={() => {
          if (creating) return;
          closeCreateModal();
        }}
        headerSlot={(
          <LinearGradient
            colors={['#EEF2FF', '#F5F3FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.employeeFormHeader}
          >
            <View style={styles.employeeFormHeaderLeft}>
              <View style={styles.employeeFormHeaderIconWrap}>
                <Ionicons name="person-add-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.employeeFormHeaderTitleWrap}>
                <Text style={styles.employeeFormHeaderTitle}>Nuevo Empleado</Text>
                <Text style={styles.employeeFormHeaderSubtitle}>Crea un acceso para tu equipo</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                if (creating) return;
                closeCreateModal();
              }}
              style={styles.employeeFormHeaderClose}
              disabled={creating}
            >
              <Ionicons name="close-circle-outline" size={22} color="#6B7280" />
            </Pressable>
          </LinearGradient>
        )}
        footerStyle={styles.employeeFormFooter}
        footer={(
          <View style={styles.employeeFormFooterRow}>
            <Pressable
              style={[styles.employeeFormCancelButton, creating && styles.buttonDisabled]}
              onPress={closeCreateModal}
              disabled={creating}
            >
              <Text style={styles.employeeFormCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.employeeFormSaveWrap, creating && styles.buttonDisabled]}
              onPress={submitCreateEmployee}
              disabled={creating}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.employeeFormSaveButton}
              >
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="person-add-outline" size={17} color="#FFFFFF" />}
                <Text style={styles.employeeFormSaveText}>{creating ? 'Creando empleado...' : 'Crear Empleado'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.employeeFormFields}>
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Nombre Completo *</Text>
            <TextInput
              value={form.full_name}
              onChangeText={(next) => setForm((prev) => ({ ...prev, full_name: next }))}
              placeholder="Ej: Juan Perez"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Usuario *</Text>
            <TextInput
              value={form.username}
              onChangeText={(next) => setForm((prev) => ({ ...prev, username: next.toLowerCase().replace(/\s+/g, '') }))}
              placeholder="juan_perez"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Solo letras minusculas, numeros y guion bajo.</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Contraseña *</Text>
            <TextInput
              value={form.password}
              onChangeText={(next) => setForm((prev) => ({ ...prev, password: next }))}
              placeholder="Minimo 6 caracteres"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Esta será la contraseña para iniciar sesión.</Text>
          </View>

          <View style={styles.roleInfoCard}>
            <Text style={styles.roleInfoText}>Rol asignado: Empleado</Text>
          </View>
        </View>
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar empleado"
        message={`¿Seguro que deseas eliminar a "${employeeToDelete?.full_name || 'este empleado'}"?`}
        warning="Esta acción revoca su acceso al negocio."
        itemLabel={employeeToDelete?.full_name || null}
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setShowDeleteModal(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={confirmDeleteEmployee}
      />

      <StockyModal
        visible={showCredentialsModal}
        title="Credenciales generadas"
        onClose={() => {
          setShowCredentialsModal(false);
          setGeneratedCredentials(null);
        }}
        footer={(
          <View style={styles.modalFooterRow}>
            <Pressable
              style={styles.modalSaveButton}
              onPress={() => {
                setShowCredentialsModal(false);
                setGeneratedCredentials(null);
              }}
            >
              <Text style={styles.modalSaveText}>Entendido</Text>
            </Pressable>
          </View>
        )}
      >
        <Text style={styles.credentialsTitle}>
          Comparte estas credenciales con {generatedCredentials?.fullName || 'el empleado'}:
        </Text>
        <View style={styles.credentialsCard}>
          <Text style={styles.credentialsLabel}>Usuario</Text>
          <Text style={styles.credentialsValue}>{generatedCredentials?.username || '-'}</Text>
        </View>
        <View style={styles.credentialsCard}>
          <Text style={styles.credentialsLabel}>Contraseña</Text>
          <Text style={styles.credentialsValue}>{generatedCredentials?.password || '-'}</Text>
        </View>
      </StockyModal>
      <StockyStatusToast
        visible={showEmployeeCreatedToast}
        title="Empleado Creado"
        primaryLabel="Empleado"
        primaryValue={employeeToastName || 'Empleado'}
        secondaryLabel="Usuario"
        secondaryValue={employeeToastUsername || 'usuario'}
        durationMs={1200}
        onClose={() => setShowEmployeeCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showEmployeeDeletedToast}
        title="Empleado Eliminado"
        primaryLabel="Empleado"
        primaryValue={employeeDeletedName || 'Empleado'}
        secondaryLabel="Usuario"
        secondaryValue={employeeDeletedUsername || 'usuario'}
        durationMs={1200}
        onClose={() => setShowEmployeeDeletedToast(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 27 * 1.08,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#4B5563',
    fontSize: 17 * 1.08,
    fontWeight: '500',
  },
  heroInviteButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroInviteButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  heroInviteButtonText: {
    color: '#D1D5DB',
    fontSize: 18 * 1.08,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  loadingBlock: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  employeeCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableHeaderText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
  },
  cellEmployee: {
    flex: 1.2,
  },
  cellUser: {
    flex: 1.2,
  },
  cellStatus: {
    flex: 1.1,
  },
  cellRole: {
    flex: 1,
  },
  cellAction: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    minHeight: 62,
    alignItems: 'center',
  },
  tableCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  initialBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialBadgeText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  employeeName: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '600',
  },
  employeeUsername: {
    color: '#4B5563',
    fontSize: 17,
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 4,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#BBF7D0',
  },
  statusInactive: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
  },
  statusBadgeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusActiveText: {
    color: '#047857',
  },
  statusInactiveText: {
    color: '#4B5563',
  },
  roleValue: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteActionPill: {
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    minHeight: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deleteActionText: {
    color: '#9F1239',
    fontSize: 16,
    fontWeight: '600',
  },
  employeeFormSheet: {
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: 22,
    borderColor: '#D6DDE7',
    backgroundColor: '#FFFFFF',
  },
  employeeFormHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  employeeFormHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  employeeFormHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(79,70,229,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeFormHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  employeeFormHeaderTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  employeeFormHeaderSubtitle: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
  },
  employeeFormHeaderClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  employeeFormFooter: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  employeeFormFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  employeeFormCancelButton: {
    minHeight: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7DEE8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  employeeFormCancelText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
  },
  employeeFormSaveWrap: {
    flex: 1,
  },
  employeeFormSaveButton: {
    minHeight: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  employeeFormSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  employeeFormFields: {
    gap: 10,
  },
  fieldGroup: {
    gap: 8,
  },
  inputLabel: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  roleInfoCard: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleInfoText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalCancelText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modalSaveButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: STOCKY_COLORS.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalSaveText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: STOCKY_COLORS.errorText,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalDangerText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  deleteSubtext: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  credentialsTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  credentialsCard: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  credentialsLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  credentialsValue: {
    color: STOCKY_COLORS.primary900,
    fontSize: 15,
    fontWeight: '800',
  },
  loadMoreWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadMoreHint: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
