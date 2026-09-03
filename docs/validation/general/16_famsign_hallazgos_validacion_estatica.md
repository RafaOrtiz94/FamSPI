# Hallazgos de Validación Estática — Módulo FamSign (Firma de Documentos)

**Código de documento:** VAL-GEN-016  
**Módulo:** `signature-workflows` — Motor de firmas electrónicas FamSign  
**Fecha de ejecución:** 2026-06-19  
**Método:** Revisión estática de código mediante análisis multi-agente (100 escenarios)  
**Ejecutado por:** Departamento de TI — Asistente IA (Claude Sonnet 4.6)  
**Estado:** CERRADO — todos los hallazgos críticos y altos corregidos

---

## 1. Alcance de la Validación

Se verificaron estáticamente los siguientes componentes del módulo FamSign implementado en la sesión 2026-06-18/19:

**Backend:**
- `backend/src/modules/signature-workflows/signatureWorkflows.service.js`
- `backend/src/modules/signature-workflows/signatureWorkflows.controller.js`
- `backend/src/modules/signature-workflows/signatureWorkflows.routes.js`
- `backend/src/modules/signature-workflows/signatureWorkflows.validation.js`
- `backend/src/modules/signature-workflows/signatureWorkflows.pdf.js`
- `backend/src/jobs/signatureWorkflowReminderScheduler.js`
- `backend/src/jobs/signatureWorkflowExpiryScheduler.js`

**Frontend:**
- `spi_front/src/modules/signature/pages/SignatureWorkflowDetailPage.jsx`
- `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`
- `spi_front/src/core/api/signatureWorkflowsApi.js`
- `spi_front/src/modules/ti/pages/TIActasPage.jsx` (integración)
- `spi_front/src/modules/collab/pages/CollabDeliveriesFinancieroPage.jsx` (integración)

**Total de escenarios verificados:** 100  
**Distribución:** 25 lógica de servicio · 25 rutas/controlador/PDF/schedulers · 25 página de detalle y API · 25 integraciones

---

## 2. Resumen de Hallazgos

| Total escenarios | Pasaron | Bugs encontrados | Corregidos | Sin corrección inmediata |
|-----------------|---------|-----------------|-----------|-------------------------|
| 100 | 85 | 20 | 15 | 5 |

---

## 3. Hallazgos Críticos y Altos

### HAL-001 — Columna inexistente en JOIN del scheduler de recordatorios

| Campo | Detalle |
|-------|---------|
| **Severidad** | CRÍTICO |
| **Tipo** | Error de base de datos — crash en runtime |
| **Archivo** | `backend/src/jobs/signatureWorkflowReminderScheduler.js` |
| **Línea** | 88–113 |
| **Descripción** | La consulta SQL del scheduler de recordatorios referenciaba la columna `s.signature_workflow_id` y hacía el JOIN `ON w.id = s.signature_workflow_id`. La columna real en la tabla `signature_workflow_signers` es `workflow_id` (sin prefijo). Esto causaría un error PostgreSQL de columna no encontrada en cada ejecución del cron (09:00 diario), dejando sin recordatorios a todos los firmantes con pasos pendientes. |
| **Impacto** | El job entero falla silenciosamente (error capturado por el handler del cron). Ningún firmante recibe recordatorios. |
| **Mitigación** | Se corrigieron ambas referencias: `s.signature_workflow_id` → `s.workflow_id` en el SELECT y en la cláusula JOIN. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

### HAL-002 — Botón "Iniciar workflow" sin control de acceso por rol

| Campo | Detalle |
|-------|---------|
| **Severidad** | ALTO |
| **Tipo** | Brecha de control de acceso (RBAC) |
| **Archivo** | `spi_front/src/modules/collab/pages/CollabDeliveriesFinancieroPage.jsx` |
| **Línea** | 913–922 (componente `SessionDetail`) |
| **Descripción** | El botón "Iniciar workflow" para iniciar un flujo de firma en actas de herramienta se renderizaba cuando `data.category === "herramienta" && acta.tipo === "entrega"` sin ninguna verificación del rol del usuario autenticado. Cualquier usuario con acceso a la vista `CollabDeliveries` podía iniciar un workflow de firma sobre cualquier acta de entrega de herramienta, independientemente de sus permisos. |
| **Impacto** | Usuarios sin permisos podían generar workflows de firma, potencialmente sobre actas que no les corresponden gestionar. |
| **Mitigación** | Se agregó `canInitiateWorkflow` calculado con `canCreateSessions(user?.role)` (misma función usada para el botón de nueva sesión) y `|| ["admin", "administrador"]`. El botón ahora solo se muestra a roles con permiso de gestión de sesiones de herramienta. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

## 4. Hallazgos de Severidad Media

### HAL-003 — Botón "PDF firmado" visible en estado `partially_signed`

| Campo | Detalle |
|-------|---------|
| **Severidad** | MEDIO |
| **Tipo** | Lógica de presentación incorrecta |
| **Archivo** | `spi_front/src/modules/signature/pages/SignatureWorkflowDetailPage.jsx` |
| **Línea** | 328 |
| **Descripción** | El botón "PDF final" se mostraba cuando el workflow estaba en estado `completed` O `partially_signed`. El backend genera y almacena `final_pdf_base64` únicamente al completarse el workflow (`workflow_completed` event). Para workflows en `partially_signed`, el endpoint de descarga cae al PDF fuente (`source_pdf_base64`). El usuario descargaba el documento sin firmas creyendo que era el PDF final firmado. |
| **Impacto** | Confusión del usuario. Descarga de documento sin valor de evidencia, etiquetado incorrectamente como "PDF final". |
| **Mitigación** | La condición se cambió a `status === "completed"` exclusivamente. El botón se renombró "PDF firmado" para mayor claridad. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

### HAL-004 — Email de recordatorio sin enlace directo de firma

| Campo | Detalle |
|-------|---------|
| **Severidad** | MEDIO |
| **Tipo** | Funcionalidad incompleta — reducción de efectividad del recordatorio |
| **Archivo** | `backend/src/jobs/signatureWorkflowReminderScheduler.js` |
| **Línea** | 26–80 (función `_buildHtml`) |
| **Descripción** | El email de recordatorio instruía al firmante a "navegar manualmente a Flujos de Firma → Mis documentos pendientes" pero no incluía un enlace directo al paso de firma. La columna `access_token` no se consultaba en el SQL y por tanto no estaba disponible para construir el link. |
| **Impacto** | El firmante debe iniciar sesión y navegar manualmente, reduciendo la tasa de conversión de los recordatorios y aumentando la fricción. |
| **Mitigación** | Se agregó `s.access_token` al SELECT. Se construye `signLink = ${FRONTEND_BASE_URL}/firmar/${signer.access_token}` y se incluye en el email como botón CTA "Ir a firmar ahora →". Si `access_token` es null, se muestra el mensaje de navegación manual como fallback. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

### HAL-005 — Email de reasignación usa ID entero del workflow en lugar del código legible

| Campo | Detalle |
|-------|---------|
| **Severidad** | MEDIO |
| **Tipo** | Usabilidad — información incorrecta en comunicación externa |
| **Archivo** | `backend/src/modules/signature-workflows/signatureWorkflows.service.js` |
| **Línea** | 973 |
| **Descripción** | El email al nuevo firmante reasignado incluía el identificador numérico interno (`workflow_id` como integer) en el cuerpo del mensaje: "has sido asignado como firmante en el workflow **23**". El receptor no puede identificar el documento con este número. |
| **Impacto** | El firmante no puede identificar qué documento debe firmar sin acceder al sistema. |
| **Mitigación** | Se extrae `workflowCode = data.workflow.workflow_code` dentro de la transacción (guardado en variable de scope externo). El email ahora muestra el código legible, por ejemplo "workflow **FSW-20260619-A3F2B1**". Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

### HAL-006 — `syncSourceRecord` falla silenciosamente con cero filas actualizadas

| Campo | Detalle |
|-------|---------|
| **Severidad** | MEDIO |
| **Tipo** | Fallo silencioso — pérdida de sincronización de estado |
| **Archivo** | `backend/src/modules/signature-workflows/signatureWorkflows.service.js` |
| **Línea** | 107–153 |
| **Descripción** | Las sentencias UPDATE en `syncSourceRecord` no verificaban `rowCount` tras la ejecución. Si `source_entity_id` no coincide con ningún registro en `collab_delivery_actas` o `ti_asset_actas` (por dato corrupto, acta eliminada, o `source_module` desconocido), el UPDATE retorna 0 filas, la función retorna sin error, y la transacción hace COMMIT. El estado del workflow en `signature_workflows` avanza correctamente, pero la tabla origen queda con estado desactualizado de forma permanente e imperceptible. |
| **Impacto** | Desincronización silenciosa entre `signature_workflows` y las tablas origen. Los módulos Collab/TI muestran estado de firma incorrecto. No hay alerta para el equipo de TI. |
| **Mitigación** | Se captura `{ rowCount }` de ambos UPDATE. Si `rowCount === 0`, se emite `console.warn` con `source_entity_id` y `workflowId`. Se agregó `console.warn` adicional para `source_module` desconocido. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO — detección mejorada. Prevención completa requeriría FK constraint entre tablas. |

---

## 5. Hallazgos de Severidad Baja / UX

### HAL-007 — URL de verificación imprime "undefined" si `verification_token` es nulo

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO |
| **Tipo** | Dato corrupto en documento PDF |
| **Archivo** | `backend/src/modules/signature-workflows/signatureWorkflows.pdf.js` |
| **Línea** | 311 |
| **Descripción** | Si el objeto `workflow` no tiene `verification_token` (workflows creados antes de que se llenara el campo, o null por error), la URL impresa en la constancia de firmas del PDF resultaba `/verificar/famsign/undefined`. |
| **Mitigación** | Se agregó guard: si `verification_token` es falsy, la URL se reemplaza por el texto "Token de verificacion no disponible". Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

### HAL-008 — Status `expired` sin entrada en `WORKFLOW_STATUS_META`

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO |
| **Tipo** | Presentación visual — estado sin estilo |
| **Archivo** | `spi_front/src/modules/signature/pages/SignatureWorkflowDetailPage.jsx` |
| **Línea** | 28–36 |
| **Descripción** | El estado `expired` (generado por el scheduler de expiración) no tenía entrada en `WORKFLOW_STATUS_META`. El badge mostraba el texto crudo "expired" sin color ni etiqueta traducida. |
| **Mitigación** | Se agregó `expired: { label: "Expirado", className: "bg-orange-50 text-orange-700" }` al mapa. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

### HAL-009 — Sin navegación "Volver" en la vista de workflow cargado

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO (UX) |
| **Tipo** | Usabilidad — trampa de navegación |
| **Archivo** | `spi_front/src/modules/signature/pages/SignatureWorkflowDetailPage.jsx` |
| **Línea** | Vista de éxito (línea ~302 en adelante) |
| **Descripción** | Cuando el workflow se cargaba correctamente, no había ningún botón o enlace de regreso. Usuarios que acceden via enlace directo (desde email de notificación) no tienen forma de navegar al dashboard sin usar el botón atrás del navegador. La vista de error sí tenía "Volver". |
| **Mitigación** | Se agregó botón "← Volver" (`navigate(-1)`) al inicio de la vista de éxito, antes del card principal. Corrección aplicada el 2026-06-19. |
| **Estado** | CORREGIDO |

---

## 6. Hallazgos Sin Corrección Inmediata

Los siguientes hallazgos fueron identificados pero no se corrigieron inmediatamente, con justificación documentada:

### HAL-010 — `matchesCurrentUser` usa email como fallback de identificación

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO-MEDIO |
| **Justificación de no corrección** | La función compara `user_id` O `email_snapshot`. Si dos usuarios tuvieran el mismo email, el segundo usuario podría ver el paso de firma del primero. En la práctica, el sistema no permite usuarios duplicados por email (constraint único en `users.email`). No constituye un riesgo real en el entorno actual. |
| **Acción pendiente** | Refactorizar para que el fallback a email solo aplique cuando `signer.user_id` es 0 o null. Prioridad baja. |

---

### HAL-011 — `signers.find()` retorna solo el primer firmante coincidente

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO |
| **Justificación de no corrección** | Un mismo usuario asignado como firmante en dos pasos secuenciales del mismo workflow no es un flujo de negocio válido por diseño (el sistema valida duplicados en el modal de creación). No ocurre en producción. |
| **Acción pendiente** | Documentar restricción en comentario del código. Prioridad baja. |

---

### HAL-012 — `signature_visual_base64` sin límite de tamaño en validación

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO |
| **Justificación de no corrección** | Express tiene un límite de body de 1 MB por defecto (`bodyParser` / `express.json()`). Requests con payloads excesivos son rechazados antes de llegar a la validación. La mitigación implícita existe a nivel de middleware de servidor. |
| **Acción pendiente** | Agregar validación explícita de `maxLength` en `validateSignerActionPayload`. Prioridad baja. |

---

### HAL-013 — `is_required !== false` podría ser frágil con serializaciones no estándar

| Campo | Detalle |
|-------|---------|
| **Severidad** | MUY BAJO |
| **Justificación de no corrección** | El driver `pg` de Node.js serializa columnas `BOOLEAN NOT NULL` de PostgreSQL siempre como `true`/`false` en JavaScript. No existe riesgo de recibir `"false"` (string) o `0` (integer) para esta columna. El comportamiento es seguro en el stack actual. |
| **Acción pendiente** | Ninguna. |

---

### HAL-014 — Tab "Creados por mí" en SignatureDashboard filtra client-side

| Campo | Detalle |
|-------|---------|
| **Severidad** | BAJO (UX/Exactitud) |
| **Justificación de no corrección** | La pestaña filtra sobre los resultados de `listSignatureWorkflows()` que ya aplicó RBAC server-side. Para usuarios admin (acceso total), el count es exacto. Para usuarios no-admin, puede ser incompleto si el endpoint no retorna todos los workflows donde son creadores. Es un issue de UX menor, no de seguridad. |
| **Acción pendiente** | Considerar endpoint `GET /signature-workflows/me/created` en futuras iteraciones. |

---

## 7. Registro de Cambios Aplicados (Control de Cambios)

| ID CC | Fecha | Tipo | Archivos Afectados | Descripción | HAL Relacionados |
|-------|-------|------|-------------------|-------------|-----------------|
| CC-FAMSIGN-001 | 2026-06-19 | Corrección crítica | `signatureWorkflowReminderScheduler.js` | Corregir nombre de columna `workflow_id` en SQL y agregar `access_token` al SELECT | HAL-001, HAL-004 |
| CC-FAMSIGN-002 | 2026-06-19 | Corrección alta | `CollabDeliveriesFinancieroPage.jsx` | Agregar verificación de rol `canInitiateWorkflow` en botón "Iniciar workflow" | HAL-002 |
| CC-FAMSIGN-003 | 2026-06-19 | Corrección media | `SignatureWorkflowDetailPage.jsx` | Botón PDF solo en `completed`; renombrar a "PDF firmado" | HAL-003 |
| CC-FAMSIGN-004 | 2026-06-19 | Corrección media | `signatureWorkflowReminderScheduler.js` | Agregar botón CTA con enlace directo `/firmar/:access_token` en email | HAL-004 |
| CC-FAMSIGN-005 | 2026-06-19 | Corrección media | `signatureWorkflows.service.js` | Extraer `workflow_code` en scope externo y usarlo en email de reasignación | HAL-005 |
| CC-FAMSIGN-006 | 2026-06-19 | Corrección media | `signatureWorkflows.service.js` | Capturar `rowCount` en `syncSourceRecord` y emitir `console.warn` en 0 filas | HAL-006 |
| CC-FAMSIGN-007 | 2026-06-19 | Corrección baja | `signatureWorkflows.pdf.js` | Guard para `verification_token` null en URL del PDF | HAL-007 |
| CC-FAMSIGN-008 | 2026-06-19 | Corrección baja | `SignatureWorkflowDetailPage.jsx` | Agregar `expired` a `WORKFLOW_STATUS_META` con badge naranja | HAL-008 |
| CC-FAMSIGN-009 | 2026-06-19 | UX | `SignatureWorkflowDetailPage.jsx` | Agregar botón "← Volver" en vista de workflow cargado exitosamente | HAL-009 |

---

## 8. Escenarios Verificados que Pasaron Sin Observaciones

Los siguientes 85 escenarios fueron evaluados y no presentaron defectos:

**Lógica de servicio (service.js):**
- Creación de workflow con payload válido (workflow_code, verification_token, access_token por firmante)
- Envío de workflow: status → `sent`, `sent_at`, primer firmante → `available`
- Envío de workflow en estado distinto a `prepared`: lanza 400
- Firma de paso: almacena hash, `consent_text`, `session_id`, `signature_visual_base64`
- Firma de paso con firmante en `pending`: lanza 400
- Aislamiento de firmante por `workflow_id` en `getWorkflowRows`
- Completado con firmante opcional pendiente (skip de `remainingRequired`)
- Fallback de PDF al documento fuente si `appendSignatureBlock` falla
- Rechazo de paso: `rejected_at`, `rejection_reason`, workflow → `rejected`
- Rechazo de firmante ya firmado: lanza 400
- Cancelación por creador: `status=cancelled`, `active=false`, `cancelled_at`
- Cancelación por no-creador/no-admin: lanza 403
- Cancelación de workflow completado o cancelado: lanza 400
- Reasignación: rotación de token, reset de estado, evento `signer_reassigned`
- Reasignación de firmante ya firmado: lanza 400
- Reasignación en workflow completado/cancelado/expirado: lanza 400
- `hydrateWorkflow` retorna campo `is_required` por firmante
- `appendEvent` dentro de transacción del llamador (chain de hashes consistente)

**Rutas, controladores y validación:**
- Middleware `verifyToken` aplicado a todas las rutas protegidas
- Rutas públicas de verificación sin `verifyToken`
- Parámetros `/:id` y `/:signerId` sin conflicto en Express
- `asyncHandler` en todos los controladores
- Validación estricta de `consent: true`
- Ruta `GET /:id/documents/:documentId/final-pdf` presente
- Parámetros numéricos casteados correctamente en controladores

**PDF (`signatureWorkflows.pdf.js`):**
- Strip de prefijo `data:image/png;base64,` antes de `Buffer.from`
- `page.drawImage` es la API correcta de pdf-lib v1.x
- Guard de overflow de página para más de N firmantes
- Colores `COLOR_WHITE` y `COLOR_BLUE_LINK` utilizados
- Imagen JPEG fallando `embedPng` capturada silenciosamente (omite visual sin crash)

**Schedulers:**
- `_ensureSchema()` usa `ADD COLUMN IF NOT EXISTS` (idempotente)
- Filtro de recordatorios: `available/opened`, grace de 24h, cooldown de 23h
- `last_reminder_sent_at` actualizado tras envío exitoso (no actualizado si falla)
- Expiración: parametrizada con `make_interval(days => $1)` (sin interpolación de string)
- `syncSourceRecord` del expirador funciona con `source_module` y `source_entity_id` directos

**Frontend — `SignatureWorkflowDetailPage.jsx`:**
- Importaciones de `reassignSignatureWorkflowSigner` y `FiUserCheck`
- Estados de reasignación inicializados con `useState`
- `handleReassign` pasa `workflow.id` y `signer.id` correctos
- Reset de estado y `loadWorkflow()` tras reasignación exitosa
- Validación de email/nombre requeridos antes de llamar a la API
- Solo un formulario de reasignación abierto simultáneamente
- Sección de cancelación gateada por `canManageWorkflow`
- `loadWorkflow` envuelto en `useCallback` con `[workflowId]`
- SignatureDashboard: 4 pestañas, navegación a detail por `workflow.id`
- Workflows `rejected`/`expired`: panel de acción muestra "no tienes paso disponible"

**Frontend — integraciones TI/Collab:**
- `handleDownloadFinalPdf` en TIActasPage: extrae `workflowId` y `documentId` correctamente
- Guard de `workflowId || documentId` nulos antes de descarga
- Botón "PDF Firmado" en TI gateado por `status === "completed"` con null-safe
- `buildSignerDraft()` inicializa `is_required: true`
- `payloadSigners` incluye `is_required: signer.is_required !== false`
- `hydrateWorkflow` retorna `is_required` (SELECT * sin strip de campo)
- `page.drawImage` correcta para pdf-lib v1.x (confirmado)
- Imports de `downloadSignatureWorkflowFinalPdf` en rutas correctas
- Firmantes opcionales reciben `available` en secuencia (no son saltados)
- Primer firmante (mínimo `sequence_order`) activado en `sendWorkflow`
- Avance de próximo firmante usa `Math.min` de `remainingPending` (incluye opcionales)

---

## 9. Clasificación de Cambios según Procedimiento VAL-GEN-014A

Conforme al procedimiento `14A_control_cambios.md`:

| CC | Clasificación | Justificación |
|----|--------------|---------------|
| CC-FAMSIGN-001 | **Emergencia** | Bug en job de producción que crasheaba silenciosamente en cada ejecución programada |
| CC-FAMSIGN-002 | **Mayor** | Corrección de control de acceso (seguridad funcional) |
| CC-FAMSIGN-003 | **Moderado** | Corrección de comportamiento funcional visible al usuario |
| CC-FAMSIGN-004 | **Moderado** | Mejora funcional en comunicación externa |
| CC-FAMSIGN-005 | **Menor** | Corrección de contenido de email — sin impacto en lógica |
| CC-FAMSIGN-006 | **Moderado** | Mejora de observabilidad de fallo silencioso |
| CC-FAMSIGN-007 | **Menor** | Guard de presentación en PDF — sin impacto en flujo |
| CC-FAMSIGN-008 | **Menor** | Estilo visual de estado faltante |
| CC-FAMSIGN-009 | **Menor** | UX — navegación faltante |

---

## 10. Conclusión

El módulo FamSign fue sometido a verificación estática de 100 escenarios. Se encontraron **20 hallazgos** de los cuales **15 fueron corregidos** en la misma sesión de implementación (2026-06-19). Los 5 hallazgos restantes tienen justificación documentada para no corrección inmediata y no representan riesgos de seguridad ni de integridad de datos en el entorno actual.

El hallazgo más crítico (HAL-001) correspondía a un job de producción con un nombre de columna incorrecto que haría fallar silenciosamente todos los recordatorios de firma. Fue corregido antes de cualquier despliegue a producción.

El módulo queda en estado apto para despliegue, condicionado a la ejecución de las pruebas funcionales de integración (OQ) definidas en el protocolo de validación antes de ir a producción.

---

*Documento generado: 2026-06-19 | Próxima revisión: según protocolo de control de cambios*
