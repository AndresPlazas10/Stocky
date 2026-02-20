import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Cloud, HardDrive, Layers, Rocket, X } from 'lucide-react';
import { Button } from './ui/button';

const ANNOUNCEMENT_VERSION = '2026-02-local-cloud-v3';
const _motionLintUsage = motion;

function buildStorageKey(userId, businessId) {
  const uid = String(userId || 'anon').trim();
  const bid = String(businessId || 'no-business').trim();
  return `stocky_platform_update_seen_${ANNOUNCEMENT_VERSION}_${uid}_${bid}`;
}

export default function PlatformUpdateModal({ userId, businessId }) {
  const [isOpen, setIsOpen] = useState(false);
  const storageKey = useMemo(
    () => buildStorageKey(userId, businessId),
    [userId, businessId]
  );

  useEffect(() => {
    if (!businessId) return;
    const alreadySeen = localStorage.getItem(storageKey) === 'true';
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 900);

    return () => clearTimeout(timer);
  }, [businessId, storageKey]);

  const handleClose = () => {
    localStorage.setItem(storageKey, 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[102] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-sky-600 to-cyan-500 text-white p-4 sm:p-6 relative">
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg hover:bg-white/15 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl sm:text-2xl font-bold pr-8">Novedades de Stocky</h2>
              <p className="text-white/90 text-sm sm:text-base mt-1 pr-8">
                Te contamos los cambios de rendimiento y la transición local + nube que vamos a implementar.
              </p>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-indigo-900">Nuevo módulo de combos</p>
                  <p className="text-xs sm:text-sm text-indigo-800 mt-1">
                    Ya habilitamos combos estructurados con control de inventario interno para ventas más rápidas y precisas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-sky-50 border border-sky-200">
                <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-sky-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-sky-900">Mejoras de velocidad en progreso</p>
                  <p className="text-xs sm:text-sm text-sky-800 mt-1">
                    Estamos optimizando ventas, compras y reportes para que las respuestas sean mucho más rápidas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-cyan-50 border border-cyan-200">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-cyan-900">Próxima fase: nube + modo local</p>
                  <p className="text-xs sm:text-sm text-cyan-800 mt-1">
                    Vamos a preparar una arquitectura híbrida para mejorar continuidad cuando falle internet.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-emerald-900">Sin cambios manuales por ahora</p>
                  <p className="text-xs sm:text-sm text-emerald-800 mt-1">
                    Tu operación actual sigue igual. Te avisaremos con tiempo antes de cualquier migración técnica.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-700">
                  <span className="font-semibold">Versión del aviso:</span> {ANNOUNCEMENT_VERSION}
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full h-10 sm:h-11 text-sm sm:text-base bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:opacity-90"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Entendido
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
