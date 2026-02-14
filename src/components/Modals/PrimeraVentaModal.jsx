import { motion } from 'framer-motion';
// ============================================
// 🎉 Modal Educativo - Primera Venta
// ============================================
// Ubicación: src/components/Modals/PrimeraVentaModal.jsx
// 
// Se muestra una sola vez cuando el usuario registra su primera venta
// Explica cómo funciona la facturación electrónica y las obligaciones fiscales

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  FileText, 
  AlertTriangle, 
  Shield,
  ExternalLink,
  X,
  Info
} from 'lucide-react';

export default function PrimeraVentaModal({ isOpen, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    // Guardar preferencia en localStorage
    if (dontShowAgain) {
      localStorage.setItem('stockly_hide_first_sale_modal', 'true');
    }
    onClose();
  };

  // Verificar si ya fue mostrado antes
  useEffect(() => {
    const hideModal = localStorage.getItem('stockly_hide_first_sale_modal');
    if (hideModal === 'true' && isOpen) {
      onClose(); // Cerrar inmediatamente si el usuario lo pidió
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">¡Primera venta registrada!</h2>
                      <p className="text-green-100 text-sm">Bienvenido a Stocky</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-5">
              {/* Advertencia principal */}
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-900 mb-2">
                      ⚠️ IMPORTANTE - Cumplimiento Fiscal
                    </h3>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      El comprobante que acabas de generar <strong>NO es válido ante DIAN</strong>. 
                      Es únicamente un documento interno para ti y tu cliente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pasos para facturar */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-blue-900">
                    Para facturación electrónica oficial:
                  </h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      1
                    </div>
                    <p className="text-sm text-blue-900 pt-0.5">
                      Accede a tu cuenta de <strong>Siigo</strong> (incluida en tu plan)
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      2
                    </div>
                    <p className="text-sm text-blue-900 pt-0.5">
                      Crea la factura electrónica con los datos de la venta
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      3
                    </div>
                    <p className="text-sm text-blue-900 pt-0.5">
                      Siigo enviará automáticamente la factura a la DIAN
                    </p>
                  </div>
                </div>

                <a
                  href="https://app.siigo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Ir a Siigo
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Por qué este modelo */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-gray-600" />
                  <h3 className="font-bold text-gray-900">
                    ¿Por qué funciona así?
                  </h3>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Reduces costos:</strong> Sin tarifas por transacción</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Control total:</strong> Tú manejas tu facturación directamente</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Menos riesgos:</strong> Cumples con DIAN sin intermediarios</span>
                  </p>
                </div>
              </div>

              {/* Checkbox no mostrar de nuevo */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-800">
                    Entiendo, no mostrar este mensaje de nuevo
                  </span>
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Cerrar
                </button>
                <a
                  href="https://app.siigo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Ir a Facturar en Siigo
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
