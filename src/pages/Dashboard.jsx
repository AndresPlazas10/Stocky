import { useState, useEffect } from 'react';
import { supabase } from '../supabase/Client.jsx';
import { DashboardLayout } from '../components/layout/DashboardLayout.jsx';
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
          console.error('Error obteniendo usuario:', userError);
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`⏳ Intento ${attempts}/${maxAttempts} - Esperando sesión...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!user) {
        console.log('❌ No se pudo obtener usuario después de reintentos, redirigiendo a login');
        window.location.href = '/login';
        return;
      }

      console.log('✅ Usuario autenticado:', user.email);
      setUser(user);

      // Verificar si acabamos de crear un negocio
      const justCreatedId = sessionStorage.getItem('justCreatedBusiness');
      const createdAt = sessionStorage.getItem('businessCreatedAt');
      const isRecent = createdAt && (Date.now() - parseInt(createdAt)) < 30000; // Últimos 30 segundos

      let finalBusiness = null;

      // Si acabamos de crear un negocio, intentar cargarlo directamente
      if (justCreatedId && isRecent) {
        console.log('🆕 Detectado negocio recién creado, cargando por ID:', justCreatedId);
        const { data: newBusiness } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', justCreatedId)
          .maybeSingle();
        
        if (newBusiness) {
          finalBusiness = newBusiness;
          sessionStorage.removeItem('justCreatedBusiness');
          sessionStorage.removeItem('businessCreatedAt');
          console.log('✅ Negocio recién creado encontrado');
        }
      }

      // Si no encontramos el negocio recién creado, buscar normalmente
      if (!finalBusiness) {
        console.log('🔍 Buscando negocio para usuario:', user.id);
        
        // Verificar si el usuario tiene un negocio (por ID de creador)
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('created_by', user.id)
          .maybeSingle();

        if (businessError) {
          console.error('Error buscando negocio por created_by:', businessError);
        } else {
          console.log('Resultado búsqueda por created_by:', business ? 'Encontrado' : 'No encontrado');
        }

        finalBusiness = business;

        // Si no encuentra por ID, intentar por email (fallback)
        if (!finalBusiness) {
          const { data: businessByEmail } = await supabase
            .from('businesses')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          finalBusiness = businessByEmail;
        }
      }

      const { data: employee } = await supabase
        .from('employee_invitations')
        .select('id, business_id, role, is_approved')
        .eq('email', user.email)
        .eq('is_approved', true)
        .maybeSingle();


      // Si es empleado, redirigir al dashboard de empleados
      if (!finalBusiness && employee) {
        window.location.href = '/employee-dashboard';
        return;
      }

      // Si no es ni dueño ni empleado
      if (!finalBusiness) {
        console.log('❌ No se encontró negocio para el usuario');
        // Dar un poco de tiempo para replicación de BD si acabamos de crear
        if (justCreatedId && isRecent) {
          console.log('⏳ Reintentando en 2 segundos...');
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

      // Verificar si el administrador existe en la tabla users, si no, crearlo
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      // PGRST116 significa que no hay filas, es esperado
      if (!existingUser && (!checkError || checkError.code === 'PGRST116')) {
        // Crear el registro del administrador en la tabla users
        const { error: userCreateError } = await supabase
          .from('users')
          .insert([{
            id: user.id,
            business_id: finalBusiness.id,
            full_name: finalBusiness.owner_name || 'Administrador',
            email: user.email,
            role: 'admin',
            is_active: true
          }]);

        if (userCreateError) {
        }
      }
    } catch (err) {
      setError('Error al cargar la información');
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
        console.error('Error al cerrar sesión:', error);
      }
      
      // Redirigir siempre, incluso si hay error
      window.location.href = '/login';
    } catch (error) {
      console.error('Error inesperado al cerrar sesión:', error);
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
      alert('Error al actualizar el logo');
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <Home business={business} />;
      
      case 'ventas':
        return <Ventas businessId={business?.id} />;
      
      case 'compras':
        return <Compras businessId={business?.id} />;
      
      case 'inventario':
        return <Inventario businessId={business?.id} userRole="admin" />;
      
      case 'proveedores':
        return <Proveedores businessId={business?.id} />;
      
      case 'empleados':
        return <Empleados businessId={business?.id} />;
      
      case 'facturas':
        return <Facturas userRole="admin" />;
      
      case 'clientes':
        return <Clientes businessId={business?.id} />;
      
      case 'reportes':
        return <Reportes businessId={business?.id} />;
      
      case 'configuracion':
        return <Configuracion user={user} business={business} onBusinessUpdate={setBusiness} />;
      
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
  );
}

export default Dashboard;
