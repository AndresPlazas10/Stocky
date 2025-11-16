-- ============================================
-- 🔧 FIX DEFINITIVO: Eliminar foreign key constraint
-- ============================================

-- Ver el nombre exacto de la constraint
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'sales' AND column_name = 'user_id';

-- Eliminar la foreign key constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS fk_sales_user;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_user_fkey;

-- Hacer la columna nullable por si acaso
ALTER TABLE sales ALTER COLUMN user_id DROP NOT NULL;

-- Verificar que se eliminó
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'sales' AND constraint_type = 'FOREIGN KEY';
