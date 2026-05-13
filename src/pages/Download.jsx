import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Download, ShieldCheck, Smartphone, Monitor, BellRing, Share, PlusSquare, AppWindow, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApkDownloadUrl } from '../utils/apkDownload.js';
import { getWindowsDownloadUrl } from '../utils/windowsDownload.js';
import {
  getWebPushSupportStatus,
  registerPwaPushSubscription,
  sendPwaPushTestNotification,
} from '../services/pwaPushNotificationsService.js';
import { isIOs, isStandalone } from '../utils/deviceDetection.js';

const _motionLintUsage = motion;

// ── Animation variants (creados una sola vez) ──
const fadeInUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
const fadeInUpMore = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };
const fadeInUpCard = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
const scaleIn = { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } };
const collapseAnim = { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 } };
const slideInLeft = { initial: { opacity: 0, x: -12 }, animate: { opacity: 1, x: 0 } };

const heroTransition = { duration: 0.3 };
const heroTransitionH1 = { duration: 0.35, delay: 0.05 };
const heroTransitionP = { duration: 0.35, delay: 0.1 };
const sectionTransition = { duration: 0.35 };
const collapseTransition = { duration: 0.3 };
const viewportOnce = { once: true, amount: 0.3 };
const viewportOnceSm = { once: true, amount: 0.2 };

// ── Datos estáticos (fuera del componente, no se recrean) ──
const iosSteps = [
  { num: 1, title: 'Abre en Safari', desc: 'Usa Safari, no Chrome ni otros navegadores.' },
  { num: 2, title: 'Toca el botón Compartir', desc: 'Busca el ícono de compartir en la barra inferior.', icon: Share },
  { num: 3, title: 'Selecciona "Añadir a pantalla de inicio"', desc: 'Desplázate y elige esta opción.', icon: PlusSquare },
  { num: 4, title: 'Toca "Añadir"', desc: 'Stocky aparecerá en tu pantalla de inicio como una app.' },
];

const quickStepsData = [
  { step: '1', title: 'Descarga', desc: 'Elige Android, Windows o iPhone y descarga la app.' },
  { step: '2', title: 'Instala', desc: 'Sigue los pasos según tu dispositivo.' },
  { step: '3', title: 'Listo', desc: 'Abre Stocky, inicia sesión y empieza a vender.' },
];

// ── CSS keyframes inyectado una sola vez ──
const KEYFRAMES_CSS = `
@keyframes drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -40px) scale(1.08); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@media (max-width: 639px) {
  .orb-blur-mobile {
    filter: blur(40px) !important;
  }
}
`;

let styleInjected = false;
function injectKeyframes() {
  if (styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = KEYFRAMES_CSS;
  document.head.appendChild(el);
  styleInjected = true;
}

function DownloadPage() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const apkUrl = getApkDownloadUrl();
  const windowsUrl = getWindowsDownloadUrl();
  const apkVersion = String(import.meta.env?.VITE_APK_VERSION || '').trim();
  const windowsVersion = String(import.meta.env?.VITE_WINDOWS_VERSION || '').trim();

  const [enablingPush, setEnablingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState('');
  const [showIOsSteps, setShowIOsSteps] = useState(false);
  const [support, setSupport] = useState({ supported: false, reason: 'loading', permission: 'default' });

  const userIsOnIOs = useMemo(() => isIOs(), []);
  const userInStandalone = useMemo(() => isStandalone(), []);

  // ── Inyectar keyframes una sola vez ──
  useEffect(() => { injectKeyframes(); }, []);

  // ── Cleanup en desmontaje ──
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Web Push support status con protección de unmount ──
  useEffect(() => {
    let cancelled = false;
    getWebPushSupportStatus().then((res) => {
      if (!cancelled) setSupport(res);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Handlers memoizados ──
  const handleEnableNotifications = useCallback(async () => {
    setEnablingPush(true);
    setPushFeedback('');
    try {
      const result = await registerPwaPushSubscription({ askPermission: true });
      if (!mountedRef.current) return;
      if (result.ok) {
        setPushFeedback('✅ Notificaciones activadas correctamente.');
        return;
      }
      if (result.reason === 'missing_access_token') {
        setPushFeedback('⚠️ Inicia sesión primero para vincular notificaciones a tu cuenta.');
        return;
      }
      if (result.reason === 'missing_vapid_public_key') {
        setPushFeedback('❌ Error de configuración: VAPID key no configurada. Contacta soporte.');
        return;
      }
      setPushFeedback(`❌ Error: ${result.message || result.reason || 'Desconocido'}`);
    } catch (err) {
      if (mountedRef.current) setPushFeedback(`❌ Error inesperado: ${err?.message || String(err)}`);
    } finally {
      if (mountedRef.current) setEnablingPush(false);
    }
  }, []);

  const handleSendTest = useCallback(async () => {
    setTestingPush(true);
    setPushFeedback('');
    try {
      const result = await sendPwaPushTestNotification();
      if (!mountedRef.current) return;
      if (result.ok) {
        const sent = Number(result?.data?.sent || 0);
        if (sent > 0) {
          setPushFeedback('Notificación de prueba enviada. Revisa tu iPhone.');
        } else {
          setPushFeedback('No hay suscripción activa. Activa notificaciones primero.');
        }
        return;
      }
      setPushFeedback(result.message || 'No se pudo enviar la notificación de prueba.');
    } catch {
      if (mountedRef.current) setPushFeedback('Error de red enviando notificación de prueba.');
    } finally {
      if (mountedRef.current) setTestingPush(false);
    }
  }, []);

  // ── Downloads memoizados (solo se recrean si cambian versiones) ──
  const downloads = useMemo(() => [
    {
      icon: Smartphone,
      title: 'Android',
      subtitle: apkVersion ? `v${apkVersion}` : 'Última versión',
      description: 'Compatible con Android 7.0 o superior.',
      href: apkUrl,
      label: 'Descargar',
    },
    {
      icon: Monitor,
      title: 'Windows',
      subtitle: windowsVersion ? `v${windowsVersion}` : 'Última versión',
      description: 'Instalador para Windows 10 y 11.',
      href: windowsUrl,
      label: 'Descargar',
      note: 'SmartScreen puede mostrar un aviso. Usa "Más información" → "Ejecutar de todas formas".',
    },
    {
      icon: Printer,
      title: 'Print Bridge',
      subtitle: 'APK',
      description: 'Conecta impresoras térmicas Bluetooth. Compatible con papel 58mm y 80mm.',
      href: '/apk/stocky-print-bridge.apk',
      download: 'stocky-print-bridge.apk',
      label: 'Descargar',
      note: 'Después de instalar actívalo en Ajustes → Impresión → Stocky print.',
    },
  ], [apkVersion, windowsVersion, apkUrl, windowsUrl]);

  // ── Toggle iOS steps con callback estable ──
  const toggleIOsSteps = useCallback(() => setShowIOsSteps((v) => !v), []);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-neutral-900 antialiased relative overflow-hidden">

      {/* Fondo animado — blur reducido en móvil vía clase orb-blur-mobile */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-amber-100/40 blur-3xl orb-blur-mobile animate-[drift_14s_ease-in-out_infinite]" style={{ willChange: 'transform' }} />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-stone-200/30 blur-3xl orb-blur-mobile animate-[drift_18s_ease-in-out_infinite_3s]" style={{ willChange: 'transform' }} />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-amber-50/50 blur-3xl orb-blur-mobile animate-[drift_20s_ease-in-out_infinite_6s]" style={{ willChange: 'transform' }} />
        <div className="absolute top-1/2 left-1/3 h-[16rem] w-[16rem] rounded-full bg-neutral-200/20 blur-3xl orb-blur-mobile animate-[drift_16s_ease-in-out_infinite_9s]" style={{ willChange: 'transform' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-[#fafaf9]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="px-4 pb-8 pt-10 sm:px-6 sm:pb-14 sm:pt-20 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
            <motion.div {...fadeInUp} transition={heroTransition} className="inline-flex items-center gap-2 rounded-full border border-neutral-200/70 bg-neutral-100/70 px-3 py-1 text-xs font-semibold tracking-wide text-neutral-700">
              <Download className="h-3 w-3" />
              Descargas oficiales
            </motion.div>

            <motion.h1 {...fadeInUpMore} transition={heroTransitionH1} className="mt-6 max-w-3xl text-2xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
              Lleva Stocky a todos tus dispositivos
            </motion.h1>

            <motion.p {...fadeInUpMore} transition={heroTransitionP} className="mt-3 max-w-xl text-sm text-neutral-500 sm:text-lg">
              Android, Windows y iPhone. Elige tu plataforma y empieza en minutos.
            </motion.p>
          </div>
        </section>

        {/* Download Cards */}
        <section className="px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {downloads.map((item, index) => (
                <motion.article
                  key={item.title}
                  {...fadeInUpCard}
                  transition={{ duration: 0.35, delay: 0.1 + index * 0.08 }}
                  className="group relative flex flex-col rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-sm transition-shadow sm:hover:shadow-md sm:p-7"
                >
                  <div
                    className="mb-4 sm:mb-5 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition-colors sm:group-hover:bg-neutral-200 sm:group-hover:text-neutral-900"
                    style={{ animation: `bob ${index === 1 ? 3 : 3.5}s ease-in-out infinite`, animationDelay: `${index * 0.5}s`, willChange: 'transform' }}
                  >
                    <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>

                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-base font-bold text-neutral-900 sm:text-lg">{item.title}</h3>
                    <p className="text-xs text-neutral-400">{item.subtitle}</p>
                  </div>

                  <p className="mb-3 sm:mb-4 flex-1 text-sm leading-relaxed text-neutral-500">{item.description}</p>

                  {item.note && (
                    <p className="mb-3 sm:mb-4 text-xs leading-relaxed text-neutral-400">{item.note}</p>
                  )}

                  {item.download ? (
                    <a
                      href={item.href}
                      download={item.download}
                      className="inline-flex h-10 sm:h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition-all touch-manipulation sm:hover:bg-neutral-800 active:scale-[0.98] no-underline"
                    >
                      <Download className="h-4 w-4" />
                      {item.label}
                    </a>
                  ) : (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 sm:h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition-all touch-manipulation sm:hover:bg-neutral-800 active:scale-[0.98] no-underline"
                    >
                      <Download className="h-4 w-4" />
                      {item.label}
                    </a>
                  )}

                  {/* Windows card subtle accent */}
                  {item.title === 'Windows' && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-0 transition-opacity duration-500 sm:group-hover:opacity-100" aria-hidden="true">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" style={{ willChange: 'opacity' }} />
                    </div>
                  )}
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* iPhone PWA */}
        <section className="border-t border-neutral-200/80 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <motion.div initial={fadeInUpMore.initial} whileInView={fadeInUpMore.animate} viewport={viewportOnce} transition={sectionTransition} className="mb-6 sm:mb-8">
              <p className="mb-2 sm:mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">iPhone</p>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl lg:text-3xl">Instala Stocky como una app</h2>
              <p className="mt-2 text-sm text-neutral-500">Añade Stocky a tu pantalla de inicio y recibe notificaciones push.</p>
            </motion.div>

            <div className="rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-sm sm:p-7">
              {userInStandalone && (
                <motion.div {...scaleIn} className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <AppWindow className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">¡Stocky está instalada!</p>
                    <p className="text-xs text-green-700">Activa las notificaciones para recibir alertas.</p>
                  </div>
                </motion.div>
              )}

              {userIsOnIOs && !userInStandalone && (
                <motion.div {...scaleIn} className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-medium text-amber-800">Estás en iPhone. Sigue los pasos de abajo para instalar Stocky.</p>
                </motion.div>
              )}

              <button
                onClick={toggleIOsSteps}
                className="mb-4 inline-flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 touch-manipulation"
              >
                <span className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-neutral-400" />
                  {showIOsSteps ? 'Ocultar pasos' : <><span className="sm:hidden">Ver pasos</span><span className="hidden sm:inline">Ver pasos de instalación</span></>}
                </span>
                <motion.span animate={{ rotate: showIOsSteps ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-neutral-400">▼</motion.span>
              </button>

              <AnimatePresence>
                {showIOsSteps && (
                  <motion.div {...collapseAnim} transition={collapseTransition} className="overflow-hidden">
                    <div className="mb-4 space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 sm:p-5">
                      {iosSteps.map((step, i) => (
                        <motion.div key={step.num} {...slideInLeft} transition={{ delay: i * 0.08 }} className="flex gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{step.num}</div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{step.title}</p>
                            <p className="text-xs text-neutral-500">{step.desc}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <p className="mb-4 text-xs text-neutral-400">Después de instalar, abre la app desde tu pantalla de inicio y activa las notificaciones.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notifications */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-neutral-700">Notificaciones push</p>
                <div className="grid gap-2 grid-cols-1 xs:grid-cols-2">
                  <Button
                    size="sm"
                    onClick={handleEnableNotifications}
                    disabled={enablingPush || !support.supported}
                    className="h-10 rounded-xl bg-neutral-900 px-3 text-sm font-semibold text-white transition-colors sm:hover:bg-neutral-800 touch-manipulation"
                  >
                    {enablingPush ? 'Activando...' : 'Activar notificaciones'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendTest}
                    disabled={testingPush || !support.supported}
                    className="h-10 rounded-xl border-neutral-200 bg-white text-sm text-neutral-700 transition-colors sm:hover:bg-neutral-50 touch-manipulation"
                  >
                    {testingPush ? 'Enviando...' : 'Enviar prueba'}
                  </Button>
                </div>

                {!support.supported && (
                  <p className="text-xs text-neutral-400">Este navegador no soporta notificaciones. Usa Safari en iPhone con la app instalada.</p>
                )}
                {pushFeedback && (
                  <p className={`text-xs font-medium ${pushFeedback.startsWith('✅') ? 'text-green-700' : pushFeedback.startsWith('⚠️') ? 'text-amber-700' : 'text-red-600'}`}>
                    {pushFeedback}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Steps */}
        <section className="border-t border-neutral-200/80 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-5xl">
            <motion.div initial={fadeInUpMore.initial} whileInView={fadeInUpMore.animate} viewport={viewportOnce} transition={sectionTransition} className="mb-6 sm:mb-8 text-center">
              <p className="mb-2 sm:mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Instalación</p>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl lg:text-3xl">Así de simple</h2>
            </motion.div>

            <div className="grid gap-2 sm:gap-3 sm:grid-cols-3">
              {quickStepsData.map((item, i) => (
                <motion.div
                  key={item.step}
                  {...fadeInUpMore}
                  whileInView={fadeInUpMore.animate}
                  viewport={viewportOnceSm}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="flex gap-3 rounded-xl border border-neutral-200/60 bg-white p-4 sm:p-5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-sm font-bold text-white">{item.step}</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                    <p className="text-xs text-neutral-500">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer note */}
        <section className="px-4 pb-10 sm:px-6 sm:pb-16 lg:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-xs text-neutral-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Descargas oficiales desde nuestros repositorios verificados
          </div>
        </section>
      </main>
    </div>
  );
}

export default DownloadPage;
