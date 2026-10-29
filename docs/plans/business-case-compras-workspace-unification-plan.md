# Plan de integración: Business Case como herramienta de Workspace de Compras

**Estado:** Implementado — fases operativas 0 a 3; fase 4 permanece opcional y sujeta a medición  
**Fecha:** 2026-09-18  
**Alcance:** integración funcional y de experiencia de usuario entre Business Case (BC) y Workspace de Compras, sin alterar las condiciones vigentes de operación.

## Decisión arquitectónica

No se propone fusionar tablas, APIs, máquinas de estado ni permisos de BC y Compras.

Para cualquier comodato, público o privado, **Business Case es la etapa obligatoria inicial y el gate del proceso**. El Workspace de Compras es el expediente operativo posterior: puede existir como hijo técnico bloqueado cuando el flujo lo requiera, pero sus pasos operativos no pueden continuar hasta que BC resuelva la factibilidad.

BC conserva la propiedad de evaluación y de sus decisiones; Compras conserva la propiedad de la ejecución operativa posterior. Ambos representan un único proceso de negocio y deben compartir el contexto, las notas y la trazabilidad del proceso enlazado.

```text
Proceso de comodato
├─ Etapa 1 — Business Case obligatorio
│  ├─ Evaluación
│  ├─ Factibilidad
│  ├─ Oferta / Preflow cuando aplique
│  └─ Decisión de continuidad
└─ Etapa 2 — Workspace de Compras
   ├─ Expediente hijo bloqueado hasta la decisión BC
   ├─ Operación de compra
   ├─ Logística, contrato, entrega y actas
   └─ Timeline y notas del mismo proceso
```

El workspace BC y sus rutas actuales se conservan inicialmente. La integración será incremental y reversible en la capa UI, pero la condición de gate debe aplicarse también en backend.

## Evidencia verificada

### Modelo y relación actual

- BC moderno se almacena en `equipment_purchase_requests` con `request_type = 'business_case'`; no cuenta con una tabla principal independiente.
- Las compras privadas se almacenan en `private_purchase_requests`.
- El enlace operativo de compra privada a BC es `private_purchase_requests.business_case_id`.
- El handoff BC a Compras ya crea o reutiliza el expediente correspondiente y conserva el vínculo mediante `business_case_id` y metadatos.
- La tabla `bc_offer_versions` admite exactamente un propietario: `business_case_id` o `private_purchase_id`.

### Estado observado en Neon el 2026-09-18

- 13 compras privadas; 5 tienen `business_case_id`.
- No se encontraron enlaces de compras privadas huérfanos contra BC moderno.
- 29 BC modernos; solo 4 contienen `modern_bc_metadata.private_purchase_id`.
- `private_purchase_requests.business_case_id` no posee una FK en Neon.
- Hay 9 compras privadas con `opportunity_id`; ninguno de los 29 BC modernos observados tiene `opportunity_id`.
- Existen 9 versiones de oferta con dueño BC y ninguna con dueño de compra privada.

Estas cifras describen el estado observado, no una regla de negocio deseada.

## Capacidades compartibles

| Capacidad | Estado actual | Decisión de integración |
|---|---|---|
| Oferta | Servicio y tabla compartidos; variantes de UI y reglas por origen. | Reutilizar panel/UI, manteniendo permisos y transiciones por contexto. |
| Enlace BC–Compra | Handoff y navegación bidireccionales existentes. | Crear un resolvedor de contexto común de solo lectura. |
| Equipos | BC sincroniza equipos hacia Compras al completar factibilidad. | Mostrar origen BC y evitar doble edición. |
| Consumibles | Compras ya importa consumos desde BC. | Conservar la importación y mostrar su trazabilidad. |
| Timeline y auditoría | Existen fuentes independientes en ambos módulos. | Crear visor consolidado, sin fusionar fuentes ni eventos. |
| Documentos | Cada flujo guarda documentos con reglas propias. | Leer documentos de origen desde el otro contexto; no duplicar carga ni versionado. |

## Límites que se deben conservar

- BC continúa siendo autoridad de evaluación, laboratorio, requerimientos, ROI, determinaciones, inversiones, factibilidad, SLA y Preflow.
- Compras continúa siendo autoridad de contrato, logística, entrega, actas, entrenamiento, control de insumos e inspección operativa.
- La inspección de BC no equivale a la inspección operativa de Compras y no se debe unificar como una sola actividad.
- Las notas deben conservar `entity_type` e identificador de origen; no se mezclan historiales ni hashes.
- Las decisiones, apelaciones y fallback de factibilidad continúan ejecutándose desde los servicios BC actuales.
- Los RBAC existentes se conservan por herramienta y origen; no se debe ampliar acceso por el solo hecho de mostrar BC dentro de Compras.

## Riesgos que deben cerrarse antes de consolidar el flujo

1. **Doble representación del vínculo.** La factibilidad usa en ciertos casos `modern_bc_metadata.private_purchase_id`, mientras que el vínculo operativo reside en `private_purchase_requests.business_case_id`. Ambos deben reconciliarse idempotentemente.
2. **Integridad referencial.** `private_purchase_requests.business_case_id` no posee FK; se debe decidir y validar una estrategia de integridad antes de depender del enlace para navegación y acciones.
3. **Estados no equivalentes.** BC y Compras tienen máquinas de estado distintas y mapeo parcial. Unificar etiquetas visuales no puede reemplazar transiciones backend.
4. **Oferta y firma.** El generador es compartible, pero la publicación, el envío y la firma de cliente no son idénticos para BC y compra privada.
5. **CRM.** Una compra privada comodato y su BC podrían generar oportunidades separadas. El enlace debe resolverse antes de crear o sincronizar oportunidades.
6. **Documentos y notas.** Una vista única no debe provocar duplicación de archivos, pérdida de trazabilidad ni cambio de propietario.
7. **Gate de continuidad público.** El expediente público no puede avanzar a etapas operativas mientras el BC asociado esté pendiente, en revisión, no factible o apelado.

## Plan por fases

### Fase 0 — Contrato de relación y saneamiento de lectura

Objetivo: disponer de una fuente de lectura consistente sin alterar flujos.

- Validar en Neon cardinalidad, enlaces faltantes y metadatos espejo.
- Definir el contrato de contexto: `purchaseType`, `purchaseId`, `businessCaseId`, origen y estado de enlace.
- Implementar únicamente un resolvedor idempotente de lectura/diagnóstico o reporte de inconsistencias.
- Definir el comportamiento frente a enlaces incompletos: informar y no ejecutar sincronizaciones automáticas destructivas.

**Criterio de salida:** cada expediente vinculado puede resolverse sin ambigüedad y las discrepancias se pueden identificar.

### Fase 1 — Gate BC y navegación contextual

Objetivo: garantizar que BC sea la primera etapa y que el expediente de Compras solo continúe después de la decisión aplicable.

- Establecer el enlace canónico al crear el expediente hijo, tanto público como privado.
- Crear el expediente hijo solo cuando el flujo lo requiera y mantenerlo bloqueado en etapa BC.
- Impedir por backend y UI las acciones operativas de Compras hasta factibilidad aprobada.
- Incorporar en el expediente un bloque “Business Case obligatorio” con estado, responsable y acceso directo al BC.
- Compartir notas y correos entre ambas vistas del mismo proceso sin duplicar registros.

**Criterio de salida:** ningún comodato público o privado puede ejecutar un paso operativo de Compras antes de la decisión BC autorizada.

### Fase 2 — Reutilización de oferta

Objetivo: eliminar duplicación de UI sin alterar contratos.

- Extraer una capa presentacional compartida para el workspace de oferta.
- Mantener adaptadores independientes de permisos, estados, publicación, envío y firma para BC y compra privada.
- Conservar `bc_offer_versions` y los endpoints actuales como fuente de verdad.

**Criterio de salida:** no se duplica interfaz de oferta y todas las transiciones actuales superan pruebas de regresión por tipo de expediente.

### Fase 3 — Contexto único entre BC y Compras

Objetivo: presentar ambas etapas como un único proceso, sin perder su ownership técnico.

- Exponer paneles de Evaluación, Factibilidad y Preflow mediante `businessCaseId`.
- Marcar con claridad qué campos son de lectura, cuáles pertenecen a BC y cuáles pertenecen a Compras.
- Mostrar snapshots de equipos, consumos y dispatch de BC donde corresponda, sin trasladar ownership.

**Criterio de salida:** la operación puede continuar desde Compras tras el gate BC, sin que BC pierda rutas, locks, RBAC ni reglas.

### Fase 4 — Consolidación opcional de experiencia

Objetivo: evaluar retirar navegación redundante solo si la integración está comprobada.

- Medir uso, errores de enlace y consistencia de estados.
- Mantener compatibilidad de enlaces profundos y rutas históricas.
- Decidir si la navegación BC independiente continúa como alternativa avanzada o se redirige internamente.

**Criterio de salida:** aprobación funcional, regresión completa y ausencia de discrepancias activas en enlaces críticos.

## Validaciones obligatorias antes de cada fase

- Estructura y restricciones reales en Neon.
- Contratos API y respuestas `{ ok: true|false }` existentes.
- Matriz de roles BC y Compras para cada acción expuesta.
- Pruebas de regresión de factibilidad, apelación, fallback, oferta, firma, CRM, documentos y notas.
- Verificación de rutas existentes y enlaces profundos.

## Archivos de evidencia principales

- `backend/src/modules/business-case/businessCasePurchaseHandoff.service.js`
- `backend/src/modules/business-case/businessCaseOffer.service.js`
- `backend/src/modules/business-case/businessCase.service.js`
- `backend/src/modules/private-purchases/privatePurchases.service.js`
- `backend/src/modules/private-purchases/privatePurchases.routes.js`
- `spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx`
- `spi_front/src/modules/shared/purchases-workspace/expediente/PurchaseExpedienteDetail.jsx`
- `spi_front/src/modules/comercial/pages/BusinessCaseWorkspace.jsx`

## Fuera de alcance de este plan

- Migración o fusión de tablas BC y Compras.
- Reemplazo de máquinas de estado.
- Cambio global de roles o permisos.
- Eliminación de rutas actuales de Business Case.
- Reescritura de notas, auditoría o versionado documental.

## Registro de implementación — 2026-09-18

- Se aplicó en Neon la migración `296_business_case_purchase_canonical_link.sql`.
- Los dos enlaces públicos que existían solo en `extra.business_case_id` fueron normalizados a `business_case_id`.
- Se agregaron FK `ON DELETE SET NULL` y unicidad parcial para el enlace BC en compras públicas y privadas.
- La creación Preflow y el handoff escriben desde ahora el enlace canónico de forma atómica e idempotente.
- Un guard de backend bloquea mutaciones operativas públicas y privadas mientras la factibilidad BC no esté aprobada; lectura, cancelación y apertura del BC permanecen disponibles.
- La decisión de factibilidad sincroniza el estado del expediente hijo sin depender de metadatos espejo.
- El Workspace de Compras muestra el gate, bloquea tabs operativas y ofrece acceso directo al BC.
- BC y Compras usan la misma cadena de notas del expediente enlazado, tanto público como privado, sin copiar registros.
- El timeline de Compras incorpora las transiciones BC que el rol actual está autorizado a consultar.
- Para comodatos vinculados se conserva una sola interfaz de oferta: la del BC. El panel de oferta privada directa solo se mantiene para procesos sin BC y ambos adaptadores continúan usando `bc_offer_versions` y `businessCaseOffer.service`.
- La evaluación, factibilidad, equipos, consumos e inspección BC permanecen bajo ownership BC; contrato, logística, entrega y actas permanecen bajo ownership Compras.

### Evidencia de verificación

- Neon: 0 duplicados y 0 huérfanos antes de aplicar constraints.
- Neon posterior: 2/2 expedientes públicos vinculados por columna; ambas FK e índices únicos presentes.
- Jest focalizado del gate y Preflow: 8/8 pruebas aprobadas.
- Suite completa BC: 25/26 suites y 154 pruebas aprobadas; una suite de integración no inicia por la incompatibilidad preexistente Jest/CommonJS con `uuid` ESM, antes de ejecutar casos.
- ESLint focalizado backend y frontend: sin errores.
- Build de producción frontend: completado; solo conserva warnings preexistentes fuera del alcance.
