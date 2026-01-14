// ============================================
// 🧾 Context para Facturación Electrónica
// ============================================
// Ubicación: src/context/InvoicingContext.jsx
// 
// Maneja el estado global de facturación electrónica
// Modelo: Activación administrada por equipo Stocky

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

  // Cargar estado de facturación del negocio
  const loadInvoicingStatus = useCallback(async () => {
    if (!businessId) {
      setInvoicingStatus(prev => ({ ...prev, isLoading: false }))
      return
    }

    try {
      // 1. Cargar estado del negocio
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('invoicing_enabled, invoicing_provider, invoicing_activated_at')
        .eq('id', businessId)
        .maybeSingle()

      if (businessError) throw businessError

      // 2. Cargar solicitud pendiente si existe
      const { data: requestData } = await supabase
        .from('invoicing_requests')
        .select('id, status, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // 3. Cargar credenciales Siigo si facturación está activa
      let credentialsData = null
      if (businessData?.invoicing_enabled) {
        const { data: creds } = await supabase
          .from('business_siigo_credentials')
          .select('is_enabled, is_production, resolution_number, resolution_valid_to')
          .eq('business_id', businessId)
          .maybeSingle()

        credentialsData = creds
      }

      // Verificar vencimiento de resolución
      let isExpired = false
      let daysUntilExpiry = null
      let isExpiringSoon = false

      if (credentialsData?.resolution_valid_to) {
        const today = new Date()
        const resolutionValidTo = new Date(credentialsData.resolution_valid_to)
        isExpired = resolutionValidTo < today
        daysUntilExpiry = Math.ceil((resolutionValidTo - today) / (1000 * 60 * 60 * 24))
        isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30
      }

      // Determinar estado de solicitud
      const hasPendingRequest = requestData?.status === 'pending'
      const requestStatus = requestData?.status || null
      const requestDate = requestData?.created_at || null

      setInvoicingStatus({
        isLoading: false,
        // Desde businesses
        isEnabled: businessData?.invoicing_enabled || false,
        provider: businessData?.invoicing_provider || null,
        activatedAt: businessData?.invoicing_activated_at || null,
        // Desde credenciales
        isConfigured: !!credentialsData,
        isProduction: credentialsData?.is_production || false,
        resolutionNumber: credentialsData?.resolution_number || null,
        resolutionExpired: isExpired,
        resolutionExpiringSoon: isExpiringSoon,
        daysUntilExpiry,
        // Solicitud
        hasPendingRequest,
        requestStatus,
        requestDate,
        // Sin error
        error: null,
      })

    } catch (error) {
      console.error('Error cargando estado de facturación:', error)
      setInvoicingStatus({
        isLoading: false,
        isEnabled: false,
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
        error: error.message,
      })
    }
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

  // Crear solicitud de activación
  const createRequest = useCallback(async (data = {}) => {
    if (!businessId) {
      return { success: false, error: 'No hay negocio seleccionado' }
    }

    try {
      const { error } = await supabase
        .from('invoicing_requests')
        .insert({
          business_id: businessId,
          status: 'pending',
          nit_provided: data.nit || null,
          razon_social_provided: data.razonSocial || null,
          contact_method: data.contactMethod || 'whatsapp',
          message: data.message || null,
        })

      if (error) {
        // Si ya existe una solicitud pendiente
        if (error.code === '23505') {
          return { success: false, error: 'Ya tienes una solicitud pendiente' }
        }
        throw error
      }

      // Refrescar estado
      await loadInvoicingStatus()

      return { success: true }
    } catch (error) {
      console.error('Error creando solicitud:', error)
      return { success: false, error: error.message }
    }
  }, [businessId, loadInvoicingStatus])

  // Valor del contexto
  const value = {
    ...invoicingStatus,
    refresh,
    createRequest,
    // Helper para saber si puede facturar
    canGenerateElectronicInvoice: invoicingStatus.isEnabled && 
                                   invoicingStatus.isConfigured && 
                                   !invoicingStatus.resolutionExpired,
  }

  return (
    <InvoicingContext.Provider value={value}>
      {children}
    </InvoicingContext.Provider>
  )
}

export default InvoicingContext
