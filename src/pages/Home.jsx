import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { signOutSession } from '../data/commands/authCommands.js';
import WhatsNewModal from '../components/Modals/WhatsNewModal.jsx';
import { isIOs, isStandalone, supportsPWA } from '../utils/deviceDetection.js';
import { SplineScene } from '../components/ui/splite.jsx';
import GradientButton from '../components/ui/gradient-button.jsx';
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
    <div className="relative min-h-screen bg-white text-primary-900 antialiased overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary-100/40 blur-3xl animate-[drift_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-primary-50/50 blur-3xl animate-[drift_18s_ease-in-out_infinite_3s]" />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-secondary-100/30 blur-3xl animate-[drift_20s_ease-in-out_infinite_6s]" />
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      <WhatsNewModal />

      <AnimatePresence>
        {showIosBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.25 }}
            className="relative z-50 bg-primary-900 px-4 py-3"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800">
                  <Smartphone className="h-4 w-4 text-primary-200" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-white">Instala Stocky en tu iPhone</p>
                  <p className="text-xs text-primary-300">
                    Abre en Safari, toca{' '}
                    <Share2 className="mx-0.5 inline h-3 w-3" /> y selecciona &ldquo;Añadir a pantalla de inicio&rdquo;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/descargar')}
                  className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-primary-900 transition-colors duration-200 hover:bg-primary-50"
                >
                  Ver guía
                </button>
                <button
                  onClick={dismissIosBanner}
                  className="cursor-pointer rounded-lg p-1.5 text-primary-400 transition-colors duration-200 hover:bg-primary-800 hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-40 border-b border-primary-100/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/')}
            className="cursor-pointer inline-flex items-center gap-2.5 rounded-lg -ml-2 px-2 py-1.5 transition-colors duration-200 hover:bg-primary-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
              <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" />
            </span>
            <span className="text-lg font-bold tracking-tight text-primary-900">Stocky</span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#process" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">
              Proceso
            </a>
            <a href="#modules" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">
              Módulos
            </a>
            <a href="#start" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">
              Empezar
            </a>
            <button
              onClick={() => navigate('/descargar')}
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700"
            >
              Descargas
            </button>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => navigate('/login')}
              className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-black transition-colors duration-200 hover:bg-primary-50"
            >
              Iniciar sesión
            </button>
            <GradientButton
              onClick={() => navigate('/register')}
              variant="small"
              className="text-sm"
            >
              Crear cuenta
            </GradientButton>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors duration-200 hover:bg-primary-50 hover:text-primary-700"
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
              className="border-t border-primary-100 bg-white px-4 py-4 md:hidden"
            >
              <div className="flex flex-col gap-1">
                <a
                  href="#process"
                  onClick={() => setMobileMenuOpen(false)}
                  className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-primary-50 hover:text-primary-700"
                >
                  Proceso
                </a>
                <a
                  href="#modules"
                  onClick={() => setMobileMenuOpen(false)}
                  className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-primary-50 hover:text-primary-700"
                >
                  Módulos
                </a>
                <a
                  href="#start"
                  onClick={() => setMobileMenuOpen(false)}
                  className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-primary-50 hover:text-primary-700"
                >
                  Empezar
                </a>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/descargar'); }}
                  className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-primary-50 hover:text-primary-700 text-left"
                >
                  Descargas
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <GradientButton
                    onClick={() => navigate('/login')}
                    minWidth="100%"
                    height="40px"
                    variant="small"
                  >
                    Entrar
                  </GradientButton>
                  <GradientButton
                    onClick={() => navigate('/register')}
                    minWidth="100%"
                    height="40px"
                    variant="small"
                  >
                    Registro
                  </GradientButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        <section className="px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/70 bg-primary-50 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary-700">
                <Sparkles className="h-3 w-3" />
                POS integral para restaurantes y bares
              </div>
            </motion.div>

            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 text-center lg:text-left">
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="text-4xl font-bold leading-[1.08] tracking-tight text-primary-900 sm:text-5xl lg:text-6xl"
                >
                  Vende, controla y crece sin complicaciones
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg mx-auto lg:mx-0"
                >
                  Stocky reúne ventas, inventario y reportes en una sola plataforma.
                  Diseñado para que tu equipo trabaje más rápido, con menos errores y mejor control diario.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row lg:justify-start justify-center items-center"
                >
                  <GradientButton
                    onClick={() => navigate('/register')}
                    minWidth="200px"
                    height="44px"
                  >
                    <span className="flex items-center gap-2">
                      Crear cuenta gratis
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </GradientButton>
                  <GradientButton
                    onClick={() => navigate('/login')}
                    minWidth="180px"
                    height="44px"
                  >
                    Ya tengo cuenta
                  </GradientButton>
                </motion.div>
              </div>

              <div className="flex-1 w-full lg:w-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="relative w-full h-[400px] lg:h-[500px] bg-white rounded-2xl overflow-hidden"
                  style={{ position: 'relative' }}
                >
                  <SplineScene 
                    scene="https://prod.spline.design/c81LtkO3jIPTCgFo/scene.splinecode"
                    className="w-full h-full pointer-events-none"
                  />
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <section id="process" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35 }}
              className="mb-12"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">
                Proceso
              </p>
              <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-primary-900 sm:text-4xl">
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
                  className="rounded-2xl border border-primary-100 bg-white p-6 transition-shadow duration-200 hover:shadow-md sm:p-7"
                >
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{line}</p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-primary-700">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">Listo para ejecutar</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-primary-100 px-4 py-10 sm:px-6 lg:px-8">
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
                    i !== 0 ? 'sm:border-l sm:border-primary-100' : ''
                  }`}
                >
                  <p className="text-3xl font-bold tracking-tight text-primary-700">{item.value}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="modules" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35 }}
              className="mb-12"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">
                Módulos
              </p>
              <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-primary-900 sm:text-4xl">
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
                  className="group cursor-pointer rounded-2xl border border-primary-100 bg-white p-6 transition-all duration-200 hover:border-primary-200 hover:shadow-md sm:p-7"
                >
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors duration-200 group-hover:bg-[#171717] group-hover:text-white">
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-primary-900">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{module.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="start" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-3xl bg-[#171717] p-8 sm:p-10 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Empieza hoy y moderniza la operación de tu negocio
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#D4D4D4] sm:text-base">
                Crea tu cuenta en minutos y gestiona ventas, inventario y reportes desde una sola plataforma.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row items-center">
              <GradientButton
                onClick={() => navigate('/register')}
                minWidth="180px"
                height="44px"
              >
                Comenzar ahora
              </GradientButton>
              <GradientButton
                onClick={() => navigate('/terms')}
                minWidth="200px"
                height="44px"
              >
                Términos del servicio
              </GradientButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-primary-100 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
              <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" />
            </span>
            <div>
              <p className="text-sm font-bold text-primary-900">Stocky</p>
              <p className="text-xs text-muted-foreground">Sistema POS para restaurantes y bares</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <a href="/terms" className="cursor-pointer font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">
              Términos
            </a>
            <a href="/privacy" className="cursor-pointer font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">
              Privacidad
            </a>
            <a
              href="/legal/delete-account.html"
              className="cursor-pointer font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700"
            >
              Eliminar cuenta
            </a>
          </div>
          <div className="text-xs text-muted-foreground">
            &copy; 2026 Stocky. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
