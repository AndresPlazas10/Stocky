BEGIN;

CREATE INDEX IF NOT EXISTS idx_suppliers_business_created_at_desc
  ON suppliers(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_name
  ON suppliers(business_id, business_name);

CREATE INDEX IF NOT EXISTS idx_employees_business_created_at_desc
  ON employees(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_business_created_at_desc
  ON products(business_id, created_at DESC);

COMMIT;
