import { motion } from 'framer-motion';
// Seccion de Facturacion Electronica
// Ubicacion: src/components/Settings/InvoicingSection.jsx

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useInvoicing } from '../../context/InvoicingContext'
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Zap,
  Building2,
  MessageCircle,
  Clock
} from 'lucide-react'
import InvoicingActivationFlow from './InvoicingActivationFlow'

export default function InvoicingSection({ businessId, businessName, businessNit }) {
  const { 
    isLoading, 
    isProduction,
    resolutionNumber,
    resolutionExpired,
    resolutionExpiringSoon,
    daysUntilExpiry,
    hasPendingRequest,
    requestStatus,
    requestDate,
    canGenerateElectronicInvoice,
    refresh
  } = useInvoicing()

  const [showActivationFlow, setShowActivationFlow] = useState(false)

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 flex items-center justify-center">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
            <div className="space-y-2">
              <div className="w-48 h-4 bg-gray-200 rounded"></div>
              <div className="w-32 h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getHeaderColor = () => {
    if (canGenerateElectronicInvoice) return 'bg-gradient-to-r from-green-500 to-emerald-600'
    if (hasPendingRequest) return 'bg-gradient-to-r from-amber-500 to-orange-500'
    return 'bg-gradient-to-r from-gray-500 to-gray-600'
  }

  const getStatusBadge = () => {
    if (canGenerateElectronicInvoice) return { text: 'Activa', icon: 'check' }
    if (hasPendingRequest) return { text: 'Pendiente', icon: 'clock' }
    if (requestStatus === 'rejected') return { text: 'Rechazada', icon: 'x' }
    return { text: 'No activa', icon: 'circle' }
  }

  const statusBadge = getStatusBadge()

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className={`p-6 ${getHeaderColor()} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Facturacion Electronica</h2>
                <p className="text-white/80">Validacion DIAN Colombia</p>
              </div>
            </div>

            <div className="px-4 py-2 rounded-full text-sm font-semibold bg-white/20 text-white flex items-center gap-2">
              {statusBadge.icon === 'check' && <CheckCircle className="w-4 h-4" />}
              {statusBadge.icon === 'clock' && <Clock className="w-4 h-4" />}
              {statusBadge.icon === 'x' && <XCircle className="w-4 h-4" />}
              {statusBadge.text}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {resolutionExpiringSoon && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  Tu resolucion DIAN vence en {daysUntilExpiry} dias
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Contactanos para renovar tu resolucion antes de que expire.
                </p>
              </div>
            </div>
          )}

          {resolutionExpired && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">
                  Tu resolucion DIAN ha vencido
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Contactanos para renovarla y continuar facturando.
                </p>
              </div>
            </div>
          )}

          {hasPendingRequest && !canGenerateElectronicInvoice && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">
                    Solicitud en revision
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Recibimos tu solicitud el {formatDate(requestDate)}. 
                    Nuestro equipo la esta revisando y te contactaremos pronto.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">
                  <strong>Tiempo estimado:</strong> Te responderemos en maximo 48 horas habiles.
                </p>
              </div>
            </div>
          )}

          {canGenerateElectronicInvoice && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    Facturacion electronica habilitada
                  </p>
                  <p className="text-sm text-green-700">
                    Puedes generar facturas electronicas validas ante la DIAN
                  </p>
                </div>
              </div>

              {resolutionNumber && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-1">Resolucion DIAN</p>
                    <p className="font-semibold text-gray-800">{resolutionNumber}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 mb-1">Ambiente</p>
                    <p className="font-semibold text-gray-800">
                      {isProduction ? 'Produccion' : 'Pruebas'}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  Necesitas ayuda? 
                  <button
                    onClick={() => setShowActivationFlow(true)}
                    className="font-semibold underline ml-1 hover:text-blue-900"
                  >
                    Contactanos
                  </button>
                </p>
              </div>
            </div>
          )}

          {!canGenerateElectronicInvoice && !hasPendingRequest && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">
                    La facturacion electronica es opcional
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Puedes usar Stocky sin facturacion electronica. Si deseas activarla, 
                    contactanos y te la incluimos en tu plan mensual.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="font-medium text-gray-800">Facturas validas DIAN</p>
                  <p className="text-sm text-gray-500 mt-1">Con CUFE y codigo QR</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="font-medium text-gray-800">Envio automatico</p>
                  <p className="text-sm text-gray-500 mt-1">PDF por email al cliente</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="font-medium text-gray-800">Todo incluido</p>
                  <p className="text-sm text-gray-500 mt-1">En tu plan de Stocky</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  <strong>Mientras no tengas facturacion electronica:</strong> Podras generar 
                  comprobantes de venta informativos, pero estos <strong>no tienen validez fiscal</strong> ante la DIAN.
                </p>
              </div>

              <button
                onClick={() => setShowActivationFlow(true)}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-gray-900 font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Solicitar facturacion electronica
              </button>

              <p className="text-xs text-center text-gray-500">
                Nuestro equipo te contactara en maximo 48 horas habiles
              </p>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showActivationFlow && (
          <InvoicingActivationFlow
            businessId={businessId}
            businessName={businessName}
            businessNit={businessNit}
            onClose={() => setShowActivationFlow(false)}
            onComplete={() => {
              setShowActivationFlow(false)
              refresh()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
