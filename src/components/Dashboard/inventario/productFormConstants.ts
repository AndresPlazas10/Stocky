export const PRODUCT_CATEGORIES = [
  { value: 'abarrote', label: 'Abarrote' },
  { value: 'licor', label: 'Licor' },
  { value: 'cigarrillo', label: 'Cigarrillo' },
  { value: 'rapifrut', label: 'Rapifrut' },
  { value: 'lacteo', label: 'Lácteo' },
  { value: 'embutido', label: 'Embutido' },
  { value: 'grano', label: 'Grano' },
  { value: 'enlatado', label: 'Enlatado' },
  { value: 'aseo', label: 'Aseo' },
  { value: 'mecato', label: 'Mecato' },
  { value: 'gaseosa', label: 'Gaseosa' },
  { value: 'agua', label: 'Agua' },
  { value: 'energizante', label: 'Energizante' },
  { value: 'pasaboca', label: 'Pasaboca' },
  { value: 'vicio', label: 'Vicio' },
  { value: 'otro', label: 'Otro' },
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
