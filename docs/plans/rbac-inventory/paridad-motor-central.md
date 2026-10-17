# Paridad del motor central con las guardas reales

Generado el 2026-10-08 por `backend/scripts/rbac/verify_central_parity.js` contra la base local de staging. No editar a mano.

Ejecuta las funciones `requireRole` reales de cada ruta y las compara con la decision del motor central leida desde la base.

| Medida | Valor |
|---|---|
| Endpoints con guarda de rol | 1075 |
| Usuarios de prueba (roles del catalogo, extra_roles, invalidos, administrador) | 68 |
| Comparaciones | 74175 |
| Endpoints sin permiso asignado | 0 |
| **Diferencias de decision** | **0** |
| Comparaciones con el enforcement central activo en todas las areas | 74175 |
| **Diferencias con el enforcement activo** | **0** |
| Usuarios de la base revisados | 61 |
| **Diferencias en asignaciones de roles** | **0** |
