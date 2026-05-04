import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import {
  updateBusinessProfile
} from '../../data/commands/businessCommands.js';
import { signOutSession } from '../../data/commands/authCommands.js';
import { supabase } from '../../supabase/Client.jsx';
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
  Printer,
  Smartphone,
  Bell,
  Download,
  ExternalLink
} from 'lucide-react';
import InvoicingSection from '../Settings/InvoicingSection';
import {
  getThermalPaperWidthMm,
  setThermalPaperWidthMm,
  isAutoPrintReceiptEnabled,
  setAutoPrintReceiptEnabled,
  isPrintBridgeEnabled,
  setPrintBridgeEnabled,
  getPrintBridgeEndpoint,
  setPrintBridgeEndpoint,
  getPrintBridgeToken,
  setPrintBridgeToken,
  getConfiguredPrinterName,
  setConfiguredPrinterName,
} from '../../utils/printer.js';

function Configuracion({ user, business, onBusinessUpdate }) {
  const _motionLintUsage = motion;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [printerPaperWidth, setPrinterPaperWidth] = useState(() => getThermalPaperWidthMm());
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(() => isAutoPrintReceiptEnabled());
  const [printBridgeEnabled, setPrintBridgeEnabledState] = useState(() => isPrintBridgeEnabled());
  const [printBridgeEndpoint, setPrintBridgeEndpointState] = useState(() => getPrintBridgeEndpoint());
  const [printBridgeToken, setPrintBridgeTokenState] = useState(() => getPrintBridgeToken());
  const [configuredPrinterName, setConfiguredPrinterNameState] = useState(() => getConfiguredPrinterName());

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

  const handleBusinessChange = useCallback((e) => {
    const { name, value } = e.target;
    setBusinessData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleUpdateBusiness = useCallback(async (e) => {
    e.preventDefault();

    if (!businessData.name.trim()) {
      setError('⚠️ El nombre del negocio es obligatorio');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

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

      setSuccess('Información actualizada correctamente');
      setEditingBusiness(false);

      // Actualizar business en el componente padre
      if (onBusinessUpdate && data) {
        onBusinessUpdate(data);
      }

      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      setError(error.message || 'Error al actualizar la información');
    } finally {
      setLoading(false);
    }
  }, [businessData, business, onBusinessUpdate]);

  const handleLogout = useCallback(async () => {
    try {
      await signOutSession();
      window.location.href = '/';
    } catch {
      setError('❌ No se pudo cerrar la sesión correctamente');
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    setError('');
    let deleted = false;
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-account', { body: {} });
      if (deleteError) throw deleteError;
      deleted = true;
    } catch (err) {
      setError(err?.message || '❌ No se pudo eliminar la cuenta.');
    }

    if (deleted) {
      try {
        await signOutSession();
      } catch {
        // no-op: la cuenta ya fue eliminada
      }
      window.location.href = '/';
    }

    setDeletingAccount(false);
    if (deleted) {
      setShowDeleteAccountModal(false);
    }
  }, [deletingAccount]);

  const handlePrinterWidthChange = useCallback((e) => {
    const nextWidth = Number(e.target.value);
    const saved = setThermalPaperWidthMm(nextWidth);
    if (saved) {
      setPrinterPaperWidth(nextWidth);
      setSuccess(`Configuración de impresora guardada: ${nextWidth}mm`);
    } else {
      setError('❌ No se pudo guardar la configuración de impresora');
    }
  }, []);

  const handleAutoPrintReceiptChange = useCallback((e) => {
    const nextValue = Boolean(e?.target?.checked);
    const saved = setAutoPrintReceiptEnabled(nextValue);
    if (saved) {
      setAutoPrintReceipt(nextValue);
      setSuccess(
        nextValue
          ? 'Autoimpresión de recibo activada'
          : 'Autoimpresión de recibo desactivada'
      );
    } else {
      setError('❌ No se pudo guardar la configuración de autoimpresión');
    }
  }, []);

  const handlePrintBridgeEnabledChange = useCallback((e) => {
    const nextValue = Boolean(e?.target?.checked);
    const saved = setPrintBridgeEnabled(nextValue);
    if (saved) {
      setPrintBridgeEnabledState(nextValue);
      setSuccess(nextValue ? 'Stocky Print Bridge activado' : 'Stocky Print Bridge desactivado');
    } else {
      setError('❌ No se pudo guardar la configuración del puente de impresión');
    }
  }, []);

  const handlePrintBridgeSave = useCallback(() => {
    const savedEndpoint = setPrintBridgeEndpoint(printBridgeEndpoint);
    const savedToken = setPrintBridgeToken(printBridgeToken);
    const savedPrinter = setConfiguredPrinterName(configuredPrinterName);

    if (savedEndpoint && savedToken && savedPrinter) {
      setPrintBridgeEndpointState(getPrintBridgeEndpoint());
      setPrintBridgeTokenState(getPrintBridgeToken());
      setConfiguredPrinterNameState(getConfiguredPrinterName());
      setSuccess('Configuración de Stocky Print Bridge guardada');
    } else {
      setError('❌ No se pudo guardar la configuración del puente de impresión');
    }
  }, [configuredPrinterName, printBridgeEndpoint, printBridgeToken]);

  useEffect(() => {
    let errorTimer, successTimer;
    if (error) errorTimer = setTimeout(() => setError(''), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(''), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#ffe498]/10 p-4 md:p-6">
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
              <h1 className="text-3xl font-bold text-gray-800">Configuración</h1>
              <p className="text-gray-600">Administra tu cuenta y negocio</p>
            </div>
          </div>
        </motion.div>

        {/* Alertas mejoradas */}
        <SaleErrorAlert
          isVisible={!!error}
          onClose={() => setError('')}
          title="Error"
          message={error}
          duration={5000}
        />

        <SaleSuccessAlert
          isVisible={!!success}
          onClose={() => setSuccess('')}
          title="✨ Configuración Guardada"
          details={[{ label: 'Acción', value: success }]}
          duration={5000}
        />

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
                <h2 className="text-xl font-bold">Información del Usuario</h2>
                <p className="text-white/80">Datos de tu cuenta</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-accent-600" />
                  <span className="text-sm text-gray-600 font-medium">Email</span>
                </div>
                <p className="text-lg font-semibold text-gray-800 pl-8">{user?.email}</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-accent-600" />
                  <span className="text-sm text-gray-600 font-medium">ID de Usuario</span>
                </div>
                <p className="text-sm font-mono text-gray-600 pl-8 break-all">{user?.id?.substring(0, 30)}...</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>

            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="mt-3 flex items-center gap-2 px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
            >
              <AlertTriangle className="w-5 h-5" />
              Eliminar cuenta
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
                  <h2 className="text-xl font-bold">Información del Negocio</h2>
                  <p className="text-white/80">Datos de tu empresa</p>
                </div>
              </div>

              {!editingBusiness && (
                <button
                  onClick={() => setEditingBusiness(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all backdrop-blur-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
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
                    <span className="text-sm text-gray-600 font-medium">Nombre del Negocio</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.name}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">NIT</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.nit || 'No registrado'}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">Email</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.email || 'No especificado'}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Phone className="w-5 h-5 text-accent-600" />
                    <span className="text-sm text-gray-600 font-medium">Teléfono</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.phone || 'No especificado'}</p>
                </div>

                {business?.address && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 md:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-accent-600" />
                      <span className="text-sm text-gray-600 font-medium">Dirección</span>
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
                      Nombre del Negocio *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={businessData.name}
                      onChange={handleBusinessChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      placeholder="Mi Negocio S.A.S"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Shield className="w-4 h-4 text-accent-600" />
                      NIT
                      <span className="text-xs font-normal text-gray-400">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      name="nit"
                      value={businessData.nit}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      placeholder="900.123.456-7"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Mail className="w-4 h-4 text-accent-600" />
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={businessData.email}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      placeholder="contacto@negocio.com"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Phone className="w-4 h-4 text-accent-600" />
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={businessData.phone}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      placeholder="+57 300 123 4567"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="w-4 h-4 text-accent-600" />
                      Dirección
                    </label>
                    <textarea
                      name="address"
                      value={businessData.address}
                      onChange={handleBusinessChange}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all resize-none"
                      placeholder="Calle 123 #45-67, Ciudad"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 gradient-primary hover:from-[#f1c691] hover:to-[#edb886] text-black rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Guardar Cambios
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
                    Cancelar
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
                <h2 className="text-xl font-bold">Información del Sistema</h2>
                <p className="text-white/80">Detalles técnicos</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-700 font-medium">Versión</span>
                </div>
                <p className="text-lg font-bold text-blue-800 pl-8">Stocky v1.0.0</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-purple-700 font-medium">Base de Datos</span>
                </div>
                <p className="text-lg font-bold text-purple-800 pl-8">Supabase PostgreSQL</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Estado</span>
                </div>
                <p className="text-lg font-bold text-green-800 pl-8 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Conectado
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                <div className="flex items-center gap-3 mb-2">
                  <Printer className="w-5 h-5 text-amber-700" />
                  <span className="text-sm text-amber-800 font-medium">Impresora térmica</span>
                </div>
                <div className="pl-8">
                  <label className="block text-xs text-amber-700 mb-1">Ancho de papel</label>
                  <select
                    value={printerPaperWidth}
                    onChange={handlePrinterWidthChange}
                    className="w-full max-w-[180px] h-10 px-3 border border-amber-300 rounded-lg bg-white text-amber-900 font-semibold focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                  >
                    <option value={58}>58mm</option>
                    <option value={80}>80mm</option>
                    <option value={104}>104mm</option>
                  </select>
                  <label className="mt-3 inline-flex items-center gap-2 text-sm text-amber-900 font-medium">
                    <input
                      type="checkbox"
                      checked={autoPrintReceipt}
                      onChange={handleAutoPrintReceiptChange}
                      className="h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-300"
                    />
                    Imprimir recibo automáticamente al cerrar venta
                  </label>
                  <div className="mt-4 rounded-xl border border-indigo-100 bg-white/80 p-4">
                    <label className="inline-flex items-center gap-2 text-sm text-indigo-950 font-semibold">
                      <input
                        type="checkbox"
                        checked={printBridgeEnabled}
                        onChange={handlePrintBridgeEnabledChange}
                        className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-300"
                      />
                      Usar Stocky Print Bridge
                    </label>
                    <p className="mt-1 text-xs text-slate-600">
                      Cuando esté activo, Stocky intentará imprimir primero con la impresora configurada en el puente local.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Impresora</label>
                        <input
                          value={configuredPrinterName}
                          onChange={(e) => setConfiguredPrinterNameState(e.target.value)}
                          className="w-full h-10 px-3 border border-indigo-100 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-transparent"
                          placeholder="DigitalPOS"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Endpoint local</label>
                        <input
                          value={printBridgeEndpoint}
                          onChange={(e) => setPrintBridgeEndpointState(e.target.value)}
                          className="w-full h-10 px-3 border border-indigo-100 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-transparent"
                          placeholder="http://127.0.0.1:41780"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Token</label>
                        <input
                          value={printBridgeToken}
                          onChange={(e) => setPrintBridgeTokenState(e.target.value)}
                          className="w-full h-10 px-3 border border-indigo-100 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-transparent"
                          placeholder="Token de emparejamiento"
                          type="password"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handlePrintBridgeSave}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Guardar puente
                    </button>
                  </div>
                </div>
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
                <h2 className="text-xl font-bold">Dispositivos y Notificaciones</h2>
                <p className="text-white/80">Gestiona tus apps y alertas</p>
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
                  <span className="text-sm text-gray-600 font-medium">Descargar App</span>
                </div>
                <p className="text-sm text-gray-600 mb-3 pl-11">
                  Descarga Stocky para Android, Windows o instala la versión web en tu iPhone.
                </p>
                <button
                  onClick={() => window.open('/descargar', '_blank')}
                  className="ml-11 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  Ver descargas
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Tarjeta de Notificaciones */}
              <div className="p-4 bg-gradient-to-br from-sky-50 to-white rounded-xl border border-sky-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-sky-100 rounded-lg">
                    <Bell className="w-5 h-5 text-sky-600" />
                  </div>
                  <span className="text-sm text-gray-600 font-medium">Notificaciones Push</span>
                </div>
                <p className="text-sm text-gray-600 mb-3 pl-11">
                  Activa notificaciones para recibir alertas de ventas, stock bajo y más.
                </p>
                <button
                  onClick={() => window.open('/descargar', '_blank')}
                  className="ml-11 flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  Configurar notificaciones
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sección de Facturación Electrónica */}
        {business && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <InvoicingSection
              businessId={business.id}
              businessName={business.name}
              businessNit={business.nit}
            />
          </motion.div>
        )}

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
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-rose-100 to-red-100 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60">
                      <AlertTriangle className="h-5 w-5 text-rose-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-rose-900">Eliminar cuenta</h3>
                      <p className="text-sm text-rose-800">Esta acción es permanente</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3 text-sm text-rose-900">
                  <p>
                    Al eliminar tu cuenta se revocará tu acceso y los negocios asociados quedarán suspendidos.
                  </p>
                  <p>Si estás seguro, confirma para continuar.</p>
                </div>
                <div className="flex gap-3 p-5 pt-0">
                  <button
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                    onClick={() => setShowDeleteAccountModal(false)}
                    disabled={deletingAccount}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                  >
                    {deletingAccount ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Configuracion;
