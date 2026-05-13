import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { signOutSession } from '../data/commands/authCommands.js';
import WhatsNewModal from '../components/Modals/WhatsNewModal.jsx';
import { isIOs, isStandalone, supportsPWA } from '../utils/deviceDetection.js';
import {
  Menu,
  X,
  ArrowRight,
  Sparkles,
  ShoppingCart,
  Receipt,
  BarChart3,
  Users,
  Shield,
  Clock3,
  Check,
  Smartphone,
  Share2,
} from 'lucide-react';
import logoStocky from '../assets/logoStocky.png';

const _motionLintUsage = motion;

const quickStats = [
  { value: 'Siempre activo', label: 'Funciona incluso sin internet' },
  { value: 'Cobro express', label: 'Tu mesero cobra en segundos' },
  { value: 'Más ventas', label: 'Menos errores, más pedidos' },
];

const modules = [
  {
    icon: ShoppingCart,
    title: 'Cobro rápido',
    text: 'Atiende más mesas en menos tiempo.',
  },
  {
    icon: Receipt,
    title: 'Facturación simple',
    text: 'Todo queda registrado automáticamente.',
  },
  {
    icon: BarChart3,
    title: 'Reportes claros',
    text: 'Entiende tu negocio de un vistazo.',
  },
  {
    icon: Users,
    title: 'Control por empleado',
    text: 'Cada quien ve solo lo que necesita.',
  },
  {
    icon: Shield,
    title: 'Información segura',
    text: 'Tus datos siempre protegidos.',
  },
  {
    icon: Clock3,
    title: 'Cierre fácil',
    text: 'Termina el día en un solo paso.',
  },
];

const process = [
  'Agrega tus productos y crea usuarios.',
  'Vende y controla tu inventario.',
  'Revisa resultados y mejora.',
];

function Home() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  const phrases = [
    'Una experiencia limpia y potente para controlar todo tu negocio',
    'Vende, controla y crece sin complicaciones',
  ];
  const [typedTitle, setTypedTitle] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeout;

    const tick = () => {
      const currentPhrase = phrases[phraseIndex];

      if (!isDeleting) {
        charIndex++;
        setTypedTitle(currentPhrase.slice(0, charIndex));

        if (charIndex === currentPhrase.length) {
          timeout = setTimeout(() => { isDeleting = true; tick(); }, 5000);
          return;
        }
        timeout = setTimeout(tick, 90);
      } else {
        charIndex--;
        setTypedTitle(currentPhrase.slice(0, charIndex));

        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timeout = setTimeout(tick, 800);
          return;
        }
        timeout = setTimeout(tick, 44);
      }
    };

    timeout = setTimeout(tick, 800);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(blink);
  }, []);

  useEffect(() => {
    const signOut = async () => {
      try {
        await signOutSession();
      } catch {
        // no-op
      }
    };
    signOut();

    const isIosDevice = isIOs();
    const isInstalled = isStandalone();
    const supportsPwa = supportsPWA();
    const dismissed = localStorage.getItem('ios-banner-dismissed');

    if (isIosDevice && !isInstalled && supportsPwa && !dismissed) {
      setShowIosBanner(true);
    }
  }, []);

  const dismissIosBanner = () => {
    setShowIosBanner(false);
    localStorage.setItem('ios-banner-dismissed', 'true');
  };

  return (
    <div className="relative min-h-screen bg-[#fafaf9] text-neutral-900 antialiased overflow-hidden">
      {/* Fondo animado */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-amber-100/40 blur-3xl animate-[drift_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-stone-200/30 blur-3xl animate-[drift_18s_ease-in-out_infinite_3s]" />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-amber-50/50 blur-3xl animate-[drift_20s_ease-in-out_infinite_6s]" />
        <div className="absolute top-1/2 left-1/3 h-[16rem] w-[16rem] rounded-full bg-neutral-200/20 blur-3xl animate-[drift_16s_ease-in-out_infinite_9s]" />
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      <WhatsNewModal />

      {/* Banner de instalacion iOS */}
      <AnimatePresence>
        {showIosBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.25 }}
            className="relative z-50 bg-neutral-900 px-4 py-3"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                  <Smartphone className="h-4 w-4 text-neutral-300" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-white">Instala Stocky en tu iPhone</p>
                  <p className="text-xs text-neutral-400">
                    Abre en Safari, toca{' '}
                    <Share2 className="mx-0.5 inline h-3 w-3" /> y selecciona &ldquo;Añadir a pantalla de inicio&rdquo;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/descargar')}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-100"
                >
                  Ver guía
                </button>
                <button
                  onClick={dismissIosBanner}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-[#fafaf9]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2.5 rounded-lg -ml-2 px-2 py-1.5 hover:bg-neutral-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" />
            </span>
            <span className="text-lg font-bold tracking-tight text-neutral-900">Stocky</span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#process" className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900">
              Proceso
            </a>
            <a href="#modules" className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900">
              Módulos
            </a>
            <a href="#start" className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900">
              Empezar
            </a>
            <button
              onClick={() => navigate('/descargar')}
              className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Descargas
            </button>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => navigate('/login')}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => navigate('/register')}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.98]"
            >
              Crear cuenta
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-neutral-200 bg-[#fafaf9] px-4 py-4 md:hidden"
            >
              <div className="flex flex-col gap-1">
                <a
                  href="#process"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Proceso
                </a>
                <a
                  href="#modules"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Módulos
                </a>
                <a
                  href="#start"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Empezar
                </a>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/descargar'); }}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 text-left"
                >
                  Descargas
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/login')}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Registro
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* Hero */}
        <section className="px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24">
          <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200/70 bg-neutral-100/70 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-neutral-700"
            >
              <Sparkles className="h-3 w-3" />
              POS integral para restaurantes y bares
            </motion.div>

            <h1 className="mt-8 max-w-4xl relative text-4xl font-bold leading-[1.08] tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              <span className="invisible" aria-hidden="true">
                {phrases[0]}
              </span>
              <span className="absolute inset-0">
                {typedTitle}
                <span className={`inline-block w-[0.05em] h-[0.85em] bg-neutral-900 align-middle ml-0.5 -mb-0.5 transition-opacity duration-100 ${cursorVisible ? 'opacity-100' : 'opacity-0'}`} />
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-500 sm:text-lg">
              Stocky reúne ventas, inventario y reportes en una sola plataforma.
              Diseñado para que tu equipo trabaje más rápido, con menos errores y mejor control diario.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
            >
              <button
                onClick={() => navigate('/register')}
                className="group inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.98] sm:w-auto"
              >
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-6 text-sm font-semibold text-neutral-700 transition-all hover:bg-neutral-50 active:scale-[0.98] sm:w-auto"
              >
                Ya tengo cuenta
              </button>
            </motion.div>

          </div>
        </section>

        {/* Process */}
        <section id="process" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35 }}
              className="mb-12"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Proceso
              </p>
              <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                Empieza en 3 pasos
              </h2>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-3">
              {process.map((line, index) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="rounded-2xl border border-neutral-200/60 bg-white p-6 sm:p-7"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    Paso {index + 1}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">{line}</p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-neutral-700">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">Listo para ejecutar</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-t border-neutral-200/80 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35 }}
              className="flex w-full flex-col gap-6 sm:flex-row sm:gap-0"
            >
              {quickStats.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex-1 text-center ${
                    i !== 0 ? 'sm:border-l sm:border-neutral-200/80' : ''
                  }`}
                >
                  <p className="text-3xl font-bold tracking-tight text-neutral-900">{item.value}</p>
                  <p className="mt-1.5 text-sm text-neutral-400">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35 }}
              className="mb-12"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Módulos
              </p>
              <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                Seis piezas para una operación más ordenada
              </h2>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((module, index) => (
                <motion.article
                  key={module.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className="group rounded-2xl border border-neutral-200/60 bg-white p-6 transition-all hover:border-neutral-300/80 sm:p-7"
                >
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-neutral-200 group-hover:text-neutral-900">
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{module.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="start" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-3xl bg-neutral-900 p-8 sm:p-10 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Empieza hoy y moderniza la operación de tu negocio
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
                Crea tu cuenta en minutos y gestiona ventas, inventario y reportes desde una sola plataforma.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-neutral-900 transition-all hover:bg-neutral-100 active:scale-[0.98] sm:w-auto"
              >
                Comenzar ahora
              </button>
              <button
                onClick={() => navigate('/terms')}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-transparent px-6 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98] sm:w-auto"
              >
                Términos del servicio
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 bg-[#fafaf9] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" />
            </span>
            <div>
              <p className="text-sm font-bold text-neutral-900">Stocky</p>
              <p className="text-xs text-neutral-400">Sistema POS para restaurantes y bares</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <a href="/terms" className="font-medium text-neutral-500 transition-colors hover:text-neutral-900">
              Términos
            </a>
            <a href="/privacy" className="font-medium text-neutral-500 transition-colors hover:text-neutral-900">
              Privacidad
            </a>
            <a
              href="/legal/delete-account.html"
              className="font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Eliminar cuenta
            </a>
          </div>
          <div className="text-xs text-neutral-400">
            &copy; 2026 Stocky. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
