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

const CHANGELOG_VERSION = 'v2.1.0-2026-02-28'; // Cambiar esto cuando haya nuevos cambios

function ChangelogModal({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Verificar si ya se mostró esta versión del changelog
    const lastSeenVersion = localStorage.getItem('changelog_last_seen');
    
    if (lastSeenVersion !== CHANGELOG_VERSION) {
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
      icon: FileText,
      color: 'from-amber-500 to-orange-500',
      title: 'Facturacion Electronica DIAN',
      description: 'Ahora puedes solicitar facturacion electronica valida ante la DIAN directamente desde Stocky.',
      items: [
        'Facturas con CUFE y codigo QR',
        'Validacion automatica con la DIAN',
        'Envio de PDF por email al cliente',
        'Integracion con Siigo',
        'Activacion incluida en tu plan mensual'
      ]
    },
    {
      icon: MessageCircle,
      color: 'from-green-500 to-emerald-500',
      title: 'Solicita tu Activacion',
      description: 'El proceso es muy sencillo: contactanos y nosotros nos encargamos de todo.',
      items: [
        'Contacto directo por WhatsApp',
        'Configuracion sin complicaciones',
        'Soporte personalizado',
        'Activacion en maximo 48 horas habiles'
      ]
    },
    {
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      title: 'Datos de tu Negocio',
      description: 'Agregamos el campo NIT opcional para negocios que deseen facturar.',
      items: [
        'NIT opcional en configuracion',
        'Razon social para facturas',
        'Datos fiscales seguros',
        'Funciona igual si no tienes NIT'
      ]
    },
    {
      icon: Receipt,
      color: 'from-purple-500 to-pink-500',
      title: 'Comprobantes Mejorados',
      description: 'Tus ventas siempre generan un comprobante, con o sin facturacion electronica.',
      items: [
        'Comprobantes informativos (sin DIAN)',
        'Facturas electronicas (con DIAN)',
        'Aviso legal automatico',
        'Historial de facturas'
      ]
    },
    {
      icon: Settings,
      color: 'from-gray-600 to-gray-800',
      title: 'Nueva Seccion en Configuracion',
      description: 'Encuentra todo sobre facturacion en la seccion de Configuracion de tu negocio.',
      items: [
        'Estado de facturacion visible',
        'Boton para solicitar activacion',
        'Informacion de resolucion DIAN',
        'Alertas de vencimiento'
      ]
    },
    {
      icon: Zap,
      color: 'from-yellow-500 to-amber-500',
      title: 'Mejoras de Rendimiento',
      description: 'Optimizaciones generales para una experiencia mas fluida.',
      items: [
        'Carga mas rapida',
        'Mejor manejo de errores',
        'Sincronizacion mejorada',
        'Correccion de bugs menores'
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
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold">Novedades en Stocky!</h1>
                      <p className="text-white/90 text-sm mt-1">Version 2.1 - Enero 2026</p>
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
                  Ahora puedes tener facturacion electronica valida ante la DIAN. Contactanos para activarla!
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
              <div className="mt-8 p-6 bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl border-2 border-amber-200">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="w-6 h-6 text-amber-600" />
                  <h4 className="text-lg font-bold text-amber-900">
                    Quieres facturacion electronica?
                  </h4>
                </div>
                <p className="text-amber-800 mb-4">
                  Ve a <strong>Configuracion</strong> y solicita la activacion. Te contactaremos en maximo 48 horas habiles para configurar todo.
                </p>
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Shield className="w-4 h-4" />
                  <span>Incluido en tu plan mensual - Sin costo adicional</span>
                </div>
              </div>
            </div>

            {/* Footer con botón */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 h-12 text-lg font-semibold rounded-xl shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Entendido!
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ChangelogModal;
