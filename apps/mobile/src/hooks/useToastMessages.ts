import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToastOptions } from '../ui/StockyToast';

function success(title: string, message?: string, ctaText?: string): ToastOptions {
  return { type: 'success', title, message, ctaText };
}

function error(title: string, message?: string, ctaText?: string): ToastOptions {
  return { type: 'error', title, message, ctaText };
}

export function useToastMessages() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      auth: {
        accountCreated: () =>
          success(
            t('toast.auth.accountCreated.title'),
            t('toast.auth.accountCreated.description'),
            t('toast.auth.accountCreated.cta'),
          ),
      },
      ventas: {
        registered: (total?: string) =>
          success(
            t('toast.ventas.registered.title'),
            total
              ? `${t('toast.ventas.registered.total')}: ${total}`
              : t('toast.ventas.registered.description'),
            t('toast.ventas.registered.cta'),
          ),
        deleted: () =>
          success(
            t('toast.ventas.deleted.title'),
            t('toast.ventas.deleted.description'),
            t('toast.ventas.deleted.cta'),
          ),
        confirmed: (mesa?: string, total?: string) =>
          success(
            t('toast.ventas.confirmed.title'),
            [
              mesa ? `${t('toast.ventas.confirmed.table')} ${mesa}` : null,
              total ? `${t('toast.ventas.confirmed.total')}: ${total}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
            t('toast.ventas.confirmed.cta'),
          ),
      },
      productos: {
        created: (name?: string) =>
          success(
            t('toast.productos.created.title'),
            name
              ? `"${name}" ${t('toast.productos.created.description')}`
              : t('toast.productos.created.descriptionGeneric'),
            t('toast.productos.created.cta'),
          ),
        updated: (name?: string) =>
          success(
            t('toast.productos.updated.title'),
            name
              ? `"${name}" ${t('toast.productos.updated.description')}`
              : t('toast.productos.updated.descriptionGeneric'),
            t('toast.productos.updated.cta'),
          ),
        deleted: (name?: string) =>
          success(
            t('toast.productos.deleted.title'),
            name
              ? `"${name}" ${t('toast.productos.deleted.description')}`
              : t('toast.productos.deleted.descriptionGeneric'),
            t('toast.productos.deleted.cta'),
          ),
        activated: (name?: string) =>
          success(
            t('toast.productos.activated.title'),
            name
              ? `"${name}" ${t('toast.productos.activated.description')}`
              : t('toast.productos.activated.descriptionGeneric'),
            t('toast.productos.activated.cta'),
          ),
        deactivated: (name?: string) =>
          success(
            t('toast.productos.deactivated.title'),
            name
              ? `"${name}" ${t('toast.productos.deactivated.description')}`
              : t('toast.productos.deactivated.descriptionGeneric'),
            t('toast.productos.deactivated.cta'),
          ),
      },
      combos: {
        created: (name?: string) =>
          success(
            t('toast.combos.created.title'),
            name
              ? `"${name}" ${t('toast.combos.created.description')}`
              : t('toast.combos.created.descriptionGeneric'),
            t('toast.combos.created.cta'),
          ),
        updated: (name?: string) =>
          success(
            t('toast.combos.updated.title'),
            name
              ? `"${name}" ${t('toast.combos.updated.description')}`
              : t('toast.combos.updated.descriptionGeneric'),
            t('toast.combos.updated.cta'),
          ),
        deleted: (name?: string) =>
          success(
            t('toast.combos.deleted.title'),
            name
              ? `"${name}" ${t('toast.combos.deleted.description')}`
              : t('toast.combos.deleted.descriptionGeneric'),
            t('toast.combos.deleted.cta'),
          ),
      },
      compras: {
        registered: () =>
          success(
            t('toast.compras.registered.title'),
            t('toast.compras.registered.description'),
            t('toast.compras.registered.cta'),
          ),
        deleted: () =>
          success(
            t('toast.compras.deleted.title'),
            t('toast.compras.deleted.description'),
            t('toast.compras.deleted.cta'),
          ),
      },
      proveedores: {
        created: (name?: string) =>
          success(
            t('toast.proveedores.created.title'),
            name
              ? `"${name}" ${t('toast.proveedores.created.description')}`
              : t('toast.proveedores.created.descriptionGeneric'),
            t('toast.proveedores.created.cta'),
          ),
        updated: (name?: string) =>
          success(
            t('toast.proveedores.updated.title'),
            name
              ? `"${name}" ${t('toast.proveedores.updated.description')}`
              : t('toast.proveedores.updated.descriptionGeneric'),
            t('toast.proveedores.updated.cta'),
          ),
        deleted: (name?: string) =>
          success(
            t('toast.proveedores.deleted.title'),
            name
              ? `"${name}" ${t('toast.proveedores.deleted.description')}`
              : t('toast.proveedores.deleted.descriptionGeneric'),
            t('toast.proveedores.deleted.cta'),
          ),
      },
      empleados: {
        created: (name?: string) =>
          success(
            t('toast.empleados.created.title'),
            name
              ? `"${name}" ${t('toast.empleados.created.description')}`
              : t('toast.empleados.created.descriptionGeneric'),
            t('toast.empleados.created.cta'),
          ),
        deleted: () =>
          success(
            t('toast.empleados.deleted.title'),
            t('toast.empleados.deleted.description'),
            t('toast.empleados.deleted.cta'),
          ),
      },
      facturas: {
        created: (number?: string) =>
          success(
            t('toast.facturas.created.title'),
            number
              ? `${t('toast.facturas.created.invoice')} #${number} ${t('toast.facturas.created.description')}`
              : t('toast.facturas.created.descriptionGeneric'),
            t('toast.facturas.created.cta'),
          ),
        sent: (email?: string) =>
          success(
            t('toast.facturas.sent.title'),
            email
              ? `${t('toast.facturas.sent.to')} ${email}.`
              : t('toast.facturas.sent.description'),
            t('toast.facturas.sent.cta'),
          ),
        deleted: () =>
          success(
            t('toast.facturas.deleted.title'),
            t('toast.facturas.deleted.description'),
            t('toast.facturas.deleted.cta'),
          ),
      },
      mesas: {
        created: (name?: string) =>
          success(
            t('toast.mesas.created.title'),
            name
              ? `"${name}" ${t('toast.mesas.created.description')}`
              : t('toast.mesas.created.descriptionGeneric'),
            t('toast.mesas.created.cta'),
          ),
        updated: (name?: string) =>
          success(
            t('toast.mesas.updated.title'),
            name
              ? `"${name}" ${t('toast.mesas.updated.description')}`
              : t('toast.mesas.updated.descriptionGeneric'),
            t('toast.mesas.updated.cta'),
          ),
        deleted: (name?: string) =>
          success(
            t('toast.mesas.deleted.title'),
            name
              ? `"${name}" ${t('toast.mesas.deleted.description')}`
              : t('toast.mesas.deleted.descriptionGeneric'),
            t('toast.mesas.deleted.cta'),
          ),
        orderSent: () =>
          success(
            t('toast.mesas.orderSent.title'),
            t('toast.mesas.orderSent.description'),
            t('toast.mesas.orderSent.cta'),
          ),
      },
      impresion: {
        testSent: () =>
          success(
            t('toast.impresion.testSent.title'),
            t('toast.impresion.testSent.description'),
            t('toast.impresion.testSent.cta'),
          ),
        connectionSuccess: () =>
          success(
            t('toast.impresion.connectionSuccess.title'),
            t('toast.impresion.connectionSuccess.description'),
            t('toast.impresion.connectionSuccess.cta'),
          ),
        connectionError: () =>
          error(
            t('toast.impresion.connectionError.title'),
            t('toast.impresion.connectionError.description'),
            t('toast.impresion.connectionError.cta'),
          ),
        printError: (detail?: string) =>
          error(
            t('toast.impresion.printError.title'),
            detail || t('toast.impresion.printError.description'),
            t('toast.impresion.printError.cta'),
          ),
      },
      configuracion: {
        updated: () =>
          success(
            t('toast.configuracion.updated.title'),
            t('toast.configuracion.updated.description'),
            t('toast.configuracion.updated.cta'),
          ),
      },
    }),
    [t],
  );
}
