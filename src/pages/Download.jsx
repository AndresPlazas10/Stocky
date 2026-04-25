import { motion } from 'framer-motion';
import { Download, ShieldCheck, Smartphone, AlertTriangle, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApkDownloadUrl } from '../utils/apkDownload.js';
import { getWindowsDownloadUrl } from '../utils/windowsDownload.js';

const _motionLintUsage = motion;

function DownloadPage() {
  const apkUrl = getApkDownloadUrl();
  const windowsUrl = getWindowsDownloadUrl();
  const apkVersion = String(import.meta.env?.VITE_APK_VERSION || '').trim();
  const windowsVersion = String(import.meta.env?.VITE_WINDOWS_VERSION || '').trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f5ff] via-[#f2edff] to-[#ebe4ff] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,0.25),transparent_34%),radial-gradient(circle_at_85%_5%,rgba(99,102,241,0.2),transparent_32%),radial-gradient(circle_at_50%_95%,rgba(168,85,247,0.18),transparent_40%)]" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl rounded-3xl border border-violet-200/80 bg-white/85 p-8 shadow-[0_28px_60px_-40px_rgba(99,102,241,0.9)] backdrop-blur-sm sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col gap-6"
          >
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-violet-300/70 bg-violet-100/70 px-3 py-1.5 text-xs font-semibold text-violet-700">
              <Download className="h-3.5 w-3.5" />
              Descargas oficiales
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-violet-950 sm:text-4xl">
                Descarga Stocky para Android y Windows
              </h1>
              <p className="text-base text-slate-700 sm:text-lg">
                Elige tu plataforma y descarga la versión correspondiente.
                {apkVersion ? ` Android ${apkVersion}.` : ''}
                {windowsVersion ? ` Windows ${windowsVersion}.` : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-amber-200 p-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Descarga segura en pruebas</p>
                  <p className="leading-relaxed text-amber-900/90">
                    La versión de Windows todavía no está firmada para producción.
                    Si descargas el instalador de prueba, SmartScreen puede mostrar un aviso temporal.
                    Esa alerta es esperable mientras compramos el certificado EV o estándar.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={() => window.open(apkUrl, '_blank', 'noopener')}
                className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-slate-50 hover:opacity-90"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Descargar Android (APK)
              </Button>
              <Button
                size="lg"
                onClick={() => window.open(windowsUrl, '_blank', 'noopener')}
                className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 font-semibold text-slate-50 hover:opacity-90"
              >
                <Monitor className="mr-2 h-4 w-4" />
                Descargar Windows
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              Enlace oficial de descargas por plataforma
            </div>

            <div className="rounded-2xl border border-violet-200/70 bg-violet-50/70 p-4 text-sm text-slate-700">
              Pasos rápidos:
              <ul className="mt-2 space-y-1">
                <li>1. Android: instala el APK y habilita instalación de apps desconocidas.</li>
                <li>2. Windows: descarga el instalador y ejecuta como instalación normal.</li>
                <li>3. Si SmartScreen aparece en Windows, usa "Más información" y luego "Ejecutar de todas formas".</li>
              </ul>
            </div>

          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default DownloadPage;
