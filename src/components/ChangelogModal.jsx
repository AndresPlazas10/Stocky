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

const CHANGELOG_VERSION = 'v2.0.0-2026-02-01'; // Versión Simplicity - Lanzamiento 1 de Febrero
const LAUNCH_DATE = new Date('2026-02-01'); // Modal activo desde esta fecha

function ChangelogModal({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Verificar si ya se mostró esta versión del changelog
    const lastSeenVersion = localStorage.getItem('changelog_last_seen');
    const today = new Date();
    
    // Solo mostrar si:
    // 1. Ya pasó la fecha de lanzamiento
    // 2. No se ha visto esta versión antes
    if (today >= LAUNCH_DATE && lastSeenVersion !== CHANGELOG_VERSION) {
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
    // Guardar que ya vimos esta versión
    localStorage.setItem('changelog_last_seen', CHANGELOG_VERSION);
    setIsOpen(false);
    // Notificar al padre si es una apertura manual
    if (onClose) {
      onClose();
    }
  };

  const changes = [
    {
      icon: Sparkles,
      color: 'from-blue-500 to-cyan-500',
      title: '🎨 Nueva Imagen de Marca',
      description: 'Stocky con un diseño renovado, logo profesional y moderno.',
      items: [
        'Logo optimizado de alta resolución',
        'Icono visible y profesional en todas las pestañas del navegador',
        'Diseño visual refinado y efectos más sutiles',
        'Branding consistente en toda la plataforma'
      ]
    },
    {
      icon: Zap,
      color: 'from-yellow-500 to-amber-500',
      title: '⚡ Sistema 10x Más Rápido',
      description: 'Optimizaciones que hacen tu día a día mucho más ágil.',
      items: [
        'Guardado de ventas 83% más rápido (de 1.8s a 0.3s)',
        'Búsquedas instantáneas - 99.8% más rápidas (de 2.5s a 0.003s)',
        '80% menos consultas gracias al sistema de caché inteligente',
        'Interfaz 97% más fluida - sin congelamientos ni esperas',
        'Actualización en tiempo real sin recargas innecesarias'
      ]
    },
    {
      icon: Settings,
      color: 'from-purple-500 to-pink-500',
      title: '🕐 Formato de 12 Horas',
      description: 'Todas las horas ahora se muestran en formato AM/PM para mayor claridad.',
      items: [
        'Hora más clara y fácil de leer',
        'Formato universal: 2:30 PM, 9:00 AM',
        'Aplicado en toda la plataforma (ventas, tickets, reportes)',
        'Sin confusión entre horarios'
      ]
    },
    {
      icon: CheckCircle2,
      color: 'from-green-500 to-emerald-500',
      title: '✨ Orden Consistente en Mesas',
      description: 'Los productos mantienen su posición sin movimientos inesperados.',
      items: [
        'Productos siempre en el mismo orden',
        'Sin cambios de posición al actualizar',
        'Interfaz más predecible y confiable',
        'Mejor experiencia de usuario'
      ]
    },
    {
      icon: Sparkles,
      color: 'from-purple-500 to-pink-500',
      title: '🎯 Sistema Simplificado',
      description: 'Stocky ahora se enfoca 100% en ser tu mejor aliado POS.',
      items: [
        'Proceso de venta ultra-simplificado: Agregar → Pagar → Listo',
        'Sin pasos adicionales ni campos innecesarios',
        'Comprobantes informativos profesionales y limpios',
        'Interfaz renovada, más ágil y sin distracciones',
        'Integración con Siigo para facturación oficial (incluida en tu plan)'
      ]
    },
    {
      icon: MessageCircle,
      color: 'from-green-500 to-teal-500',
      title: '💬 Recibos con Frase del Día',
      description: 'Cada comprobante incluye una frase motivacional que cambia diariamente.',
      items: [
        '10 frases únicas de inspiración empresarial',
        'Rotación automática cada día del año',
        'Diseño elegante con emojis y formato especial',
        'Experiencia única para tus clientes',
        'Mensajes positivos sobre servicio y excelencia'
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
                      <h1 className="text-3xl font-bold">¡Bienvenido a Stocky 2.0!</h1>
                      <p className="text-white/90 text-sm mt-1">Versión Simplicity - 1 de Febrero 2026</p>
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
                  <Shield className="w-6 h-6 text-blue-600" />
                  <h4 className="text-lg font-bold text-blue-900">
                    💼 ¿Necesitas facturar electrónicamente?
                  </h4>
                </div>
                <p className="text-blue-800 mb-4">
                  Tu plan incluye acceso a <strong>Siigo</strong>, líder en facturación electrónica en Colombia. 
                  Contacta a soporte para activar tu cuenta y empieza a facturar oficialmente desde hoy.
                </p>
                <div className="flex flex-col gap-2 text-sm text-blue-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Plan Siigo incluido sin costo adicional</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guía completa en Configuración → Facturación</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tus ventas se mantienen intactas, nada cambia en tu historial</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botón */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 h-12 text-lg font-semibold rounded-xl shadow-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                ¡Entendido, empecemos! 🚀
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ChangelogModal;
