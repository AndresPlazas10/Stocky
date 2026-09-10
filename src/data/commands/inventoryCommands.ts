import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { invalidateInventoryCache } from '../adapters/cacheInvalidation';
import { parsePriceInput } from '../../utils/formatters';
import type { Product } from '../../types';

interface ProductData {
  business_id?: string;
  name?: string;
  category?: string;
  purchase_price?: number;
  sale_price?: number;
  stock?: number;
  min_stock?: number;
  unit?: string;
  supplier_id?: string | null;
  is_active?: boolean;
  manage_stock?: boolean;
  created_at?: string;
  code?: string;
  id?: string;
  [key: string]: unknown;
}

interface CreateProductResult {
  usedFallback: boolean;
  createdProduct: Partial<Product> | null;
  localOnly: boolean;
}

interface TypedError extends Error {
  code?: string;
}

function isMissingAtomicCreateFunction(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes('create_product_with_generated_code')
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
    )
  );
}

function normalizePriceAmount(value: unknown, fallback: number = 0): number {
  return parsePriceInput(value as string | number, fallback);
}

export async function createProductWithFallback(productData: ProductData): Promise<CreateProductResult> {
  const normalizedProductData: ProductData = {
    ...productData,
    purchase_price: normalizePriceAmount(productData?.purchase_price, 0),
    sale_price: normalizePriceAmount(productData?.sale_price, 0)
  };

  let usedFallback = false;
  let createdProduct: Partial<Product> | null = null;

  const { error: createError } = await supabaseAdapter.createProductWithGeneratedCodeRpc({
    p_business_id: normalizedProductData.business_id,
    p_name: normalizedProductData.name,
    p_category: normalizedProductData.category,
    p_purchase_price: normalizedProductData.purchase_price,
    p_sale_price: normalizedProductData.sale_price,
    p_stock: normalizedProductData.stock,
    p_min_stock: normalizedProductData.min_stock,
    p_unit: normalizedProductData.unit,
    p_supplier_id: normalizedProductData.supplier_id,
    p_is_active: normalizedProductData.is_active,
    p_manage_stock: normalizedProductData.manage_stock
  });

  if (createError) {
    if (isMissingAtomicCreateFunction(createError)) {
      usedFallback = true;
      const fallbackCode = `PRD-${Date.now().toString().slice(-6)}`;
      const { data, error: retryError } = await supabaseAdapter.insertProduct({
        ...normalizedProductData,
        code: fallbackCode,
        created_at: new Date().toISOString()
      });

      if (retryError) {
        const error: TypedError = new Error(`Error al crear producto: ${retryError.message || 'Código duplicado'}`);
        error.code = retryError.code;
        throw error;
      }

      createdProduct = data || null;
    } else if ((createError as { code?: string }).code === '42501') {
      const error: TypedError = new Error('No tienes permisos para crear productos. Contacta al administrador.');
      error.code = (createError as { code?: string }).code;
      throw error;
    } else if ((createError as { code?: string }).code === '23503') {
      const error: TypedError = new Error('Proveedor no válido. Selecciona uno existente.');
      error.code = (createError as { code?: string }).code;
      throw error;
    } else {
      const error: TypedError = new Error(`Error al crear producto: ${(createError as { message?: string }).message || 'Error desconocido'}`);
      error.code = (createError as { code?: string }).code;
      throw error;
    }
  }

  await invalidateInventoryCache({
    businessId: normalizedProductData.business_id || null,
    productId: createdProduct?.id || null,
    supplierId: normalizedProductData?.supplier_id || null
  });

  return {
    usedFallback,
    createdProduct,
    localOnly: false
  };
}

export async function updateProductById({
  productId,
  businessId = null,
  payload
}: {
  productId: string;
  businessId?: string | null;
  payload: Partial<Product>;
}): Promise<Partial<Product> | null> {
  const normalizedPayload = { ...payload };
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'purchase_price')) {
    normalizedPayload.purchase_price = normalizePriceAmount(payload?.purchase_price, 0);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'sale_price')) {
    normalizedPayload.sale_price = normalizePriceAmount(payload?.sale_price, 0);
  }

  const { data, error } = await supabaseAdapter.updateProductById(productId, normalizedPayload);
  if (error) {
    const wrapped: TypedError = new Error(`Error al actualizar producto: ${error.message || 'Error desconocido'}`);
    wrapped.code = error.code;
    throw wrapped;
  }

  await invalidateInventoryCache({
    businessId,
    productId,
    supplierId: normalizedPayload?.supplier_id || null
  });

  return data || null;
}

export async function checkProductCanDelete(productId: string): Promise<unknown> {
  const data = await supabaseAdapter.checkProductCanDelete(productId);
  return data;
}

export async function deleteProductById({
  productId,
  businessId = null
}: {
  productId: string;
  businessId?: string | null;
}): Promise<{ localOnly: boolean }> {
  const { error } = await supabaseAdapter.deleteProductById(productId);
  if (error) {
    const wrapped: TypedError = new Error(error.message || 'Error al eliminar producto');
    wrapped.code = error.code;
    throw wrapped;
  }

  await invalidateInventoryCache({
    businessId,
    productId
  });

  return { localOnly: false };
}

export async function setProductActiveStatus({
  productId,
  isActive,
  businessId = null
}: {
  productId: string;
  isActive: boolean;
  businessId?: string | null;
}): Promise<Partial<Product> | null> {
  const { data, error } = await supabaseAdapter.updateProductById(productId, {
    is_active: Boolean(isActive)
  });

  if (error) {
    const wrapped: TypedError = new Error(error.message || 'Error al actualizar estado de producto');
    wrapped.code = error.code;
    throw wrapped;
  }

  await invalidateInventoryCache({
    businessId,
    productId
  });

  return data || null;
}
