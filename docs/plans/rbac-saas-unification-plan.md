# Plan maestro: unificación de acceso por roles y evolución SaaS

Estado: `Fase 0 documentada con aprobaciones pendientes / Fase 1 parcial / Fase 2 schema aplicado`

Fecha: 2026-09-03

Alcance: backend, frontend, autorización por módulo, permisos, ownership, workflows y preparación multi-tenant.

## 1. Objetivo

Construir un modelo único de autorización para FamSPI donde:

```text
autenticación válida
+ tenant válido
+ módulo contratado/habilitado
+ permiso requerido
+ reglas de ownership, área y estado
= acceso permitido
```

El backend será la autoridad de seguridad. El frontend consumirá un manifiesto de permisos para navegación y experiencia de usuario, pero nunca será la única barrera.

No se deben cambiar durante esta iniciativa los contratos existentes `{ ok: true|false }`, el prefijo `/api/v1/`, ni las reglas de negocio sin evidencia y aprobación específica.

## 2. Evidencia validada

### Código

- `backend/src/middlewares/roles.js` contiene `ROLE_GROUPS`, aliases, `extra_roles` y bypass de administradores.
- `backend/src/middlewares/auth.js` expone el middleware central `verifyToken` y delega `requireRole`.
- `backend/src/middlewares/moduleAccess.js` aplica `user_module_access` y depende de `x-app-path` para resolver el módulo.
- `backend/src/modules/module-access/moduleAccess.service.js` mantiene el catálogo backend.
- `spi_front/src/core/auth/moduleAccess.js` mantiene un catálogo frontend duplicado.
- `spi_front/src/core/auth/ProtectedRoute.jsx` mezcla roles, scopes, `extra_roles`, `strictRoles` y acceso modular.
- `spi_front/src/routes/AppRoutes.jsx` contiene rutas agrupadas, rutas sin protección específica y listas literales de roles.
- Existen módulos con autorización propia en services/controllers y módulos protegidos solamente con `verifyToken`.
- `operaciones`, `logistica` y `tecnico` usan un middleware legacy (`auth.middleware`) distinto del middleware central.

### Contextos de módulo

- `work-management` reconoce que el RBAC fino todavía no está activo.
- `permisos` y `vacaciones` dependen principalmente de autorización interna y no tienen `requireRole` por endpoint.
- `signature-workflows` protege autenticación, pero no declara permisos por operación en sus rutas.
- `audit-prep` documenta endpoints de documentos sin `requireRole`.
- `crm-fam`, `business-case`, `clients`, `schedules` y compras definen sets de roles locales.
- `backend/src/modules/module-access/CONTEXT.md` no existe actualmente.

### Neon PostgreSQL

Consulta realizada con el secreto `DB_PASSWORD` desde GCP Secret Manager, proyecto `famspi-sbox`, contra el endpoint Neon configurado para producción.

Resultado:

- `public.users`: 38 usuarios.
- `public.user_module_access`: 256 registros.
- `public.module_global_status`: 1 registro, únicamente `kickoff_2026`.
- `user_module_access` tiene FK a `users(id)`.
- Tiene unicidad por `(user_id, module_key)` e índice por `user_id`.
- `users.role` es un campo de texto nullable.
- `users.extra_roles` es `TEXT[] NOT NULL`.
- No se encontraron tablas públicas de permisos, roles por tenant, membresías de tenant ni asignaciones de permisos.
- El modelo actual permite habilitar/deshabilitar módulos por usuario, pero no expresa permisos por acción.

Conclusión: el acceso modular existente puede reutilizarse como compatibilidad, pero no es suficiente para SaaS multi-tenant.

## 3. Principios de diseño

1. El backend decide siempre.
2. El permiso es la unidad de autorización; el rol solo agrupa permisos.
3. El módulo habilitado no sustituye al permiso.
4. Ownership, área, tenant y estado son condiciones adicionales, no roles disfrazados.
5. Los aliases actuales se conservan durante la migración.
6. Denegar por defecto cuando no exista una política explícita.
7. Cada permiso debe poder auditarse y probarse.
8. El catálogo de módulos y permisos debe tener una única fuente de verdad.
9. Las migraciones de DB se diseñan contra Neon verificado, nunca solo contra archivos de migración.
10. La migración debe ser incremental y reversible por módulo.

## 4. Modelo objetivo

### Entidades

```text
tenants
tenant_memberships
roles
permissions
role_permissions
user_roles
modules
tenant_modules
user_module_access        (compatibilidad temporal)
resource_policies         (ownership/área, si se requiere)
authorization_audit_log
```

### Permisos

Formato recomendado:

```text
<modulo>.<recurso>.<accion>
```

Ejemplos:

```text
crm.accounts.read
crm.accounts.write
crm.opportunities.approve
business_case.read
business_case.offer.publish
vacations.request.create
vacations.request.approve
signature.workflow.sign
work_management.project.manage
users.manage
module_access.manage
```

### Roles

Inicialmente se mapearán los roles actuales a permisos. No se debe reemplazar de inmediato la columna `users.role`.

Roles de plataforma sugeridos:

- `platform_admin`
- `tenant_owner`
- `tenant_admin`
- `module_admin`
- `manager`
- `operator`
- `employee`
- `viewer`
- `external_user`

Los roles actuales (`jefe_comercial`, `ing_servicio`, `talento_humano`, etc.) continuarán como roles de compatibilidad hasta completar la migración.

## 5. Fases de ejecución

### Fase 0 — Preparación y línea base

Objetivo: congelar el diagnóstico y definir el contrato de autorización.

Tareas:

- [x] Crear inventario inicial de rutas y riesgos en `docs/plans/rbac-phase-0-baseline.md`.
- [x] Relacionar los módulos críticos con sus reglas actuales y riesgos.
- [x] Inventariar rutas frontend, catálogos duplicados y excepciones públicas.
- [x] Identificar rutas públicas, webhooks, jobs, SSE y shortcuts.
- [x] Documentar aliases reales y roles obsoletos.
- [x] Crear `module-access/CONTEXT.md` con evidencia actual.
- [ ] Confirmar responsables funcionales de cada módulo (pendiente de aprobación).
- [ ] Definir política de compatibilidad para `extra_roles` (pendiente de aprobación).

Entregables:

- matriz de autorización aprobada;
- catálogo inicial de roles, módulos y permisos;
- lista de excepciones públicas y legacy;
- decisión formal sobre los tres módulos con doble implementación: CRM, compras y oportunidades/FamSheets.

Criterio de salida: línea base y riesgos documentados. La matriz endpoint-por-endpoint y la aprobación funcional del catálogo quedan como entrada de la Fase 1.

### Fase 1 — Núcleo central de autorización backend

Objetivo: crear el motor común sin migrar todavía todos los módulos.

Tareas:

- [x] Crear `backend/src/security/authorization/`.
- [x] Centralizar normalización de roles y aliases.
- [x] Implementar `collectUserRoles()` reutilizable.
- [x] Implementar `hasPermission()` y `requirePermission()`.
- [x] Implementar `requireModule()` independiente de `x-app-path`.
- [ ] Implementar resolución de tenant y membresía (depende de Fase 2).
- [ ] Definir respuestas estándar `401`, `403`, `MODULE_DISABLED` y `TENANT_ACCESS_DENIED`.
- [x] Mantener `requireRole()` como adaptador de compatibilidad.
- [x] Añadir logging de decisiones denegadas sin exponer tokens ni secretos.

Archivos candidatos:

- `backend/src/middlewares/roles.js`
- `backend/src/middlewares/auth.js`
- `backend/src/middlewares/moduleAccess.js`
- nuevo directorio `backend/src/security/authorization/`

Avance: el piloto `module-access` autoriza por permiso canónico y el middleware `requireModule()` permite validar el entitlement sin depender de `x-app-path`. Tenant, logging de decisiones y pruebas integradas quedan pendientes antes de cerrar la fase.

Criterio de salida: un endpoint piloto autoriza por permiso, módulo y tenant sin leer listas locales.

### Fase 2 — Modelo de datos SaaS en Neon

Objetivo: agregar persistencia de tenants, roles y permisos.

Tareas:

- [ ] Diseñar tablas y constraints contra el esquema real de Neon.
- [x] Crear `tenants` y `tenant_memberships`.
- [x] Crear catálogo persistente de `modules`.
- [x] Crear `permissions` y `role_permissions`.
- [x] Crear `user_roles` con alcance por tenant.
- [x] Crear `tenant_modules` para entitlements contratados.
- [ ] Definir relación de compatibilidad con `user_module_access`.
- [x] Agregar índices para membresías, entitlements, roles y permisos.
- [ ] Definir estrategia de tenant inicial para los 38 usuarios actuales.
- [x] Ejecutar migración solo después de revisión y autorización.
- [x] Validar rollback transaccional y consistencia de estructura; backfill pendiente.

Restricciones:

- no eliminar `users.role` en esta fase;
- no hacer `UPDATE` masivo sin snapshot y validación;
- no convertir `user_module_access` a otra semántica sin compatibilidad temporal.

Criterio de salida: todos los usuarios actuales tienen una membresía de tenant válida y el tenant actual tiene módulos definidos. El schema ya está aplicado; el backfill queda pendiente de decisiones funcionales.

### Fase 3 — Catálogo único de módulos y manifiesto de sesión

Objetivo: eliminar la duplicación entre backend y frontend.

Tareas:

- [ ] Convertir el catálogo backend en fuente única.
- [ ] Asociar cada módulo con sus permisos y rutas API/frontend.
- [ ] Exponer un manifiesto de autorización en `/auth/me` o endpoint equivalente existente.
- [ ] Incluir `tenant`, `roles`, `permissions`, `modules` y versión del manifiesto.
- [ ] Hacer que frontend deje de mantener `MODULE_PATH_PREFIXES` como catálogo independiente.
- [ ] Mantener `x-app-path` solo como observabilidad, nunca como autoridad.
- [ ] Resolver el módulo desde la ruta API o desde el permiso requerido.
- [ ] Definir invalidación de caché al cambiar roles, permisos o entitlements.

Criterio de salida: frontend y backend consumen el mismo catálogo y una llamada API directa puede resolver su módulo sin header especial.

### Fase 4 — Migración de administración y módulos de alto riesgo

Objetivo: cerrar primero los huecos de seguridad más sensibles.

Orden:

1. `users`, `module-access` y administración.
2. `signature-workflows` y `signature`.
3. `permisos` y `vacaciones`.
4. `audit-prep`, `auditoria`, `files` y `documents`.
5. `work-management`.
6. `operaciones`, `logistica` y `tecnico`.

Para cada módulo:

- [ ] Crear su matriz de permisos.
- [ ] Proteger cada endpoint sensible con `requirePermission()`.
- [ ] Mantener las reglas de ownership en service/policy.
- [ ] Reemplazar comparaciones directas de `user.role`.
- [ ] Unificar imports del middleware.
- [ ] Añadir pruebas de permitido/denegado.
- [ ] Validar que los endpoints públicos sigan siendo públicos únicamente cuando corresponda.

Criterio de salida: no existen endpoints sensibles protegidos solo por frontend o solo por JWT.

### Fase 5 — Migración de procesos comerciales

Objetivo: aplicar el modelo a los módulos con mayor complejidad de roles y workflow.

Módulos:

- `crm-fam`;
- `opportunities`/FamSheets;
- `business-case`;
- `private-purchases`;
- `equipment-purchases`;
- `delivery-requests`;
- `public-delivery-plans`;
- `schedules`;
- `clients`;
- `collab-deliveries`.

Tareas:

- [ ] Convertir sets locales como `crmAll`, `managerRoles`, `businessCaseRoles` y equivalentes en políticas centralizadas.
- [ ] Separar lectura, escritura, aprobación, publicación y administración.
- [ ] Formalizar ownership, visibilidad de equipo y acceso gerencial.
- [ ] Mantener `extra_roles` como grants puntuales auditables y con fecha de expiración futura.
- [ ] Validar permisos por estado del workflow.
- [ ] Revisar endpoints alias y rutas legacy.

Criterio de salida: el mismo permiso produce la misma decisión aunque el request llegue desde otro frontend o cliente API.

### Fase 6 — Migración del frontend

Objetivo: sustituir listas de roles y lógica dispersa por permisos del manifiesto.

Tareas:

- [ ] Extender `ProtectedRoute` para aceptar `permission`, `module` y condiciones.
- [ ] Mantener `allowedRoles` temporalmente como compatibilidad.
- [ ] Crear hooks `useCan()` y `useModuleAccess()`.
- [ ] Migrar navegación para usar módulos habilitados y permisos.
- [ ] Migrar botones de crear, editar, aprobar, eliminar y exportar.
- [ ] Proteger rutas actualmente abiertas dentro de `DashboardLayout`.
- [ ] Añadir estados loading, error, sin permiso y módulo deshabilitado.
- [ ] Eliminar comparaciones directas como `role === ...` cuando expresen autorización.
- [ ] Mantener comparaciones de rol solo cuando sean presentación o routing legacy justificado.

Criterio de salida: el frontend no contiene una política de seguridad que no exista en backend.

### Fase 7 — Migración de Calidad, Talento, Inventario y módulos restantes

Objetivo: completar la cobertura funcional.

Tareas:

- [ ] Migrar los 17 submódulos de Calidad.
- [ ] Migrar Talento Humano, colaboradores, solicitudes y reportes.
- [ ] Migrar inventario, activos, mantenimientos y viáticos.
- [ ] Migrar notificaciones, capacitaciones, links y módulos transversales.
- [ ] Revisar módulos sin `CONTEXT.md` o con documentación desactualizada.
- [ ] Cerrar rutas no registradas o rutas frontend sin backend equivalente.

Criterio de salida: toda ruta privada del inventario tiene una política documentada y testeada.

### Fase 8 — Desactivación controlada de legacy

Objetivo: retirar duplicación sin romper producción.

Tareas:

- [ ] Medir uso de `requireRole` y listas locales.
- [ ] Activar métricas de decisiones legacy.
- [ ] Migrar `operaciones`, `logistica` y `tecnico` al middleware central.
- [ ] Retirar middleware legacy después de una ventana de observación.
- [ ] Convertir `requireRole()` en wrapper del motor de permisos.
- [ ] Retirar catálogos frontend duplicados.
- [ ] Retirar aliases solo con evidencia de uso cero y plan de rollback.
- [ ] Mantener documentación de compatibilidad histórica.

Criterio de salida: una sola ruta de decisión para autenticación, módulo, permiso y tenant.

### Fase 9 — Multi-tenant operativo

Objetivo: habilitar SaaS real sin mezcla de datos entre clientes.

Tareas:

- [ ] Incorporar `tenant_id` a usuarios, membresías y entidades compartidas donde aplique.
- [ ] Definir tenant por dominio, organización o invitación.
- [ ] Aplicar tenant scope a cada repository/query.
- [ ] Revisar tablas CRM, compras, documentos, firmas, solicitudes y auditoría.
- [ ] Implementar selección de tenant solo para usuarios autorizados a operar múltiples tenants.
- [ ] Añadir pruebas de aislamiento entre tenants.
- [ ] Definir planes SaaS y entitlements por tenant.
- [ ] Implementar límites por plan si el producto lo requiere.

Criterio de salida: un usuario de Tenant A no puede leer, modificar, exportar ni inferir datos de Tenant B.

### Fase 10 — Auditoría, operación y gobierno

Objetivo: hacer sostenible el modelo.

Tareas:

- [ ] Auditar cambios de roles, permisos, módulos y tenants.
- [ ] Registrar actor, tenant, recurso, acción, resultado y motivo.
- [ ] Crear dashboard de denegaciones y permisos no usados.
- [ ] Definir revisión periódica de grants puntuales.
- [ ] Añadir expiración para accesos temporales.
- [ ] Crear procedimiento de alta, baja y cambio de rol.
- [ ] Documentar aprobación funcional para permisos sensibles.
- [ ] Añadir alertas para cambios masivos y escalamiento de privilegios.

Criterio de salida: toda modificación de acceso puede reconstruirse mediante auditoría.

## 6. Matriz mínima de pruebas

Para cada endpoint privado:

- [ ] sin token → `401`;
- [ ] token inválido → `401`;
- [ ] usuario inactivo o expirado → denegado;
- [ ] usuario de otro tenant → `403`;
- [ ] módulo deshabilitado → `403 MODULE_DISABLED`;
- [ ] rol sin permiso → `403`;
- [ ] usuario con `extra_roles` válido → permitido solo donde corresponda;
- [ ] owner → permitido según política;
- [ ] manager → permitido según alcance;
- [ ] administrador → permitido según política explícita;
- [ ] usuario externo/pasante → solo entitlements y permisos asignados;
- [ ] transición de estado no permitida → `403`;
- [ ] frontend y API directa producen la misma decisión.

## 7. Definition of Done global

- [ ] No existen endpoints sensibles protegidos únicamente por frontend.
- [ ] No existen permisos críticos definidos solo dentro de un componente.
- [ ] El backend usa un motor común de autorización.
- [ ] Los módulos se habilitan por tenant y no solo por usuario.
- [ ] Los roles agrupan permisos canónicos.
- [ ] Ownership, área y workflow son políticas separadas.
- [ ] El frontend consume el manifiesto backend.
- [ ] El catálogo de módulos no está duplicado.
- [ ] Las decisiones de acceso están auditadas.
- [ ] Hay pruebas automatizadas de aislamiento, denegación y escalamiento.
- [ ] Se conserva compatibilidad durante la migración y existe rollback por fase.

## 8. Orden recomendado de trabajo posterior

1. Ejecutar Fase 0 y aprobar la matriz.
2. Implementar Fase 1 sin cambiar todavía el comportamiento productivo.
3. Diseñar y revisar Fase 2 con Neon.
4. Implementar Fase 3 y publicar el manifiesto.
5. Migrar Fase 4 por módulos de alto riesgo.
6. Continuar Fases 5, 6 y 7 por lotes funcionales.
7. Ejecutar Fase 8 solo después de métricas y periodo de observación.
8. Implementar Fases 9 y 10 como preparación formal de operación SaaS.

## 9. Riesgos que deben controlarse

- Migrar roles directamente a permisos puede revocar accesos válidos; usar modo dual.
- `extra_roles` puede convertirse en escalamiento permanente si no tiene auditoría y expiración.
- `user_module_access` actualmente tiene excepciones por usuario y no representa permisos por acción.
- La ruta basada en `x-app-path` no debe seguir siendo la autoridad de autorización.
- Las listas locales de módulos pueden quedar desincronizadas durante la transición.
- Las tablas de negocio aún requieren auditoría específica para aislamiento por tenant.
- Los módulos con services muy grandes (`permisos`, compras, Business Case) deben migrarse por endpoint o capability, no mediante refactor masivo.

## 10. Estado de seguimiento

| Fase | Estado | Responsable | Evidencia de cierre |
|---|---|---|---|
| 0. Preparación | Documentada; aprobación pendiente | Por definir | `rbac-phase-0-baseline.md` + verificación de fases |
| 1. Núcleo backend | Parcial | Por definir | Piloto y pruebas; tenant depende de Fase 2 |
| 2. Modelo Neon SaaS | Schema aplicado; backfill pendiente | Por definir | `rbac-phase-2-schema-design.md` + Neon verificado |
| 3. Catálogo/manifiesto | Pendiente | Por definir | Frontend/backend sincronizados |
| 4. Alto riesgo | Pendiente | Por definir | Endpoints sensibles cubiertos |
| 5. Comercial | Pendiente | Por definir | Workflows migrados |
| 6. Frontend | Pendiente | Por definir | Rutas y acciones por permisos |
| 7. Módulos restantes | Pendiente | Por definir | Cobertura completa |
| 8. Retiro legacy | Pendiente | Por definir | Legacy sin uso crítico |
| 9. Multi-tenant | Pendiente | Por definir | Aislamiento validado |
| 10. Gobierno | Pendiente | Por definir | Auditoría operativa |
-
## Avance ejecutado de Fase 3

- `/auth/me` ahora publica de forma aditiva `module_catalog`, `permissions` y `authorization_manifest_version`.
- El frontend usa el catalogo del backend para resolver rutas cuando la sesion ya lo recibio; conserva `MODULE_PATH_PREFIXES` como fallback temporal para sesiones antiguas.
- Tenant, roles persistidos, entitlements y permisos completos siguen pendientes del backfill funcional de Fase 2.
