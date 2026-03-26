import { motion } from 'framer-motion';

const _motionLintUsage = motion;

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f5ff] via-white to-[#f5f1ff] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white p-6 shadow-xl border border-violet-100"
        >
          <h1 className="text-3xl font-black text-violet-900">Política de Privacidad</h1>
          <p className="mt-2 text-sm text-slate-600">Última actualización: 16 de marzo de 2026</p>

          <section className="mt-6 space-y-3 text-sm text-slate-700 leading-relaxed">
            <p>
              En Stocky valoramos tu privacidad. Esta política describe qué datos recolectamos,
              cómo los usamos y cuáles son tus derechos.
            </p>

            <h2 className="text-lg font-bold text-slate-900">Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Datos de cuenta: email, usuario y datos básicos de perfil.</li>
              <li>Datos operativos del negocio: ventas, inventario, compras y reportes.</li>
              <li>Datos técnicos: logs y diagnósticos para mejorar el servicio.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900">Cómo usamos tus datos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Proveer el servicio de POS, inventario y reportes.</li>
              <li>Garantizar seguridad, auditoría y estabilidad del sistema.</li>
              <li>Soporte y mejoras del producto.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900">Compartición de datos</h2>
            <p>
              No vendemos tu información. Solo compartimos datos con proveedores necesarios para operar
              el servicio (por ejemplo, infraestructura y envío de notificaciones).
            </p>

            <h2 className="text-lg font-bold text-slate-900">Retención</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa o según lo exija la ley.
              Puedes solicitar la eliminación de tu cuenta desde la aplicación.
            </p>

            <h2 className="text-lg font-bold text-slate-900">Eliminación de cuenta</h2>
            <p>
              Puedes eliminar tu cuenta desde Configuración. Este proceso revoca el acceso y elimina
              tu usuario del sistema.
            </p>

            <h2 className="text-lg font-bold text-slate-900">Contacto</h2>
            <p>
              Si tienes dudas o solicitudes sobre privacidad, contáctanos en
              <span className="font-semibold"> soporte@stockypos.app</span>.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
