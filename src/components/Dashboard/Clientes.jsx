import { useState, useEffect, useCallback } from 'react';

function Clientes({ businessId }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadClientes = useCallback(async () => {
    try {
      // TODO: Implementar consulta a Supabase
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Aquí cargarás los clientes desde Supabase
    loadClientes();
  }, [businessId, loadClientes]);

  return (
    <section className="section-content">
      <div className="section-header">
        <h2>Clientes</h2>
        <button className="btn-primary">+ Agregar Cliente</button>
      </div>

      <div className="content-body">
        {loading ? (
          <p>Cargando clientes...</p>
        ) : (
          <p>Administra tu base de clientes</p>
        )}
        {/* Aquí irá la tabla de clientes */}
      </div>
    </section>
  );
}

export default Clientes;
