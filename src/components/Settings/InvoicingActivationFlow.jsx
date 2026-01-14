// ============================================
// Flujo de Solicitud de Facturacion
// ============================================
// Ubicacion: src/components/Settings/InvoicingActivationFlow.jsx
// 
// Permite al usuario solicitar la activacion de facturacion electronica
// contactando al equipo de Stocky

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  X, 
  FileText, 
  CheckCircle,
  Building2,
  Send,
  Phone,
  Mail,
  MessageCircle,
  Zap,
  Shield,
  Clock
} from 'lucide-react'
import { supabase } from '../../supabase/Client'

export default function InvoicingActivationFlow({ 
  businessId, 
  businessName, 
  businessNit,
  onClose, 
  onComplete 
}) {
  const [requestSent, setRequestSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [contactMethod, setContactMethod] = useState('whatsapp')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Numero de WhatsApp de Stocky
  const STOCKY_WHATSAPP = '+573176854477'
  const STOCKY_EMAIL = 'aplazas000@gmail.com'

  const handleContactWhatsApp = () => {
    const text = encodeURIComponent(
      `Hola equipo Stocky,\n\n` +
      `Solicito activar la facturacion electronica DIAN para mi negocio.\n\n` +
      `DATOS DEL NEGOCIO\n` +
      `- Nombre: ${businessName || 'No especificado'}\n` +
      `- NIT: ${businessNit || 'No registrado'}\n` +
      `- ID Stocky: ${businessId}\n` +
      `${message ? `\nNota: ${message}\n` : ''}` +
      `\nQuedo atento. Gracias.`
    )
    window.open(`https://wa.me/${STOCKY_WHATSAPP.replace('+', '')}?text=${text}`, '_blank')
  }

  const handleContactEmail = () => {
    const subject = encodeURIComponent(`Solicitud Facturacion Electronica - ${businessName || 'Mi Negocio'}`)
    const body = encodeURIComponent(
      `Hola equipo de Stocky,\n\n` +
      `Solicito activar la facturacion electronica DIAN para mi negocio.\n\n` +
      `DATOS DEL NEGOCIO\n` +
      `- Nombre: ${businessName || 'No especificado'}\n` +
      `- NIT: ${businessNit || 'No registrado'}\n` +
      `- ID Stocky: ${businessId}\n` +
      `${message ? `\nNota: ${message}\n` : ''}` +
      `\nQuedo atento a su respuesta.\n\nGracias.`
    )
    window.open(`mailto:${STOCKY_EMAIL}?subject=${subject}&body=${body}`, '_blank')
  }

  const handleSubmitRequest = async () => {
    setSending(true)
    setError('')
    
    try {
      // Guardar solicitud en la base de datos
      const { error: dbError } = await supabase
        .from('invoicing_requests')
        .insert({
          business_id: businessId,
          status: 'pending',
          nit_provided: businessNit || null,
          contact_method: contactMethod,
          message: message || null,
        })

      if (dbError) {
        // Si ya existe una solicitud pendiente
        if (dbError.code === '23505') {
          setError('Ya tienes una solicitud pendiente de revision')
          setSending(false)
          return
        }
        console.error('Error guardando solicitud:', dbError)
        // Continuar con WhatsApp/Email aunque falle la BD
      }

      // Abrir WhatsApp o Email
      if (contactMethod === 'whatsapp') {
        handleContactWhatsApp()
      } else {
        handleContactEmail()
      }
      
      setRequestSent(true)
      
    } catch (err) {
      console.error('Error:', err)
      // Continuar con contacto aunque falle
      if (contactMethod === 'whatsapp') {
        handleContactWhatsApp()
      } else {
        handleContactEmail()
      }
      setRequestSent(true)
    } finally {
      setSending(false)
    }
  }

  if (requestSent) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            ¡Solicitud enviada!
          </h2>
          
          <p className="text-gray-600 mb-6">
            Nuestro equipo revisará tu solicitud y te contactará pronto para activar 
            la facturación electrónica en tu negocio.
          </p>

          <div className="p-4 bg-blue-50 rounded-xl mb-6">
            <div className="flex items-center gap-2 text-blue-800">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Tiempo de respuesta: 24-48 horas hábiles</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            Cerrar
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-gray-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/30 rounded-lg backdrop-blur-sm">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold">Solicitar Facturacion Electronica</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}        {/* Content */}
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Columna izquierda */}
            <div className="space-y-4">
              {/* Beneficios compactos */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">Facturas válidas DIAN con CUFE</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-700">Envío automático de PDF al cliente</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-gray-700">Incluido en tu plan de Stocky</span>
                </div>
              </div>

              {/* Datos del negocio */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Tu negocio
                </h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nombre:</span>
                    <span className="font-medium text-gray-800">{businessName || 'No especificado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">NIT:</span>
                    <span className="font-medium text-gray-800">{businessNit || 'No registrado'}</span>
                  </div>
                </div>
                {!businessNit && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Recuerda registrar tu NIT
                  </p>
                )}
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-4">
              {/* Método de contacto */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">¿Cómo prefieres contactarnos?</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setContactMethod('whatsapp')}
                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                      contactMethod === 'whatsapp'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <MessageCircle className={`w-5 h-5 ${
                      contactMethod === 'whatsapp' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      contactMethod === 'whatsapp' ? 'text-green-700' : 'text-gray-600'
                    }`}>WhatsApp</span>
                  </button>
                  
                  <button
                    onClick={() => setContactMethod('email')}
                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                      contactMethod === 'email'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Mail className={`w-5 h-5 ${
                      contactMethod === 'email' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      contactMethod === 'email' ? 'text-blue-700' : 'text-gray-600'
                    }`}>Email</span>
                  </button>
                </div>
              </div>

              {/* Mensaje adicional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje (opcional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="¿Alguna pregunta?"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                />
              </div>

              {/* Botón de enviar */}
              <button
                onClick={handleSubmitRequest}
                disabled={sending}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  contactMethod === 'whatsapp'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } ${sending ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Abriendo...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {contactMethod === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir Email'}
                  </>
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                Te responderemos en máximo 48h
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
