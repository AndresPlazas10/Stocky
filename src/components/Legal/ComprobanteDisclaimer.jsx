// ============================================
// 📄 Disclaimer Legal para Comprobantes
// ============================================
// Ubicación: src/components/Legal/ComprobanteDisclaimer.jsx
// 
// Componente reutilizable que muestra advertencias legales
// sobre que los comprobantes NO son documentos fiscales

import { AlertTriangle, Info, Shield } from 'lucide-react';

/**
 * Disclaimer legal para comprobantes de venta
 * Muestra advertencia sobre validez fiscal del documento
 * 
 * @param {string} variant - 'full' | 'compact' | 'print' | 'inline'
 * @param {string} className - Clases CSS adicionales
 */
export default function ComprobanteDisclaimer({ variant = 'full', className = '' }) {
  
  // Versión para impresión (sin colores)
  if (variant === 'print') {
    return (
      <div className={`border-t-2 border-b-2 border-gray-800 py-3 my-4 text-center ${className}`}>
        <p className="font-bold text-sm uppercase tracking-wide mb-2">
          ⚠ DOCUMENTO NO VÁLIDO ANTE DIAN ⚠
        </p>
        <p className="text-xs leading-relaxed">
          Este comprobante es informativo y NO constituye factura de venta ni 
          documento equivalente. NO es deducible de impuestos ni soporte contable 
          válido. Para factura electrónica oficial, debe solicitarla al establecimiento.
        </p>
      </div>
    );
  }

  // Versión inline (una línea de texto)
  if (variant === 'inline') {
    return (
      <p className={`text-xs text-gray-500 italic flex items-center gap-1.5 ${className}`}>
        <Info className="w-3 h-3 shrink-0" />
        <span>Comprobante informativo - No válido ante DIAN</span>
      </p>
    );
  }

  // Versión compacta (para modales pequeños)
  if (variant === 'compact') {
    return (
      <div className={`bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg ${className}`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-semibold mb-1">Documento sin validez fiscal</p>
            <p>
              Este comprobante NO es factura electrónica. No es deducible de impuestos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Versión completa (default) - para pantallas de confirmación
  return (
    <div className={`bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-lg shrink-0">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Información Legal Importante
          </h4>
          <div className="text-sm text-amber-800 space-y-1.5 leading-relaxed">
            <p>
              ✓ Este comprobante es únicamente para <strong>control interno</strong>
            </p>
            <p>
              ✗ NO constituye factura de venta ni documento equivalente
            </p>
            <p>
              ✗ NO es válido ante la DIAN para efectos tributarios
            </p>
            <p>
              ✗ NO es deducible de impuestos ni soporte contable
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>
                Para factura electrónica oficial, el negocio debe emitirla a través de su proveedor autorizado (Siigo u otro)
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner informativo para sección de ventas
 * Muestra recordatorio permanente sobre facturación
 */
export function FacturacionReminder({ onDismiss, className = '' }) {
  return (
    <div className={`bg-gray-50 border-l-4 border-gray-400 p-4 rounded-r-lg shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Info className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-gray-900 mb-1">
              Recordatorio: Facturación Electrónica
            </p>
            <p className="text-gray-800">
              Los comprobantes generados aquí NO son facturas electrónicas. 
              Para facturar oficialmente, ingresa a tu cuenta de <strong>Siigo</strong> incluida en tu plan.
            </p>
            <a 
              href="https://app.siigo.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block mt-2 text-gray-600 hover:text-gray-800 font-medium underline text-xs"
            >
              Ir a Siigo →
            </a>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
