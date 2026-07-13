export const PRODUCT_CATEGORIES = [
  { value: 'abarrotes', labelKey: 'categories.abarrotes' },
  { value: 'aseo', labelKey: 'categories.aseo' },
  { value: 'bebidas', labelKey: 'categories.bebidas' },
  { value: 'bebidas_alcoholicas', labelKey: 'categories.bebidas_alcoholicas' },
  { value: 'cervezas_vinos', labelKey: 'categories.cervezas_vinos' },
  { value: 'cigarrillos', labelKey: 'categories.cigarrillos' },
  { value: 'embutidos', labelKey: 'categories.embutidos' },
  { value: 'granos', labelKey: 'categories.granos' },
  { value: 'enlatados', labelKey: 'categories.enlatados' },
  { value: 'lacteos', labelKey: 'categories.lacteos' },
  { value: 'licores', labelKey: 'categories.licores' },
  { value: 'platos', labelKey: 'categories.platos' },
  { value: 'snacks_comida', labelKey: 'categories.snacks_comida' },
  { value: 'otros', labelKey: 'categories.otros' },
];

export const INITIAL_FORM_STATE = {
  name: '',
  category: '',
  purchase_price: '',
  sale_price: '',
  stock: '',
  min_stock: '',
  unit: 'unit',
  supplier_id: '',
  is_active: true,
  manage_stock: true,
};

export const INVENTORY_PAGE_SIZE = 120;

export const INITIAL_PRODUCT_DIALOG_FORM = {
  code: '',
  name: '',
  category: '',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  description: '',
};
