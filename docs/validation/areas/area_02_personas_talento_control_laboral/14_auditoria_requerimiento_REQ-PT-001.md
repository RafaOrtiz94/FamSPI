# AUDITORIA DE REQUERIMIENTO - REQ-PT-001

## Metadatos
- Requerimiento: `REQ-PT-001`
- Area: `Area 02 - Personas, Talento y Control Laboral`
- Fecha de auditoria: `2026-03-20`
- Auditoria: `Revision estatica de codigo y documentacion (sin ejecucion E2E)`

## Descripcion del requerimiento
El sistema debe permitir a talento humano y roles autorizados administrar usuarios internos y departamentos.

## Criterio esperado (descomposicion verificable)
1. Debe existir una consola unificada para gestionar usuarios y departamentos.
2. Debe existir control de acceso por rol en frontend para la entrada unificada.
3. Debe existir control de acceso por rol en backend para CRUD de `users` y `departments`.
4. Debe existir CRUD funcional de usuarios y departamentos.
5. Debe existir validacion de datos y manejo de errores consistente.
6. Debe existir trazabilidad/auditoria de acciones criticas.
7. La UI/UX debe soportar operacion diaria sin fricciones criticas.

## Evidencia encontrada
| Criterio | Evidencia real en codigo | Resultado |
|---|---|---|
| Consola unificada | `spi_front/src/modules/talento/pages/PeopleAdminHub.jsx:16`, `:48`, `:206` | Cumple |
| Entrada unificada en navegacion | `spi_front/src/core/ui/components/NavigationBar.jsx:147`, `:150`, `:343`, `:348` | Cumple |
| Restriccion de ruta directa en frontend | `spi_front/src/routes/AppRoutes.jsx:110`, `:331`, `:332`, `:334`; `spi_front/src/core/auth/ProtectedRoute.jsx:16`, `:49`, `:95` | Cumple |
| CRUD users en backend | `backend/src/modules/users/users.routes.js:37`, `:39`, `:40`, `:41`; `backend/src/modules/users/users.controller.js:152`, `:259`, `:325`, `:408` | Cumple |
| CRUD departments en backend | `backend/src/modules/departments/departments.routes.js:27`, `:33`, `:36`, `:39`; `backend/src/modules/departments/departments.controller.js:65`, `:110`, `:160`, `:214` | Cumple |
| Validacion usuarios | `backend/src/modules/users/users.controller.js:100`, `:111`, `:276`, `:288`, `:344`, `:356` | Cumple |
| Validacion departamentos | `backend/src/modules/departments/departments.controller.js:43`, `:113`, `:123`, `:165`, `:179` | Parcial |
| Auditoria de acciones | `backend/src/modules/users/users.controller.js:300`, `:387`, `:457`; `backend/src/modules/departments/departments.controller.js:141`, `:195`, `:239`; `backend/src/middlewares/auditMiddleware.js:22`, `:36` | Parcial |
| Gestion usuarios en UI | `spi_front/src/modules/talento/pages/Usuarios.jsx:183`, `:254`, `:276`, `:360`, `:625` | Cumple con observaciones |
| Gestion departamentos en UI | `spi_front/src/modules/talento/pages/Departamentos.jsx:124`, `:212`, `:235`, `:280`, `:502` | Cumple con observaciones |

## Estado de implementacion
`Implementado con observaciones`

## Calificacion (0-100)
`79/100`

## Rationale de calificacion
- Cobertura funcional: 24/30
- Evidencia tecnica: 14/15
- Calidad de implementacion: 12/20
- Validaciones y manejo de errores: 8/10
- UI: 7/10
- UX: 5/10
- Documentacion: 3/5
- Mantenibilidad: 6/10

## Hallazgos clave
1. Restriccion de acceso no totalmente alineada entre frontend y backend para el hub unificado (frontend mas estricto, backend permite mas roles en CRUD).
2. `Usuarios` no expone el catalogo completo de roles admitidos por backend.
3. `updateUser` no permite limpiar `department_id` ni `google_id` cuando llegan como `null` por uso de `COALESCE`.
4. `updateDepartment` no revalida unicidad de `code/name` y no permite limpiar descripcion por `COALESCE`.
5. `departments.controller` aplica cambios de esquema (`ensureDepartmentSchema`) durante requests HTTP.
6. Auditoria puede quedar duplicada entre `auditMiddleware` y llamadas manuales `logAction`.
7. Modal y formularios del hub tienen brechas de accesibilidad (labels, foco, semantica tab) y fricciones de feedback.

## Riesgos
1. Riesgo de inconsistencia de permisos entre interfaz y API.
2. Riesgo de datos no normalizados o duplicados en departamentos.
3. Riesgo de degradacion de trazabilidad por eventos de auditoria duplicados/no homogeneros.
4. Riesgo UX en tareas criticas por formularios con feedback poco contextual.
5. Riesgo operativo por mutaciones de esquema en runtime dentro de endpoints.

## Recomendaciones (minimo 10, priorizadas)
### P1
1. Unificar matriz de permisos de `Usuarios y Departamentos` (frontend + backend) en una sola fuente.
2. Restringir `GET /users?active=false` para vistas administrativas explicitas.
3. Separar endpoint de directorio y endpoint administrativo de usuarios.
4. Permitir limpiar `department_id` en `updateUser` sin `COALESCE` que preserve valor previo.
5. Permitir limpiar `google_id` en `updateUser` sin `COALESCE` que preserve valor previo.
6. Revalidar unicidad `code/name` en `updateDepartment`.
7. Eliminar DDL runtime de `ensureDepartmentSchema` y dejar solo migraciones.
8. Bloquear desactivacion de departamento con usuarios activos, o exigir reasignacion previa.

### P2
9. Externalizar catalogo de roles del frontend desde backend/config compartida para evitar desalineacion.
10. Normalizar `code/name` de departamentos en backend (trim, upper, comparacion case-insensitive).
11. Permitir limpiar `description` en `updateDepartment`.
12. Crear endpoints de estado explicitos (`PATCH /users/:id/status` y `PATCH /departments/:id/status`) para operaciones de activacion/desactivacion.
13. Evitar auto-desactivacion del usuario autenticado y advertir ultimo rol critico activo.
14. Mostrar y filtrar inconsistencias de asignacion (usuario ligado a departamento inactivo).

### P3
15. Agregar paginacion/busqueda server-side para listados grandes y endpoints de metricas para dashboards.
16. Corregir accesibilidad del hub: labels visibles en filtros, foco en modal, semantica tab, feedback inline por campo.

## Veredicto final
`REQ-PT-001` se encuentra implementado y operativo, pero no en nivel maduro. El requerimiento cumple en cobertura funcional base, con brechas importantes de alineacion de permisos, consistencia de validaciones y calidad UX. Se recomienda cerrar primero las acciones P1 antes de declarar cumplimiento robusto de produccion.

