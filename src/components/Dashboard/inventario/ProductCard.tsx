import { motion } from 'framer-motion';
import {
  Box,
  Tag,
  BarChart3,
  Building2,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Edit,
  Trash2,
} from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { formatPrice } from '../../../utils/formatters';
import type { ProductCardProps } from '@/types/components';

function getStockBadgeClass(stock: number, minStock: number): string {
  if (stock <= minStock) return 'bg-red-100 text-red-800';
  if (stock <= minStock * 2) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

export function ProductCard({ product, index, lowMotionMode, hasAdminPrivileges, isEmployee, onEdit, onDelete, onToggleActive }: ProductCardProps) {
  return (
    <motion.div
      key={product.id}
      initial={lowMotionMode ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.01 }}
    >
      <Card
        className={`shadow-lg rounded-2xl bg-white border-2 hover:shadow-xl transition-all duration-300 ${
          product.manage_stock !== false && product.stock <= product.min_stock
            ? 'border-red-300 bg-red-50/30'
            : 'border-accent-100 hover:border-primary-300'
        }`}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-accent-200">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Box className="w-5 h-5 text-primary-600 shrink-0" />
                <h3 className="text-lg font-bold text-primary-900 truncate">{product.name}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-accent-100 text-accent-700 border border-accent-200">
                  <Tag className="w-3 h-3 mr-1" />
                  {product.code || 'Sin código'}
                </Badge>
                {product.category && (
                  <Badge className="bg-gray-100 text-gray-700 border border-gray-200">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    {product.category}
                  </Badge>
                )}
              </div>
            </div>

            <div className="shrink-0">
              {hasAdminPrivileges ? (
                <Button
                  onClick={() => onToggleActive(product.id, product.is_active)}
                  className={`h-9 px-3 rounded-xl font-medium text-xs transition-all duration-300 ${
                    product.is_active
                      ? 'bg-green-100 hover:bg-green-200 text-green-800 border-none'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-none'
                  }`}
                >
                  {product.is_active ? '✓ Activo' : '✗ Inactivo'}
                </Button>
              ) : (
                <Badge
                  className={`${
                    product.is_active
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  } border`}
                >
                  {product.is_active ? '✓ Activo' : '✗ Inactivo'}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-accent-600" />
                <span className="text-xs text-accent-500 uppercase tracking-wide">Proveedor</span>
              </div>
              <p className="text-sm font-medium text-gray-700 truncate">
                {product.supplier
                  ? product.supplier.business_name || product.supplier.contact_name || 'Sin proveedor'
                  : 'Sin proveedor'}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-accent-500 uppercase tracking-wide">P. Compra</span>
              </div>
              <p className="text-base font-bold text-orange-600">{formatPrice(product.purchase_price)}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-accent-500 uppercase tracking-wide">P. Venta</span>
              </div>
              <p className="text-base font-bold text-green-600">{formatPrice(product.sale_price)}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-primary-600" />
                <span className="text-xs text-accent-500 uppercase tracking-wide">Stock</span>
              </div>
              <div className="flex items-center gap-2">
                {product.manage_stock === false ? (
                  <Badge className="bg-slate-100 text-slate-700 border border-slate-200">Sin control de stock</Badge>
                ) : (
                  <>
                    <Badge className={getStockBadgeClass(product.stock, product.min_stock)}>
                      {product.stock} {product.unit}
                    </Badge>
                    {product.stock <= product.min_stock && (
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-accent-600" />
                <span className="text-xs text-accent-500 uppercase tracking-wide">Mínimo</span>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {product.manage_stock === false ? 'No aplica' : `${product.min_stock} ${product.unit}`}
              </p>
            </div>
          </div>

          {hasAdminPrivileges && !isEmployee && (
            <div className="pt-4 border-t border-accent-200 space-y-2">
              <Button
                onClick={() => onEdit(product)}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <Edit className="w-4 h-4" />
                <span className="text-sm">Editar Producto</span>
              </Button>
              <Button
                onClick={() => onDelete(product.id)}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Eliminar Producto</span>
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
