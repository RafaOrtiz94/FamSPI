# Requerimientos de integración SPI ↔ Odoo

- **Última revisión:** 2026-04-11  
- **Contexto:** Oracle se retira. **Odoo** es el ERP objetivo. El **SPI** debe intercambiar datos de forma segura, idempotente y operable, sin depender del legado Oracle.

---

## 1. Alcance funcional por dominio

| Dominio | Dirección principal | Modelos Odoo de referencia |
|---------|---------------------|----------------------------|
| Maestros cliente/proveedor | SPI ↔ Odoo según política de “golden record” | `res.partner` |
| CRM / oportunidad | Eventos desde SPI hacia Odoo o lectura para enriquecimiento | `crm.lead`, etapas CRM |
| Ventas | Pedidos/cotizaciones derivados de BC o cierres comerciales | `sale.order`, `sale.order.line` |
| Compras / entregas | Solicitudes aprobadas en SPI → albaranes/pedidos compra | `purchase.order`, `stock.picking` |
| Facturación / pagos | Según política financiera (no duplicar con contabilidad ya en Odoo) | `account.move`, `account.payment` |
| Catálogo | SPI consume precios/códigos desde Odoo tras sincronización post-migración | `product.product`, `product.pricelist` |

---

## 2. Requisitos no funcionales transversales

### INT-ODOO-001 — Contrato de datos versionado

Esquema JSON/OpenAPI para cada familia de mensaje (`v1`, `v2`); deprecación documentada.

### INT-ODOO-002 — Idempotencia

Clave natural de negocio + `correlation_id`; reintentos seguros sin duplicar registros en Odoo.

### INT-ODOO-003 — Cola desacoplada

Productor en SPI (outbox); consumidor con reintentos exponenciales y dead-letter.

### INT-ODOO-004 — Seguridad

Autenticación de servicio (API key / OAuth según despliegue Odoo), TLS, rotación de secretos, mínimo privilegio.

### INT-ODOO-005 — Observabilidad

Métricas: latencia, throughput, tasa de error, lag de cola; logs con `correlation_id`.

### INT-ODOO-006 — Conciliación

Jobs programados que comparen totales o muestras entre SPI y Odoo; informe de diferencias.

### INT-ODOO-007 — Modo degradado

Si Odoo no responde, SPI continúa operación core; cola acumula o pausa según política.

### INT-ODOO-008 — Pruebas de contrato

Tests automatizados contra API Odoo mock o sandbox con versión fijada de contrato.

---

## 3. Integración de máximos y entregas parciales

### INT-ODOO-010 — Referencias cruzadas

Campos técnicos en Odoo (`x_spi_*`) en pedidos, movimientos o líneas enlazando IDs de solicitud/máximo del SPI.

### INT-ODOO-011 — Validación de cantidades

Política acordada: Odoo acepta solo cantidades prevalidadas por SPI o SPI solo descuenta saldo tras confirmación de Odoo (elegir un modelo y documentarlo).

### INT-ODOO-012 — Compras privadas vs públicas

Mapeo distinto de flujo hacia `purchase` / `stock` según tipo de proceso y plan de entregas.

### INT-ODOO-013 — Trazabilidad de lote/serial

Para reactivos y equipos con trazabilidad, alinear con configuración `stock` y `lot` en Odoo.

---

## 4. Migración de datos y Odoo

### INT-ODOO-020 — Post-migración Oracle

Tras `migrate_oracle_to_odoo_erp.py`, ejecutar validación de cobertura de códigos usados por SPI (libro de correspondencia).

### INT-ODOO-021 — Corrección de tipos de producto

Ajustar `product.type` y categorías para equipos, servicios y consumibles según taxonomía acordada.

### INT-ODOO-022 — Precios y costos

Cerrar brechas documentadas en informes de productos sin precio/costo antes de integración productiva.

---

## 5. Alineación con paquete `integracion/`

El repositorio contiene miles de requisitos generados por área en `integracion/area_*_requerimientos.md`. Este documento **consolida el marco** para el programa actual (corte Oracle + máximos + entregas). Para detalle por ID histórico, seguir referencias:

- `integracion/INDEX_REQUERIMIENTOS_SPI_ODOO.md`  
- Áreas A03 (comercial), A05 (finanzas), A06 (plataforma / integración)

---

## 6. Criterios de aceptación global

1. Con integración **apagada**, el SPI pasa suite de regresión acordada.  
2. Con integración **encendida** en sandbox, flujo BC → máximo → solicitud → reflejo en Odoo completa sin errores en caso de prueba estándar.  
3. Runbook de incidentes aprobado por operaciones.  
4. Acta de go-live firmada por negocio y TI.
