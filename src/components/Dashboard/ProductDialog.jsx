import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ProductDialog({
  open,
  onClose,
  onSave,
  product = null,
  categories = []
}) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '10',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code || '',
        name: product.name || '',
        category: product.category || '',
        price: product.price?.toString() || '',
        cost: product.cost?.toString() || '',
        stock: product.stock?.toString() || '',
        minStock: product.minStock?.toString() || '10',
        description: product.description || '',
      });
    } else {
      setFormData({
        code: '',
        name: '',
        category: '',
        price: '',
        cost: '',
        stock: '',
        minStock: '10',
        description: '',
      });
    }
    setErrors({});
  }, [product, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = 'El código es requerido';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (!formData.category.trim()) {
      newErrors.category = 'La categoría es requerida';
    }
    if (!formData.price || Number(formData.price) <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }
    if (!formData.stock || Number(formData.stock) < 0) {
      newErrors.stock = 'El stock no puede ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsSubmitting(true);
    
    try {
      const dataToSave = {
        ...formData,
        price: Number(formData.price),
        cost: formData.cost ? Number(formData.cost) : 0,
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        id: product?.id,
      };

      await onSave(dataToSave);
      onClose();
    } catch (error) {
      // Error handled silently
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">
                {product ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription>
                {product 
                  ? 'Actualiza la información del producto' 
                  : 'Completa los datos del nuevo producto'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Código y Nombre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-primary font-medium">
                Código *
              </Label>
              <Input
                id="code"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="P001"
                className={cn(
                  "rounded-xl border-2 focus:border-accent",
                  errors.code && "border-red-500"
                )}
              />
              {errors.code && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.code}
                </motion.p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-primary font-medium">
                Nombre del Producto *
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Café Americano"
                className={cn(
                  "rounded-xl border-2 focus:border-accent",
                  errors.name && "border-red-500"
                )}
              />
              {errors.name && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.name}
                </motion.p>
              )}
            </div>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-primary font-medium">
              Categoría *
            </Label>
            {categories.length > 0 ? (
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
                  errors.category && "border-red-500"
                )}
              >
                <option value="">Selecciona una categoría</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              <Input
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="Bebidas, Comida, etc."
                className={cn(
                  "rounded-xl border-2 focus:border-accent",
                  errors.category && "border-red-500"
                )}
              />
            )}
            {errors.category && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-500"
              >
                {errors.category}
              </motion.p>
            )}
          </div>

          {/* Precio y Costo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-primary font-medium">
                Precio de Venta *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={cn(
                    "pl-8 rounded-xl border-2 focus:border-accent",
                    errors.price && "border-red-500"
                  )}
                />
              </div>
              {errors.price && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.price}
                </motion.p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost" className="text-primary font-medium">
                Costo (opcional)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="cost"
                  name="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="pl-8 rounded-xl border-2 focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Stock y Stock Mínimo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock" className="text-primary font-medium">
                Stock Actual *
              </Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                value={formData.stock}
                onChange={handleChange}
                placeholder="0"
                className={cn(
                  "rounded-xl border-2 focus:border-accent",
                  errors.stock && "border-red-500"
                )}
              />
              {errors.stock && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-500"
                >
                  {errors.stock}
                </motion.p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minStock" className="text-primary font-medium">
                Stock Mínimo
              </Label>
              <Input
                id="minStock"
                name="minStock"
                type="number"
                value={formData.minStock}
                onChange={handleChange}
                placeholder="10"
                className="rounded-xl border-2 focus:border-accent"
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-primary font-medium">
              Descripción (opcional)
            </Label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descripción detallada del producto..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl border-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                  />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {product ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
