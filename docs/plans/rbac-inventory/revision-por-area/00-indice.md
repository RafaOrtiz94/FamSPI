# Revisión de roles y permisos por área

Generado el 2026-10-08 por `backend/scripts/rbac/build_area_review.js`. No editar a mano: se regenera.

Cada área tiene un documento que muestra qué puede hacer hoy su equipo según las reglas escritas en el código, y deja casillas para marcar qué debería ser distinto. Lo que cada jefe responda se aplica después en el código.

| Área | Roles con usuarios | Usuarios activos | Documento |
|---|---|---|---|
| Gerencia | gerencia_general | 1 | [gerencia.md](gerencia.md) |
| Comercial | comercial, jefe_comercial, acp_comercial | 8 | [comercial.md](comercial.md) |
| Servicio Técnico | ing_servicio, jefe_servicio | 5 | [servicio-tecnico.md](servicio-tecnico.md) |
| Operaciones | operaciones, jefe_operaciones | 4 | [operaciones.md](operaciones.md) |
| Logística | logistica, jefe_logistica | 2 | [logistica.md](logistica.md) |
| Finanzas | financiero, jefe_financiero | 3 | [finanzas.md](finanzas.md) |
| Talento Humano | talento_humano | 2 | [talento-humano.md](talento-humano.md) |
| Calidad | jefe_calidad | 1 | [calidad.md](calidad.md) |
| TI | jefe_ti | 1 | [ti.md](ti.md) |
| Usuarios externos | ing_servicio_ext | 6 | [externos.md](externos.md) |
| Pasantes | pasante | 2 | [pasantes.md](pasantes.md) |

Los usuarios con rol `pending` o `null` no aparecen: se gestionan por separado.

Las cantidades de usuarios salen de la copia local de pruebas y pueden diferir de producción.