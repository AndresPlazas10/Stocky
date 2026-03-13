import { getSupabaseClient } from '../lib/supabase';

export type InventorySupplierRecord = {
  id: string;
  business_name: string | null;
  contact_name: string | null;
};

export type InventoryProductRecord = {
  id: string;
  business_id: string;
  code: string | null;
  name: string;
  category: string | null;
  purchase_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  supplier_id: string | null;
  is_active: boolean;
  manage_stock: boolean;
  created_at: string | null;
  supplier: InventorySupplierRecord | null;
};
let inventoryProductsFastRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';
let inventoryProductsWithSupplierRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return normalized;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePriceInput(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const text = String(value).replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSupplier(row: any): InventorySupplierRecord {
  return {
    id: normalizeText(row?.id),
    business_name: normalizeReference(row?.business_name),
    contact_name: normalizeReference(row?.contact_name),
  };
}

function normalizeProduct(
  row: any,
  supplierMap: Map<string, InventorySupplierRecord>,
): InventoryProductRecord {
  const supplierId = normalizeReference(row?.supplier_id);
  const embeddedSupplier = row?.supplier ? normalizeSupplier(row.supplier) : null;

  return {
    id: normalizeText(row?.id),
    business_id: normalizeText(row?.business_id),
    code: normalizeReference(row?.code),
    name: normalizeText(row?.name) || 'Producto',
    category: normalizeReference(row?.category),
    purchase_price: normalizeNumber(row?.purchase_price, 0),
    sale_price: normalizeNumber(row?.sale_price, 0),
    stock: normalizeNumber(row?.stock, 0),
    min_stock: normalizeNumber(row?.min_stock, 0),
    unit: normalizeText(row?.unit) || 'unit',
    supplier_id: supplierId,
    is_active: row?.is_active !== false,
    manage_stock: row?.manage_stock !== false,
    created_at: normalizeReference(row?.created_at),
    supplier: embeddedSupplier || (supplierId ? supplierMap.get(supplierId) || null : null),
  };
}

function isMissingCreateProductRpcError(errorLike: any): boolean {
  const code = normalizeText(errorLike?.code);
  const message = normalizeText(errorLike?.message).toLowerCase();

  return code === 'PGRST202'
    || code === '42883'
    || message.includes('create_product_with_generated_code')
    || message.includes('could not find the function');
}

function isMissingProductSupplierJoinRelationError(errorLike: any): boolean {
  const code = normalizeText(errorLike?.code).toUpperCase();
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST200'
    || message.includes('could not find a relationship')
    || message.includes('relationship')
    || message.includes('products_supplier_id_fkey');
}

function isMissingListInventoryProductsWithSupplierRpcError(errorLike: any): boolean {
  const code = normalizeText(errorLike?.code).toUpperCase();
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('list_inventory_products_with_supplier')
    || message.includes('could not find the function')
    || message.includes('schema cache');
}

function isMissingListInventoryProductsFastRpcError(errorLike: any): boolean {
  const code = normalizeText(errorLike?.code).toUpperCase();
  const message = normalizeText(errorLike?.message).toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('list_inventory_products_fast')
    || message.includes('could not find the function')
    || message.includes('schema cache');
}

function buildFallbackProductCode(): string {
  const nonce = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `PRD-${nonce}`;
}

function validateProductInput({
  name,
  purchasePrice,
  salePrice,
}: {
  name: string;
  purchasePrice: number;
  salePrice: number;
}) {
  if (!name.trim()) {
    throw new Error('Ingresa el nombre del producto.');
  }

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('El precio de venta debe ser mayor a 0.');
  }

  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    throw new Error('El precio de compra no puede ser negativo.');
  }

  if (salePrice < purchasePrice) {
    throw new Error('El precio de venta no puede ser menor al precio de compra.');
  }
}

export async function listInventorySuppliers(businessId: string): Promise<InventorySupplierRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('suppliers')
    .select('id,business_name,contact_name')
    .eq('business_id', businessId)
    .order('business_name', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeSupplier);
}

export async function listInventoryProducts(
  businessId: string,
  options: { activeOnly?: boolean; includeSuppliers?: boolean } = {},
): Promise<InventoryProductRecord[]> {
  const client = getSupabaseClient();
  const includeSuppliers = options.includeSuppliers !== false;
  const baseSelect = 'id,business_id,code,name,category,purchase_price,sale_price,stock,min_stock,unit,supplier_id,is_active,manage_stock,created_at';
  if (!includeSuppliers) {
    if (inventoryProductsFastRpcCompatibility !== 'unsupported') {
      const fastRpcResult = await client.rpc('list_inventory_products_fast', {
        p_business_id: businessId,
        p_active_only: options.activeOnly === true,
      });

      if (!fastRpcResult.error) {
        inventoryProductsFastRpcCompatibility = 'supported';
        const rows = Array.isArray(fastRpcResult.data) ? fastRpcResult.data : [];
        return rows.map((row: any) => normalizeProduct(row, new Map<string, InventorySupplierRecord>()));
      }

      if (isMissingListInventoryProductsFastRpcError(fastRpcResult.error)) {
        inventoryProductsFastRpcCompatibility = 'unsupported';
      } else {
        throw fastRpcResult.error;
      }
    }

    let query = client
      .from('products')
      .select(baseSelect)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (options.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    const products = Array.isArray(data) ? data : [];
    return products.map((row: any) => normalizeProduct(row, new Map<string, InventorySupplierRecord>()));
  }

  if (inventoryProductsWithSupplierRpcCompatibility !== 'unsupported') {
    const rpcResult = await client.rpc('list_inventory_products_with_supplier', {
      p_business_id: businessId,
      p_active_only: options.activeOnly === true,
    });

    if (!rpcResult.error) {
      inventoryProductsWithSupplierRpcCompatibility = 'supported';
      const rpcRows = Array.isArray(rpcResult.data) ? rpcResult.data : [];
      return rpcRows.map((row: any) => normalizeProduct(row, new Map<string, InventorySupplierRecord>()));
    }

    if (isMissingListInventoryProductsWithSupplierRpcError(rpcResult.error)) {
      inventoryProductsWithSupplierRpcCompatibility = 'unsupported';
    } else {
      throw rpcResult.error;
    }
  }

  let withEmbeddedSuppliersQuery = client
    .from('products')
    .select(`
      ${baseSelect},
      supplier:suppliers!products_supplier_id_fkey (
        id,
        business_name,
        contact_name
      )
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (options.activeOnly) {
    withEmbeddedSuppliersQuery = withEmbeddedSuppliersQuery.eq('is_active', true);
  }
  const withEmbeddedSuppliers = await withEmbeddedSuppliersQuery;

  if (!withEmbeddedSuppliers.error) {
    const enrichedRows = Array.isArray(withEmbeddedSuppliers.data) ? withEmbeddedSuppliers.data : [];
    return enrichedRows.map((row: any) => {
      const supplier = row?.supplier ? normalizeSupplier(row.supplier) : null;
      const supplierMap = new Map<string, InventorySupplierRecord>();
      if (supplier?.id) supplierMap.set(supplier.id, supplier);
      return normalizeProduct(row, supplierMap);
    });
  }

  if (!isMissingProductSupplierJoinRelationError(withEmbeddedSuppliers.error)) {
    throw withEmbeddedSuppliers.error;
  }

  let fallbackProductsQuery = client
    .from('products')
    .select(baseSelect)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (options.activeOnly) {
    fallbackProductsQuery = fallbackProductsQuery.eq('is_active', true);
  }
  const fallbackProducts = await fallbackProductsQuery;
  if (fallbackProducts.error) throw fallbackProducts.error;
  const products = Array.isArray(fallbackProducts.data) ? fallbackProducts.data : [];

  const supplierMap = new Map<string, InventorySupplierRecord>();
  const supplierIds = Array.from(new Set(
    products.map((row: any) => normalizeReference(row?.supplier_id)).filter(Boolean) as string[],
  ));
  if (supplierIds.length > 0) {
    const suppliersResult = await client
      .from('suppliers')
      .select('id,business_name,contact_name')
      .eq('business_id', businessId)
      .in('id', supplierIds);

    if (suppliersResult.error) throw suppliersResult.error;
    (Array.isArray(suppliersResult.data) ? suppliersResult.data : []).forEach((row: any) => {
      const supplier = normalizeSupplier(row);
      supplierMap.set(supplier.id, supplier);
    });
  }

  return products.map((row: any) => normalizeProduct(row, supplierMap));
}

export async function createInventoryProductWithRpcFallback({
  businessId,
  name,
  category,
  purchasePrice,
  salePrice,
  stock,
  minStock,
  unit,
  supplierId,
  isActive,
  manageStock,
}: {
  businessId: string;
  name: string;
  category?: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit?: string | null;
  supplierId?: string | null;
  isActive?: boolean;
  manageStock?: boolean;
}): Promise<{ productId: string | null; usedLegacyFallback: boolean }> {
  const normalizedName = normalizeText(name);
  const normalizedCategory = normalizeReference(category);
  const normalizedPurchasePrice = parsePriceInput(purchasePrice, 0);
  const normalizedSalePrice = parsePriceInput(salePrice, NaN);
  const normalizedManageStock = manageStock !== false;
  const normalizedStock = normalizedManageStock ? normalizeNumber(stock, 0) : 0;
  const normalizedMinStock = normalizedManageStock ? normalizeNumber(minStock, 0) : 0;
  const normalizedUnit = normalizeText(unit) || 'unit';
  const normalizedSupplierId = normalizeReference(supplierId);
  const normalizedIsActive = isActive !== false;

  validateProductInput({
    name: normalizedName,
    purchasePrice: normalizedPurchasePrice,
    salePrice: normalizedSalePrice,
  });

  const client = getSupabaseClient();
  const rpcResult = await client.rpc('create_product_with_generated_code', {
    p_business_id: businessId,
    p_name: normalizedName,
    p_category: normalizedCategory,
    p_purchase_price: normalizedPurchasePrice,
    p_sale_price: normalizedSalePrice,
    p_stock: normalizedStock,
    p_min_stock: normalizedMinStock,
    p_unit: normalizedUnit,
    p_supplier_id: normalizedSupplierId,
    p_is_active: normalizedIsActive,
    p_manage_stock: normalizedManageStock,
  });

  let usedLegacyFallback = false;
  let createdProductId: string | null = null;

  if (rpcResult.error) {
    if (!isMissingCreateProductRpcError(rpcResult.error)) {
      throw new Error(rpcResult.error.message || 'Error al crear el producto.');
    }

    usedLegacyFallback = true;
    const fallbackInsert = await client
      .from('products')
      .insert([
        {
          business_id: businessId,
          code: buildFallbackProductCode(),
          name: normalizedName,
          category: normalizedCategory,
          purchase_price: normalizedPurchasePrice,
          sale_price: normalizedSalePrice,
          stock: normalizedStock,
          min_stock: normalizedMinStock,
          unit: normalizedUnit,
          supplier_id: normalizedSupplierId,
          is_active: normalizedIsActive,
          manage_stock: normalizedManageStock,
          created_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (fallbackInsert.error) {
      throw new Error(fallbackInsert.error.message || 'Error al crear el producto.');
    }

    createdProductId = normalizeReference(fallbackInsert.data?.id);
  } else {
    const rpcRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    createdProductId = normalizeReference(rpcRow?.product_id) || normalizeReference(rpcRow?.id);
  }

  return {
    productId: createdProductId,
    usedLegacyFallback,
  };
}

export async function updateInventoryProductById({
  businessId,
  productId,
  name,
  category,
  purchasePrice,
  salePrice,
  minStock,
  unit,
  supplierId,
  isActive,
  manageStock,
}: {
  businessId: string;
  productId: string;
  name: string;
  category?: string | null;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  unit?: string | null;
  supplierId?: string | null;
  isActive: boolean;
  manageStock: boolean;
}): Promise<void> {
  const normalizedName = normalizeText(name);
  const normalizedCategory = normalizeReference(category);
  const normalizedPurchasePrice = parsePriceInput(purchasePrice, 0);
  const normalizedSalePrice = parsePriceInput(salePrice, NaN);
  const normalizedManageStock = manageStock !== false;
  const normalizedMinStock = normalizedManageStock ? normalizeNumber(minStock, 0) : 0;
  const normalizedUnit = normalizeText(unit) || 'unit';
  const normalizedSupplierId = normalizeReference(supplierId);

  validateProductInput({
    name: normalizedName,
    purchasePrice: normalizedPurchasePrice,
    salePrice: normalizedSalePrice,
  });

  const client = getSupabaseClient();
  const { error } = await client
    .from('products')
    .update({
      name: normalizedName,
      category: normalizedCategory,
      purchase_price: normalizedPurchasePrice,
      sale_price: normalizedSalePrice,
      min_stock: normalizedMinStock,
      unit: normalizedUnit,
      supplier_id: normalizedSupplierId,
      is_active: isActive !== false,
      manage_stock: normalizedManageStock,
    })
    .eq('id', productId)
    .eq('business_id', businessId);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el producto.');
  }
}

export async function deleteInventoryProductById({
  businessId,
  productId,
}: {
  businessId: string;
  productId: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('business_id', businessId);

  if (error) {
    const wrapped: Error & { code?: string } = new Error(error.message || 'No se pudo eliminar el producto.');
    wrapped.code = normalizeReference((error as any)?.code) || undefined;
    throw wrapped;
  }
}

export async function setInventoryProductActiveStatus({
  businessId,
  productId,
  isActive,
}: {
  businessId: string;
  productId: string;
  isActive: boolean;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('products')
    .update({ is_active: Boolean(isActive) })
    .eq('id', productId)
    .eq('business_id', businessId);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el estado del producto.');
  }
}
