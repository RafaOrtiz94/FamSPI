# FRS — MÓDULO DE INVENTARIO Y EQUIPOS

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento especifica de forma funcional el comportamiento observable del módulo de Inventario y Equipos de FamSPI. Este módulo comprende dos submódulos con endpoints independientes: el inventario operativo de equipos comerciales (`/api/v1/inventario`) y los activos TI corporativos (`/api/v1/ti-assets`). Cada especificación describe el endpoint real, las entradas, el proceso ejecutado y la salida producida, derivados directamente de `inventario.routes.js` y `tiAssets.routes.js`.

## 2. Descripción funcional

**Submódulo inventario operativo:** Gestiona unidades de equipos comerciales desde su alta por modelo hasta su asignación a cliente. Controla seriales únicos, estados operativos, historial de mutaciones y movimientos de entrada/salida. El control de acceso separa roles de creación (`INVENTORY_CREATE_ROLES`) de roles de mutación (`INVENTORY_MUTATION_ROLES`); las consultas están disponibles para cualquier usuario autenticado.

**Submódulo activos TI corporativos:** Gestiona el ciclo de vida completo de activos tecnológicos internos (equipos, celulares, tablets, accesorios). Incluye numeración corporativa, asignación a colaboradores, mantenimiento preventivo anual, generación de actas formales, documentos financieros en Drive, reportes descargables y liberación con evidencia fotográfica. El control de acceso diferencia lectura (`TI_READ_ROLES`) de escritura (`TI_ROLES`) y creación (`TI_ASSET_CREATE_ROLES`).

## 3. Especificaciones funcionales

### — Inventario operativo

#### FRS-INV-001 — Consulta de inventario completo

**Endpoint:** `GET /api/v1/inventario`
**Acceso:** Cualquier usuario autenticado (JWT)

**Entradas:** Query params opcionales: búsqueda por texto, filtro por estado, tipo, `cliente_id`.

**Proceso:**
1. Consulta la vista `v_inventario_completo` que consolida `equipos_unidad`, `equipos_modelo` y datos de cliente.
2. Aplica los filtros recibidos por query params.
3. Ordena resultados por fecha de creación descendente.

**Salida:** HTTP 200 con array de unidades con datos consolidados: código, modelo, serial, estado, cliente asignado y timestamps.

---

#### FRS-INV-002 — Equipos disponibles y por cliente

**Endpoints:**
- `GET /api/v1/inventario/equipos-disponibles`
- `GET /api/v1/inventario/equipos-cliente/:cliente_id`

**Acceso:** Cualquier usuario autenticado

**Entradas:** Para `/equipos-cliente/:cliente_id`, parámetro de ruta `cliente_id` (integer).

**Proceso (equipos-disponibles):**
1. Filtra `equipos_unidad` WHERE `estado = 'no_asignado'` o estados equivalentes a disponible.
2. Ordena priorizando unidades con `serial_pendiente = false`.

**Proceso (equipos-cliente):**
1. Filtra `equipos_unidad` WHERE `cliente_id = :cliente_id`.
2. Incluye datos del modelo vinculado.

**Salida:** HTTP 200 con array de unidades.

---

#### FRS-INV-003 — Gestión del catálogo de modelos

**Endpoints:**
- `GET /api/v1/inventario/modelos`
- `PUT /api/v1/inventario/modelos/:id` — restringido a `INVENTORY_MUTATION_ROLES`

**Acceso:** GET: autenticado; PUT: `INVENTORY_MUTATION_ROLES`

**Entradas (PUT):**
```json
{
  "nombre": "string",
  "marca": "string",
  "tipo": "string",
  "descripcion": "string"
}
```

**Proceso (GET):** Consulta tabla `equipos_modelo` ordenada por nombre.

**Proceso (PUT):** Valida que el modelo exista. Actualiza los campos enviados. Retorna el modelo actualizado.

**Salida:** GET → HTTP 200 con array de modelos. PUT → HTTP 200 con modelo actualizado.

---

#### FRS-INV-004 — Creación de unidad desde modelo

**Endpoint:** `POST /api/v1/inventario/equipos-unidad`
**Acceso:** `INVENTORY_CREATE_ROLES`

**Entradas:**
```json
{
  "modelo_id": "integer",
  "serial": "string (opcional)",
  "observaciones": "string (opcional)"
}
```

**Proceso:**
1. Valida que el `modelo_id` exista en `equipos_modelo`.
2. Si `serial` no se provee: asigna serial temporal `SIN-SERIE-{uuid}` y marca `serial_pendiente = true`.
3. Si `serial` se provee: valida unicidad en `equipos_unidad`; rechaza con 409 si ya existe.
4. Inserta en `equipos_unidad` con `estado = 'no_asignado'`.
5. Registra evento de creación en `equipos_historial` con `actor_id = req.user.id` y timestamp.

**Salida:** HTTP 201 con la unidad creada incluyendo `id`, `modelo_id`, `serial`, `serial_pendiente`, `estado`, `created_at`.

---

#### FRS-INV-005 — Captura de serial definitivo

**Endpoint:** `POST /api/v1/inventario/equipos-unidad/:id/serial`
**Acceso:** `INVENTORY_MUTATION_ROLES`

**Entradas:**
```json
{
  "serial": "string"
}
```

**Proceso:**
1. Verifica que la unidad con `:id` existe.
2. Verifica que `serial` no exista en ninguna otra fila de `equipos_unidad`; rechaza con 409 si hay duplicado.
3. Actualiza `serial`, establece `serial_pendiente = false`.
4. Registra evento en `equipos_historial`.

**Salida:** HTTP 200 con la unidad actualizada.

---

#### FRS-INV-006 — Asignación de unidad a cliente

**Endpoint:** `POST /api/v1/inventario/equipos-unidad/:id/asignar`
**Acceso:** `INVENTORY_MUTATION_ROLES`

**Entradas:**
```json
{
  "cliente_id": "integer",
  "sucursal_id": "integer (opcional)",
  "request_id": "integer (opcional)"
}
```

**Proceso:**
1. Verifica existencia de la unidad y del `cliente_id`.
2. Actualiza `cliente_id`, `sucursal_id`, `estado = 'asignado'`.
3. Registra evento de asignación en `equipos_historial` con `request_id` si aplica y `actor_id`.

**Salida:** HTTP 200 con la unidad actualizada.

---

#### FRS-INV-007 — Cambio de estado de unidad

**Endpoint:** `POST /api/v1/inventario/equipos-unidad/:id/cambiar-estado`
**Acceso:** `INVENTORY_MUTATION_ROLES`

**Entradas:**
```json
{
  "estado": "string",
  "observaciones": "string (opcional)"
}
```

**Proceso:**
1. Valida que `estado` pertenezca al catálogo de estados permitidos (`ALLOWED_STATES`).
2. Actualiza `estado` en `equipos_unidad`.
3. Registra evento de cambio de estado en `equipos_historial` con estado anterior, nuevo estado, `actor_id` y timestamp.

**Salida:** HTTP 200 con la unidad actualizada.

---

#### FRS-INV-008 — Historial de unidad

**Endpoint:** `GET /api/v1/inventario/equipos-unidad/:id/historial`
**Acceso:** `INVENTORY_MUTATION_ROLES`

**Entradas:** Parámetro de ruta `id`.

**Proceso:** Consulta `equipos_historial` WHERE `unidad_id = :id` ordenado por `created_at DESC`.

**Salida:** HTTP 200 con array de eventos históricos de la unidad.

---

#### FRS-INV-009 — Registro de movimiento de inventario

**Endpoint:** `POST /api/v1/inventario/movimiento`
**Acceso:** `INVENTORY_MUTATION_ROLES`

**Entradas:**
```json
{
  "tipo": "entrada | salida",
  "modelo_id": "integer",
  "cantidad": "integer",
  "referencia": "string (opcional)",
  "observaciones": "string (opcional)"
}
```

**Proceso:**
1. Valida tipo de movimiento.
2. Inserta en `inventory_movements` con `actor_id = req.user.id`, `created_at = NOW()`.

**Salida:** HTTP 201 con el movimiento creado.

---

### — Activos TI corporativos

#### FRS-INV-010 — Creación de activo TI

**Endpoint:** `POST /api/v1/ti-assets`
**Acceso:** `TI_ASSET_CREATE_ROLES` (`ti`, `jefe_ti`, `admin_ti`, `gerencia`, `financiero`, `jefe_financiero`, `finanzas`, `jefe_finanzas`, `contador`)

**Entradas (multipart o JSON):**
```json
{
  "name": "string",
  "brand": "string",
  "model": "string",
  "serial_number": "string (opcional)",
  "imei": "string (opcional)",
  "purchase_date": "date (opcional)",
  "characteristics": "jsonb",
  "maintenance_frequency_months": "integer (default: 12)"
}
```

**Proceso:**
1. Genera `asset_code` único.
2. Inserta en `ti_assets` con `status = 'unassigned'`, `active = true`, `created_by = req.user.id`.
3. Registra evento `created` en `ti_asset_events`.

**Salida:** HTTP 201 con el activo creado incluyendo `id`, `asset_code`, `status`, `created_at`.

---

#### FRS-INV-011 — Listado de activos TI

**Endpoint:** `GET /api/v1/ti-assets`
**Acceso:** `TI_READ_ROLES`

**Entradas:** Query params opcionales: `status`, `brand`, `assigned_to`, `search`, `page`, `limit`.

**Proceso:** Consulta `ti_assets` con filtros aplicados. Incluye join a `users` para datos del colaborador asignado (`assigned_to_user_id`). Retorna activos con estado `active = true` por defecto.

**Salida:** HTTP 200 con array paginado de activos.

---

#### FRS-INV-012 — Asignación individual de activo TI a colaborador

**Endpoint:** `POST /api/v1/ti-assets/:id/assign`
**Acceso:** `TI_ROLES`

**Entradas:**
```json
{
  "user_id": "integer",
  "reason": "string (opcional)"
}
```

**Proceso:**
1. Verifica existencia del activo y del usuario destino.
2. Registra en `ti_asset_assignments` con `action = 'assign'`, `previous_user_id`, `assigned_to_user_id`, `created_by`.
3. Actualiza `ti_assets.assigned_to_user_id`, `assigned_at = NOW()`, `status = 'assigned'`.
4. Llama `upsertCollaboratorProfile` para actualizar perfil del colaborador.
5. Registra evento en `ti_asset_events`.

**Salida:** HTTP 200 con el activo actualizado y datos del colaborador asignado.

---

#### FRS-INV-013 — Asignación masiva de activos TI

**Endpoint:** `POST /api/v1/ti-assets/batch/assign`
**Acceso:** `TI_ROLES`

**Entradas:**
```json
{
  "assignments": [
    { "asset_id": "integer", "user_id": "integer", "reason": "string" }
  ]
}
```

**Proceso:** Itera sobre el array `assignments` ejecutando el mismo flujo que FRS-INV-012 para cada elemento. Retorna resumen de éxitos y fallos.

**Salida:** HTTP 200 con resultado por activo procesado.

---

#### FRS-INV-014 — Actualización de estado de activo TI

**Endpoint:** `POST /api/v1/ti-assets/:id/status`
**Acceso:** `TI_ROLES`

**Entradas:**
```json
{
  "status": "available | assigned | unassigned | damaged | in_maintenance | retired",
  "reason": "string (opcional)"
}
```

**Proceso:**
1. Valida que `status` pertenezca a `ALLOWED_STATUSES`.
2. Actualiza `ti_assets.status`.
3. Registra evento en `ti_asset_events` con estado anterior y nuevo.

**Salida:** HTTP 200 con el activo actualizado.

---

#### FRS-INV-015 — Numeración corporativa

**Endpoints:**
- `GET /api/v1/ti-assets/corporate-numbers` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/corporate-numbers/:id` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/corporate-numbers/:id/history` — `TI_READ_ROLES`
- `POST /api/v1/ti-assets/corporate-numbers` — `TI_ROLES`
- `POST /api/v1/ti-assets/corporate-numbers/:id/assign` — `TI_ROLES`
- `POST /api/v1/ti-assets/corporate-numbers/:currentId/change` — `TI_ROLES`

**Proceso general:** Gestiona los números corporativos asignados a activos TI. La creación registra el número en el catálogo. La asignación vincula el número a un activo específico. El cambio desvincula el número actual y asigna uno nuevo, registrando el historial completo.

**Salida:** Según operación: listado, detalle, historial o confirmación de operación.

---

#### FRS-INV-016 — Gestión de mantenimiento

**Endpoints:**
- `GET /api/v1/ti-assets/maintenance/list` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/maintenance/diagnose` — `TI_READ_ROLES`
- `POST /api/v1/ti-assets/maintenance` — `TI_ROLES`
- `POST /api/v1/ti-assets/maintenance/annual/generate` — `TI_ROLES`
- `POST /api/v1/ti-assets/maintenance/generate` — `TI_ROLES`
- `POST /api/v1/ti-assets/maintenance/refresh` — `TI_ROLES`
- `PATCH /api/v1/ti-assets/maintenance/:id/coordination-date` — `TI_ROLES`
- `POST /api/v1/ti-assets/maintenance/:id/complete` — `TI_ROLES`
- `POST /api/v1/ti-assets/maintenance/:id/request-delivery` — `TI_ROLES`
- `DELETE /api/v1/ti-assets/maintenance` — `TI_ROLES`

**Proceso de generación anual:**
1. Calcula el plan anual de mantenimiento usando `maintenance_frequency_months` de cada activo.
2. Excluye fechas que caigan en feriados nacionales mediante `getHolidaysForYear` (módulo `security.holidays.ec`).
3. Inserta registros en `ti_asset_maintenance_schedule` con `planned_date`, `max_due_date`, `status = 'pending'`.

**Proceso de completar mantenimiento:**
1. Actualiza `ti_asset_maintenance_schedule.status = 'completed'`, `completed_at = NOW()`.
2. Actualiza `ti_assets.last_maintenance_at`.
3. Registra evento en `ti_asset_events`.

**Salida:** Según operación: plan de mantenimiento, diagnóstico de activos próximos a vencer o confirmación.

---

#### FRS-INV-017 — Gestión de actas

**Endpoints:**
- `GET /api/v1/ti-assets/actas` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/actas/:actaId` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/actas/:actaId/pdf` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/:id/actas` — `TI_READ_ROLES`
- `POST /api/v1/ti-assets/actas/:actaId/upload-signed` — `TI_ROLES` + `multer single`

**Proceso:** Las actas se generan cuando se ejecuta una asignación formal. El endpoint `upload-signed` recibe el archivo firmado mediante `multer.memoryStorage()`, calcula su hash SHA-256 y lo sube a Drive mediante `uploadBase64File`.

**Salida:** Listado de actas, detalle, archivo PDF o confirmación de carga de versión firmada.

---

#### FRS-INV-018 — Documentos financieros por activo

**Endpoints:**
- `GET /api/v1/ti-assets/:id/financial-docs` — `TI_READ_ROLES`
- `POST /api/v1/ti-assets/:id/financial-docs` — `TI_READ_ROLES` + `multer single`
- `GET /api/v1/ti-assets/:id/letras-de-cambio-history` — `TI_READ_ROLES`

**Proceso:** La carga sube el archivo a Google Drive usando `ensureFolder` + `uploadBase64File`. El hash del archivo se calcula con `computeSha256HexFromBuffer` para verificación de integridad posterior.

**Salida:** Listado de documentos o confirmación de carga con referencia Drive y hash.

---

#### FRS-INV-019 — Liberación de activo

**Endpoint:** `POST /api/v1/ti-assets/:id/liberate`
**Acceso:** `TI_ROLES`
**Middleware:** `multer.array("photos", 10)`

**Entradas:** Multipart con campos `reason`, `new_status` y hasta 10 archivos bajo el campo `photos`.

**Proceso:**
1. Valida que el activo existe y está actualmente asignado.
2. Procesa cada foto: calcula hash SHA-256, sube a Drive en carpeta del activo.
3. Registra fotos en `getLiberationPhotos` (tabla de fotos de liberación).
4. Actualiza estado del activo según `new_status`.
5. Registra evento `liberated` en `ti_asset_events` con razón y referencias a fotos.

**Salida:** HTTP 200 con el activo actualizado y array de referencias a fotos subidas.

---

#### FRS-INV-020 — Reportes de activos TI

**Endpoints:**
- `GET /api/v1/ti-assets/reports` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/reports/download` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/reports/asset/:id` — `TI_READ_ROLES`
- `GET /api/v1/ti-assets/reports/collaborator/:userId` — `TI_READ_ROLES`
- `POST /api/v1/ti-assets/reports/generate` — `TI_ROLES`

**Proceso:** Agrega datos de `ti_assets`, `ti_asset_assignments` y `ti_asset_maintenance_schedule` para generar reportes en el formato requerido. La generación activa (`POST`) crea el documento y lo registra; la descarga retorna el binario.

**Salida:** Listado de reportes disponibles o archivo descargable (PDF o XLSX).

## 4. Tabla de endpoints completos

### Inventario operativo (`/api/v1/inventario`)

| Método | Endpoint | Acceso | Función |
|---|---|---|---|
| GET | `/` | JWT | Consultar inventario completo |
| GET | `/equipos-disponibles` | JWT | Listar equipos disponibles |
| GET | `/equipos-cliente/:cliente_id` | JWT | Equipos por cliente |
| GET | `/modelos` | JWT | Catálogo de modelos |
| PUT | `/modelos/:id` | `MUTATION_ROLES` | Actualizar modelo |
| POST | `/equipos-unidad` | `CREATE_ROLES` | Crear unidad desde modelo |
| POST | `/equipos-unidad/:id/serial` | `MUTATION_ROLES` | Capturar serial definitivo |
| POST | `/equipos-unidad/:id/asignar` | `MUTATION_ROLES` | Asignar unidad a cliente |
| POST | `/equipos-unidad/:id/cambiar-estado` | `MUTATION_ROLES` | Cambiar estado de unidad |
| GET | `/equipos-unidad/:id/historial` | `MUTATION_ROLES` | Historial de unidad |
| POST | `/movimiento` | `MUTATION_ROLES` | Registrar movimiento |

### Activos TI corporativos (`/api/v1/ti-assets`)

| Método | Endpoint | Acceso | Función |
|---|---|---|---|
| GET | `/corporate-numbers` | `TI_READ_ROLES` | Listar números corporativos |
| GET | `/corporate-numbers/:id` | `TI_READ_ROLES` | Detalle de número corporativo |
| GET | `/corporate-numbers/:id/history` | `TI_READ_ROLES` | Historial de número corporativo |
| POST | `/corporate-numbers` | `TI_ROLES` | Crear número corporativo |
| POST | `/corporate-numbers/:id/assign` | `TI_ROLES` | Asignar número a activo |
| POST | `/corporate-numbers/:currentId/change` | `TI_ROLES` | Cambiar número corporativo |
| GET | `/` | `TI_READ_ROLES` | Listar activos TI |
| GET | `/maintenance/list` | `TI_READ_ROLES` | Plan de mantenimiento |
| GET | `/maintenance/diagnose` | `TI_READ_ROLES` | Diagnóstico de mantenimiento |
| GET | `/reports` | `TI_READ_ROLES` | Reportes disponibles |
| GET | `/reports/download` | `TI_READ_ROLES` | Descargar reporte consolidado |
| GET | `/reports/asset/:id` | `TI_READ_ROLES` | Reporte de activo individual |
| GET | `/reports/collaborator/:userId` | `TI_READ_ROLES` | Reporte por colaborador |
| GET | `/actas` | `TI_READ_ROLES` | Listar todas las actas |
| GET | `/actas/:actaId` | `TI_READ_ROLES` | Detalle de acta |
| GET | `/actas/:actaId/pdf` | `TI_READ_ROLES` | Descargar acta PDF |
| GET | `/recipient-info/:userId` | `TI_ROLES` | Info de destinatario para acta |
| GET | `/:id/history` | `TI_READ_ROLES` | Historial de activo |
| GET | `/:id/assignments-history` | `TI_READ_ROLES` | Historial de asignaciones |
| GET | `/:id/accessories` | `TI_READ_ROLES` | Accesorios del activo |
| GET | `/:id/actas` | `TI_READ_ROLES` | Actas del activo |
| GET | `/:id/financial-docs` | `TI_READ_ROLES` | Documentos financieros |
| GET | `/:id/letras-de-cambio-history` | `TI_READ_ROLES` | Historial letras de cambio |
| GET | `/:id/liberation-photos` | `TI_READ_ROLES` | Fotos de liberación |
| POST | `/:id/financial-docs` | `TI_READ_ROLES` | Subir documento financiero |
| POST | `/` | `TI_ASSET_CREATE_ROLES` | Crear activo TI |
| POST | `/batch/assign` | `TI_ROLES` | Asignación masiva |
| PATCH | `/:id` | `TI_ROLES` | Actualizar datos del activo |
| POST | `/:id/assign` | `TI_ROLES` | Asignar activo a colaborador |
| POST | `/:id/status` | `TI_ROLES` | Cambiar estado del activo |
| POST | `/:id/accessories` | `TI_ROLES` | Crear accesorio |
| PATCH | `/:id/accessories/:accId` | `TI_ROLES` | Actualizar accesorio |
| DELETE | `/:id/accessories/:accId` | `TI_ROLES` | Eliminar accesorio |
| DELETE | `/maintenance` | `TI_ROLES` | Limpiar plan de mantenimiento |
| POST | `/maintenance` | `TI_ROLES` | Crear mantenimiento manual |
| PATCH | `/maintenance/:id/coordination-date` | `TI_ROLES` | Establecer fecha de coordinación |
| POST | `/maintenance/annual/generate` | `TI_ROLES` | Generar plan anual |
| POST | `/maintenance/generate` | `TI_ROLES` | Generar mantenimientos futuros |
| POST | `/maintenance/refresh` | `TI_ROLES` | Refrescar plan de mantenimiento |
| POST | `/maintenance/:id/complete` | `TI_ROLES` | Completar mantenimiento |
| POST | `/maintenance/:id/request-delivery` | `TI_ROLES` | Solicitar entrega post-mantenimiento |
| POST | `/reports/generate` | `TI_ROLES` | Generar reporte |
| POST | `/actas/:actaId/upload-signed` | `TI_ROLES` | Cargar acta firmada |
| POST | `/:id/liberate` | `TI_ROLES` | Liberar activo con fotos |

## 5. Controles de acceso

### Inventario operativo

| Nivel | Roles | Endpoints |
|---|---|---|
| JWT global | Todos los usuarios autenticados | Todas las rutas del módulo |
| `INVENTORY_CREATE_ROLES` | `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial`, `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `operaciones`, `jefe_operaciones`, `logistica`, `jefe_logistica`, `gerencia`, `ti`, `admin_ti`, `admin` | `POST /equipos-unidad` |
| `INVENTORY_MUTATION_ROLES` | `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `operaciones`, `jefe_operaciones`, `logistica`, `jefe_logistica`, `finanzas`, `jefe_finanzas`, `gerencia`, `ti`, `admin_ti`, `admin` | `PUT /modelos/:id`, `POST /serial`, `POST /asignar`, `POST /cambiar-estado`, `GET /historial`, `POST /movimiento` |

### Activos TI corporativos

| Nivel | Roles | Endpoints |
|---|---|---|
| JWT global (`verifyToken`) | Todos los usuarios autenticados | Aplica al router completo |
| `TI_READ_ROLES` | `ti`, `jefe_ti`, `admin_ti`, `gerencia`, `gerencia_general`, `financiero`, `jefe_financiero`, `finanzas`, `jefe_finanzas`, `contador` | Rutas GET de activos, actas, reportes, documentos financieros |
| `TI_ROLES` | `ti`, `jefe_ti`, `admin_ti`, `gerencia` | Rutas de escritura: crear, asignar, cambiar estado, mantenimiento, liberación |
| `TI_ASSET_CREATE_ROLES` | `TI_ROLES` + `financiero`, `jefe_financiero`, `finanzas`, `jefe_finanzas`, `contador` | `POST /` — Creación de activos |

## 6. Dependencias

| Dependencia | Tipo | Uso en submódulo |
|---|---|---|
| `auth` / JWT | Middleware | Autenticación global en ambos submódulos |
| `clients` | Módulo interno | Validación de `cliente_id` en asignación de inventario |
| `collaborators.service` | Módulo interno | `upsertCollaboratorProfile` en asignación de activos TI |
| `notifications` / `notificationManager` | Módulo interno | Alertas en ambos submódulos |
| `security.holidays.ec` | Utilidad interna | Cálculo de feriados para mantenimiento anual |
| Google Drive (`drive` utils) | Integración externa | Upload de actas firmadas, documentos financieros y fotos de liberación |
| `documentHash` utils | Utilidad interna | SHA-256 para integridad documental |
| PostgreSQL | Base de datos | Persistencia de todas las entidades |

## 7. Observaciones

- Los endpoints de lectura de activos TI incluyen roles financieros (`financiero`, `contador`) lo que permite que el área contable tenga visibilidad de activos sin capacidad de mutación. Esto es diseño intencional documentado en `TI_READ_ROLES`.
- La ruta `POST /:id/financial-docs` usa `requireRole(TI_READ_ROLES)` (no `TI_ROLES`), lo que permite a roles financieros subir documentos. Este comportamiento es coherente con el rol de esos actores pero debe mantenerse documentado para auditoría de permisos.
- El módulo `inventario` no aplica `requireRole` en las rutas GET de consulta general; cualquier usuario autenticado puede consultar el inventario completo. Si se requiere restricción por rol en lectura, se debe agregar explícitamente.
- El uso de `multer.memoryStorage()` implica que archivos grandes (actas, fotos de liberación) ocupan memoria del proceso Node.js mientras se procesan; el límite de 10 fotos en liberación mitiga este riesgo pero no lo elimina.
- La dependencia de la vista `v_inventario_completo` en el módulo inventario significa que cualquier cambio en las tablas base (`equipos_unidad`, `equipos_modelo`) debe verificarse contra la definición de la vista para evitar ruptura de consultas.
