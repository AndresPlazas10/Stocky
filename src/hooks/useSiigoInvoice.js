// ============================================
// 🧾 Hook React para Facturación Siigo
// ============================================
// Ubicación: src/hooks/useSiigoInvoice.js
// 
// Hook personalizado para manejar la facturación electrónica
// con Siigo desde componentes React

import { useState, useCallback } from 'react'
import { siigoService, ID_TYPES, PAYMENT_METHODS, TAX_RATES } from '../services/siigoService'

/**
 * Hook para manejar la generación de facturas electrónicas
 * @param {string} businessId - ID del negocio
 * @returns {Object} Estado y funciones para facturación
 */
export function useSiigoInvoice(businessId) {
  // Estados
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [canInvoice, setCanInvoice] = useState(null)

  /**
   * Verifica si el negocio puede facturar electrónicamente
   */
  const checkCanInvoice = useCallback(async () => {
    if (!businessId) return false

    const result = await siigoService.canBusinessInvoice(businessId)
    setCanInvoice(result.canInvoice)
    return result.canInvoice
  }, [businessId])

  /**
   * Genera una factura electrónica
   * @param {Object} invoiceData - Datos de la factura
   * @returns {Promise<Object>} Resultado de la facturación
   */
  const createInvoice = useCallback(async (invoiceData) => {
    setLoading(true)
    setError(null)

    try {
      const result = await siigoService.createInvoice({
        ...invoiceData,
        business_id: businessId,
      })

      if (result.success) {
        setLastInvoice(result)
      } else {
        setError(result.error)
      }

      return result
    } catch (err) {
      const errorMessage = err.message || 'Error desconocido'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [businessId])

  /**
   * Genera factura desde una venta del POS
   * @param {Object} sale - Datos de la venta
   * @param {Object} customer - Datos del cliente
   * @returns {Promise<Object>} Resultado de la facturación
   */
  const createInvoiceFromSale = useCallback(async (sale, customer) => {
    const invoiceData = siigoService.prepareSaleForInvoice(sale, customer, businessId)
    return createInvoice(invoiceData)
  }, [businessId, createInvoice])

  /**
   * Limpia el estado de error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Limpia la última factura
   */
  const clearLastInvoice = useCallback(() => {
    setLastInvoice(null)
  }, [])

  return {
    // Estados
    loading,
    error,
    lastInvoice,
    canInvoice,

    // Funciones
    checkCanInvoice,
    createInvoice,
    createInvoiceFromSale,
    clearError,
    clearLastInvoice,

    // Constantes útiles
    ID_TYPES,
    PAYMENT_METHODS,
    TAX_RATES,
  }
}

/**
 * Hook para obtener el historial de facturas
 * @param {string} businessId - ID del negocio
 * @returns {Object} Estado y funciones para historial
 */
export function useSiigoHistory(businessId) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)

  /**
   * Carga el historial de facturas
   */
  const loadHistory = useCallback(async (options = {}) => {
    if (!businessId) return

    setLoading(true)
    try {
      const data = await siigoService.getInvoiceHistory(businessId, options)
      setInvoices(data)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  /**
   * Carga las estadísticas de facturación
   */
  const loadStats = useCallback(async (fromDate, toDate) => {
    if (!businessId) return

    const data = await siigoService.getInvoiceStats(businessId, fromDate, toDate)
    setStats(data)
  }, [businessId])

  return {
    invoices,
    loading,
    stats,
    loadHistory,
    loadStats,
  }
}

/**
 * Hook para gestionar las ciudades DANE
 * @returns {Object} Estado y funciones para ciudades
 */
export function useDaneCities() {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false)

  /**
   * Busca ciudades por nombre
   */
  const searchCities = useCallback(async (term) => {
    setLoading(true)
    try {
      const data = await siigoService.getCities(term)
      setCities(data)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    cities,
    loading,
    searchCities,
  }
}

export default useSiigoInvoice
