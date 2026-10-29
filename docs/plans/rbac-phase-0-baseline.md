# Fase 0 — Línea base de autorización

Estado: `completada`

Fecha de corte del diagnóstico: 2026-09-03 (antes de aplicar Fase 2)

## Objetivo

Documentar la situación actual antes de cambiar reglas de acceso. Esta línea base se construyó con código real, contextos de módulo, rutas frontend y consultas de solo lectura a Neon.

## Backend

Se encontraron 81 archivos `*.routes.js`, 1.297 declaraciones de rutas y 1.015 apariciones de `requireRole`. Las apariciones no equivalen a cobertura endpoint por endpoint porque algunas rutas reutilizan arrays y otras declaraciones son complejas.

### Riesgos inmediatos

| Módulo | Evidencia actual | Riesgo |
|---|---|---|
| `work-management` | 25 rutas, solo `verifyToken` | El RBAC fino no está activo; depende de membresía/propiedad interna |
| `permisos` | 23 rutas, solo autenticación | Aprobaciones, cargas y reportes dependen de lógica interna |
| `vacaciones` | 9 rutas, solo autenticación | Cambios de estado sin permiso explícito en router |
| `signature-workflows` | 17 rutas, solo autenticación | Firma, reasignación y descargas requieren política explícita |
| `famdays` | 30 rutas sin `requireRole` local | Revisar controles internos y middleware global |
| `gmail` | 5 rutas sin `requireRole` local | Revisar operaciones administrativas y destinatarios |
| `operaciones/logistica/tecnico` | Middleware `auth.middleware` legacy | Posible divergencia con el middleware central |
| `audit-prep` | Documentos sin `requireRole` según contexto | Posible modificación de evidencia por cualquier autenticado |

### Autorización duplicada

Los módulos `crm-fam`, `business-case`, `clients`, `opportunities`, `schedules`, `delivery-requests`, `collab-deliveries`, `consumable-files`, `permisos`, `kickoff` y `famdays` definen sets locales de roles o capacidades.

## Frontend

La protección está distribuida entre `ProtectedRoute.jsx`, `AppRoutes.jsx`, `strictRoles`, comprobaciones de `user.role`, `user.scope`, `extra_roles`, lógica local de páginas y el catálogo duplicado `core/auth/moduleAccess.js`.

Riesgos confirmados:

- numerosas rutas bajo `DashboardLayout` no tienen protección específica visible;
- frontend puede mostrar una acción que backend rechaza;
- el catálogo frontend y backend puede desincronizarse;
- frontend no puede ser la única barrera de seguridad.

## Roles y aliases observados

```text
comercial, jefe_comercial, backoffice_comercial, acp_comercial,
tecnico, ing_servicio, esp_app, jefe_tecnico, jefe_servicio,
servicio_tecnico, operaciones, jefe_operaciones, logistica,
jefe_logistica, calidad, jefe_calidad, talento_humano,
jefe_talento_humano, finanzas, financiero, jefe_finanzas,
jefe_financiero, ti, jefe_ti, admin_ti, gerencia,
gerencia_general, gerente_general, director, admin, administrador,
pasante, ing_servicio_ext, esp_app_ext, extra_roles.
```

Estos nombres se conservan como compatibilidad y deben mapearse a permisos canónicos.

## Rutas públicas y excepciones

La lista central está en `backend/src/routes/publicPaths.js` e incluye health checks, autenticación, verificaciones documentales, callbacks, webhooks, SSE y shortcuts.

Cada excepción deberá clasificarse como pública real, integración autenticada por secreto/API key, job interno o workaround legacy. No se debe ampliar esta lista para resolver problemas de RBAC.

## Neon verificado

Consulta de solo lectura realizada usando `DB_PASSWORD` desde GCP Secret Manager, proyecto `famspi-sbox`.

| Tabla | Resultado |
|---|---:|
| `public.users` | 38 registros |
| `public.user_module_access` | 256 registros |
| `public.module_global_status` | 1 registro |

Estructura relevante:

- `users.role`: `TEXT`, nullable.
- `users.extra_roles`: `TEXT[]`, no nullable.
- `user_module_access.user_id`: FK a `users(id)`.
- `user_module_access`: unicidad `(user_id, module_key)` e índice por `user_id`.
- `module_global_status.module_key`: PK.
- En el corte inicial no existían tablas de tenants, membresías, permisos, roles por tenant ni relaciones rol-permiso. Fase 2 las creó vacías; no forman parte de la línea base operativa todavía.
- El acceso modular actual habilita módulos por usuario, pero no permisos por acción.

## Decisiones de arquitectura

- La unidad futura será el permiso, no el nombre del rol.
- `user_module_access` se conserva como compatibilidad temporal.
- `x-app-path` no será autoridad de seguridad.
- `users.role` y `extra_roles` no se eliminan en la primera migración.
- Módulo, permiso, tenant, ownership y estado de workflow serán dimensiones separadas.
- La migración será incremental y reversible por módulo.

## Pendientes de aprobación antes de Fase 1

- [ ] Aprobar catálogo inicial de permisos.
- [ ] Confirmar permisos de aprobación, firma y administración.
- [ ] Definir tenant inicial de los 38 usuarios actuales.
- [ ] Confirmar si `admin_ti` es rol persistido, alias o capacidad derivada.
- [ ] Confirmar política de `extra_roles`.
- [ ] Definir expiración para accesos puntuales.

## Criterio de cierre

Fase 0 cerrada: línea base, riesgos, estructura real de Neon y decisiones iniciales documentadas. La matriz endpoint-por-endpoint y las aprobaciones funcionales son entradas de la Fase 1.
