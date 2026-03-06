import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { invalidateInventoryCache } from '../adapters/cacheInvalidation.js';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import { parsePriceInput } from '../../utils/formatters.js';

function isMissingAtomicCreateFunction(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('create_product_with_generated_code')
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
    )
  );
}

function buildMutationId(prefix, businessId = null) {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${businessId || 'unknown'}:${prefix}:${nonce}`;
}

function buildLocalProductCode(productId) {
  const suffix = String(productId || '').replace(/-/g, '').slice(0, 8) || Date.now().toString().slice(-8);
  return `LCL-${suffix}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePriceAmount(value, fallback = 0) {
  return parsePriceInput(value, fallback);
}

function buildProductCreateEventPayload(productData = {}, { productId, code }) {
  const row = {
    id: productId,
    business_id: productData.business_id,
    code: code || buildLocalProductCode(productId),
    name: productData.name,
    category: productData.category || null,
    purchase_price: normalizePriceAmount(productData.purchase_price, 0),
    sale_price: normalizePriceAmount(productData.sale_price, 0),
    stock: normalizeNumber(productData.stock, 0),
    min_stock: normalizeNumber(productData.min_stock, 0),
    unit: productData.unit || 'unit',
    supplier_id: productData.supplier_id || null,
    is_active: productData.is_active !== false,
    manage_stock: productData.manage_stock !== false,
    created_at: productData.created_at || new Date().toISOString()
  };

  return {
    product_id: row.id,
    supplier_id: row.supplier_id,
    manage_stock: row.manage_stock,
    stock: row.stock,
    product: row
  };
}

export async function createProductWithFallback(productData) {
  const normalizedProductData = {
    ...productData,
    purchase_price: normalizePriceAmount(productData?.purchase_price, 0),
    sale_price: normalizePriceAmount(productData?.sale_price, 0)
  };

  let usedFallback = false;
  let createdProduct = null;

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
        const error = new Error(`Error al crear producto: ${retryError.message || 'Código duplicado'}`);
        error.code = retryError.code;
        throw error;
      }

      createdProduct = data || null;
    } else if (createError.code === '42501') {
      const error = new Error('No tienes permisos para crear productos. Contacta al administrador.');
      error.code = createError.code;
      throw error;
    } else if (createError.code === '23503') {
      const error = new Error('Proveedor no válido. Selecciona uno existente.');
      error.code = createError.code;
      throw error;
    } else {
      const error = new Error(`Error al crear producto: ${createError.message || 'Error desconocido'}`);
      error.code = createError.code;
      throw error;
    }
  }

  await invalidateInventoryCache({
    businessId: normalizedProductData.business_id || null,
    productId: createdProduct?.id || null,
    supplierId: normalizedProductData?.supplier_id || null
  });

  await enqueueOutboxMutation({
    businessId: normalizedProductData.business_id,
    mutationType: 'product.create',
    payload: buildProductCreateEventPayload(normalizedProductData, {
      productId: createdProduct?.id || null,
      code: createdProduct?.code || normalizedProductData?.code || null
    }),
    mutationId: buildMutationId('product.create', normalizedProductData.business_id)
  });

  return {
    usedFallback,
    createdProduct,
    localOnly: false
  };
}

export async function updateProductById({ productId, businessId = null, payload }) {
  const normalizedPayload = { ...payload };
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'purchase_price')) {
    normalizedPayload.purchase_price = normalizePriceAmount(payload?.purchase_price, 0);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'sale_price')) {
    normalizedPayload.sale_price = normalizePriceAmount(payload?.sale_price, 0);
  }

  const { data, error } = await supabaseAdapter.updateProductById(productId, normalizedPayload);
  if (error) {
    const wrapped = new Error(`Error al actualizar producto: ${error.message || 'Error desconocido'}`);
    wrapped.code = error.code;
    throw wrapped;
  }

  await invalidateInventoryCache({
    businessId,
    productId,
    supplierId: normalizedPayload?.supplier_id || null
  });

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'product.update',
    payload: {
      product_id: productId,
      supplier_id: normalizedPayload?.supplier_id || null,
      manage_stock: normalizedPayload?.manage_stock !== false,
      is_active: normalizedPayload?.is_active !== false,
      update: normalizedPayload || {}
    },
    mutationId: buildMutationId('product.update', businessId)
  });

  return data || null;
}

export async function deleteProductById({ productId, businessId = null }) {
  const { error } = await supabaseAdapter.deleteProductById(productId);
  if (error) {
    const wrapped = new Error(error.message || 'Error al eliminar producto');
    wrapped.code = error.code;
    throw wrapped;
  }

  await invalidateInventoryCache({
    businessId,
    productId
  });

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'product.delete',
    payload: {
      product_id: productId
    },
    mutationId: buildMutationId('product.delete', businessId)
  });

  return { localOnly: false };
}

export async function setProductActiveStatus({ productId, isActive, businessId = null }) {
  const { data, error } = await supabaseAdapter.updateProductById(productId, {
    is_active: Boolean(isActive)
  });

  if (error) {
    const wrapped = new Error(error.message || 'Error al actualizar estado de producto');
    wrapped.code = error.code;
    throw wrapped;
  }

  await invalidateInventoryCache({
    businessId,
    productId
  });

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'product.status.update',
    payload: {
      product_id: productId,
      is_active: Boolean(isActive),
      update: {
        is_active: Boolean(isActive)
      }
    },
    mutationId: buildMutationId('product.status.update', businessId)
  });

  return data || null;
}
