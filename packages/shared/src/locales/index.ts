import esCommon from './es/common.json';
import esVentas from './es/ventas.json';
import esCompras from './es/compras.json';
import esFacturas from './es/facturas.json';
import esMesas from './es/mesas.json';
import esReports from './es/reports.json';

import enCommon from './en/common.json';
import enVentas from './en/ventas.json';
import enCompras from './en/compras.json';
import enFacturas from './en/facturas.json';
import enMesas from './en/mesas.json';
import enReports from './en/reports.json';

export const resources = {
  es: {
    common: esCommon,
    ventas: esVentas,
    compras: esCompras,
    facturas: esFacturas,
    mesas: esMesas,
    reports: esReports,
  },
  en: {
    common: enCommon,
    ventas: enVentas,
    compras: enCompras,
    facturas: enFacturas,
    mesas: enMesas,
    reports: enReports,
  },
};

export const defaultNS = 'common';
export const fallbackLng = 'es';
export const ns = ['common', 'ventas', 'compras', 'facturas', 'mesas', 'reports'] as const;
