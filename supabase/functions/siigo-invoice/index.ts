// ============================================
// 🧾 Supabase Edge Function - Integración Siigo
// Facturación Electrónica DIAN Colombia
// ============================================
// Ubicación: supabase/functions/siigo-invoice/index.ts
// 
// ⚠️ ⚠️ ⚠️ ADVERTENCIA IMPORTANTE ⚠️ ⚠️ ⚠️
// 
// ESTA INTEGRACIÓN FUE DESHABILITADA POR DECISIÓN DE NEGOCIO
// 
// Razones:
// 1. Costos operativos elevados (API Siigo: $200-500 USD/mes)
// 2. Complejidad técnica y legal innecesaria
// 3. Riesgo de responsabilidad fiscal ante DIAN
// 4. Obligaciones de custodia de documentos (10 años)
// 
// Modelo actual (Enero 2026):
// - Stocky NO emite facturas electrónicas
// - Solo genera comprobantes informativos (sin validez DIAN)
// - Cada negocio factura directamente en Siigo (plan incluido)
// - Responsabilidad fiscal 100% del comercio
// 
// Este código se mantiene como referencia para posible
// implementación futura bajo condiciones diferentes.
// 
// NO USAR EN PRODUCCIÓN SIN REVISIÓN LEGAL Y ESTRATÉGICA
// ============================================
// 
// CONFIGURACIÓN REQUERIDA:
// supabase secrets set SIIGO_API_URL=https://api.siigo.com
// 
// Las credenciales de cada negocio se almacenan en la tabla
// business_siigo_credentials (encriptadas)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// TIPOS E INTERFACES
// ============================================

interface SiigoCredentials {
  username: string      // Usuario API Siigo (email)
  access_key: string    // Clave de acceso API
}

interface SiigoConfig {
  credentials: SiigoCredentials
  documentTypeId: number | null
  defaultSellerId: number | null
  // IDs de impuestos (varían por cuenta Siigo)
  taxIds: {
    iva0: number | null
    iva5: number | null
    iva19: number | null
  }
  // IDs de métodos de pago (varían por cuenta Siigo)
  paymentIds: {
    cash: number | null
    creditCard: number | null
    debitCard: number | null
    transfer: number | null
    credit: number | null
  }
}

interface SiigoTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface SiigoCustomer {
  identification: string    // Número de documento (NIT/CC/CE)
  check_digit?: string      // Dígito de verificación (para NIT)
  name: string[]            // [nombre, apellido] o [razón social]
  id_type: string           // 13=Cédula, 31=NIT, 22=Cédula extranjería
  address: {
    city: number            // Código DANE ciudad
    address: string
  }
  email: string
  phone?: {
    number: string
  }
}

interface SiigoProduct {
  code: string              // Código interno del producto
  description: string
  quantity: number
  price: number             // Precio unitario SIN IVA
  discount?: number         // Porcentaje descuento
  taxes: Array<{
    id: number              // ID impuesto en Siigo
    percentage?: number     // Si no usa ID, enviar porcentaje
  }>
}

interface SiigoPayment {
  id: number                // ID medio de pago Siigo
  value: number             // Valor pagado
  due_date?: string         // Fecha vencimiento (YYYY-MM-DD)
}

interface InvoiceRequest {
  business_id: string
  customer: {
    identification: string
    id_type: 'CC' | 'NIT' | 'CE' | 'PP' | 'TI'
    name: string
    email: string
    address: string
    city_code: number
    phone?: string
    check_digit?: string
    // Responsabilidad fiscal del cliente (opcional)
    // R-99-PN: No responsable IVA (default para personas)
    // O-13: Gran Contribuyente
    // O-15: Autorretenedor
    // O-23: Agente retenedor IVA
    // O-47: Régimen simple
    fiscal_responsibility?: string
  }
  items: Array<{
    code: string
    description: string
    quantity: number
    unit_price: number
    tax_percentage: number  // 0, 5 o 19 para IVA Colombia
    discount_percentage?: number
  }>
  payment: {
    method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'CREDIT'
    value: number
    due_date?: string
  }
  invoice_number?: string   // Si usa numeración manual
  observations?: string
  seller_id?: number        // ID vendedor en Siigo
}

interface InvoiceResponse {
  success: boolean
  siigo_id?: string
  invoice_number?: string
  cufe?: string
  qr_code?: string
  pdf_url?: string
  status?: string
  dian_status?: string
  error?: string
  error_code?: string
}

// ============================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================

const SIIGO_API_URL = Deno.env.get('SIIGO_API_URL') || 'https://api.siigo.com'

// Mapeo de tipos de documento Colombia
const ID_TYPE_MAP: Record<string, string> = {
  'CC': '13',    // Cédula de ciudadanía
  'NIT': '31',   // NIT
  'CE': '22',    // Cédula de extranjería
  'PP': '41',    // Pasaporte
  'TI': '12',    // Tarjeta de identidad
}

// NOTA: Los IDs de impuestos y métodos de pago varían por cuenta Siigo
// Se obtienen de la tabla business_siigo_credentials
// Estos son IDs de fallback que probablemente NO funcionarán
const FALLBACK_TAX_MAP: Record<number, number> = {
  0: 13156,   // Excluido/Exento (ID ejemplo)
  5: 13157,   // IVA 5% (ID ejemplo)
  19: 13155,  // IVA 19% (ID ejemplo)
}

const FALLBACK_PAYMENT_MAP: Record<string, number> = {
  'CASH': 4976,          // Efectivo (ID ejemplo)
  'CREDIT_CARD': 5636,   // Tarjeta crédito (ID ejemplo)
  'DEBIT_CARD': 5637,    // Tarjeta débito (ID ejemplo)
  'TRANSFER': 5074,      // Transferencia (ID ejemplo)
  'CREDIT': 5639,        // Crédito (ID ejemplo)
}

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// CACHÉ DE TOKENS (en memoria de la función)
// ============================================
// NOTA: En producción, considera usar Supabase cache o KV storage

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtiene las credenciales y configuración Siigo de un negocio desde Supabase
 * Las credenciales están encriptadas en la base de datos
 */
async function getBusinessSiigoConfig(
  supabase: any,
  businessId: string
): Promise<SiigoConfig | null> {
  const { data, error } = await supabase
    .from('business_siigo_credentials')
    .select(`
      siigo_username, 
      siigo_access_key, 
      is_enabled,
      document_type_id,
      default_seller_id,
      tax_id_iva_0,
      tax_id_iva_5,
      tax_id_iva_19,
      payment_id_cash,
      payment_id_credit_card,
      payment_id_debit_card,
      payment_id_transfer,
      payment_id_credit
    `)
    .eq('business_id', businessId)
    .single()

  if (error || !data) {
    console.error('Error obteniendo credenciales:', error)
    return null
  }

  // Verificar si el negocio está habilitado para facturación
  if (!data.is_enabled) {
    throw new Error('BUSINESS_NOT_ENABLED')
  }

  return {
    credentials: {
      username: data.siigo_username,
      access_key: data.siigo_access_key,
    },
    documentTypeId: data.document_type_id,
    defaultSellerId: data.default_seller_id,
    taxIds: {
      iva0: data.tax_id_iva_0,
      iva5: data.tax_id_iva_5,
      iva19: data.tax_id_iva_19,
    },
    paymentIds: {
      cash: data.payment_id_cash,
      creditCard: data.payment_id_credit_card,
      debitCard: data.payment_id_debit_card,
      transfer: data.payment_id_transfer,
      credit: data.payment_id_credit,
    },
  }
}

// Función helper para obtener ID de impuesto
function getTaxId(config: SiigoConfig, taxPercentage: number): number {
  switch (taxPercentage) {
    case 0:
      return config.taxIds.iva0 || FALLBACK_TAX_MAP[0]
    case 5:
      return config.taxIds.iva5 || FALLBACK_TAX_MAP[5]
    case 19:
      return config.taxIds.iva19 || FALLBACK_TAX_MAP[19]
    default:
      return config.taxIds.iva19 || FALLBACK_TAX_MAP[19]
  }
}

// Función helper para obtener ID de método de pago
function getPaymentId(config: SiigoConfig, method: string): number {
  switch (method) {
    case 'CASH':
      return config.paymentIds.cash || FALLBACK_PAYMENT_MAP['CASH']
    case 'CREDIT_CARD':
      return config.paymentIds.creditCard || FALLBACK_PAYMENT_MAP['CREDIT_CARD']
    case 'DEBIT_CARD':
      return config.paymentIds.debitCard || FALLBACK_PAYMENT_MAP['DEBIT_CARD']
    case 'TRANSFER':
      return config.paymentIds.transfer || FALLBACK_PAYMENT_MAP['TRANSFER']
    case 'CREDIT':
      return config.paymentIds.credit || FALLBACK_PAYMENT_MAP['CREDIT']
    default:
      return config.paymentIds.cash || FALLBACK_PAYMENT_MAP['CASH']
  }
}

/**
 * Autentica con la API de Siigo y obtiene token Bearer
 * Implementa caché de token para evitar autenticaciones innecesarias
 */
async function authenticateSiigo(
  credentials: SiigoCredentials,
  businessId: string
): Promise<string> {
  // Verificar caché
  const cached = tokenCache.get(businessId)
  if (cached && cached.expiresAt > Date.now()) {
    console.log('Usando token cacheado para negocio:', businessId)
    return cached.token
  }

  console.log('Solicitando nuevo token Siigo para negocio:', businessId)

  // Endpoint de autenticación Siigo
  const authUrl = `${SIIGO_API_URL}/auth`

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Partner-Id': 'stockly',  // ID de partner asignado por Siigo
    },
    body: JSON.stringify({
      username: credentials.username,
      access_key: credentials.access_key,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Error autenticación Siigo:', response.status, errorBody)
    
    if (response.status === 401) {
      throw new Error('SIIGO_AUTH_INVALID_CREDENTIALS')
    }
    throw new Error(`SIIGO_AUTH_ERROR: ${response.status}`)
  }

  const tokenData: SiigoTokenResponse = await response.json()

  // Cachear token (restar 5 minutos para renovar antes de expirar)
  const expiresAt = Date.now() + (tokenData.expires_in - 300) * 1000
  tokenCache.set(businessId, {
    token: tokenData.access_token,
    expiresAt,
  })

  console.log('Token Siigo obtenido exitosamente')
  return tokenData.access_token
}

/**
 * Valida los datos de la factura antes de enviar a Siigo
 */
function validateInvoiceRequest(request: InvoiceRequest): string[] {
  const errors: string[] = []

  // Validar cliente
  if (!request.customer.identification) {
    errors.push('El número de documento del cliente es requerido')
  }
  if (!request.customer.name) {
    errors.push('El nombre del cliente es requerido')
  }
  if (!request.customer.email || !request.customer.email.includes('@')) {
    errors.push('Email del cliente inválido')
  }
  if (!request.customer.address) {
    errors.push('La dirección del cliente es requerida')
  }

  // Validar NIT con dígito de verificación
  if (request.customer.id_type === 'NIT' && !request.customer.check_digit) {
    errors.push('El NIT requiere dígito de verificación')
  }

  // Validar items
  if (!request.items || request.items.length === 0) {
    errors.push('La factura debe tener al menos un producto')
  }

  request.items?.forEach((item, index) => {
    if (!item.code) errors.push(`Producto ${index + 1}: código requerido`)
    if (!item.description) errors.push(`Producto ${index + 1}: descripción requerida`)
    if (item.quantity <= 0) errors.push(`Producto ${index + 1}: cantidad debe ser mayor a 0`)
    if (item.unit_price < 0) errors.push(`Producto ${index + 1}: precio no puede ser negativo`)
    if (![0, 5, 19].includes(item.tax_percentage)) {
      errors.push(`Producto ${index + 1}: IVA debe ser 0%, 5% o 19%`)
    }
  })

  // Validar pago
  if (!request.payment.value || request.payment.value <= 0) {
    errors.push('El valor del pago debe ser mayor a 0')
  }

  return errors
}

/**
 * Busca o crea un cliente en Siigo
 */
async function findOrCreateCustomer(
  token: string,
  customer: InvoiceRequest['customer']
): Promise<number | null> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Partner-Id': 'stockly',
  }

  // Primero buscar si el cliente existe
  const searchUrl = `${SIIGO_API_URL}/v1/customers?identification=${customer.identification}`
  
  const searchResponse = await fetch(searchUrl, { headers })
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.results && searchData.results.length > 0) {
      console.log('Cliente encontrado en Siigo:', searchData.results[0].id)
      return searchData.results[0].id
    }
  }

  // Si no existe, crear el cliente
  console.log('Creando nuevo cliente en Siigo')

  // Separar nombre en partes
  const nameParts = customer.name.trim().split(' ')
  const nameArray = customer.id_type === 'NIT' 
    ? [customer.name]  // Razón social completa
    : nameParts.length >= 2 
      ? [nameParts.slice(0, -1).join(' '), nameParts[nameParts.length - 1]]
      : [customer.name, '']

  // Determinar responsabilidad fiscal
  // Default: R-99-PN para personas, O-13 para empresas grandes
  const defaultFiscalResp = customer.id_type === 'NIT' ? 'R-99-PN' : 'R-99-PN'
  const fiscalResponsibility = customer.fiscal_responsibility || defaultFiscalResp

  const customerPayload = {
    type: 'Customer',
    person_type: customer.id_type === 'NIT' ? 'Company' : 'Person',
    id_type: { code: ID_TYPE_MAP[customer.id_type] },
    identification: customer.identification,
    check_digit: customer.check_digit || undefined,
    name: nameArray,
    address: {
      address: customer.address,
      city: { country_code: 'Co', state_code: '11', city_code: customer.city_code.toString() },
    },
    contacts: [{
      email: customer.email,
      phone: customer.phone ? { number: customer.phone } : undefined,
    }],
    fiscal_responsibilities: [{ code: fiscalResponsibility }],
  }

  const createResponse = await fetch(`${SIIGO_API_URL}/v1/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(customerPayload),
  })

  if (!createResponse.ok) {
    const errorBody = await createResponse.text()
    console.error('Error creando cliente Siigo:', errorBody)
    throw new Error(`SIIGO_CUSTOMER_ERROR: ${errorBody}`)
  }

  const newCustomer = await createResponse.json()
  console.log('Cliente creado en Siigo:', newCustomer.id)
  return newCustomer.id
}

/**
 * Crea la factura electrónica en Siigo
 */
async function createSiigoInvoice(
  token: string,
  customerId: number,
  request: InvoiceRequest,
  config: SiigoConfig
): Promise<InvoiceResponse> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Partner-Id': 'stockly',
  }

  // Construir items de la factura usando IDs dinámicos
  const invoiceItems = request.items.map(item => ({
    code: item.code,
    description: item.description,
    quantity: item.quantity,
    price: item.unit_price,
    discount: item.discount_percentage || 0,
    taxes: [{
      id: getTaxId(config, item.tax_percentage),
    }],
  }))

  // Verificar que tenemos document_type_id configurado
  if (!config.documentTypeId) {
    console.warn('ADVERTENCIA: document_type_id no configurado, usando fallback')
  }

  // Construir payload de la factura
  const invoicePayload = {
    document: {
      id: config.documentTypeId || 33620,  // Usar ID configurado o fallback
    },
    date: new Date().toISOString().split('T')[0],  // YYYY-MM-DD
    customer: {
      id: customerId,
    },
    seller: request.seller_id || config.defaultSellerId || undefined,
    stamp: {
      send: true,  // Enviar a la DIAN inmediatamente
    },
    mail: {
      send: true,  // Enviar email al cliente
    },
    observations: request.observations || 'Gracias por su compra',
    items: invoiceItems,
    payments: [{
      id: getPaymentId(config, request.payment.method),
      value: request.payment.value,
      due_date: request.payment.due_date || new Date().toISOString().split('T')[0],
    }],
  }

  console.log('Enviando factura a Siigo:', JSON.stringify(invoicePayload, null, 2))

  const response = await fetch(`${SIIGO_API_URL}/v1/invoices`, {
    method: 'POST',
    headers,
    body: JSON.stringify(invoicePayload),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    console.error('Error creando factura Siigo:', response.status, errorBody)

    // Mapear errores comunes de Siigo
    if (errorBody.Errors) {
      const siigoErrors = errorBody.Errors.map((e: any) => e.Message).join(', ')
      
      if (siigoErrors.includes('numeración')) {
        return {
          success: false,
          error: 'Error de numeración: La numeración de facturación no está configurada o se agotó',
          error_code: 'SIIGO_NUMBERING_ERROR',
        }
      }
      
      return {
        success: false,
        error: siigoErrors,
        error_code: 'SIIGO_INVOICE_ERROR',
      }
    }

    return {
      success: false,
      error: `Error Siigo: ${response.status}`,
      error_code: 'SIIGO_API_ERROR',
    }
  }

  const invoiceData = await response.json()
  console.log('Factura creada en Siigo:', invoiceData.id)

  // Obtener detalles DIAN (CUFE, QR, PDF)
  const invoiceDetails = await getInvoiceDetails(token, invoiceData.id)

  return {
    success: true,
    siigo_id: invoiceData.id.toString(),
    invoice_number: invoiceData.name || invoiceData.number,
    cufe: invoiceDetails.cufe,
    qr_code: invoiceDetails.qr_code,
    pdf_url: invoiceDetails.pdf_url,
    status: invoiceData.stamp?.status || 'PENDING',
    dian_status: invoiceDetails.dian_status,
  }
}

/**
 * Obtiene los detalles DIAN de una factura (CUFE, QR, PDF)
 */
async function getInvoiceDetails(
  token: string,
  invoiceId: number
): Promise<{ cufe?: string; qr_code?: string; pdf_url?: string; dian_status?: string }> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Partner-Id': 'stockly',
  }

  try {
    // Esperar un momento para que Siigo procese con la DIAN
    await new Promise(resolve => setTimeout(resolve, 2000))

    const response = await fetch(`${SIIGO_API_URL}/v1/invoices/${invoiceId}`, { headers })

    if (!response.ok) {
      console.warn('No se pudo obtener detalles DIAN:', response.status)
      return {}
    }

    const data = await response.json()

    return {
      cufe: data.stamp?.cufe,
      qr_code: data.stamp?.qr_code,
      pdf_url: data.public_url,
      dian_status: data.stamp?.status,
    }
  } catch (error) {
    console.error('Error obteniendo detalles DIAN:', error)
    return {}
  }
}

/**
 * Registra el resultado de la facturación en Supabase
 */
async function logInvoiceResult(
  supabase: any,
  businessId: string,
  request: InvoiceRequest,
  result: InvoiceResponse
) {
  try {
    await supabase.from('siigo_invoice_logs').insert({
      business_id: businessId,
      customer_identification: request.customer.identification,
      siigo_id: result.siigo_id,
      invoice_number: result.invoice_number,
      cufe: result.cufe,
      total: request.payment.value,
      status: result.success ? 'SUCCESS' : 'ERROR',
      dian_status: result.dian_status,
      error_message: result.error,
      raw_request: JSON.stringify(request),
      raw_response: JSON.stringify(result),
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error registrando log de factura:', error)
    // No lanzar error - el log es secundario
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Obtener y validar autorización
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorización requerido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase con el token del usuario
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verificar usuario autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parsear body de la petición
    const invoiceRequest: InvoiceRequest = await req.json()

    // Validar que el usuario pertenece al negocio
    // Primero verificar si es el creador/owner del negocio
    const { data: businessOwner } = await supabase
      .from('businesses')
      .select('created_by')
      .eq('id', invoiceRequest.business_id)
      .eq('created_by', user.id)
      .single()

    // Si no es owner, verificar si es empleado activo
    let userRole = null
    if (businessOwner) {
      userRole = 'owner'
    } else {
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('user_id', user.id)
        .eq('business_id', invoiceRequest.business_id)
        .eq('is_active', true)
        .single()
      
      if (employee) {
        userRole = employee.role
      }
    }

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para facturar en este negocio' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar datos de la factura
    const validationErrors = validateInvoiceRequest(invoiceRequest)
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Errores de validación', 
          details: validationErrors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener configuración Siigo del negocio
    let siigoConfig: SiigoConfig | null
    try {
      siigoConfig = await getBusinessSiigoConfig(supabase, invoiceRequest.business_id)
    } catch (error: any) {
      if (error.message === 'BUSINESS_NOT_ENABLED') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Negocio no habilitado para facturación electrónica',
            error_code: 'BUSINESS_NOT_ENABLED',
            message: 'Este documento es solo informativo. No constituye factura electrónica válida ante la DIAN.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }

    if (!siigoConfig) {
      return new Response(
        JSON.stringify({
          error: 'Credenciales Siigo no configuradas para este negocio',
          error_code: 'SIIGO_CREDENTIALS_MISSING',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Autenticar con Siigo
    let token: string
    try {
      token = await authenticateSiigo(siigoConfig.credentials, invoiceRequest.business_id)
    } catch (error: any) {
      console.error('Error de autenticación Siigo:', error)
      
      if (error.message === 'SIIGO_AUTH_INVALID_CREDENTIALS') {
        return new Response(
          JSON.stringify({
            error: 'Credenciales Siigo inválidas. Verifique usuario y clave de acceso.',
            error_code: 'SIIGO_AUTH_INVALID',
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({
          error: 'Error conectando con Siigo',
          error_code: 'SIIGO_CONNECTION_ERROR',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar o crear cliente en Siigo
    let customerId: number | null
    try {
      customerId = await findOrCreateCustomer(token, invoiceRequest.customer)
    } catch (error: any) {
      console.error('Error con cliente Siigo:', error)
      return new Response(
        JSON.stringify({
          error: 'Error procesando datos del cliente en Siigo',
          error_code: 'SIIGO_CUSTOMER_ERROR',
          details: error.message,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({
          error: 'No se pudo crear el cliente en Siigo',
          error_code: 'SIIGO_CUSTOMER_CREATE_FAILED',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear la factura electrónica con configuración dinámica
    const result = await createSiigoInvoice(token, customerId, invoiceRequest, siigoConfig)

    // Registrar en logs
    await logInvoiceResult(supabase, invoiceRequest.business_id, invoiceRequest, result)

    // Responder según resultado
    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Factura electrónica generada exitosamente',
          data: {
            siigo_id: result.siigo_id,
            invoice_number: result.invoice_number,
            cufe: result.cufe,
            qr_code: result.qr_code,
            pdf_url: result.pdf_url,
            dian_status: result.dian_status,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          error_code: result.error_code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error('Error no manejado en siigo-invoice:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        error_code: 'INTERNAL_ERROR',
        details: Deno.env.get('DEBUG') === 'true' ? error.message : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
