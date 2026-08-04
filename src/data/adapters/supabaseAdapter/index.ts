import { authAdapter } from './auth.js';
import { businessAdapter } from './business.js';
import { productsAdapter } from './products.js';
import { salesAdapter } from './sales.js';
import { employeesAdapter } from './employees.js';
import { suppliersAdapter } from './suppliers.js';
import { purchasesAdapter } from './purchases.js';
import { combosAdapter } from './combos.js';
import { tablesAdapter } from './tables.js';
import { ordersAdapter } from './orders.js';
import { invoicesAdapter } from './invoices.js';
import { syncAdapter } from './sync.js';
import { genericAdapter } from './generic.js';

export const supabaseAdapter = {
  ...authAdapter,
  ...businessAdapter,
  ...productsAdapter,
  ...salesAdapter,
  ...employeesAdapter,
  ...suppliersAdapter,
  ...purchasesAdapter,
  ...combosAdapter,
  ...tablesAdapter,
  ...ordersAdapter,
  ...invoicesAdapter,
  ...syncAdapter,
  ...genericAdapter,
};
