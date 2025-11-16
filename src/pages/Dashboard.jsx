import { useState, useEffect } from 'react';
import { supabase } from '../supabase/Client.jsx';
import { DashboardLayout } from '../components/layout/DashboardLayout.jsx';
import Home from '../components/Dashboard/Home.jsx';
import Ventas from '../components/Dashboard/Ventas.jsx';
import Compras from '../components/Dashboard/Compras.jsx';
import Inventario from '../components/Dashboard/Inventario.jsx';
import Proveedores from '../components/Dashboard/Proveedores.jsx';
import Empleados from '../components/Dashboard/Empleados.jsx';
// import Facturas from '../components/Dashboard/Facturas.jsx'; // DESHABILITADO
import Reportes from '../components/Dashboard/Reportes.jsx';
import Configuracion from '../components/Dashboard/Configuracion.jsx';

function Dashboard() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [businessLogo, setBusinessLogo] = useState(() => {
    return localStorage.getItem('businessLogo') || null;
  });

  useEffect(() => {
    checkAuthAndLoadBusiness();
  }, []);

  const checkAuthAndLoadBusiness = async () => {
    try {
      // Verificar autenticación
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        window.location.href = '/login';
        return;
      }

      setUser(user);

      // Verificar si el usuario tiene un negocio o es empleado
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('email', user.email)
        .single();

      
      if (business) {
      }

      const { data: employee, error: employeeError } = await supabase
        .from('employee_invitations')
        .select('id, business_id, role, is_approved')
        .eq('email', user.email)
        .eq('is_approved', true)
        .single();


      // Si es empleado, redirigir al dashboard de empleados
      if (!business && employee) {
        window.location.href = '/employee-dashboard';
        return;
      }

      // Si no es ni dueño ni empleado
      if (!business) {
        await supabase.auth.signOut();
        window.location.href = '/login';
        alert('No tienes acceso al sistema. Contacta con un administrador.');
        return;
      }

      // Si llegamos aquí, es dueño del negocio
      setBusiness(business);

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
            business_id: business.id,
            full_name: business.owner_name || 'Administrador',
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (error) {
      alert('No se pudo cerrar la sesión correctamente');
    }
  };

  const handleLogoChange = (newLogoUrl) => {
    setBusinessLogo(newLogoUrl);
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
      
      // DESHABILITADO - Requiere dominio verificado en Resend
      // case 'facturas':
      //   return <Facturas />;
      
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
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-primary font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={handleSignOut}
            className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
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
