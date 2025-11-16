-- ============================================
-- 🔧 FIX: Solo eliminar FK de orders.user_id
-- ============================================

-- Eliminar FK constraint de orders.user_id
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_fkey;
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

SELECT 'FK constraint de orders eliminada correctamente' as status;
