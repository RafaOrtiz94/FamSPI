# Handoff IA-1 — Fase 1 Contrato Canónico de Asistencia

Fecha: 2026-07-07

## Objetivo cubierto

Se agregó un vocabulario canónico de flujo en backend sin romper las respuestas actuales que ya consumen `AttendanceWidget` y `AttendanceAction`.

## Endpoints ajustados

- `GET /api/v1/attendance/today`
- `GET /api/v1/attendance/exception/active`

## Campos nuevos agregados

Se agregan a nivel raíz de la respuesta:

- `flow_kind`
- `current_step`
- `next_step`
- `allowed_actions`
- `context_flags`

Además, cuando `data` es un objeto, se agrega:

- `data.canonical_flow`

## Compatibilidad

- Se mantiene `ok`
- Se mantiene `data`
- No se eliminó ningún campo previo
- No se cambió ningún `message`
- No se cambió ningún status HTTP

## Vocabulario canónico actual

### `flow_kind`

- `none`
- `regular`
- `operational`
- `unexpected`
- `permission`
- `time_off`
- `completed`

### `current_step`

Valores actualmente emitidos:

- `idle`
- `awaiting_entry`
- `entry_pending_regularization`
- `working_morning`
- `lunch_break`
- `working_afternoon`
- `working_before_time_off`
- `working_after_lunch_time_off`
- `time_off_pending_departure`
- `permission_in_progress`
- `operational_departure_marked`
- `operational_destination_reached`
- `operational_return_marked`
- `field_visit_in_progress`
- `unexpected_departure_marked`
- `unexpected_arrival_marked`
- `unexpected_return_marked`
- `day_closed`

### `next_step` / `allowed_actions`

Acciones canónicas emitidas:

- `entrada`
- `almuerzo-salida`
- `almuerzo-entrada`
- `salida`
- `permission-entry-start`
- `permission-exit-finish`
- `salida-oficina`
- `llegada-destino`
- `cierre-viaje`
- `visita-entrada`
- `visita-salida`
- `llegada-imprevista`
- `regreso-imprevisto`
- `entrada-imprevista`

## `context_flags`

Se exponen estas banderas:

- `business_date`
- `has_attendance_record`
- `has_entry`
- `has_lunch_start`
- `has_lunch_end`
- `has_exit`
- `has_active_exception`
- `has_active_operational`
- `has_active_unexpected`
- `has_active_permission_exception`
- `has_active_field_visit`
- `has_active_time_off`
- `has_upcoming_time_off`
- `entry_pending_regularization`

## Consideración para IA-2

IA-2 puede empezar a leer este contrato sin dejar de usar los campos antiguos. La estrategia recomendada es:

1. Leer `flow_kind`, `current_step`, `next_step`, `allowed_actions`.
2. Si no existen, caer al comportamiento legado.
3. No reinterpretar reglas de negocio desde frontend si backend ya entregó la acción siguiente.
