# Normatividad DIAN para Comprobantes POS (Colombia)

> **Documento actualizado:** Enero 2026  
> **Aplica a:** Sistema Stocky POS

---

## 📋 EJEMPLO COMPLETO DE COMPROBANTE DE PAGO

El siguiente es un ejemplo del comprobante que genera el sistema, **cumpliendo con las recomendaciones para NO ser considerado factura electrónica ni documento equivalente ante la DIAN:**

```
═══════════════════════════════════════
              [NOMBRE DEL NEGOCIO]
═══════════════════════════════════════

         COMPROBANTE DE PAGO
         Documento Informativo

Fecha: 13/01/2026          Hora: 14:30:25
Comprobante No.: CPV-000001
Atendido por: Juan Pérez

───────────────────────────────────────
PRODUCTOS/SERVICIOS
───────────────────────────────────────
Hamburguesa Premium    x2     $28.000
Bebida Natural         x2     $12.000
Postre del día         x1     $8.000
───────────────────────────────────────
TOTAL A PAGAR:               $48.000
Método: Efectivo
───────────────────────────────────────

¡Gracias por su compra!

═══════════════════════════════════════
         AVISO LEGAL IMPORTANTE
═══════════════════════════════════════

⚠️ ESTE DOCUMENTO NO CONSTITUYE FACTURA 
   DE VENTA NI DOCUMENTO EQUIVALENTE
   SEGÚN LA NORMATIVIDAD DE LA DIAN.

• No tiene validez fiscal ante la DIAN.
• No cuenta con CUFE ni código QR DIAN.
• No está habilitado para facturación
  electrónica.

📌 La responsabilidad tributaria de las
   operaciones comerciales recae
   exclusivamente en el establecimiento.

📄 Si requiere FACTURA ELECTRÓNICA válida
   ante la DIAN, por favor solicítela
   directamente al establecimiento.

═══════════════════════════════════════
    Sistema POS Stocky - Software de 
    gestión comercial sin integración 
    a facturación electrónica DIAN.
═══════════════════════════════════════
```

---

## ✅ RECOMENDACIONES LEGALES PARA EL NEGOCIO

### 1. Terminología Correcta
| ❌ EVITAR | ✅ USAR |
|-----------|---------|
| Factura | Comprobante de pago |
| Factura electrónica | Comprobante digital |
| Factura de venta | Documento informativo |
| Número de factura | Número de comprobante |
| FAC-000001 | CPV-000001 |

### 2. Elementos que NO debe incluir el comprobante
- ❌ **CUFE** (Código Único de Facturación Electrónica)
- ❌ **Código QR de la DIAN**
- ❌ **Numeración autorizada por la DIAN**
- ❌ **Resolución de facturación DIAN**
- ❌ **Texto "Factura Electrónica de Venta"**
- ❌ **Firma digital certificada DIAN**

### 3. Elementos que DEBE incluir
- ✅ Nombre o razón social del negocio
- ✅ Fecha y hora de la transacción
- ✅ Número de comprobante interno (sin prefijo DIAN)
- ✅ Detalle de productos/servicios
- ✅ Valor total
- ✅ Método de pago
- ✅ **Advertencia legal visible** indicando que no es factura

### 4. Avisos Legales Obligatorios
El comprobante **DEBE** incluir claramente uno de los siguientes avisos:

> "Este documento NO constituye factura de venta ni documento equivalente ante la DIAN."

> "Comprobante de pago sin validez fiscal. No es documento soporte de costos y deducciones."

> "Documento informativo. Para factura electrónica válida ante la DIAN, solicítela al establecimiento."

### 5. Responsabilidades del Establecimiento
El negocio debe:
- Llevar contabilidad de sus operaciones
- Emitir factura electrónica cuando el cliente la solicite (si está obligado)
- Declarar y pagar impuestos correspondientes
- Conservar soportes contables
- Cumplir con el régimen tributario aplicable (SIMPLE, ordinario, etc.)

---

## ⚖️ POR QUÉ ESTAS MEDIDAS REDUCEN EL RIESGO DE SANCIONES

### Marco Legal
Según la normatividad colombiana vigente (Estatuto Tributario, Decreto 358 de 2020, Resolución DIAN 000042 de 2020 y actualizaciones):

1. **La factura electrónica es obligatoria** para la mayoría de contribuyentes, pero debe ser emitida mediante un sistema autorizado y validado por la DIAN.

2. **Emitir documentos que simulen ser facturas** sin estar habilitado ante la DIAN puede generar:
   - Sanciones por facturación irregular (Art. 657 E.T.)
   - Multas por expedición de documentos sin requisitos legales
   - Desconocimiento de costos y deducciones para el comprador

### Diferenciación Clara
Al usar la terminología correcta y los avisos legales:

1. **Se evita la confusión fiscal**: El cliente y las autoridades entienden que NO es un documento con efectos tributarios.

2. **Se protege al software**: El sistema no está simulando ser un facturador electrónico autorizado.

3. **Se protege al negocio**: El establecimiento no está presentando documentos fraudulentos como si fueran facturas.

4. **Se cumple con la buena fe**: Se informa claramente al cliente que puede solicitar factura electrónica si la requiere.

### Beneficios Adicionales
- Evita reclamaciones de clientes que asuman tener una factura válida
- Protege al establecimiento de auditorías por uso indebido de numeración
- Facilita la migración futura a facturación electrónica real
- Mantiene trazabilidad interna sin comprometer aspectos legales

---

## 🔄 PROCESO RECOMENDADO

```
┌─────────────────────────────────────────────────┐
│               VENTA EN PUNTO DE VENTA           │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│     GENERAR COMPROBANTE DE PAGO (Stocky)       │
│     - Documento informativo interno             │
│     - Sin efectos fiscales ante DIAN            │
└─────────────────────────────────────────────────┘
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Cliente NO         │   │  Cliente SÍ         │
│  requiere factura   │   │  requiere factura   │
└─────────────────────┘   └─────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Transacción        │   │  Emitir factura     │
│  completada         │   │  electrónica desde  │
│                     │   │  sistema habilitado │
│                     │   │  ante la DIAN       │
└─────────────────────┘   └─────────────────────┘
```

---

## 📞 RECURSOS ADICIONALES

- **Portal DIAN:** www.dian.gov.co
- **Resolución 000042 de 2020:** Facturación electrónica
- **Decreto 358 de 2020:** Reglamentación factura electrónica
- **Art. 616-1 Estatuto Tributario:** Factura de venta

---

## ⚠️ DESCARGO DE RESPONSABILIDAD

Este documento es una guía informativa para el uso correcto del software Stocky POS. **El software Stocky NO está integrado a la facturación electrónica de la DIAN** y los documentos que genera son únicamente comprobantes internos sin validez fiscal.

**La responsabilidad tributaria de todas las operaciones comerciales recae exclusivamente en el establecimiento comercial que utiliza el software.**

Para integrar su negocio a la facturación electrónica de la DIAN, debe contratar un proveedor tecnológico autorizado o habilitarse directamente ante la DIAN.

---

*Documento generado por el equipo de Stocky POS - Enero 2026*
