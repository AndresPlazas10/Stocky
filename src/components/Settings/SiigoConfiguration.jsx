// ============================================
// ⚙️ Configuración Siigo (DEPRECATED)
// ============================================
// Ubicación: src/components/Settings/SiigoConfiguration.jsx
// 
// ⚠️ DEPRECATED: Stocky ya NO es proveedor de facturación electrónica.
// Este componente muestra solo un mensaje informativo.

export default function SiigoConfiguration({ businessId }) {
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            ⚠️ No disponible
          </span>
        </div>
      </div>

      {/* Mensaje principal de deprecación */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <span className="text-4xl">ℹ️</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Facturación Electrónica a través de Siigo
            </h3>
            <p className="text-blue-800 mb-4">
              <strong>Stocky ya no es proveedor de facturación electrónica.</strong> Los negocios deben 
              facturar directamente en Siigo, que está incluido en su plan.
            </p>
            <div className="space-y-2 text-blue-700">
              <p className="font-medium">✅ Ventajas de facturar directamente en Siigo:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Ya incluido en tu plan de Siigo</li>
                <li>Integración completa con contabilidad</li>
                <li>Resolución DIAN administrada directamente</li>
                <li>Soporte técnico directo de Siigo</li>
                <li>Todas las funcionalidades de facturación electrónica</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <h3 className="font-medium text-lg border-b pb-2">
          📋 Cómo facturar en Siigo
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Ingresa a tu cuenta de <a href="https://www.siigo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Siigo</a></li>
          <li>Si no tienes cuenta, <a href="https://www.siigo.com/registro" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">regístrate aquí</a></li>
          <li>Configura tu resolución de facturación DIAN en Siigo</li>
          <li>Crea tus facturas electrónicas directamente desde Siigo</li>
          <li>Lleva tu contabilidad y facturación en un solo lugar</li>
        </ol>
      </div>

      {/* Información sobre comprobantes en Stocky */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <span className="text-3xl">📄</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              Comprobantes informativos en Stocky
            </h3>
            <p className="text-amber-800">
              Stocky sigue generando <strong>comprobantes informativos de venta</strong> para tus clientes. 
              Estos comprobantes NO constituyen factura electrónica válida ante la DIAN, pero sirven como 
              recibo de compra para tus clientes.
            </p>
          </div>
        </div>
      </div>

      {/* Ayuda y soporte */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h4 className="font-medium mb-2">❓ ¿Necesitas ayuda?</h4>
        <p>
          Si tienes dudas sobre cómo configurar la facturación electrónica en Siigo, 
          contacta al soporte de Siigo o consulta su{' '}
          <a 
            href="https://ayuda.siigo.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 underline hover:text-blue-800"
          >
            centro de ayuda
          </a>.
        </p>
      </div>
    </div>
  )
}
