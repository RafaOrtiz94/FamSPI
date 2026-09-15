---
name: bc-workspace-tabs
description: Mapa real de dónde vive el orden de tabs, el estado (completado/pendiente/bloqueado) y la visibilidad por rol del workspace de Business Case (spi_front/src/modules/comercial/pages/BusinessCaseWorkspace.jsx y sus componentes). Úsalo antes de tocar cualquier tab/sección del BC workspace — el orden visible NO vive donde parece, y hay varios archivos que deben quedar sincronizados a mano.
---

# Skill: Tabs del workspace de Business Case — FamSPI

Antes de tocar orden, estado o visibilidad de un tab del BC, lee esto. El bug real más común en esta área: editar un solo archivo esperando que cambie la barra de tabs, cuando el orden real vive en OTRO archivo completamente separado.

---

## Los 3 lugares que deben coincidir (y casi nunca se editan juntos)

1. **`spi_front/src/modules/comercial/pages/BusinessCaseWorkspace.jsx`** — `WORKSPACE_SECTION_ORDER` (array de ids). Se usa para: navegación "siguiente sección" (`getNextSectionId`), filtrar qué secciones ve un rol (`getVisibleSectionsByRole`, que hace `availableSections.filter(...)` preservando este orden), y algunos cálculos de "primera sección incompleta". **NO controla directamente qué ve el usuario en la barra lateral de tabs.**

2. **`spi_front/src/modules/comercial/components/workspace/SectionNavigator.jsx`** — `allSections` (array de objetos `{id, title, description, icon}`, hardcodeado dentro del componente, ~línea 32). **Este es el que de verdad renderiza la barra de tabs** (desktop sticky sidebar y el modal mobile). Su orden interno es el orden real que ve el usuario, independiente de `WORKSPACE_SECTION_ORDER`.
   - Bug real (2026-09): se movió "Resumen" al final en `WORKSPACE_SECTION_ORDER` y no cambió nada en la UI — porque `allSections` en este archivo tenía su propio orden distinto, nunca tocado. Hay que editar **ambos** si el cambio debe reflejarse en la barra Y en la navegación "siguiente".
   - Bug real #2 (2026-09, mismo día): `offer_workspace` faltaba en `WORKSPACE_SECTION_ORDER` aunque sí estaba en `allSections` (tab visible/clickeable) y en `roleSectionConfig.js` (rol lo ve). Efecto: el tab se veía y funcionaba al hacer click manual, pero el auto-avance ("siguiente sección" al completar algo) y el flujo de "reabrir sección" nunca lo consideraban — `getNextSectionId` devolvía `null` en vez de saltar ahí. **Al agregar un section id nuevo, verifica que esté en las 3 listas de una vez, no solo en la que estás mirando.**
   - Antes existía una 4ª lista, `ALL_SECTIONS` en `roleSectionConfig.js`, exportada pero sin ningún importador real en el resto del código (confirmado con grep) — se eliminó en vez de mantenerla sincronizada, porque una lista "canónica" sin uso real es la misma trampa: alguien la edita creyendo que controla algo, y no pasa nada. Si ves una lista de section ids nueva en este módulo, confirma con grep quién la importa antes de asumir que es la fuente de verdad.

3. **`spi_front/src/modules/comercial/components/workspace/roleSectionConfig.js`** — listas `visible: [...]` por rol. Son **listas de permitidos (allow-list), su orden interno no importa** — `getVisibleSections()` (exportada de aquí, usada por `BusinessCaseWorkspace.jsx`) hace `availableSections.filter(s => config.visible.includes(s))`, así que el orden final sale de `availableSections` (el array que se le pase), no de este archivo. No pierdas tiempo reordenando estas listas para cambiar el orden visible — no hace nada.

**Regla práctica**: para reordenar un tab, edita el orden en `SectionNavigator.jsx#allSections` (efecto visible real) y, si también quieres que la navegación "siguiente sección" respete el nuevo orden, edita `WORKSPACE_SECTION_ORDER` en `BusinessCaseWorkspace.jsx` igual. Para agregar/quitar visibilidad por rol, edita `roleSectionConfig.js` (ahí sí importa el contenido de `visible`, solo no el orden).

---

## Estado de cada tab (completado / pendiente / bloqueado / observado)

- Fuente real: backend, `backend/src/modules/business-case/businessCase.controller.js`, objeto `ownershipRules` (~línea 3956, dentro del handler de `getUIGuidance`/`getBusinessCase` que arma la respuesta completa). Cada key es un section id, valor viene de `completionRule(completedFlag, hasDataFlag, sectionName)`.
- Si un section id **no está** en `ownershipRules`, el frontend (`SectionNavigator.jsx#getSectionStatus`) lo trata como "pending" (ícono reloj) por default — no truena, pero puede ser confuso para una sección que en realidad es de solo lectura (ver "Resumen" abajo).
- El frontend lee esto vía `uiGuidance.sectionOwnership.rules[sectionId]` (normalizado en `businessCaseApi.js#normalizeUIGuidanceResponse`).
- Prioridad de estado en `getSectionStatus`: `locked` > `observed` > `completed` > `in-progress` (si tiene `currentOwner`) > `pending`.

### Secciones de solo lectura (no deben tener tick de completado)

Patrón para una sección tipo "Resumen" (`consumption_export`) que no es un formulario y no debería mostrar completado/pendiente: agregar un caso especial explícito en `getSectionStatus()` en `SectionNavigator.jsx` que devuelva un status neutral (ver ejemplo real ya implementado, `status: "info"`) **antes** de intentar leer `rules[sectionId]`. No basta con omitir la key del lado del backend — el fallback por default ya es "pending", que tampoco es correcto para una sección de solo lectura.

---

## Cerrar/completar una sección automáticamente según el tipo de BC

Patrón real ya usado para "Inversiones adicionales" (no aplica a BC privados, ver fix 2026-09): el flag manual que un usuario dispara con un botón ("cerrar sin inversiones adicionales") persiste `modern_bc_metadata.investments.no_additional_investments = true` (ver acción cerca de la línea 2601 en `businessCase.controller.js`, sección `investments`/`investment_values_op`/`investment_values_fin` completadas en cascada). Para automatizar ese mismo cierre según una condición del BC (ej. tipo privado), la forma más simple y consistente es leer esa MISMA condición al calcular `closedWithoutInvestments` en `ownershipRules` (línea ~3885), en vez de crear un mecanismo nuevo:

```js
const closedWithoutInvestments =
  Boolean(investmentsMetadata?.no_additional_investments) || !isPublicBusinessCaseFlow;
```

Si además la sección no debe quedar editable, revisa también el flag de edición correspondiente (ej. `canEditInvestments`, línea ~3942) y agrega la misma condición ahí.

---

## Determinar si un BC es público o privado

**Siempre** usa `normalizePurchaseTypeForGate(bcPurchaseType)` / `isPublicBusinessCase(value)` (definidas en `businessCase.controller.js`, ~línea 459-469). Normaliza `bc_purchase_type`/`business_case_type` contra los valores reales que existen en producción (`public`, `comodato_publico`, `private_comodato`, `comodato_privado`, y cualquier string que empiece con `private`). Ya se usa así en más de 6 lugares distintos del controller (`assertConsumptionRolePolicyOrThrow`, `buildDeterminationsCompletionProfile`, `startDeterminationsTechWindowIfNeeded`, el cálculo de `generalComplete`, etc.) — no reinventes esta lógica con un `includes("public")` ad hoc, ya existe y está probada.

---

## Checklist antes de tocar un tab del BC workspace

1. ¿El cambio es de **orden visible**? → edita `SectionNavigator.jsx#allSections` (y `WORKSPACE_SECTION_ORDER` si afecta navegación).
2. ¿El cambio es de **visibilidad por rol**? → edita `roleSectionConfig.js` (contenido de `visible`, no orden).
3. ¿El cambio es de **estado completado/pendiente**? → backend, `ownershipRules` en `businessCase.controller.js`. Si es una condición automática (ej. por tipo de BC), reutiliza `isPublicBusinessCase`/`normalizePurchaseTypeForGate`.
4. ¿La sección es de **solo lectura** (no debería tener tick)? → caso especial en `getSectionStatus()` en `SectionNavigator.jsx`.
5. Después de editar frontend: `npx eslint <archivo>` y deploy con `spi_front/clean_deploy.ps1`. Después de editar backend: syntax-check con `node -e "require('./ruta')"`, `npx eslint <archivo>`, deploy con `scripts/deploy_backend_cloudrun.ps1`.
