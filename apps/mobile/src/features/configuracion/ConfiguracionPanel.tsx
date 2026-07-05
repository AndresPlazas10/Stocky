import { ActivityIndicator, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { STOCKY_COLORS } from '../../theme/tokens';
import { useConfiguracionData } from './hooks/useConfiguracionData';
import { useBusinessForm } from './hooks/useBusinessForm';
import { useAccountActions } from './hooks/useAccountActions';
import { useToastContext } from '../../hooks/useToastContext';
import { TOAST_MESSAGES } from '../../constants/toastMessages';
import { UserSection } from './components/UserSection';
import { BusinessSection } from './components/BusinessSection';
import { SystemSection } from './components/SystemSection';
import { BillingSection } from './components/BillingSection';
import { LegalSection } from './components/LegalSection';
import { BusinessEditModal } from './components/BusinessEditModal';
import { DeleteAccountModal } from './components/DeleteAccountModal';
import { formatShortDateTime, getProfileLabel, shortenUserId } from './configuracionUtils';
import { configuracionStyles as styles } from './configuracionStyles';

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

export function ConfiguracionPanel({
  businessId,
  businessName,
  source,
  userId,
  userEmail,
  businessError: _businessError,
  onRefreshBusiness,
  onSignOut,
}: Props) {
  const toast = useToastContext();
  const {
    snapshot,
    loading,
    error: _error,
    setError,
    loadSnapshot,
  } = useConfiguracionData({
    businessId,
    businessName,
    source,
    userId,
    userEmail,
  });

  const {
    signingOut,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    deletingAccount,
    handleSignOut,
    handleDeleteAccount,
    handleOpenSiigo,
    handleOpenTerms,
    handleOpenPrivacy,
    handleOpenDeleteAccountInfo,
  } = useAccountActions({ onSignOut, setError });

  const {
    showBusinessEditModal,
    savingBusiness,
    businessForm,
    setBusinessForm,
    openBusinessEditModal,
    closeBusinessEditModal,
    handleSaveBusinessProfile,
  } = useBusinessForm({
    snapshot,
    businessId,
    businessName,
    source,
    onRefreshBusiness,
    loadSnapshot,
    setError,
    onBusinessSaved: () => {
      toast.showSuccess(TOAST_MESSAGES.configuracion.updated());
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  const userEmailLabel = snapshot?.userEmail || userEmail || 'Sin email';
  const userIdLabel = shortenUserId(snapshot?.userId || userId);
  const businessNameLabel = snapshot?.businessName || businessName || 'Sin nombre';
  const businessNitLabel = snapshot?.businessNit || 'Sin NIT';
  const businessEmailLabel = snapshot?.businessEmail || userEmail || 'Sin email';
  const businessPhoneLabel = snapshot?.businessPhone || 'Sin teléfono';
  const businessAddressLabel = snapshot?.businessAddress || 'Sin dirección';
  const systemStatusLabel = snapshot?.connectionStatus === 'connected' ? 'Conectado' : 'Revisar';
  const systemVersionLabel = snapshot?.clientVersion
    ? `Stocky ${snapshot.clientVersion}`
    : 'Stocky v1.0.0';
  const profileLabel = getProfileLabel(snapshot?.source || source);

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

      <UserSection
        userEmailLabel={userEmailLabel}
        userIdLabel={userIdLabel}
        profileLabel={profileLabel}
        signingOut={signingOut}
        deletingAccount={deletingAccount}
        onSignOut={handleSignOut}
        onDeleteAccount={() => setShowDeleteAccountModal(true)}
      />

      <BusinessSection
        businessNameLabel={businessNameLabel}
        businessNitLabel={businessNitLabel}
        businessEmailLabel={businessEmailLabel}
        businessPhoneLabel={businessPhoneLabel}
        businessAddressLabel={businessAddressLabel}
        onEdit={openBusinessEditModal}
      />

      <SystemSection
        systemVersionLabel={systemVersionLabel}
        systemStatusLabel={systemStatusLabel}
      />

      <BillingSection businessNameLabel={businessNameLabel} onOpenSiigo={handleOpenSiigo} />

      <LegalSection
        onOpenTerms={handleOpenTerms}
        onOpenPrivacy={handleOpenPrivacy}
        onOpenDeleteAccountInfo={handleOpenDeleteAccountInfo}
      />

      <BusinessEditModal
        visible={showBusinessEditModal}
        saving={savingBusiness}
        businessNameLabel={businessNameLabel}
        businessEmailLabel={businessEmailLabel}
        form={businessForm}
        onFormChange={(updates) => setBusinessForm((prev) => ({ ...prev, ...updates }))}
        onClose={closeBusinessEditModal}
        onSave={handleSaveBusinessProfile}
      />

      <DeleteAccountModal
        visible={showDeleteAccountModal}
        deleting={deletingAccount}
        onClose={() => {
          if (deletingAccount) return;
          setShowDeleteAccountModal(false);
        }}
        onConfirm={handleDeleteAccount}
      />

      <Text style={styles.footerText}>
        Última actualización:{' '}
        {snapshot?.generatedAt ? formatShortDateTime(snapshot.generatedAt) : 'n/a'}
        {' · '}v30
      </Text>
    </View>
  );
}
