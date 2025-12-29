import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Shield, 
  Printer, 
  Receipt, 
  Package,
  Users,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { Button } from './ui/button';

const CHANGELOG_VERSION = 'v2.0.0-2025-12-28'; // Cambiar esto cuando haya nuevos cambios

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
      icon: Sparkles,
      color: 'from-purple-500 to-pink-500',
      title: 'Nueva Experiencia con Modales',
      description: 'Ahora puedes crear y editar productos en modales elegantes que facilitan tu trabajo sin distracciones.',
      items: [
        'Modal para crear productos',
        'Modal para editar productos',
        'Modal para nueva venta'
      ]
    },
    {
      icon: Shield,
      color: 'from-blue-500 to-cyan-500',
      title: 'Control de Permisos para Empleados',
      description: 'Mayor seguridad con restricciones específicas para empleados.',
      items: [
        'Empleados no pueden editar productos',
        'Empleados no pueden eliminar ventas',
        'Empleados no pueden eliminar mesas',
        'Solo administradores pueden cerrar órdenes'
      ]
    },
    {
      icon: Printer,
      color: 'from-green-500 to-emerald-500',
      title: 'Sistema de Impresión Profesional',
      description: 'Imprime órdenes de cocina y facturas físicas con formato optimizado para impresoras térmicas.',
      items: [
        'Impresión de órdenes para cocina (solo platos)',
        'Facturas físicas para clientes',
        'Compatible con impresoras térmicas de 80mm',
        'Formato limpio y profesional'
      ]
    },
    {
      icon: Receipt,
      color: 'from-orange-500 to-red-500',
      title: 'Dos Tipos de Factura',
      description: 'Ahora puedes elegir entre factura electrónica por email o factura física impresa.',
      items: [
        'Factura Electrónica (envío por email)',
        'Factura Física (impresión directa)',
        'Ambas con información completa de la venta'
      ]
    },
    {
      icon: Package,
      color: 'from-yellow-500 to-orange-500',
      title: 'Nueva Categoría "Platos"',
      description: 'Categoría especial para productos que requieren preparación en cocina.',
      items: [
        'Diferencia entre bebidas y comida',
        'Solo "Platos" se imprimen para cocina',
        'Optimización del flujo de trabajo'
      ]
    },
    {
      icon: Layers,
      color: 'from-indigo-500 to-purple-500',
      title: 'Mejoras de Interfaz',
      description: 'Múltiples mejoras en la experiencia de usuario y rendimiento.',
      items: [
        'Navegación más fluida',
        'Mensajes de confirmación claros',
        'Corrección de bugs menores',
        'Mejor rendimiento general'
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
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold">¡Novedades en Stocky!</h1>
                      <p className="text-white/90 text-sm mt-1">Versión 2.0 - Diciembre 2025</p>
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
                  Hemos mejorado tu experiencia con nuevas funcionalidades diseñadas para optimizar tu trabajo diario.
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
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-6 h-6 text-purple-600" />
                  <h4 className="text-lg font-bold text-purple-900">
                    ¡Gracias por usar Stocky!
                  </h4>
                </div>
                <p className="text-purple-800">
                  Seguimos trabajando para brindarte la mejor experiencia. Si tienes alguna sugerencia o encuentras algún problema, no dudes en contactarnos.
                </p>
              </div>
            </div>

            {/* Footer con botón */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <Button
                onClick={handleClose}
                className="w-full gradient-primary text-white hover:opacity-90 h-12 text-lg font-semibold rounded-xl shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                ¡Entendido! Comenzar a usar las novedades
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ChangelogModal;
