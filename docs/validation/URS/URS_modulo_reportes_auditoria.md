# URS — MÓDULO DE REPORTES Y AUDITORÍA

**Sistema:** FamSPI  
**Versión:** 2.0  
**Fecha:** 2026-06-18  
**Estado:** En revisión  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento define los requerimientos de usuario del módulo de Reportes y Auditoría del sistema SPI. Agrupa tres capacidades complementarias: el dashboard ejecutivo comercial con KPIs operativos en tiempo real, la consulta y exportación de la bitácora de auditoría transversal del sistema y la preparación documental controlada para procesos de auditoría interna o externa.

El módulo es transversal en su naturaleza: consolida datos de múltiples módulos (Business Case, solicitudes, clientes, talento humano) para exposición ejecutiva, y centraliza el registro de eventos auditables que cualquier módulo del sistema produce mediante `logAction`. Su existencia responde a la necesidad regulatoria de mantener trazabilidad, visibilidad ejecutiva y preparación documental verificable.

---

## 2. Objetivo

Definir los requerimientos de usuario del módulo de Reportes y Auditoría, estableciendo qué capacidades de visibilidad, trazabilidad y preparación documental deben existir en el sistema SPI, para qué actores, bajo qué controles de acceso y con qué resultados esperados.

---

## 3. Alcance

**Incluye:**
- Dashboard comercial con KPIs operativos, tendencias y alertas de talento humano
- Consulta paginada, filtrada y detallada de la bitácora `auditoria.logs`
- Exportación de la bitácora en formato CSV
- Gestión de la ventana de auditoría (modo activo/inactivo, fechas de vigencia)
- Gestión de secciones y documentos del expediente de auditoría
- Gestión de accesos externos temporales para auditores invitados

**Excluye:**
- Generación de la bitácora de auditoría — esa responsabilidad pertenece a cada módulo que llama a `logAction`
- Reportes financieros de viáticos (módulo de finanzas)
- Reportes de nómina o certificaciones (módulo de talento humano)

---

## 4. Actores

| Actor | Rol en el sistema | Acciones principales |
|---|---|---|
| Equipo comercial | `comercial`, `backoffice_comercial`, `acp_comercial`, `analista_comercial` | Consulta del dashboard con KPIs del negocio |
| Jefe comercial | `jefe_comercial` | Consulta del dashboard con KPIs y tendencias |
| Gerencia | `gerencia`, `gerencia_general` | Dashboard, consulta de bitácora y preparación de auditoría |
| Equipo TI | `ti`, `jefe_ti`, `admin_ti` | Acceso completo a bitácora, exportación CSV y gestión de modo auditoría |
| Talento humano | `talento_humano` | Consulta de bitácora del sistema |
| Auditor externo | Usuario con acceso temporal (grant) | Acceso restringido a documentos de la sección autorizada |
| Sistema | Proceso automatizado | Producción de entradas en `auditoria.logs` mediante `logAction` |

---

## 5. Justificación del módulo

El módulo existe porque la organización necesita tres capacidades que no puede obtener de los módulos operativos individuales:

**Dashboard comercial:** Los roles comerciales y gerencia necesitan visibilidad consolidada del negocio en tiempo real sin consultar múltiples módulos por separado. El cálculo de KPIs (Business Cases activos, solicitudes pendientes, clientes nuevos, cumplimiento de cronogramas, alertas de TH) requiere cruzar datos de cuatro tablas distintas.

**Bitácora de auditoría:** El sistema tiene obligación de mantener trazabilidad de todas las acciones críticas. Sin un módulo dedicado de consulta, esa bitácora no sería verificable ni exportable para auditorías internas o externas.

**Preparación de auditoría:** Cuando hay un proceso de auditoría formal en curso, la organización necesita un repositorio controlado de documentos, secciones de checklist y accesos temporales para auditores externos, con activación/desactivación explícita.

---

## 6. Requerimientos funcionales del usuario

### REQ-RPT-001 — Dashboard comercial con KPIs
**Actor:** Comercial / Jefe comercial / Gerencia  
**Enunciado:** El sistema debe exponer un dashboard con los siguientes KPIs calculados en tiempo real: total de Business Cases, BC activos, BC completados, solicitudes pendientes, clientes nuevos en los últimos 30 días, promedio de cumplimiento de cronogramas del mes en curso y alertas de colaboradores comerciales con permisos activos o cambios de estado laboral.  
**Resultado esperado:** Objeto JSON con KPIs numéricos, array de alertas de TH, datos para gráficos de BC por estado y tendencia mensual de solicitudes (últimos 6 meses). Tiempo de respuesta dentro de TTL de caché de 60 segundos.  
**Criticidad:** Alta

### REQ-RPT-002 — Consulta paginada y filtrada de la bitácora
**Actor:** TI / Gerencia / Talento humano  
**Enunciado:** El sistema debe permitir consultar la bitácora de auditoría `auditoria.logs` con filtros por usuario (ID o email), módulo, acción, rango de fechas, ID de solicitud, ID de mantenimiento, ID de inventario y tipo de acción automática.  
**Resultado esperado:** Lista paginada de registros de auditoría con total de registros y número de página. Cada registro incluye actor, email, módulo, acción, detalle, timestamp y campo de trazabilidad de contexto.  
**Criticidad:** Alta

### REQ-RPT-003 — Consulta de detalle de un registro de auditoría
**Actor:** TI / Gerencia / Talento humano  
**Enunciado:** El sistema debe permitir consultar el detalle completo de un registro individual de la bitácora por su identificador.  
**Resultado esperado:** Objeto completo del registro de auditoría con todos sus campos, incluyendo metadatos extendidos (`request_id`, `mantenimiento_id`, `inventario_id`, `auto`).  
**Criticidad:** Media

### REQ-RPT-004 — Exportación de la bitácora en CSV
**Actor:** TI / Gerencia  
**Enunciado:** El sistema debe permitir exportar la bitácora de auditoría en formato CSV aplicando los mismos filtros disponibles en la consulta.  
**Resultado esperado:** Archivo CSV descargable con todos los registros que cumplen los filtros, con cabeceras descriptivas. Acceso restringido a roles `ti` y `gerencia`.  
**Criticidad:** Media

### REQ-RPT-005 — Gestión del estado de la ventana de auditoría
**Actor:** Admin TI / Jefe TI  
**Enunciado:** El sistema debe permitir activar o desactivar el modo de auditoría del sistema y definir las fechas de vigencia de la ventana activa.  
**Resultado esperado:** Persistencia del estado (`active`/`inactive`) en `audit_settings` con fechas de inicio y fin. El estado es visible para todos los usuarios con acceso al módulo.  
**Criticidad:** Alta

### REQ-RPT-006 — Gestión de secciones del expediente de auditoría
**Actor:** Admin TI / Jefe TI  
**Enunciado:** El sistema debe permitir crear y configurar secciones de un checklist de auditoría, definiendo título, descripción y roles autorizados para acceder a cada sección.  
**Resultado esperado:** Secciones persistidas en `audit_sections` con control de acceso por rol. El listado de secciones es visible para todos los actores del módulo, respetando los roles autorizados por sección.  
**Criticidad:** Media

### REQ-RPT-007 — Carga, descarga y gestión de documentos de auditoría
**Actor:** TI / Gerencia / Auditor externo (sección autorizada)  
**Enunciado:** El sistema debe permitir subir documentos al expediente de auditoría, consultar el listado, actualizar el estado de revisión de cada documento y descargar documentos individuales.  
**Resultado esperado:** Documentos persistidos en `audit_documents` con enlace a almacenamiento externo (Drive), estado de revisión y metadatos de carga. La descarga genera un enlace de acceso temporal.  
**Criticidad:** Alta

### REQ-RPT-008 — Gestión de accesos externos temporales
**Actor:** Admin TI / Jefe TI  
**Enunciado:** El sistema debe permitir conceder acceso temporal a auditores externos al expediente de auditoría, listar los accesos activos y revocarlos cuando sea necesario.  
**Resultado esperado:** Registros en `audit_access_grants` con identificación del auditor, sección autorizada y vigencia del acceso. La revocación elimina el grant y bloquea el acceso inmediatamente.  
**Criticidad:** Alta

---

## 7. Requerimientos no funcionales

**RNF-RPT-001 — Seguridad de acceso:** Todos los endpoints del módulo requieren JWT válido. Los endpoints de `audit-prep` de escritura y gestión de accesos externos están restringidos a `admin_ti` y `jefe_ti`.

**RNF-RPT-002 — Autorización granular:** La consulta y exportación de bitácora está restringida a `ti`, `gerencia`, `talento_humano`. La exportación CSV está restringida a `ti`, `gerencia`. El dashboard está restringido a roles comerciales y gerencia.

**RNF-RPT-003 — Rendimiento:** El dashboard aplica caché en memoria con TTL de 60 segundos para evitar consultas repetidas a cuatro tablas en paralelo. Las consultas de bitácora deben estar paginadas para evitar impacto en la base de datos.

**RNF-RPT-004 — Trazabilidad de acciones de configuración:** Las operaciones de activación del modo auditoría, carga documental y gestión de accesos externos deben quedar registradas en `auditoria.logs` mediante `logAction`.

**RNF-RPT-005 — Integridad documental:** Los adjuntos del expediente de auditoría deben cumplir restricciones de tipo MIME y tamaño máximo definidas por el módulo. Los identificadores de Drive no deben exponerse en respuestas al cliente.

**RNF-RPT-006 — Disponibilidad del dashboard:** El dashboard debe devolver resultados incluso cuando algunas tablas fuente estén vacías, clasificando los errores de esquema faltante (HTTP 500) frente a errores de disponibilidad de base de datos (HTTP 503).

---

## 8. Reglas de negocio

- Los KPIs del dashboard son calculados sobre `bc_master`, `requests`, `clients`, `visit_schedules`, `scheduled_visits`, `client_visit_logs` y `collaborator_profiles`.
- Los estados "activos" de BC son: `draft`, `waiting_proforma`, `new`. Los "completados" son: `completed`, `approved`.
- Las alertas de TH aplican a colaboradores con rol comercial o backoffice que tengan `estatus_empleado` en `pasivo`, `desvinculado` o `inactivo`, o que tengan un permiso aprobado activo.
- El modo auditoría tiene un único registro singleton en `audit_settings` (id = 1, creado con `INSERT ... ON CONFLICT DO NOTHING`).
- Los accesos externos a secciones del expediente se validan contra `audit_access_grants`; un grant revocado o expirado bloquea el acceso inmediatamente.
- La bitácora `auditoria.logs` es solo lectura para todos los actores del módulo; ningún endpoint del módulo de auditoría escribe en esta tabla directamente.

---

## 9. Dependencias con otros módulos

- **Business Case:** Fuente de KPIs de BC (`bc_master`, `current_stage`).
- **Solicitudes:** Fuente de KPIs de solicitudes (`requests`, `status`) y tendencia mensual.
- **Clientes:** Fuente de KPI de clientes nuevos (`clients`, `created_at`).
- **Talento Humano:** Fuente de alertas de estado laboral (`collaborator_profiles`, `permisos_vacaciones`).
- **Visitas comerciales:** Fuente de KPI de cumplimiento de cronogramas (`visit_schedules`, `scheduled_visits`, `client_visit_logs`).
- **Todos los módulos:** Productores de entradas en `auditoria.logs` mediante `logAction`.
- **Google Drive:** Almacenamiento de documentos del expediente de auditoría.

---

## 10. Conclusión

Los requerimientos del módulo de Reportes y Auditoría se justifican por la necesidad de visibilidad ejecutiva consolidada del negocio, trazabilidad auditable de todas las acciones del sistema y preparación documental controlada para procesos de auditoría formal. El módulo es transversal y depende de la calidad de los datos producidos por todos los demás módulos del sistema.
