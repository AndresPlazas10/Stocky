// ============================================
// ⚙️ Componente de Configuración Siigo
// ============================================
// Ubicación: src/components/Settings/SiigoConfiguration.jsx
// 
// Panel de administración para configurar las
// credenciales de Siigo y ver estado de facturación

import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/Client'
import { siigoService } from '../../services/siigoService'

// Iconos (usando emojis para simplicidad, reemplazar con tu librería de iconos)
const Icons = {
  check: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
  lock: '🔒',
  calendar: '📅',
}

export default function SiigoConfiguration({ businessId }) {
  // Estados
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState({
    siigo_username: '',
    siigo_access_key: '',
    is_enabled: false,
    is_production: false,
    resolution_number: '',
    resolution_prefix: '',
    resolution_from: '',
    resolution_to: '',
    resolution_valid_from: '',
    resolution_valid_to: '',
  })
  const [status, setStatus] = useState(null)
  const [stats, setStats] = useState(null)
  const [message, setMessage] = useState(null)
  const [showAccessKey, setShowAccessKey] = useState(false)

  // Cargar configuración existente
  useEffect(() => {
    loadConfiguration()
    loadStats()
  }, [businessId])

  const loadConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('business_siigo_credentials')
        .select('*')
        .eq('business_id', businessId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setCredentials({
          siigo_username: data.siigo_username || '',
          siigo_access_key: data.siigo_access_key || '',
          is_enabled: data.is_enabled || false,
          is_production: data.is_production || false,
          resolution_number: data.resolution_number || '',
          resolution_prefix: data.resolution_prefix || '',
          resolution_from: data.resolution_from?.toString() || '',
          resolution_to: data.resolution_to?.toString() || '',
          resolution_valid_from: data.resolution_valid_from || '',
          resolution_valid_to: data.resolution_valid_to || '',
        })
        setStatus('configured')
      } else {
        setStatus('not_configured')
      }
    } catch (error) {
      console.error('Error cargando configuración:', error)
      setMessage({ type: 'error', text: 'Error cargando configuración' })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const today = new Date()
    const fromDate = new Date(today.getFullYear(), today.getMonth(), 1)
    
    const data = await siigoService.getInvoiceStats(
      businessId,
      fromDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    )
    
    if (data) setStats(data)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      // Validar campos requeridos si está habilitado
      if (credentials.is_enabled) {
        if (!credentials.siigo_username || !credentials.siigo_access_key) {
          throw new Error('Usuario y clave de acceso son requeridos')
        }
      }

      const payload = {
        business_id: businessId,
        siigo_username: credentials.siigo_username,
        siigo_access_key: credentials.siigo_access_key,
        is_enabled: credentials.is_enabled,
        is_production: credentials.is_production,
        resolution_number: credentials.resolution_number || null,
        resolution_prefix: credentials.resolution_prefix || null,
        resolution_from: credentials.resolution_from ? parseInt(credentials.resolution_from) : null,
        resolution_to: credentials.resolution_to ? parseInt(credentials.resolution_to) : null,
        resolution_valid_from: credentials.resolution_valid_from || null,
        resolution_valid_to: credentials.resolution_valid_to || null,
      }

      const { error } = await supabase
        .from('business_siigo_credentials')
        .upsert(payload, { onConflict: 'business_id' })

      if (error) throw error

      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      setStatus('configured')
    } catch (error) {
      console.error('Error guardando:', error)
      setMessage({ type: 'error', text: error.message || 'Error guardando configuración' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setSaving(true)
    setMessage({ type: 'info', text: 'Probando conexión con Siigo...' })

    try {
      // Crear una factura de prueba (se puede implementar un endpoint de test)
      const result = await siigoService.canBusinessInvoice(businessId)
      
      if (result.canInvoice) {
        setMessage({ type: 'success', text: 'Conexión exitosa con Siigo' })
      } else {
        setMessage({ type: 'warning', text: result.message || 'No se pudo verificar la conexión' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error probando conexión: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  // Verificar si la resolución está próxima a vencer
  const isResolutionExpiringSoon = () => {
    if (!credentials.resolution_valid_to) return false
    const expiryDate = new Date(credentials.resolution_valid_to)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const isResolutionExpired = () => {
    if (!credentials.resolution_valid_to) return false
    return new Date(credentials.resolution_valid_to) < new Date()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Configuración Siigo</h2>
          <p className="text-sm text-gray-500">
            Facturación electrónica DIAN
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'configured' && credentials.is_enabled && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {Icons.check} Activo
            </span>
          )}
          {status === 'configured' && !credentials.is_enabled && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              {Icons.warning} Deshabilitado
            </span>
          )}
          {status === 'not_configured' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {Icons.info} Sin configurar
            </span>
          )}
        </div>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          message.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Alertas de resolución */}
      {isResolutionExpired() && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
          {Icons.error} <strong>¡Resolución vencida!</strong> La resolución de facturación ha expirado. 
          Debes renovarla en la DIAN antes de poder facturar.
        </div>
      )}
      
      {isResolutionExpiringSoon() && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          {Icons.warning} <strong>Resolución próxima a vencer.</strong> Tu resolución de facturación 
          vence el {new Date(credentials.resolution_valid_to).toLocaleDateString('es-CO')}.
        </div>
      )}

      {/* Estadísticas del mes */}
      {stats && credentials.is_enabled && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-2xl font-bold text-primary">{stats.total_invoices}</div>
            <div className="text-sm text-gray-500">Facturas del mes</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats.successful_invoices}</div>
            <div className="text-sm text-gray-500">Exitosas</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-2xl font-bold text-red-600">{stats.failed_invoices}</div>
            <div className="text-sm text-gray-500">Con error</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-2xl font-bold text-blue-600">
              ${stats.total_amount?.toLocaleString('es-CO') || 0}
            </div>
            <div className="text-sm text-gray-500">Total facturado</div>
          </div>
        </div>
      )}

      {/* Formulario de configuración */}
      <form onSubmit={handleSave} className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
        
        {/* Credenciales API */}
        <div className="space-y-4">
          <h3 className="font-medium text-lg border-b pb-2">
            {Icons.lock} Credenciales API Siigo
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario API (Email)
              </label>
              <input
                type="email"
                value={credentials.siigo_username}
                onChange={(e) => setCredentials({...credentials, siigo_username: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="usuario@empresa.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clave de Acceso API
              </label>
              <div className="relative">
                <input
                  type={showAccessKey ? 'text' : 'password'}
                  value={credentials.siigo_access_key}
                  onChange={(e) => setCredentials({...credentials, siigo_access_key: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessKey(!showAccessKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showAccessKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={credentials.is_enabled}
                onChange={(e) => setCredentials({...credentials, is_enabled: e.target.checked})}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              <span className="text-sm">Habilitar facturación electrónica</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={credentials.is_production}
                onChange={(e) => setCredentials({...credentials, is_production: e.target.checked})}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              <span className="text-sm">Ambiente de producción</span>
            </label>
          </div>
        </div>

        {/* Resolución DIAN */}
        <div className="space-y-4">
          <h3 className="font-medium text-lg border-b pb-2">
            {Icons.calendar} Resolución DIAN
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Resolución
              </label>
              <input
                type="text"
                value={credentials.resolution_number}
                onChange={(e) => setCredentials({...credentials, resolution_number: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="18764000001234"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prefijo
              </label>
              <input
                type="text"
                value={credentials.resolution_prefix}
                onChange={(e) => setCredentials({...credentials, resolution_prefix: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="SETT"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desde
                </label>
                <input
                  type="number"
                  value={credentials.resolution_from}
                  onChange={(e) => setCredentials({...credentials, resolution_from: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hasta
                </label>
                <input
                  type="number"
                  value={credentials.resolution_to}
                  onChange={(e) => setCredentials({...credentials, resolution_to: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="5000"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha inicio vigencia
              </label>
              <input
                type="date"
                value={credentials.resolution_valid_from}
                onChange={(e) => setCredentials({...credentials, resolution_valid_from: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha fin vigencia
              </label>
              <input
                type="date"
                value={credentials.resolution_valid_to}
                onChange={(e) => setCredentials({...credentials, resolution_valid_to: e.target.value})}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  isResolutionExpired() ? 'border-red-500 bg-red-50' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* Aviso legal */}
        {!credentials.is_enabled && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>{Icons.warning} Aviso:</strong> Mientras la facturación electrónica esté deshabilitada,
              los comprobantes generados serán solo <strong>documentos informativos</strong> sin validez
              fiscal ante la DIAN.
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-between items-center pt-4 border-t">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={saving || !credentials.siigo_username}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Probar conexión
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <span className="animate-spin">⏳</span>}
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>

      {/* Información adicional */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h4 className="font-medium mb-2">{Icons.info} ¿Cómo obtener credenciales Siigo?</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Ingresa a tu cuenta de <a href="https://www.siigo.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Siigo</a></li>
          <li>Ve a Configuración → API → Credenciales</li>
          <li>Genera una nueva clave de acceso si no tienes una</li>
          <li>Copia el usuario (tu email) y la clave de acceso</li>
          <li>Asegúrate de tener una resolución de facturación activa en la DIAN</li>
        </ol>
      </div>
    </div>
  )
}
