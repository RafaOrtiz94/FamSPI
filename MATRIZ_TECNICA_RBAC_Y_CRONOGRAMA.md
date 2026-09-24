# Matriz Técnica RBAC y Cronograma

Fecha de cierre: 2026-06-27
Fuente de evidencia:
- `spi_front/src/routes/AppRoutes.jsx`
- `spi_front/src/core/auth/moduleAccess.js`
- `backend/src/modules/servicio/servicio.routes.js`
- `backend/src/modules/technical-applications/technicalApplications.routes.js`
- `backend/src/modules/viaticos/viaticos.routes.js`
- `backend/src/modules/servicio/technicalSchedule.service.js`

## 1. Roles técnicos alineados

Roles base del frente técnico:
- `servicio_tecnico`
- `tecnico`
- `ing_servicio`
- `esp_app`
- `jefe_tecnico`
- `jefe_servicio`
- `jefe_servicio_tecnico`

Roles externos con dashboard separado:
- `ing_servicio_ext`
- `esp_app_ext`

Roles de coordinación ampliada del cronograma:
- `gerencia`
- `gerencia_general`
- `director`

## 2. Módulos visibles y rutas verificadas

| Módulo | Ruta UI | Clave moduleAccess | Observación |
|---|---|---|---|
| Dashboard técnico | `/dashboard/servicio-tecnico` | `inicio` | Entrada principal del área |
| Cronograma técnico | `/dashboard/servicio-tecnico/cronograma` | `servicio_cronograma` | Vista consolidada con filtros |
| Inspecciones | `/dashboard/servicio-tecnico/inspecciones` | `servicio_inspecciones` | Redirige al workspace técnico de compras |
| Correctivos | `/dashboard/servicio-tecnico/correctivos` | `servicio_correctivos` | Abre `Mantenimientos` en tab correctivo |
| Workspace procedimiento | `/dashboard/servicio-tecnico/workspace-procedimiento` | `servicio_workspace` | Entrada al flujo técnico origen |
| Retiros | `/dashboard/servicio-tecnico/retiros` | `servicio_retiros` | Flujo F.ST-11 |
| Mantenimientos | `/dashboard/servicio-tecnico/mantenimientos` | `servicio_mantenimientos` | Preventivo y compatibilidad legacy |
| Solicitudes | `/dashboard/servicio-tecnico/solicitudes` | `servicio_solicitudes` | Flujo técnico visible |
| Disponibilidad | `/dashboard/servicio-tecnico/disponibilidad` | `servicio_disponibilidad` | Estado del equipo |
| Capacitaciones | `/dashboard/servicio-tecnico/capacitaciones` | `servicio_capacitaciones` | Agenda y gestión técnica |
| Equipos | `/dashboard/servicio-tecnico/equipos` | `servicio_equipos` | Inventario técnico |
| Aprobaciones | `/dashboard/servicio-tecnico/aprobaciones` | `servicio_aprobaciones` | Coordinación técnica |
| Aplicaciones ST | `/dashboard/servicio-tecnico/aplicaciones` | `servicio_aplicaciones` | Procedimientos ST |
| Desinfección | `/dashboard/servicio-tecnico/desinfeccion` | `servicio_desinfeccion` | Procedimiento técnico |
| Asistencia y salidas | `/dashboard/servicio-tecnico/asistencia` | `servicio_asistencia` | Salidas, visitas y marcaciones |
| Verificación | `/dashboard/servicio-tecnico/verificacion` | `servicio_verificacion` | Equipos nuevos |
| Casos externos | `/dashboard/servicio-tecnico/casos-externos` | sin clave dedicada | Sigue ruta técnica real |
| Entregas privadas | `/dashboard/servicio-tecnico/entregas-privadas` | sin clave dedicada | Redirige a workspace de compras privadas |
| Dashboard externo | `/dashboard/ext` | sin clave técnica | Exclusivo `ing_servicio_ext` y `esp_app_ext` |
| Viáticos | `/dashboard/finanzas/viaticos` | `finanzas_viaticos` | Acceso técnico operativo habilitado |
| Permisos TH | `/dashboard/talento-humano/permisos` | `talento_permisos` | Visible según RBAC global |

## 3. Contrato backend técnico verificado

### Servicio técnico

Roles backend base para servicio:
- `servicio_tecnico`
- `tecnico`
- `ing_servicio`
- `esp_app`
- `jefe_tecnico`
- `jefe_servicio`
- `jefe_servicio_tecnico`
- `gerencia`
- `gerencia_general`

Endpoints verificados para la alineación:
- `GET /api/v1/servicio/disponibilidad`
- `POST /api/v1/servicio/disponibilidad`
- `GET /api/v1/servicio/actividades`
- `POST /api/v1/servicio/actividades`
- `GET /api/v1/servicio/cronograma/feed`
- `GET /api/v1/servicio/mantenimientos`
- `GET /api/v1/servicio/capacitaciones`
- `GET /api/v1/servicio/workflow-documents/summary`
- `GET /api/v1/servicio/corrective-cases/workspace/list`
- `GET /api/v1/servicio/corrective-cases/workspace/kpi`
- `GET/POST /api/v1/servicio/withdrawal/workflow`

### Aplicaciones técnicas

Roles backend verificados:
- `servicio_tecnico`
- `tecnico`
- `ing_servicio`
- `esp_app`
- `jefe_servicio`
- `jefe_tecnico`
- `jefe_servicio_tecnico`
- `gerencia`
- `administrador`

Endpoint verificado:
- `GET /api/v1/technical-applications/available`

### Viáticos para integración operativa

Roles backend verificados para acceso operativo:
- `servicio_tecnico`
- `tecnico`
- `ing_servicio`
- `esp_app`
- `jefe_tecnico`
- `jefe_servicio`
- `jefe_servicio_tecnico`
- `ing_servicio_ext`
- `esp_app_ext`
- más roles financieros, TH, TI y administración

Endpoints usados en el cierre de integración:
- `GET /api/v1/viaticos/`
- `POST /api/v1/viaticos/`
- `PATCH /api/v1/viaticos/:id/workflow`

## 4. Matriz del cronograma técnico consolidado

| Tipo normalizado | Categoría | Fuente verificada | Ruta origen |
|---|---|---|---|
| `manual` | `manual` | `servicio.cronograma_actividades_tecnicas` | `/dashboard/servicio-tecnico/cronograma` |
| `actividad_tecnica` | `manual` | `servicio.cronograma_actividades_tecnicas` | `/dashboard/servicio-tecnico/cronograma` |
| `mantenimiento` | `maintenance` | `servicio.cronograma_mantenimientos` | `/dashboard/servicio-tecnico/mantenimientos` |
| `capacitacion` | `training` | `servicio.cronograma_capacitacion` | `/dashboard/servicio-tecnico/capacitaciones` |
| `inspeccion_compra_publica` | `inspection` | `equipment_purchase_requests` | `/dashboard/servicio-tecnico/inspecciones?tab=public` |
| `inspeccion_compra_privada` | `inspection` | `private_purchase_requests` | `/dashboard/servicio-tecnico/inspecciones?tab=private` |
| `public_purchase_reinspection` | `inspection` | `servicio.cronograma_actividades_tecnicas` + compras públicas | `/dashboard/servicio-tecnico/inspecciones?tab=public` |
| `private_purchase_reinspection` | `inspection` | `servicio.cronograma_actividades_tecnicas` + compras privadas | `/dashboard/servicio-tecnico/inspecciones?tab=private` |
| `solicitud_inspeccion` | `inspection` backlog | compras públicas/privadas sin fecha cerrada | `/dashboard/servicio-tecnico/inspecciones` |

## 5. Decisiones de cierre

- El cronograma oficial queda cerrado con vista operativa filtrable; no se implementa una cuadrícula calendario adicional porque no existe evidencia verificable de necesidad funcional extra ni contrato backend específico para slots horarios.
- No se requiere abrir RBAC adicional hacia páginas de compras públicas o privadas para el uso diario técnico del cronograma; la navegación oficial del feed va a rutas técnicas de servicio ya protegidas.
- El dashboard técnico deja de mostrar KPIs hardcodeados; solo se exponen métricas verificadas desde datos cargados.
