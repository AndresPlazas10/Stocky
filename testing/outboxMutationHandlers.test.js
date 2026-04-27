import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchOutboxMutation,
  handleOrderItemBulkQuantityUpdateMutation,
  handleOrderCloseSingleMutation,
  handleOrderCloseSplitMutation,
  handleOrderDeleteAndReleaseTableMutation,
  handleOrderItemDeleteMutation,
  handleOrderItemInsertMutation,
  handleOrderItemUpdateQuantityMutation,
  handleOrderTotalUpdateMutation,
  handleOrderCreateMutation,
  handleProductCreateMutation,
  handleProductDeleteMutation,
  handleProductStatusUpdateMutation,
  handleProductUpdateMutation,
  handleTableConsistencyDetectedMutation,
  handleTableConsistencyFixFailedMutation,
  handleTableDeleteCascadeOrdersMutation,
  handleTableCreateMutation,
  handleInvoiceCancelledMutation,
  handleInvoiceCreateMutation,
  handleInvoiceDeleteMutation,
  handleInvoiceSentMutation,
  handleInvoiceUpdateMutation
} from '../src/sync/outboxMutationHandlers.js';

test('handleProductCreateMutation hace ack si el producto ya existe por id', async () => {
  const result = await handleProductCreateMutation({
    mutation_type: 'product.create',
    business_id: 'biz-1',
    payload: {
      product_id: 'prod-existing',
      product: {
        id: 'prod-existing',
        business_id: 'biz-1',
        name: 'Producto existente'
      }
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: { id: 'prod-existing' }, error: null }),
    insertProductFn: async () => {
      throw new Error('no debería insertar');
    }
  });

  assert.equal(result.ack, true);
});

test('handleProductCreateMutation inserta y hace ack cuando no existe', async () => {
  let inserted = false;
  const result = await handleProductCreateMutation({
    mutation_type: 'product.create',
    business_id: 'biz-2',
    payload: {
      product_id: 'prod-new',
      product: {
        id: 'prod-new',
        business_id: 'biz-2',
        code: 'PRD-001',
        name: 'Producto nuevo'
      }
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertProductFn: async (row) => {
      inserted = true;
      assert.equal(row.id, 'prod-new');
      assert.equal(row.business_id, 'biz-2');
      return { data: { id: 'prod-new' }, error: null };
    }
  });

  assert.equal(inserted, true);
  assert.equal(result.ack, true);
});

test('handleProductCreateMutation hace ack ante duplicado (idempotencia)', async () => {
  const result = await handleProductCreateMutation({
    mutation_type: 'product.create',
    business_id: 'biz-3',
    payload: {
      product_id: 'prod-dup',
      product: {
        id: 'prod-dup',
        business_id: 'biz-3',
        code: 'PRD-DUP',
        name: 'Producto duplicado'
      }
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertProductFn: async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' }
    })
  });

  assert.equal(result.ack, true);
});

test('handleProductCreateMutation marca retryable en error de red', async () => {
  const result = await handleProductCreateMutation({
    mutation_type: 'product.create',
    business_id: 'biz-4',
    payload: {
      product: {
        business_id: 'biz-4',
        code: 'PRD-NET',
        name: 'Producto red'
      }
    }
  }, {
    insertProductFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleProductUpdateMutation hace ack cuando updater responde ok', async () => {
  let called = false;
  const result = await handleProductUpdateMutation({
    mutation_type: 'product.update',
    payload: {
      product_id: 'prod-1',
      update: { sale_price: 12345 }
    }
  }, {
    updateProductByIdFn: async (productId, payload) => {
      called = true;
      assert.equal(productId, 'prod-1');
      assert.equal(payload.sale_price, 12345);
      return { data: { id: productId }, error: null };
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('handleProductUpdateMutation marca retryable en error de red', async () => {
  const result = await handleProductUpdateMutation({
    mutation_type: 'product.update',
    payload: {
      product_id: 'prod-2',
      update: { stock: 10 }
    }
  }, {
    updateProductByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
  assert.equal(result.error, 'Failed to fetch');
});

test('handleProductUpdateMutation rechaza definitivamente payload inválido', async () => {
  const result = await handleProductUpdateMutation({
    mutation_type: 'product.update',
    payload: {
      update: { stock: 5 }
    }
  }, {
    updateProductByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta product.update al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'product.update',
    payload: {
      product_id: 'prod-3',
      update: { name: 'Nuevo nombre' }
    }
  }, {
    updateProductByIdFn: async () => ({ data: { id: 'prod-3' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleProductDeleteMutation hace ack si el producto ya no existe', async () => {
  const result = await handleProductDeleteMutation({
    mutation_type: 'product.delete',
    business_id: 'biz-del-1',
    payload: {
      product_id: 'prod-gone',
      business_id: 'biz-del-1'
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: null, error: null }),
    deleteProductByIdFn: async () => {
      throw new Error('no debería borrar');
    }
  });

  assert.equal(result.ack, true);
});

test('handleProductDeleteMutation borra y hace ack cuando existe', async () => {
  let deleted = false;
  const result = await handleProductDeleteMutation({
    mutation_type: 'product.delete',
    business_id: 'biz-del-2',
    payload: {
      product_id: 'prod-delete',
      business_id: 'biz-del-2'
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: { id: 'prod-delete' }, error: null }),
    deleteProductByIdFn: async (productId) => {
      deleted = true;
      assert.equal(productId, 'prod-delete');
      return { error: null };
    }
  });

  assert.equal(deleted, true);
  assert.equal(result.ack, true);
});

test('handleProductDeleteMutation marca retryable en error de red', async () => {
  const result = await handleProductDeleteMutation({
    mutation_type: 'product.delete',
    business_id: 'biz-del-3',
    payload: {
      product_id: 'prod-net',
      business_id: 'biz-del-3'
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: { id: 'prod-net' }, error: null }),
    deleteProductByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta product.create al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'product.create',
    business_id: 'biz-5',
    payload: {
      product_id: 'prod-route',
      product: {
        id: 'prod-route',
        business_id: 'biz-5',
        code: 'PRD-ROUTE',
        name: 'Producto route'
      }
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertProductFn: async () => ({ data: { id: 'prod-route' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta product.delete al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'product.delete',
    business_id: 'biz-del-4',
    payload: {
      product_id: 'prod-route-del',
      business_id: 'biz-del-4'
    }
  }, {
    getProductSyncStateByIdFn: async () => ({ data: { id: 'prod-route-del' }, error: null }),
    deleteProductByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleTableCreateMutation hace ack si la mesa ya existe', async () => {
  const result = await handleTableCreateMutation({
    mutation_type: 'table.create',
    business_id: 'biz-table-1',
    payload: {
      table_id: 'table-1',
      table_number: 10,
      business_id: 'biz-table-1'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-1' }, error: null }),
    insertTableFn: async () => {
      throw new Error('no debería insertar');
    }
  });

  assert.equal(result.ack, true);
});

test('handleTableCreateMutation inserta y hace ack cuando no existe', async () => {
  let inserted = false;
  const result = await handleTableCreateMutation({
    mutation_type: 'table.create',
    business_id: 'biz-table-2',
    payload: {
      table_id: 'table-2',
      table_number: 3,
      business_id: 'biz-table-2'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertTableFn: async (row) => {
      inserted = true;
      assert.equal(row.id, 'table-2');
      assert.equal(row.business_id, 'biz-table-2');
      assert.equal(row.table_number, 3);
      return { data: { id: 'table-2' }, error: null };
    }
  });

  assert.equal(inserted, true);
  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta table.create al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'table.create',
    business_id: 'biz-table-3',
    payload: {
      table_id: 'table-3',
      table_number: 8,
      business_id: 'biz-table-3'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertTableFn: async () => ({ data: { id: 'table-3' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderCreateMutation hace ack si la orden ya existe', async () => {
  const result = await handleOrderCreateMutation({
    mutation_type: 'order.create',
    business_id: 'biz-order-1',
    payload: {
      order_id: 'ord-existing',
      table_id: 'table-order-1',
      user_id: 'user-1',
      business_id: 'biz-order-1'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-existing' }, error: null }),
    insertOrderFn: async () => {
      throw new Error('no debería insertar');
    },
    updateTableByIdFn: async () => {
      throw new Error('no debería ocupar mesa');
    }
  });

  assert.equal(result.ack, true);
});

test('handleOrderCreateMutation inserta orden y ocupa mesa', async () => {
  const calls = [];
  const result = await handleOrderCreateMutation({
    mutation_type: 'order.create',
    business_id: 'biz-order-2',
    payload: {
      order_id: 'ord-new',
      table_id: 'table-order-2',
      user_id: 'user-2',
      business_id: 'biz-order-2'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderFn: async (row) => {
      calls.push(`insert:${row.id}`);
      assert.equal(row.business_id, 'biz-order-2');
      assert.equal(row.table_id, 'table-order-2');
      return { data: { id: 'ord-new' }, error: null };
    },
    updateTableByIdFn: async (tableId, payload) => {
      calls.push(`table:${tableId}:${payload.current_order_id}:${payload.status}`);
      return { error: null };
    }
  });

  assert.deepEqual(calls, ['insert:ord-new', 'table:table-order-2:ord-new:occupied']);
  assert.equal(result.ack, true);
});

test('handleOrderCreateMutation marca retryable en error de red', async () => {
  const result = await handleOrderCreateMutation({
    mutation_type: 'order.create',
    business_id: 'biz-order-3',
    payload: {
      order_id: 'ord-net',
      table_id: 'table-order-3',
      user_id: 'user-3',
      business_id: 'biz-order-3'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderFn: async () => {
      throw new Error('Failed to fetch');
    },
    updateTableByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta order.create al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.create',
    business_id: 'biz-order-4',
    payload: {
      order_id: 'ord-route',
      table_id: 'table-order-4',
      user_id: 'user-4',
      business_id: 'biz-order-4'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderFn: async () => ({ data: { id: 'ord-route' }, error: null }),
    updateTableByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderCloseSingleMutation cierra orden y libera mesa', async () => {
  const calls = [];
  const result = await handleOrderCloseSingleMutation({
    mutation_type: 'order.close.single',
    business_id: 'biz-close-1',
    payload: {
      order_id: 'ord-close-1',
      table_id: 'table-close-1',
      business_id: 'biz-close-1'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-close-1', status: 'open' }, error: null }),
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-close-1', status: 'occupied', current_order_id: 'ord-close-1' }, error: null }),
    updateOrderByBusinessAndIdFn: async ({ businessId, orderId, payload }) => {
      calls.push(`order:${businessId}:${orderId}:${payload.status}`);
      return { error: null };
    },
    updateTableByBusinessAndIdFn: async ({ businessId, tableId, payload }) => {
      calls.push(`table:${businessId}:${tableId}:${payload.status}:${String(payload.current_order_id)}`);
      return { error: null };
    }
  });

  assert.deepEqual(calls, [
    'order:biz-close-1:ord-close-1:closed',
    'table:biz-close-1:table-close-1:available:null'
  ]);
  assert.equal(result.ack, true);
});

test('handleOrderCloseSplitMutation hace ack idempotente si ya estaba cerrado/liberado', async () => {
  const result = await handleOrderCloseSplitMutation({
    mutation_type: 'order.close.split',
    business_id: 'biz-close-2',
    payload: {
      order_id: 'ord-close-2',
      table_id: 'table-close-2',
      business_id: 'biz-close-2'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-close-2', status: 'closed' }, error: null }),
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-close-2', status: 'available', current_order_id: null }, error: null }),
    updateOrderByBusinessAndIdFn: async () => {
      throw new Error('no debería actualizar orden');
    },
    updateTableByBusinessAndIdFn: async () => {
      throw new Error('no debería actualizar mesa');
    }
  });

  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta order.close.single al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.close.single',
    business_id: 'biz-close-3',
    payload: {
      order_id: 'ord-close-3',
      table_id: 'table-close-3',
      business_id: 'biz-close-3'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-close-3', status: 'open' }, error: null }),
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-close-3', status: 'occupied', current_order_id: 'ord-close-3' }, error: null }),
    updateOrderByBusinessAndIdFn: async () => ({ error: null }),
    updateTableByBusinessAndIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta order.close.split al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.close.split',
    business_id: 'biz-close-4',
    payload: {
      order_id: 'ord-close-4',
      table_id: 'table-close-4',
      business_id: 'biz-close-4'
    }
  }, {
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-close-4', status: 'open' }, error: null }),
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-close-4', status: 'occupied', current_order_id: 'ord-close-4' }, error: null }),
    updateOrderByBusinessAndIdFn: async () => ({ error: null }),
    updateTableByBusinessAndIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderDeleteAndReleaseTableMutation libera mesa y borra orden', async () => {
  const calls = [];
  const result = await handleOrderDeleteAndReleaseTableMutation({
    mutation_type: 'order.delete_and_release_table',
    business_id: 'biz-delrel-1',
    payload: {
      order_id: 'ord-delrel-1',
      table_id: 'table-delrel-1',
      business_id: 'biz-delrel-1'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-delrel-1', status: 'occupied', current_order_id: 'ord-delrel-1' }, error: null }),
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-delrel-1', status: 'open' }, error: null }),
    updateTableByBusinessAndIdFn: async ({ businessId, tableId, payload }) => {
      calls.push(`table:${businessId}:${tableId}:${payload.status}:${String(payload.current_order_id)}`);
      return { error: null };
    },
    deleteOrderByIdFn: async (orderId) => {
      calls.push(`order:${orderId}`);
      return { error: null };
    }
  });

  assert.deepEqual(calls, [
    'table:biz-delrel-1:table-delrel-1:available:null',
    'order:ord-delrel-1'
  ]);
  assert.equal(result.ack, true);
});

test('handleOrderDeleteAndReleaseTableMutation hace ack idempotente si la orden ya no existe', async () => {
  const result = await handleOrderDeleteAndReleaseTableMutation({
    mutation_type: 'order.delete_and_release_table',
    business_id: 'biz-delrel-2',
    payload: {
      order_id: 'ord-delrel-2',
      table_id: 'table-delrel-2',
      business_id: 'biz-delrel-2'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-delrel-2', status: 'available', current_order_id: null }, error: null }),
    getOrderSyncStateByIdFn: async () => ({ data: null, error: null }),
    updateTableByBusinessAndIdFn: async () => {
      throw new Error('no debería actualizar mesa');
    },
    deleteOrderByIdFn: async () => {
      throw new Error('no debería borrar orden');
    }
  });

  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta order.delete_and_release_table al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.delete_and_release_table',
    business_id: 'biz-delrel-3',
    payload: {
      order_id: 'ord-delrel-3',
      table_id: 'table-delrel-3',
      business_id: 'biz-delrel-3'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-delrel-3', status: 'occupied', current_order_id: 'ord-delrel-3' }, error: null }),
    getOrderSyncStateByIdFn: async () => ({ data: { id: 'ord-delrel-3', status: 'open' }, error: null }),
    updateTableByBusinessAndIdFn: async () => ({ error: null }),
    deleteOrderByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleTableDeleteCascadeOrdersMutation hace ack si la mesa ya no existe', async () => {
  const result = await handleTableDeleteCascadeOrdersMutation({
    mutation_type: 'table.delete_cascade_orders',
    business_id: 'biz-tdel-1',
    payload: {
      table_id: 'table-tdel-1',
      business_id: 'biz-tdel-1'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: null, error: null }),
    updateTableByBusinessAndIdFn: async () => {
      throw new Error('no debería actualizar mesa');
    },
    deleteOrdersByBusinessAndTableIdFn: async () => {
      throw new Error('no debería borrar órdenes');
    },
    deleteTableByBusinessAndIdFn: async () => {
      throw new Error('no debería borrar mesa');
    }
  });

  assert.equal(result.ack, true);
});

test('handleTableDeleteCascadeOrdersMutation libera mesa, borra órdenes y mesa', async () => {
  const calls = [];
  const result = await handleTableDeleteCascadeOrdersMutation({
    mutation_type: 'table.delete_cascade_orders',
    business_id: 'biz-tdel-2',
    payload: {
      table_id: 'table-tdel-2',
      business_id: 'biz-tdel-2'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-tdel-2' }, error: null }),
    updateTableByBusinessAndIdFn: async ({ businessId, tableId }) => {
      calls.push(`release:${businessId}:${tableId}`);
      return { error: null };
    },
    deleteOrdersByBusinessAndTableIdFn: async ({ businessId, tableId }) => {
      calls.push(`orders:${businessId}:${tableId}`);
      return { error: null };
    },
    deleteTableByBusinessAndIdFn: async ({ businessId, tableId }) => {
      calls.push(`table:${businessId}:${tableId}`);
      return { error: null };
    }
  });

  assert.deepEqual(calls, [
    'release:biz-tdel-2:table-tdel-2',
    'orders:biz-tdel-2:table-tdel-2',
    'table:biz-tdel-2:table-tdel-2'
  ]);
  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta table.delete_cascade_orders al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'table.delete_cascade_orders',
    business_id: 'biz-tdel-3',
    payload: {
      table_id: 'table-tdel-3',
      business_id: 'biz-tdel-3'
    }
  }, {
    getTableSyncStateByIdFn: async () => ({ data: { id: 'table-tdel-3' }, error: null }),
    updateTableByBusinessAndIdFn: async () => ({ error: null }),
    deleteOrdersByBusinessAndTableIdFn: async () => ({ error: null }),
    deleteTableByBusinessAndIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleTableConsistencyDetectedMutation hace ack con business_id válido', async () => {
  const result = await handleTableConsistencyDetectedMutation({
    mutation_type: 'table.consistency.detected',
    business_id: 'biz-cons-1',
    payload: {
      business_id: 'biz-cons-1',
      findings_count: 2
    }
  });

  assert.equal(result.ack, true);
});

test('handleTableConsistencyDetectedMutation rechaza payload sin business_id', async () => {
  const result = await handleTableConsistencyDetectedMutation({
    mutation_type: 'table.consistency.detected',
    payload: {
      findings_count: 1
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta table.consistency.detected al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'table.consistency.detected',
    business_id: 'biz-cons-2',
    payload: {
      business_id: 'biz-cons-2'
    }
  });

  assert.equal(result.ack, true);
});

test('handleTableConsistencyFixFailedMutation hace ack con business_id válido', async () => {
  const result = await handleTableConsistencyFixFailedMutation({
    mutation_type: 'table.consistency.fix_failed',
    business_id: 'biz-cons-3',
    payload: {
      business_id: 'biz-cons-3',
      reason: 'No se pudo aplicar fix'
    }
  });

  assert.equal(result.ack, true);
});

test('handleTableConsistencyFixFailedMutation rechaza payload sin business_id', async () => {
  const result = await handleTableConsistencyFixFailedMutation({
    mutation_type: 'table.consistency.fix_failed',
    payload: {
      reason: 'missing business'
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta table.consistency.fix_failed al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'table.consistency.fix_failed',
    business_id: 'biz-cons-4',
    payload: {
      business_id: 'biz-cons-4',
      reason: 'error de consistencia'
    }
  });

  assert.equal(result.ack, true);
});

test('handleOrderTotalUpdateMutation hace ack cuando updater responde ok', async () => {
  let called = false;
  const result = await handleOrderTotalUpdateMutation({
    mutation_type: 'order.total.update',
    payload: {
      order_id: 'ord-1',
      total: 45000
    }
  }, {
    updateOrderByIdFn: async (orderId, payload) => {
      called = true;
      assert.equal(orderId, 'ord-1');
      assert.equal(payload.total, 45000);
      return { data: { id: 'ord-1' }, error: null };
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('handleOrderTotalUpdateMutation marca retryable en error de red', async () => {
  const result = await handleOrderTotalUpdateMutation({
    mutation_type: 'order.total.update',
    payload: {
      order_id: 'ord-2',
      total: 50000
    }
  }, {
    updateOrderByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleOrderTotalUpdateMutation rechaza definitivamente payload inválido', async () => {
  const result = await handleOrderTotalUpdateMutation({
    mutation_type: 'order.total.update',
    payload: {
      total: 30000
    }
  }, {
    updateOrderByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta order.total.update al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.total.update',
    payload: {
      order_id: 'ord-3',
      total: 35000
    }
  }, {
    updateOrderByIdFn: async () => ({ data: { id: 'ord-3' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemUpdateQuantityMutation hace ack cuando updater responde ok', async () => {
  let called = false;
  const result = await handleOrderItemUpdateQuantityMutation({
    mutation_type: 'order.item.update_quantity',
    payload: {
      item_id: 'item-1',
      quantity: 3
    }
  }, {
    updateOrderItemByIdFn: async (itemId, payload) => {
      called = true;
      assert.equal(itemId, 'item-1');
      assert.equal(payload.quantity, 3);
      return { data: { id: 'item-1' }, error: null };
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('handleOrderItemUpdateQuantityMutation marca retryable en error de red', async () => {
  const result = await handleOrderItemUpdateQuantityMutation({
    mutation_type: 'order.item.update_quantity',
    payload: {
      item_id: 'item-2',
      quantity: 5
    }
  }, {
    updateOrderItemByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleOrderItemUpdateQuantityMutation rechaza payload inválido', async () => {
  const result = await handleOrderItemUpdateQuantityMutation({
    mutation_type: 'order.item.update_quantity',
    payload: {
      item_id: 'item-3'
    }
  }, {
    updateOrderItemByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta order.item.update_quantity al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.item.update_quantity',
    payload: {
      item_id: 'item-4',
      quantity: 2
    }
  }, {
    updateOrderItemByIdFn: async () => ({ data: { id: 'item-4' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemDeleteMutation hace ack si item ya no existe', async () => {
  const result = await handleOrderItemDeleteMutation({
    mutation_type: 'order.item.delete',
    payload: {
      item_id: 'item-gone'
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: null, error: null }),
    deleteOrderItemByIdFn: async () => {
      throw new Error('no debería borrar');
    }
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemDeleteMutation borra item y hace ack cuando existe', async () => {
  let deleted = false;
  const result = await handleOrderItemDeleteMutation({
    mutation_type: 'order.item.delete',
    payload: {
      item_id: 'item-del-1'
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: { id: 'item-del-1' }, error: null }),
    deleteOrderItemByIdFn: async (itemId) => {
      deleted = true;
      assert.equal(itemId, 'item-del-1');
      return { error: null };
    }
  });

  assert.equal(deleted, true);
  assert.equal(result.ack, true);
});

test('handleOrderItemDeleteMutation marca retryable en error de red', async () => {
  const result = await handleOrderItemDeleteMutation({
    mutation_type: 'order.item.delete',
    payload: {
      item_id: 'item-del-2'
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: { id: 'item-del-2' }, error: null }),
    deleteOrderItemByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta order.item.delete al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.item.delete',
    payload: {
      item_id: 'item-del-3'
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: { id: 'item-del-3' }, error: null }),
    deleteOrderItemByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemInsertMutation hace ack si item ya existe', async () => {
  const result = await handleOrderItemInsertMutation({
    mutation_type: 'order.item.insert',
    payload: {
      item_id: 'item-ins-1',
      order_id: 'ord-ins-1',
      quantity: 2,
      price: 1000
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: { id: 'item-ins-1' }, error: null }),
    insertOrderItemFn: async () => {
      throw new Error('no debería insertar');
    }
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemInsertMutation inserta y hace ack cuando no existe', async () => {
  let inserted = false;
  const result = await handleOrderItemInsertMutation({
    mutation_type: 'order.item.insert',
    payload: {
      item_id: 'item-ins-2',
      order_id: 'ord-ins-2',
      product_id: 'prod-ins-2',
      quantity: 3,
      price: 2500
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderItemFn: async (row) => {
      inserted = true;
      assert.equal(row.id, 'item-ins-2');
      assert.equal(row.order_id, 'ord-ins-2');
      assert.equal(row.quantity, 3);
      assert.equal(row.subtotal, 7500);
      return { data: { id: 'item-ins-2' }, error: null };
    }
  });

  assert.equal(inserted, true);
  assert.equal(result.ack, true);
});

test('handleOrderItemInsertMutation hace ack ante duplicado', async () => {
  const result = await handleOrderItemInsertMutation({
    mutation_type: 'order.item.insert',
    payload: {
      item_id: 'item-ins-dup',
      order_id: 'ord-ins-dup',
      quantity: 1,
      price: 500
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderItemFn: async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' }
    })
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemInsertMutation marca retryable en error de red', async () => {
  const result = await handleOrderItemInsertMutation({
    mutation_type: 'order.item.insert',
    payload: {
      item_id: 'item-ins-net',
      order_id: 'ord-ins-net',
      quantity: 1,
      price: 900
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderItemFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta order.item.insert al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.item.insert',
    payload: {
      item_id: 'item-ins-route',
      order_id: 'ord-ins-route',
      quantity: 1,
      price: 1200
    }
  }, {
    getOrderItemSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertOrderItemFn: async () => ({ data: { id: 'item-ins-route' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleOrderItemBulkQuantityUpdateMutation hace ack cuando actualiza todos', async () => {
  const updated = [];
  const result = await handleOrderItemBulkQuantityUpdateMutation({
    mutation_type: 'order.item.bulk_quantity_update',
    payload: {
      updates: [
        { item_id: 'item-bulk-1', quantity: 2 },
        { item_id: 'item-bulk-2', quantity: 4 }
      ]
    }
  }, {
    updateOrderItemByIdFn: async (itemId, payload) => {
      updated.push(`${itemId}:${payload.quantity}`);
      return { error: null };
    }
  });

  assert.deepEqual(updated, ['item-bulk-1:2', 'item-bulk-2:4']);
  assert.equal(result.ack, true);
});

test('handleOrderItemBulkQuantityUpdateMutation marca retryable en error de red', async () => {
  const result = await handleOrderItemBulkQuantityUpdateMutation({
    mutation_type: 'order.item.bulk_quantity_update',
    payload: {
      updates: [
        { item_id: 'item-bulk-net', quantity: 3 }
      ]
    }
  }, {
    updateOrderItemByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleOrderItemBulkQuantityUpdateMutation rechaza payload inválido', async () => {
  const result = await handleOrderItemBulkQuantityUpdateMutation({
    mutation_type: 'order.item.bulk_quantity_update',
    payload: {
      updates: []
    }
  }, {
    updateOrderItemByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta order.item.bulk_quantity_update al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'order.item.bulk_quantity_update',
    payload: {
      updates: [
        { item_id: 'item-bulk-route', quantity: 5 }
      ]
    }
  }, {
    updateOrderItemByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleProductStatusUpdateMutation hace ack al actualizar is_active', async () => {
  let called = false;
  const result = await handleProductStatusUpdateMutation({
    mutation_type: 'product.status.update',
    payload: {
      product_id: 'prod-status-1',
      is_active: false,
      update: { is_active: false }
    }
  }, {
    updateProductByIdFn: async (productId, payload) => {
      called = true;
      assert.equal(productId, 'prod-status-1');
      assert.equal(payload.is_active, false);
      return { data: { id: productId }, error: null };
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta product.status.update al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'product.status.update',
    payload: {
      product_id: 'prod-status-2',
      is_active: true,
      update: { is_active: true }
    }
  }, {
    updateProductByIdFn: async () => ({ data: { id: 'prod-status-2' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation hace ack para mutation_type no implementado', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.unknown',
    payload: { invoice_id: 'inv-1', total: 1000 }
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceCreateMutation hace ack si la factura ya existe', async () => {
  const result = await handleInvoiceCreateMutation({
    mutation_type: 'invoice.create',
    business_id: 'biz-inv-1',
    payload: {
      invoice_id: 'inv-existing',
      invoice: { id: 'inv-existing', business_id: 'biz-inv-1' },
      items: []
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: { id: 'inv-existing' }, error: null }),
    insertInvoiceFn: async () => {
      throw new Error('no debería insertar');
    },
    insertInvoiceItemsFn: async () => ({ error: null }),
    updateStockBatchFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceCreateMutation inserta factura/items/stock y hace ack', async () => {
  let insertedInvoice = false;
  let insertedItems = false;
  let updatedStock = false;

  const result = await handleInvoiceCreateMutation({
    mutation_type: 'invoice.create',
    business_id: 'biz-inv-2',
    payload: {
      invoice_id: 'inv-new',
      invoice: {
        id: 'inv-new',
        business_id: 'biz-inv-2',
        total: 5000,
        status: 'draft'
      },
      items: [
        { product_id: 'p-1', quantity: 2, product_name: 'Prod 1' }
      ]
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertInvoiceFn: async (row) => {
      insertedInvoice = true;
      assert.equal(row.id, 'inv-new');
      return { data: { id: 'inv-new' }, error: null };
    },
    insertInvoiceItemsFn: async (rows) => {
      insertedItems = true;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].invoice_id, 'inv-new');
      return { error: null };
    },
    updateStockBatchFn: async (updates) => {
      updatedStock = true;
      assert.equal(updates.length, 1);
      assert.equal(updates[0].product_id, 'p-1');
      assert.equal(updates[0].quantity, 2);
      return { error: null };
    }
  });

  assert.equal(insertedInvoice, true);
  assert.equal(insertedItems, true);
  assert.equal(updatedStock, true);
  assert.equal(result.ack, true);
});

test('handleInvoiceCreateMutation hace ack ante duplicado de factura', async () => {
  const result = await handleInvoiceCreateMutation({
    mutation_type: 'invoice.create',
    business_id: 'biz-inv-3',
    payload: {
      invoice_id: 'inv-dup',
      invoice: { id: 'inv-dup', business_id: 'biz-inv-3' },
      items: []
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertInvoiceFn: async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' }
    }),
    insertInvoiceItemsFn: async () => ({ error: null }),
    updateStockBatchFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceCreateMutation marca retryable en error de red', async () => {
  const result = await handleInvoiceCreateMutation({
    mutation_type: 'invoice.create',
    business_id: 'biz-inv-4',
    payload: {
      invoice_id: 'inv-net',
      invoice: { id: 'inv-net', business_id: 'biz-inv-4' },
      items: []
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertInvoiceFn: async () => {
      throw new Error('Failed to fetch');
    },
    insertInvoiceItemsFn: async () => ({ error: null }),
    updateStockBatchFn: async () => ({ error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta invoice.create al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.create',
    business_id: 'biz-inv-5',
    payload: {
      invoice_id: 'inv-route',
      invoice: { id: 'inv-route', business_id: 'biz-inv-5' },
      items: []
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: null, error: null }),
    insertInvoiceFn: async () => ({ data: { id: 'inv-route' }, error: null }),
    insertInvoiceItemsFn: async () => ({ error: null }),
    updateStockBatchFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceSentMutation hace ack cuando updater responde ok', async () => {
  let called = false;
  const result = await handleInvoiceSentMutation({
    mutation_type: 'invoice.sent',
    payload: {
      invoice_id: 'inv-2',
      sent_at: '2026-04-20T10:00:00.000Z'
    }
  }, {
    updateInvoiceByIdFn: async (invoiceId, payload) => {
      called = true;
      assert.equal(invoiceId, 'inv-2');
      assert.equal(payload.status, 'sent');
      assert.equal(payload.sent_at, '2026-04-20T10:00:00.000Z');
      return { data: null, error: null };
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('handleInvoiceSentMutation marca retryable en error de red', async () => {
  const result = await handleInvoiceSentMutation({
    mutation_type: 'invoice.sent',
    payload: {
      invoice_id: 'inv-3'
    }
  }, {
    updateInvoiceByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta invoice.sent al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.sent',
    payload: {
      invoice_id: 'inv-4',
      sent_at: '2026-04-20T10:02:00.000Z'
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceUpdateMutation hace ack cuando updater responde ok', async () => {
  let called = false;
  const result = await handleInvoiceUpdateMutation({
    mutation_type: 'invoice.update',
    payload: {
      invoice_id: 'inv-upd-1',
      update: {
        total: 7800,
        notes: 'Ajuste manual'
      }
    }
  }, {
    updateInvoiceByIdFn: async (invoiceId, payload) => {
      called = true;
      assert.equal(invoiceId, 'inv-upd-1');
      assert.equal(payload.total, 7800);
      assert.equal(payload.notes, 'Ajuste manual');
      return { data: { id: invoiceId }, error: null };
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('handleInvoiceUpdateMutation marca retryable en error de red', async () => {
  const result = await handleInvoiceUpdateMutation({
    mutation_type: 'invoice.update',
    payload: {
      invoice_id: 'inv-upd-2',
      update: { status: 'paid' }
    }
  }, {
    updateInvoiceByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleInvoiceUpdateMutation rechaza definitivamente payload inválido', async () => {
  const result = await handleInvoiceUpdateMutation({
    mutation_type: 'invoice.update',
    payload: {
      invoice_id: 'inv-upd-3'
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta invoice.update al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.update',
    payload: {
      invoice_id: 'inv-upd-4',
      update: { status: 'paid' }
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: { id: 'inv-upd-4' }, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceCancelledMutation hace ack cuando updater responde ok', async () => {
  let called = false;
  const result = await handleInvoiceCancelledMutation({
    mutation_type: 'invoice.cancelled',
    payload: {
      invoice_id: 'inv-cxl-1',
      cancelled_at: '2026-04-20T12:00:00.000Z'
    }
  }, {
    updateInvoiceByIdFn: async (invoiceId, payload) => {
      called = true;
      assert.equal(invoiceId, 'inv-cxl-1');
      assert.equal(payload.status, 'cancelled');
      assert.equal(payload.cancelled_at, '2026-04-20T12:00:00.000Z');
      return { data: null, error: null };
    },
    restoreStockBatchFn: async () => {
      throw new Error('no debería restaurar stock sin restore_stock_warning');
    }
  });

  assert.equal(called, true);
  assert.equal(result.ack, true);
});

test('handleInvoiceCancelledMutation restaura stock cuando restore_stock_warning=true', async () => {
  let restored = false;
  const result = await handleInvoiceCancelledMutation({
    mutation_type: 'invoice.cancelled',
    payload: {
      invoice_id: 'inv-cxl-rs-1',
      cancelled_at: '2026-04-20T12:05:00.000Z',
      restore_stock_warning: true,
      product_updates: [
        { product_id: 'prod-1', quantity: 2 },
        { product_id: 'prod-2', quantity: 1 }
      ]
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null }),
    restoreStockBatchFn: async (updates) => {
      restored = true;
      assert.equal(updates.length, 2);
      assert.equal(updates[0].product_id, 'prod-1');
      assert.equal(updates[0].quantity, 2);
      assert.equal(updates[1].product_id, 'prod-2');
      assert.equal(updates[1].quantity, 1);
      return { error: null };
    }
  });

  assert.equal(restored, true);
  assert.equal(result.ack, true);
});

test('handleInvoiceCancelledMutation marca retryable en error de red', async () => {
  const result = await handleInvoiceCancelledMutation({
    mutation_type: 'invoice.cancelled',
    payload: {
      invoice_id: 'inv-cxl-2'
    }
  }, {
    updateInvoiceByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleInvoiceCancelledMutation marca retryable si falla restore stock por red', async () => {
  const result = await handleInvoiceCancelledMutation({
    mutation_type: 'invoice.cancelled',
    payload: {
      invoice_id: 'inv-cxl-rs-2',
      restore_stock_warning: true,
      product_updates: [
        { product_id: 'prod-rs-1', quantity: 1 }
      ]
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null }),
    restoreStockBatchFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('handleInvoiceCancelledMutation rechaza definitivamente payload inválido', async () => {
  const result = await handleInvoiceCancelledMutation({
    mutation_type: 'invoice.cancelled',
    payload: {}
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, false);
});

test('dispatchOutboxMutation enruta invoice.cancelled al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.cancelled',
    payload: {
      invoice_id: 'inv-cxl-3'
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, true);
});

test('dispatchOutboxMutation enruta invoice.cancel al handler real (alias)', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.cancel',
    payload: {
      invoice_id: 'inv-cxl-4',
      cancelled_at: '2026-04-20T12:10:00.000Z'
    }
  }, {
    updateInvoiceByIdFn: async () => ({ data: null, error: null })
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceDeleteMutation hace ack si la factura ya no existe', async () => {
  const result = await handleInvoiceDeleteMutation({
    mutation_type: 'invoice.delete',
    business_id: 'biz-del-inv-1',
    payload: {
      invoice_id: 'inv-gone',
      business_id: 'biz-del-inv-1'
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: null, error: null }),
    deleteInvoiceItemsByInvoiceIdFn: async () => {
      throw new Error('no debería borrar items');
    },
    deleteInvoiceByIdFn: async () => {
      throw new Error('no debería borrar factura');
    }
  });

  assert.equal(result.ack, true);
});

test('handleInvoiceDeleteMutation elimina items y factura cuando existe', async () => {
  const calls = [];
  const result = await handleInvoiceDeleteMutation({
    mutation_type: 'invoice.delete',
    business_id: 'biz-del-inv-2',
    payload: {
      invoice_id: 'inv-del-1',
      business_id: 'biz-del-inv-2'
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: { id: 'inv-del-1' }, error: null }),
    deleteInvoiceItemsByInvoiceIdFn: async (invoiceId) => {
      calls.push(`items:${invoiceId}`);
      return { error: null };
    },
    deleteInvoiceByIdFn: async (invoiceId) => {
      calls.push(`invoice:${invoiceId}`);
      return { error: null };
    }
  });

  assert.deepEqual(calls, ['items:inv-del-1', 'invoice:inv-del-1']);
  assert.equal(result.ack, true);
});

test('handleInvoiceDeleteMutation marca retryable en error de red', async () => {
  const result = await handleInvoiceDeleteMutation({
    mutation_type: 'invoice.delete',
    business_id: 'biz-del-inv-3',
    payload: {
      invoice_id: 'inv-del-net',
      business_id: 'biz-del-inv-3'
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: { id: 'inv-del-net' }, error: null }),
    deleteInvoiceItemsByInvoiceIdFn: async () => ({ error: null }),
    deleteInvoiceByIdFn: async () => {
      throw new Error('Failed to fetch');
    }
  });

  assert.equal(result.ack, false);
  assert.equal(result.retryable, true);
});

test('dispatchOutboxMutation enruta invoice.delete al handler real', async () => {
  const result = await dispatchOutboxMutation({
    mutation_type: 'invoice.delete',
    business_id: 'biz-del-inv-4',
    payload: {
      invoice_id: 'inv-del-route',
      business_id: 'biz-del-inv-4'
    }
  }, {
    getInvoiceSyncStateByIdFn: async () => ({ data: { id: 'inv-del-route' }, error: null }),
    deleteInvoiceItemsByInvoiceIdFn: async () => ({ error: null }),
    deleteInvoiceByIdFn: async () => ({ error: null })
  });

  assert.equal(result.ack, true);
});
