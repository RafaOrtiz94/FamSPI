---
name: modulo-compras-comercial
description: Mapa legacy→producción del módulo de Compras (equipos públicos y privados) tocado por los roles comerciales. Úsalo ANTES de tocar cualquier archivo de compras — varias páginas viejas de comercial/backoffice/operaciones/logística siguen en el repo pero ya NO se renderizan, solo redirigen al workspace unificado. Evita perder tiempo editando UI muerta pensando que afecta lo que el usuario ve.
---

# Skill: Compras (público/privado) — legacy vs. producción

El flujo de Compras tocado por comercial/ACP/backoffice/operaciones/logística/técnico es un caso EXPLÍCITO de migración a medias: el backend nunca cambió, pero el frontend sí — varias rutas antiguas quedaron como simples redirects, y las páginas que servían quedaron huérfanas en el repo (compilan, pero nadie navega a ellas).

**Regla de oro: si vas a tocar UI de compras, el archivo real es casi seguro `spi_front/src/modules/shared/purchases-workspace/`, no algo en `modules/comercial/pages/`.** Verifica con grep en `AppRoutes.jsx` antes de asumir qué renderiza una ruta.

---

## El mapa completo (verificado contra `spi_front/src/routes/AppRoutes.jsx`)

| Ruta URL | Qué renderiza HOY | Estado |
|---|---|---|
| `/dashboard/comercial/equipment-purchases` | `<LegacyPublicPurchaseRedirect />` → `Navigate` a `/dashboard/purchases/workspace?tab=public...` | **LEGACY (redirect)** |
| `/dashboard/comercial/acp-compras` | `<LegacyPublicPurchaseRedirect />` → mismo destino | **LEGACY (redirect)** |
| `/dashboard/backoffice/private-purchases` | `<LegacyPrivatePurchaseRedirect />` → `Navigate` a `/dashboard/purchases/workspace?tab=private...` | **LEGACY (redirect)** |
| `/dashboard/operaciones/private-purchases` | `<LegacyPrivatePurchaseRedirect />` → mismo destino | **LEGACY (redirect)** |
| `/dashboard/logistica/private-purchases` | `<LegacyPrivatePurchaseRedirect />` → mismo destino | **LEGACY (redirect)** |
| `/dashboard/servicio-tecnico/entregas-privadas` | `<Navigate to="/dashboard/purchases/workspace?tab=private" replace />` (inline, ni siquiera usa el helper) | **LEGACY (redirect)** |
| `/dashboard/servicio-tecnico/workspace-procedimiento` | `<Navigate to="/dashboard/purchases/workspace?tab=public&subtab=tecnica" replace />` | **LEGACY (redirect)** |
| `/dashboard/purchases/workspace` | `<PurchasesWorkspace />` (real, `modules/shared/purchases-workspace/PurchasesWorkspace.jsx`) | **PRODUCCIÓN** |

Los dos redirects se generan con un factory en `AppRoutes.jsx` (~línea 185):

```js
const makeLegacyPurchaseRedirect = (purchaseType, legacyIdParam) => () => {
  // traduce el id legacy (requestId / purchaseId) a requestId+requestType
  // para que un link viejo (ej. de una notificación) siga abriendo
  // el expediente correcto dentro del workspace, no solo la lista general
  ...
  return <Navigate to={`/dashboard/purchases/workspace?${params.toString()}`} replace />;
};
const LegacyPublicPurchaseRedirect = makeLegacyPurchaseRedirect("public", "requestId");
const LegacyPrivatePurchaseRedirect = makeLegacyPurchaseRedirect("private", "purchaseId");
```

Ojo con el detalle: preserva deep-links viejos (notificaciones con `?requestId=123`) traduciéndolos a `?tab=public&requestId=123&requestType=public`, para que abran el expediente correcto dentro del workspace en vez de solo la lista general.

---

## Código muerto que sigue en el repo (NO tocar pensando que afecta la UI real)

- `spi_front/src/modules/comercial/pages/EquipmentPurchases.jsx` — página vieja de compras públicas. **Sin importador en `AppRoutes.jsx`.** Solo se referencia a sí misma vía `EquipmentPurchaseWidget`.
- `spi_front/src/modules/comercial/pages/ACPEquipmentPurchases.jsx` — página vieja de ACP. **Sin importador en `AppRoutes.jsx`.**
- `spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx` (+ `.constants.js` / `.utils.js`) — componente compartido por las dos páginas de arriba. Solo esas dos lo importan; ninguna ruta activa lo monta.

Confirmado con grep exhaustivo: ningún archivo bajo `spi_front/src/routes/` importa `EquipmentPurchasesPage`, `ACPEquipmentPurchasesPage`, `PrivatePurchasesPage`, `OperacionesPrivatePurchases`, `LogisticaPrivatePurchases`, `TecnicoPrivatePurchases` ni `ServicioPrivatePurchaseDeliveries` — esos nombres de componente que puedas encontrar mencionados en CONTEXT.md antiguos o comentarios ya no existen como rutas montadas.

**Si un bug reportado por un usuario menciona "la página de compras del comercial" o similar, el usuario casi seguro está en `/dashboard/purchases/workspace` — no edites `EquipmentPurchases.jsx` esperando que el cambio se vea.**

---

## El workspace de producción

`spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx` — un solo workspace con tabs `public` (compras de equipo público/comodato) y `private` (compras privadas para cliente final), controlado por query params (`?tab=public|private`, `?subtab=...`, `?requestId=...&requestType=...` para deep-link a un expediente).

Estructura relevante:
- `PurchasesWorkspace.jsx` — shell, arma header, tabs, llama `listEquipmentPurchases` (`core/api/equipmentPurchasesApi.js`) y `listPrivatePurchases` (`core/api/privatePurchasesApi.js`).
- `expediente/PurchaseExpedienteDetail.jsx` — detalle de un expediente individual (público o privado).
- `expediente/tabs/` — un tab por etapa/dominio del expediente: `CommercialTab`, `PublicAcpTab`, `AvailabilityTab`, `ContractTab`, `TechnicalTab`, `EquipmentLogisticsTab`, `PrivateFlowTab` (flujo privado completo), `SupplyControlTab`, `ConsumableFilesTab`, `TrainingTab`, `ExpedienteSummaryTab`, `ExpedienteTimelineTab`, `ExpedienteAuditTab`.
- `hooks/usePurchaseExpediente.js` — hook central de datos del expediente.
- `purchaseRoleGroups.js` — grupos de rol usados dentro del workspace (separado de `ROLE_GROUPS` del backend, ver abajo).

Guard de ruta en `AppRoutes.jsx` (~línea 822-847): un solo `<ProtectedRoute>` con la lista completa de roles comerciales/técnicos/operativos que antes estaban repartidos entre las rutas legacy — si necesitas dar/quitar acceso a un rol, es AHÍ donde se edita, no en las rutas legacy (que ya no verifican rol propio, solo redirigen).

---

## Backend: NO hay módulo nuevo, es el mismo de siempre

No existe un `backend/src/modules/purchases-workspace/` ni equivalente. El workspace unificado pega **directamente** a los dos módulos backend preexistentes, sin capa nueva:

- Tab **público** → `core/api/equipmentPurchasesApi.js` → `backend/src/modules/equipment-purchases/` (rutas montadas como `equipmentPurchaseRoutes` en `backend/src/routes/registerRoutes.js`, prefijo `/api/v1/equipment-purchases`).
- Tab **privado** → `core/api/privatePurchasesApi.js` → `backend/src/modules/private-purchases/` (rutas montadas como `privatePurchasesRoutes`, prefijo `/api/v1/private-purchases`).

Ambos módulos backend están **vigentes y activos** — no hay endpoint legacy que deba dejar de usarse. La migración fue puramente de frontend: consolidar 6+ páginas por rol en un solo workspace con tabs, sin tocar la API. Cada módulo tiene su propio `CONTEXT.md` (`backend/src/modules/equipment-purchases/CONTEXT.md`, `backend/src/modules/private-purchases/CONTEXT.md`) — léelos para el detalle de endpoints, state machine y roles por endpoint antes de modificar lógica de negocio.

Tabla relevante compartida con business-case: `equipment_purchase_requests` (ver migraciones en `backend/migrations/apply-equipment-type-migration.js` y `apply-business-case-migrations.js`).

---

## Checklist antes de tocar algo en Compras

1. ¿La ruta que reportó el usuario empieza con `/dashboard/comercial/equipment-purchases`, `/dashboard/comercial/acp-compras`, `/dashboard/backoffice/private-purchases`, `/dashboard/operaciones/private-purchases`, `/dashboard/logistica/private-purchases` o `/dashboard/servicio-tecnico/entregas-privadas`? → Es un **redirect**. El usuario termina en `/dashboard/purchases/workspace`. Ve directo ahí.
2. ¿Vas a cambiar UI/comportamiento visible? → edita dentro de `spi_front/src/modules/shared/purchases-workspace/`, nunca `modules/comercial/pages/EquipmentPurchases.jsx` / `ACPEquipmentPurchases.jsx` (código muerto).
3. ¿Vas a cambiar acceso por rol a la ruta del workspace? → el guard único está en `AppRoutes.jsx` alrededor de la línea 822-847, no en las rutas legacy (ya no filtran rol, solo redirigen — aunque algunas todavía están envueltas en un `<ProtectedRoute>` heredado del árbol de rutas, ese guard es vestigial una vez que ya redirigieron).
4. ¿Vas a cambiar lógica de negocio, endpoints, validaciones o la state machine? → backend, `equipment-purchases/` (público) o `private-purchases/` (privado) — son módulos reales y vigentes, edítalos con confianza, pero lee su `CONTEXT.md` primero (`privatePurchases.service.js` tiene 211KB, es de los archivos más grandes del repo).
5. ¿Necesitas confirmar si algo sigue siendo legacy o ya se limpió? → `grep` en `spi_front/src/routes/AppRoutes.jsx` por el nombre del componente. Si no aparece como importador de una página vieja, esa página es código muerto — no confíes en `CONTEXT.md` viejos o comentarios sin re-verificar contra el router real.
