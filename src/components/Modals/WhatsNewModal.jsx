import { useEffect, useMemo, useState } from 'react';
import { Apple, ShieldCheck, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import logoStocky from '../../assets/logoStocky.png';
import imagenFondo from '../../assets/imagenFondo.jpeg';
import logoViejo from '../../assets/logoViejo.png';
import nuevoLogo from '../../assets/nuevoLogo.png';
import { getApkDownloadUrl } from '../../utils/apkDownload.js';

const _motionLintUsage = motion;

export default function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const totalSteps = 3;
  const storageKey = 'stocky_whatsnew_dismissed_v1';
  const isEnabled = String(import.meta.env?.VITE_WHATS_NEW_ENABLED || '')
    .trim()
    .toLowerCase() === 'true';
  const downloadUrl = useMemo(() => getApkDownloadUrl(), []);

  useEffect(() => {
    if (!isEnabled) return;
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(storageKey) === '1';
    if (!dismissed) {
      setIsOpen(true);
      setStep(0);
    }
  }, [isEnabled]);

  const closeModal = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, '1');
    }
  };

  const handleDownload = () => {
    if (typeof window === 'undefined') return;
    if (downloadUrl.startsWith('/')) {
      window.location.href = downloadUrl;
    } else {
      window.open(downloadUrl, '_blank', 'noopener');
    }
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, '1');
    }
  };

  const goNext = () => {
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const goPrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const StepDots = () => (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <span
          key={`dot-${index}`}
          className={`h-2.5 w-2.5 rounded-full border border-white/30 transition ${
            index === step ? 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]' : 'bg-white/20'
          }`}
        />
      ))}
    </div>
  );

  if (!isEnabled) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur"
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 18 }}
            transition={{ type: 'spring', duration: 0.35 }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/20 bg-gradient-to-br from-slate-900 via-[#1a2a4a] to-[#0a4e61] shadow-[0_35px_90px_rgba(5,10,26,0.65),inset_0_1px_0_rgba(255,255,255,0.18)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.55),transparent_42%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.4),transparent_38%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.3),transparent_42%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_40%)]" />
            <div className="pointer-events-none absolute inset-[2px] rounded-[34px] border border-white/10" />

            <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
              <div className="relative flex items-center gap-2 rounded-b-[20px] border border-white/20 bg-white/10 px-6 py-2 backdrop-blur-sm shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 shadow-md">
                  <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" />
                </div>
                <span className="text-sm font-semibold text-white">Stocky</span>
              </div>
            </div>

            <button
              onClick={closeModal}
              className="absolute right-5 top-5 z-20 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20"
            >
              Cerrar
            </button>

            <div className="relative z-10 grid gap-6 p-5 sm:p-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:p-10">
              {step === 0 && (
                <>
                  <div className="space-y-5 text-white">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                      Novedades
                    </div>

                    <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl md:text-4xl">
                        ¡La experiencia nativa de Stocky llega a Android!
                      </h2>
                  <p className="mt-3 text-sm text-white/80 sm:text-base">
                        Más velocidad, notificaciones instantáneas y una interfaz optimizada para tu equipo.
                        Descárgala aquí y lleva Stocky al siguiente nivel.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs text-white/80 sm:text-sm">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>Nuevo logo oficial y mejoras de rendimiento en toda la plataforma.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>Notificaciones activas en la app nativa para estar siempre al tanto.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>Próxima actualización: app nativa para iOS.</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Button
                        onClick={handleDownload}
                        className="relative h-11 sm:h-12 w-full sm:w-auto overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 text-sm sm:text-base font-semibold text-emerald-950 shadow-[0_16px_35px_rgba(16,185,129,0.45)] hover:opacity-95"
                      >
                        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),transparent_55%)]" />
                        <span className="relative z-10">Descargar para Android</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={goNext}
                        className="h-11 sm:h-12 w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        Siguiente
                      </Button>
                    </div>

                    <div className="pt-2">
                      <StepDots />
                    </div>
                  </div>

                  <div className="relative hidden items-center justify-center md:flex">
                    <div className="absolute -inset-8 rounded-[40px] bg-emerald-400/20 blur-3xl md:-inset-10" />
                    <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[32px] border border-white/25 bg-slate-900/20 shadow-[0_25px_60px_rgba(6,12,30,0.55)] md:rotate-2 md:translate-x-4">
                      <img
                        src={imagenFondo}
                        alt="Stocky móvil"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-white/10" />
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="space-y-5 text-white">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                      Nueva identidad
                    </div>

                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl md:text-4xl">
                        ¡Una evolución visual: el nuevo rostro de Stocky!
                      </h2>
                      <p className="mt-3 text-sm text-white/80 sm:text-base">
                        Nuestra marca creció con ustedes. El nuevo logotipo es más moderno, limpio y listo para el futuro.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs text-white/80 sm:text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Evolución del logotipo</p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center">
                          <p className="text-xs font-semibold text-white/70">Anterior</p>
                          <div className="mt-3 flex items-center justify-center rounded-2xl bg-white/10 p-4">
                            <img src={logoViejo} alt="Logo anterior" className="h-16 w-16 object-contain" />
                          </div>
                        </div>
                        <div className="hidden text-3xl font-black text-white/60 sm:block">›</div>
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center">
                          <p className="text-xs font-semibold text-white/70">Actual</p>
                          <div className="mt-3 flex items-center justify-center rounded-2xl bg-white/10 p-4">
                            <img src={nuevoLogo} alt="Logo actual" className="h-16 w-16 object-contain" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={goPrev}
                        className="h-11 w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        Anterior
                      </Button>
                      <Button
                        onClick={goNext}
                        className="h-11 w-full sm:w-auto bg-white text-slate-900 hover:bg-white/90"
                      >
                        Siguiente
                      </Button>
                    </div>

                    <div className="pt-2">
                      <StepDots />
                    </div>
                  </div>

                  <div className="relative hidden items-center justify-center md:flex">
                    <div className="absolute -inset-8 rounded-[40px] bg-violet-400/20 blur-3xl md:-inset-10" />
                    <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[32px] border border-white/25 bg-slate-900/20 shadow-[0_25px_60px_rgba(6,12,30,0.55)] md:rotate-2 md:translate-x-4">
                      <img
                        src={imagenFondo}
                        alt="Stocky móvil"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-white/10" />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-5 text-white">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      <Apple className="h-4 w-4 text-emerald-300" />
                      Próximamente
                    </div>

                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl md:text-4xl">
                        La app nativa para iOS está en camino
                      </h2>
                      <p className="mt-3 text-sm text-white/80 sm:text-base">
                        Estamos preparando una experiencia nativa para iPhone con el mismo rendimiento y notificaciones instantáneas.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs text-white/80 sm:text-sm">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>Acceso rápido a ventas, inventario y mesas desde iOS.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>Sincronización instantánea con tu cuenta actual.</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={goPrev}
                        className="h-11 w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        Anterior
                      </Button>
                      <Button
                        onClick={closeModal}
                        className="h-11 w-full sm:w-auto bg-emerald-300 text-slate-900 hover:bg-emerald-200"
                      >
                        Entendido
                      </Button>
                    </div>

                    <div className="pt-2">
                      <StepDots />
                    </div>
                  </div>

                  <div className="relative hidden items-center justify-center md:flex">
                    <div className="absolute -inset-8 rounded-[40px] bg-emerald-400/20 blur-3xl md:-inset-10" />
                    <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[32px] border border-white/25 bg-slate-900/20 shadow-[0_25px_60px_rgba(6,12,30,0.55)] md:rotate-2 md:translate-x-4">
                      <img
                        src={imagenFondo}
                        alt="Stocky móvil"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-white/10" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
