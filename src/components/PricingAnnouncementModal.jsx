import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  DollarSign,
  CheckCircle2,
  Sparkles,
  Shield,
  Calendar,
  CreditCard,
  Building2,
  Zap
} from 'lucide-react';
import { Button } from './ui/button';

const PRICING_VERSION = 'v1.0.0-pricing-2026'; // Cambiar esto cuando actualices precios
const PAYMENT_DAY = 25; // Día del mes en que se muestra el recordatorio

function PricingAnnouncementModal({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Verificar si ya se mostró hoy
    const lastShownDate = localStorage.getItem('pricing_modal_last_shown');
    const todayString = today.toDateString();
    
    // Solo mostrar si:
    // 1. Es día 25 del mes
    // 2. No se ha mostrado hoy
    if (dayOfMonth === PAYMENT_DAY && lastShownDate !== todayString) {
      // Mostrar el modal después de 2 segundos (después del changelog)
      const timer = setTimeout(() => {
        setIsOpen(true);
        // Marcar como mostrado hoy
        localStorage.setItem('pricing_modal_last_shown', todayString);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Manejar apertura forzada desde el botón
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    // No guardamos nada al cerrar porque queremos que se vuelva a mostrar el día 25 del próximo mes
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[101] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, type: "spring" }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <DollarSign className="w-8 h-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold">💰 Planes y Precios Stocky</h1>
                      <p className="text-white/90 text-sm mt-1">Información Actualizada - Febrero 2026</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-white/90 text-lg">
                  Todo lo que necesitas saber sobre tu suscripción y beneficios incluidos.
                </p>
              </div>
            </div>

            {/* Contenido con scroll */}
            <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-8">
              
              {/* Plan Principal */}
              <div className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-300">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-6 h-6 text-green-600" />
                      <h2 className="text-2xl font-bold text-green-900">Plan Stocky Completo</h2>
                    </div>
                    <p className="text-green-700">Sistema POS profesional con facturación incluida</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-green-600">$50.000</div>
                    <div className="text-sm text-green-700">COP / mes</div>
                  </div>
                </div>

                {/* Características incluidas */}
                <div className="grid md:grid-cols-2 gap-3 mt-6">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">✨ Sistema POS completo sin límites</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">📊 Gestión de inventario en tiempo real</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">👥 Empleados y permisos ilimitados</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">🛒 Gestión de compras y proveedores</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">📱 Acceso desde cualquier dispositivo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">☁️ Respaldo automático en la nube</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">📈 Reportes y estadísticas detalladas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">🆘 Soporte técnico prioritario</span>
                  </div>
                </div>

                {/* Beneficio especial */}
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-xl border-2 border-blue-300">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-6 h-6 text-blue-600" />
                    <h3 className="font-bold text-blue-900">🎁 Beneficio Exclusivo Incluido</h3>
                  </div>
                  <p className="text-blue-800 text-sm leading-relaxed">
                    <strong>Acceso a Siigo</strong> - Software líder de facturación electrónica en Colombia. 
                    Factura oficialmente con validez ante la DIAN sin costos adicionales.
                  </p>
                </div>
              </div>

              {/* Información de pago */}
              <div className="mb-6 bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-6 h-6 text-gray-700" />
                  <h3 className="text-xl font-bold text-gray-900">💳 Información de Pago</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Nu (Bre-B)</div>
                      <div className="text-2xl font-bold text-gray-800 font-mono">@APM331</div>
                      <div className="text-sm text-gray-600">Titular: Andres Felipe</div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-yellow-900 mb-1">⚠️ Importante al Transferir</div>
                        <p className="text-sm text-yellow-800 leading-relaxed">
                          Enviar por <strong>Bre-B</strong> a la llave <strong>@APM331</strong> y escribir <strong>el nombre de tu negocio</strong> en la descripción para 
                          que podamos identificar y activar tu cuenta automáticamente.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800 leading-relaxed">
                        <strong>Activación instantánea:</strong> Una vez confirmemos tu pago, 
                        tu cuenta quedará activa para el próximo período de facturación.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fechas importantes */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-purple-900">📅 Fechas de Facturación</h3>
                </div>
                <div className="space-y-2 text-sm text-purple-800">
                  <p>
                    <strong>• Período de facturación:</strong> Mensual (cada 30 días)
                  </p>
                  <p>
                    <strong>• Forma de pago:</strong> Transferencia Bre-B (Nu)
                  </p>
                  <p>
                    <strong>• Recordatorio:</strong> Recibirás una notificación cada mes
                  </p>
                </div>
              </div>

              {/* Advertencia de deshabilitación */}
              <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-5 border-2 border-red-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg shrink-0">
                    <Building2 className="w-5 h-5 text-red-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-900 mb-2">⚠️ Importante - Plazo de Pago</h3>
                    <p className="text-sm text-red-800 leading-relaxed">
                      Si no se realiza el pago en los próximos <strong>5 días</strong>, el soporte de Stocky 
                      podría deshabilitar el sistema para su negocio temporalmente hasta que se regularice la situación.
                    </p>
                    <p className="text-xs text-red-700 mt-2 leading-relaxed">
                      💡 <strong>Consejo:</strong> Realiza tu pago hoy para asegurar el servicio ininterrumpido de tu negocio.
                    </p>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-bold text-gray-900 mb-3">❓ Preguntas Frecuentes</h3>
                
                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                  <summary className="font-semibold text-gray-900">¿Qué pasa si no pago a tiempo?</summary>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Recibirás recordatorios amigables. Si no regularizas después de varios días, 
                    el sistema podría ser temporalmente deshabilitado hasta que se confirme el pago.
                  </p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                  <summary className="font-semibold text-gray-900">¿Cómo activo mi cuenta de Siigo?</summary>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Contacta a nuestro soporte técnico una vez realices tu pago mensual. 
                    Te proporcionaremos las credenciales y guía completa para usar Siigo.
                  </p>
                </details>

                <details className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                  <summary className="font-semibold text-gray-900">¿Puedo cancelar mi suscripción?</summary>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Sí, puedes cancelar cuando quieras. Tus datos estarán disponibles por 30 días 
                    después de la cancelación por si decides regresar.
                  </p>
                </details>
              </div>

            </div>

            {/* Footer con botón */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 h-12 text-lg font-semibold rounded-xl shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                ¡Entendido! 💚
              </Button>
              <p className="text-xs text-center text-gray-500 mt-3">
                Para cualquier duda, contáctanos en soporte@stockypos.app
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PricingAnnouncementModal;
