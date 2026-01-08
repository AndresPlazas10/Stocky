/**
 * 🚨 CONFIGURACIÓN DE MODAL ADVERTENCIA DE PAGO
 * 
 * Este modal se muestra a TODOS los negocios en días específicos del mes
 * como recordatorio de pago mensual.
 */

/**
 * DÍAS DEL MES en los que se muestra el modal de advertencia de pago
 */
export const PAYMENT_WARNING_DAYS = [
  25  // Día 25 de cada mes
];

/**
 * FECHA DE INICIO del sistema de advertencias
 * El modal NO se mostrará antes de esta fecha
 */
const START_DATE = new Date('2026-02-25'); // 25 de febrero de 2026

/**
 * Verifica si hoy es un día de advertencia de pago
 * @returns {boolean} - true si hoy se debe mostrar la advertencia
 */
export const shouldShowPaymentWarning = () => {
  if (PAYMENT_WARNING_DAYS.length === 0) {
    return false; // Si no hay días configurados, no mostrar
  }
  
  const today = new Date();
  
  // Verificar que ya pasó la fecha de inicio
  if (today < START_DATE) {
    return false; // Aún no es tiempo de mostrar advertencias
  }
  
  const dayOfMonth = today.getDate();
  
  return PAYMENT_WARNING_DAYS.includes(dayOfMonth);
};

// ========================================
// SISTEMA DE BLOQUEO POR NEGOCIO ESPECÍFICO
// ========================================

/**
 * Lista de IDs de negocios BLOQUEADOS (is_active = false en BD)
 * NOTA: Este array es solo para referencia. El bloqueo real se hace
 * mediante SQL: UPDATE businesses SET is_active = false WHERE id = 'uuid'
 */
export const BLOCKED_BUSINESS_IDS = [
  // Solo para referencia/documentación
  // El bloqueo real se maneja en la columna is_active de la BD
];

/**
 * @deprecated - Usar shouldShowPaymentWarning() en su lugar
 */
export const UNPAID_BUSINESS_IDS = [
  'ea865e94-0e46-4cb1-a9ea-6f88b0442f80',  // Negocio de prueba
];

/**
 * @deprecated - Usar shouldShowPaymentWarning() en su lugar
 */
export const hasUnpaidStatus = (businessId) => {
  return UNPAID_BUSINESS_IDS.includes(businessId);
};
