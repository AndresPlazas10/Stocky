// ============================================
// 🧾 Hook React para Facturación Siigo (DEPRECATED)
// ============================================
// Ubicación: src/hooks/useSiigoInvoice.js
// 
// ⚠️ DEPRECATED: Stocky ya NO es proveedor de facturación electrónica.
// Este hook está deprecado. Todas las funciones retornan estado deshabilitado.

import { useState, useCallback } from 'react'
import { ID_TYPES, PAYMENT_METHODS, TAX_RATES } from '../services/siigoService'

/**
 * ⚠️ DEPRECATED - Hook para facturación (ya no genera facturas electrónicas)
 * @param {string} businessId - ID del negocio
 * @returns {Object} Estado y funciones (todas deshabilitadas)
 */
export function useSiigoInvoice(businessId) {
  // Estados
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('La facturación electrónica a través de Stocky ya no está disponible')
  const [lastInvoice, setLastInvoice] = useState(null)
  const [canInvoice, setCanInvoice] = useState(false)

  /**
   * ⚠️ DEPRECATED - Siempre retorna false
   */
  const checkCanInvoice = useCallback(async () => {
    return false
  }, [])

  /**
   * ⚠️ DEPRECATED - Siempre retorna error
   */
  const createInvoice = useCallback(async (invoiceData) => {
    return {
      success: false,
      isInformativeOnly: true,
      error: 'La facturación electrónica a través de Stocky ya no está disponible',
      message: '⚠️ Los negocios deben facturar directamente en Siigo (incluido en su plan).',
    }
  }, [])

  /**
   * ⚠️ DEPRECATED - Siempre retorna error
   */
  const createInvoiceFromSale = useCallback(async (sale, customer) => {
    return {
      success: false,
      isInformativeOnly: true,
      error: 'La facturación electrónica a través de Stocky ya no está disponible',
      message: '⚠️ Los negocios deben facturar directamente en Siigo.',
    }
  }, [])

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
    loading: false,
    error,
    lastInvoice: null,
    canInvoice: false,

    // Funciones
    checkCanInvoice,
    createInvoice,
    createInvoiceFromSale,
    clearError,
    clearLastInvoice,

    // Constantes útiles (se mantienen por compatibilidad)
    ID_TYPES,
    PAYMENT_METHODS,
    TAX_RATES,
  }
}

/**
 * ⚠️ DEPRECATED - Hook para historial (ya no consulta DB)
 * @param {string} businessId - ID del negocio
 * @returns {Object} Estado vacío
 */
export function useSiigoHistory(businessId) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    total_invoices: 0,
    successful_invoices: 0,
    failed_invoices: 0,
    total_amount: 0,
  })

  /**
   * ⚠️ DEPRECATED - Ya no carga historial
   */
  const loadHistory = useCallback(async (options = {}) => {
    setInvoices([])
  }, [])

  /**
   * ⚠️ DEPRECATED - Ya no carga estadísticas
   */
  const loadStats = useCallback(async (fromDate, toDate) => {
    setStats({
      total_invoices: 0,
      successful_invoices: 0,
      failed_invoices: 0,
      total_amount: 0,
    })
  }, [])

  return {
    invoices: [],
    loading: false,
    stats,
    loadHistory,
    loadStats,
  }
}

/**
 * Hook para gestionar las ciudades DANE (se mantiene funcional)
 * @returns {Object} Estado y funciones para ciudades
 */
export function useDaneCities() {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false)

  /**
   * Busca ciudades por nombre (aún funcional - tabla no deprecada)
   */
  const searchCities = useCallback(async (term) => {
    setLoading(true)
    try {
      // Nota: dane_cities no está deprecada, se mantiene funcional
      const { supabase } = await import('../supabase/Client')
      let query = supabase
        .from('dane_cities')
        .select('city_code, city_name, department_name')
        .order('city_name')
        .limit(50)

      if (term) {
        query = query.ilike('city_name', `%${term}%`)
      }

      const { data } = await query
      setCities(data || [])
    } catch (error) {
      setCities([])
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
