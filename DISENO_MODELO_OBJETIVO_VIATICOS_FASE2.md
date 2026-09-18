# Diseño del Modelo Objetivo de Viáticos - Fase 2

## 1. Base de diseño

Fuente de verdad usada:

- `backend/src/modules/viaticos/viaticos.service.js`
- `backend/src/modules/attendance/attendance.controller.js`
- Neon `FamSPI` en `public`

Restricción principal:

- no romper el workspace actual ni las tablas de comprobantes ya enlazadas a `travel_allowances`

Decisión de diseño:

- `travel_allowances` se conserva como expediente padre
- se introduce una tabla hija formal para subexpedientes por tipo de proceso
- facturas y compras sin factura siguen vinculadas al padre
- la pertenencia de cada comprobante a un hijo se resuelve por `expense_mode`

Motivo:

- es el cambio de menor riesgo sobre la base real
- evita migrar masivamente comprobantes existentes
- permite persistir estados separados por hijo
- mantiene compatibilidad con los totales ya calculados en el padre

## 2. Modelo objetivo

### 2.1 Padre

Tabla base:

- `travel_allowances`

Rol funcional nuevo:

- expediente general de la salida operacional

Responsabilidades del padre:

- representar la salida operativa origen
- guardar la clasificación inicial `dentro/fuera del area`
- guardar el plazo de procesamiento
- mostrar el saldo global
- ser dueño del anticipo
- consolidar el estado general visible al colaborador

Campos nuevos requeridos en el padre:

- `processing_state`
  - valores: `sin_procesar`, `parcial`, `liquidado_total`, `anulado`
- `processing_deadline_at`
- `annulled_at`
- `annulled_reason`
- `processed_month`
- `grace_deadline_at`
- `final_balance_amount`
- `final_balance_result`
  - valores: `por_pagar`, `en_cero`, `por_devolver`

Campos existentes que se mantienen:

- `source_type`
- `source_id`
- `requester_user_id`
- `visit_date`
- `outside_labor_area`
- `outside_labor_area_reason`
- `classification_completed`
- `total_with_card`
- `total_without_card`
- `payment_receipt_*`

### 2.2 Hijos

Tabla nueva propuesta:

- `travel_allowance_segments`

Una fila por:

- padre + `segment_type`

Tipos de hijo:

- `with_card`
- `without_card`

Columnas requeridas:

- `id`
- `allowance_id`
- `segment_type`
- `workflow_status`
  - valores: `borrador`, `enviado`, `en_revision`, `aprobado`, `rechazado`, `liquidado`
- `submitted_at`
- `submitted_by_user_id`
- `review_started_at`
- `reviewed_by_user_id`
- `approved_at`
- `approved_by_user_id`
- `rejected_at`
- `rejected_by_user_id`
- `liquidated_at`
- `liquidated_by_user_id`
- `calculated_total`
- `approved_total`
- `economic_result_type`
  - `with_card`: solo `valor_a_pagar`
  - `without_card`: `valor_a_pagar`, `saldo_cero`, `valor_a_devolver`
- `economic_result_amount`
- `bank_payment_reference`
- `liquidation_document_drive_id`
- `liquidation_document_drive_url`
- `visible_in_active_queue`
- `created_at`
- `updated_at`

Restricciones:

- `UNIQUE (allowance_id, segment_type)`

## 3. Trazabilidad y observaciones

### 3.1 Historial por hijo

Tabla nueva propuesta:

- `travel_allowance_segment_events`

Uso:

- historial inmutable de cambios de estado
- observaciones de devolución a borrador
- liquidación
- anulación

Columnas requeridas:

- `id`
- `allowance_id`
- `segment_id`
- `event_type`
- `from_status`
- `to_status`
- `observation`
- `actor_user_id`
- `metadata_json`
- `created_at`

### 3.2 Trazabilidad de comprobantes fuera de flujo activo

No se recomienda mover comprobantes a otra tabla.

Decisión:

- reutilizar `travel_allowance_invoices.status`
- reutilizar `travel_allowance_purchases_no_invoice.status`
- agregar campos para historial y desvinculación visible

Campos nuevos propuestos:

- en `travel_allowance_invoices`
  - `rejected_at`
  - `rejected_by_user_id`
  - `returned_to_draft_at`
  - `returned_to_draft_by_user_id`
- en `travel_allowance_purchases_no_invoice`
  - `rejected_at`
  - `rejected_by_user_id`
  - `returned_to_draft_at`
  - `returned_to_draft_by_user_id`

## 4. Anticipos

Tabla existente:

- `viatico_anticipos`

Decisión:

- se mantiene vinculada al padre por `allowance_id`
- no se crea tabla nueva

Ajustes requeridos:

- agregar evidencia de desembolso obligatoria en el registro financiero
- calcular impacto solo si `status = 'disbursed'`
- reflejar descuento solo al liquidar un hijo

Campos nuevos propuestos:

- `payment_receipt_drive_id`
- `payment_receipt_drive_url`
- `payment_receipt_uploaded_at`
- `payment_receipt_uploaded_by`

## 5. Reglas de negocio persistidas

### 5.1 Origen

- solo `attendance_exceptions` con `source_type = operational_exit` puede crear padre procesable

### 5.2 Clasificación inicial

- `outside_labor_area = false`
  - queda visible en sección `dentro del area`
  - no crea ni activa hijos
- `outside_labor_area = true`
  - habilita carga de gastos y proceso mensual o manual

### 5.3 Vencimiento

Regla:

- vence al último día calendario del mes de la salida
- tiene 7 días fijos de gracia del mes siguiente

Persistencia:

- `processing_deadline_at`
- `grace_deadline_at`

Consecuencia:

- si no tiene hijos enviados al vencer, el padre pasa a `anulado`
- si un hijo sigue en `borrador` al vencer, ese hijo queda fuera de cola activa y el padre se recalcula
- hijos ya enviados siguen su flujo normal

### 5.4 Estado del padre

- `sin_procesar`
  - sin hijos enviados o liquidados
- `parcial`
  - al menos un hijo ya enviado/aprobado/liquidado y otro pendiente o inexistente
- `liquidado_total`
  - todos los hijos existentes quedaron `liquidado`
- `anulado`
  - el expediente no procede a devolución por vencimiento

### 5.5 Estado de los hijos

- `borrador`
- `enviado`
- `en_revision`
- `aprobado`
- `rechazado`
- `liquidado`

Regla:

- un rechazo siempre regresa a `borrador`
- la observación queda en `travel_allowance_segment_events`

## 6. Cálculo económico

### 6.1 Hijo `without_card`

Resultado automático:

- `valor_a_pagar`
- `saldo_cero`
- `valor_a_devolver`

Base:

- comprobantes aprobados sin tarjeta
- menos anticipo desembolsado aplicado

### 6.2 Hijo `with_card`

Resultado automático:

- `valor_a_pagar`

Interpretación:

- es el valor para conciliación y registro financiero
- no se paga al colaborador porque la tarjeta es corporativa

### 6.3 Saldo global del padre

Regla:

- lo calcula el sistema
- no es editable por ningún rol

Base de cálculo:

- suma de hijos liquidados
- menos anticipo desembolsado

Valores posibles:

- `por_pagar`
- `en_cero`
- `por_devolver`

## 7. Impacto esperado sobre backend actual

Se mantiene:

- `travel_allowances` como entidad principal
- `expense_mode` en comprobantes
- colas separadas por talento y finanzas

Se reemplaza gradualmente:

- `workflow_status` del padre como única verdad del proceso
- `requires_finance_approval` y `requires_talento_approval` como proxy del estado

Compatibilidad transitoria:

- `workflow_status` seguirá actualizándose mientras el frontend viejo conviva durante la corrección
- la fuente de verdad nueva pasará a:
  - `travel_allowances.processing_state`
  - `travel_allowance_segments.workflow_status`

## 8. Orden técnico recomendado para implementación

1. migración SQL de columnas nuevas en `travel_allowances`
2. creación de `travel_allowance_segments`
3. creación de `travel_allowance_segment_events`
4. extensión de `viatico_anticipos`
5. backfill idempotente para padres existentes
6. adaptación de servicios backend
7. adaptación de colas por rol
8. rediseño del workspace frontend

## 9. Cierre de Fase 2

Decisión cerrada:

- padre en `travel_allowances`
- hijos persistidos en tabla nueva `travel_allowance_segments`
- historial en tabla nueva `travel_allowance_segment_events`
- anticipo sigue en `viatico_anticipos`

Siguiente fase:

- Fase 3: migración y corrección backend de dominio
