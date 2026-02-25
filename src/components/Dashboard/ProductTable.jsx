import React, { useState } from 'react';
import { motion } from 'framer-motion';

import {
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const _motionLintUsage = motion;

export function ProductTable({
  products = [],
  onEdit,
  onDelete,
  onView,
  itemsPerPage = 10
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Sorting logic
  const sortedProducts = React.useMemo(() => {
    let sortableProducts = [...products];
    if (sortConfig.key) {
      sortableProducts.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableProducts;
  }, [products, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = sortedProducts.slice(startIndex, endIndex);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getStockBadge = (stock, minStock = 10) => {
    if (stock === 0) {
      return <Badge variant="destructive">Sin stock</Badge>;
    }
    if (stock < minStock) {
      return <Badge variant="warning">Stock bajo</Badge>;
    }
    return <Badge variant="success">En stock</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden dark:bg-primary-900 dark:border-primary-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                onClick={() => handleSort('code')}
                className="cursor-pointer hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-2 font-semibold text-primary">
                  Código
                  {sortConfig.key === 'code' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead 
                onClick={() => handleSort('name')}
                className="cursor-pointer hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-2 font-semibold text-primary">
                  Producto
                  {sortConfig.key === 'name' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead className="font-semibold text-primary">Categoría</TableHead>
              <TableHead 
                onClick={() => handleSort('price')}
                className="cursor-pointer hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-2 font-semibold text-primary">
                  Precio
                  {sortConfig.key === 'price' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead 
                onClick={() => handleSort('stock')}
                className="cursor-pointer hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-2 font-semibold text-primary">
                  Stock
                  {sortConfig.key === 'stock' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead className="font-semibold text-primary">Estado</TableHead>
              <TableHead className="text-right font-semibold text-primary">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  No hay productos para mostrar
                </TableCell>
              </TableRow>
            ) : (
              currentProducts.map((product, index) => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="border-b transition-colors hover:bg-accent/5 group"
                >
                  <TableCell className="font-mono text-sm text-gray-600">
                    {product.code}
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {product.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {product.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-accent">
                    ${Number(product.price).toLocaleString('es-CO')}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "font-medium",
                      product.stock < 10 ? "text-red-600" : "text-gray-900"
                    )}>
                      {product.stock}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStockBadge(product.stock)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView?.(product)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-accent/10 hover:text-accent"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit?.(product)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-accent/10 hover:text-accent"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete?.(product)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4">
          <p className="text-sm text-gray-600">
            Mostrando {startIndex + 1} a {Math.min(endIndex, sortedProducts.length)} de{' '}
            {sortedProducts.length} productos
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-lg"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-10 rounded-lg",
                      currentPage === pageNum && "bg-primary text-white"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-lg"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
