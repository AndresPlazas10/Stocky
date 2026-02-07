import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Shield, 
  FileText, 
  Receipt, 
  Building2,
  Users,
  CheckCircle2,
  Zap,
  MessageCircle,
  Settings
} from 'lucide-react';
import { Button } from './ui/button';

const CHANGELOG_VERSION = 'v2.0.0-2026-02-07'; // Versión con División de Cuentas - Lanzamiento 7 de Febrero
const LAUNCH_DATE = new Date('2026-02-07'); // Modal activo desde esta fecha
const MODAL_ENABLED = true; // ✅ Modal habilitado

function ChangelogModal({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const today = new Date();
    
    // Solo mostrar si:
    // 1. El modal está habilitado (MODAL_ENABLED = true)
    // 2. Ya pasó la fecha de lanzamiento (1 de febrero)
    // NO se guarda en localStorage - aparece SIEMPRE hasta que MODAL_ENABLED sea false
    if (MODAL_ENABLED && today >= LAUNCH_DATE) {
      // Mostrar el modal después de 1 segundo
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      
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
    // Solo cierra el modal, NO guarda nada en localStorage
    // El modal volverá a aparecer en la próxima sesión hasta que MODAL_ENABLED sea false
    setIsOpen(false);
    // Notificar al padre si es una apertura manual
    if (onClose) {
      onClose();
    }
  };

  const changes = [
    {
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      title: '💳 Dividir Cuentas en Mesas',
      description: 'Ahora puedes separar pagos de múltiples clientes en una misma mesa.',
      items: [
        'Ingresa directamente los valores para cada cuenta',
        'Asigna productos específicos a diferentes pagadores',
        'Soporta hasta 10 sub-cuentas por mesa',
        'Cálculo automático del total por persona',
        'Métodos de pago independientes para cada cuenta'
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
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
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold">¡Nueva Función Disponible!</h1>
                      <p className="text-white/90 text-sm mt-1">División de Cuentas en Mesas - 7 de Febrero 2026</p>
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
                  Sistema POS completamente renovado: más simple, más rápido, más potente. ✨
                </p>
              </div>
            </div>

            {/* Contenido con scroll */}
            <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-8">
              <div className="grid gap-6">
                {changes.map((change, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 bg-gradient-to-br ${change.color} rounded-xl shadow-lg shrink-0`}>
                        <change.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {change.title}
                        </h3>
                        <p className="text-gray-600 mb-3">
                          {change.description}
                        </p>
                        <ul className="space-y-2">
                          {change.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-700">
                              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                              <span className="text-sm">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mensaje final */}
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h4 className="text-lg font-bold text-blue-900">
                    💳 Cómo Usar la División de Cuentas
                  </h4>
                </div>
                <p className="text-blue-800 mb-4">
                  Cuando estés creando una venta con múltiples clientes en la misma mesa, abre el modal "Dividir cuenta" y asigna cada producto o cantidad a la persona que pagará. ¡Es así de simple!
                </p>
                <div className="flex flex-col gap-2 text-sm text-blue-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ingresa el valor directamente en los campos de cantidad</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cada cuenta puede pagar con diferente método</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>El total se calcula automáticamente por persona</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Todos los cambios se guardan en tiempo real</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botón */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 h-12 text-lg font-semibold rounded-xl shadow-lg"
              >
                <Users className="w-5 h-5 mr-2" />
                ¡A dividir cuentas! 💳
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ChangelogModal;
