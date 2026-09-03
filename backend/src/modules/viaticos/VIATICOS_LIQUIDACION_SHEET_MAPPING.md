# Mapeo del formato Google Sheet de liquidación de viáticos

## Contexto

- Documento objetivo: Google Sheet `1SVWFtjV3J6EgfXLGfKqiXHUDeqoPho2BmIz4QFkQRGs`
- Plantilla observada: `LIQUIDACION DE GASTOS DE VIAJE / HOSPEDAJE / ALIMENTACION`
- Estado actual del módulo:
  - Sí existe expediente mensual PDF consolidado.
  - Sí existen subexpedientes por segmento `with_card` y `without_card`.
  - No existe aún escritura al Google Sheet de esta plantilla.
  - No se pudo inspeccionar el contenido real del Sheet vía API en este entorno por error de autenticación OpenSSL (`error:1E08010C:DECODER routines::unsupported`), así que el mapeo funcional se basa en la captura y en el código real del módulo.

## Decisión funcional recomendada

- La plantilla debe llenarse por `expediente padre consolidado`.
- No debe generarse una hoja separada por `with_card` y `without_card`.
- Los segmentos siguen existiendo para el workflow interno, pero la hoja contable debe resumir ambos.

## Variables recomendadas para la plantilla

Estas variables son las que conviene soportar en una capa de mapeo antes de escribir celdas.

### Encabezado

- `{{document_number}}`
- `{{collaborator_name}}`
- `{{department_name}}`
- `{{trip_reason}}`
- `{{visit_places}}`
- `{{trip_scope_label}}`
- `{{trip_period_days}}`
- `{{trip_start_date}}`
- `{{trip_end_date}}`
- `{{anticipos_total}}`
- `{{travel_expenses_total}}`
- `{{deducible_10_total}}`
- `{{non_deductible_total}}`
- `{{saldo_favor_total}}`
- `{{saldo_devolver_total}}`
- `{{total_con_recibos}}`

### Detalle tabular de comprobantes

- `{{expense_rows}}`

Cada fila debe soportar:

- `{{row_index}}`
- `{{row_date}}`
- `{{row_destination}}`
- `{{row_invoice_number}}`
- `{{row_supplier_tax_id}}`
- `{{row_supplier_name}}`
- `{{row_expense_concept}}`
- `{{row_base_12}}`
- `{{row_base_0}}`
- `{{row_iva}}`
- `{{row_total}}`
- `{{row_observation}}`

### Totales del detalle

- `{{detail_total_base_12}}`
- `{{detail_total_base_0}}`
- `{{detail_total_iva}}`
- `{{detail_total_facturas}}`

### Resumen inferior de recibos y compras sin factura

- `{{receipt_peaje_total}}`
- `{{receipt_recibo_total}}`
- `{{receipt_facturas_total}}`
- `{{receipt_recibo_comanda_total}}`
- `{{receipt_total}}`

### Pie del formato

- `{{employee_signature_name}}`
- `{{authorized_by_name}}`
- `{{accounted_by_name}}`

## Mapeo funcional campo por campo

| Campo del formato | Variable | Fuente actual | Estado |
| --- | --- | --- | --- |
| No. | `{{document_number}}` | No existe numeración propia para esta hoja | Falta definir |
| Nombre del funcionario/empleado/trabajador | `{{collaborator_name}}` | `travel_allowances.requester_name` derivado en query o `requester_email` | Disponible |
| Área / Departamento | `{{department_name}}` | No se trae hoy en exportación de viáticos | Falta query |
| Motivo del viaje | `{{trip_reason}}` | `reference_name`, fallback `notes` | Disponible |
| Lugares de visita | `{{visit_places}}` | Consolidado de `travel_allowances.city` + referencias de salida | Requiere consolidación |
| Nacional / Exterior | `{{trip_scope_label}}` | No existe campo explícito | Falta regla o campo |
| Período del viaje (en días) | `{{trip_period_days}}` | Derivable desde fecha mínima y máxima del expediente | Requiere cálculo |
| Fecha de inicio del viaje | `{{trip_start_date}}` | `MIN(visit_date)` | Requiere cálculo |
| Fecha de retorno del viaje | `{{trip_end_date}}` | `MAX(visit_date)` | Requiere cálculo |
| Anticipos | `{{anticipos_total}}` | `viatico_anticipos.amount` según estados válidos | Disponible con regla |
| Total de gastos de viaje | `{{travel_expenses_total}}` | Sumatoria consolidada de facturas, notas y compras sin factura | Disponible |
| Deducible 10% | `{{deducible_10_total}}` | No existe cálculo en módulo | Falta regla contable |
| No deducible | `{{non_deductible_total}}` | No existe cálculo en módulo | Falta regla contable |
| Saldo a favor | `{{saldo_favor_total}}` | `computeLiquidatedBalance()` cuando resultado neto es por pagar | Disponible |
| Saldo por devolver | `{{saldo_devolver_total}}` | `computeLiquidatedBalance()` cuando resultado neto es por devolver | Disponible |
| TOTAL CON RECIBOS | `{{total_con_recibos}}` | Sumatoria consolidada del expediente | Disponible |

## Mapeo de filas del detalle principal

La tabla principal debe consolidar:

- Facturas SRI
- Notas de venta manual
- Compras sin factura

Todas deben normalizarse a una misma estructura de fila.

### Facturas SRI

| Columna | Variable de fila | Fuente actual |
| --- | --- | --- |
| Nro | `{{row_index}}` | índice secuencial |
| Fecha | `{{row_date}}` | `issue_date` |
| Destino | `{{row_destination}}` | `allowance.city` |
| Factura No. | `{{row_invoice_number}}` | `establishment-emission_point-sequential` |
| Identificación tributaria | `{{row_supplier_tax_id}}` | `supplier_ruc` |
| Nombre o Razón Social | `{{row_supplier_name}}` | `supplier_name` |
| Concepto del gasto | `{{row_expense_concept}}` | `category` |
| Base 12% | `{{row_base_12}}` | `subtotal_12` |
| Base 0% | `{{row_base_0}}` | `subtotal_0` o base sin IVA |
| IVA | `{{row_iva}}` | `iva` |
| Total Factura | `{{row_total}}` | `total` |
| Observaciones | `{{row_observation}}` | `validation_notes` o estado especial |

### Notas de venta manual

| Columna | Variable de fila | Fuente actual |
| --- | --- | --- |
| Fecha | `{{row_date}}` | `issue_date` |
| Destino | `{{row_destination}}` | `allowance.city` |
| Factura No. | `{{row_invoice_number}}` | `emission_point-sequential` |
| Identificación tributaria | `{{row_supplier_tax_id}}` | `supplier_ruc` |
| Nombre o Razón Social | `{{row_supplier_name}}` | `supplier_name` |
| Concepto del gasto | `{{row_expense_concept}}` | `details_text` o categoría manual |
| Base 12% | `{{row_base_12}}` | `subtotal_12` |
| Base 0% | `{{row_base_0}}` | `subtotal_0` |
| IVA | `{{row_iva}}` | `iva` |
| Total Factura | `{{row_total}}` | `total` |
| Observaciones | `{{row_observation}}` | `validation_notes` |

### Compras sin factura

| Columna | Variable de fila | Fuente actual |
| --- | --- | --- |
| Fecha | `{{row_date}}` | `purchase_date` |
| Destino | `{{row_destination}}` | `allowance.city` |
| Factura No. | `{{row_invoice_number}}` | No aplica, usar `S/NF` |
| Identificación tributaria | `{{row_supplier_tax_id}}` | No aplica, dejar vacío o `N/A` |
| Nombre o Razón Social | `{{row_supplier_name}}` | No existe proveedor estructurado |
| Concepto del gasto | `{{row_expense_concept}}` | `description` |
| Base 12% | `{{row_base_12}}` | Regla contable a definir; hoy no existe desglose |
| Base 0% | `{{row_base_0}}` | Regla contable a definir; hoy no existe desglose |
| IVA | `{{row_iva}}` | Hoy no existe para compras sin factura |
| Total Factura | `{{row_total}}` | `total` |
| Observaciones | `{{row_observation}}` | `justification` |

## Información que debe obtenerse en categorización si aplica

### Sí debe salir de la categorización

- `{{row_expense_concept}}`
  - Ya existe `category`.
- Tipo de recibo para el bloque inferior:
  - `peaje`
  - `recibo`
  - `facturas`
  - `recibo_comanda`
  - Hoy no existe esta subclasificación.
- Regla de observación por comprobante:
  - aceptado
  - observado
  - sin sustento tributario
  - compra excepcional

### No debería salir de la categorización

- `department_name`
- `authorized_by_name`
- `accounted_by_name`
- `document_number`
- `trip_period_days`
- `saldo_favor_total`
- `saldo_devolver_total`

Eso corresponde a datos maestros o a la fase de liquidación.

## Campos nuevos recomendados

Para llenar bien la hoja sin lógica frágil, conviene agregar:

### En `travel_allowances`

- `trip_scope` (`national` | `international`)
- `sheet_liquidation_number`

### En `travel_allowance_invoices`

- `receipt_subtype`
  - valores sugeridos: `factura`, `peaje`, `recibo`, `recibo_comanda`, `nota_venta`
- `sheet_observation`

### En `travel_allowance_purchases_no_invoice`

- `receipt_subtype`
  - valores sugeridos: `peaje`, `recibo`, `recibo_comanda`, `compra_sin_factura`
- `sheet_observation`
- `supplier_name`
- `supplier_tax_id`
- `tax_base_12`
- `tax_base_0`
- `tax_iva`

### En el expediente o cierre contable

- `deducible_10_amount`
- `non_deductible_amount`
- `authorized_by_user_id`
- `accounted_by_user_id`
- `liquidation_sheet_generated_at`
- `liquidation_sheet_drive_url`

## Reglas recomendadas de negocio para el formato

### Regla de período

- `trip_start_date` = fecha mínima de salida del expediente.
- `trip_end_date` = fecha máxima de salida del expediente.
- `trip_period_days` = diferencia inclusiva entre ambas fechas.

### Regla de saldo

- `saldo_favor_total` se llena solo si el neto final es `por_pagar`.
- `saldo_devolver_total` se llena solo si el neto final es `por_devolver`.
- si el neto es cero, ambos van en `0.00`.

### Regla de anticipos

- contar solo anticipos en estado `approved`, `disbursed` o `applied`
- excluir `rejected`

### Regla de resumen inferior

Agrupar notas manuales y compras sin factura por `receipt_subtype`.

Si no existe `receipt_subtype`, el resumen inferior no será confiable.

## Estructura de payload recomendada para escribir la hoja

```json
{
  "header": {
    "document_number": "",
    "collaborator_name": "",
    "department_name": "",
    "trip_reason": "",
    "visit_places": "",
    "trip_scope_label": "Nacional",
    "trip_period_days": 0,
    "trip_start_date": "2026-07-01",
    "trip_end_date": "2026-07-31",
    "anticipos_total": 0,
    "travel_expenses_total": 0,
    "deducible_10_total": 0,
    "non_deductible_total": 0,
    "saldo_favor_total": 0,
    "saldo_devolver_total": 0,
    "total_con_recibos": 0
  },
  "rows": [],
  "totals": {
    "detail_total_base_12": 0,
    "detail_total_base_0": 0,
    "detail_total_iva": 0,
    "detail_total_facturas": 0
  },
  "receiptSummary": {
    "peaje": 0,
    "recibo": 0,
    "facturas": 0,
    "recibo_comanda": 0,
    "total": 0
  },
  "footer": {
    "employee_signature_name": "",
    "authorized_by_name": "",
    "accounted_by_name": ""
  }
}
```

## Conclusión técnica

- El módulo ya tiene la base financiera y operativa para llenar gran parte del formato.
- El mayor vacío está en la subclasificación contable de recibos y en algunos datos de cierre contable.
- La integración correcta debe ser:
  1. construir payload consolidado del expediente padre;
  2. mapear variables a celdas del Sheet;
  3. escribir valores y filas dinámicas;
  4. opcionalmente exportar PDF desde el mismo Google Sheet.
