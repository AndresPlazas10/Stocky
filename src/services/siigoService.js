// ============================================
// 🧾 Cliente Siigo para Frontend (DEPRECATED)
// ============================================
// Ubicación: src/services/siigoService.js
// 
// ⚠️ DEPRECATED: Stocky ya NO es proveedor de facturación electrónica.
// Este servicio está deprecado. Todas las funciones retornan estado deshabilitado.
// Los negocios facturan directamente en Siigo (incluido en su plan).

import { supabase } from '../supabase/Client'

// ============================================
// CONSTANTES
// ============================================

// URL de la Edge Function (se configura según ambiente)
const SIIGO_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/siigo-invoice'

// Tipos de documento de identidad Colombia
export const ID_TYPES = {
  CC: { code: 'CC', name: 'Cédula de Ciudadanía' },
  NIT: { code: 'NIT', name: 'NIT' },
  CE: { code: 'CE', name: 'Cédula de Extranjería' },
  PP: { code: 'PP', name: 'Pasaporte' },
  TI: { code: 'TI', name: 'Tarjeta de Identidad' },
}

// Métodos de pago
export const PAYMENT_METHODS = {
  CASH: { code: 'CASH', name: 'Efectivo' },
  CREDIT_CARD: { code: 'CREDIT_CARD', name: 'Tarjeta de Crédito' },
  DEBIT_CARD: { code: 'DEBIT_CARD', name: 'Tarjeta Débito' },
  TRANSFER: { code: 'TRANSFER', name: 'Transferencia' },
  CREDIT: { code: 'CREDIT', name: 'Crédito' },
}

// Porcentajes de IVA válidos en Colombia
export const TAX_RATES = [
  { value: 0, label: 'Exento (0%)' },
  { value: 5, label: 'IVA 5%' },
  { value: 19, label: 'IVA 19%' },
]

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export const siigoService = {
  /**
   * ⚠️ DEPRECATED - Siempre retorna false
   * @param {string} businessId - ID del negocio
   * @returns {Promise<{canInvoice: boolean, message?: string}>}
   */
  async canBusinessInvoice(businessId) {
    return {
      canInvoice: false,
      message: 'Stocky ya no es proveedor de facturación electrónica. Los negocios facturan directamente en Siigo.',
    }
  },

  /**
   * ⚠️ DEPRECATED - Ya no genera facturas electrónicas
   * @param {Object} invoiceData - Datos de la factura
   * @returns {Promise<Object>} Siempre retorna error
   */
  async createInvoice(invoiceData) {
    return {
      success: false,
      isInformativeOnly: true,
      error: 'La facturación electrónica a través de Stocky ya no está disponible',
      message: '⚠️ Los negocios deben facturar directamente en Siigo (incluido en su plan).',
    }
  },

  /**
   * Valida los datos de la factura antes de enviar
   * @param {Object} data - Datos de la factura
   * @returns {Array<string>} Array de errores de validación
   */
  validateInvoiceData(data) {
    const errors = []

    // Validar business_id
    if (!data.business_id) {
      errors.push('ID del negocio es requerido')
    }

    // Validar cliente
    if (!data.customer) {
      errors.push('Datos del cliente son requeridos')
    } else {
      if (!data.customer.identification) {
        errors.push('Número de documento del cliente es requerido')
      }
      if (!data.customer.id_type || !ID_TYPES[data.customer.id_type]) {
        errors.push('Tipo de documento del cliente inválido')
      }
      if (!data.customer.name || data.customer.name.length < 2) {
        errors.push('Nombre del cliente es requerido (mínimo 2 caracteres)')
      }
      if (!data.customer.email || !data.customer.email.includes('@')) {
        errors.push('Email del cliente inválido')
      }
      if (!data.customer.address) {
        errors.push('Dirección del cliente es requerida')
      }
      if (!data.customer.city_code) {
        errors.push('Ciudad del cliente es requerida')
      }
      if (data.customer.id_type === 'NIT' && !data.customer.check_digit) {
        errors.push('El NIT requiere dígito de verificación')
      }
    }

    // Validar items
    if (!data.items || data.items.length === 0) {
      errors.push('La factura debe tener al menos un producto')
    } else {
      data.items.forEach((item, index) => {
        if (!item.code) errors.push(`Producto ${index + 1}: código requerido`)
        if (!item.description) errors.push(`Producto ${index + 1}: descripción requerida`)
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Producto ${index + 1}: cantidad debe ser mayor a 0`)
        }
        if (item.unit_price === undefined || item.unit_price < 0) {
          errors.push(`Producto ${index + 1}: precio inválido`)
        }
        if (![0, 5, 19].includes(item.tax_percentage)) {
          errors.push(`Producto ${index + 1}: IVA debe ser 0%, 5% o 19%`)
        }
      })
    }

    // Validar pago
    if (!data.payment) {
      errors.push('Datos de pago son requeridos')
    } else {
      if (!data.payment.method || !PAYMENT_METHODS[data.payment.method]) {
        errors.push('Método de pago inválido')
      }
      if (!data.payment.value || data.payment.value <= 0) {
        errors.push('Valor del pago debe ser mayor a 0')
      }
    }

    return errors
  },

  /**
   * Prepara los datos de una venta para facturación
   * @param {Object} sale - Datos de la venta desde el POS
   * @param {Object} customer - Datos del cliente
   * @param {string} businessId - ID del negocio
   * @returns {Object} Datos formateados para la Edge Function
   */
  prepareSaleForInvoice(sale, customer, businessId) {
    return {
      business_id: businessId,
      customer: {
        identification: customer.document_number,
        id_type: customer.document_type || 'CC',
        name: customer.name,
        email: customer.email,
        address: customer.address || 'Sin dirección',
        city_code: customer.city_code || 11001, // Bogotá por defecto
        phone: customer.phone,
        check_digit: customer.check_digit,
      },
      items: sale.items.map(item => ({
        code: item.product_code || item.sku || `PROD-${item.product_id}`,
        description: item.product_name || item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_percentage: item.tax_percentage || 19,
        discount_percentage: item.discount_percentage || 0,
      })),
      payment: {
        method: this.mapPaymentMethod(sale.payment_method),
        value: sale.total,
        due_date: sale.due_date || null,
      },
      observations: sale.notes || 'Gracias por su compra',
    }
  },

  /**
   * Mapea el método de pago del POS al formato Siigo
   */
  mapPaymentMethod(method) {
    const mapping = {
      'cash': 'CASH',
      'efectivo': 'CASH',
      'card': 'CREDIT_CARD',
      'tarjeta': 'CREDIT_CARD',
      'credit_card': 'CREDIT_CARD',
      'debit_card': 'DEBIT_CARD',
      'transfer': 'TRANSFER',
      'transferencia': 'TRANSFER',
      'credit': 'CREDIT',
      'credito': 'CREDIT',
    }
    return mapping[method?.toLowerCase()] || 'CASH'
  },

  /**
   * ⚠️ DEPRECATED - Ya no consulta historial
   * @param {string} businessId - ID del negocio
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Siempre retorna array vacío
   */
  async getInvoiceHistory(businessId, options = {}) {
    return []
  },

  /**
   * ⚠️ DEPRECATED - Ya no consulta estadísticas
   * @param {string} businessId - ID del negocio
   * @param {string} fromDate - Fecha inicio (YYYY-MM-DD)
   * @param {string} toDate - Fecha fin (YYYY-MM-DD)
   * @returns {Promise<Object>} Siempre retorna estadísticas en cero
   */
  async getInvoiceStats(businessId, fromDate, toDate) {
    return {
      total_invoices: 0,
      successful_invoices: 0,
      failed_invoices: 0,
      total_amount: 0,
    }
  },

  /**
   * Obtiene las ciudades DANE disponibles
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Promise<Array>} Lista de ciudades
   */
  async getCities(searchTerm = '') {
    try {
      let query = supabase
        .from('dane_cities')
        .select('city_code, city_name, department_name')
        .order('city_name')
        .limit(50)

      if (searchTerm) {
        query = query.ilike('city_name', `%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) throw error

      return data
    } catch (error) {
      return []
    }
  },

  /**
   * ⚠️ DEPRECATED - Ya no consulta credenciales
   * @param {string} businessId - ID del negocio
   * @returns {Promise<Object>} Siempre retorna no configurado
   */
  async getCredentialsStatus(businessId) {
    return { 
      configured: false,
      message: 'Stocky ya no gestiona credenciales Siigo. Los negocios deben configurar Siigo directamente.',
    }
  },
}

export default siigoService
