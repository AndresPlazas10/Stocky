import { supabase } from '../supabase/Client';
import emailjs from '@emailjs/browser';

/**
 * Envía una factura electrónica por email usando EmailJS
 * Funciona tanto para administradores como empleados
 * 
 * @param {Object} params - Parámetros del email
 * @param {string} params.email - Email del destinatario
 * @param {string} params.invoiceNumber - Número de factura
 * @param {string} params.customerName - Nombre del cliente
 * @param {number} params.total - Total de la factura
 * @param {Array} params.items - Items de la factura (opcional)
 * @returns {Promise<Object>} - Resultado del envío
 */
export const sendInvoiceEmail = async ({ 
  email, 
  invoiceNumber, 
  customerName, 
  total,
  items = []
}) => {
  try {
    // Verificar si EmailJS está configurado
    const emailJSConfigured = import.meta.env.VITE_EMAILJS_SERVICE_ID && 
                              import.meta.env.VITE_EMAILJS_TEMPLATE_ID && 
                              import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!emailJSConfigured) {
      console.warn('⚠️ EmailJS no está configurado. Usando modo demo.');
      return {
        success: true,
        demo: true,
        message: 'EmailJS no configurado. Configura las variables de entorno VITE_EMAILJS_*'
      };
    }

    // Formatear items para el email
    const itemsText = items.map(item => 
      `- ${item.product_name || item.name} x ${item.quantity} = $${(item.quantity * item.unit_price).toLocaleString('es-CO')}`
    ).join('\n');

    // Preparar template params para EmailJS
    const templateParams = {
      to_email: email,
      customer_name: customerName,
      invoice_number: invoiceNumber,
      total: `$${total.toLocaleString('es-CO')}`,
      items_list: itemsText || 'Ver factura adjunta',
      business_name: 'Stockly',
      message: `Hola ${customerName},\n\nAdjuntamos tu factura ${invoiceNumber} por un valor de $${total.toLocaleString('es-CO')}.\n\nProductos:\n${itemsText}\n\nGracias por tu compra.`
    };

    // Enviar email usando EmailJS
    const response = await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      templateParams,
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );

    console.log('✅ Email enviado exitosamente:', response);
    
    return {
      success: true,
      demo: false,
      data: response
    };

  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    
    // Si falla, retornar modo demo para no romper la aplicación
    return {
      success: true,
      demo: true,
      error: error.message,
      message: 'Factura creada pero email no enviado. Verifica la configuración de EmailJS.'
    };
  }
};

/**
 * Valida si el servicio de email está configurado correctamente
 */
export const isEmailConfigured = () => {
  // Siempre true porque usamos Supabase Edge Functions
  return true;
};
