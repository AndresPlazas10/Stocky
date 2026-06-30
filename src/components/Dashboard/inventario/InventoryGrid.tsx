import { motion } from 'framer-motion';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { ProductCard } from './ProductCard';
import type { InventoryGridProps } from '@/types/components';

export function InventoryGrid({
  visibleProducts,
  totalProducts,
  canLoadMoreProducts,
  productsSentinelRef,
  loadingMoreProducts,
  loadMoreProducts,
  lowMotionMode,
  hasAdminPrivileges,
  isEmployee,
  onEdit,
  onDelete,
  onToggleActive,
}: InventoryGridProps) {
  if (visibleProducts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              lowMotionMode={lowMotionMode}
              hasAdminPrivileges={hasAdminPrivileges}
              isEmployee={isEmployee}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>

        {canLoadMoreProducts && (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-xs text-gray-500">
              Mostrando {visibleProducts.length} de {totalProducts} productos
            </p>
            <div ref={productsSentinelRef} className="h-2 w-full" aria-hidden="true" />
            <Button
              onClick={loadMoreProducts}
              variant="outline"
              className="rounded-xl"
              disabled={loadingMoreProducts}
            >
              {loadingMoreProducts ? 'Cargando productos...' : 'Cargar mas productos'}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
