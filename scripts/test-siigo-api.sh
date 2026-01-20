#!/bin/bash
# ============================================
# 🧪 Script de Prueba - API Siigo
# ============================================
# Este script prueba la autenticación y endpoints básicos de Siigo API

# ============================================
# CREDENCIALES DE PRUEBA
# ============================================
# Para obtener credenciales de prueba:
# 1. Contacta a Siigo: https://www.siigo.com/contactenos/
# 2. Indica que necesitas credenciales API de prueba
# 3. Proporciona el NIT de tu empresa registrada en Siigo
#
# Siigo te enviará por correo:
# - Username (email)
# - Access Key

# Configura tus credenciales aquí:
SIIGO_USERNAME="tu-email@empresa.com"
SIIGO_ACCESS_KEY="tu-access-key"

# URL de la API
SIIGO_API_URL="https://api.siigo.com"

# Partner ID (nombre de tu aplicación)
PARTNER_ID="stockly"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🧪 Prueba de API Siigo - Stocky${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ============================================
# 1. AUTENTICACIÓN
# ============================================
echo -e "${YELLOW}📝 Paso 1: Autenticación...${NC}"

AUTH_RESPONSE=$(curl -s -X POST "${SIIGO_API_URL}/auth" \
  -H "Content-Type: application/json" \
  -H "Partner-Id: ${PARTNER_ID}" \
  -d "{
    \"username\": \"${SIIGO_USERNAME}\",
    \"access_key\": \"${SIIGO_ACCESS_KEY}\"
  }")

# Verificar si hay error
if echo "$AUTH_RESPONSE" | grep -q "access_token"; then
  ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
  EXPIRES_IN=$(echo "$AUTH_RESPONSE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)
  
  echo -e "${GREEN}✅ Autenticación exitosa!${NC}"
  echo -e "   Token: ${ACCESS_TOKEN:0:50}..."
  echo -e "   Expira en: ${EXPIRES_IN} segundos"
  echo ""
else
  echo -e "${RED}❌ Error de autenticación${NC}"
  echo "$AUTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$AUTH_RESPONSE"
  exit 1
fi

# ============================================
# 2. CONSULTAR TIPOS DE FACTURA
# ============================================
echo -e "${YELLOW}📄 Paso 2: Consultando tipos de factura...${NC}"

DOCUMENT_TYPES=$(curl -s -X GET "${SIIGO_API_URL}/v1/document-types?type=FV" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Partner-Id: ${PARTNER_ID}")

if echo "$DOCUMENT_TYPES" | grep -q '"id"'; then
  echo -e "${GREEN}✅ Tipos de factura obtenidos!${NC}"
  echo "$DOCUMENT_TYPES" | python3 -m json.tool 2>/dev/null | head -30
  echo ""
else
  echo -e "${RED}❌ Error obteniendo tipos de factura${NC}"
  echo "$DOCUMENT_TYPES" | python3 -m json.tool 2>/dev/null || echo "$DOCUMENT_TYPES"
fi

# ============================================
# 3. CONSULTAR IMPUESTOS
# ============================================
echo -e "${YELLOW}💰 Paso 3: Consultando impuestos...${NC}"

TAXES=$(curl -s -X GET "${SIIGO_API_URL}/v1/taxes" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Partner-Id: ${PARTNER_ID}")

if echo "$TAXES" | grep -q '"id"'; then
  echo -e "${GREEN}✅ Impuestos obtenidos!${NC}"
  echo "$TAXES" | python3 -m json.tool 2>/dev/null | head -30
  echo ""
else
  echo -e "${RED}❌ Error obteniendo impuestos${NC}"
  echo "$TAXES" | python3 -m json.tool 2>/dev/null || echo "$TAXES"
fi

# ============================================
# 4. CONSULTAR FORMAS DE PAGO
# ============================================
echo -e "${YELLOW}💳 Paso 4: Consultando formas de pago...${NC}"

PAYMENT_TYPES=$(curl -s -X GET "${SIIGO_API_URL}/v1/payment-types?document_type=FV" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Partner-Id: ${PARTNER_ID}")

if echo "$PAYMENT_TYPES" | grep -q '"id"'; then
  echo -e "${GREEN}✅ Formas de pago obtenidas!${NC}"
  echo "$PAYMENT_TYPES" | python3 -m json.tool 2>/dev/null | head -30
  echo ""
else
  echo -e "${RED}❌ Error obteniendo formas de pago${NC}"
  echo "$PAYMENT_TYPES" | python3 -m json.tool 2>/dev/null || echo "$PAYMENT_TYPES"
fi

# ============================================
# 5. CONSULTAR USUARIOS/VENDEDORES
# ============================================
echo -e "${YELLOW}👤 Paso 5: Consultando usuarios/vendedores...${NC}"

USERS=$(curl -s -X GET "${SIIGO_API_URL}/v1/users" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Partner-Id: ${PARTNER_ID}")

if echo "$USERS" | grep -q '"id"'; then
  echo -e "${GREEN}✅ Usuarios obtenidos!${NC}"
  echo "$USERS" | python3 -m json.tool 2>/dev/null | head -30
  echo ""
else
  echo -e "${RED}❌ Error obteniendo usuarios${NC}"
  echo "$USERS" | python3 -m json.tool 2>/dev/null || echo "$USERS"
fi

# ============================================
# 6. CONSULTAR GRUPOS DE INVENTARIO
# ============================================
echo -e "${YELLOW}📦 Paso 6: Consultando grupos de inventario...${NC}"

ACCOUNT_GROUPS=$(curl -s -X GET "${SIIGO_API_URL}/v1/account-groups" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Partner-Id: ${PARTNER_ID}")

if echo "$ACCOUNT_GROUPS" | grep -q '"id"'; then
  echo -e "${GREEN}✅ Grupos de inventario obtenidos!${NC}"
  echo "$ACCOUNT_GROUPS" | python3 -m json.tool 2>/dev/null | head -30
  echo ""
else
  echo -e "${RED}❌ Error obteniendo grupos de inventario${NC}"
  echo "$ACCOUNT_GROUPS" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNT_GROUPS"
fi

# ============================================
# RESUMEN
# ============================================
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}🎉 Prueba completada!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Los IDs obtenidos arriba son los que necesitas configurar en:"
echo -e "  ${YELLOW}business_siigo_credentials${NC}"
echo ""
echo -e "Campos importantes a guardar:"
echo -e "  - document_type_id: ID del tipo de factura de venta"
echo -e "  - tax_id_iva_0, tax_id_iva_5, tax_id_iva_19: IDs de impuestos"
echo -e "  - payment_id_cash, payment_id_credit_card, etc: IDs formas de pago"
echo -e "  - default_seller_id: ID del vendedor por defecto"
echo ""
