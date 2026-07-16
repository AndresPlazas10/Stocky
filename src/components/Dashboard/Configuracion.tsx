import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { useAppToast } from '../../hooks/useAppToast';
import {
  updateBusinessProfile
} from '../../data/commands/businessCommands';
import { signOutSession } from '../../data/commands/authCommands';
import { supabase } from '../../supabase/Client';
import {
  Settings,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Save,
  X,
  LogOut,
  CheckCircle,
  AlertTriangle,
  Info,
  Database,
  Shield,
  Smartphone,
  Bell,
  Download,
  ExternalLink
} from 'lucide-react';
import type { RefObject } from 'react';

interface Business {
  id: string;
  name: string;
  nit?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ConfiguracionProps {
  user: { email?: string; id?: string };
  business: Business;
  onBusinessUpdate?: (business: Business) => void;
}

function Configuracion({ user, business, onBusinessUpdate }: ConfiguracionProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { showError, showSuccess, ToastComponent } = useAppToast();
  const [businessData, setBusinessData] = useState({
    name: '',
    nit: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (business) {
      setBusinessData({
        name: business.name || '',
        nit: business.nit || '',
        email: business.email || '',
        phone: business.phone || '',
        address: business.address || ''
      });
    }
  }, [business]);

  const handleBusinessChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBusinessData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleUpdateBusiness = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessData.name.trim()) {
      showError(t('errors.operationError'), t('messages.businessNameRequired'));
      return;
    }

    try {
      setLoading(true);

      const data = await updateBusinessProfile({
        businessId: business.id,
        payload: {
          name: businessData.name,
          nit: businessData.nit || null,
          email: businessData.email,
          phone: businessData.phone,
          address: businessData.address
        }
      });

      showSuccess(t('settings.saved'), t('configuracion.messages.infoUpdated'));
      setEditingBusiness(false);

      if (onBusinessUpdate && data) {
        onBusinessUpdate(data);
      }

    } catch (err) {
      showError(t('errors.operationError'), (err as Error).message || t('messages.errorUpdating'));
    } finally {
      setLoading(false);
    }
  }, [businessData, business, onBusinessUpdate, t]);

  const handleLogout = useCallback(async () => {
    try {
      await signOutSession();
      navigate('/');
    } catch {
      showError(t('errors.operationError'), t('messages.errorSigningOut'));
    }
  }, [navigate, t]);

  const handleDeleteAccount = useCallback(async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    let deleted = false;
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-account', { body: {} });
      if (deleteError) throw deleteError;
      deleted = true;
    } catch (err) {
      showError(t('errors.operationError'), (err as Error)?.message || t('messages.errorDeletingAccount'));
    }

    if (deleted) {
      try {
        await signOutSession();
      } catch (err) {
        logger.warn('configuracion:signout_after_delete_account failed', err);
      }
      navigate('/');
    }

    setDeletingAccount(false);
    if (deleted) {
      setShowDeleteAccountModal(false);
    }
  }, [deletingAccount, navigate, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#C4DFE6]/10 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-accent-500 to-secondary-500 rounded-xl">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{t('navigation.settings')}</h1>
              <p className="text-gray-600">{t('settings.manageAccount')}</p>
            </div>
          </div>
        </motion.div>

        {/* Información del Usuario */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="gradient-primary text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('labels.user')}</h2>
                <p className="text-white/80">{t('settings.accountData')}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-accent-600" />
                  <span className="text-sm text-gray-600 font-medium">{t('labels.email')}</span>
                </div>
                <p className="text-lg font-semibold text-gray-800 pl-8">{user?.email}</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-accent-600" />
                  <span className="text-sm text-gray-600 font-medium">{t('labels.user')}</span>
                </div>
                <p className="text-sm font-mono text-gray-600 pl-8 break-all">{user?.id?.substring(0, 30)}...</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
            >
              <LogOut className="w-5 h-5" />
              {t('buttons.signOut')}
            </button>

            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="mt-3 flex items-center gap-2 px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
            >
              <AlertTriangle className="w-5 h-5" />
              {t('buttons.delete')}
            </button>
          </div>
        </motion.div>

        {/* Información del Negocio */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="gradient-primary text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t('form.businessName')}</h2>
                  <p className="text-white/80">{t('settings.businessData')}</p>
                </div>
              </div>

              {!editingBusiness && (
                <button
                  onClick={() => setEditingBusiness(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all backdrop-blur-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('buttons.edit')}
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {!editingBusiness ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">{t('form.businessName')}</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.name}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">{t('labels.nit')}</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.nit || 'No registrado'}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">{t('labels.email')}</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.email || 'No especificado'}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Phone className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">{t('labels.phone')}</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.phone || 'No especificado'}</p>
                </div>

                {business?.address && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 md:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-accent-600" />
                      <span className="text-sm text-gray-600 font-medium">{t('labels.address')}</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-800 pl-8">{business.address}</p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUpdateBusiness} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Building2 className="w-4 h-4 text-accent-600" />
                      {t('form.businessName')} *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={businessData.name}
                      onChange={handleBusinessChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      placeholder={t('placeholders.businessNameExample')}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Shield className="w-4 h-4 text-accent-600" />
                      {t('labels.nit')}
                      <span className="text-xs font-normal text-gray-400">({t('labels.optional')})</span>
                    </label>
                    <input
                      type="text"
                      name="nit"
                      value={businessData.nit}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      placeholder="900.123.456-7"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Mail className="w-4 h-4 text-accent-600" />
                      {t('labels.email')}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={businessData.email}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      placeholder="contacto@negocio.com"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Phone className="w-4 h-4 text-accent-600" />
                      {t('labels.phone')}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={businessData.phone}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      placeholder="+57 300 123 4567"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="w-4 h-4 text-accent-600" />
                      {t('labels.address')}
                    </label>
                    <textarea
                      name="address"
                      value={businessData.address}
                      onChange={handleBusinessChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all resize-none"
                      placeholder={t('placeholders.addressExample')}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 gradient-primary hover:from-[#99D3DB] hover:to-[#66A5AD] text-black rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
                        {t('buttons.loading')}
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        {t('buttons.saveChanges')}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBusiness(false);
                      setBusinessData({
                        name: business?.name || '',
                        nit: business?.nit || '',
                        email: business?.email || '',
                        phone: business?.phone || '',
                        address: business?.address || ''
                      });
                    }}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                    {t('buttons.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Información del Sistema */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="gradient-primary text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('labels.version')}</h2>
                <p className="text-white/80">{t('settings.technicalDetails')}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700 font-medium">{t('labels.version')}</span>
                </div>
                <p className="text-lg font-bold text-gray-800 pl-8">Stocky v1.0.0</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700 font-medium">{t('labels.database')}</span>
                </div>
                <p className="text-lg font-bold text-gray-800 pl-8">Supabase PostgreSQL</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">{t('labels.status')}</span>
                </div>
                <p className="text-lg font-bold text-green-800 pl-8 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {t('status.connected')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sección de Dispositivos y Notificaciones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="gradient-primary text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('settings.devicesNotifications')}</h2>
                <p className="text-white/80">{t('settings.manageApps')}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta de Descargas */}
              <div className="p-4 bg-gradient-to-br from-violet-50 to-white rounded-xl border border-violet-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <Download className="w-5 h-5 text-violet-600" />
                  </div>
                  <span className="text-sm text-gray-600 font-medium">{t('buttons.download')}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3 pl-11">
                  {t('settings.downloadDescription')}
                </p>
                <button
                  onClick={() => window.open('/descargar', '_blank')}
                  className="ml-11 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  {t('settings.viewDownloads')}
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Tarjeta de Notificaciones */}
              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Bell className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="text-sm text-gray-600 font-medium">{t('settings.pushNotifications')}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3 pl-11">
                  {t('settings.notificationsDescription')}
                </p>
                <button
                  onClick={() => window.open('/descargar', '_blank')}
                  className="ml-11 flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  {t('settings.configureNotifications')}
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showDeleteAccountModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-3"
              onClick={() => !deletingAccount && setShowDeleteAccountModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 12 }}
                className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-rose-100 to-red-100 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60">
                      <AlertTriangle className="h-5 w-5 text-rose-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-rose-900">{t('buttons.delete')}</h3>
                      <p className="text-sm text-rose-800">{t('messages.actionCannotBeUndone')}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3 text-sm text-rose-900">
                  <p>
                    {t('settings.deleteAccountWarning')}
                  </p>
                  <p>{t('settings.confirmToContinue')}</p>
                </div>
                <div className="flex gap-3 p-5 pt-0">
                  <button
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                    onClick={() => setShowDeleteAccountModal(false)}
                    disabled={deletingAccount}
                  >
                    {t('buttons.cancel')}
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                  >
                    {deletingAccount ? t('buttons.loading') : t('buttons.delete')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ToastComponent />
    </div>
  );
}

export default Configuracion;
