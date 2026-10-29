# Fases 0 a 5 - Ejecucion FamSign DocuSign Interno

Fecha base: 2026-06-18
Ultima actualizacion operativa: 2026-06-19 — FASES 0-5 CERRADAS

Documento operativo para arrancar las primeras 5 fases del plan `PLAN_FAMSIGN_DOCUSIGN_INTERNO.md`.

## 0. Estado actual de ejecucion

### 0.1 Resumen ejecutivo — CERRADO 2026-06-19

- Fase 0: CERRADA. Decisions resueltas en codigo. Discovery documentado en blueprint.
- Fase 1: CERRADA. Blueprint definitivo en `backend/src/modules/signature/FAMSIGN_WORKFLOW_BLUEPRINT.md`, seccion 22 documenta estado de implementacion.
- Fase 2: CERRADA. Motor `signature-workflows` soporta: creacion, envio, apertura, firma, rechazo, cancelacion, eventos, consulta y verificacion por token.
- Fase 3: CERRADA. Centro de firmas con 4 bandejas (inbox/created/completed/all), detalle de workflow con firma/rechazo/cancelacion, verificacion publica.
- Fase 4: CERRADA. `collab-deliveries` integra inicio de workflow, UI de estado, PDF final firmado descargable directamente desde la vista origen.
- Fase 5: CERRADA. `ti-assets` mismo patron: inicio de workflow, UI de estado, PDF final firmado descargable directamente desde `TIActasPage`.

### 0.2 Evidencia implementada al 2026-06-19

- Backend nuevo en `backend/src/modules/signature-workflows/`.
- Verificacion publica por token del workflow.
- Integracion de `collab-deliveries` con workflow por acta.
- Integracion de `ti-assets` con workflow por acta.
- Bandejas explicitas del centro de firmas:
  - `/dashboard/signatures/inbox`
  - `/dashboard/signatures/created`
  - `/dashboard/signatures/completed`
  - `/dashboard/signatures/all`
- Verificacion publica del workflow:
  - `/verificar/famsign/:token`

### 0.3 Regla transversal de UI

Todo desarrollo de UI de FamSign y de sus integraciones en modulos origen debe seguir obligatoriamente `DESIGN.md`.

Esto aplica a:

- centro de firmas
- detalle de workflow
- verificacion publica del workflow
- modales de inicio manual
- estados de workflow mostrados en `collab-deliveries`
- estados de workflow mostrados en `ti-assets`

Reglas minimas obligatorias:

- usar `WORKSPACE_PAGE_CLASS` o layout equivalente del sistema cuando aplique
- usar `Modal` del sistema, no overlays ad hoc
- contemplar estados `loading`, `empty`, `error`, `success`
- usar `Action Blue` solo para acciones
- respetar radios, sombras y jerarquia visual definidas en `DESIGN.md`
- agregar `cursor-pointer` y feedback `active:scale-[0.97]` a interactivos
- no introducir una UI paralela ni estilos aislados del sistema

## 1. Estado de partida verificado

### 1.1 Lo que ya existe

- Modulo de firma actual en `backend/src/modules/signature/`.
- Motor transversal `backend/src/modules/signature-workflows/`.
- Flujo de firma sobre documentos en `backend/src/modules/documents/document.service.js`.
- Flujo de firma legal propio en `backend/src/modules/permisos/permisos.service.js`.
- Generacion de actas en:
  - `backend/src/modules/collab-deliveries/collabDeliveries.service.js`
  - `backend/src/modules/collab-deliveries/collabDeliveries.acta.js`
- Generacion y gestion de actas TI en:
  - `backend/src/modules/ti-assets/tiAssets.service.js`
  - `backend/src/modules/ti-assets/tiAssets.routes.js`
- UI existente de FamSign en:
  - `spi_front/src/modules/signature/components/DocumentSigner.jsx`
  - `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`
  - `spi_front/src/modules/signature/pages/DocumentVerification.jsx`
  - `spi_front/src/modules/signature/pages/SignatureWorkflowDetailPage.jsx`
  - `spi_front/src/modules/signature/pages/SignatureWorkflowVerificationPage.jsx`

### 1.2 Lo que no existe todavia

- Integracion end-to-end donde el documento final quede firmado dentro de la app sin depender de contingencias legacy.
- Cierre formal del blueprint definitivo de Fase 1 en un solo artefacto.
- Politica documentada y cerrada para cancelacion, recordatorios, expiracion, reasignacion y firmantes opcionales.
- Exposicion mas directa del PDF final firmado dentro de los modulos origen sin depender solo del detalle global del workflow.

### 1.3 Riesgos de contexto

`backend/src/modules/collab-deliveries/CONTEXT.md` no disponible o insuficiente.

`backend/src/modules/ti-assets/CONTEXT.md` no disponible o insuficiente.

Por eso las fases 0 a 5 deben apoyarse en codigo real y Neon, no en documentacion de modulo.

## 2. Objetivo de estas primeras 5 fases

Cerrar el diseno funcional y tecnico, construir el nucleo backend, exponer el frontend transversal minimo, y conectar el primer caso de uso real:

- acta de entrega de herramientas de trabajo desde `collab-deliveries`

Luego dejar preparado el patron para `ti-assets`.

## 3. Fase 0 - Discovery funcional y tecnico

## 3.1 Objetivo

Cerrar todas las decisiones que hoy no estan verificadas y que impedirian implementar sin asumir.

## 3.2 Entregables obligatorios

- Matriz de tipos documentales candidatos a workflow.
- Matriz de firmantes por tipo documental.
- Definicion de orden de firma por tipo documental.
- Definicion de acceso al modulo por actor.
- Definicion de visibilidad de procesos.
- Definicion de firma visual vs evidencia tecnica.
- Definicion de verificacion publica vs interna.
- Definicion de expiracion y recordatorios.
- Definicion de contingencia para `upload-signed`.

## 3.3 Tabla de decisiones a cerrar

### Decision 1

Nombre del nuevo modulo transversal.

Opciones de trabajo:

- `signature-workflows`
- `famsign-workflows`
- `signature-center`

### Decision 2

Cual sera el primer documento oficial del MVP.

Valor base propuesto:

- `collab-deliveries` categoria `herramienta`, tipo `entrega`

### Decision 3

Orden exacto de firmantes para herramientas de trabajo.

Debe cerrarse si sera:

- secuencial
- paralelo
- mixto

### Decision 4

La firma dibujada sera:

- solo representacion visual
- evidencia complementaria
- evidencia obligatoria

Estado actual verificado:

- hoy la firma visual no es la evidencia principal en el flujo generico existente

### Decision 5

Quien puede crear el workflow.

Debe definirse si el origen:

- lo crea automaticamente
- lo crea manualmente un rol operativo
- soporta ambos modos

### Decision 6

Quien puede cancelar un workflow.

Debe definirse si pueden:

- creador del workflow
- administrador del modulo origen
- TI o admin del sistema

### Decision 7

La verificacion final sera:

- publica por token
- interna autenticada
- ambas segun tipo documental

### Decision 8

Que hacer si falla Drive.

Debe definirse si:

- el workflow se considera valido sin Drive
- Drive es obligatorio para completar

Recomendacion tecnica basada en arquitectura actual:

- el workflow debe poder completar sin depender de Drive

### Decision 9

Que hacer con `upload-signed`.

Debe cerrarse si queda como:

- contingencia temporal
- compatibilidad heredada
- endpoint a retirar en fase posterior

### Decision 10

Como se modelan firmantes opcionales.

Debe definirse si:

- existen desde el MVP
- se posponen a una fase posterior

## 3.4 Trabajo concreto de Fase 0

1. Hacer una matriz de documentos candidatos por modulo origen.
2. Hacer una matriz de actores por documento.
3. Cerrar el caso `herramienta/entrega`.
4. Confirmar si `ti-assets` y `collab-deliveries` convergen al mismo patron o solo comparten motor.
5. Confirmar con negocio si el colaborador debe poder ver su historial de documentos firmados.
6. Confirmar si el firmante puede rechazar con comentario obligatorio.
7. Confirmar si la firma debe vencer.
8. Confirmar si se necesitan recordatorios automaticos.
9. Confirmar si se puede reasignar firmante.
10. Confirmar si habra firmantes externos.

## 3.5 Criterio de cierre de Fase 0

No se avanza a cambios de DB ni contratos definitivos si:

- no esta cerrado el orden del primer workflow
- no esta cerrado que evidencia de firma se exige
- no esta cerrado el rol creador y el rol cancelador

## 4. Fase 1 - Blueprint tecnico

## 4.1 Objetivo

Convertir las decisiones de Fase 0 en diseno tecnico implementable.

## 4.2 Entregables obligatorios

- esquema DB definitivo
- maquina de estados definitiva
- eventos definitivos
- contratos API definitivos
- reglas RBAC definitivas
- diseno de PDF final
- politica de versiones del documento
- diseno de integracion con `collab-deliveries`
- diseno de integracion futura con `ti-assets`

## 4.3 Trabajo concreto de Fase 1

### 4.3.1 Base de datos

Definir tablas nuevas del motor transversal.

Trabajo esperado:

- disenar tablas de workflow
- disenar tablas de firmantes
- disenar tablas de eventos
- disenar tablas de artefactos
- definir indices
- definir claves unicas
- definir estrategia de versionado

### 4.3.2 Estados

Cerrar estados del workflow, firmante y documento.

Trabajo esperado:

- definir transiciones validas
- definir transiciones invalidas
- definir efectos laterales por transicion

### 4.3.3 Contratos API

Disenar:

- endpoints del motor transversal
- endpoints del firmante
- endpoints de verificacion
- endpoints de integracion origen

### 4.3.4 RBAC

Disenar:

- permisos de lectura
- permisos de firma
- permisos de seguimiento
- permisos de cancelacion
- permisos de verificacion

### 4.3.5 PDF final

Disenar:

- snapshot base
- bloque visual de firmas
- resumen verificable
- QR y token
- reglas de regeneracion

## 4.4 Archivos objetivo de Fase 1

Documentacion:

- `PLAN_FAMSIGN_DOCUSIGN_INTERNO.md`
- `docs/ai/plans/famsign_docusign_fases_0_5_ejecucion.md`

Futuros archivos tecnicos sugeridos:

- `backend/src/modules/signature/FAMSIGN_WORKFLOW_BLUEPRINT.md`
- `docs/validation/DS/DS_modulo_documentos_firma.md` si se quiere reflejar luego en validacion

## 4.5 Criterio de cierre de Fase 1

No se crea migracion si:

- no existe esquema definitivo
- no existe naming definitivo
- no existe API definitiva

## 5. Fase 2 - Backend core del workflow

## 5.1 Objetivo

Construir el motor transversal multi-firmante.

## 5.2 Alcance tecnico de Fase 2

- migraciones DB
- rutas backend
- servicios del workflow
- auditoria append-only
- eventos
- verificacion
- recordatorios basicos
- artefactos PDF

## 5.3 Estructura sugerida

Backend nuevo:

- `backend/src/modules/signature-workflows/`

Archivos minimos sugeridos:

- `signatureWorkflows.routes.js`
- `signatureWorkflows.controller.js`
- `signatureWorkflows.service.js`
- `signatureWorkflows.repository.js`
- `signatureWorkflows.validation.js`
- `signatureWorkflows.events.js`
- `signatureWorkflows.pdf.js`
- `signatureWorkflows.verification.js`

Servicios compartidos a evaluar para reutilizacion:

- `backend/src/services/signatures/advancedSignature.service.js`
- `backend/src/services/signatures/digitalSeal.service.js`
- `backend/src/services/signatures/verification.service.js`
- `backend/src/services/signatures/immutableSignatureLogger.service.js`

## 5.4 Decisiones de implementacion en Fase 2

### 5.4.1 Reutilizar vs duplicar

No duplicar si puede centralizarse:

- hash del documento
- hash de eventos
- verificacion
- QR
- trazabilidad

### 5.4.2 Aislamiento

El nuevo motor no debe depender directamente de `collab-deliveries` ni de `ti-assets` para sus reglas internas.

Debe recibir:

- documento fuente
- firmantes
- orden
- metadatos de origen

### 5.4.3 Idempotencia

Las acciones criticas deben ser idempotentes:

- crear workflow
- enviar workflow
- firmar
- completar
- recordar

## 5.5 Tareas concretas de Fase 2

1. Crear migracion inicial del workflow.
2. Crear tablas del motor.
3. Crear servicio de creacion de workflow.
4. Crear servicio de congelamiento del documento.
5. Crear servicio de firmado.
6. Crear servicio de rechazo.
7. Crear servicio de cancelacion.
8. Crear servicio de completado.
9. Crear servicio de verificacion.
10. Crear logger append-only del workflow.
11. Crear generacion del PDF final con bloque de firmas.
12. Crear endpoints de consulta y bandeja.

## 5.6 Validaciones tecnicas minimas

- no permitir firmar documento modificado
- no permitir firmar si no es el firmante activo
- no permitir completar sin firmas requeridas
- no permitir cambiar firmantes con workflow iniciado sin politica explicita
- no permitir duplicar firma del mismo firmante en el mismo estado

## 5.7 Criterio de cierre de Fase 2

La fase cierra cuando:

- backend puede crear workflow
- backend puede registrar varios firmantes
- backend puede firmar secuencialmente
- backend puede cerrar documento final
- backend puede verificar documento final

## 6. Fase 3 - Frontend transversal

## 6.1 Objetivo

Construir la experiencia de firma y seguimiento en la app.

## 6.2 Alcance

- bandeja de pendientes
- bandeja de creados por mi
- bandeja de completados
- vista de detalle
- visor del documento
- accion de firmar
- accion de rechazar
- timeline de eventos

## 6.3 Rutas sugeridas

- `/dashboard/signatures/inbox`
- `/dashboard/signatures/created`
- `/dashboard/signatures/completed`
- `/dashboard/signatures/:workflowId`
- `/verificar/famsign/:token`

## 6.4 Componentes minimos

- `SignatureInboxPage`
- `SignatureCreatedPage`
- `SignatureCompletedPage`
- `SignatureWorkflowDetailPage`
- `SignatureSignerPanel`
- `SignatureTimeline`
- `SignatureParticipantsCard`
- `SignatureDocumentViewer`
- `SignatureRejectModal`

## 6.5 Trabajo concreto de Fase 3

1. Definir servicio API nuevo.
2. Definir rutas protegidas.
3. Disenar estados `loading`, `empty`, `error`, `success`.
4. Integrar visor del documento.
5. Integrar panel de firma.
6. Integrar rechazo con motivo.
7. Integrar resumen de firmantes.
8. Integrar timeline del workflow.
9. Integrar descarga del PDF final.

Estado 2026-06-19:

- API nueva implementada.
- Rutas protegidas implementadas.
- Bandejas explicitas implementadas.
- Detalle de workflow implementado.
- Verificacion publica del workflow implementada.
- Descarga de PDF base/final implementada.
- Pendiente seguir afinando visor documental y separacion de componentes si se decide refactor posterior.

## 6.6 Reutilizacion posible

Se puede aprovechar parcialmente:

- `DocumentSigner.jsx`
- `DocumentVerification.jsx`
- `SignatureDashboard.jsx`

Pero no deben forzarse tal cual si su estructura actual no soporta multi-firmante ni bandejas transversales.

## 6.7 Criterio de cierre de Fase 3

La fase cierra cuando:

- un firmante puede ver su bandeja
- un firmante puede abrir el documento
- un firmante puede firmar
- un firmante puede rechazar
- el creador puede seguir el avance del workflow

## 7. Fase 4 - Integracion con `collab-deliveries`

## 7.1 Objetivo

Hacer que el primer caso de uso real funcione con el nuevo motor.

## 7.2 Punto de entrada actual verificado

Hoy `collab-deliveries`:

- genera el acta
- genera el PDF
- sube opcionalmente a Drive
- permite `upload-signed`

## 7.3 Punto de entrada objetivo

Cuando se cree el acta de herramienta:

1. se genera el PDF base
2. se congela snapshot
3. se crea workflow
4. se registran firmantes
5. se envia workflow
6. se firman desde la app
7. se genera PDF final
8. se actualiza el acta origen

## 7.4 Tareas concretas de Fase 4

### Backend

1. Agregar referencia de workflow en `collab_delivery_actas`.
2. Crear servicio para iniciar workflow desde acta.
3. Resolver firmantes por categoria y tipo.
4. Exponer endpoint de detalle de workflow por acta.
5. Sustituir la logica principal de `upload-signed` por workflow nativo.

### Frontend

1. Mostrar estado de workflow en paginas de `collab`.
2. Mostrar CTA para abrir workflow.
3. Mostrar estado de firmas por acta.
4. Mostrar PDF final cuando este completado.

Estado 2026-06-19 (actualizado):

- Backend de integracion implementado.
- Inicio manual con firmantes explicitos implementado.
- Consulta de workflow por acta implementada.
- UI de estado y CTA implementadas en `collab-deliveries`.
- PDF final firmado accesible directamente desde `SessionDetail`: boton "PDF Firmado" visible cuando `signature_workflow_status === completed`, llama a `getCollabActaSignatureWorkflow` para obtener `document_id` y descarga via `downloadSignatureWorkflowFinalPdf`.

## 7.5 Casos a cubrir desde el arranque

- acta individual de herramienta
- acta de sesion multi-item herramienta
- colaborador receptor
- talento humano
- gerencia general

## 7.6 Criterio de cierre de Fase 4

La fase cierra cuando un acta de herramienta de trabajo puede:

- nacer desde `collab-deliveries`
- abrir workflow de firmas
- completar las 3 firmas
- producir PDF final verificable
- quedar marcada como completada sin `upload-signed`

## 8. Fase 5 - Integracion con `ti-assets`

## 8.1 Objetivo

Reusar el patron sobre actas de activos TI.

## 8.2 Estado actual verificado

`ti-assets` hoy ya tiene:

- actas
- PDF base
- descarga de PDF
- `upload-signed`
- `is_complete`

## 8.3 Meta

No reescribir el motor.

Solo integrar el origen `ti_asset_actas` al workflow transversal.

## 8.4 Tareas concretas de Fase 5

### Backend

1. Agregar referencia de workflow en `ti_asset_actas`.
2. Crear adaptador origen `ti-assets -> signature-workflows`.
3. Resolver firmantes por tipo de acta TI.
4. Exponer endpoints de consulta por acta TI.
5. Mantener `upload-signed` solo como contingencia temporal.

### Frontend

1. Mostrar estado del workflow en `TIActasPage`.
2. Mostrar acceso directo al workflow desde detalle de acta.
3. Mostrar PDF final firmado dentro del detalle.

Estado 2026-06-19 (actualizado):

- Backend de integracion implementado.
- Inicio manual con seleccion explicita de firmantes implementado en `TIActasPage`.
- Estado y acceso directo al workflow implementados.
- PDF final firmado accesible directamente desde la tabla de `TIActasPage`: boton "PDF Firmado" visible cuando `signature_workflow_status === completed`, llama a `getTiActaSignatureWorkflow` para obtener `document_id` y descarga via `downloadSignatureWorkflowFinalPdf`.

## 8.5 Criterio de cierre de Fase 5

La fase cierra cuando una acta TI puede:

- iniciar workflow
- registrar firmantes
- seguir el mismo patron de firma
- completarse con PDF final verificable

## 9. Orden recomendado de ejecucion real

1. Cerrar Fase 0.
2. Escribir blueprint definitivo de Fase 1.
3. Implementar migraciones y backend de Fase 2.
4. Construir frontend minimo de Fase 3.
5. Integrar `collab-deliveries` en Fase 4.
6. Integrar `ti-assets` en Fase 5.

## 10. Que no debe hacerse todavia

- No reemplazar `upload-signed` sin que Fase 2 y 3 esten operativas.
- No migrar historico inventando multiples firmantes donde no existieron.
- No unir `permisos` al nuevo motor sin una decision explicita posterior.
- No cambiar contratos legacy de `signature` sin revisar impacto de frontend y verificacion publica.
- No tocar rutas globales mas de lo necesario hasta cerrar la API del nuevo modulo.
- No construir UI nueva de FamSign fuera de las reglas de `DESIGN.md`.

## 11. Cierre de fases 0-5

Fases 0-5 cerradas al 2026-06-19.

### Resumen de lo implementado en esta ejecucion

- Cancel workflow: `POST /api/v1/signature-workflows/:id/cancel` (service + controller + route). Frontend: `cancelSignatureWorkflow()` en API, UI de cancelacion con confirmacion de 2 pasos en `SignatureWorkflowDetailPage` (solo visible al creador o admin, solo en estados activos).
- PDF final directo: boton "PDF Firmado" en `TIActasPage` y en `CollabDeliveries SessionDetail` cuando `signature_workflow_status === completed`.
- Blueprint: seccion 22 de `FAMSIGN_WORKFLOW_BLUEPRINT.md` documenta implementacion y pendientes.

### Pendientes post-MVP — implementados en sesion 2026-06-19

- Bloque visual de firmas: IMPLEMENTADO. `signatureWorkflows.pdf.js` adjunta pagina "Constancia de Firmas Electronicas" al PDF fuente con pdf-lib. Se llama en completado de `signStep`. Fallback seguro al PDF fuente si falla.
- Recordatorios automaticos: IMPLEMENTADO. `jobs/signatureWorkflowReminderScheduler.js`, cron 09:00 diario, email a firmantes `available/opened` sin firmar > 24h. Ruta: `POST /internal-jobs/signature-workflows/reminder`.
- Expiracion automatica: IMPLEMENTADO. `jobs/signatureWorkflowExpiryScheduler.js`, cron 03:00 diario, expira workflows `sent/in_progress/partially_signed` con `sent_at` > `SIGNATURE_WORKFLOW_EXPIRY_DAYS` dias (default 30). Sincroniza modulos origen. Ruta: `POST /internal-jobs/signature-workflows/expiry`.

### Pendientes restantes — implementados en sesion 2026-06-19 (continuacion)

- Reasignacion de firmante: IMPLEMENTADO. `POST /api/v1/signature-workflows/:id/signers/:signerId/reassign`. Service valida estado activo del workflow y estado pending/available del firmante, rota `access_token` + `access_token_expires_at`, resetea status a pending, registra evento `signer_reassigned`, envia email al nuevo firmante (best-effort post-COMMIT). Frontend: boton "Reasignar" + formulario inline en cada signer card (visible al creador/admin en workflows activos). API: `reassignSignatureWorkflowSigner()` en `signatureWorkflowsApi.js`.
- Firmantes opcionales: IMPLEMENTADO. Column `is_required BOOLEAN` ya existia en schema (migration 210). Logica de completado en `signStep()` corregida: `remainingRequired` (solo firmantes con `is_required !== false`) determina si el workflow completa; `remainingPending` (todos) avanza el siguiente en secuencia. Badge "Opcional" en signer card de `SignatureWorkflowDetailPage`. Ambos modales de creacion (TI + Collab) ya tenian checkbox "Obligatorio".
- Trazo grafico de firma en PDF: IMPLEMENTADO. Migration 211: `signature_visual_base64 TEXT` en `signature_workflow_signers` (aplicada a Neon). `signStep()` almacena el base64 del canvas de `FirmaDigital`. `signatureWorkflows.pdf.js` embebe imagen PNG 120x40px por firmante en la constancia, con fallback silencioso si no es embeddable.

## 12. Estado final del modulo FamSign — CERRADO 2026-06-19

Todos los pendientes del plan original han sido implementados. El modulo `signature-workflows` esta operativo end-to-end:

- Motor de firma: crear, enviar, abrir paso, firmar, rechazar, cancelar, reasignar.
- Firmantes opcionales: no bloquean completado del workflow.
- PDF final: constancia de firmas con hash, timestamps, imagen de trazo y URL de verificacion.
- Jobs automaticos: recordatorios (09:00) y expiracion (03:00).
- Integraciones: `collab-deliveries` y `ti-assets` con descarga directa del PDF firmado.
- Centro de firmas: 4 bandejas, detalle de workflow, verificacion publica por token.
- Seguridad: RBAC, hash-chain de eventos, tokens de acceso rotativos.
