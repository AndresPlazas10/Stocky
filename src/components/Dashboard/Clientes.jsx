import { useState, useEffect, useCallback, useRef } from 'react';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';

function Clientes({ businessId }) {
  // NOTA: Tabla 'customers' fue eliminada de la base de datos
  // Este componente ahora solo muestra información
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const formRef = useRef(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    id_number: '',
    email: '',
    phone: '',
    address: ''
  });

  const loadClientes = useCallback(async () => {
    // Tabla customers eliminada - no hacer nada
    setLoading(false);
    setClientes([]);
  }, []);

  useEffect(() => {
    if (businessId) {
      loadClientes();
    }
  }, [businessId, loadClientes]);

  // Scroll al formulario cuando se abre
  useEffect(() => {
    if (showForm && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showForm]);

  // Cleanup mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Tabla customers eliminada - mostrar mensaje
    setError('⚠️ La gestión de clientes no está disponible actualmente.');
    setShowForm(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">👥 Clientes</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-500 w-full sm:w-auto transition-colors"
        >
          {showForm ? '❌ Cancelar' : '+ Agregar Cliente'}
        </button>
      </div>

      {/* Mensajes mejorados */}
      <SaleErrorAlert 
        isVisible={!!error}
        onClose={() => setError('')}
        title="Error"
        message={error}
        duration={5000}
      />

      <SaleSuccessAlert 
        isVisible={!!success}
        onClose={() => setSuccess('')}
        title="✨ Éxito"
        details={[{ label: 'Acción', value: success }]}
        duration={4000}
      />

      {/* Formulario */}
      {showForm && (
        <div ref={formRef} className="mb-6 bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h3 className="text-lg sm:text-xl font-semibold mb-4">Nuevo Cliente</h3>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre Completo *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 border rounded-lg text-base"
                  required
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Documento de Identidad</label>
                <input
                  type="text"
                  name="id_number"
                  value={formData.id_number}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 border rounded-lg text-base"
                  placeholder="1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 border rounded-lg text-base"
                  placeholder="cliente@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Teléfono</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 border rounded-lg text-base"
                  placeholder="3001234567"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-2">Dirección</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 border rounded-lg text-base"
                  placeholder="Calle 123 #45-67"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-accent-600 text-white px-4 py-3 rounded-lg hover:bg-accent-500 disabled:bg-gray-400 transition-colors font-medium"
              >
                {loading ? 'Guardando...' : '💾 Guardar Cliente'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    full_name: '',
                    id_number: '',
                    email: '',
                    phone: '',
                    address: ''
                  });
                }}
                className="flex-1 bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <AsyncStateWrapper
          loading={loading}
          error={null}
          dataCount={clientes.length}
          onRetry={loadClientes}
          skeletonType="clientes"
          emptyTitle="Clientes no disponibles"
          emptyDescription="Este modulo quedo en modo informativo y no tiene registros activos."
        >
          <div>
            {/* Vista móvil - Cards */}
            <div className="block sm:hidden divide-y">
              {clientes.map(cliente => (
                <div key={cliente.id} className="p-4 hover:bg-gray-50">
                  <div className="font-semibold text-sm">{cliente.full_name}</div>
                  {cliente.id_number && (
                    <div className="text-xs text-gray-600">{cliente.id_number}</div>
                  )}
                  {cliente.email && (
                    <div className="text-xs text-gray-600 mt-1">{cliente.email}</div>
                  )}
                  {cliente.phone && (
                    <div className="text-xs text-gray-600">{cliente.phone}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Vista desktop - Tabla */}
            <table className="w-full hidden sm:table">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Nombre</th>
                  <th className="p-3 text-left">Documento</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(cliente => (
                  <tr key={cliente.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{cliente.full_name}</td>
                    <td className="p-3">{cliente.id_number || '-'}</td>
                    <td className="p-3">{cliente.email || '-'}</td>
                    <td className="p-3">{cliente.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncStateWrapper>
      </div>
    </div>
  );
}

export default Clientes;
