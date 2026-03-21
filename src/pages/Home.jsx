import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { signOutSession } from '../data/commands/authCommands.js';
import { Button } from '@/components/ui/button';
import WhatsNewModal from '../components/Modals/WhatsNewModal.jsx';
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
  Check
} from 'lucide-react';
import logoStocky from '../assets/logoStocky.png';

const _motionLintUsage = motion;

const quickStats = [
  { value: '99.9%', label: 'Disponibilidad operativa' },
  { value: '2 min', label: 'Tiempo promedio de cobro' },
  { value: '+28%', label: 'Mejora en eficiencia diaria' }
];

const modules = [
  {
    icon: ShoppingCart,
    title: 'Punto de venta veloz',
    text: 'Flujo optimizado para turnos exigentes y atención continua.'
  },
  {
    icon: Receipt,
    title: 'Facturación y comprobantes',
    text: 'Documentación clara y trazable desde la venta hasta el cierre.'
  },
  {
    icon: BarChart3,
    title: 'Reportes útiles',
    text: 'Métricas que ayudan a decidir mejor cada día.'
  },
  {
    icon: Users,
    title: 'Gestión por roles',
    text: 'Permisos por empleado para operar con control y seguridad.'
  },
  {
    icon: Shield,
    title: 'Datos protegidos',
    text: 'Infraestructura estable para cuidar tu información crítica.'
  },
  {
    icon: Clock3,
    title: 'Cierre simplificado',
    text: 'Consolidación de jornada sin procesos manuales repetitivos.'
  }
];

const process = [
  'Configura productos, categorías y usuarios.',
  'Opera ventas e inventario en la misma interfaz.',
  'Revisa resultados y ajusta con datos reales.'
];

function Home() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileAppUrl = String(import.meta.env?.VITE_APK_URL || '').trim()
    || '/apk/stocky-latest.apk';

  const handleDownloadClick = () => {
    if (mobileAppUrl.startsWith('/')) {
      window.location.href = mobileAppUrl;
      return;
    }
    window.open(mobileAppUrl, '_blank', 'noopener');
  };

  useEffect(() => {
    const signOut = async () => {
      try {
        await signOutSession();
      } catch {
        // no-op
      }
    };
    signOut();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f5ff] via-[#f2edff] to-[#ebe4ff] text-slate-900">
      <WhatsNewModal />
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,0.25),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(99,102,241,0.2),transparent_32%),radial-gradient(circle_at_50%_95%,rgba(168,85,247,0.18),transparent_40%)]" />

      <header className="sticky top-0 z-50 border-b border-violet-200/60 bg-[#f8f5ff]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-violet-100/70">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200/70 bg-white shadow-sm">
              <img src={logoStocky} alt="Stocky" className="h-7 w-7 object-contain" />
            </span>
            <span className="text-lg font-black tracking-tight text-violet-950">Stocky</span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#modules" className="text-sm font-semibold text-slate-700 hover:text-violet-700">Módulos</a>
            <a href="#process" className="text-sm font-semibold text-slate-700 hover:text-violet-700">Proceso</a>
            <a href="#start" className="text-sm font-semibold text-slate-700 hover:text-violet-700">Empezar</a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" onClick={() => navigate('/login')} className="font-semibold text-slate-700">
              Iniciar sesión
            </Button>
            <Button onClick={() => navigate('/register')} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-slate-50 hover:opacity-90">
              Crear cuenta
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="outline"
              onClick={handleDownloadClick}
              className="h-9 border-violet-300 px-2 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
            >
              Descargar para tu teléfono
            </Button>
            <button
              className="rounded-lg p-2 text-slate-700 hover:bg-violet-100"
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
              className="border-t border-violet-200 bg-[#f8f5ff] px-4 py-4 md:hidden"
            >
              <div className="flex flex-col gap-2">
                <a href="#modules" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-100">Módulos</a>
                <a href="#process" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-100">Proceso</a>
                <a href="#start" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-100">Empezar</a>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => navigate('/login')} className="border-violet-300">Entrar</Button>
                  <Button onClick={() => navigate('/register')} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-slate-50 hover:opacity-90">Registro</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative z-10">
        <section className="px-4 pb-12 pt-12 sm:px-6 sm:pt-14 lg:px-8 lg:pb-20 lg:pt-24">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-300/70 bg-violet-100/70 px-3 py-1.5 text-xs font-semibold text-violet-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              POS integral para restaurantes y bares
            </motion.div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-violet-950 sm:text-5xl lg:text-6xl">
              Una experiencia limpia y potente para controlar todo tu negocio
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
              Stocky reúne ventas, inventario y reportes en una sola plataforma.
              Diseñado para que tu equipo trabaje más rápido, con menos errores y mejor control diario.
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => navigate('/register')}
                className="group h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-slate-50 hover:opacity-90 sm:w-auto"
              >
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="h-12 w-full rounded-xl border-violet-300 bg-white/80 px-6 font-semibold text-slate-700 hover:bg-violet-50 sm:w-auto"
              >
                Ya tengo cuenta
              </Button>
            </div>

            <div className="mt-12 grid w-full gap-4 md:grid-cols-3">
              {quickStats.map((item, index) => (
                <motion.article
                  key={item.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + (index * 0.08) }}
                  className="rounded-2xl border border-violet-200/80 bg-white/75 p-5 shadow-[0_16px_30px_-22px_rgba(99,102,241,0.6)] backdrop-blur-sm"
                >
                  <p className="text-2xl font-black text-violet-900">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.label}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-10 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Módulos</p>
              <h2 className="text-3xl font-black tracking-tight text-violet-950 sm:text-4xl">
                Seis piezas para una operación más ordenada
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((module, index) => (
                <motion.article
                  key={module.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-2xl border border-violet-200/90 bg-white/80 p-5 shadow-[0_14px_28px_-22px_rgba(124,58,237,0.65)]"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{module.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto w-full max-w-7xl rounded-3xl border border-violet-200/90 bg-gradient-to-r from-violet-100/90 to-indigo-100/90 p-6 sm:p-8 lg:p-10">
            <div className="mb-8 max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Proceso</p>
              <h2 className="text-3xl font-black tracking-tight text-violet-950 sm:text-4xl">Del arranque al control diario en 3 movimientos</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {process.map((line, index) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: index * 0.07 }}
                  className="rounded-2xl border border-violet-200 bg-white/80 p-5"
                >
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Paso {index + 1}</p>
                  <p className="text-sm leading-relaxed text-slate-700">{line}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-violet-700">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-semibold">Listo para ejecutar</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="start" className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 rounded-3xl border border-violet-300/80 bg-violet-950 p-6 sm:p-8 lg:flex-row lg:items-center lg:p-10">
            <div className="max-w-2xl">
              <h3 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">Empieza hoy y moderniza la operación de tu negocio</h3>
              <p className="mt-2 text-sm text-violet-100 sm:text-base">
                Crea tu cuenta en minutos y gestiona ventas, inventario y reportes desde una sola plataforma.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button onClick={() => navigate('/register')} className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 font-semibold text-slate-50 hover:opacity-90 sm:w-auto">
                Comenzar ahora
              </Button>
              <Button variant="outline" onClick={() => navigate('/terms')} className="h-11 w-full rounded-xl border-violet-300 bg-transparent px-6 font-semibold text-violet-100 hover:bg-violet-900 sm:w-auto">
                Términos del servicio
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-violet-200/70 bg-[#f8f5ff]/95 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200/70 bg-white shadow-sm">
              <img src={logoStocky} alt="Stocky" className="h-7 w-7 object-contain" />
            </span>
            <div>
              <p className="text-sm font-black text-violet-950">Stocky</p>
              <p className="text-xs text-slate-600">Sistema POS para restaurantes y bares</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <a href="/terms" className="font-semibold text-slate-600 hover:text-violet-700">Términos</a>
            <a href="/privacy" className="font-semibold text-slate-600 hover:text-violet-700">Privacidad</a>
            <a href="/legal/delete-account.html" className="font-semibold text-slate-600 hover:text-violet-700">Eliminar cuenta</a>
          </div>
          <div className="text-xs text-slate-500">
            © 2026 Stocky. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
