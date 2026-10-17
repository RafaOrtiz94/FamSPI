# Informe del catalogo central (Fase 3)

Generado el 2026-10-08 por `backend/scripts/rbac/seed_rbac_catalog.js` (aplicado en la base local de staging). No editar a mano.

Todo sale de las guardas vigentes y de los datos de usuarios. Los nombres de permiso son provisionales y requieren aprobacion de cada responsable de area.

## Catalogo calculado

- Modulos: 63
- Roles globales: 62 (3 aparecen solo por `extra_roles`)
- Permisos: 514, de ellos 125 con modulo unico y 389 sin modulo (transversales o con varios modulos)
- Relaciones rol-permiso: 7107
- Endpoints mapeados a un permiso: 1075
- Asignaciones heredadas de usuarios: 71 (56 por rol, 11 por scope, 4 por extra_roles)

Filas en la base tras aplicar:

- `modules`: 63
- `roles`: 75
- `permissions`: 514
- `role_permissions`: 7122
- `rbac_endpoint_permissions`: 1075
- `user_role_assignments`: 110

## Permisos con mas de un conjunto de roles (50)

Un mismo nombre agrupa endpoints con roles distintos; se separaron con `-v2`, `-v3`. El responsable decide si son realmente permisos distintos o una inconsistencia a corregir.

- `bc-availability.root.create`: 2 variantes
- `business-case.observability.read`: 2 variantes
- `business-case.root.create`: 11 variantes
- `business-case.root.delete`: 3 variantes
- `business-case.root.read`: 6 variantes
- `business-case.root.update`: 3 variantes
- `calidad.buenas-practicas.create`: 2 variantes
- `calidad.buenas-practicas.read`: 2 variantes
- `calidad.buenas-practicas.update`: 2 variantes
- `calidad.cleaning.create`: 2 variantes
- `calidad.comunicaciones.create`: 2 variantes
- `calidad.comunicaciones.read`: 2 variantes
- `calidad.documentos.update`: 2 variantes
- `clients.root.create`: 2 variantes
- `collab-deliveries.sessions.create`: 2 variantes
- `collaborators.documents.read`: 2 variantes
- `collaborators.root.create`: 2 variantes
- `consumable-files.orders.create`: 3 variantes
- `consumable-files.root.create`: 2 variantes
- `crm-fam.accounts.create`: 2 variantes
- `crm-fam.blue-sheets.create`: 2 variantes
- `crm-fam.dashboard.read`: 2 variantes
- `delivery-requests.root.create`: 4 variantes
- `determinations-catalog.root.create`: 2 variantes
- `equipment-catalog.root.create`: 2 variantes
- `equipment-catalog.root.update`: 2 variantes
- `equipment-purchases.root.create`: 7 variantes
- `equipment-purchases.root.read`: 2 variantes
- `equipment-purchases.root.update`: 7 variantes
- `inventario.equipos-unidad.create`: 2 variantes
- `mantenimientos.preventive.create`: 2 variantes
- `mantenimientos.root.create`: 3 variantes
- `personnel-requests.root.create`: 2 variantes
- `private-purchases.root.create`: 11 variantes
- `private-purchases.root.read`: 2 variantes
- `private-purchases.root.update`: 5 variantes
- `requests.new-client.read`: 2 variantes
- `requests.new-client.update`: 2 variantes
- `requests.root.create`: 4 variantes
- `schedules.root.create`: 2 variantes
- `ti-assets.corporate-numbers.create`: 2 variantes
- `ti-assets.root.create`: 2 variantes
- `ti-assets.root.read`: 3 variantes
- `users.root.read`: 2 variantes
- `viaticos.config.read`: 2 variantes
- `viaticos.invoices.update`: 3 variantes
- `viaticos.reports.read`: 2 variantes
- `viaticos.review.read`: 2 variantes
- `viaticos.root.read`: 3 variantes
- `viaticos.root.update`: 3 variantes

## Usuarios no convertidos (5)

No se convierten automaticamente (restriccion de la Fase 3). Sin asignacion central quedan sin roles, que es lo mismo que hoy: ninguna guarda los reconoce.

- role: null: 2 usuario(s), 0 activo(s)
- role: pending: 3 usuario(s), 0 activo(s)
