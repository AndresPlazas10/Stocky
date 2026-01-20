// ============================================
// 🧾 Context para Facturación (DEPRECATED)
// ============================================
// Ubicación: src/context/InvoicingContext.jsx
// 
// ⚠️ DEPRECATED: Stocky ya NO es proveedor de facturación electrónica.
// Este contexto siempre retorna estado deshabilitado.
// Los negocios facturan directamente en Siigo (incluido en su plan).

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/Client'

// Contexto
const InvoicingContext = createContext(null)

// Hook para usar el contexto
export function useInvoicing() {
  const context = useContext(InvoicingContext)
  if (!context) {
    throw new Error('useInvoicing debe usarse dentro de InvoicingProvider')
  }
  return context
}

// Provider
export function InvoicingProvider({ children, businessId }) {
  // Estado principal
  const [invoicingStatus, setInvoicingStatus] = useState({
    isLoading: true,
    // Estado de facturación (desde businesses)
    isEnabled: false,              // businesses.invoicing_enabled
    provider: null,                // businesses.invoicing_provider
    activatedAt: null,             // businesses.invoicing_activated_at
    // Estado de configuración (desde business_siigo_credentials)
    isConfigured: false,           // Tiene credenciales
    isProduction: false,           // Ambiente producción
    resolutionNumber: null,        // Número de resolución DIAN
    resolutionExpired: false,      // ¿Resolución vencida?
    resolutionExpiringSoon: false, // ¿Próxima a vencer?
    daysUntilExpiry: null,
    // Estado de solicitud
    hasPendingRequest: false,      // Tiene solicitud pendiente
    requestStatus: null,           // pending, approved, rejected
    requestDate: null,             // Fecha de solicitud
    // Error
    error: null,
  })

  // ⚠️ DEPRECATED: Ya no consulta DB, siempre retorna estado deshabilitado
  const loadInvoicingStatus = useCallback(async () => {
    // Simular carga breve para mantener compatibilidad con UI
    await new Promise(resolve => setTimeout(resolve, 100))
    
    setInvoicingStatus({
      isLoading: false,
      isEnabled: false,              // Facturación siempre deshabilitada
      provider: null,
      activatedAt: null,
      isConfigured: false,
      isProduction: false,
      resolutionNumber: null,
      resolutionExpired: false,
      resolutionExpiringSoon: false,
      daysUntilExpiry: null,
      hasPendingRequest: false,
      requestStatus: null,
      requestDate: null,
      error: null,
    })
  }, [businessId])

  // Cargar al montar
  useEffect(() => {
    loadInvoicingStatus()
  }, [loadInvoicingStatus])

  // Función para refrescar el estado
  const refresh = useCallback(() => {
    setInvoicingStatus(prev => ({ ...prev, isLoading: true }))
    loadInvoicingStatus()
  }, [loadInvoicingStatus])

  // ⚠️ DEPRECATED: Ya no permite crear solicitudes
  const createRequest = useCallback(async (data = {}) => {
    return { 
      success: false, 
      error: 'La facturación electrónica a través de Stocky ya no está disponible. Los negocios deben facturar directamente en Siigo.' 
    }
  }, [])

  // Valor del contexto
  const value = {
    ...invoicingStatus,
    refresh,
    createRequest,
    // ⚠️ DEPRECATED: Siempre false - Stocky ya no genera facturas electrónicas
    canGenerateElectronicInvoice: false,
  }

  return (
    <InvoicingContext.Provider value={value}>
      {children}
    </InvoicingContext.Provider>
  )
}

export default InvoicingContext
