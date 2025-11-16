-- ============================================
-- 🔧 FIX: Sales user_id foreign key issue
-- ============================================

-- OPCIÓN 1: Hacer user_id nullable y opcional (RECOMENDADO)
ALTER TABLE sales ALTER COLUMN user_id DROP NOT NULL;

-- OPCIÓN 2: Si prefieres quitar la foreign key completamente
-- ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;

-- Verificar
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sales' AND column_name = 'user_id';
