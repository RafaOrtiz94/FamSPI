# AGENTS.md — module agent: business-case

## Proposito
Gestionar cambios del flujo Business Case: state machine, permisos, readiness,
gate de determinaciones, y su integracion con private-purchases /
equipment-purchases (flujo comodato).

## Archivos nucleo (backend)
- `businessCaseStateMachine.js`
- `businessCaseStates.constants.js`
- `businessCasePermissions.js`
- `businessCaseDataOwnership.js`
- `businessCaseDeterminationsGate.service.js`
- `businessCase.service.js`
- `businessCase.controller.js` (~5700 lineas, 100+ handlers — no editar a ciegas)
- `businessCase.routes.js`
- `businessCaseStateReadiness.js`

## Eliminado (no reintroducir sin motivo nuevo)
`BusinessCaseOrchestrator.service.js` + 9 rutas `/orchestrator/*` (todas menos
`emergency-transition`, que si es real y llama al state machine moderno) se
borraron: era un flujo BC completo alternativo construido sobre el esquema
legacy `bc_master` (migracion 022), sin ningun caller real en el frontend (0
de 10 endpoints alcanzables desde la UI). `bc_master`/`bc_economic_data`
conservan 6 filas historicas (no borradas, ver `insertEquipmentPurchaseRequestFromBcMaster`
en `businessCase.service.js`); las tablas satelite del orquestador
(`bc_operational_data`, `bc_lis_data`, `bc_validations`) estaban vacias.

## Puntos de integracion (fuera del modulo, pero acoplados)
- `backend/src/modules/private-purchases/privatePurchases.service.js` —
  `ensureBusinessCaseForComodato` / `startBusinessCaseForComodato`. Usa columna
  `business_case_id` en `private_purchase_requests`.
- `backend/src/modules/equipment-purchases/equipmentPurchases.service.js` —
  `ensureAutoBusinessCaseForPurchase`. Unificado a columna `business_case_id`
  en `equipment_purchase_requests` (antes usaba `extra.auto_business_case_id`,
  JSON; se unifico porque las 2 convenciones apuntaban al mismo concepto y no
  habia datos en produccion usando el camino JSON — 0 de 12 filas). No
  reintroducir el campo JSON.
- `spi_front/src/modules/comercial/components/workspace/roleSectionConfig.js` —
  copia paralela en frontend de quien ve/edita cada seccion por rol.

## Bug corregido (unificacion business_case_id)
`businessCase.controller.js` (`pauseLinkedExpedients` / `unpauseLinkedExpedients`
/ `cancelLinkedExpedients`, BC-17) apuntaba a una tabla `equipment_purchases`
que no existe (la tabla real es `equipment_purchase_requests`) y filtraba por
`extra->>'auto_business_case_id'`. Las 3 queries fallaban en runtime (atrapadas
en try/catch, solo logueaban warning) — el flujo de pausa/cancelacion de
expedientes publicos por apelacion de factibilidad nunca funciono. Corregido:
tabla y columna (`business_case_id`) reales.

## Bug corregido (secciones "lab"/"requirement" siempre bloqueadas)
`assertSectionEditable` (helper interno de `businessCase.controller.js`) recibia
los strings `"lab"` y `"requirement"` desde `saveLabEnvironment`/`saveRequirements`/
`saveDeliveries`, pero `SECTIONS` en `businessCasePermissions.js` usa
`"lab_environment"` y no tiene ninguna clave `"requirement"`. Como
`canEdit()` devuelve `false` para cualquier seccion que no matchee, **nadie
podia guardar Lab Environment ni Requirements/Deliveries, para ningun rol, en
ningun estado** — 403 siempre. Corregido con `PERMISSION_SECTION_ALIASES`
(no confundir con `SECTION_ALIASES` de la linea 139, que es un namespace
distinto para bloqueo/ownership): `lab -> lab_environment`, `requirement ->
general` (verificado contra `roleSectionConfig.js`: "requirement" siempre
aparece junto con "general" en `canEdit`, nunca uno sin el otro).
Adicionalmente, `selectEquipment` (paso 2 del flujo, seleccionar equipo del
catalogo) no llamaba `assertSectionEditable` en absoluto — cualquier rol de
`businessCaseRoles` (incluyendo jefe_ti/jefe_financiero/esp_app, que deberian
ser de solo lectura ahi) podia cambiar el equipo en cualquier estado. Se
agrego el chequeo.

## Bug corregido (jefe_servicio no podia editar determinaciones/reactivos)
`businessCaseDeterminationsGate.service.js` (`getRoleConfig`) tenia
`technicalEditors: ["tecnico", "jefe_tecnico"]` — lista vieja nunca
actualizada cuando se renombraron los roles tecnicos (`jefe_servicio`
reemplaza a `jefe_tecnico`, `ing_servicio` reemplaza a `tecnico`, ver
comentarios en `businessCase.routes.js`). Resultado: `jefe_servicio` recibia
403 (`DETERMINATIONS_ROLE_NOT_ALLOWED`) al intentar cargar
calibradores/controles/materiales por reactivo en fase `technical_review` —
su tarea principal en el modulo. Corregido a
`["jefe_tecnico", "jefe_servicio"]`.

En el mismo hallazgo: `businessCasePermissions.js` mapeaba `ing_servicio` y
`esp_app` a `jefe_tecnico` (edicion completa), contradiciendo los comentarios
de `routes.js` que los documentan como "solo visualizacion en BC". Se les dio
fila propia en `PERMISSION_MATRIX` (identica a `JEFE_TI`: solo `investments`
accesible). Confirmado con el usuario: jefe_servicio edita todo lo tecnico,
ing_servicio/esp_app son de solo lectura.

## Bug corregido (asesor_comercial/analista_comercial no podian subir el documento estadistico)
`businessCaseDeterminationsGate.service.js` comparaba el rol crudo contra
`Set`s literales (`DETERMINATIONS_ALLOWED_UPLOAD_ROLES`, `_DOCUMENT_VIEW_ROLES`,
`_INSPECTION_REQUEST_ROLES`) que solo tenian `"comercial"`/`"jefe_comercial"`,
sin sus alias `asesor_comercial`/`analista_comercial`/`jefe_de_comercial`
(documentados en todo el modulo como "mismo nivel", BC-02). Resultado:
asesor_comercial/analista_comercial recibian 403 al intentar subir el
documento estadistico, bloqueando el paso 4 del flujo para ellos. Corregido
reusando el mismo mapa canonico de `businessCasePermissions.js` en vez de
duplicar alias: se agrego `BusinessCasePermissions.normalizeRole(role)`
(expone `ROLE_CANONICAL_MAP`) y `isUploadRole`/`buildGateInfo` normalizan el
rol antes de comparar contra los Sets. Si se agregan mas alias de rol a
`ROLE_CANONICAL_MAP`, este archivo los hereda automaticamente sin tocarlo.
Confirmado con el usuario: el rol base `comercial` (y sus alias) NO debe
editar cantidades de determinaciones en fase `commercial_input` (solo
jefe_comercial/jefe_de_comercial/acp_comercial editan ahi) — eso quedo igual,
a proposito.

## Bug corregido (acp_comercial no podia registrar reactivos en compra publica)
`businessCasePermissions.js`: `acp_comercial` tenia `DETERMINATIONS: false` en
**todos** los estados. `jefe_comercial` y `backoffice_comercial` (su
equivalente en compra privada) ya tenian `true` en
`DATOS_BASE_COMPLETOS`/`EN_EVALUACION_VIABILIDAD`/`OBSERVADO_POR_VIABILIDAD`.
Las otras 2 capas (`determinationsGateService.commercialEditors` para compra
publica, y `DETERMINATIONS_REACTIVO_PUBLIC_ROLES` en `businessCase.controller.js`)
YA esperaban correctamente a `acp_comercial` como editor de reactivos en
compra publica — solo esta matriz nunca se actualizo, bloqueando con 403
antes de siquiera llegar a esas 2 capas correctas. Corregido: `acp_comercial`
ahora replica exactamente el patron de `jefe_comercial`/`backoffice_comercial`
(true solo en esos 3 estados). Verificado programaticamente que las 9
`STATES` dan el mismo resultado para los 3 roles.

## BUG CRITICO corregido (require roto de BusinessCaseStateMachine)
`businessCase.controller.js:24` hacia
`const BusinessCaseStateMachine = require("./businessCaseStateMachine")` sin
destructurar, pero ese modulo exporta `{ BusinessCaseStateMachine, STATES }`
(un objeto que contiene la clase, no la clase misma). Resultado: **toda
llamada a `BusinessCaseStateMachine.getCurrentState/.transition/.emergencyTransition`
en este controller lanzaba `TypeError: ... is not a function`** —
`assertSectionEditable` (usado por `update`/`saveLabEnvironment`/
`saveEquipmentDetails(V2)`/`saveLisIntegration`/`saveRequirements`/
`saveDeliveries`/`selectEquipment`) y las transiciones de estado normal y de
emergencia estaban rotas para TODO guardado de seccion. Detectado en vivo por
el usuario durante pruebas E2E (`{"ok":false,"message":"BusinessCaseStateMachine.getCurrentState
is not a function"}` al guardar datos comerciales/operativos). Corregido a
`const { BusinessCaseStateMachine } = require("./businessCaseStateMachine")`.
Este es probablemente el bug de mayor impacto real encontrado en toda la
revision del modulo — verificar que no se reintroduzca (es el unico require
de este archivo en el modulo, `grep require.*businessCaseStateMachine`).

## BUG CRITICO corregido (dos tablas de equipos desincronizadas)
El sistema tiene **dos catalogos de equipos paralelos y desincronizados**:
- `servicio.equipos` (PK `id_equipo`): la tabla REAL. Tiene FK verificados
  desde `bc_equipment_selection.equipment_id`, `catalog_determinations.equipment_id`,
  `catalog_equipment_consumables.equipment_id` y `equipment_price_history.equipment_id`.
  El picker de equipos (`equipmentCatalog.controller.js` → `v_equipment_full_catalog`)
  lee de aqui. Tiene datos reales: formulas de calculo, capacidades, precios.
- `public.equipment_models` (PK `id`): tabla huerfana, sin ningun FK real
  apuntandole. Mismos 30 equipos (mismo `code`) pero con una secuencia de ID
  totalmente distinta (ids ~104+ vs ~1-30 en `servicio.equipos`). 0 filas con
  `default_calculation_formula` poblado. Parece un intento de migracion que
  nunca se completo (el admin CRUD de `equipmentCatalog.controller.js`
  `create`/`update`/`updateFormula` SI escribe aqui, pero nada operativo lo lee).

Como los IDs de ambas tablas colisionan numericamente para equipos distintos
(id=8 en `servicio.equipos` es "cobas 4000 c311"; en `equipment_models` ese id
no existe o es otra cosa), cualquier funcion que reciba un `equipment_id` real
(originado en `bc_equipment_selection`/`extra.equipment_details`) y lo busque
en `equipment_models` falla silenciosamente (0 filas, name null, formula null).
Sintoma reportado por el usuario: al generar la hoja de Sheets, la pestana del
equipo salio vacia/ausente (log real: `[SheetGen] buildSheetPayloads: no
equipment records provided`) porque `getEquipmentCatalogMapByIds` consultaba
`equipment_models`.

Corregido (5 funciones, todas cambiadas a `servicio.equipos`/`v_equipment_full_catalog`):
1. `calculationEngine.service.js` — lookup de `default_calculation_formula` (ROI/consumo).
2. `businessCaseCalculator.service.js` — lookup de `capacity_per_hour`/`max_daily_capacity`
   (antes lanzaba `Equipo X no encontrado` para toda BC real).
3. `equipmentSelection.service.js` (`getSelectedEquipment`) — join roto.
4. `businessCase.controller.js` (`saveEquipmentDetailsV2`) — resolucion de
   `primary_name`/`backup_name` (por eso quedaban en `null` en `extra.equipment_details`).
5. `businessCaseSheetGeneration.service.js` (`getEquipmentCatalogMapByIds`,
   `getEquipmentNamesMapByIds`) — matching de equipo para la pestana de Sheets.

**Pendiente, NO corregido (requiere decision aparte):** `equipmentCompatibility.service.js`
(motor de compatibilidad primary/backup, `getCompatibleBackupCandidates`/
`validateEquipmentCompatibility`/`getCompatibilityStatistics`) consulta
`equipment_models` con columnas que NO EXISTEN en `servicio.equipos`
(`compatibility_group`, `compatibility_rules`, `backup_priority`,
`redundancy_type`, `lease_price`, `maintenance_cost_monthly`,
`parent_equipment_id`) y referencia una tabla `equipment_compatibility_matrix`
**que no existe en la base de datos**. Este subsistema completo esta muerto
desde el origen (nunca se termino de desplegar) — no es un simple cambio de
tabla como los 5 anteriores, requiere decidir si se completa la migracion
(crear la tabla + poblar columnas) o se elimina como se hizo con
`BusinessCaseOrchestrator.service.js`.

## Plantilla de Sheets: copia de Sheet maestro, no upload de .xlsx
`businessCaseSheetSyncLocal.service.js` (`createSpreadsheetFromTemplate`)
generaba cada spreadsheet SUBIENDO el `.xlsx` local (`Mapeador_Sheets/FORMATO_BC.xlsx`)
via `drive.files.create` con conversion automatica a Google Sheets — esa
conversion no preserva 100% del diseño (bordes/colores/anchos de columna se
podian perder), motivo del reporte de usuario "perdio el formato". Corregido:
ahora se copia (`drive.files.copy`) un Google Sheet maestro real
(`TEMPLATE_SPREADSHEET_ID`, default `1hKrjRq8cT3yVwlLHyKo-CTxZx_qO3uqKqLyI759-mRk`,
override via env `BC_SHEET_TEMPLATE_SPREADSHEET_ID`), lo cual preserva el
formato al 100% (copia nativa, no conversion). El `.xlsx` local se sigue
usando SOLO para `loadTemplateDefinition()` (estructura: nombres de pestañas,
filas, aliases) — no para crear el archivo real del usuario. Verificado con
credenciales reales: el copy funciona end-to-end.

## Sincronizacion inversa Sheet -> SPI (cantidades anuales)
Ya existia `pullMaximumQuantitiesFromGoogleSheet` (columna "PRODUCTO A ENTREGAR"
-> `bc_dispatch_items.planned_qty`, automatico al cargar el dispatch workspace).
Se agrego el equivalente para la columna "Cantidad Anual" ->
`bc_consumption_items.annual_qty` (reactivos/calibradores/controles/materiales):
`pullAnnualQuantitiesFromGoogleSheet` (businessCaseSheetSyncLocal.service.js,
refactorizado junto con el pull existente en una funcion generica
`pullColumnQuantitiesFromGoogleSheet` parametrizada por columna) +
`syncConsumptionQuantitiesFromSheet` (businessCase.service.js) + endpoint
`POST /:id/consumption-items/sync-from-sheet` + boton "Sincronizar cantidades
desde Sheet" en `DeterminationsSection.jsx`. A diferencia del pull de
dispatch (automatico en cada carga), este es SOLO manual — una edicion en SPI
no debe perderse silenciosamente si el usuario no pide sincronizar
explicitamente. No hay resolucion de conflicto por columna "quien gana"
(a diferencia de `bc_dispatch_items.commercial_updated_at`); el pull de
anual_qty simplemente sobrescribe con el valor del Sheet cuando el usuario
lo dispara, ya que es una accion intencional.

**Bug relacionado corregido:** `resolveBusinessCaseSheetId` (usado por el pull
de dispatch) consultaba una columna `bc_spreadsheet_id` que NO EXISTE en
`equipment_purchase_requests` — la query fallaba siempre (atrapada en
try/catch en el caller), asi que el pull de "PRODUCTO A ENTREGAR" nunca se
ejecutaba en la practica. El `sheet_id` real vive solo en
`modern_bc_metadata.bc_sheet_generation.last.sheet_id`.

## Los 3 sistemas de control de acceso (deben quedar coherentes entre si)
Este modulo tiene tres capas de permisos independientes que no se referencian
entre si. Un cambio de reglas de rol/seccion casi siempre requiere tocar los
4 lugares siguientes o el modulo queda desalineado (fuente de los bugs
BUG-04/06/07 ya parcheados en el codigo):
1. `businessCasePermissions.js` — matriz estado x rol x seccion (bloqueo real).
2. `businessCaseDataOwnership.js` — ownership informativo/auditoria por seccion.
3. `businessCaseDeterminationsGate.service.js` — gate temporal (documento + ventana 48h).
4. `roleSectionConfig.js` (frontend) — que tabs se muestran/editan por rol.

## Cuando el cambio es puntual (dia a dia)
- Maximo 3-4 archivos, empezar por el archivo objetivo, no todo el modulo.
- Evitar tocar controller + routes + state machine en la misma micro-tarea
  salvo que el cambio realmente los toque a los tres (ver seccion siguiente).
- Verificacion minima:
  ```bash
  cd backend && npm run lint src/modules/business-case/
  ```

## Cuando el cambio es una realineacion fuerte (backend y/o frontend)
Si la tarea es corregir inconsistencias cruzadas del modulo (permisos
desalineados entre las 4 capas, estados legacy vs canonical_state sin
sincronizar, integracion comodato con nombres de campo distintos, etc.), el
objetivo es dejar el modulo **alineado, funcional y sin inconsistencias** —
no minimizar el numero de archivos tocados a la fuerza:
- Investigar completo primero: leer los archivos nucleo + los 4 sistemas de
  permisos + ambos puntos de integracion (comodato) antes de editar nada.
- Tocar todas las capas que el cambio realmente requiera, incluyendo
  controller+routes+state-machine juntos si la correccion los conecta.
- Si se corrige una regla de rol/seccion, verificar y actualizar los 4
  lugares del bloque anterior en la misma tarea — no dejar 3 de 4 alineados.
- Si se corrige la integracion comodato, revisar ambos entrypoints
  (`ensureBusinessCaseForComodato` y `ensureAutoBusinessCaseForPurchase`) y
  decidir explicitamente si se unifica el nombre del campo de vinculo o se
  documenta por que quedan distintos.
- Los validadores placeholder en `businessCaseStateReadiness.js`
  (`determinations`, `viability_evaluation`, `viability_assessment`,
  `roi_calculation` siempre retornan `true`) deben resolverse explicitamente:
  implementar la validacion real o dejar comentario que documente que es
  deliberadamente no bloqueante — no dejarlos como placeholder silencioso.
- Verificacion: lint del modulo + lint de los archivos de integracion tocados
  en private-purchases/equipment-purchases + smoke test manual del flujo
  comodato (crear BC, feasibility approve/reject, ver que la compra origen
  transiciona correctamente).

## No usar cuando
- Cambio es solo de UI sin tocar reglas de negocio (usar `frontend-skill.md`).
- Cambio es solo notificacion transversal (usar `notifications-skill.md`).
- Cambio es solo migracion DB sin logica asociada (usar `db-migration-skill.md`).

## Handoff
- Integraciones Odoo -> `backend/src/modules/integrations/AGENTS.md`
- Notificaciones -> `.agents/skills/notifications-skill.md`
