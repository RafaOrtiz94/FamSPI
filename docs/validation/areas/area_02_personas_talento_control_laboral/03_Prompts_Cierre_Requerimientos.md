# Guía de Implementación: Prompts de Cierre (Área 02)

Este documento contiene los prompts técnicos necesarios para cerrar las brechas identificadas en el cotejamiento de requerimientos. Cada prompt está diseñado para una IA experta en código, citando archivos y funciones reales del proyecto FamSPI.

---

## 🚀 GAP 1: Transacción Atómica en Contratación (REQ-PT-034 / REQ-PT-007)
**Archivos afectados:** `backend/src/modules/personnel-requests/personnel-requests.service.js`

### **Prompt Técnico:**
> "Refactoriza la función `hirePersonnelRequest` en `personnel-requests.service.js`. Actualmente realiza inserciones en `users`, `collaborator_profiles` y actualizaciones en `personnel_requests` de forma independiente. 
> 
> **Paso a Paso:**
> 1. Obtén un cliente de base de datos usando `await db.getClient()`.
> 2. Envuelve toda la lógica dentro de un bloque `try/catch`.
> 3. Inicia una transacción con `await client.query('BEGIN')`.
> 4. Sustituye todas las llamadas a `db.query` por `client.query`.
> 5. Asegura que si la creación del usuario o el perfil falla, se ejecute `ROLLBACK`.
> 6. Al finalizar exitosamente todas las operaciones (incluyendo la actualización del estado de la solicitud a 'completada'), ejecuta `COMMIT`.
> 7. Asegúrate de liberar el cliente en el bloque `finally` con `client.release()`."

---

## 🚀 GAP 2: Bloqueo por Incompletitud de Perfil (REQ-PT-024)
**Archivos afectados:** `backend/src/modules/personnel-requests/personnel-requests.service.js`

### **Prompt Técnico:**
> "Modifica la función `updatePersonnelRequestStatus` para impedir el avance a estados terminales si el perfil no está completo.
> 
> **Paso a Paso:**
> 1. Localiza la validación de transición de estados.
> 2. Antes de permitir el cambio a `aprobada` o `en_proceso`, recupera el perfil actual usando `getPersonnelProfile(id)`.
> 3. Utiliza la función existente `computeProfileCompletion(profile)` para obtener el porcentaje de completitud.
> 4. Si `complete` es `false` o el porcentaje es menor al 100%, lanza un error de validación: `Error('No se puede avanzar: El perfil profesional debe estar completo al 100%')`.
> 5. Asegúrate de que este error sea capturado por el controlador para devolver un HTTP 400."

---

## 🚀 GAP 3: Alertas de Estancamiento SLA (REQ-PT-026)
**Archivos afectados:** `backend/src/modules/personnel-requests/personnel-requests.service.js` y `backend/src/modules/personnel-requests/personnel-requests.controller.js`

### **Prompt Técnico:**
> "Implementa la lógica de cálculo de estancamiento (SLA) en el backend.
> 
> **Paso a Paso:**
> 1. En `personnel-requests.service.js`, revisa la función `buildWorkflowSummary`.
> 2. Asegúrate de que el campo `stalled` se calcule comparando `now()` contra `started_at` de la etapa actual + `maxHours` definido en `PERSONNEL_WORKFLOW_STEPS`.
> 3. En la consulta SQL de `getPersonnelRequests`, añade un filtro o cálculo dinámico para que el frontend pueda recibir una lista de 'solicitudes estancadas'.
> 4. Actualiza el objeto de retorno del service para incluir `stalled_for_label` (ej. 'Estancada por 24h')."

---

## 🚀 GAP 4: Skeleton Loaders en Workspace (REQ-PT-032)
**Archivos afectados:** `spi_front/src/modules/talento/pages/CollaboratorCommandCenter.jsx`

### **Prompt Técnico:**
> "Mejora la experiencia de carga (UX) del Command Center implementando Skeleton Loaders de Tailwind CSS.
> 
> **Paso a Paso:**
> 1. Crea un sub-componente `CommandCenterSkeleton` que imite la estructura de la tarjeta `CommandCenterWorkspaceHeader` y el `CommandCenterSummaryStrip`.
> 2. En `CollaboratorCommandCenter.jsx`, localiza los estados `loadingRequests`, `applicantsLoading` y `loadingCollaborators`.
> 3. En lugar de mostrar un spinner o pantalla en blanco, renderiza el `CommandCenterSkeleton`.
> 4. Usa las clases `animate-pulse` y fondos `bg-stone-200` para los placeholders de texto y avatares.
> 5. Asegura que el layout no 'salte' (Layout Shift) cuando los datos reales reemplacen al skeleton."

---

## 🚀 GAP 5: Dossier PDF de Certificaciones (REQ-PT-033)
**Archivos afectados:** `backend/src/modules/user-certifications/userCertifications.service.js` y `backend/src/modules/user-certifications/userCertifications.controller.js`

### **Prompt Técnico:**
> "Crea un nuevo endpoint para generar un PDF consolidado de todas las certificaciones de un colaborador.
> 
> **Paso a Paso:**
> 1. En `userCertifications.service.js`, crea la función `generateCertificationsDossier(userId)`.
> 2. Usa la librería `pdf-lib` (o la que use el proyecto para asistencia) para crear un documento.
> 3. Lista todas las certificaciones activas del usuario.
> 4. Por cada certificación, añade una página o sección con: Título, Emisor, Fecha de Emisión, Fecha de Vencimiento y un link/QR al documento en Drive.
> 5. Registra la ruta `GET /users/:id/certifications/dossier` en el router correspondiente.
> 6. Asegura que solo TH y Gerencia puedan generar dossiers de otros usuarios."

---

## 🚀 GAP 6: Notificación de Excepciones de Jornada (REQ-PT-037)
**Archivos afectados:** `backend/src/modules/attendance/attendance.controller.js` y `backend/src/services/gmail.service.js`

### **Prompt Técnico:**
> "Implementa notificaciones automáticas ante irregularidades en la asistencia.
> 
> **Paso a Paso:**
> 1. En `attendance.controller.js`, localiza la función `clockOut`.
> 2. Añade una validación: si la salida se registra fuera del horario permitido o si `isOvertime` es verdadero con más de 3 horas, dispara una notificación.
> 3. Usa `notificationManager.sendNotification` para alertar al rol `talento_humano`.
> 4. El mensaje debe incluir el nombre del colaborador y el tipo de excepción detectada.
> 5. Integra esto también en cualquier marcación de 'salida inesperada' si existe el endpoint."

---

## 🚀 GAP 7: Reprogramación/Cancelación de Vacaciones (REQ-PT-039)
**Archivos afectados:** `backend/src/modules/vacaciones/vacaciones.service.js`

### **Prompt Técnico:**
> "Añade soporte para cancelar o reprogramar solicitudes de vacaciones ya aprobadas.
> 
> **Paso a Paso:**
> 1. En `vacaciones.service.js`, crea la función `cancelVacationRequest(solicitudId, userId)`.
> 2. Permite la cancelación solo si la `start_date` es futura.
> 3. Actualiza el estado a 'cancelado'.
> 4. Si se reprograma, crea una función `updateVacationDates` que valide de nuevo el saldo disponible antes de guardar los cambios.
> 5. Notifica al aprobador original sobre la cancelación o el cambio de fechas."

---
**Instrucciones para la IA:** Ejecuta estos prompts de forma secuencial, verificando la integridad de la base de datos y manteniendo el estilo de código existente (ES6+, async/await, logging estructurado).
