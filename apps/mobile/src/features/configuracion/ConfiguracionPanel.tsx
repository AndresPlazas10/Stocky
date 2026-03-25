import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { updateConfiguracionBusinessProfile } from '../../domain/configuracion/commands';
import { listConfiguracionByBusinessId } from '../../domain/configuracion/queries';
import type { ConfiguracionSnapshot } from '../../domain/configuracion/contracts';
import { deleteCurrentAccount } from '../../services/accountService';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyModal } from '../../ui/StockyModal';
import { StockyStatusToast } from '../../ui/StockyStatusToast';

const TERMS_URL = 'https://www.stockypos.app/legal/terms.html';
const PRIVACY_URL = 'https://www.stockypos.app/legal/privacy.html';
const DELETE_ACCOUNT_URL = 'https://www.stockypos.app/legal/delete-account.html';

type Props = {
  businessId: string | null;
  businessName: string | null;
  source: 'owner' | 'employee' | null;
  userId: string;
  userEmail: string | null;
  businessError: string | null;
  onRefreshBusiness: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

type BusinessFormState = {
  nit: string;
  phone: string;
  address: string;
};

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getProfileLabel(source: Props['source'] | 'unknown') {
  if (source === 'owner') return 'Propietario';
  if (source === 'employee') return 'Empleado';
  return 'Desconocido';
}

function shortenUserId(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 28) return value;
  return `${value.slice(0, 28)}...`;
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <View style={styles.infoTopRow}>
        <Ionicons name={icon} size={24} color="#111827" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.sectionHeader}
    >
      <View style={styles.sectionHeaderTop}>
        <View style={styles.sectionHeaderIconWrap}>
          <Ionicons name={icon} size={28} color="#D1D5DB" />
        </View>
        <View style={styles.sectionHeaderTextWrap}>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable style={styles.sectionHeaderAction} onPress={onAction}>
            <Ionicons name="create-outline" size={18} color="#D1D5DB" />
            <Text style={styles.sectionHeaderActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function ConfiguracionPanel({
  businessId,
  businessName,
  source,
  userId,
  userEmail,
  businessError,
  onRefreshBusiness,
  onSignOut,
}: Props) {
  const [snapshot, setSnapshot] = useState<ConfiguracionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [autoPrintOnSale, setAutoPrintOnSale] = useState(false);
  const [showBusinessEditModal, setShowBusinessEditModal] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [showConfigUpdatedToast, setShowConfigUpdatedToast] = useState(false);
  const [configToastBusinessName, setConfigToastBusinessName] = useState('');
  const [configToastNit, setConfigToastNit] = useState('');
  const [businessForm, setBusinessForm] = useState<BusinessFormState>({
    nit: '',
    phone: '',
    address: '',
  });

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listConfiguracionByBusinessId({
        businessId,
        businessName,
        source,
        userId,
        userEmail,
      });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [businessId, businessName, source, userId, userEmail]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    setError(null);
    let deleted = false;
    try {
      await deleteCurrentAccount();
      deleted = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
    }

    if (deleted) {
      try {
        await onSignOut();
      } catch {
        // no-op: la cuenta ya fue eliminada
      }
    }

    setDeletingAccount(false);
    if (deleted) {
      setShowDeleteAccountModal(false);
    }
  };

  const handleOpenSiigo = async () => {
    try {
      await Linking.openURL('https://www.siigo.com/');
    } catch {
      setError('No se pudo abrir el enlace de Siigo.');
    }
  };

  const handleOpenTerms = async () => {
    try {
      await Linking.openURL(TERMS_URL);
    } catch {
      setError('No se pudo abrir los términos del servicio.');
    }
  };

  const handleOpenPrivacy = async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {
      setError('No se pudo abrir la política de privacidad.');
    }
  };

  const handleOpenDeleteAccountInfo = async () => {
    try {
      await Linking.openURL(DELETE_ACCOUNT_URL);
    } catch {
      setError('No se pudo abrir la información de eliminación de cuenta.');
    }
  };

  const userEmailLabel = useMemo(() => snapshot?.userEmail || userEmail || 'Sin email', [snapshot?.userEmail, userEmail]);
  const userIdLabel = useMemo(() => shortenUserId(snapshot?.userId || userId), [snapshot?.userId, userId]);
  const businessNameLabel = useMemo(() => snapshot?.businessName || businessName || 'Sin nombre', [snapshot?.businessName, businessName]);
  const businessNitLabel = useMemo(() => snapshot?.businessNit || 'Sin NIT', [snapshot?.businessNit]);
  const businessEmailLabel = useMemo(() => snapshot?.businessEmail || userEmail || 'Sin email', [snapshot?.businessEmail, userEmail]);
  const businessPhoneLabel = useMemo(() => snapshot?.businessPhone || 'Sin teléfono', [snapshot?.businessPhone]);
  const businessAddressLabel = useMemo(() => snapshot?.businessAddress || 'Sin dirección', [snapshot?.businessAddress]);
  const systemStatusLabel = snapshot?.connectionStatus === 'connected' ? 'Conectado' : 'Revisar';
  const systemVersionLabel = snapshot?.clientVersion ? `Stocky ${snapshot.clientVersion}` : 'Stocky v1.0.0';
  const profileLabel = getProfileLabel(snapshot?.source || source);

  const buildBusinessFormFromSnapshot = useCallback((): BusinessFormState => ({
    nit: String(snapshot?.businessNit || ''),
    phone: String(snapshot?.businessPhone || ''),
    address: String(snapshot?.businessAddress || ''),
  }), [
    snapshot?.businessAddress,
    snapshot?.businessNit,
    snapshot?.businessPhone,
  ]);

  const openBusinessEditModal = useCallback(() => {
    setError(null);
    setSuccess(null);
    setBusinessForm(buildBusinessFormFromSnapshot());
    setShowBusinessEditModal(true);
  }, [buildBusinessFormFromSnapshot]);

  const closeBusinessEditModal = useCallback(() => {
    if (savingBusiness) return;
    setShowBusinessEditModal(false);
  }, [savingBusiness]);

  const handleSaveBusinessProfile = useCallback(async () => {
    if (savingBusiness) return;

    if (source === 'employee') {
      setError('Solo el propietario puede editar la informacion del negocio.');
      return;
    }

    const normalizedName = String(snapshot?.businessName || businessName || '').trim();
    if (!normalizedName) {
      setError('El nombre del negocio es obligatorio.');
      return;
    }
    if (!businessId) {
      setError('No se encontro el negocio activo para actualizar.');
      return;
    }

    setSavingBusiness(true);
    setError(null);
    setSuccess(null);
    try {
      const nextBusinessName = normalizedName || businessNameLabel;
      const nextNit = String(businessForm.nit || '').trim() || businessNitLabel;
      await updateConfiguracionBusinessProfile({
        businessId,
        payload: {
          name: normalizedName,
          nit: businessForm.nit,
          phone: businessForm.phone,
          address: businessForm.address,
        },
      });

      await onRefreshBusiness();
      await loadSnapshot();
      setConfigToastBusinessName(nextBusinessName);
      setConfigToastNit(nextNit);
      setShowConfigUpdatedToast(true);
      setSuccess('Información del negocio actualizada correctamente.');
      setShowBusinessEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la información del negocio.');
    } finally {
      setSavingBusiness(false);
    }
  }, [businessForm.address, businessForm.nit, businessForm.phone, businessId, businessName, loadSnapshot, onRefreshBusiness, savingBusiness, snapshot?.businessName, source]);


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageIntroCard}>
        <View style={styles.pageIntroIconWrap}>
          <Ionicons name="settings-outline" size={34} color="#D1D5DB" />
        </View>
        <View style={styles.pageIntroTextWrap}>
          <Text style={styles.pageIntroTitle}>Configuración</Text>
          <Text style={styles.pageIntroSubtitle}>Administra tu cuenta y negocio</Text>
        </View>
      </View>


      <View style={styles.sectionCard}>
        <SectionHeader icon="person-outline" title="Información del Usuario" subtitle="Datos de tu cuenta" />
        <View style={styles.sectionBody}>
          <InfoItem icon="mail-outline" label="Email" value={userEmailLabel} />
          <InfoItem icon="shield-outline" label="ID de Usuario" value={userIdLabel} />
          <InfoItem icon="person-circle-outline" label="Perfil" value={profileLabel} />

          <Pressable
            style={[styles.signOutButton, signingOut && styles.disabled]}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={24} color="#B91C1C" />
            <Text style={styles.signOutText}>{signingOut ? 'Cerrando...' : 'Cerrar Sesión'}</Text>
          </Pressable>

          <Pressable
            style={[styles.deleteAccountButton, deletingAccount && styles.disabled]}
            onPress={() => setShowDeleteAccountModal(true)}
            disabled={deletingAccount}
          >
            <Ionicons name="trash-outline" size={22} color="#DC2626" />
            <Text style={styles.deleteAccountText}>Eliminar cuenta</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader
          icon="business-outline"
          title="Información del Negocio"
          subtitle="Datos de tu empresa"
          actionLabel="Editar"
          onAction={openBusinessEditModal}
        />
        <View style={styles.sectionBody}>
          <InfoItem icon="business-outline" label="Nombre del Negocio" value={businessNameLabel} />
          <InfoItem icon="shield-outline" label="NIT" value={businessNitLabel} />
          <InfoItem icon="mail-outline" label="Email" value={businessEmailLabel} />
          <InfoItem icon="call-outline" label="Teléfono" value={businessPhoneLabel} />
          <InfoItem icon="location-outline" label="Dirección" value={businessAddressLabel} />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader icon="information-circle-outline" title="Información del Sistema" subtitle="Detalles técnicos" />
        <View style={styles.sectionBody}>
          <View style={[styles.systemItem, styles.systemInfoBlue]}>
            <View style={styles.systemTopRow}>
              <Ionicons name="settings-outline" size={24} color="#2563EB" />
              <Text style={[styles.systemLabel, styles.systemBlueText]}>Versión</Text>
            </View>
            <Text style={[styles.systemValue, styles.systemBlueText]}>{systemVersionLabel}</Text>
          </View>

          <View style={[styles.systemItem, styles.systemInfoPurple]}>
            <View style={styles.systemTopRow}>
              <Ionicons name="server-outline" size={24} color="#9333EA" />
              <Text style={[styles.systemLabel, styles.systemPurpleText]}>Base de Datos</Text>
            </View>
            <Text style={[styles.systemValue, styles.systemPurpleText]}>Supabase PostgreSQL</Text>
          </View>

          <View style={[styles.systemItem, styles.systemInfoGreen]}>
            <View style={styles.systemTopRow}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#059669" />
              <Text style={[styles.systemLabel, styles.systemGreenText]}>Estado</Text>
            </View>
            <Text style={[styles.systemValue, styles.systemGreenText]}>• {systemStatusLabel}</Text>
          </View>

          <View style={[styles.systemItem, styles.systemInfoYellow]}>
            <View style={styles.systemTopRow}>
              <Ionicons name="print-outline" size={24} color="#A16207" />
              <Text style={[styles.systemLabel, styles.systemYellowText]}>Impresora térmica</Text>
            </View>
            <Text style={styles.systemSubLabel}>Ancho de papel</Text>
            <Pressable
              style={styles.paperSelector}
              onPress={() => setPaperWidth((current) => (current === '80mm' ? '58mm' : '80mm'))}
            >
              <Text style={styles.paperSelectorText}>{paperWidth}</Text>
              <Ionicons name="chevron-down-outline" size={20} color="#78716C" />
            </Pressable>

            <Pressable style={styles.checkRow} onPress={() => setAutoPrintOnSale((prev) => !prev)}>
              <Ionicons
                name={autoPrintOnSale ? 'checkbox-outline' : 'square-outline'}
                size={30}
                color="#78716C"
              />
              <Text style={styles.checkText}>Imprimir recibo automáticamente al cerrar venta</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.billingCard}>
        <View style={styles.billingHeader}>
          <View style={styles.billingHeaderIcon}>
            <Ionicons name="document-text-outline" size={28} color="#D1D5DB" />
          </View>
          <View style={styles.billingHeaderTextWrap}>
            <Text style={styles.billingHeaderTitle}>Facturación electrónica</Text>
            <Text style={styles.billingHeaderSubtitle}>Gestión externa al runtime de Stocky</Text>
          </View>
        </View>

        <View style={styles.billingBody}>
          <View style={styles.billingInfoBox}>
            <View style={styles.billingInfoTop}>
              <Ionicons name="information-circle-outline" size={24} color="#2563EB" />
              <Text style={styles.billingInfoTitle}>Estado actual del producto</Text>
            </View>
            <Text style={styles.billingInfoText}>
              Stocky no emite facturas electrónicas DIAN desde el runtime de la app. {businessNameLabel}
              {' '}debe gestionar su facturación oficial directamente en su proveedor autorizado.
            </Text>
          </View>

          <View style={styles.billingWarnBox}>
            <Text style={styles.billingWarnText}>
              Los comprobantes generados en Stocky son informativos y no reemplazan la factura electrónica oficial.
            </Text>
          </View>

          <Pressable style={styles.siigoButton} onPress={handleOpenSiigo}>
            <Text style={styles.siigoButtonText}>Ir a Siigo</Text>
            <Ionicons name="open-outline" size={22} color="#E5E7EB" />
          </Pressable>
        </View>
      </View>

      <View style={styles.legalCard}>
        <View style={styles.legalHeader}>
          <View style={styles.legalHeaderIcon}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#D1D5DB" />
          </View>
          <View style={styles.legalHeaderTextWrap}>
            <Text style={styles.legalHeaderTitle}>Información legal</Text>
            <Text style={styles.legalHeaderSubtitle}>Políticas y términos vigentes</Text>
          </View>
        </View>
        <View style={styles.legalBody}>
          <Pressable style={styles.legalButton} onPress={handleOpenTerms}>
            <View style={styles.legalButtonIcon}>
              <Ionicons name="document-text-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.legalButtonTextWrap}>
              <Text style={styles.legalButtonTitle}>Términos del servicio</Text>
              <Text style={styles.legalButtonSubtitle}>Lee las condiciones de uso de Stocky</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#2563EB" />
          </Pressable>

          <Pressable style={styles.legalButton} onPress={handleOpenPrivacy}>
            <View style={styles.legalButtonIcon}>
              <Ionicons name="lock-closed-outline" size={20} color="#0F766E" />
            </View>
            <View style={styles.legalButtonTextWrap}>
              <Text style={styles.legalButtonTitle}>Política de privacidad</Text>
              <Text style={styles.legalButtonSubtitle}>Cómo protegemos la información</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#0F766E" />
          </Pressable>

          <Pressable style={styles.legalButton} onPress={handleOpenDeleteAccountInfo}>
            <View style={styles.legalButtonIcon}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </View>
            <View style={styles.legalButtonTextWrap}>
              <Text style={styles.legalButtonTitle}>Eliminar cuenta</Text>
              <Text style={styles.legalButtonSubtitle}>Opciones para solicitar la eliminación de datos</Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#DC2626" />
          </Pressable>
        </View>
      </View>

      <StockyModal
        visible={showBusinessEditModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="none"
        bodyFlex
        sheetStyle={styles.businessEditSheet}
        onClose={closeBusinessEditModal}
        headerSlot={(
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.businessEditHeader}
          >
            <View style={styles.businessEditHeaderLeft}>
              <View style={styles.businessEditHeaderIconWrap}>
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.businessEditHeaderTextWrap}>
                <Text style={styles.businessEditHeaderTitle}>Editar Negocio</Text>
                <Text style={styles.businessEditHeaderSubtitle}>Actualiza NIT, teléfono y dirección</Text>
              </View>
            </View>
            <Pressable style={styles.businessEditHeaderClose} onPress={closeBusinessEditModal} disabled={savingBusiness}>
              <Ionicons name="close" size={24} color="#E5E7EB" />
            </Pressable>
          </LinearGradient>
        )}
        footerStyle={styles.businessEditFooter}
        footer={(
          <View style={styles.businessEditFooterRow}>
            <Pressable
              style={[styles.businessEditCancelButton, savingBusiness && styles.disabled]}
              onPress={closeBusinessEditModal}
              disabled={savingBusiness}
            >
              <Text style={styles.businessEditCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.businessEditSaveWrap, savingBusiness && styles.disabled]}
              onPress={handleSaveBusinessProfile}
              disabled={savingBusiness}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.businessEditSaveButton}
              >
                {savingBusiness ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="save-outline" size={17} color="#FFFFFF" />}
                <Text style={styles.businessEditSaveText}>{savingBusiness ? 'Guardando...' : 'Guardar Cambios'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.businessEditFields}>
          <View style={styles.businessEditField}>
            <Text style={styles.businessEditLabel}>Nombre del Negocio (solo lectura)</Text>
            <View style={styles.businessEditReadOnlyBox}>
              <Text style={styles.businessEditReadOnlyText}>{businessNameLabel}</Text>
            </View>
          </View>

          <View style={styles.businessEditField}>
            <Text style={styles.businessEditLabel}>Email (solo lectura)</Text>
            <View style={styles.businessEditReadOnlyBox}>
              <Text style={styles.businessEditReadOnlyText}>{businessEmailLabel}</Text>
            </View>
          </View>

          <View style={styles.businessEditField}>
            <Text style={styles.businessEditLabel}>NIT</Text>
            <TextInput
              value={businessForm.nit}
              onChangeText={(next) => setBusinessForm((prev) => ({ ...prev, nit: next }))}
              style={styles.businessEditInput}
              placeholder="900.123.456-7"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.businessEditField}>
            <Text style={styles.businessEditLabel}>Teléfono</Text>
            <TextInput
              value={businessForm.phone}
              onChangeText={(next) => setBusinessForm((prev) => ({ ...prev, phone: next }))}
              style={styles.businessEditInput}
              placeholder="+57 300 123 4567"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.businessEditField}>
            <Text style={styles.businessEditLabel}>Dirección</Text>
            <TextInput
              value={businessForm.address}
              onChangeText={(next) => setBusinessForm((prev) => ({ ...prev, address: next }))}
              style={[styles.businessEditInput, styles.businessEditTextArea]}
              placeholder="Calle 123 #45-67, Ciudad"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              multiline
            />
          </View>
        </View>
      </StockyModal>
      <StockyModal
        visible={showDeleteAccountModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="none"
        sheetStyle={styles.deleteAccountSheet}
        onClose={() => {
          if (deletingAccount) return;
          setShowDeleteAccountModal(false);
        }}
        headerSlot={(
          <LinearGradient
            colors={['#FEE2E2', '#FECACA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.deleteAccountHeader}
          >
            <View style={styles.deleteAccountHeaderIcon}>
              <Ionicons name="alert-circle-outline" size={22} color="#B91C1C" />
            </View>
            <View>
              <Text style={styles.deleteAccountTitle}>Eliminar cuenta</Text>
              <Text style={styles.deleteAccountSubtitle}>Esta acción es permanente</Text>
            </View>
          </LinearGradient>
        )}
        footerStyle={styles.deleteAccountFooter}
        footer={(
          <View style={styles.deleteAccountFooterRow}>
            <Pressable
              style={[styles.deleteAccountCancel, deletingAccount && styles.disabled]}
              onPress={() => setShowDeleteAccountModal(false)}
              disabled={deletingAccount}
            >
              <Text style={styles.deleteAccountCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteAccountConfirm, deletingAccount && styles.disabled]}
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
            >
              <Text style={styles.deleteAccountConfirmText}>
                {deletingAccount ? 'Eliminando...' : 'Eliminar'}
              </Text>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.deleteAccountBody}>
          <Text style={styles.deleteAccountBodyText}>
            Al eliminar tu cuenta se revocará tu acceso y los negocios asociados quedarán suspendidos.
          </Text>
          <Text style={styles.deleteAccountBodyText}>
            Si estás seguro, confirma para continuar.
          </Text>
        </View>
      </StockyModal>
      <StockyStatusToast
        visible={showConfigUpdatedToast}
        title="Configuración Actualizada"
        primaryLabel="Negocio"
        primaryValue={configToastBusinessName || businessNameLabel}
        secondaryLabel="NIT"
        secondaryValue={configToastNit || businessNitLabel}
        durationMs={1200}
        onClose={() => setShowConfigUpdatedToast(false)}
      />

      <Text style={styles.footerText}>
        Última actualización: {snapshot?.generatedAt ? formatShortDateTime(snapshot.generatedAt) : 'n/a'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  loadingContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIntroCard: {
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#003B46',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  pageIntroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIntroTextWrap: {
    flex: 1,
    gap: 2,
  },
  pageIntroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: STOCKY_COLORS.textPrimary,
  },
  pageIntroSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: STOCKY_COLORS.textSecondary,
  },
  sectionCard: {
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    overflow: 'hidden',
    shadowColor: '#003B46',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeaderIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTextWrap: {
    flex: 1,
    gap: 1,
  },
  sectionHeaderTitle: {
    color: '#D1D5DB',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHeaderSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeaderAction: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sectionHeaderActionText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionBody: {
    padding: 12,
    gap: 10,
  },
  infoItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteAccountButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteAccountText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  systemItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  systemInfoBlue: {
    backgroundColor: '#DFEAFE',
  },
  systemInfoPurple: {
    backgroundColor: '#F3E8FF',
  },
  systemInfoGreen: {
    backgroundColor: '#DCFCE7',
  },
  systemInfoYellow: {
    backgroundColor: '#FEF9C3',
  },
  systemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  systemLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  systemSubLabel: {
    color: '#7C5A2A',
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  systemValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  systemBlueText: {
    color: '#1E3A8A',
  },
  systemPurpleText: {
    color: '#6B21A8',
  },
  systemGreenText: {
    color: '#065F46',
  },
  systemYellowText: {
    color: '#92400E',
  },
  paperSelector: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paperSelectorText: {
    color: '#78350F',
    fontSize: 16,
    fontWeight: '800',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  checkText: {
    flex: 1,
    color: '#4A3614',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 18,
  },
  billingCard: {
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    overflow: 'hidden',
    shadowColor: '#003B46',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  billingHeader: {
    backgroundColor: '#1E355B',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billingHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  billingHeaderTitle: {
    color: '#E5E7EB',
    fontSize: 20,
    fontWeight: '800',
  },
  billingHeaderSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  billingBody: {
    padding: 12,
    gap: 10,
  },
  billingInfoBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E3F6',
    backgroundColor: '#EFF6FF',
    padding: 12,
    gap: 8,
  },
  billingInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billingInfoTitle: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  billingInfoText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 20,
  },
  billingWarnBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5E6B3',
    backgroundColor: '#FFFBEB',
    padding: 12,
  },
  billingWarnText: {
    color: '#6B4A1F',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 22,
  },
  siigoButton: {
    alignSelf: 'flex-start',
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#0B1F44',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  siigoButtonText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
  },
  legalCard: {
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    overflow: 'hidden',
    shadowColor: '#003B46',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  legalHeader: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  legalHeaderTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '800',
  },
  legalHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  legalBody: {
    padding: 12,
    gap: 10,
  },
  legalButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legalButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalButtonTextWrap: {
    flex: 1,
    gap: 2,
  },
  legalButtonTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  legalButtonSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  businessEditSheet: {
    maxWidth: 760,
    maxHeight: '90%',
    borderRadius: 22,
    borderColor: '#D6DDE7',
    backgroundColor: '#FFFFFF',
  },
  businessEditHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  businessEditHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  businessEditHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessEditHeaderTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  businessEditHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  businessEditHeaderSubtitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  businessEditHeaderClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  businessEditFooter: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  businessEditFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  businessEditCancelButton: {
    minHeight: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7DEE8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  businessEditCancelText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
  },
  businessEditSaveWrap: {
    flex: 1,
  },
  businessEditSaveButton: {
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
  businessEditSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  businessEditFields: {
    gap: 10,
  },
  businessEditField: {
    gap: 6,
  },
  businessEditLabel: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  businessEditInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  businessEditReadOnlyBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    minHeight: 46,
  },
  businessEditReadOnlyText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  businessEditTextArea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  businessEditRow: {
    flexDirection: 'row',
    gap: 10,
  },
  businessEditCol: {
    flex: 1,
  },
  deleteAccountSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  deleteAccountHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAccountHeaderIcon: {
    height: 40,
    width: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7F1D1D',
  },
  deleteAccountSubtitle: {
    fontSize: 12,
    color: '#7F1D1D',
  },
  deleteAccountBody: {
    padding: 16,
    gap: 10,
  },
  deleteAccountBodyText: {
    fontSize: 12.5,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  deleteAccountFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  deleteAccountFooterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteAccountCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountCancelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#374151',
  },
  deleteAccountConfirm: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountConfirmText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.7,
  },
});
