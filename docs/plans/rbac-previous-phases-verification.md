# Verificación de fases anteriores

Fecha: 2026-09-03

## Resultado

Las Fases 0 y 1 fueron revisadas contra sus criterios y evidencia real. No se autoriza pasar a la Fase 2 como ejecución de migración hasta cerrar los pendientes funcionales indicados abajo.

## Fase 0 — Preparación

Estado: `técnicamente documentada / aprobación funcional pendiente`

### Completado

- [x] Línea base de backend y frontend.
- [x] Identificación de módulos con riesgo.
- [x] Identificación de rutas públicas y legacy.
- [x] Verificación de Neon.
- [x] Creación del contexto de `module-access`.
- [x] Registro de roles y aliases observados.

### Pendientes que no deben ocultarse

- [ ] Matriz endpoint-por-endpoint con recurso, acción, ownership y permiso esperado.
- [ ] Responsables funcionales por módulo.
- [ ] Aprobación del catálogo de permisos sensibles.
- [ ] Decisión sobre CRM-Fam vs Opportunities/FamSheets.
- [ ] Política de `extra_roles`, incluyendo expiración y auditoría.
- [ ] Definición del tenant inicial.

Estos puntos son decisiones de producto y seguridad. El código no debe inventarlos.

## Fase 1 — Núcleo backend

Estado: `parcialmente completada / dependiente de Fase 2`

### Completado

- [x] Núcleo `backend/src/security/authorization/`.
- [x] Normalización reutilizable de roles.
- [x] `hasPermission()`.
- [x] `requirePermission()`.
- [x] `requireModule()` con clave explícita, sin depender de `x-app-path`.
- [x] Adaptador de compatibilidad mediante `requireRole()` existente.
- [x] Respuestas piloto de autenticación, permisos y módulo.
- [x] Logging seguro de denegaciones.
- [x] Piloto en `module-access`.
- [x] Pruebas unitarias del núcleo y middleware.

### Pendientes legítimos

- [ ] Resolver tenant y membresía: requiere tablas de Fase 2.
- [ ] Implementar `TENANT_ACCESS_DENIED`: requiere contexto de tenant.
- [ ] Ampliar el catálogo piloto de permisos después de aprobar la matriz de Fase 0.
- [ ] Añadir pruebas de integración con rutas Express reales.
- [ ] Añadir auditoría persistente de decisiones después de validar la estrategia de auditoría.

## Validación ejecutada

```text
ESLint: correcto en archivos afectados
Jest: 12 pruebas exitosas
```

## Decisión de avance

La Fase 2 puede iniciar únicamente como diseño y consulta de schema en Neon. No se deben ejecutar `CREATE`, `ALTER`, `UPDATE`, `DELETE` ni backfills hasta que estén aprobados:

1. tenant inicial;
2. catálogo de permisos;
3. política de `extra_roles`;
4. responsables funcionales;
5. estrategia de compatibilidad con `user_module_access`.

