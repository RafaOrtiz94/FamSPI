# Guía de Implementación: Prompts de Cierre (Área 03)

Este documento contiene los prompts técnicos necesarios para cerrar las brechas identificadas en el cotejamiento de requerimientos del Área Comercial y Business Case. Cada prompt está diseñado para una IA experta en código, citando archivos y funciones reales del proyecto FamSPI.

---

## 🚀 GAP 1: Historial de Interacciones CRM (REQ-COM-005)
**Archivos afectados:** `backend/src/modules/clients/clients.service.js` y `backend/src/modules/clients/clients.controller.js`

### **Prompt Técnico:**
> "Implementa un sistema de registro de interacciones comerciales para el módulo de clientes.
> 
> **Paso a Paso:**
> 1. Crea una tabla `client_interactions` con: `id`, `client_id`, `created_by`, `type` (visita, llamada, correo, nota), `content` (text), `created_at`.
> 2. En `clients.service.js`, crea la función `registerInteraction(interactionData)` que valide la existencia del cliente y el tipo de interacción.
> 3. Crea la función `getClientHistory(clientId)` que devuelva un listado descendente de interacciones y solicitudes (`requests`) asociadas.
> 4. Expón los endpoints `POST /clients/:id/interactions` y `GET /clients/:id/history` en el router de clientes.
> 5. Asegura que el `created_by` se obtenga automáticamente del token de sesión."

---

## 🚀 GAP 2: Sincronización de Cronogramas (REQ-COM-015)
**Archivos afectados:** `backend/src/modules/schedules/schedules.service.js`

### **Prompt Técnico:**
> "Implementa la generación de archivos `.ics` para permitir la sincronización de cronogramas comerciales con calendarios externos (Google/Outlook).
> 
> **Paso a Paso:**
> 1. Instala la dependencia `ics` si no está disponible en el proyecto.
> 2. En `schedules.service.js`, crea la función `generateScheduleCalendar(userId, month, year)`.
> 3. Obtén todas las actividades aprobadas del usuario para el periodo solicitado.
> 4. Transforma cada actividad en un evento `ics` con: `title`, `start`, `duration`, `description` (incluyendo nombre del cliente).
> 5. Expón un endpoint `GET /schedules/sync/:token.ics` que devuelva el archivo con el `Content-Type: text/calendar`.
> 6. Implementa un sistema de tokens temporales para permitir la descarga sin requerir login directo en el lector de calendario."

---

## 🚀 GAP 3: Bloqueo de Concurrencia Optimista en BC (REQ-COM-036)
**Archivos afectados:** `backend/src/modules/business-case/businessCase.service.js`

### **Prompt Técnico:**
> "Implementa 'Optimistic Locking' en el módulo de Business Case para evitar que dos usuarios sobrescriban cambios simultáneamente en cálculos críticos.
> 
> **Paso a Paso:**
> 1. Añade una columna `version` (entero, por defecto 1) a la tabla `business_cases`.
> 2. En `businessCase.service.js`, modifica la función `updateBusinessCase`.
> 3. Al realizar el `UPDATE`, añade una cláusula `WHERE id = $1 AND version = $2`.
> 4. Incrementa la `version = version + 1` en el mismo comando.
> 5. Si el resultado de la consulta devuelve `rowCount === 0`, lanza un error: `Error('CONCURRENCY_CONFLICT: El Business Case ha sido modificado por otro usuario. Por favor, recarga la página.')`.
> 6. Asegura que el frontend envíe la versión actual del registro en cada petición de guardado."

---

## 🚀 GAP 4: Tracking de Eventos de UI Comercial (REQ-COM-035)
**Archivos afectados:** `spi_front/src/modules/comercial/pages/Dashboard.jsx` y `backend/src/modules/audit-prep/auditPrep.service.js`

### **Prompt Técnico:**
> "Implementa el registro de eventos de interacción de usuario (User Interaction Logging) para auditoría de procesos comerciales.
> 
> **Paso a Paso:**
> 1. Crea un endpoint liviano `POST /audit/ui-event` que registre: `user_id`, `event_name`, `metadata` (JSONB), `path`, `timestamp`.
> 2. En el frontend comercial, crea un hook `useInteractionTracker`.
> 3. Captura eventos críticos: Apertura de BC, Inicio de Cálculo de ROI, Exportación a Excel y Cambio de Pestaña.
> 4. Envía estos eventos en segundo plano (usando `navigator.sendBeacon` o una cola de promesas asíncronas) para no afectar la performance.
> 5. Asegura que estos eventos se distingan de los logs de auditoría de base de datos (`logAction`) por ser eventos de comportamiento y no solo de cambio de estado."

---

## 🚀 GAP 5: Alerta de Rentabilidad Dinámica (REQ-COM-025)
**Archivos afectados:** `spi_front/src/modules/comercial/components/workspace/sections/RentabilitySection.jsx`

### **Prompt Técnico:**
> "Mejora el feedback visual de rentabilidad en el Business Case para alertar dinámicamente según el umbral de la empresa.
> 
> **Paso a Paso:**
> 1. Define una constante de umbral (ej. `MIN_ACCEPTABLE_MARGIN = 0.25`) obtenida preferiblemente de una Feature Flag del backend.
> 2. En `RentabilitySection.jsx`, implementa una lógica que compare el `margin` proyectado contra el umbral.
> 3. Si el margen es inferior, aplica una clase `animate-pulse` y un color rojo intenso al indicador.
> 4. Muestra un mensaje de advertencia: '⚠️ Margen por debajo del objetivo corporativo. Requiere justificación especial'."

---
**Instrucciones para la IA:** Ejecuta estos prompts priorizando la integridad de los datos económicos y asegurando que las integraciones externas (Drive, LIS) no se vean afectadas por los nuevos bloqueos de concurrencia.
