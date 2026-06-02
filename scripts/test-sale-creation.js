/**
 * Script de prueba para verificar creación de ventas
 * Ejecutar desde consola del navegador en localhost:5173
 */

console.log('🧪 Iniciando prueba de creación de venta...\n');

// Simular datos de prueba
const testSaleData = {
  businessId: 'test-business-id', // Reemplazar con ID real
  cart: [
    {
      product_id: 'test-product-1',
      product_name: 'Producto de Prueba 1',
      quantity: 2,
      unit_price: 10000,
      subtotal: 20000,
      tax_percentage: 19
    },
    {
      product_id: 'test-product-2',
      product_name: 'Producto de Prueba 2',
      quantity: 1,
      unit_price: 15000,
      subtotal: 15000,
      tax_percentage: 19
    }
  ],
  paymentMethod: 'cash',
  total: 35000
};

console.log('📦 Datos de prueba:', testSaleData);

console.log('\n✅ Verificaciones:');
console.log('  ✓ NO se incluye parámetro "generateElectronicInvoice"');
console.log('  ✓ NO se incluye parámetro "documentType"');
console.log('  ✓ NO se incluye campo "is_electronic_invoice"');
console.log('  ✓ NO se incluye campo "document_type"');

console.log('\n📋 Para probar manualmente:');
console.log('  1. Inicia sesión en la aplicación');
console.log('  2. Ve a la sección de Ventas');
console.log('  3. Agrega productos al carrito');
console.log('  4. Verifica que solo aparezca "Comprobante de venta"');
console.log('  5. Procesa la venta');
console.log('  6. Verifica que NO haya errores de columnas inexistentes');

console.log('\n🔍 Consulta SQL para verificar la última venta creada:');
console.log(`
SELECT 
  id,
  business_id,
  total,
  payment_method,
  created_at,
  electronic_invoice_id  -- Debe ser NULL
FROM sales 
ORDER BY created_at DESC 
LIMIT 1;
`);

console.log('\n✅ Si la venta se crea sin errores, la migración fue exitosa!');
