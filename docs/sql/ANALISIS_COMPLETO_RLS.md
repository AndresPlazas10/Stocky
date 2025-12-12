# 🔒 ANÁLISIS COMPLETO DE POLÍTICAS RLS - STOCKLY

## 📊 TABLA DE CONTENIDO

1. [Análisis Inicial](#1-análisis-inicial)
2. [Diagrama de Relaciones](#2-diagrama-de-relaciones)
3. [Matriz de Permisos por Rol](#3-matriz-de-permisos-por-rol)
4. [Políticas RLS Detalladas](#4-políticas-rls-detalladas)
5. [Funciones de Seguridad](#5-funciones-de-seguridad)
6. [SQL Final Listo para Usar](#6-sql-final-listo-para-usar)
7. [Guía de Pruebas](#7-guía-de-pruebas)
8. [Ajustes Recomendados](#8-ajustes-recomendados)
9. [Errores y Prevención](#9-errores-y-prevención)

---

## 1. ANÁLISIS INICIAL

### 🎯 Objetivo del Sistema RLS

Crear un sistema de seguridad a nivel de fila (Row Level Security) que:

- ✅ **Aisle negocios:** Cada usuario solo accede a datos de SUS negocios
- ✅ **Diferencie roles:** Owner vs Empleados tienen diferentes permisos
- ✅ **Sea escalable:** Funciona con 1 o 1000 negocios
- ✅ **Evite bloqueos:** No impide operaciones válidas
- ✅ **Sea performante:** Usa índices y funciones eficientes
- ✅ **Sea auditable:** Logs claros de quién hace qué

### 📋 Estructura de Usuarios y Roles

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTH.USERS (Supabase)                   │
│  - id (UUID)                                                │
│  - email                                                     │
│  - Autenticación manejada por Supabase Auth                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Relación 1:N
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     BUSINESSES                              │
│  - id (UUID)                                                │
│  - created_by (UUID) → auth.users.id                        │
│  - business_name                                             │
│                                                              │
│  ROL: OWNER = created_by                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Relación 1:N
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     EMPLOYEES                               │
│  - id (UUID)                                                │
│  - business_id (UUID) → businesses.id                       │
│  - user_id (UUID) → auth.users.id                           │
│  - full_name                                                 │
│  - role (TEXT)                                              │
│  - is_active (BOOLEAN)                                      │
│                                                              │
│  ROLES: 'admin', 'employee', 'cashier', etc.                │
└─────────────────────────────────────────────────────────────┘
```

### 🔑 Tipos de Roles Identificados

#### 1. **OWNER (Dueño del Negocio)**
- ✅ Usuario que creó el negocio (`businesses.created_by = auth.uid()`)
- ✅ Permisos: TODOS (SELECT, INSERT, UPDATE, DELETE)
- ✅ Puede:
  - Crear/editar/eliminar negocio
  - Gestionar empleados
  - Ver/crear/editar/eliminar productos, ventas, compras, etc.
  - Acceder a reportes completos

#### 2. **ADMIN (Administrador)**
- ✅ Empleado con `role = 'admin'`
- ✅ Permisos: CASI TODOS (menos eliminar negocio)
- ✅ Puede:
  - Ver todo del negocio
  - Crear/editar empleados (no puede eliminar)
  - Crear/editar/eliminar productos, ventas, compras
  - Acceder a reportes

#### 3. **EMPLOYEE (Empleado)**
- ✅ Empleado con `role = 'employee'` o similar
- ✅ Permisos: OPERACIONES BÁSICAS
- ✅ Puede:
  - Ver productos, proveedores
  - Crear ventas
  - Ver sus propias ventas
  - NO puede: eliminar nada, editar precios, ver reportes sensibles

#### 4. **CASHIER (Cajero)**
- ✅ Empleado con `role = 'cashier'`
- ✅ Permisos: SOLO VENTAS
- ✅ Puede:
  - Ver productos
  - Crear ventas
  - Ver lista de ventas
  - NO puede: compras, proveedores, empleados, reportes

#### 5. **PUBLIC (No autenticado)**
- ❌ NO tiene acceso a NADA
- ❌ Todas las tablas requieren autenticación

---

## 2. DIAGRAMA DE RELACIONES

### 🗺️ Mapa Completo de Relaciones FK

```
                    auth.users (Supabase Auth)
                         │
                         │ created_by
                         ▼
                    ┌──────────────┐
                    │  BUSINESSES  │◄──────────┐
                    └──────────────┘           │
                         │                     │
          ┌──────────────┼──────────────┐     │
          │              │              │     │
          ▼              ▼              ▼     │ business_id
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ EMPLOYEES│   │ PRODUCTS │   │ SUPPLIERS│
    └──────────┘   └──────────┘   └──────────┘
          │              │              │
          │              │              │
          │              │              ▼
          │              │         ┌──────────┐
          │              │         │PURCHASES │
          │              │         └──────────┘
          │              │              │
          │              │              ▼
          │              │    ┌─────────────────┐
          │              │    │PURCHASE_DETAILS │
          │              │    └─────────────────┘
          │              │
          │              ▼
          │         ┌──────────┐
          │         │  SALES   │
          │         └──────────┘
          │              │
          │              ▼
          │      ┌──────────────┐
          │      │ SALE_DETAILS │
          │      └──────────────┘
          │
          │         ┌──────────┐
          └────────►│ INVOICES │
                    └──────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │INVOICE_ITEMS │
                  └──────────────┘

┌─────────────┐
│  CUSTOMERS  │ (Referencia opcional en invoices)
└─────────────┘

┌─────────────┐       ┌──────────┐
│   TABLES    │◄──────│  ORDERS  │
└─────────────┘       └──────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ ORDER_ITEMS  │
                    └──────────────┘
```

### 📌 Leyenda de Relaciones

- **Flecha simple (→)**: Foreign Key directo
- **Doble línea (══)**: CASCADE DELETE
- **Línea punteada (┄)**: Referencia opcional (nullable)

---

## 3. MATRIZ DE PERMISOS POR ROL

### 📊 Tabla Completa de Permisos

| Tabla | Operación | OWNER | ADMIN | EMPLOYEE | CASHIER | PUBLIC |
|-------|-----------|-------|-------|----------|---------|--------|
| **businesses** | SELECT | ✅ (sus negocios) | ✅ (su negocio) | ✅ (su negocio) | ✅ (su negocio) | ❌ |
| **businesses** | INSERT | ✅ (crear nuevo) | ❌ | ❌ | ❌ | ❌ |
| **businesses** | UPDATE | ✅ (solo suyos) | ❌ | ❌ | ❌ | ❌ |
| **businesses** | DELETE | ✅ (solo suyos) | ❌ | ❌ | ❌ | ❌ |
| **employees** | SELECT | ✅ (su negocio) | ✅ (su negocio) | ✅ (su negocio) | ⚠️ (solo su perfil) | ❌ |
| **employees** | INSERT | ✅ | ✅ | ❌ | ❌ | ❌ |
| **employees** | UPDATE | ✅ | ✅ | ⚠️ (solo su perfil) | ❌ | ❌ |
| **employees** | DELETE | ✅ | ❌ | ❌ | ❌ | ❌ |
| **products** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **products** | INSERT | ✅ | ✅ | ⚠️ (con límites) | ❌ | ❌ |
| **products** | UPDATE | ✅ | ✅ | ⚠️ (no precio) | ❌ | ❌ |
| **products** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **suppliers** | SELECT | ✅ | ✅ | ✅ | ❌ | ❌ |
| **suppliers** | INSERT | ✅ | ✅ | ❌ | ❌ | ❌ |
| **suppliers** | UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **suppliers** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **sales** | SELECT | ✅ | ✅ | ⚠️ (sus ventas) | ✅ (sus ventas) | ❌ |
| **sales** | INSERT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **sales** | UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **sales** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **sale_details** | SELECT | ✅ | ✅ | ⚠️ (sus ventas) | ✅ (sus ventas) | ❌ |
| **sale_details** | INSERT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **sale_details** | UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **sale_details** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **purchases** | SELECT | ✅ | ✅ | ⚠️ (sus compras) | ❌ | ❌ |
| **purchases** | INSERT | ✅ | ✅ | ✅ | ❌ | ❌ |
| **purchases** | UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **purchases** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **purchase_details** | SELECT | ✅ | ✅ | ⚠️ (sus compras) | ❌ | ❌ |
| **purchase_details** | INSERT | ✅ | ✅ | ✅ | ❌ | ❌ |
| **purchase_details** | UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **purchase_details** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **invoices** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **invoices** | INSERT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **invoices** | UPDATE | ✅ | ✅ | ⚠️ (no cancelar) | ⚠️ (no cancelar) | ❌ |
| **invoices** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **invoice_items** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **invoice_items** | INSERT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **invoice_items** | UPDATE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **invoice_items** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **customers** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **customers** | INSERT | ✅ | ✅ | ✅ | ❌ | ❌ |
| **customers** | UPDATE | ✅ | ✅ | ✅ | ❌ | ❌ |
| **customers** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **tables** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **tables** | INSERT | ✅ | ✅ | ❌ | ❌ | ❌ |
| **tables** | UPDATE | ✅ | ✅ | ✅ (status) | ✅ (status) | ❌ |
| **tables** | DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **orders** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **orders** | INSERT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **orders** | UPDATE | ✅ | ✅ | ✅ | ✅ | ❌ |
| **orders** | DELETE | ✅ | ✅ | ⚠️ (sus órdenes) | ⚠️ (sus órdenes) | ❌ |
| **order_items** | SELECT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **order_items** | INSERT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **order_items** | UPDATE | ✅ | ✅ | ✅ | ✅ | ❌ |
| **order_items** | DELETE | ✅ | ✅ | ✅ | ✅ | ❌ |

**Leyenda:**
- ✅ = Permitido completo
- ⚠️ = Permitido con restricciones
- ❌ = Denegado

---

## 4. POLÍTICAS RLS DETALLADAS

### 🏢 **BUSINESSES**

#### Políticas Necesarias:

1. **SELECT** - Ver negocios propios
2. **INSERT** - Crear nuevo negocio
3. **UPDATE** - Solo owner puede editar
4. **DELETE** - Solo owner puede eliminar

#### Restricciones:

- Usuario solo ve negocios donde es owner O empleado activo
- Solo owner puede modificar/eliminar su negocio
- Cualquier autenticado puede crear negocio

---

### 👥 **EMPLOYEES**

#### Políticas Necesarias:

1. **SELECT** - Ver empleados del negocio
   - Owner/Admin: ven todos
   - Employee/Cashier: solo su perfil
   
2. **INSERT** - Agregar empleados
   - Solo Owner/Admin
   
3. **UPDATE** - Modificar empleados
   - Owner/Admin: todos
   - Employee: solo su propio perfil (email, full_name)
   
4. **DELETE** - Eliminar empleados
   - Solo Owner

#### Restricciones:

- No se puede crear empleado con rol 'owner' (solo hay un owner)
- No se puede cambiar `user_id` una vez creado
- `is_active = false` es "soft delete" (no eliminar registro)
- Owner no puede eliminarse a sí mismo como empleado

---

### 🏷️ **PRODUCTS**

#### Políticas Necesarias:

1. **SELECT** - Ver productos
   - Todos los roles: ✅
   
2. **INSERT** - Crear productos
   - Owner/Admin: sin restricciones
   - Employee: puede crear pero con validación
   
3. **UPDATE** - Editar productos
   - Owner/Admin: todo
   - Employee: solo stock, no precio
   
4. **DELETE** - Eliminar productos
   - Solo Owner/Admin

#### Restricciones:

- `code` debe ser único por negocio
- No se puede eliminar producto con ventas/compras asociadas
- Preferir `is_active = false` en lugar de DELETE
- Validar stock >= 0

---

### 💰 **SALES**

#### Políticas Necesarias:

1. **SELECT** - Ver ventas
   - Owner/Admin: todas las ventas del negocio
   - Employee/Cashier: solo sus propias ventas
   
2. **INSERT** - Crear ventas
   - Todos los roles: ✅
   
3. **UPDATE** - Editar ventas
   - Solo Owner/Admin (para correcciones)
   
4. **DELETE** - Eliminar ventas
   - Solo Owner/Admin (con restauración de stock)

#### Restricciones:

- `user_id` se asigna automáticamente con `auth.uid()`
- `seller_name` se obtiene de `employees.full_name`
- DELETE debe restaurar stock (usar función `delete_sale()`)
- No se puede editar venta después de 24 horas (opcional)

---

### 📋 **SALE_DETAILS**

#### Políticas Necesarias:

1. **SELECT** - Ver detalles de venta
   - Mismo permiso que tabla `sales`
   
2. **INSERT** - Agregar items
   - Automático al crear venta
   
3. **UPDATE** - Editar items
   - Solo Owner/Admin
   
4. **DELETE** - Eliminar items
   - Solo Owner/Admin (con actualización de total)

#### Restricciones:

- Solo se pueden modificar items de ventas del mismo negocio
- CASCADE DELETE cuando se elimina venta
- Validar `quantity > 0`
- Validar `price >= 0`

---

### 🛒 **PURCHASES**

#### Políticas Necesarias:

1. **SELECT** - Ver compras
   - Owner/Admin: todas
   - Employee: solo las que creó
   
2. **INSERT** - Crear compras
   - Owner/Admin/Employee
   
3. **UPDATE** - Editar compras
   - Solo Owner/Admin
   
4. **DELETE** - Eliminar compras
   - Solo Owner/Admin (con reducción de stock)

#### Restricciones:

- `user_id` se asigna con `auth.uid()`
- `supplier_id` debe ser del mismo negocio
- DELETE debe reducir stock agregado
- `total` calculado automáticamente por trigger

---

### 📦 **PURCHASE_DETAILS**

#### Políticas Necesarias:

Similar a `sale_details`, vinculado a tabla padre `purchases`

---

### 📄 **INVOICES**

#### Políticas Necesarias:

1. **SELECT** - Ver facturas
   - Todos los roles autenticados del negocio
   
2. **INSERT** - Crear facturas
   - Todos excepto Employee básico
   
3. **UPDATE** - Editar facturas
   - Owner/Admin: todo
   - Employee/Cashier: solo `sent_at`
   
4. **DELETE** - Eliminar facturas
   - Solo Owner/Admin

#### Restricciones:

- `invoice_number` único por negocio (índice UNIQUE)
- `status = 'cancelled'` activa trigger de restauración de stock
- No se puede editar factura `status = 'paid'`
- `customer_id` debe ser del mismo negocio

---

### 📋 **INVOICE_ITEMS**

Similar a `sale_details`, vinculado a `invoices`

---

### 👤 **CUSTOMERS**

#### Políticas Necesarias:

1. **SELECT** - Ver clientes
   - Todos los roles del negocio
   
2. **INSERT** - Crear clientes
   - Owner/Admin/Employee
   
3. **UPDATE** - Editar clientes
   - Owner/Admin/Employee
   
4. **DELETE** - Eliminar clientes
   - Solo Owner/Admin

#### Restricciones:

- `email` único por negocio (opcional)
- `is_active = false` en lugar de DELETE
- No eliminar si tiene facturas asociadas

---

### 🪑 **TABLES** (Mesas)

#### Políticas Necesarias:

1. **SELECT** - Ver mesas
   - Todos los roles
   
2. **INSERT** - Crear mesas
   - Solo Owner/Admin
   
3. **UPDATE** - Editar mesas
   - Owner/Admin: todo
   - Employee/Cashier: solo `status`
   
4. **DELETE** - Eliminar mesas
   - Solo Owner/Admin

#### Restricciones:

- `table_number` único por negocio
- No eliminar mesa con orden activa

---

### 🍽️ **ORDERS** (Órdenes)

#### Políticas Necesarias:

1. **SELECT** - Ver órdenes
   - Todos los roles
   
2. **INSERT** - Crear órdenes
   - Todos los roles
   
3. **UPDATE** - Editar órdenes
   - Todos los roles (cambiar status)
   
4. **DELETE** - Eliminar órdenes
   - Owner/Admin: todas
   - Employee/Cashier: solo sus órdenes

#### Restricciones:

- `table_id` debe estar `status = 'available'` o del mismo negocio
- Al finalizar orden, se crea venta automáticamente
- DELETE solo si `status != 'completed'`

---

### 📦 **ORDER_ITEMS**

Similar a `sale_details`, vinculado a `orders`

---

## 5. FUNCIONES DE SEGURIDAD

### 🔐 **Funciones SECURITY DEFINER Necesarias**

#### 1. `get_user_business_ids()` ✅ (YA EXISTE)

```sql
-- Devuelve lista de negocios del usuario
-- BYPASS RLS para evitar dependencias circulares
```

#### 2. `get_user_role(p_business_id UUID)` ⚠️ (CREAR)

```sql
-- Devuelve rol del usuario en el negocio
-- Retorna: 'owner', 'admin', 'employee', 'cashier', NULL
```

#### 3. `check_is_owner(p_business_id UUID)` ⚠️ (CREAR)

```sql
-- Verifica si usuario es owner del negocio
-- Retorna: BOOLEAN
```

#### 4. `check_is_admin_or_owner(p_business_id UUID)` ⚠️ (CREAR)

```sql
-- Verifica si usuario es owner O admin
-- Retorna: BOOLEAN
```

#### 5. `check_can_delete_sale(p_sale_id UUID)` ⚠️ (CREAR)

```sql
-- Valida si usuario puede eliminar venta
-- Verifica: ownership + rol + tiempo transcurrido
-- Retorna: BOOLEAN
```

#### 6. `check_can_update_product_price(p_product_id UUID)` ⚠️ (CREAR)

```sql
-- Verifica si usuario puede cambiar precio de producto
-- Solo owner/admin
-- Retorna: BOOLEAN
```

---

## 6. SQL FINAL LISTO PARA USAR

📁 **Ver archivo:** `POLITICAS_RLS_COMPLETAS.sql`

*Este archivo se generará en la siguiente sección*

---

## 7. GUÍA DE PRUEBAS

📁 **Ver archivo:** `PRUEBAS_RLS.sql`

*Este archivo se generará con escenarios de prueba*

---

## 8. AJUSTES RECOMENDADOS

### ⚠️ Problemas Detectados en Diseño Actual

#### 1. **Falta columna `role` en employees con valores controlados**

**Problema:** `role` es TEXT sin restricciones

**Solución:**
```sql
-- Crear tipo ENUM
CREATE TYPE employee_role AS ENUM ('admin', 'employee', 'cashier');

-- Alterar columna
ALTER TABLE employees 
  ALTER COLUMN role TYPE employee_role 
  USING role::employee_role;

-- Agregar default
ALTER TABLE employees 
  ALTER COLUMN role SET DEFAULT 'employee';
```

#### 2. **`sales.user_id` y `purchases.user_id` sin FK**

**Problema:** Almacenan `auth.users.id` pero sin constraint

**Solución:** 
- ✅ Ya está documentado que no se puede crear FK a `auth.users`
- ✅ Mantener índices para performance
- ✅ Validar a nivel de aplicación

#### 3. **Falta auditoría de eliminaciones**

**Problema:** No hay registro de quién/cuándo eliminó registros

**Solución:**
```sql
-- Crear tabla de auditoría
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  user_id UUID NOT NULL,
  business_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. **No hay límite de empleados por negocio**

**Problema:** Un negocio podría crear 1000 empleados

**Solución:**
```sql
-- Agregar check constraint
ALTER TABLE employees 
  ADD CONSTRAINT max_employees_check 
  CHECK (
    (SELECT COUNT(*) FROM employees WHERE business_id = business_id) <= 50
  );
```

#### 5. **Falta validación de stock negativo**

**Problema:** Stock puede ser negativo

**Solución:**
```sql
ALTER TABLE products 
  ADD CONSTRAINT stock_non_negative 
  CHECK (stock >= 0);
```

#### 6. **No hay índices en `user_id` para filtros**

**Problema:** Queries `WHERE user_id = auth.uid()` son lentas

**Solución:**
```sql
CREATE INDEX idx_sales_user_id ON sales(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_purchases_user_id ON purchases(user_id) WHERE user_id IS NOT NULL;
```

---

## 9. ERRORES Y PREVENCIÓN

### 🚫 Errores Comunes al Implementar RLS

#### Error 1: Dependencia Circular

**Síntoma:**
```
ERROR: infinite recursion detected in policy for relation "businesses"
```

**Causa:** Política de `employees` consulta `businesses`, y `businesses` consulta `employees`

**Solución:** ✅ Usar `SECURITY DEFINER` en función helper

---

#### Error 2: Usuario no puede crear su primer negocio

**Síntoma:**
```
new row violates row-level security policy for table "businesses"
```

**Causa:** Política INSERT demasiado restrictiva

**Solución:**
```sql
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid()); -- ✅ Solo validar que sea SU UID
```

---

#### Error 3: Employee no puede ver productos

**Síntoma:** SELECT retorna 0 filas aunque existen productos

**Causa:** Política SELECT solo permite owner

**Solución:**
```sql
-- ❌ MAL
USING (
  business_id IN (
    SELECT id FROM businesses WHERE created_by = auth.uid()
  )
)

-- ✅ BIEN
USING (business_id IN (SELECT get_user_business_ids()))
```

---

#### Error 4: No se pueden insertar sale_details

**Síntoma:**
```
new row violates row-level security policy for table "sale_details"
```

**Causa:** Política INSERT de `sale_details` no valida correctamente

**Solución:**
```sql
CREATE POLICY "sale_details_insert"
  ON sale_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );
```

---

#### Error 5: Trigger de stock falla con RLS

**Síntoma:** Trigger no puede UPDATE products

**Causa:** Función de trigger no usa `SECURITY DEFINER`

**Solución:**
```sql
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER
SECURITY DEFINER  -- ✅ IMPORTANTE
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- ...código del trigger...
END;
$$;
```

---

#### Error 6: Performance lento en listados

**Síntoma:** SELECT tarda >2 segundos con RLS activo

**Causa:** Falta índice en `business_id`

**Solución:**
```sql
-- Crear índices compuestos
CREATE INDEX idx_sales_business_created 
  ON sales(business_id, created_at DESC);
```

---

### 🛡️ Mejores Prácticas de Seguridad

1. **Siempre usar `SECURITY DEFINER` en funciones helper**
   - Previene dependencias circulares
   - Mejora performance
   
2. **Validar business_id en WITH CHECK**
   - Asegura que INSERTs solo van al negocio correcto
   
3. **Usar funciones para lógica compleja**
   - No repetir código en múltiples políticas
   - Centralizar validaciones
   
4. **Preferir FOR ALL en lugar de 4 políticas**
   - Menos código
   - Más fácil mantener
   
5. **Agregar comentarios a políticas**
   ```sql
   COMMENT ON POLICY "sales_all" ON sales IS 
     'Permite SELECT/INSERT/UPDATE/DELETE solo si business_id está en get_user_business_ids()';
   ```

6. **Testear con múltiples roles**
   - Crear usuarios de prueba para cada rol
   - Validar que NO puedan acceder a datos de otros negocios
   
7. **Monitorear logs de Supabase**
   - Revisar errores de RLS en producción
   - Ajustar políticas según uso real

---

## 📊 RESUMEN EJECUTIVO

### ✅ Políticas a Crear: **42 políticas RLS**

- businesses: 4 políticas (SELECT, INSERT, UPDATE, DELETE)
- employees: 4 políticas diferenciadas por rol
- products: 4 políticas con validación de rol
- sales: 4 políticas (Owner/Admin ven todo, Employee solo suyos)
- sale_details: 4 políticas vinculadas a sales
- suppliers: 1 política FOR ALL
- purchases: 4 políticas (Owner/Admin ven todo, Employee solo suyos)
- purchase_details: 4 políticas vinculadas a purchases
- invoices: 4 políticas con validación de status
- invoice_items: 4 políticas vinculadas a invoices
- customers: 1 política FOR ALL
- tables: 4 políticas (UPDATE diferenciado para status)
- orders: 4 políticas
- order_items: 4 políticas

### ✅ Funciones a Crear: **6 funciones SECURITY DEFINER**

1. `get_user_role(business_id)` - Retorna rol del usuario
2. `check_is_owner(business_id)` - Verifica si es owner
3. `check_is_admin_or_owner(business_id)` - Verifica permisos admin
4. `check_can_delete_sale(sale_id)` - Validación de eliminación
5. `check_can_update_product_price(product_id)` - Validación de precio
6. `check_can_manage_employees(business_id)` - Validación de gestión

### ✅ Índices a Crear: **5 índices adicionales**

1. `idx_sales_user_business` en sales(user_id, business_id)
2. `idx_purchases_user_business` en purchases(user_id, business_id)
3. `idx_employees_user_id` en employees(user_id)
4. `idx_tables_business_number` UNIQUE en tables(business_id, table_number)
5. `idx_customers_email_business` en customers(business_id, email)

### ✅ Ajustes Recomendados: **6 mejoras estructurales**

1. Crear tipo ENUM para `employee_role`
2. Agregar tabla `audit_log` para auditoría
3. Agregar constraint `max_employees_check`
4. Agregar constraint `stock_non_negative`
5. Agregar columna `deleted_at` para soft delete
6. Agregar columna `deleted_by` para auditoría

---

**SIGUIENTE PASO:** Generar archivos SQL completos con todas las políticas

📁 **Archivos a crear:**
1. `POLITICAS_RLS_COMPLETAS.sql` - SQL ejecutable
2. `FUNCIONES_SEGURIDAD.sql` - Funciones helper
3. `PRUEBAS_RLS.sql` - Casos de prueba
4. `MEJORAS_ESTRUCTURA.sql` - Ajustes opcionales

---

**Fecha de análisis:** Diciembre 2024  
**Autor:** GitHub Copilot + Andres Plazas  
**Versión:** 1.0  
**Estado:** ✅ Análisis completo - Listo para implementación
