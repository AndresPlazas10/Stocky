
import { Package, FileText, Inbox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No hay datos',
  message = 'No se encontraron elementos para mostrar',
  action,
  actionLabel = 'Crear nuevo'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-accent-600" />
      </div>
      <h3 className="text-xl font-semibold text-primary-900 mb-2">{title}</h3>
      <p className="text-primary-600 mb-6 max-w-sm">{message}</p>
      {action && (
        <button
          onClick={action}
          className="btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

export const EmptyProducts = ({ onAdd }) => {
  return (
    <EmptyState
      icon={Package}
      title="No hay productos"
      message="Aún no has agregado productos a tu inventario. Comienza agregando tu primer producto."
      action={onAdd}
      actionLabel="Agregar Producto"
    />
  );
};

export const EmptyOrders = () => {
  return (
    <EmptyState
      icon={FileText}
      title="No hay pedidos"
      message="No se encontraron pedidos para mostrar."
    />
  );
};

export default EmptyState;
