// ============================================
// 📄 Selector de Tipo de Documento
// ============================================
// Ubicación: src/components/POS/DocumentTypeSelector.jsx
// 
// Permite elegir entre comprobante de venta y factura electrónica
// Solo muestra factura electrónica si está habilitada

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Receipt, 
  CheckCircle, 
  AlertTriangle,
  Info,
  ChevronDown,
  Shield,
  Zap
} from 'lucide-react'

export const DOCUMENT_TYPES = {
  RECEIPT: 'receipt',           // Comprobante de venta (sin validez fiscal)
  ELECTRONIC_INVOICE: 'invoice' // Factura electrónica DIAN
}

export default function DocumentTypeSelector({ 
  selectedType, 
  onChange, 
  canGenerateElectronicInvoice = false,
  disabled = false,
  compact = false
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSelect = (type) => {
    if (disabled) return
    if (type === DOCUMENT_TYPES.ELECTRONIC_INVOICE && !canGenerateElectronicInvoice) return
    
    onChange(type)
    setIsExpanded(false)
  }

  // Versión compacta (para usar inline)
  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsExpanded(!isExpanded)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            disabled 
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed' 
              : 'bg-white border-gray-300 hover:border-gray-400 cursor-pointer'
          }`}
        >
          {selectedType === DOCUMENT_TYPES.ELECTRONIC_INVOICE ? (
            <>
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Factura electrónica</span>
            </>
          ) : (
            <>
              <Receipt className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium">Comprobante de venta</span>
            </>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-xl shadow-lg z-50 overflow-hidden"
            >
              <CompactOption
                type={DOCUMENT_TYPES.RECEIPT}
                label="Comprobante de venta"
                description="Sin validez fiscal"
                icon={Receipt}
                selected={selectedType === DOCUMENT_TYPES.RECEIPT}
                onClick={() => handleSelect(DOCUMENT_TYPES.RECEIPT)}
              />
              <CompactOption
                type={DOCUMENT_TYPES.ELECTRONIC_INVOICE}
                label="Factura electrónica"
                description="Con validez DIAN"
                icon={FileText}
                selected={selectedType === DOCUMENT_TYPES.ELECTRONIC_INVOICE}
                disabled={!canGenerateElectronicInvoice}
                onClick={() => handleSelect(DOCUMENT_TYPES.ELECTRONIC_INVOICE)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Versión completa (tarjetas lado a lado)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Tipo de documento</h3>
        <span className="text-xs text-gray-500">Selecciona uno</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Comprobante de venta */}
        <DocumentTypeCard
          type={DOCUMENT_TYPES.RECEIPT}
          selected={selectedType === DOCUMENT_TYPES.RECEIPT}
          disabled={disabled}
          onClick={() => handleSelect(DOCUMENT_TYPES.RECEIPT)}
          icon={Receipt}
          title="Comprobante de venta"
          description="Documento informativo para el cliente"
          badge="Sin validez fiscal"
          badgeColor="amber"
          features={[
            'Imprime ticket para el cliente',
            'Registro interno de ventas',
            'No requiere datos fiscales del cliente'
          ]}
        />

        {/* Factura electrónica - DESHABILITADA */}
        <DocumentTypeCard
          type={DOCUMENT_TYPES.ELECTRONIC_INVOICE}
          selected={false}
          disabled={true}
          onClick={() => {}}
          icon={FileText}
          title="Factura electrónica DIAN"
          description="Emitir directamente en Siigo"
          badge="Usar Siigo directamente"
          badgeColor="gray"
          features={[
            'Factura con validez fiscal',
            'Código CUFE y QR oficial',
            'Transmisión automática a DIAN'
          ]}
          unavailableMessage="Para facturar: ingresa a tu cuenta de Siigo incluida en tu plan. Stocky solo genera comprobantes informativos."
        />
      </div>

      {/* Disclaimer Legal */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            Documento sin validez fiscal
          </p>
          <p className="text-sm text-amber-800 mb-2">
            Este comprobante de pago es únicamente para control interno del negocio. NO tiene validez ante la DIAN 
            y NO es deducible de impuestos.
          </p>
          <p className="text-xs text-amber-700">
            <strong>Para facturar oficialmente:</strong> Ingresa a tu cuenta de Siigo (incluida en tu plan) 
            y emite la factura electrónica desde allí.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ============================================
// Componente de tarjeta
// ============================================
function DocumentTypeCard({ 
  type,
  selected, 
  disabled, 
  onClick, 
  icon: Icon,
  title, 
  description,
  badge,
  badgeColor,
  features,
  unavailableMessage
}) {
  const badgeColors = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-500',
  }

  return (
    <motion.button
      type="button"
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`relative text-left p-5 rounded-xl border-2 transition-all ${
        selected 
          ? 'border-accent-500 bg-accent-50 shadow-md' 
          : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Checkmark de selección */}
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle className="w-6 h-6 text-accent-500" />
        </div>
      )}

      {/* Icono y título */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-lg ${selected ? 'bg-accent-100' : 'bg-gray-100'}`}>
          <Icon className={`w-5 h-5 ${selected ? 'text-accent-600' : 'text-gray-600'}`} />
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold ${selected ? 'text-accent-700' : 'text-gray-800'}`}>
            {title}
          </h4>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>

      {/* Badge */}
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mb-3 ${badgeColors[badgeColor]}`}>
        {badge}
      </span>

      {/* Features */}
      <ul className="space-y-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
            <div className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-accent-400' : 'bg-gray-400'}`} />
            {feature}
          </li>
        ))}
      </ul>

      {/* Mensaje de no disponible */}
      {unavailableMessage && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {unavailableMessage}
          </p>
        </div>
      )}
    </motion.button>
  )
}

// ============================================
// Opción compacta del dropdown
// ============================================
function CompactOption({ _type, label, description, icon: _Icon, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
        disabled 
          ? 'opacity-50 cursor-not-allowed bg-gray-50' 
          : selected
            ? 'bg-accent-50'
            : 'hover:bg-gray-50'
      }`}
    >
      <div className={`p-2 rounded-lg ${selected ? 'bg-accent-100' : 'bg-gray-100'}`}>
        <Icon className={`w-4 h-4 ${selected ? 'text-accent-600' : 'text-gray-600'}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${selected ? 'text-accent-700' : 'text-gray-800'}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {selected && <CheckCircle className="w-4 h-4 text-accent-500" />}
      {disabled && <span className="text-xs text-gray-400">Requiere activación</span>}
    </button>
  )
}
