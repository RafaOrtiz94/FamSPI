# URS — MÓDULO DE INVENTARIO Y EQUIPOS

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento define los requerimientos de usuario del módulo de Inventario y Equipos del sistema FamSPI. Este módulo cubre dos dominios complementarios que conviven en el sistema: el inventario operativo de equipos de servicio (módulo `inventario`, rutas `/api/v1/inventario`) y los activos TI corporativos (módulo `ti-assets`, rutas `/api/v1/ti-assets`). Ambos dominios gestionan ciclos de vida de equipos físicos, pero sirven a actores distintos y con flujos diferentes.

El dominio `inventario` administra unidades de equipos comerciales asignables a clientes y sucursales, con trazabilidad desde el alta por modelo, captura de serial, asignación y cambio de estado. El dominio `ti-assets` administra activos tecnológicos corporativos internos (computadores, celulares, tablets, accesorios) asignados a colaboradores, con ciclo de vida que incluye numeración corporativa, depreciación, programación de mantenimiento anual, gestión de actas de entrega y proceso de liberación con evidencia fotográfica.

## 2. Objetivo

Definir los requerimientos de usuario de alto nivel para los módulos `inventario` y `ti-assets` de FamSPI, estableciendo la justificación funcional de cada dominio, los actores que los operan, las capacidades esperadas y las restricciones de negocio que deben respetarse en cada ciclo de vida.

## 3. Alcance

**Incluye — Inventario operativo (`inventario`):**
- Consulta de inventario completo mediante la vista `v_inventario_completo`.
- Consulta de equipos disponibles para asignación y equipos por cliente.
- Gestión del catálogo de modelos de equipos.
- Creación de unidades desde modelo existente con estado inicial `no_asignado`.
- Captura y confirmación de serial único por unidad.
- Asignación de unidad a cliente y sucursal.
- Cambio de estado operativo de unidad con historial.
- Consulta del historial de mutaciones de una unidad.
- Registro de movimientos de entrada y salida de inventario.

**Incluye — Activos TI corporativos (`ti-assets`):**
- Creación y actualización de activos TI con código corporativo, marca, modelo, características, número de serie e IMEI.
- Numeración corporativa: creación, asignación, cambio y consulta histórica.
- Listado de activos con filtros y estados.
- Asignación individual y masiva de activos a colaboradores.
- Actualización de estado del activo (`available`, `assigned`, `unassigned`, `damaged`, `in_maintenance`, `retired`).
- Gestión de accesorios vinculados a un activo (crear, actualizar, eliminar).
- Programación y ejecución de mantenimiento anual y futuro.
- Diagnóstico de mantenimiento y coordinación de fechas de retiro.
- Generación y descarga de reportes de activos.
- Gestión de actas de entrega: listado, descarga PDF, carga de acta firmada.
- Documentos financieros por activo: upload y listado.
- Liberación de activo con evidencia fotográfica (hasta 10 fotos).
- Consulta de historial de activo, historial de asignaciones, historial de letras de cambio.

**Excluye:**
- Gestión de tickets de soporte TI (módulo `support-tickets`).
- Gestión de proveedores y compras (módulos de compras).
- Facturación directa a clientes (módulo de facturación).
- Gestión de usuarios y roles (módulo `auth`).

## 4. Actores

| Actor | Rol en el sistema | Módulo | Capacidades |
|---|---|---|---|
| Servicio técnico | `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico` | Inventario | Crear unidades, capturar seriales, asignar, cambiar estado, registrar movimientos |
| Operaciones | `operaciones`, `jefe_operaciones` | Inventario | Mismas capacidades de mutación que servicio técnico |
| Logística | `logistica`, `jefe_logistica` | Inventario | Mismas capacidades de mutación |
| Comercial | `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial` | Inventario | Crear unidades (solo creación) |
| Finanzas | `finanzas`, `jefe_finanzas` | Inventario + ti-assets (lectura) | Mutaciones en inventario; lectura de activos TI y carga de documentos financieros |
| Equipo TI | `ti`, `jefe_ti`, `admin_ti` | Ambos | Control total sobre activos TI; creación y mutación en inventario |
| Gerencia | `gerencia`, `gerencia_general` | Ambos | Lectura completa de activos TI e inventario; consulta de reportes |
| Financiero / Contador | `financiero`, `jefe_financiero`, `contador` | ti-assets (lectura) | Lectura de activos TI y documentos financieros |
| Administrador | `admin` | Inventario | Creación y mutación en inventario |
| Sistema | — | Ambos | Validación de integridad (serial único, estados válidos, transiciones) |

## 5. Justificación

El módulo existe porque FamSPI opera con dos universos de activos físicos que requieren trazabilidad diferenciada. Los equipos comerciales (inventario operativo) necesitan visibilidad de disponibilidad en tiempo real para asignación a clientes, control de seriales únicos y seguimiento de su estado a lo largo del ciclo de servicio. Los activos TI corporativos necesitan un ciclo de vida más complejo: identificación por número corporativo, programación de mantenimiento preventivo con calendarios anuales respetando feriados, generación de actas formales de entrega y recepción, documentación financiera (letras de cambio, facturas), evidencia de liberación y reportes descargables para auditoría.

La separación en dos submódulos permite que cada dominio aplique controles de acceso apropiados a sus actores sin contaminar los flujos del otro. La integración con el módulo de colaboradores (`collaborators.service`) permite vincular activos TI directamente al perfil corporativo del colaborador asignado.

## 6. Requerimientos funcionales

### Dominio: Inventario operativo

**REQ-INV-001**
- **Actor:** Usuario autenticado con acceso de consulta.
- **Requerimiento:** El sistema debe permitir consultar el inventario completo con filtros por búsqueda, estado, tipo y cliente.
- **Resultado esperado:** Se retorna listado de unidades desde la vista `v_inventario_completo` con datos consolidados.

**REQ-INV-002**
- **Actor:** Usuario autenticado.
- **Requerimiento:** El sistema debe permitir listar equipos disponibles para asignación y equipos asignados a un cliente específico.
- **Resultado esperado:** `GET /equipos-disponibles` prioriza unidades con estado operativo y `GET /equipos-cliente/:cliente_id` filtra por cliente.

**REQ-INV-003**
- **Actor:** Usuario autenticado.
- **Requerimiento:** El sistema debe permitir consultar y actualizar el catálogo de modelos de equipos.
- **Resultado esperado:** `GET /modelos` devuelve el catálogo; `PUT /modelos/:id` actualiza un modelo existente (restringido a `INVENTORY_MUTATION_ROLES`).

**REQ-INV-004**
- **Actor:** `INVENTORY_CREATE_ROLES`.
- **Requerimiento:** El sistema debe permitir crear una unidad desde un modelo existente.
- **Resultado esperado:** Se crea unidad con estado inicial `no_asignado`; si no se provee serial, se asigna `serial_pendiente = true` y serial temporal `SIN-SERIE-*`.

**REQ-INV-005**
- **Actor:** `INVENTORY_MUTATION_ROLES`.
- **Requerimiento:** El sistema debe permitir capturar o confirmar el serial definitivo de una unidad.
- **Resultado esperado:** El serial queda registrado como único en `equipos_unidad`; se elimina `serial_pendiente = true`. El sistema rechaza seriales duplicados.

**REQ-INV-006**
- **Actor:** `INVENTORY_MUTATION_ROLES`.
- **Requerimiento:** El sistema debe permitir asignar una unidad a un cliente y sucursal específicos.
- **Resultado esperado:** La unidad cambia a estado `asignado`, `cliente_id` queda referenciado y se registra evento en `equipos_historial`.

**REQ-INV-007**
- **Actor:** `INVENTORY_MUTATION_ROLES`.
- **Requerimiento:** El sistema debe permitir cambiar el estado operativo de una unidad.
- **Resultado esperado:** El nuevo estado queda persistido; la operación es rechazada si el estado no pertenece al catálogo de estados permitidos.

**REQ-INV-008**
- **Actor:** `INVENTORY_MUTATION_ROLES`.
- **Requerimiento:** El sistema debe permitir consultar el historial completo de mutaciones de una unidad.
- **Resultado esperado:** `GET /equipos-unidad/:id/historial` devuelve todos los registros de `equipos_historial` ordenados por fecha.

**REQ-INV-009**
- **Actor:** `INVENTORY_MUTATION_ROLES`.
- **Requerimiento:** El sistema debe permitir registrar movimientos de entrada o salida de inventario.
- **Resultado esperado:** Se crea registro en `inventory_movements` con tipo de movimiento, cantidad, referencia y actor.

**REQ-INV-010**
- **Actor:** Sistema.
- **Requerimiento:** El sistema debe impedir seriales duplicados entre unidades.
- **Resultado esperado:** La operación de captura de serial es rechazada con error 409 si el serial ya existe en otra unidad.

### Dominio: Activos TI corporativos

**REQ-INV-011**
- **Actor:** `TI_ASSET_CREATE_ROLES` (`TI_ROLES` + financiero).
- **Requerimiento:** El sistema debe permitir crear activos TI corporativos con nombre, marca, modelo, características, serial, IMEI y fecha de compra.
- **Resultado esperado:** Se crea registro en `ti_assets` con `asset_code` generado, estado inicial `unassigned` y evento de creación en `ti_asset_events`.

**REQ-INV-012**
- **Actor:** `TI_READ_ROLES` (TI + financiero + gerencia).
- **Requerimiento:** El sistema debe permitir listar activos TI con filtros por estado, nombre, marca y usuario asignado.
- **Resultado esperado:** `GET /api/v1/ti-assets` devuelve el listado paginado con datos del activo y colaborador asignado.

**REQ-INV-013**
- **Actor:** `TI_ROLES`.
- **Requerimiento:** El sistema debe permitir asignar un activo TI a un colaborador de forma individual o masiva.
- **Resultado esperado:** `assigned_to_user_id` se actualiza, `assigned_at` se establece, se registra en `ti_asset_assignments` y se actualiza el perfil del colaborador.

**REQ-INV-014**
- **Actor:** `TI_ROLES`.
- **Requerimiento:** El sistema debe permitir gestionar números corporativos: crear, asignar a activo, cambiar y consultar historial.
- **Resultado esperado:** El número corporativo queda vinculado al activo con trazabilidad completa de cambios.

**REQ-INV-015**
- **Actor:** `TI_ROLES`.
- **Requerimiento:** El sistema debe permitir programar, ejecutar y diagnosticar mantenimiento de activos TI con calendarios anuales.
- **Resultado esperado:** `ti_asset_maintenance_schedule` refleja el plan con fechas calculadas, respetando feriados nacionales (`security.holidays.ec`).

**REQ-INV-016**
- **Actor:** `TI_READ_ROLES`.
- **Requerimiento:** El sistema debe permitir consultar, descargar y gestionar actas de entrega de activos TI.
- **Resultado esperado:** Las actas están disponibles en PDF, con opción de carga de versión firmada.

**REQ-INV-017**
- **Actor:** `TI_READ_ROLES` (upload: cualquier `TI_READ_ROLES`).
- **Requerimiento:** El sistema debe permitir gestionar documentos financieros vinculados a un activo (facturas, letras de cambio).
- **Resultado esperado:** Los archivos se cargan en Drive mediante `uploadBase64File` y quedan referenciados en la base de datos del activo.

**REQ-INV-018**
- **Actor:** `TI_ROLES`.
- **Requerimiento:** El sistema debe permitir liberar un activo TI con evidencia fotográfica de hasta 10 imágenes.
- **Resultado esperado:** El activo cambia a estado `unassigned` o `retired`, las fotos quedan almacenadas y se genera registro de liberación con estado, razón y timestamp.

**REQ-INV-019**
- **Actor:** `TI_READ_ROLES`.
- **Requerimiento:** El sistema debe permitir generar y descargar reportes de activos TI individuales, por colaborador o consolidados.
- **Resultado esperado:** `GET /reports/download`, `GET /reports/asset/:id` y `GET /reports/collaborator/:userId` generan documentos descargables.

## 7. Requerimientos no funcionales

**RNF-INV-001 Autenticación:** Todas las rutas de ambos módulos requieren token JWT válido (`verifyToken`). No existen endpoints públicos.

**RNF-INV-002 Control de acceso diferenciado en inventario operativo:** Las rutas de creación están restringidas a `INVENTORY_CREATE_ROLES`; las de mutación (serial, asignación, estado, movimiento) a `INVENTORY_MUTATION_ROLES`. Las rutas de consulta están disponibles para cualquier usuario autenticado.

**RNF-INV-003 Control de acceso diferenciado en activos TI:** Las rutas de escritura están restringidas a `TI_ROLES`; las de lectura a `TI_READ_ROLES`; la creación de activos a `TI_ASSET_CREATE_ROLES`.

**RNF-INV-004 Integridad de serial único:** El serial definitivo de una unidad de inventario debe ser único a nivel de tabla `equipos_unidad`; el sistema debe rechazar duplicados con error de conflicto.

**RNF-INV-005 Validación de estados:** Solo se aceptan estados del catálogo interno definido en cada módulo (`ALLOWED_STATES` en inventario; `ALLOWED_STATUSES` en ti-assets).

**RNF-INV-006 Trazabilidad obligatoria:** Cada creación, asignación, cambio de estado y liberación debe generar registro en `equipos_historial` (inventario) o `ti_asset_events` / `ti_asset_assignments` (ti-assets) con actor y timestamp.

**RNF-INV-007 Manejo de archivos en memoria:** El módulo `ti-assets` usa `multer` con `memoryStorage`; los archivos no se escriben en disco y se transfieren directamente a Google Drive.

**RNF-INV-008 Integración con Drive:** La carga de documentos financieros y actas firmadas depende de la disponibilidad de las funciones `ensureFolder` y `uploadBase64File` del módulo `drive` utils.

**RNF-INV-009 Consistencia de lectura en inventario:** Las consultas de inventario completo deben apoyarse en la vista `v_inventario_completo` con criterios estables; cambios en la vista impactan todas las consultas de listado.

## 8. Reglas de negocio

**Inventario operativo:**
1. Estados válidos de unidad: `no_asignado`, `asignado`, `reservado`, `en_transito`, `retirado`, `baja`, `mantenimiento_programado`, `en_mantenimiento`, `en_evaluacion`, `evaluado`, `proceso_retiro`.
2. Si la unidad se crea sin serial, se marca `serial_pendiente = true` con serial temporal `SIN-SERIE-{uuid}`.
3. El serial definitivo debe ser único a nivel de `equipos_unidad`; el sistema rechaza duplicados.
4. La asignación de unidad exige `cliente_id` válido.
5. Todo cambio de estado o asignación debe registrar evento en `equipos_historial` con actor y timestamp.

**Activos TI corporativos:**
6. Los estados válidos de activo TI son: `available`, `assigned`, `unassigned`, `damaged`, `in_maintenance`, `retired`.
7. La liberación de un activo (`/liberate`) acepta hasta 10 fotografías en una sola petición multipart.
8. Los números corporativos tienen historial trazable; un activo puede haber tenido múltiples números corporativos en el tiempo.
9. El mantenimiento anual se genera respetando feriados nacionales de Ecuador (`getHolidaysForYear`).
10. Las actas de entrega firmadas se cargan como archivo único por acta; la versión firmada reemplaza el estado del acta.
11. Los documentos financieros (letras de cambio, facturas) se almacenan en Google Drive y el hash SHA-256 se calcula para verificación de integridad (`computeSha256HexFromBuffer`).

## 9. Dependencias

| Módulo | Dependencia |
|---|---|
| `auth` / `users` | Autenticación JWT y resolución de actores por `user.id` |
| `clients` | Validación de `cliente_id` en asignación de unidades de inventario |
| `collaborators` | Actualización de perfil de colaborador al asignar activo TI (`upsertCollaboratorProfile`) |
| `notifications` / `notificationManager` | Alertas de mantenimiento próximo y cambios de activo |
| `security.holidays.ec` | Cálculo de feriados nacionales para programación de mantenimiento |
| Google Drive (`drive` utils) | Almacenamiento de actas firmadas y documentos financieros |
| `documentHash` utils | Cálculo de SHA-256 para verificación de integridad de documentos |
| PostgreSQL | Persistencia de todas las entidades de ambos dominios |

## 10. Conclusión

Los requerimientos del módulo de Inventario y Equipos se justifican por la necesidad institucional de controlar con trazabilidad completa dos universos de activos físicos: los equipos operativos de servicio asignables a clientes y los activos TI corporativos internos. El dominio de inventario operativo cubre el ciclo comercial de equipos con control de serial único y estados operativos. El dominio de activos TI corporativos cubre el ciclo institucional de tecnología con mantenimiento preventivo, documentación formal de actas, gestión financiera, numeración corporativa y liberación con evidencia. Ambos dominios comparten el principio de trazabilidad obligatoria por evento y control de acceso diferenciado según el rol del actor.
