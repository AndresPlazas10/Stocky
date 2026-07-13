import type { ToastOptions } from '../ui/StockyToast';

function success(title: string, message?: string, ctaText?: string): ToastOptions {
  return { type: 'success', title, message, ctaText };
}

function error(title: string, message?: string, ctaText?: string): ToastOptions {
  return { type: 'error', title, message, ctaText };
}

function warning(title: string, message?: string, ctaText?: string): ToastOptions {
  return { type: 'warning', title, message, ctaText };
}

function info(title: string, message?: string, ctaText?: string): ToastOptions {
  return { type: 'info', title, message, ctaText };
}

export const TOAST_MESSAGES = {
  auth: {
    accountCreated: () =>
      success('Cuenta creada', 'Tu cuenta fue creada correctamente.', 'Ya puedes iniciar sesión'),
  },
  ventas: {
    registered: (total?: string) =>
      success(
        'Venta exitosa!',
        total ? `Total: ${total}` : 'La venta se registró con éxito.',
        'Tu venta se ha guardado con éxito',
      ),
    deleted: () =>
      success(
        'Venta eliminada',
        'La venta fue eliminada correctamente.',
        'El inventario fue restaurado',
      ),
    confirmed: (mesa?: string, total?: string) =>
      success(
        'Venta confirmada',
        [mesa ? `Mesa ${mesa}` : null, total ? `Total: ${total}` : null]
          .filter(Boolean)
          .join(' · ') || undefined,
        'La mesa quedó libre',
      ),
  },
  productos: {
    created: (name?: string) =>
      success(
        'Producto creado',
        name ? `"${name}" fue agregado al inventario.` : 'El producto fue creado correctamente.',
        'Ya está disponible para la venta',
      ),
    updated: (name?: string) =>
      success(
        'Producto actualizado',
        name ? `"${name}" fue actualizado.` : 'El producto fue actualizado correctamente.',
        'Los cambios se aplicaron',
      ),
    deleted: (name?: string) =>
      success(
        'Producto eliminado',
        name ? `"${name}" fue eliminado.` : 'El producto fue eliminado correctamente.',
        'Se removió del inventario',
      ),
    activated: (name?: string) =>
      success(
        'Producto activado',
        name ? `"${name}" está ahora disponible.` : 'El producto fue activado.',
        'Visible para la venta',
      ),
    deactivated: (name?: string) =>
      success(
        'Producto desactivado',
        name ? `"${name}" fue desactivado.` : 'El producto fue desactivado.',
        'No aparecerá en ventas',
      ),
  },
  combos: {
    created: (name?: string) =>
      success(
        'Combo creado',
        name ? `"${name}" fue creado.` : 'El combo fue creado correctamente.',
        'Listo para ofrecer',
      ),
    updated: (name?: string) =>
      success(
        'Combo actualizado',
        name ? `"${name}" fue actualizado.` : 'El combo fue actualizado correctamente.',
        'Los cambios se aplicaron',
      ),
    deleted: (name?: string) =>
      success(
        'Combo eliminado',
        name ? `"${name}" fue eliminado.` : 'El combo fue eliminado correctamente.',
        'Se removió del catálogo',
      ),
  },
  compras: {
    registered: () =>
      success(
        'Compra registrada',
        'La compra se registró exitosamente.',
        'El stock fue actualizado',
      ),
    deleted: () =>
      success('Compra eliminada', 'La compra fue eliminada.', 'El stock fue revertido'),
  },
  proveedores: {
    created: (name?: string) =>
      success(
        'Proveedor creado',
        name ? `"${name}" fue registrado.` : 'El proveedor fue creado exitosamente.',
        'Ya está en tu lista',
      ),
    updated: (name?: string) =>
      success(
        'Proveedor actualizado',
        name ? `"${name}" fue actualizado.` : 'El proveedor fue actualizado exitosamente.',
        'Los cambios se aplicaron',
      ),
    deleted: (name?: string) =>
      success(
        'Proveedor eliminado',
        name ? `"${name}" fue eliminado.` : 'El proveedor fue eliminado exitosamente.',
        'Se removió de tu lista',
      ),
  },
  empleados: {
    created: (name?: string) =>
      success(
        'Empleado creado',
        name ? `"${name}" fue registrado.` : 'El empleado fue creado exitosamente.',
        'Ya puede acceder al sistema',
      ),
    deleted: () =>
      success('Empleado eliminado', 'El empleado fue eliminado.', 'Se removió del equipo'),
  },
  facturas: {
    created: (number?: string) =>
      success(
        'Factura creada',
        number ? `Factura #${number} creada exitosamente.` : 'La factura fue creada exitosamente.',
        'Lista para enviar',
      ),
    sent: (email?: string) =>
      success(
        'Factura enviada',
        email ? `Enviada a ${email}.` : 'La factura fue enviada exitosamente.',
        'El cliente la recibirá pronto',
      ),
    deleted: () =>
      success('Factura eliminada', 'La factura fue eliminada.', 'Se removió del registro'),
  },
  mesas: {
    created: (name?: string) =>
      success(
        'Mesa creada',
        name ? `"${name}" fue creada.` : 'La mesa fue creada.',
        'Ya está disponible',
      ),
    updated: (name?: string) =>
      success(
        'Mesa actualizada',
        name ? `"${name}" fue actualizada.` : 'La mesa fue actualizada.',
        'Los cambios se aplicaron',
      ),
    deleted: (name?: string) =>
      success(
        'Mesa eliminada',
        name ? `"${name}" fue eliminada.` : 'La mesa fue eliminada.',
        'Se removió del salón',
      ),
    orderSent: () =>
      success(
        'Orden enviada',
        'La orden fue enviada a la impresora.',
        'La cocina la recibirá en breve',
      ),
  },
  impresion: {
    testSent: () =>
      success('Prueba enviada', 'La prueba de impresión fue enviada.', 'Revisa la impresora'),
    connectionSuccess: () =>
      success('Conexión exitosa', 'La impresora fue conectada.', 'Ya puedes imprimir'),
    connectionError: () =>
      error('Error de conexión', 'No se pudo conectar a la impresora.', 'Verifica el Bluetooth'),
    printError: (detail?: string) =>
      error(
        'Error de impresión',
        detail || 'No se pudo imprimir. Verifica la conexión Bluetooth.',
        'Revisa la conexión',
      ),
  },
  configuracion: {
    updated: () =>
      success(
        'Configuración actualizada',
        'La información fue actualizada.',
        'Los cambios están activos',
      ),
  },
} as const;
