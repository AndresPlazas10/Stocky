/**
 * 📱 EJEMPLO DE INVENTARIO MÓVIL ADAPTADO
 * 
 * Este archivo muestra cómo adaptar el componente Inventario.jsx
 * para usar los componentes móviles optimizados.
 * 
 * Cambios principales:
 * 1. Tabla → MobileTable (cards en móvil, tabla en desktop)
 * 2. Botón añadir → FloatingActionButton en móvil
 * 3. Formulario → MobileModal + MobileForm
 * 4. Cards de estadísticas → MobileStatCard
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice } from '../../utils/formatters.js';
import { useViewport } from '../../hooks/useViewport';
import {
  MobileTable,
  FloatingActionButton,
  MobileModal,
  MobileInput,
  MobileSelect,
  MobileButton,
  MobileStatCard
} from '../mobile';
import {
  Package,
  Plus,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Edit,
  Trash2
} from 'lucide-react';

const MOBILE_PRODUCTS_COLUMNS = 'id, name, category, purchase_price, sale_price, stock, min_stock, supplier_id, unit, is_active, created_at';

function InventarioMobile({ businessId }) {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { isMobile } = useViewport();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    purchase_price: '',
    sale_price: '',
    stock: '',
    min_stock: '',
    supplier_id: ''
  });

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProductos(),
        loadProveedores()
      ]);
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const loadProductos = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(MOBILE_PRODUCTS_COLUMNS)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProductos(data);
    }
  };

  const loadProveedores = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (!error && data) {
      setProveedores(data);
    }
  };

  const handleSave = async () => {
    try {
      // Lógica de guardado aquí
      await loadProductos();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      // Error handled silently
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category || '',
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      stock: product.stock,
      min_stock: product.min_stock || '',
      supplier_id: product.supplier_id || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (product) => {
    if (window.confirm(`¿Eliminar ${product.name}?`)) {
      // Lógica de eliminación
      await loadProductos();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      purchase_price: '',
      sale_price: '',
      stock: '',
      min_stock: '',
      supplier_id: ''
    });
    setEditingProduct(null);
  };

  // Calcular estadísticas
  const totalProductos = productos.length;
  const valorInventario = productos.reduce((sum, p) => sum + (p.stock * p.purchase_price), 0);
  const productosBajoStock = productos.filter(p => p.stock <= (p.min_stock || 5)).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
          Inventario
        </h1>
        
        {/* Botón visible solo en desktop */}
        {!isMobile && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Añadir producto
          </button>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <MobileStatCard
          icon={Package}
          label="Total productos"
          value={totalProductos.toString()}
          color="text-blue-600"
        />
        <MobileStatCard
          icon={DollarSign}
          label="Valor inventario"
          value={formatPrice(valorInventario)}
          color="text-green-600"
        />
        <MobileStatCard
          icon={AlertTriangle}
          label="Bajo stock"
          value={productosBajoStock.toString()}
          color="text-red-600"
        />
      </div>

      {/* Tabla adaptiva */}
      <MobileTable
        data={productos}
        columns={[
          {
            key: 'name',
            label: 'Producto',
            primary: true
          },
          {
            key: 'category',
            label: 'Categoría',
            secondary: true,
            format: (val) => val || 'Sin categoría'
          },
          {
            key: 'sale_price',
            label: 'Precio',
            format: (val) => formatPrice(val)
          },
          {
            key: 'stock',
            label: 'Stock',
            format: (val, item) => {
              const isLow = val <= (item.min_stock || 5);
              return `${val} ${isLow ? '⚠️' : ''}`;
            }
          }
        ]}
        onRowClick={(product) => handleEdit(product)}
        loading={loading}
        emptyMessage="No hay productos en inventario"
        actions={(product) => (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(product);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded active:scale-95 transition-all"
            >
              <Edit size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(product);
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded active:scale-95 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      />

      {/* FAB visible solo en móvil */}
      <FloatingActionButton
        icon={Plus}
        label="Añadir producto"
        onClick={() => {
          resetForm();
          setShowAddModal(true);
        }}
      />

      {/* Modal de formulario */}
      <MobileModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title={editingProduct ? 'Editar producto' : 'Añadir producto'}
        size="md"
        footer={
          <div className="flex gap-3">
            <MobileButton
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancelar
            </MobileButton>
            <MobileButton
              variant="primary"
              fullWidth
              onClick={handleSave}
            >
              {editingProduct ? 'Actualizar' : 'Guardar'}
            </MobileButton>
          </div>
        }
      >
        <div className="space-y-4">
          <MobileInput
            label="Nombre del producto"
            icon={Package}
            placeholder="Ej: Laptop Dell XPS 13"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <MobileInput
            label="Categoría"
            placeholder="Ej: Electrónica"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <MobileInput
              label="Precio compra"
              type="number"
              placeholder="0.00"
              value={formData.purchase_price}
              onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
              required
            />

            <MobileInput
              label="Precio venta"
              type="number"
              placeholder="0.00"
              value={formData.sale_price}
              onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MobileInput
              label="Stock actual"
              type="number"
              placeholder="0"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
            />

            <MobileInput
              label="Stock mínimo"
              type="number"
              placeholder="5"
              value={formData.min_stock}
              onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
            />
          </div>

          <MobileSelect
            label="Proveedor"
            value={formData.supplier_id}
            onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
            options={[
              { value: '', label: 'Seleccionar proveedor...' },
              ...proveedores.map(p => ({ value: p.id, label: p.name }))
            ]}
          />
        </div>
      </MobileModal>
    </div>
  );
}

export default InventarioMobile;
