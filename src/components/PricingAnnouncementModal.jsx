import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { 
  X, 
  DollarSign,
  CheckCircle2,
  Sparkles,
  Calendar,
  CreditCard
} from 'lucide-react';
import { Button } from './ui/button';
import paymentQr from '../assets/QR.jpeg';

const _motionLintUsage = motion;

const PRICING_VERSION = 'v1.0.0-pricing-2026'; // Cambiar esto cuando actualices precios
const START_DAY = 1; // Día del mes desde el que se muestra el recordatorio (incluido)
const END_DAY = 5; // Día del mes hasta el que se muestra el recordatorio (incluido)
const LAUNCH_DATE = new Date('2026-02-01'); // Empezar a mostrar desde el 1 de febrero

function PricingAnnouncementModal({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Verificar si ya se mostró hoy
    const lastShownDate = localStorage.getItem('pricing_modal_last_shown');
    const todayString = today.toDateString();
    
    // Solo mostrar si:
    // 1. Ya pasó la fecha de lanzamiento
    // 2. Es entre el día 1 y el día 5 del mes (ambos incluidos)
    // 3. No se ha mostrado hoy
    if (today >= LAUNCH_DATE && dayOfMonth >= START_DAY && dayOfMonth <= END_DAY && lastShownDate !== todayString) {
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[101] flex items-center justify-center p-2 sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, type: "spring" }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-5 md:p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <DollarSign className="w-7 h-7" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold">💰 Planes y Precios Stocky</h1>
                      <p className="text-white/90 text-sm mt-1">Información Actualizada - Enero 2026</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-white/90 text-sm md:text-base">
                  Resumen rápido de tu plan, pago por QR y fechas de facturación.
                </p>
              </div>
            </div>

            {/* Contenido compacto sin scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6 space-y-4">
              <div className="grid lg:grid-cols-[1.15fr_1fr] gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border-2 border-green-300">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-5 h-5 text-green-600" />
                        <h2 className="text-xl font-bold text-green-900">Plan Stocky Completo</h2>
                      </div>
                      <p className="text-green-700 text-sm">Sistema POS profesional con facturación incluida</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-bold text-green-600">$50.000</div>
                      <div className="text-xs text-green-700">COP / mes</div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700">POS completo sin límites</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700">Inventario y reportes en tiempo real</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700">Empleados y compras ilimitadas</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700">Acceso a Siigo incluido</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-gray-700" />
                    <h3 className="text-lg font-bold text-gray-900">Pago por QR</h3>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-700 font-medium text-center mb-2">
                      QR oficial de pago de Stocky
                    </p>
                    <img
                      src={paymentQr}
                      alt="QR de pago de Stocky"
                      className="w-full max-w-[180px] mx-auto rounded-md border border-gray-200"
                      loading="lazy"
                    />
                  </div>

                  <p className="text-xs text-yellow-900 bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-3 leading-snug">
                    <strong>Importante:</strong> Realiza el pago con este QR y envía el comprobante por WhatsApp con el nombre de tu negocio.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-bold text-purple-900">Fechas de Facturación</h3>
                  </div>
                  <div className="space-y-1.5 text-sm text-purple-800">
                    <p><strong>• Frecuencia:</strong> Mensual (cada 30 días)</p>
                    <p><strong>• Medio:</strong> Pago por QR</p>
                    <p><strong>• Aviso:</strong> Recordatorio del día 1 al 5</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-4 border-2 border-red-300">
                  <h3 className="text-lg font-bold text-red-900 mb-2">⚠️ Plazo de Pago</h3>
                  <p className="text-sm text-red-800 leading-relaxed">
                    Si no se registra el pago en los próximos <strong>5 días</strong>, el sistema puede suspenderse temporalmente hasta regularizar.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer con botón principal */}
            <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 h-11 text-base font-semibold rounded-xl shadow-lg"
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
