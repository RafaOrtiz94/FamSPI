# Plan de implementación para liquidación de viáticos en Google Sheet

## Objetivo

Generar y llenar automáticamente la plantilla Google Sheet `1SVWFtjV3J6EgfXLGfKqiXHUDeqoPho2BmIz4QFkQRGs` con la información consolidada del expediente padre de viáticos, manteniendo coherencia con el flujo actual de subexpedientes `with_card` y `without_card`.

## Principios

- No romper el flujo actual de viáticos.
- El Sheet se llena desde datos verificados del expediente padre.
- La información faltante debe capturarse en el punto del flujo donde realmente nace.
- No duplicar lógica entre PDF actual, segmentos y plantilla Sheet.

## Fase 1. Inventario técnico y mapeo real de celdas

### Objetivo

Convertir el mapeo funcional en un contrato técnico exacto de celdas/rangos.

### Tareas

1. Leer el Google Sheet real con credenciales funcionales.
2. Identificar:
   - nombre de pestaña
   - rangos estáticos de encabezado
   - fila inicial del detalle
   - fila de totales
   - bloque inferior de recibos
   - bloque de firmas
3. Documentar el mapa celda-variable.
4. Definir si el detalle necesita inserción dinámica de filas o si la plantilla ya tiene suficientes filas.

### Entregable

- `VIATICOS_LIQUIDACION_SHEET_RANGES.md`

## Fase 2. Normalización del modelo de datos contables

### Objetivo

Agregar la información mínima que hoy falta para llenar el formato sin heurísticas débiles.

### Cambios recomendados

#### `travel_allowances`

- `trip_scope`
- `sheet_liquidation_number`

#### `travel_allowance_invoices`

- `receipt_subtype`
- `sheet_observation`

#### `travel_allowance_purchases_no_invoice`

- `receipt_subtype`
- `sheet_observation`
- `supplier_name`
- `supplier_tax_id`
- `tax_base_12`
- `tax_base_0`
- `tax_iva`

#### nivel de cierre

- `authorized_by_user_id`
- `accounted_by_user_id`
- `deducible_10_amount`
- `non_deductible_amount`
- `liquidation_sheet_generated_at`
- `liquidation_sheet_drive_url`

### Entregable

- migración o `ensureSchema()` ampliado

## Fase 3. Captura de información faltante en UI/flujo

### Objetivo

Capturar cada dato en el momento correcto.

### En categorización de comprobantes

Agregar cuando aplique:

- `receipt_subtype`
- `sheet_observation`

Para:

- notas manuales
- compras sin factura
- opcionalmente facturas SRI si se necesita observación contable

### En compras sin factura

Agregar campos si el formato contable los exige:

- nombre del proveedor
- identificación tributaria
- base 12
- base 0
- IVA

### En cierre / liquidación

Agregar captura o selección para:

- `trip_scope`
- `authorized_by`
- `accounted_by`
- `deducible_10_amount`
- `non_deductible_amount`

### Regla

No forzar al colaborador a llenar datos que son contables.

Distribución recomendada:

- colaborador:
  - descripción del gasto
  - justificante
  - proveedor cuando aplique
- talento/finanzas:
  - subtipo contable
  - observación contable
  - deducible / no deducible
  - contabilizado por

## Fase 4. Capa de consolidación del expediente padre

### Objetivo

Construir un servicio único que produzca un payload listo para la hoja.

### Servicio nuevo sugerido

- `buildAllowanceSheetLiquidationPayload(allowanceIds | parentAllowanceId)`

### Debe resolver

- encabezado consolidado
- rango de fechas
- lugares de visita unificados
- anticipos válidos
- detalle tabular normalizado
- resumen inferior por subtipo
- saldo final
- firmas/responsables

### Ventaja

La misma capa podrá alimentar:

- Google Sheet
- export futuro a PDF contable
- auditoría

## Fase 5. Integración con Google Sheets

### Objetivo

Escribir el payload consolidado en la plantilla.

### Implementación sugerida

Crear un servicio tipo:

- `viaticosSheetLiquidation.service.js`

Con funciones:

- `loadTemplateMetadata(sheetId)`
- `cloneTemplateIfNeeded(sheetId, targetName)`
- `clearTemplateRanges(spreadsheetId, ranges)`
- `writeHeaderRanges(spreadsheetId, headerPayload)`
- `writeDetailRows(spreadsheetId, rows)`
- `writeReceiptSummary(spreadsheetId, summary)`
- `writeFooterRanges(spreadsheetId, footerPayload)`

### Reutilización técnica

Tomar como referencia el patrón ya existente en:

- `backend/src/modules/business-case/businessCaseSheetSyncLocal.service.js`

Especialmente:

- `spreadsheets.values.batchUpdate`
- `spreadsheets.batchUpdate`
- `values.batchClear`

## Fase 6. Disparo de generación

### Objetivo

Definir cuándo se genera la hoja.

### Recomendación

Generar solo cuando el expediente esté listo para liquidación contable, no durante borrador.

### Punto recomendado

- al pasar a estado final de liquidación del expediente padre
- o al accionar explícito de finanzas: `Generar hoja contable`

### Guardar evidencia

- `liquidation_sheet_generated_at`
- `liquidation_sheet_drive_url`
- `liquidation_sheet_drive_id` si aplica

## Fase 7. Validaciones de negocio

### Deben bloquear generación si falta

- colaborador
- fechas
- al menos un gasto
- expense mode en todos los items
- categoría en todos los items
- subtipo contable en todos los recibos/manuales si el bloque inferior depende de eso
- responsables de autorización/contabilización si son obligatorios

### Deben advertir pero no bloquear

- compras sin factura sin proveedor formal
- observaciones vacías
- expediente sin anticipo

## Fase 8. UI administrativa / financiera

### Objetivo

Permitir revisar el payload antes de escribir la hoja.

### Vista sugerida

En workspace de viáticos:

- botón `Previsualizar liquidación contable`
- botón `Generar hoja`
- botón `Abrir hoja`
- indicador de última generación

### Valor

Evita generar hojas con datos incompletos.

## Fase 9. Auditoría

### Registrar

- quién generó la hoja
- cuándo
- qué expediente incluyó
- hash del payload si aplica
- URL/ID de la hoja generada

### Evento sugerido

- `liquidation_sheet_generated`

## Fase 10. Export futuro a PDF desde la hoja

### Objetivo

Usar el Sheet como formato fuente contable.

### Recomendación

Una vez que la hoja quede estable:

1. escribirla
2. exportarla a PDF
3. adjuntarla al expediente

Esto reduce divergencia entre vista contable y archivo final.

## Datos que deben nacer desde categorización

- `receipt_subtype`
- `sheet_observation`

## Datos que deben nacer desde cierre contable

- `deducible_10_amount`
- `non_deductible_amount`
- `authorized_by_user_id`
- `accounted_by_user_id`

## Riesgos

- Si no se define `receipt_subtype`, el bloque `DETALLE DE RECIBOS Y COMPRAS SIN FACTURA` será ambiguo.
- Si no se define `trip_scope`, el campo `Nacional / Exterior` quedará inferido sin fuente de verdad.
- Si se intenta mapear directamente desde el PDF actual, se duplicará lógica y será frágil.

## Orden de implementación recomendado

1. Leer y mapear celdas reales del Sheet.
2. Definir campos faltantes en DB.
3. Ajustar UI de captura.
4. Implementar payload consolidado.
5. Implementar escritura al Sheet.
6. Agregar generación desde finanzas.
7. Exportar PDF del Sheet si se requiere.

## Criterio de cierre

La implementación estará completa cuando:

1. el expediente padre tenga payload contable consistente;
2. el Sheet se llene automáticamente sin edición manual;
3. el resumen superior, tabla central, bloque inferior y pie salgan completos;
4. se pueda abrir la hoja generada desde el expediente;
5. exista trazabilidad de generación.
