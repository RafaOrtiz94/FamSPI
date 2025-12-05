# Plan maestro de normalizacion y refactor backend SPI FAM

## Objetivos
- Eliminar duplicaciones de solicitudes, historiales, aprobaciones, adjuntos y auditoria.
- Unificar estados/tipos de solicitud en un framework unico reutilizable.
- Normalizar clientes, contactos, ubicaciones y consents; centralizar adjuntos/documentos.
- Operar sin downtime usando feature flags, dual-read/dual-write y rollback rapido.

## Principios
- Tablas nuevas primero, legacy solo lectura hasta cutover.
- FKs y NOT NULL donde aplique; columnas de referencia por id, no por email/texto.
- Estados estandarizados con check constraint; datos especificos en `metadata` JSONB por tipo.
- Auditoria unica (`audit_events`) y servicio de adjuntos unico.

## Arquitectura objetivo BD
- Core: `users`, `departments`, `clients`, `client_contacts`, `client_locations`, `client_consents`, `documents`, `attachments`, `audit_events`.
- Framework solicitudes: `request_types`, `requests`, `request_versions`, `request_status_history`, `request_approvals`, `request_attachments` (adjuntos via `attachments`), opcional `workflow_steps`, `task_assignments`.
- Modulos negocio (solo datos propios con FK a `request_id`):
  - Clientes: `client_profiles` (o reutilizar `clients`), contactos/ubicaciones/consents normalizados.
  - Talento humano: `hr_positions`, `hr_requirements`, `hr_experience`, `hr_notes`.
  - Permisos/vacaciones: `time_off_requests`, `time_off_details`, `time_off_types`.
  - Compras/equipos: `equipment_purchase_details`, `equipment_items` (desde `equipment_purchase_bc_items`).
  - Servicio/mantenimiento: tablas de `servicio.*` referencian `request_id` en lugar de embeds.

## Estados estandar
`draft`, `pending`, `in_review`, `pending_approval`, `approved`, `rejected`, `cancelled`, `completed`, `archived`.

## Mapeo legacy -> framework
- `client_requests` -> `requests` (type=client_onboarding) + `client_contacts/locations/consents`; adjuntos a `attachments`; auditoria a `audit_events`.
- `personnel_requests` + `personnel_request_history/comments` -> `requests` (type=hr_staff_request) + tablas `hr_*`; historia/aprobaciones al framework.
- `permisos_vacaciones` + `vacaciones_solicitudes` -> `requests` (type=time_off) + `time_off_details`; estados mapeados a estandar.
- `equipment_purchase_requests` + `equipment_purchase_bc_items` -> `requests` (type=equipment_purchase) + `equipment_purchase_details/items`.
- `auditoria.logs` y `audit_trail` -> `audit_events`.
- Campos `drive_*` en tablas legacy -> `documents/attachments` con `entity_type/entity_id`.
- Referencias por email -> `user_id` y FK (migrar datos).

## Riesgos clave y mitigacion
- Perdida de datos en ETL: backups, dry-run, conteos antes/despues, spot-check.
- Desalineo de estados: matriz de mapeo y constraint de estados; tests de transiciones.
- Tokens/PII expuestos: mover/limitar `user_gmail_tokens` y `refresh_token` a storage seguro o cifrado.
- Queries rotas: dual-read y contract tests de endpoints antes del cutover.

## Plan por fases (DB + backend)

### F0 Preparacion
- Congelar cambios de esquema; extraer inventario de tablas/llaves y estados actuales.
- Acordar mapeo de estados y `request_types.code` por proceso legacy.
- Añadir feature flags backend: `USE_NEW_REQUESTS`, `USE_NEW_AUDIT`, `USE_NEW_ATTACHMENTS`.
- Definir estrategia de rollback (apagar flags y volver a legacy) y backups.

### F1 Nuevo esquema core y framework (sin tocar legacy)
- Crear/ajustar tablas core y framework con PK/FK/UNIQUE, checks de estado y timestamps.
- Añadir indices: `requests(request_type_id,status,created_at)`, `request_status_history(request_id,changed_at)`, `attachments(entity_type,entity_id)`, `audit_events(entity_type,entity_id,created_at)`.
- Seed de `request_types` con codigos para cada proceso actual.

### F2 Adaptadores y DAOs
- Implementar DAOs/servicios nuevos: requests, status_history, approvals, attachments, audit_events.
- Crear `legacyRequestAdapter` que lee `client_requests`, `personnel_requests`, `permisos_vacaciones`, `vacaciones_solicitudes`, `equipment_purchase_requests` y devuelve DTO unificado.
- Endpoints existentes responden en formato unificado; lectura: primero nuevo, fallback legacy (dual-read).

### F3 Dual-write controlado (QA)
- Escrituras bajo flag: guardar en framework + tabla legacy; loggear divergencias.
- Pruebas de regresion por endpoint (crear, cambiar estado, adjuntar, aprobar, auditoria).

### F4 ETL por modulo
- Clientes: `INSERT ... SELECT` -> `requests` (client_onboarding) + contactos/ubicaciones/consents; mover adjuntos a `attachments`; mapear `status` y `approval_status` al estandar.
- Talento humano: migrar `personnel_requests` a `requests` (hr_staff_request); historiales/aprobaciones a framework; notas/detalles a `hr_*`.
- Permisos/vacaciones: consolidar `permisos_vacaciones` + `vacaciones_solicitudes` -> `requests` (time_off) + `time_off_details`; mapear estados.
- Compras/equipos: mover `equipment_purchase_requests` -> `requests` (equipment_purchase) + detalles/items; adjuntos a `attachments`; `bc_*` al metadata o tablas propias.
- Auditoria: migrar `auditoria.logs` + `audit_trail` -> `audit_events` con `entity_type/entity_id`.

### F5 Validacion de datos
- Conteos y checksums por tabla; conteo por estado/tipo; FKs/UNIQUE sin huérfanos.
- Spot-check de registros por modulo; comparar respuestas de endpoints legacy vs nuevo (contract tests en dual-read).

### F6 Cutover
- Desactivar writes a legacy; flags en modo solo framework nuevo.
- Monitorizar errores, latencia y volumen por tipo/estado; verificar auditoria y adjuntos.
- Plan de rollback: reactivar legacy si aparecen divergencias criticas.

### F7 Limpieza
- Retirar dual-read/dual-write y adaptadores; borrar referencias a tablas legacy en codigo/tests/seeds.
- Archivar/eliminar tablas legacy tras backup final.

### F8 Observabilidad y seguridad
- Métricas: solicitudes por tipo/estado, tiempos de ciclo, aprobaciones, errores de transicion.
- Alertas: fallos en writes de auditoria/adjuntos, transiciones invalidas, divergencias en dual-write.
- Revisar almacenamiento de tokens y PII; cifrar/rotar donde aplique.

## Checklist backend
- Flags activos y configurables por entorno.
- Nuevos DTOs/validadores para requests, approvals, attachments, audit.
- Servicio de adjuntos unificado y eliminacion de `drive_*` embebidos.
- Middleware de auditoria que escriba en `audit_events`.
- Tests de regresion para endpoints de solicitudes, aprobaciones, adjuntos y auditoria en modo dual-read.

## Criterios de done por fase
- F1: Migraciones aplicadas y seeds de `request_types` listos.
- F3: Dual-read/dual-write operando en QA con regresion verde.
- F4-F5: ETL por modulo con conteos validados y spot-check documentado.
- F6: Produccion operando solo con framework nuevo sin incidencias en ventana acordada.
- F7: Legacy desconectado y tablas obsoletas archivadas/eliminadas.
