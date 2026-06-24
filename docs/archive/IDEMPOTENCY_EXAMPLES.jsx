/**
 * =====================================
 * EJEMPLO 1: Register.jsx
 * =====================================
 * Aplicación del hook useIdempotentSubmit para prevenir
 * doble creación de negocios
 */

// ANTES (sin protección):
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  const { data, error } = await supabase.from('businesses').insert({...});
  
  setLoading(false);
};

// DESPUÉS (con protección completa):
import { useIdempotentSubmit } from '../hooks/useIdempotentSubmit';

function Register() {
  const [formData, setFormData] = useState({...});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Hook de idempotency
  const { isSubmitting, submitAction } = useIdempotentSubmit({
    actionName: 'create_business',
    onSubmit: async ({ idempotencyKey }) => {
      const { name, address, phone, username, password } = formData;
      
      // Validaciones...
      
      // Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${username}@stockly-app.com`,
        password: password
      });
      
      if (authError) throw authError;
      
      // OPCIÓN A: Insertar con idempotency key manual
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert([{
          name: name.trim(),
          username: username.toLowerCase(),
          created_by: authData.user.id,
          // Metadata para tracking (opcional)
          metadata: { idempotency_key: idempotencyKey }
        }])
        .select()
        .single();
      
      if (businessError) throw businessError;
      
      // OPCIÓN B: Usar función SQL segura (recomendado)
      /*
      const { data, error } = await supabase.rpc('create_business_safe', {
        p_idempotency_key: idempotencyKey,
        p_name: name.trim(),
        p_username: username.toLowerCase(),
        p_email: `${username}@stockly-app.com`,
        p_address: address.trim() || null,
        p_phone: phone.trim() || null,
        p_created_by: authData.user.id
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      */
      
      return businessData;
    },
    onSuccess: (result) => {
      setSuccess(true);
      setError(null);
      // Redirigir después de 2 segundos
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || 'Error al crear el negocio');
      setSuccess(false);
    },
    debounceMs: 500, // Esperar 500ms antes de procesar
    enableRetry: false // No retry automático en registro
  });

  // Handler del form
  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitAction();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... campos del form ... */}
      
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando negocio...
          </>
        ) : (
          'Crear Negocio'
        )}
      </Button>
      
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      
      {success && (
        <div className="text-green-500 text-sm">
          ✅ Negocio creado exitosamente
        </div>
      )}
    </form>
  );
}

/**
 * =====================================
 * EJEMPLO 2: Empleados.jsx
 * =====================================
 */

import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';

function Empleados({ businessId }) {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'employee'
  });

  const { isSubmitting, submitAction, reset } = useIdempotentSubmit({
    actionName: 'create_employee',
    onSubmit: async ({ idempotencyKey }) => {
      // Validaciones...
      
      const cleanUsername = formData.username.toLowerCase().trim();
      const cleanEmail = `${cleanUsername}@stockly-app.com`;
      
      // Verificar si ya existe (validación extra client-side)
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('business_id', businessId)
        .eq('username', cleanUsername)
        .maybeSingle();
      
      if (existing) {
        throw new Error('Este usuario ya existe');
      }
      
      // Crear cuenta Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: formData.password.trim()
      });
      
      if (authError) throw authError;
      
      // Insertar empleado
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .insert([{
          business_id: businessId,
          user_id: authData.user.id,
          full_name: formData.full_name.trim(),
          username: cleanUsername,
          email: cleanEmail,
          role: formData.role,
          is_active: true,
          // Tracking opcional
          metadata: { idempotency_key: idempotencyKey }
        }])
        .select()
        .single();
      
      if (employeeError) throw employeeError;
      
      return employeeData;
    },
    onSuccess: (result) => {
      setSuccess('✅ Empleado creado exitosamente');
      setFormData({ full_name: '', username: '', password: '', role: 'employee' });
      setShowForm(false);
      loadEmpleados(); // Recargar lista
    },
    onError: (err) => {
      setError(err.message || 'Error al crear empleado');
    },
    debounceMs: 300,
    enableRetry: true,
    maxRetries: 2
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitAction();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Campos del formulario */}
      
      <Button 
        type="submit" 
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin mr-2" />
            Creando...
          </>
        ) : (
          <>
            <UserPlus className="mr-2" />
            Crear Empleado
          </>
        )}
      </Button>
    </form>
  );
}

/**
 * =====================================
 * EJEMPLO 3: Compras.jsx
 * =====================================
 */

import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';

function Compras({ businessId }) {
  const [cart, setCart] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const { isSubmitting, submitAction } = useIdempotentSubmit({
    actionName: 'create_purchase',
    onSubmit: async ({ idempotencyKey }) => {
      if (!supplierId) throw new Error('Selecciona un proveedor');
      if (cart.length === 0) throw new Error('Agrega productos');
      
      const total = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      // Obtener usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No autenticado');
      
      // TRANSACCIÓN MANUAL (alternativa a función SQL)
      // Insertar compra
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert([{
          business_id: businessId,
          user_id: user.id,
          supplier_id: supplierId,
          payment_method: paymentMethod,
          total: total,
          metadata: { idempotency_key: idempotencyKey }
        }])
        .select()
        .single();
      
      if (purchaseError) throw purchaseError;
      
      // Insertar detalles
      const purchaseDetails = cart.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_price,
        subtotal: item.quantity * item.unit_price
      }));
      
      const { error: detailsError } = await supabase
        .from('purchase_details')
        .insert(purchaseDetails);
      
      if (detailsError) {
        // Intentar rollback manual (eliminar purchase)
        await supabase.from('purchases').delete().eq('id', purchase.id);
        throw detailsError;
      }
      
      // Actualizar stock (una por una para evitar race conditions)
      for (const item of cart) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
        
        const newStock = (product.stock || 0) + item.quantity;
        
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product_id);
      }
      
      return purchase;
    },
    onSuccess: (result) => {
      setSuccess('✅ Compra registrada exitosamente');
      setCart([]);
      setSupplierId('');
      setShowModal(false);
      loadCompras();
      loadProductos();
    },
    onError: (err) => {
      setError(err.message || 'Error al registrar compra');
    },
    debounceMs: 500,
    enableRetry: true,
    maxRetries: 3
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitAction();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Cart items, supplier select, etc */}
      
      <Button 
        type="submit" 
        disabled={isSubmitting || cart.length === 0}
      >
        {isSubmitting ? 'Procesando...' : 'Registrar Compra'}
      </Button>
    </form>
  );
}

/**
 * =====================================
 * EJEMPLO 4: Productos con ProductDialog
 * =====================================
 */

import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';

function ProductDialog({ businessId, product, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    code: product?.code || '',
    price: product?.price || '',
    stock: product?.stock || '',
    category: product?.category || ''
  });

  const isEditing = !!product;

  const { isSubmitting, submitAction } = useIdempotentSubmit({
    actionName: isEditing ? 'update_product' : 'create_product',
    onSubmit: async ({ idempotencyKey }) => {
      // Validaciones...
      
      if (isEditing) {
        // UPDATE - menos crítico, pero igual protegido
        const { data, error } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            code: formData.code.trim(),
            price: parseFloat(formData.price),
            stock: parseInt(formData.stock),
            category: formData.category,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
        
      } else {
        // INSERT - crítico
        const { data, error } = await supabase
          .from('products')
          .insert([{
            business_id: businessId,
            name: formData.name.trim(),
            code: formData.code.trim(),
            price: parseFloat(formData.price),
            stock: parseInt(formData.stock),
            category: formData.category,
            metadata: { idempotency_key: idempotencyKey }
          }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (result) => {
      onSave(result);
      onClose();
    },
    onError: (err) => {
      alert(err.message);
    },
    debounceMs: 300
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitAction();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          'Guardando...'
        ) : (
          isEditing ? 'Actualizar' : 'Crear Producto'
        )}
      </Button>
    </form>
  );
}

/**
 * =====================================
 * EJEMPLO 5: Uso Avanzado con Callbacks
 * =====================================
 */

function AdvancedExample() {
  const { 
    isSubmitting, 
    submitAction, 
    reset, 
    error,
    retryCount,
    getIdempotencyState 
  } = useIdempotentSubmit({
    actionName: 'complex_operation',
    onSubmit: async ({ idempotencyKey, customData }) => {
      // customData viene de submitAction({ customData: {...} })
      console.log('Processing with key:', idempotencyKey);
      console.log('Custom data:', customData);
      
      // Operación compleja...
      const result = await performComplexOperation();
      
      return result;
    },
    onSuccess: (result) => {
      console.log('Success!', result);
    },
    onError: (err) => {
      console.error('Failed:', err);
    },
    debounceMs: 1000,
    enableRetry: true,
    maxRetries: 5
  });

  // Ver estado de idempotency actual
  useEffect(() => {
    const state = getIdempotencyState();
    console.log('Current idempotency state:', state);
  }, [getIdempotencyState]);

  // Mostrar reintento actual
  if (retryCount > 0) {
    console.log(`Reintento ${retryCount}/5`);
  }

  const handleClick = async () => {
    // Pasar datos adicionales
    await submitAction({ 
      customData: { 
        timestamp: Date.now(),
        userAgent: navigator.userAgent 
      } 
    });
  };

  // Resetear manualmente en caso de error irrecuperable
  const handleReset = () => {
    reset();
  };

  return (
    <div>
      <button onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? 'Procesando...' : 'Ejecutar'}
      </button>
      
      {error && (
        <div>
          Error: {error.message}
          <button onClick={handleReset}>Reintentar</button>
        </div>
      )}
      
      {retryCount > 0 && (
        <div>Reintento {retryCount}/5...</div>
      )}
    </div>
  );
}

/**
 * =====================================
 * PATRONES ADICIONALES
 * =====================================
 */

// PATRÓN 1: Confirmación antes de submit
function WithConfirmation() {
  const [showConfirm, setShowConfirm] = useState(false);
  const { isSubmitting, submitAction } = useIdempotentSubmit({...});

  const handleInitialClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    await submitAction();
  };

  return (
    <>
      <button onClick={handleInitialClick}>Eliminar</button>
      
      {showConfirm && (
        <div>
          ¿Confirmas?
          <button onClick={handleConfirm} disabled={isSubmitting}>
            Sí, eliminar
          </button>
        </div>
      )}
    </>
  );
}

// PATRÓN 2: Submit con validación asíncrona previa
function WithAsyncValidation() {
  const { isSubmitting, submitAction } = useIdempotentSubmit({
    actionName: 'validated_submit',
    onSubmit: async ({ idempotencyKey }) => {
      // Esta validación está DENTRO del submit protegido
      const isValid = await validateWithServer(formData);
      if (!isValid) throw new Error('Validación fallida');
      
      return await actualSubmit(idempotencyKey);
    }
  });
}

// PATRÓN 3: Progreso granular
function WithProgress() {
  const [progress, setProgress] = useState(0);
  
  const { isSubmitting, submitAction } = useIdempotentSubmit({
    actionName: 'long_operation',
    onSubmit: async ({ idempotencyKey }) => {
      setProgress(10);
      await step1();
      
      setProgress(40);
      await step2();
      
      setProgress(70);
      await step3();
      
      setProgress(100);
      return { success: true };
    }
  });

  return (
    <div>
      {isSubmitting && <ProgressBar value={progress} />}
    </div>
  );
}
