-- ============================================================
-- SCRIPT DE DATOS DE PRUEBA - Stocky (CORREGIDO)
-- Negocio: 969d99d5-a538-4aef-80d1-40213afda3b8
-- Categorías válidas: Platos, Bebidas Alcohólicas, Cervezas,
--   Vinos, Licores, Bebidas, Snacks, Comida, Otros
-- ============================================================
-- PRECAUCIÓN: Este script elimina los datos existentes del
-- negocio de prueba y los reemplaza con datos frescos.
-- ============================================================

DO $$
DECLARE
  v_business_id uuid := '969d99d5-a538-4aef-80d1-40213afda3b8';
  v_supplier_coca uuid;
  v_supplier_bavaria uuid;
  v_supplier_nacional uuid;
  v_supplier_exito uuid;
  v_supplier_carnes uuid;

  v_prod_cocacola uuid; v_prod_cocacola_zero uuid; v_prod_sprite uuid;
  v_prod_agua uuid; v_prod_agua_gas uuid;
  v_prod_jugo_naranja uuid; v_prod_jugo_mora uuid;
  v_prod_gatorade uuid; v_prod_monster uuid;
  v_prod_cerveza_aguila uuid; v_prod_cerveza_club uuid; v_prod_cerveza_corona uuid;
  v_prod_michelada uuid;
  v_prod_vino_tinto uuid;
  v_prod_ron uuid; v_prod_aguardiente uuid; v_prod_whisky uuid; v_prod_tequila uuid;
  v_prod_sangria uuid;

  v_prod_hamburguesa uuid; v_prod_hamburguesa_doble uuid;
  v_prod_perro uuid; v_prod_perro_especial uuid;
  v_prod_salchipapa uuid; v_prod_alitas uuid; v_prod_pollo_apanado uuid;
  v_prod_churrasco uuid; v_prod_lomo_sal uuid; v_prod_cerdo uuid; v_prod_trucha uuid;
  v_prod_arroz uuid; v_prod_frijoles uuid; v_prod_ensalada uuid;
  v_prod_patacones uuid; v_prod_yuca uuid; v_prod_arepa uuid; v_prod_papa_francesa uuid;

  v_prod_helado uuid; v_prod_brownie uuid; v_prod_torta uuid;
  v_prod_flan uuid; v_prod_oblea uuid; v_prod_fresas uuid;

  v_prod_mani uuid; v_prod_papas_limon uuid; v_prod_chicharron uuid;
  v_prod_pandebono uuid; v_prod_empanada uuid;

  v_combo_familiar uuid; v_combo_pareja uuid; v_combo_amigos uuid;
  v_combo_fiestero uuid; v_combo_ejecutivo uuid;
BEGIN
  -- LIMPIAR DATOS EXISTENTES
  DELETE FROM combo_items WHERE combo_id IN (SELECT id FROM combos WHERE business_id = v_business_id);
  DELETE FROM combos WHERE business_id = v_business_id;
  DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = v_business_id);
  DELETE FROM orders WHERE business_id = v_business_id;
  DELETE FROM sale_details WHERE sale_id IN (SELECT id FROM sales WHERE business_id = v_business_id);
  DELETE FROM sales WHERE business_id = v_business_id;
  DELETE FROM purchase_details WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = v_business_id);
  DELETE FROM purchases WHERE business_id = v_business_id;
  DELETE FROM table_edit_locks WHERE business_id = v_business_id;
  DELETE FROM tables WHERE business_id = v_business_id;
  DELETE FROM products WHERE business_id = v_business_id;
  DELETE FROM suppliers WHERE business_id = v_business_id;
  RAISE NOTICE '✅ Datos anteriores eliminados.';

  -- PROVEEDORES
  INSERT INTO suppliers (id, business_id, business_name, identification, contact_name, phone, email, address, nit, notes, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Coca-Cola FEMSA', '900123456-1', 'Carlos Gomez', '3101112233', 'carlos@cocacola.com.co', 'Calle 80 #15-20, Bogotá', '900123456', 'Bebidas gaseosas y aguas', now())
  RETURNING id INTO v_supplier_coca;
  INSERT INTO suppliers (id, business_id, business_name, identification, contact_name, phone, email, address, nit, notes, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Bavaria S.A.', '860005279-5', 'Maria Rodriguez', '3154445566', 'maria@bavaria.com.co', 'Carrera 50 #77-30, Medellín', '860005279', 'Cervezas y bebidas alcohólicas', now())
  RETURNING id INTO v_supplier_bavaria;
  INSERT INTO suppliers (id, business_id, business_name, identification, contact_name, phone, email, address, nit, notes, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Distribuidora Nacional', '800777888-2', 'Pedro Martinez', '3207778899', 'pedro@nacional.com.co', 'Av. Caracas #25-40, Bogotá', '800777888', 'Alimentos y abarrotes', now())
  RETURNING id INTO v_supplier_nacional;
  INSERT INTO suppliers (id, business_id, business_name, identification, contact_name, phone, email, address, nit, notes, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Grupo Éxito Abastos', '890903279-8', 'Ana Torres', '3115556677', 'ana@exito.com.co', 'Calle 13 #30-24, Bogotá', '890903279', 'Verduras, frutas y abarrotes', now())
  RETURNING id INTO v_supplier_exito;
  INSERT INTO suppliers (id, business_id, business_name, identification, contact_name, phone, email, address, nit, notes, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Cárnicos El Vaquero', '901445566-3', 'Luis Herrera', '3182223344', 'luis@vaquero.com.co', 'Calle 19 #5-12, Bogotá', '901445566', 'Carnes frías y embutidos', now())
  RETURNING id INTO v_supplier_carnes;
  RAISE NOTICE '✅ 5 proveedores.';

  -- BEBIDAS (gaseosas, aguas, jugos, energizantes)
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Coca-Cola 350ml', 'PRD-0001', 'Bebidas', 1500, 3500, 80, 10, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_cocacola;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Coca-Cola Zero 350ml', 'PRD-0002', 'Bebidas', 1500, 3500, 40, 5, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_cocacola_zero;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Sprite 350ml', 'PRD-0003', 'Bebidas', 1500, 3500, 50, 8, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_sprite;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Agua Cristal 600ml', 'PRD-0004', 'Bebidas', 800, 2000, 60, 10, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_agua;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Agua con Gas 500ml', 'PRD-0005', 'Bebidas', 900, 2200, 30, 5, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_agua_gas;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Jugo de Naranja Natural 400ml', 'PRD-0006', 'Bebidas', 2000, 5000, 25, 5, 'Unidad', true, v_supplier_exito, true, now())
  RETURNING id INTO v_prod_jugo_naranja;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Jugo de Mora 400ml', 'PRD-0007', 'Bebidas', 1800, 4500, 20, 5, 'Unidad', true, v_supplier_exito, true, now())
  RETURNING id INTO v_prod_jugo_mora;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Gatorade 500ml', 'PRD-0008', 'Bebidas', 2500, 6000, 35, 5, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_gatorade;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Monster Energy 473ml', 'PRD-0009', 'Bebidas', 4000, 8000, 20, 3, 'Unidad', true, v_supplier_coca, true, now())
  RETURNING id INTO v_prod_monster;
  RAISE NOTICE '✅ 9 Bebidas.';

  -- CERVEZAS
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Cerveza Águila 330ml', 'PRD-0010', 'Cervezas', 2000, 4500, 100, 15, 'Unidad', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_cerveza_aguila;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Cerveza Club Colombia 330ml', 'PRD-0011', 'Cervezas', 2500, 5500, 80, 10, 'Unidad', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_cerveza_club;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Corona Extra 355ml', 'PRD-0012', 'Cervezas', 3500, 7000, 40, 5, 'Unidad', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_cerveza_corona;
  RAISE NOTICE '✅ 3 Cervezas.';

  -- BEBIDAS ALCOHÓLICAS (michelada, sangría)
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Michelada', 'PRD-0013', 'Bebidas Alcohólicas', 2500, 6000, 30, 5, 'Unidad', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_michelada;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Sangría Casera Jarra 1L', 'PRD-0014', 'Bebidas Alcohólicas', 8000, 18000, 15, 3, 'Jarra', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_sangria;
  RAISE NOTICE '✅ 2 Bebidas Alcohólicas.';

  -- VINOS
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Vino Tinto Casa 750ml', 'PRD-0015', 'Vinos', 15000, 35000, 12, 2, 'Botella', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_vino_tinto;
  RAISE NOTICE '✅ 1 Vinos.';

  -- LICORES
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Ron Viejo de Caldas Botella 750ml', 'PRD-0016', 'Licores', 30000, 60000, 8, 2, 'Botella', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_ron;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Aguardiente Antioqueño Botella 750ml', 'PRD-0017', 'Licores', 25000, 50000, 10, 2, 'Botella', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_aguardiente;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Whisky Johnnie Walker Red 750ml', 'PRD-0018', 'Licores', 50000, 100000, 5, 1, 'Botella', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_whisky;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Tequila José Cuervo Reposado 750ml', 'PRD-0019', 'Licores', 45000, 90000, 4, 1, 'Botella', true, v_supplier_bavaria, true, now())
  RETURNING id INTO v_prod_tequila;
  RAISE NOTICE '✅ 4 Licores.';

  -- PLATOS (hamburguesas, perros, fritos, carnes, acompañamientos)
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Hamburguesa Clásica', 'PRD-0020', 'Platos', 5000, 12000, 40, 5, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_hamburguesa;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Hamburguesa Doble Carne', 'PRD-0021', 'Platos', 8000, 18000, 30, 5, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_hamburguesa_doble;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Perro Caliente Sencillo', 'PRD-0022', 'Platos', 3500, 8000, 35, 5, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_perro;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Perro Caliente Especial', 'PRD-0023', 'Platos', 5000, 12000, 25, 5, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_perro_especial;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Salchipapa Personal', 'PRD-0024', 'Platos', 4000, 10000, 40, 8, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_salchipapa;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Alitas BBQ 6 Unidades', 'PRD-0025', 'Platos', 7000, 15000, 25, 5, 'Porción', true, v_supplier_carnes, false, now())
  RETURNING id INTO v_prod_alitas;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Pollo Apanado 4 Presas', 'PRD-0026', 'Platos', 6000, 14000, 20, 5, 'Porción', true, v_supplier_carnes, false, now())
  RETURNING id INTO v_prod_pollo_apanado;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Churrasco 250g', 'PRD-0027', 'Platos', 12000, 25000, 18, 3, 'Unidad', true, v_supplier_carnes, false, now())
  RETURNING id INTO v_prod_churrasco;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Lomo Saltado 300g', 'PRD-0028', 'Platos', 10000, 22000, 15, 3, 'Unidad', true, v_supplier_carnes, false, now())
  RETURNING id INTO v_prod_lomo_sal;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Chuleta de Cerdo 250g', 'PRD-0029', 'Platos', 9000, 20000, 12, 3, 'Unidad', true, v_supplier_carnes, false, now())
  RETURNING id INTO v_prod_cerdo;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Trucha Frita Entera', 'PRD-0030', 'Platos', 11000, 24000, 10, 2, 'Unidad', true, v_supplier_carnes, false, now())
  RETURNING id INTO v_prod_trucha;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Arroz Blanco Porción', 'PRD-0031', 'Platos', 1500, 4000, 50, 10, 'Porción', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_arroz;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Frijoles Porción', 'PRD-0032', 'Platos', 1800, 4500, 40, 8, 'Porción', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_frijoles;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Ensalada Fresca', 'PRD-0033', 'Platos', 2000, 5000, 30, 5, 'Porción', true, v_supplier_exito, false, now())
  RETURNING id INTO v_prod_ensalada;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Patacones 4 Unidades', 'PRD-0034', 'Platos', 2000, 5000, 35, 5, 'Porción', true, v_supplier_exito, false, now())
  RETURNING id INTO v_prod_patacones;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Yuca Frita Porción', 'PRD-0035', 'Platos', 1800, 4500, 30, 5, 'Porción', true, v_supplier_exito, false, now())
  RETURNING id INTO v_prod_yuca;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Arepa 2 Unidades', 'PRD-0036', 'Platos', 1500, 3500, 45, 8, 'Porción', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_arepa;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Papa Francesa Porción', 'PRD-0037', 'Platos', 2000, 5000, 50, 8, 'Porción', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_papa_francesa;
  RAISE NOTICE '✅ 18 Platos.';

  -- OTROS (postres)
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Helado Tres Sabores', 'PRD-0038', 'Otros', 3000, 7000, 20, 3, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_helado;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Brownie con Helado', 'PRD-0039', 'Otros', 4000, 9000, 15, 3, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_brownie;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Torta de Chocolate Porción', 'PRD-0040', 'Otros', 3500, 8000, 12, 2, 'Porción', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_torta;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Flan de Caramelo', 'PRD-0041', 'Otros', 2500, 6000, 15, 3, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_flan;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Oblea con Arequipe', 'PRD-0042', 'Otros', 2000, 5000, 20, 3, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_oblea;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Fresas con Crema', 'PRD-0043', 'Otros', 5000, 10000, 10, 2, 'Porción', true, v_supplier_exito, false, now())
  RETURNING id INTO v_prod_fresas;
  RAISE NOTICE '✅ 6 Otros.';

  -- SNACKS
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Maní Salado Paquete', 'PRD-0044', 'Snacks', 1500, 3500, 40, 5, 'Paquete', true, v_supplier_nacional, true, now())
  RETURNING id INTO v_prod_mani;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Papas Limón Paquete', 'PRD-0045', 'Snacks', 1200, 3000, 35, 5, 'Paquete', true, v_supplier_nacional, true, now())
  RETURNING id INTO v_prod_papas_limon;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Chicharrón Paquete', 'PRD-0046', 'Snacks', 2000, 4500, 25, 5, 'Paquete', true, v_supplier_nacional, true, now())
  RETURNING id INTO v_prod_chicharron;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Pandebono 2 Unidades', 'PRD-0047', 'Snacks', 2000, 4000, 30, 5, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_pandebono;
  INSERT INTO products (id, business_id, name, code, category, purchase_price, sale_price, stock, min_stock, unit, is_active, supplier_id, manage_stock, created_at)
  VALUES (gen_random_uuid(), v_business_id, 'Empanada de Carne', 'PRD-0048', 'Snacks', 1500, 3500, 40, 8, 'Unidad', true, v_supplier_nacional, false, now())
  RETURNING id INTO v_prod_empanada;
  RAISE NOTICE '✅ 5 Snacks.';

  -- COMBOS
  INSERT INTO combos (id, business_id, nombre, precio_venta, descripcion, estado, created_at, updated_at)
  VALUES (gen_random_uuid(), v_business_id, 'Combo Familiar (4 Personas)', 50000, '4 Hamburguesas Clásicas + 4 Gaseosas + 2 Papas Francesas Grandes', 'active', now(), now())
  RETURNING id INTO v_combo_familiar;
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_familiar, v_prod_hamburguesa, 4, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_familiar, v_prod_cocacola, 4, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_familiar, v_prod_papa_francesa, 2, now());

  INSERT INTO combos (id, business_id, nombre, precio_venta, descripcion, estado, created_at, updated_at)
  VALUES (gen_random_uuid(), v_business_id, 'Combo Pareja', 35000, '2 Churrascos + 2 Jugos Naturales + 2 Patacones', 'active', now(), now())
  RETURNING id INTO v_combo_pareja;
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_pareja, v_prod_churrasco, 2, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_pareja, v_prod_jugo_naranja, 2, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_pareja, v_prod_patacones, 2, now());

  INSERT INTO combos (id, business_id, nombre, precio_venta, descripcion, estado, created_at, updated_at)
  VALUES (gen_random_uuid(), v_business_id, 'Combo Amigos', 80000, '6 Cervezas Águila + 2 Salchipapas Grandes + Maní + Chicharrón', 'active', now(), now())
  RETURNING id INTO v_combo_amigos;
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_amigos, v_prod_cerveza_aguila, 6, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_amigos, v_prod_salchipapa, 2, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_amigos, v_prod_mani, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_amigos, v_prod_chicharron, 1, now());

  INSERT INTO combos (id, business_id, nombre, precio_venta, descripcion, estado, created_at, updated_at)
  VALUES (gen_random_uuid(), v_business_id, 'Combo Fiestero', 150000, 'Botella Aguardiente + 6 Cervezas Club + 2 Alitas + Patacones + Papa Francesa', 'active', now(), now())
  RETURNING id INTO v_combo_fiestero;
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_fiestero, v_prod_aguardiente, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_fiestero, v_prod_cerveza_club, 6, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_fiestero, v_prod_alitas, 2, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_fiestero, v_prod_patacones, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_fiestero, v_prod_papa_francesa, 1, now());

  INSERT INTO combos (id, business_id, nombre, precio_venta, descripcion, estado, created_at, updated_at)
  VALUES (gen_random_uuid(), v_business_id, 'Combo Ejecutivo', 28000, 'Churrasco + Arroz + Ensalada + Jugo Natural + Brownie', 'active', now(), now())
  RETURNING id INTO v_combo_ejecutivo;
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_ejecutivo, v_prod_churrasco, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_ejecutivo, v_prod_arroz, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_ejecutivo, v_prod_ensalada, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_ejecutivo, v_prod_jugo_naranja, 1, now());
  INSERT INTO combo_items (id, combo_id, producto_id, cantidad, created_at) VALUES (gen_random_uuid(), v_combo_ejecutivo, v_prod_brownie, 1, now());
  RAISE NOTICE '✅ 5 Combos.';

  -- MESAS
  FOR i IN 1..10 LOOP
    INSERT INTO tables (id, business_id, table_number, status, created_at, sync_version)
    VALUES (gen_random_uuid(), v_business_id, i::text, 'available', now(), 0);
  END LOOP;
  RAISE NOTICE '✅ 10 Mesas.';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'INVENTARIO CREADO - 48 productos, 5 combos, 5 proveedores, 10 mesas';
  RAISE NOTICE 'Categorías: Bebidas(9) Cervezas(3) Bebidas Alcohol.(2) Vinos(1) Licores(4) Platos(18) Otros(6) Snacks(5)';
  RAISE NOTICE '============================================';

END $$;
