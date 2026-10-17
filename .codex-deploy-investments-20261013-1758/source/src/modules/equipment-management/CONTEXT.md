# CONTEXT.md - equipment-management

## 1. Descripcion
Modulo central de gestion de equipos como activos fisicos y modelos tecnicos. Separa el modelo de equipo de cada activo con numero de serie, estado, ubicacion, cliente y cronograma automatico de mantenimiento.

## 2. Endpoints

- `GET /api/v1/equipment-management/statuses` - lista estados visuales y operativos.
- `GET /api/v1/equipment-management/models` - lista modelos desde `public.equipment_models` con conteos de activos y procedimientos.
- `GET /api/v1/equipment-management/models/:id` - detalle de modelo con insumos, procedimientos y activos.
- `GET /api/v1/equipment-management/assets` - lista activos fisicos filtrables.
- `GET /api/v1/equipment-management/assets/:id/timeline` - historial del activo.
- `GET /api/v1/equipment-management/assets/:id/documents` - lista documentos adjuntos del activo.
- `POST /api/v1/equipment-management/assets` - crea activo fisico desde modelo.
- `PATCH /api/v1/equipment-management/assets/:id` - actualiza estado, ubicacion, cliente asignado, precio de venta, condicion y fechas operativas.
- `POST /api/v1/equipment-management/assets/:id/documents` - sube documento multipart del activo a Drive y registra metadatos.
- `DELETE /api/v1/equipment-management/assets/:id/documents/:documentId` - elimina documento del activo y registra evento.
- `POST /api/v1/equipment-management/assets/:id/status` - cambia estado del activo.
- `POST /api/v1/equipment-management/assets/:id/reserve` - reserva activo para compra publica, privada o business case.
- `POST /api/v1/equipment-management/assets/:id/install` - instala activo, asigna cliente/ubicacion y genera cronograma automatico.
- `GET /api/v1/equipment-management/schedule` - cronograma de mantenimientos generado.
- `POST /api/v1/equipment-management/procedures` - crea procedimiento por modelo.
- `POST /api/v1/equipment-management/parts` - crea pieza/repuesto/material de catalogo.
- `POST /api/v1/equipment-management/procedures/:id/parts` - ata pieza a procedimiento.

## 3. Base de datos verificada

Neon contiene `public.equipment_models`, `public.catalog_consumables`, `public.catalog_equipment_consumables`, `public.catalog_determinations`, `public.equipos_unidad` y `public.v_inventario_completo`.

Este modulo agrega:

- `public.equipment_asset_status_catalog`
- `public.part_catalog`
- `public.maintenance_procedures`
- `public.maintenance_procedure_parts`
- `public.maintenance_procedure_materials`
- `public.equipment_assets`
- `public.equipment_asset_events`
- `public.equipment_asset_documents`
- `public.equipment_asset_reservations`
- `public.equipment_asset_maintenance_schedule`

## 4. Contrato

Todas las respuestas mantienen `{ ok: true|false }` y el prefijo `/api/v1/`.

## 5. Frontend asociado

- `/dashboard/equipos`
- `/dashboard/equipos/activos`

## 6. Notas

`equipment_models` representa el modelo general. `equipment_assets` representa cada equipo real con serial, estado, ubicacion, cliente asignado, precio de venta, condicion (`nuevo` o `cu`), fecha de retiro y fecha de entrega. `equipment_asset_documents` guarda varios documentos por activo (`proforma_puesta_marcha`, `kit_arranque`, `acta_entrega`, `acta_retiro`, `mantenimiento`, `otro`) con metadatos de Drive. `equipment_asset_events` es la base del historial operativo del activo: cambios de estado, cliente/ubicacion, instalacion, reserva y eventos documentales como carga/eliminacion de documentos. Los procedimientos de mantenimiento tienen piezas y materiales por tipo de procedimiento, no por modelo de forma directa.
