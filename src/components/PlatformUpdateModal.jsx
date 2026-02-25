import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Gauge,
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

const ANNOUNCEMENT_VERSION = '2026-02-local-first-online-v4';

function buildStorageKey(userId, businessId) {
  const uid = String(userId || 'anon').trim();
  const bid = String(businessId || 'no-business').trim();
  return `stocky_platform_update_seen_${ANNOUNCEMENT_VERSION}_${uid}_${bid}`;
}

const HIGHLIGHTS = [
  {
    icon: Wifi,
    title: 'Estado de conexion visible',
    description: 'Ahora puedes ver claramente cuando estas en linea y cuando estas sin internet.',
    className: 'from-sky-50 to-cyan-50 border-sky-200 text-sky-900'
  },
  {
    icon: Zap,
    title: 'UX mas rapida en modulos clave',
    description: 'Mejoramos velocidad y respuesta en Ventas, Compras, Mesas e Inventario.',
    className: 'from-amber-50 to-orange-50 border-amber-200 text-amber-900'
  },
  {
    icon: CloudUpload,
    title: 'Modo offline real con sincronizacion automatica',
    description: 'Si se cae internet, puedes seguir operando. Al volver la conexion, se sube automaticamente a la nube.',
    className: 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900'
  },
  {
    icon: ShieldCheck,
    title: 'Flujo local-first para mayor continuidad',
    description: 'Las operaciones se guardan primero en local para que la experiencia sea casi instantanea.',
    className: 'from-indigo-50 to-blue-50 border-indigo-200 text-indigo-900'
  }
];

export default function PlatformUpdateModal({ userId, businessId }) {
  const [isOpen, setIsOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const storageKey = useMemo(() => buildStorageKey(userId, businessId), [userId, businessId]);

  useEffect(() => {
    if (!businessId) return;
    const alreadySeen = localStorage.getItem(storageKey) === 'true';
    if (alreadySeen) return;

    const timer = setTimeout(() => setIsOpen(true), 900);
    return () => clearTimeout(timer);
  }, [businessId, storageKey]);

  const handleClose = () => {
    localStorage.setItem(storageKey, 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-[102] bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={handleClose}
        >
          <Motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28 }}
            className="w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0f766e] via-[#0ea5a3] to-[#0284c7] text-white p-5 sm:p-7">
              <div className="absolute -top-16 -right-10 w-52 h-52 rounded-full bg-white/15" />
              <div className="absolute -bottom-20 -left-14 w-60 h-60 rounded-full bg-black/10" />

              <button
                type="button"
                onClick={handleClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg hover:bg-white/15 transition-colors"
                aria-label="Cerrar novedades"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative z-10 pr-10">
                <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-white/85">NOVEDADES STOCKY</p>
                <h2 className="text-2xl sm:text-3xl font-black mt-1">Tu app ahora es mas rapida y resistente</h2>
                <p className="text-white/90 text-sm sm:text-base mt-2">
                  Ya activamos mejoras clave para que trabajes mejor con y sin internet.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/50 to-white">
              <div
                className={[
                  'rounded-2xl border px-4 py-3 flex items-center gap-3',
                  isOnline
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                ].join(' ')}
              >
                {isOnline ? <Wifi className="w-5 h-5 shrink-0" /> : <WifiOff className="w-5 h-5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">
                    Conexion actual: {isOnline ? 'En linea' : 'Sin internet'}
                  </p>
                  <p className="text-xs opacity-90">
                    {isOnline
                      ? 'Todo lo pendiente se sincroniza automaticamente con la nube.'
                      : 'Puedes seguir operando. Tus cambios quedaran guardados localmente.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HIGHLIGHTS.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + (index * 0.06), duration: 0.24 }}
                      className={`rounded-2xl border bg-gradient-to-br ${item.className} p-4`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-white/75 border border-white/80 shadow-sm">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-bold">{item.title}</p>
                          <p className="text-xs sm:text-sm mt-1 opacity-90 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    </Motion.div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900 mb-2">
                  <Gauge className="w-4 h-4" />
                  <p className="font-semibold text-sm sm:text-base">Que cambia para tu equipo</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    Guardado casi instantaneo en pantalla.
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    Menor impacto si hay cortes de red.
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    Sincronizacion automatica al recuperar internet.
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold">Version de novedades:</span> {ANNOUNCEMENT_VERSION}
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-[#0f766e] to-[#0284c7] text-white hover:opacity-95"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Entendido, continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
