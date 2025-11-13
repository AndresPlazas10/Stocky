import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Package,
  TrendingUp,
  AlertCircle,
  Plus,
  Download,
  Filter
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MetricCard, MetricsGrid } from '@/components/dashboard/MetricCard';
import { ProductTable } from '@/components/dashboard/ProductTable';
import { ProductDialog } from '@/components/dashboard/ProductDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Mock data - en producción vendría de tu API/Supabase
const mockProducts = [
  { id: 1, code: 'P001', name: 'Café Americano', category: 'Bebidas', price: 3500, cost: 1500, stock: 45, minStock: 10 },
  { id: 2, code: 'P002', name: 'Cappuccino', category: 'Bebidas', price: 4500, cost: 2000, stock: 32, minStock: 10 },
  { id: 3, code: 'P003', name: 'Croissant', category: 'Panadería', price: 2800, cost: 1200, stock: 8, minStock: 15 },
  { id: 4, code: 'P004', name: 'Sandwich Club', category: 'Comida', price: 12000, cost: 6000, stock: 0, minStock: 5 },
  { id: 5, code: 'P005', name: 'Jugo Natural', category: 'Bebidas', price: 5000, cost: 2500, stock: 25, minStock: 10 },
  { id: 6, code: 'P006', name: 'Ensalada César', category: 'Comida', price: 15000, cost: 7500, stock: 18, minStock: 8 },
  { id: 7, code: 'P007', name: 'Latte', category: 'Bebidas', price: 4000, cost: 1800, stock: 40, minStock: 10 },
  { id: 8, code: 'P008', name: 'Brownie', category: 'Postres', price: 3500, cost: 1500, stock: 22, minStock: 12 },
];

const categories = ['Bebidas', 'Comida', 'Panadería', 'Postres'];

export default function DashboardPage() {
  const [products, setProducts] = useState(mockProducts);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Calcular métricas
  const totalSales = 2458900;
  const lowStockCount = products.filter(p => p.stock <= p.minStock && p.stock > 0).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;
  const totalProducts = products.length;

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsDialogOpen(true);
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (product) => {
    if (confirm(`¿Estás seguro de eliminar "${product.name}"?`)) {
      setProducts(products.filter(p => p.id !== product.id));
    }
  };

  const handleViewProduct = (product) => {
    alert(`Ver detalles de: ${product.name}`);
  };

  const handleSaveProduct = (data) => {
    if (data.id) {
      // Editar producto existente
      setProducts(products.map(p => p.id === data.id ? { ...p, ...data } : p));
    } else {
      // Agregar nuevo producto
      const newProduct = {
        ...data,
        id: Math.max(...products.map(p => p.id)) + 1
      };
      setProducts([...products, newProduct]);
    }
  };

  return (
    <DashboardLayout
      userName="Admin Usuario"
      userEmail="admin@stockly.com"
      userRole="Administrador"
    >
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-primary mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Resumen general de tu negocio
        </p>
      </motion.div>

      {/* Metrics Cards */}
      <MetricsGrid columns={4}>
        <MetricCard
          title="Ventas Totales"
          value={`$${totalSales.toLocaleString('es-CO')}`}
          subtitle="Últimos 30 días"
          icon={DollarSign}
          trend="up"
          trendValue="+12.5%"
          variant="default"
          delay={0}
        />
        <MetricCard
          title="Total Productos"
          value={totalProducts}
          subtitle="En inventario"
          icon={Package}
          trend="up"
          trendValue="+3"
          variant="accent"
          delay={0.1}
        />
        <MetricCard
          title="Stock Bajo"
          value={lowStockCount}
          subtitle="Requieren reposición"
          icon={AlertCircle}
          trend="down"
          trendValue="-2"
          variant="warning"
          delay={0.2}
        />
        <MetricCard
          title="Sin Stock"
          value={outOfStockCount}
          subtitle="Productos agotados"
          icon={TrendingUp}
          variant="danger"
          delay={0.3}
        />
      </MetricsGrid>

      {/* Products Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8"
      >
        <Card className="rounded-2xl shadow-md border-2 border-gray-200 dark:border-primary-700">
          {/* Table Header */}
          <div className="p-6 border-b border-gray-200 dark:border-primary-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-1">
                  Inventario de Productos
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Gestiona tu catálogo de productos
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
                <Button
                  onClick={handleAddProduct}
                  className="rounded-xl bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Producto
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <Badge variant="default" className="px-3 py-1">
                Total: {totalProducts}
              </Badge>
              <Badge variant="success" className="px-3 py-1">
                En Stock: {products.filter(p => p.stock > p.minStock).length}
              </Badge>
              <Badge variant="warning" className="px-3 py-1">
                Stock Bajo: {lowStockCount}
              </Badge>
              <Badge variant="destructive" className="px-3 py-1">
                Sin Stock: {outOfStockCount}
              </Badge>
            </div>
          </div>

          {/* Products Table */}
          <div className="p-6">
            <ProductTable
              products={products}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
              onView={handleViewProduct}
              itemsPerPage={5}
            />
          </div>
        </Card>
      </motion.div>

      {/* Product Dialog */}
      <ProductDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveProduct}
        product={selectedProduct}
        categories={categories}
      />

      {/* Quick Actions Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Card className="rounded-2xl shadow-md border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Acciones Rápidas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-accent/10 hover:border-accent"
              >
                <Package className="w-6 h-6 text-accent" />
                <span className="text-sm font-medium">Nueva Venta</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-accent/10 hover:border-accent"
              >
                <DollarSign className="w-6 h-6 text-accent" />
                <span className="text-sm font-medium">Ver Reportes</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-accent/10 hover:border-accent"
              >
                <TrendingUp className="w-6 h-6 text-accent" />
                <span className="text-sm font-medium">Facturas</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-accent/10 hover:border-accent"
              >
                <AlertCircle className="w-6 h-6 text-accent" />
                <span className="text-sm font-medium">Stock Bajo</span>
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
