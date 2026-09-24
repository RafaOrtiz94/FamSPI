# PLAN_FAMSIGN_DOCUSIGN_INTERNO.md

## 1. Objetivo

Diseñar e implementar en FamSPI un módulo transversal de firma documental interna, accesible para todos los usuarios autenticados según permisos sobre cada documento, con una experiencia similar a DocuSign, pero apoyado en la evidencia y capacidades reales que hoy existen en FamSPI.

Este plan está orientado a implementación por fases.

No define comportamientos no verificados como si ya existieran.

## 2. Base verificada

### 2.1 Evidencia actual en backend

- Existe un módulo de firma en `backend/src/modules/signature/`.
- Existe un controlador activo en `backend/src/modules/signature/signature.controller.js`.
- Existen rutas montadas en:
  - `/api/v1/signature`
  - `/api` con aliases legacy
- Existe un flujo de firma genérico sobre documentos en `backend/src/modules/documents/document.service.js`.
- Existe un flujo propio de firma legal para permisos/vacaciones en `backend/src/modules/permisos/permisos.service.js`.
- Existe generación de actas en `backend/src/modules/collab-deliveries/collabDeliveries.service.js`.
- Existe rellenado de PDFs base en `backend/src/modules/collab-deliveries/collabDeliveries.acta.js`.
- Existe una subida manual de PDF firmado en `POST /actas/:actaId/upload-signed` dentro de `backend/src/modules/collab-deliveries/collabDeliveries.routes.js`.

### 2.2 Evidencia actual en frontend

- Existe interfaz de firma genérica en:
  - `spi_front/src/modules/signature/components/DocumentSigner.jsx`
  - `spi_front/src/modules/signature/pages/DocumentVerification.jsx`
  - `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`
- Existe uso embebido de `DocumentSigner` dentro de `servicio`, no solo como módulo aislado.
- Existe visualización de estados FamSign en permisos/vacaciones, pero no una bandeja transversal tipo DocuSign para todos los documentos del sistema.

### 2.3 Evidencia actual en Neon

Se verificó la existencia real de:

- `documents`
- `document_hashes`
- `document_signatures_advanced`
- `document_signature_logs`
- `document_seals`
- `document_qr_codes`
- `permisos_vacaciones`
- `permisos_vacaciones_firmas`
- `collab_delivery_actas`
- `collab_delivery_actas_items`
- `ti_asset_actas`
- `ti_asset_actas_items`
- función `create_document_seal_and_qr`
- función `track_qr_access`
- vista `document_verification_info`

## 3. Situación actual real

Hoy FamSPI no tiene un módulo unificado tipo DocuSign.

Lo que existe es:

1. Un flujo de firma genérico para documentos.
2. Un flujo independiente para permisos/vacaciones.
3. Un flujo de actas de entregas donde:
   - se genera el PDF base
   - se almacena su hash y metadatos
   - luego se sube un PDF ya firmado manualmente

Eso significa que actualmente no existe una cadena multi-firmante nativa para actas de entrega.

## 4. Restricciones verificadas

### 4.1 Restricciones de contexto

- `backend/src/modules/collab-deliveries/CONTEXT.md` no existe.
- Por lo tanto, el diseño para entregas debe apoyarse en código real y DB.

### 4.2 Restricciones de implementación actual

- `collab_delivery_actas` solo soporta un estado final de firmado con campos como:
  - `signed_at`
  - `signed_by`
  - `signed_pdf_*`
  - `is_complete`
- Esos campos no representan múltiples firmantes ni una cadena de firmas.
- El flujo actual de `upload-signed` es manual y debe considerarse legado o contingencia, no base del nuevo módulo.

### 4.3 Restricciones de precisión

Este plan no asume:

- el orden definitivo de firmas por cada tipo documental
- si la firma visual dibujada es evidencia legal principal
- si existirán firmantes externos sin usuario interno
- si todas las firmas deben ser secuenciales
- si el PDF podrá regenerarse después del envío

Esos puntos deberán cerrarse en la fase de discovery funcional.

## 5. Alcance inicial propuesto

### 5.1 Alcance mínimo del MVP

Construir un módulo transversal de firma documental interna que permita:

- crear un proceso de firma sobre un PDF congelado
- asignar múltiples firmantes
- definir orden de firma
- registrar evidencia técnica y trazabilidad
- firmar desde la app sin subir un PDF firmado externamente
- generar documento final verificable
- consultar bandejas de pendientes, creados, completados y rechazados

### 5.2 Primer caso de uso obligatorio

Acta creada desde `collab-deliveries` para entrega de herramientas de trabajo, con firmantes:

- gerencia general
- talento humano
- colaborador receptor

### 5.3 Alcance excluido del MVP

Queda fuera del MVP, salvo validación posterior:

- firma de terceros externos sin cuenta interna
- certificado digital hardware o firma criptográfica avanzada con proveedor externo
- delegaciones automáticas complejas
- edición del PDF una vez iniciado el proceso
- migración masiva automática de toda la historia documental

## 6. Principios de diseño

1. El módulo origen crea el documento.
2. El módulo de firma orquesta firmantes, estados, eventos y evidencias.
3. El PDF a firmar debe congelarse en una versión inmutable.
4. Cada firma debe quedar trazada con hash del documento y hash del evento.
5. El documento final no debe depender de subir manualmente un PDF firmado.
6. Los roles controlan acceso al proceso, no sustituyen identidad del firmante.
7. La auditoría debe ser append-only.
8. Debe existir verificación posterior del documento final.

## 7. Arquitectura objetivo

### 7.1 Patrón general

Separar el sistema en dos capas:

- capa origen del documento
- capa transversal de workflow de firma

### 7.2 Módulos origen candidatos

Con evidencia actual o alta probabilidad de integración:

- `collab-deliveries`
- `ti-assets`
- `documents`
- `permisos`
- `vacaciones`
- `offboarding`
- `talento_humano`

### 7.3 Capa de firma

Crear un nuevo módulo transversal, por ejemplo:

- `backend/src/modules/famsign-workflows/`

El nombre definitivo se validará en fase de diseño, pero el objetivo es separar:

- firma de documentos
- verificación
- bandejas
- eventos
- participantes
- artefactos

## 8. Modelo de datos propuesto

Este modelo es de diseño; debe validarse en Neon y contra naming existente antes de crear migraciones.

### 8.1 Tabla `signature_workflows`

Propósito:

- representar el sobre o proceso de firma

Campos propuestos:

- `id`
- `code`
- `source_module`
- `source_entity`
- `source_entity_id`
- `document_type`
- `status`
- `created_by`
- `created_at`
- `sent_at`
- `completed_at`
- `cancelled_at`
- `expired_at`
- `current_step`
- `verification_token`
- `active`

### 8.2 Tabla `signature_workflow_documents`

Propósito:

- representar el documento congelado que entra al proceso

Campos propuestos:

- `id`
- `workflow_id`
- `version_num`
- `filename`
- `mime_type`
- `pdf_sha256`
- `pdf_storage_ref`
- `pdf_drive_url`
- `pdf_drive_file_id`
- `final_pdf_sha256`
- `final_pdf_storage_ref`
- `final_pdf_drive_url`
- `final_pdf_drive_file_id`
- `qr_token`
- `is_current`
- `created_at`

### 8.3 Tabla `signature_workflow_signers`

Propósito:

- modelar firmantes y orden

Campos propuestos:

- `id`
- `workflow_id`
- `document_id`
- `user_id`
- `email_snapshot`
- `name_snapshot`
- `role_snapshot`
- `signer_type`
- `sequence_order`
- `is_required`
- `status`
- `available_at`
- `opened_at`
- `signed_at`
- `rejected_at`
- `expires_at`
- `access_token`
- `access_token_expires_at`
- `signature_hash_sha256`
- `previous_signature_hash_sha256`
- `payload_hash_sha256`
- `session_id`
- `ip_address`
- `user_agent`
- `consent_text`
- `signature_visual_storage_ref`

### 8.4 Tabla `signature_workflow_events`

Propósito:

- auditoría append-only

Campos propuestos:

- `id`
- `workflow_id`
- `document_id`
- `signer_id`
- `event_type`
- `event_description`
- `event_data`
- `event_hash`
- `previous_event_hash`
- `created_by`
- `created_at`

### 8.5 Tabla `signature_workflow_access`

Propósito:

- acceso temporal o enlaces de firma si se requieren más adelante

Campos propuestos:

- `id`
- `workflow_id`
- `signer_id`
- `token`
- `status`
- `expires_at`
- `consumed_at`
- `created_at`

### 8.6 Tabla `signature_workflow_notifications`

Propósito:

- idempotencia y trazabilidad de avisos

Campos propuestos:

- `id`
- `workflow_id`
- `signer_id`
- `notification_type`
- `dedupe_key`
- `status`
- `sent_at`
- `error_message`
- `created_at`

## 9. Máquina de estados propuesta

### 9.1 Estados de workflow

- `draft`
- `prepared`
- `sent`
- `in_progress`
- `partially_signed`
- `completed`
- `rejected`
- `cancelled`
- `expired`
- `invalidated`

### 9.2 Estados de firmante

- `pending`
- `available`
- `opened`
- `signed`
- `rejected`
- `expired`
- `skipped`
- `replaced`

### 9.3 Estados de documento

- `draft`
- `frozen`
- `signed_partial`
- `signed_final`
- `invalidated`

## 10. Contratos API a construir

Estos endpoints son propuestos. Deben cerrarse en fase técnica antes de codificar.

### 10.1 Backend workflow

- `POST /api/v1/signature-workflows`
- `GET /api/v1/signature-workflows`
- `GET /api/v1/signature-workflows/:id`
- `POST /api/v1/signature-workflows/:id/send`
- `POST /api/v1/signature-workflows/:id/cancel`
- `POST /api/v1/signature-workflows/:id/remind`
- `GET /api/v1/signature-workflows/:id/events`
- `GET /api/v1/signature-workflows/:id/documents/:documentId/pdf`
- `GET /api/v1/signature-workflows/:id/documents/:documentId/final-pdf`

### 10.2 Backend firmante

- `GET /api/v1/signature-workflows/me/pending`
- `GET /api/v1/signature-workflows/me/completed`
- `POST /api/v1/signature-workflows/:id/signers/:signerId/open`
- `POST /api/v1/signature-workflows/:id/signers/:signerId/sign`
- `POST /api/v1/signature-workflows/:id/signers/:signerId/reject`

### 10.3 Backend verificación

- `GET /api/v1/signature-workflows/verify/:token`
- `GET /api/v1/signature-workflows/verify/:token/json`

### 10.4 Integración desde origen

Para `collab-deliveries`:

- `POST /api/v1/collab-deliveries/actas/:actaId/start-signature-workflow`
- `GET /api/v1/collab-deliveries/actas/:actaId/signature-workflow`

## 11. Integración con `collab-deliveries`

### 11.1 Estado actual

El módulo:

- crea el acta
- genera el PDF base
- guarda metadatos del PDF
- permite descarga
- permite subir un PDF firmado manualmente

### 11.2 Estado objetivo

El módulo debe:

- crear el acta
- generar el PDF base
- congelar snapshot
- crear workflow de firmas
- registrar firmantes
- activar la secuencia
- recibir firmas desde la app
- generar PDF final firmado
- actualizar el acta de origen con referencia al workflow y al PDF final

### 11.3 Cambio funcional requerido

`upload-signed` dejará de ser el camino principal.

Debe pasar a uno de estos estados:

- contingencia temporal
- compatibilidad heredada
- endpoint restringido solo para recuperación manual

### 11.4 Datos nuevos esperados en `collab_delivery_actas`

Posibles columnas nuevas:

- `signature_workflow_id`
- `signature_workflow_status`
- `final_verification_token`
- `final_pdf_generated_at`

Estas columnas deben validarse en diseño DB antes de migrar.

## 12. Integración con `ti-assets`

### 12.1 Estado actual

Existen `ti_asset_actas` y `ti_asset_actas_items` con estructura similar a actas de colaboradores.

### 12.2 Meta

El modelo de workflow no debe quedar amarrado exclusivamente a `collab_delivery_actas`.

Debe poder integrarse luego con:

- `ti_asset_actas`
- otros documentos transversales

## 13. Frontend objetivo

### 13.1 Nuevo módulo transversal

Crear área visible para usuarios autenticados, por ejemplo:

- `/dashboard/signatures/inbox`
- `/dashboard/signatures/created`
- `/dashboard/signatures/completed`
- `/dashboard/signatures/:workflowId`

### 13.2 Vistas mínimas

- bandeja de pendientes por firmar
- bandeja de procesos creados
- detalle del workflow
- visor del PDF
- timeline de eventos
- modal de rechazo
- verificación pública

### 13.3 Acciones mínimas

- abrir documento
- revisar firmantes
- firmar
- rechazar
- reenviar recordatorio
- cancelar workflow
- descargar documento final

### 13.4 Integración UI con origen

Desde `collab-deliveries` debe existir:

- acceso al workflow desde el detalle del acta
- indicador visual de estado de firma
- acciones según rol y estado

## 14. Evidencia técnica de firma

Cada firma debe registrar como mínimo:

- `user_id`
- `email_snapshot`
- `role_snapshot`
- `signed_at`
- `session_id`
- `ip_address`
- `user_agent`
- `consent_text`
- `payload_hash_sha256`
- `signature_hash_sha256`
- `previous_signature_hash_sha256`
- referencia a representación visual si aplica

## 15. PDF final

### 15.1 Requisitos

El PDF final debe incluir:

- datos originales del documento
- bloque visual de firmas
- fechas de firma
- nombres y roles
- token o URL de verificación
- código QR
- hash del documento final o referencia verificable

### 15.2 Regla de inmutabilidad

Una vez iniciadas firmas:

- no se debe alterar el PDF base
- si cambia el contenido, se debe invalidar la versión actual
- debe nacer una nueva versión del documento

## 16. Seguridad y acceso

### 16.1 Regla base

Todos los usuarios pueden tener acceso al módulo, pero no a todos los workflows.

### 16.2 Permisos funcionales a definir

- crear workflow
- ver workflow propio
- ver workflow de origen que administro
- firmar si soy firmante activo
- recordar si soy creador o administrador del origen
- cancelar si el estado lo permite
- verificar si el documento es público o por token

### 16.3 Regla crítica

Un usuario con rol superior no debe firmar en nombre de otro salvo regla explícita y auditable.

## 17. Notificaciones

### 17.1 Eventos mínimos

- workflow creado
- workflow enviado
- firma disponible
- recordatorio
- firmado
- rechazado
- completado
- expirado
- cancelado

### 17.2 Reglas

- sin duplicados
- con dedupe key
- sin lógica de negocio metida en notifications
- con control de reintentos

## 18. Auditoría y verificación

### 18.1 Auditoría

Cada acción relevante debe generar evento:

- `workflow_created`
- `workflow_sent`
- `document_frozen`
- `signer_opened`
- `signer_signed`
- `signer_rejected`
- `workflow_completed`
- `workflow_cancelled`
- `workflow_expired`
- `workflow_invalidated`

### 18.2 Verificación

Debe existir:

- vista pública o controlada de verificación
- resumen de firmantes
- estado final
- validación de integridad

## 19. Migración y convivencia

### 19.1 Histórico

No se debe falsificar historia de actas ya firmadas manualmente.

### 19.2 Estrategia

- actas históricas firmadas manualmente quedan como histórico
- actas sin firma pueden migrarse opcionalmente
- nuevos documentos deben usar el workflow nuevo cuando el feature flag esté activo

### 19.3 Compatibilidad temporal

Mantener temporalmente:

- `downloadActaPdf`
- `uploadSignedActa`

hasta que el nuevo flujo cubra el proceso end-to-end.

## 20. Fases de implementación

### Fase 0. Discovery funcional y técnico

Objetivo:

- cerrar decisiones no verificadas

Entregables:

- matriz de tipos documentales
- matriz de firmantes
- orden de firma por tipo
- definición de acceso universal
- decisión sobre firma visual
- decisión sobre verificación pública vs interna

No se implementa código aquí.

### Fase 1. Diseño técnico y DB

Objetivo:

- definir modelo definitivo y contratos

Entregables:

- esquema DB final
- estados definitivos
- eventos definitivos
- contratos API
- diseño de artefactos PDF

### Fase 2. Backend core del workflow

Objetivo:

- construir el motor transversal de workflow

Incluye:

- tablas
- servicios
- eventos
- auditoría
- verificación
- notificaciones base

### Fase 3. Frontend transversal

Objetivo:

- construir bandejas y detalle del workflow

Incluye:

- rutas
- bandejas
- detalle
- firma
- rechazo
- timeline

### Fase 4. Integración con `collab-deliveries`

Objetivo:

- reemplazar el flujo manual de PDF firmado por workflow nativo

Incluye:

- disparo automático o controlado del workflow
- lectura del acta PDF congelada
- visualización del estado de firmas
- cierre del acta con documento final

### Fase 5. Integración con `ti-assets`

Objetivo:

- reutilizar el mismo workflow sobre `ti_asset_actas`

### Fase 6. Hardenización y transición

Objetivo:

- métricas
- recordatorios
- expiraciones
- compatibilidad controlada
- retiro gradual del flujo manual

## 21. Criterios de éxito por fase

### Fase 0

- decisiones cerradas sin contradicción entre negocio, código y DB

### Fase 1

- diseño técnico aprobado
- sin contradicciones con contratos actuales

### Fase 2

- workflow multi-firmante funcional en backend
- auditoría hash-chain activa

### Fase 3

- un firmante puede revisar, firmar o rechazar dentro de la app

### Fase 4

- un acta de herramienta de trabajo puede completarse sin subir PDF firmado manualmente

### Fase 5

- el patrón funciona también para actas TI

### Fase 6

- flujo manual reducido a contingencia

## 22. Riesgos principales

1. Mezclar firma genérica actual con workflow de permisos sin una frontera clara.
2. Reusar `signed_by` e `is_complete` como si ya modelaran multi-firma.
3. Congelar mal el PDF y permitir cambios después de iniciar firmas.
4. Atar el módulo al caso de entregas y no dejarlo transversal.
5. Duplicar lógica entre `signature`, `documents` y el nuevo workflow.
6. Diseñar UI universal sin criterios RBAC claros.
7. Romper integraciones existentes de verificación por token.
8. Subordinar la validez del workflow a Drive.
9. Generar notificaciones duplicadas.
10. Migrar histórico manual como si fuese cadena real de firmas.

## 23. Dependencias transversales

Este plan toca como mínimo:

- firma digital
- documentos
- collab-deliveries
- ti-assets
- notificaciones
- auditoría
- frontend rutas protegidas
- DB Neon
- posiblemente Drive

Por eso debe ejecutarse como iniciativa compleja y no como bug puntual.

## 24. Matriz de 100 escenarios mínimos

1. Acta de herramienta con 3 firmantes internos.
2. Acta de ropa con 2 firmantes.
3. Acta de EPP con 2 firmantes.
4. Acta TI con colaborador receptor.
5. Acta creada desde entrega individual.
6. Acta creada desde sesión multi-ítem.
7. Workflow con un solo documento.
8. Workflow con varios documentos.
9. Firma secuencial pura.
10. Firma paralela pura.
11. Firma mixta.
12. Primer firmante firma y segundo queda pendiente.
13. Firmante intermedio rechaza.
14. Último firmante rechaza.
15. Creador cancela antes de la primera firma.
16. Creador cancela después de firma parcial.
17. Workflow expira completo.
18. Expira solo un firmante.
19. Reenvío de recordatorio individual.
20. Reenvío masivo.
21. PDF base regenerado antes de enviar.
22. PDF base modificado después de una firma.
23. PDF sin campos visuales de firma.
24. PDF con bloque visual predefinido.
25. Firma desde desktop.
26. Firma desde móvil.
27. Firma con sesión válida.
28. Sesión expirada al intentar firmar.
29. Usuario autenticado sin permiso intenta firmar.
30. Usuario con rol alto intenta firmar por otro.
31. Talento humano firma en orden correcto.
32. Talento humano intenta firmar antes de habilitación.
33. Colaborador firma primero.
34. Colaborador firma tras reintento.
35. Mismo usuario en dos roles.
36. Firmante desactivado tras el envío.
37. Firmante cambia de rol.
38. Firmante cambia de correo.
39. Reasignación antes de firmar.
40. Reasignación después de firma parcial.
41. Workflow completado con todas las firmas obligatorias.
42. Workflow completado con firmante opcional omitido.
43. Workflow rechazado y cerrado.
44. Workflow cancelado por creador.
45. Workflow invalidado por nueva versión.
46. Descarga de PDF base.
47. Descarga de PDF final.
48. Verificación pública del documento final.
49. Verificación interna del documento final.
50. QR apunta a versión correcta.
51. QR apunta a versión invalidada.
52. Hash final coincide.
53. Hash final no coincide.
54. Evento de auditoría completo.
55. Cadena hash de auditoría rota.
56. Fallo al guardar user-agent.
57. Fallo al guardar IP.
58. Fallo al guardar sesión.
59. Falla Drive al guardar PDF final.
60. Falla Drive al guardar PDF base.
61. Falla QR.
62. Falla render visual de firma.
63. Falla congelamiento del snapshot.
64. Acta de herramienta creada automáticamente desde entregas.
65. Acta TI creada desde activos TI.
66. Documento genérico creado desde `documents`.
67. Flujo de permisos consultado pero no migrado.
68. Bandeja vacía del usuario.
69. Bandeja con alto volumen.
70. Filtro por código.
71. Filtro por módulo origen.
72. Filtro por estado.
73. Filtro por firmante.
74. Filtro por rango de fechas.
75. Timeline completo.
76. Timeline con huecos por error.
77. Workflow creado pero no enviado.
78. Workflow enviado automáticamente.
79. Workflow preparado y enviado manualmente.
80. Recordatorio automático por vencimiento.
81. Recordatorio deshabilitado por tipo documental.
82. Firma fuera de horario laboral.
83. Firma desde red externa.
84. Dos firmantes abren a la vez.
85. Doble submit de la misma firma.
86. Reintento tras timeout frontend.
87. Firma exitosa con pérdida de respuesta HTTP.
88. Reintento sobre workflow ya completado.
89. Creador intenta editar firmantes con firmas parciales.
90. Creador intenta reemplazar documento ya firmado parcialmente.
91. Conversión de acta manual a workflow nuevo.
92. Acta histórica solo lectura.
93. Cierre del workflow sin upload manual.
94. Convivencia con `upload-signed`.
95. Notificación duplicada por retry.
96. Notificación fallida con workflow válido.
97. Usuario creador no firmante consulta detalle.
98. Usuario firmante no creador consulta detalle.
99. Auditor interno consulta evidencia final.
100. Gerencia general, talento humano y colaborador completan el flujo end-to-end de un acta de herramienta.

## 25. Siguiente paso recomendado

Antes de codificar:

1. cerrar Fase 0 con decisiones funcionales
2. convertir este plan en blueprint técnico
3. diseñar esquema DB final
4. definir contratos API exactos
5. seleccionar el primer flujo a implementar: `collab-deliveries` herramienta

## 26. Estado del documento

Documento inicial de planeación.

Listo para usarse como guía de implementación por fases.
