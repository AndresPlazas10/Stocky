import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Cloud, HardDrive, Rocket, X } from 'lucide-react';
import { Button } from './ui/button';

const ANNOUNCEMENT_VERSION = '2026-02-local-cloud-v1';
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
          className="fixed inset-0 z-[102] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-sky-600 to-cyan-500 text-white p-6 relative">
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/15 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold">Novedades de Stocky</h2>
              <p className="text-white/90 mt-1">
                Te contamos los cambios de rendimiento y la transición local + nube que vamos a implementar.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
                <Rocket className="w-5 h-5 text-sky-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-sky-900">Mejoras de velocidad en progreso</p>
                  <p className="text-sm text-sky-800 mt-1">
                    Estamos optimizando ventas, compras y reportes para que las respuestas sean mucho más rápidas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-50 border border-cyan-200">
                <Cloud className="w-5 h-5 text-cyan-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-cyan-900">Próxima fase: nube + modo local</p>
                  <p className="text-sm text-cyan-800 mt-1">
                    Vamos a preparar una arquitectura híbrida para mejorar continuidad cuando falle internet.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <HardDrive className="w-5 h-5 text-emerald-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900">Sin cambios manuales por ahora</p>
                  <p className="text-sm text-emerald-800 mt-1">
                    Tu operación actual sigue igual. Te avisaremos con tiempo antes de cualquier migración técnica.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Versión del aviso:</span> {ANNOUNCEMENT_VERSION}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full h-11 bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:opacity-90"
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
