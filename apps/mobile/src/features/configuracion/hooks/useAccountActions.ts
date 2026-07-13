import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { deleteCurrentAccount } from '../../../services/accountService';
import { TERMS_URL, PRIVACY_URL, DELETE_ACCOUNT_URL } from '../configuracionUtils';

interface UseAccountActionsParams {
  onSignOut: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useAccountActions({ onSignOut, setError }: UseAccountActionsParams) {
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }, [onSignOut]);

  const handleDeleteAccount = useCallback(async () => {
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
  }, [deletingAccount, onSignOut, setError]);

  const handleOpenTerms = useCallback(async () => {
    try {
      await Linking.openURL(TERMS_URL);
    } catch {
      setError('No se pudo abrir los términos del servicio.');
    }
  }, [setError]);

  const handleOpenPrivacy = useCallback(async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {
      setError('No se pudo abrir la política de privacidad.');
    }
  }, [setError]);

  const handleOpenDeleteAccountInfo = useCallback(async () => {
    try {
      await Linking.openURL(DELETE_ACCOUNT_URL);
    } catch {
      setError('No se pudo abrir la información de eliminación de cuenta.');
    }
  }, [setError]);

  return {
    signingOut,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    deletingAccount,
    handleSignOut,
    handleDeleteAccount,
    handleOpenTerms,
    handleOpenPrivacy,
    handleOpenDeleteAccountInfo,
  };
}
