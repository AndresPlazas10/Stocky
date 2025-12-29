import { useState, useEffect } from 'react';
import { supabase } from '../supabase/Client.jsx';
import { DashboardLayout } from '../components/layout/DashboardLayout.jsx';
import ChangelogModal from '../components/ChangelogModal.jsx';
import Home from '../components/Dashboard/Home.jsx';
import Ventas from '../components/Dashboard/Ventas.jsx';
import Compras from '../components/Dashboard/Compras.jsx';
import Inventario from '../components/Dashboard/Inventario.jsx';
import Proveedores from '../components/Dashboard/Proveedores.jsx';
import Empleados from '../components/Dashboard/Empleados.jsx';
import Facturas from '../components/Dashboard/Facturas.jsx';
import Clientes from '../components/Dashboard/Clientes.jsx';
import Reportes from '../components/Dashboard/Reportes.jsx';
import Configuracion from '../components/Dashboard/Configuracion.jsx';

function Dashboard() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [businessLogo, setBusinessLogo] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    checkAuthAndLoadBusiness();
    
    // Limpiar localStorage viejo (solo la primera vez)
    if (localStorage.getItem('businessLogo')) {
      localStorage.removeItem('businessLogo');
    }
  }, []);

  // Sincronizar logo cuando cambia el business
  useEffect(() => {
    if (business?.logo_url !== undefined) {
      setBusinessLogo(business.logo_url || null);
    }
  }, [business?.id, business?.logo_url]);

  const checkAuthAndLoadBusiness = async () => {
    try {
      // Verificar autenticación con retry para dar tiempo a la sesión
      let user = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!user && attempts < maxAttempts) {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (currentUser) {
          user = currentUser;
          break;
        }
        
        if (userError) {
          // Error obteniendo usuario
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          // Esperando sesión
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!user) {
        // No se pudo obtener usuario, redirigiendo
        window.location.href = '/login';
        return;
      }

      // Usuario autenticado
      setUser(user);

      // Verificar si acabamos de crear un negocio
      const justCreatedId = sessionStorage.getItem('justCreatedBusiness');
      const createdAt = sessionStorage.getItem('businessCreatedAt');
      const isRecent = createdAt && (Date.now() - parseInt(createdAt)) < 30000; // Últimos 30 segundos

      let finalBusiness = null;

      // Si acabamos de crear un negocio, intentar cargarlo directamente
      if (justCreatedId && isRecent) {
        // Detectado negocio recién creado
        const { data: newBusiness } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', justCreatedId)
          .maybeSingle();
        
        if (newBusiness) {
          finalBusiness = newBusiness;
          sessionStorage.removeItem('justCreatedBusiness');
          sessionStorage.removeItem('businessCreatedAt');
          // Negocio recién creado encontrado
        }
      }

      // Si no encontramos el negocio recién creado, buscar normalmente
      if (!finalBusiness) {
        // Buscando negocio para usuario
        
        // Verificar si el usuario tiene un negocio (SOLO por created_by)
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('created_by', user.id)
          .maybeSingle();

        if (businessError) {
          // Error buscando negocio
        }

        finalBusiness = business;
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id, business_id, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();


      // Si es empleado, redirigir al dashboard de empleados
      if (!finalBusiness && employee) {
        window.location.href = '/employee-dashboard';
        return;
      }

      // Si no es ni dueño ni empleado
      if (!finalBusiness) {
        // No se encontró negocio
        // Dar un poco de tiempo para replicación de BD si acabamos de crear
        if (justCreatedId && isRecent) {
          // Reintentando
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }
        window.location.href = '/register';
        return;
      }

      // Si llegamos aquí, es dueño del negocio
      setBusiness(finalBusiness);
      setBusinessLogo(finalBusiness.logo_url || null);

      // Tabla users (public) no existe - no crear registro
      
    } catch (err) {
      setError('❌ Error al cargar la información del negocio');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Limpiar el estado local primero
      localStorage.clear();
      sessionStorage.clear();
      
      // Cerrar sesión en Supabase con scope global
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        // Error al cerrar sesión
      }
      
      // Redirigir siempre, incluso si hay error
      window.location.href = '/login';
    } catch (error) {
      // Error inesperado al cerrar sesión
      // Forzar redirección de todas formas
      window.location.href = '/login';
    }
  };

  const handleLogoChange = async (newLogoUrl) => {
    if (!business) return;

    try {
      // Actualizar en Supabase
      const { error } = await supabase
        .from('businesses')
        .update({ logo_url: newLogoUrl })
        .eq('id', business.id);

      if (error) throw error;

      // Actualizar estado local
      setBusinessLogo(newLogoUrl);
      setBusiness({ ...business, logo_url: newLogoUrl });
    } catch (error) {
      setError('Error al actualizar el logo');
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <Home key="home" business={business} />;
      
      case 'ventas':
        return <Ventas key="ventas" businessId={business?.id} />;
      
      case 'compras':
        return <Compras key="compras" businessId={business?.id} />;
      
      case 'inventario':
        return <Inventario key="inventario" businessId={business?.id} userRole="admin" />;
      
      case 'proveedores':
        return <Proveedores key="proveedores" businessId={business?.id} />;
      
      case 'empleados':
        return <Empleados key="empleados" businessId={business?.id} />;
      
      case 'facturas':
        return <Facturas key="facturas" userRole="admin" />;
      
      case 'clientes':
        return <Clientes key="clientes" businessId={business?.id} />;
      
      case 'reportes':
        return <Reportes key="reportes" businessId={business?.id} />;
      
      case 'configuracion':
        return <Configuracion key="configuracion" user={user} business={business} onBusinessUpdate={setBusiness} />;
      
      default:
        return <p>Selecciona una opción del menú</p>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={handleSignOut}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ChangelogModal 
        forceOpen={showChangelog} 
        onClose={() => setShowChangelog(false)} 
      />
      
      {/* 🚨 BOTÓN TEMPORAL - Eliminar después de unas semanas */}
      <button
        onClick={() => setShowChangelog(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2 font-medium"
        title="Ver novedades de la aplicación"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Ver Novedades
      </button>
      
      <DashboardLayout
        userName={business?.owner_name || 'Usuario'}
        userEmail={user?.email || ''}
        userRole="Administrador"
        businessName={business?.name}
        businessId={business?.id}
        businessLogo={businessLogo}
        onLogoChange={handleLogoChange}
        onSignOut={handleSignOut}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      >
        {renderContent()}
      </DashboardLayout>
    </>
  );
}

export default Dashboard;
