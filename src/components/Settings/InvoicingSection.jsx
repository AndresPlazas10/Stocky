import { motion } from 'framer-motion';
import { ExternalLink, FileText, Info } from 'lucide-react';

export default function InvoicingSection({ businessName = 'Tu negocio' }) {
  const _motionLintUsage = motion;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
    >
      <div className="p-6 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Facturacion electronica</h2>
            <p className="text-white/80">Gestion externa al runtime de Stocky</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Estado actual del producto</p>
            <p className="mt-1">
              Stocky no emite facturas electronicas DIAN desde el runtime de la app.
              {` ${businessName}`} debe gestionar su facturacion oficial directamente en su proveedor autorizado.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          Los comprobantes generados en Stocky son informativos y no reemplazan la factura electronica oficial.
        </div>

        <a
          href="https://app.siigo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Ir a Siigo
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  );
}
