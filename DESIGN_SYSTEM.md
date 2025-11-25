# Guía de Estilos Modernos - Stockly

## Paleta de Colores

- **Primary**: #edb886 (Peach cálido)
- **Secondary**: #f1c691 (Dorado suave)
- **Accent**: #ffe498 (Amarillo suave)
- **Neutral**: #b9a58d (Beige neutro)
- **Background**: #f9f9f1 (Crema cálido)

### Componentes Creados

#### 1. ModernCard
```jsx
import { ModernCard, StatCard } from '@/components/ui/modern-card';

// Card básico
<ModernCard>
  <h3>Contenido</h3>
</ModernCard>

// Card de estadísticas
<StatCard
  icon={ShoppingCart}
  title="Total Ventas"
  value="$1,250,000"
  subtitle="Últimos 30 días"
  trend={12}
  color="primary"
/>
```

#### 2. ModernTable
```jsx
import { ModernTable, ModernBadge, ModernTableButton } from '@/components/ui/modern-table';

const columns = [
  { header: "Nombre", accessorKey: "name" },
  { header: "Estado", cell: (row) => <ModernBadge variant="success">{row.status}</ModernBadge> },
  { 
    header: "Acciones", 
    cell: (row) => (
      <ModernTableActions>
        <ModernTableButton icon={Edit} variant="edit" onClick={() => edit(row)}>Editar</ModernTableButton>
        <ModernTableButton icon={Trash} variant="delete" onClick={() => delete(row)}>Eliminar</ModernTableButton>
      </ModernTableActions>
    )
  },
];

<ModernTable 
  columns={columns} 
  data={data} 
  loading={loading}
  onRowClick={(row) => console.log(row)}
/>
```

#### 3. ModernModal
```jsx
import { ModernModal } from '@/components/ui/modern-modal';

<ModernModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Agregar Producto"
  size="lg"
  footer={
    <div className="flex gap-3 justify-end">
      <ModernButton variant="outline" onClick={onClose}>Cancelar</ModernButton>
      <ModernButton variant="primary" onClick={onSave}>Guardar</ModernButton>
    </div>
  }
>
  {/* Contenido del modal */}
</ModernModal>
```

#### 4. ModernForm (Inputs, Buttons, Selects)
```jsx
import { ModernInput, ModernButton, ModernSelect } from '@/components/ui/modern-form';

<ModernInput
  label="Nombre del Producto"
  placeholder="Ej: Cerveza Corona"
  icon={Package}
  error={errors.name}
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

<ModernSelect
  label="Categoría"
  options={[
    { value: "bebidas", label: "Bebidas" },
    { value: "comida", label: "Comida" }
  ]}
  value={category}
  onChange={(e) => setCategory(e.target.value)}
/>

<ModernButton
  variant="primary"
  size="lg"
  icon={Save}
  loading={saving}
  onClick={handleSave}
  fullWidth
>
  Guardar Cambios
</ModernButton>
```

#### 5. ModernAlert
```jsx
import { ModernAlert, ModernToast } from '@/components/ui/modern-alert';

<ModernAlert
  type="success"
  title="¡Éxito!"
  message="El producto se guardó correctamente"
  onClose={() => setShowAlert(false)}
/>

<ModernToast
  isOpen={showToast}
  type="error"
  message="Error al guardar el producto"
  onClose={() => setShowToast(false)}
  duration={3000}
/>
```

### Clases CSS Globales

#### Cards
- `card-modern` - Card con estilo moderno
- `hover-lift` - Efecto de elevación al hover
- `hover-scale` - Escala al hover

#### Badges
- `badge` - Badge básico
- `badge-success`, `badge-warning`, `badge-error`, `badge-info`

#### Tablas
- `table-modern` - Tabla con estilo moderno
- `nav-item` - Items de navegación del sidebar

#### Grids Responsive
- `grid-dashboard` - Grid responsive para cards (1-4 columnas según viewport)
- `container-dashboard` - Contenedor con padding responsive

#### Animaciones
- `animate-fade-in` - Fade in suave
- `animate-slide-in` - Slide desde la izquierda
- `animate-scale-in` - Escala desde el centro
- `skeleton` - Loading skeleton

### Responsive Breakpoints
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (sm-lg)
- **Desktop**: > 1024px (lg+)

### Patron de Uso Mobile-First

```jsx
// Tamaños responsive
className="text-sm sm:text-base md:text-lg lg:text-xl"

// Padding responsive
className="p-4 sm:p-6 md:p-8"

// Grid responsive
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"

// Botones full-width en móvil
className="w-full sm:w-auto"
```

### Ejemplo Completo de Vista Modernizada

```jsx
import { useState } from 'react';
import { ModernCard, StatCard } from '@/components/ui/modern-card';
import { ModernTable, ModernBadge } from '@/components/ui/modern-table';
import { ModernButton, ModernInput } from '@/components/ui/modern-form';
import { ModernModal } from '@/components/ui/modern-modal';
import { Plus, Search, Package } from 'lucide-react';

function ModernInventario() {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="container-dashboard space-y-6">
      {/* Stats Grid */}
      <div className="grid-dashboard">
        <StatCard
          icon={Package}
          title="Total Productos"
          value="156"
          trend={8}
          color="primary"
        />
        {/* Más stats... */}
      </div>

      {/* Search and Actions */}
      <ModernCard>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <ModernInput
            placeholder="Buscar productos..."
            icon={Search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <ModernButton
            variant="primary"
            icon={Plus}
            onClick={() => setShowModal(true)}
          >
            Agregar Producto
          </ModernButton>
        </div>
      </ModernCard>

      {/* Table */}
      <ModernTable
        columns={columns}
        data={products}
        loading={loading}
      />

      {/* Modal */}
      <ModernModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Agregar Producto"
        size="lg"
      >
        {/* Form content */}
      </ModernModal>
    </div>
  );
}
```

### Siguiente Pasos

1. ✅ CSS Global mejorado con utilidades modernas
2. ✅ Componentes UI reutilizables creados
3. 🔄 Actualizar componentes del Dashboard uno por uno
4. ⏳ Testing responsive en diferentes dispositivos
5. ⏳ Deploy y validación en producción

### Tips de Migración

1. **Reemplazar tablas antiguas**: Cambiar `<table>` por `<ModernTable>`
2. **Reemplazar cards**: Usar `<ModernCard>` en lugar de `<Card>` básico
3. **Modernizar formularios**: Reemplazar inputs con `<ModernInput>`
4. **Actualizar modales**: Usar `<ModernModal>` para consistencia
5. **Agregar loading states**: Usar `loading` prop en botones y tablas
6. **Mobile-first**: Siempre usar clases responsive (sm:, md:, lg:)
