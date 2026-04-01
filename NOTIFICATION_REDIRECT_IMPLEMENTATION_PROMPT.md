# PROMPT DE IMPLEMENTACIÓN: Corrección de Redirecciones de Notificaciones

## Contexto
Las notificaciones del sistema (campana) para permisos, vacaciones, cancelaciones, tramos de recuperación y matrículas NO redirigen al lugar correcto al hacer click. El problema tiene dos frentes:
1. **Backend**: Las notificaciones no envían `target_path` en el campo `meta`
2. **Frontend**: `PermisosStatusWidget`, `AprobacionPermisosView` y `PermisosPage` no leen parámetros de URL

**IMPORTANTE**: La página `PermisosPage.jsx` renderiza DOS componentes diferentes:
- `"mine"` section → `PermisosStatusWidget` (tiene tabs: mine, approve, cancellation_requests, study_enrollments, waiting)
- `"gerencia_approvals"` section → `AprobacionPermisosView` (tiene tabs: pending, pending_final, cancellation_pending, study_enrollments, approved)

Los parámetros de URL `tab=approve`, `tab=cancellation_requests`, `tab=study_enrollments` deben mapearse a la sección `"gerencia_approvals"` de PermisosPage, y luego al tab interno correcto del componente hijo.

---

## Instrucciones

Realiza los siguientes cambios EN ORDEN. Lee cada archivo antes de editarlo.

---

### PASO 1: Backend — `permisos.service.js` agregar `target_path`

**Archivo:** `backend/src/modules/permisos/permisos.service.js`

Para cada notificación indicada, agrega `target_path` como propiedad adicional dentro del objeto `meta` existente. No elimines ninguna propiedad existente.

#### 1A. Matrícula pendiente — línea ~1463 (dentro de `registerStudyEnrollment`)

Buscar el bloque:
```js
meta: { enrollment_id: rows[0]?.id, user_id: actorId, status: "pending_validation" },
```
Cambiar a:
```js
meta: { enrollment_id: rows[0]?.id, user_id: actorId, status: "pending_validation",
  target_path: `/dashboard/talento-humano/permisos?tab=study_enrollments&enrollmentId=${rows[0]?.id}` },
```

#### 1B. Revisión de matrícula — línea ~1567 (dentro de `reviewStudyEnrollment`)

Buscar el bloque:
```js
meta: { enrollment_id: updated?.id, decision: normalizedDecision, reason: reviewReason },
```
Cambiar a:
```js
meta: { enrollment_id: updated?.id, decision: normalizedDecision, reason: reviewReason,
  target_path: `/dashboard/talento-humano/permisos?tab=mine` },
```

#### 1C. Solicitud enviada — solicitante — línea ~1919 (dentro de `createSolicitud`)

Buscar el bloque `meta` que contiene `solicitud_id: rows[0].id, tipo_solicitud: payload.tipo_solicitud, solicitante: payload.user_email, approver_user_id: payload.approver_user_id, fam_sign_notice_version: consentVersion`. Agregar al final del objeto meta (antes del cierre `}`):
```js
target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}`,
```

#### 1D. Solicitud enviada — aprobador — línea ~1937 (dentro de `createSolicitud`)

Buscar el bloque `meta` que contiene `solicitud_id: rows[0].id, tipo_solicitud: payload.tipo_solicitud, solicitante: payload.user_email`. Agregar:
```js
target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${rows[0].id}`,
```

#### 1E. Aprobación parcial/final — línea ~2039 (dentro de `aprobarParcial`)

Buscar el bloque:
```js
meta: { solicitud_id: rows[0].id, tipo_solicitud: rows[0].tipo_solicitud },
```
Cambiar a:
```js
meta: { solicitud_id: rows[0].id, tipo_solicitud: rows[0].tipo_solicitud,
  target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}` },
```

#### 1F. Justificantes subidos — línea ~2184 (dentro de `uploadJustificantes`)

Buscar el bloque:
```js
meta: { solicitud_id: solicitud.id, tipo_solicitud: solicitud.tipo_solicitud },
```
Cambiar a:
```js
meta: { solicitud_id: solicitud.id, tipo_solicitud: solicitud.tipo_solicitud,
  target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${solicitud.id}` },
```

#### 1G. Aprobación final — línea ~2233 (dentro de `aprobarFinal`)

Buscar el bloque:
```js
meta: { solicitud_id: update.rows[0].id, tipo_solicitud: update.rows[0].tipo_solicitud },
```
Cambiar a:
```js
meta: { solicitud_id: update.rows[0].id, tipo_solicitud: update.rows[0].tipo_solicitud,
  target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${update.rows[0].id}` },
```

#### 1H. Rechazo — línea ~2487 (dentro de `rechazar`)

Buscar el bloque `meta` que contiene `solicitud_id: rows[0].id, tipo_solicitud: rows[0].tipo_solicitud, observaciones: rows[0].observaciones`. Agregar:
```js
target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}`,
```

#### 1I. Cancelación pendiente — línea ~2597 (dentro de `cancelarSolicitud`, rama del solicitante)

Buscar el bloque:
```js
meta: { solicitud_id: updated.id, cancellation_status: "pending", reason: trimmedReason },
```
Cambiar a:
```js
meta: { solicitud_id: updated.id, cancellation_status: "pending", reason: trimmedReason,
  target_path: `/dashboard/talento-humano/permisos?tab=cancellation_requests&solicitudId=${updated.id}` },
```

#### 1J. Cancelación ejecutada — línea ~2640 (dentro de `cancelarSolicitud`, rama del jefe)

Buscar el bloque:
```js
meta: { solicitud_id: updated.id, reason: trimmedReason, status: "cancelled" },
```
Cambiar a:
```js
meta: { solicitud_id: updated.id, reason: trimmedReason, status: "cancelled",
  target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${updated.id}` },
```

#### 1K. Revisión de cancelación — línea ~2774 (dentro de `revisarCancelacionSolicitud`)

Buscar el bloque:
```js
meta: { solicitud_id: updated.id, decision: normalizedDecision, reason: reviewReason },
```
Cambiar a:
```js
meta: { solicitud_id: updated.id, decision: normalizedDecision, reason: reviewReason,
  target_path: `/dashboard/talento-humano/permisos?tab=cancellation_requests&solicitudId=${updated.id}` },
```

#### 1L. Recovery plan — línea ~2958 (dentro de la función de recovery plan)

Buscar el bloque `meta` que contiene `solicitud_id: updated.id, recovery_plan_total_hours: ...`. Agregar al final del objeto (antes del cierre `}`):
```js
target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${updated.id}&openRecovery=true`,
```

---

### PASO 2: Backend — `vacaciones.service.js` agregar `target_path`

**Archivo:** `backend/src/modules/vacaciones/vacaciones.service.js`

#### 2A. Vacaciones enviadas — solicitante — línea ~733

Buscar:
```js
meta: { solicitud_id: rows[0].id, solicitante: user.email },
```
Cambiar a:
```js
meta: { solicitud_id: rows[0].id, solicitante: user.email,
  target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}` },
```

#### 2B. Vacaciones enviadas — aprobador — línea ~745

Buscar:
```js
meta: { solicitud_id: rows[0].id, solicitante: user.email },
```
Cambiar a:
```js
meta: { solicitud_id: rows[0].id, solicitante: user.email,
  target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${rows[0].id}` },
```

#### 2C. Vacaciones aprobadas/rechazadas — línea ~848

Buscar:
```js
meta: { solicitud_id: updated[0].id, status: mappedStatus },
```
Cambiar a:
```js
meta: { solicitud_id: updated[0].id, status: mappedStatus,
  target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${updated[0].id}` },
```

#### 2D. Vacaciones reprogramadas/canceladas — línea ~927

Buscar el bloque `meta` que contiene `solicitud_id: solicitud.id, requester_id: solicitud.requester_id, action: actionType, ...payload`. Agregar antes del cierre `}`:
```js
target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${solicitud.id}`,
```

---

### PASO 3: Frontend — `PermisosPage.jsx` leer parámetros de URL

**Archivo:** `spi_front/src/modules/shared/solicitudes/pages/PermisosPage.jsx`

#### 3A. Agregar import
En la línea 1, agregar `useLocation` y `useMemo` (useMemo ya está importado de React). Agregar un nuevo import después de los imports de React:
```js
import { useLocation } from "react-router-dom";
```
> `useMemo` ya se importa en la línea 1 de React.

#### 3B. Agregar lectura de URL params y auto-selección de sección
Dentro del componente `PermisosPage`, DESPUÉS de la definición de `availableSections` (que termina alrededor de la línea 249), agregar:

```js
const location = useLocation();
const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
const urlTab = searchParams.get("tab");

useEffect(() => {
  if (!urlTab) return;
  const approvalTabs = new Set(["approve", "cancellation_requests", "study_enrollments", "waiting"]);
  if (approvalTabs.has(urlTab) && availableSections.includes("gerencia_approvals")) {
    setActiveSection("gerencia_approvals");
  } else if (urlTab === "mine" && availableSections.includes("mine")) {
    setActiveSection("mine");
  }
}, [urlTab, availableSections]);
```

---

### PASO 4: Frontend — `PermisosStatusWidget.jsx` leer parámetros de URL

**Archivo:** `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`

#### 4A. Agregar import
Este archivo NO tiene imports de `react-router-dom`. Agregar después de la línea 1:
```js
import { useLocation } from "react-router-dom";
```

#### 4B. Agregar lectura de search params
Dentro del componente `PermisosStatusWidget`, DESPUÉS de la línea 172 (`const userId = user?.id;`), agregar:

```js
const location = useLocation();
const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
const urlTab = searchParams.get("tab");
const urlSolicitudId = searchParams.get("solicitudId");
const urlEnrollmentId = searchParams.get("enrollmentId");
const urlOpenRecovery = searchParams.get("openRecovery");
```

#### 4C. useEffect para aplicar tab desde URL
DESPUÉS de la definición de `tabs` (que termina alrededor de la línea 873), agregar:

```js
useEffect(() => {
  if (urlTab && tabs.some((t) => t.id === urlTab)) {
    setActiveTab(urlTab);
  }
}, [urlTab, tabs]);
```

#### 4D. useEffect para auto-expandir solicitud desde URL
Agregar después del anterior:

```js
useEffect(() => {
  if (!urlSolicitudId) return;
  const allSolicitudes = [
    ...misSolicitudes,
    ...pendientesParcial,
    ...pendientesFinal,
    ...pendientesAprobadas,
    ...cancellationQueue,
  ];
  const target = allSolicitudes.find((s) => String(s?.id) === String(urlSolicitudId));
  if (target) {
    setSelectedSolicitud(target);
    if (urlOpenRecovery === "true") {
      const initialRows = Array.isArray(target.recovery_plan)
        ? target.recovery_plan.map((r) => ({ ...r }))
        : [];
      setRecoveryRows(initialRows);
      setShowRecoveryModal(true);
    }
  }
}, [urlSolicitudId, urlOpenRecovery, misSolicitudes, pendientesParcial, pendientesFinal, pendientesAprobadas, cancellationQueue]);
```

#### 4E. useEffect para auto-abrir modal de matrícula desde URL
Agregar después del anterior:

```js
useEffect(() => {
  if (!urlEnrollmentId || pendingStudyEnrollments.length === 0) return;
  const target = pendingStudyEnrollments.find(
    (e) => String(e?.id) === String(urlEnrollmentId)
  );
  if (target) {
    setSelectedEnrollment(target);
    setEnrollmentReviewDecision("approve");
    setEnrollmentReviewReason("");
    setShowEnrollmentReviewModal(true);
  }
}, [urlEnrollmentId, pendingStudyEnrollments]);
```

#### 4F. Limpiar URL params después de procesar
Agregar al final de los useEffects de URL:

```js
useEffect(() => {
  if (location.search && (urlTab || urlSolicitudId || urlEnrollmentId || urlOpenRecovery)) {
    const timer = setTimeout(() => {
      window.history.replaceState(null, "", location.pathname);
    }, 500);
    return () => clearTimeout(timer);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

---

### PASO 5: Frontend — `AprobacionPermisosView.jsx` leer parámetros de URL

**Archivo:** `spi_front/src/modules/shared/solicitudes/components/AprobacionPermisosView.jsx`

#### 5A. Agregar import
Este archivo NO tiene imports de `react-router-dom`. Agregar después de los imports existentes:
```js
import { useLocation } from "react-router-dom";
```

#### 5B. Agregar lectura de search params
Dentro del componente, encontrar la variable de estado `stage` (que controla el tab activo) y DESPUÉS de ella, agregar:

```js
const location = useLocation();
const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
const urlTab = searchParams.get("tab");
const urlSolicitudId = searchParams.get("solicitudId");
const urlEnrollmentId = searchParams.get("enrollmentId");
const urlOpenRecovery = searchParams.get("openRecovery");
```

#### 5C. useEffect para mapear tab de URL a stage interno
El `stage` de AprobacionPermisosView usa valores diferentes a los tabs de PermisosStatusWidget. Mapeo:

| `tab` de URL | `stage` de AprobacionPermisosView |
|---|---|
| `"approve"` | `"pending"` |
| `"cancellation_requests"` | `"cancellation_pending"` |
| `"study_enrollments"` | `"study_enrollments"` |
| `"waiting"` | `"pending"` |

Agregar después de la definición de tabs de AprobacionPermisosView:

```js
useEffect(() => {
  if (!urlTab) return;
  const tabToStage = {
    approve: "pending",
    cancellation_requests: "cancellation_pending",
    study_enrollments: "study_enrollments",
    waiting: "pending",
  };
  const targetStage = tabToStage[urlTab];
  if (targetStage) {
    setStage(targetStage);
  }
}, [urlTab]);
```
> **Nota:** Buscar en el archivo cómo se llama la función para cambiar de tab. Puede ser `setStage`, `setActiveTab`, `setActiveStage` o similar. Ajustar el nombre de la función setter según el código real.

#### 5D. useEffect para auto-expandir solicitud
Buscar cómo se selecciona una solicitud en este componente (variable de estado como `selectedSolicitud`, `selectedItem`, `expandedId` o similar, y la función setter correspondiente). Agregar:

```js
useEffect(() => {
  if (!urlSolicitudId) return;
  // Buscar en las listas de datos del componente (pendingList, finalList, etc.)
  const allItems = [
    ...(pendingItems || []),
    ...(pendingFinalItems || []),
    ...(cancellationItems || []),
    ...(approvedItems || []),
  ];
  const target = allItems.find((s) => String(s?.id) === String(urlSolicitudId));
  if (target) {
    // Ajustar según el nombre real de la variable de estado
    setSelectedItem(target);
    if (urlOpenRecovery === "true") {
      // Abrir modal de recovery plan si existe en este componente
      // Si no, la funcionalidad de recovery está en PermisosStatusWidget
    }
  }
}, [urlSolicitudId, urlOpenRecovery, pendingItems, pendingFinalItems, cancellationItems, approvedItems]);
```
> **Nota:** Los nombres de variables (`pendingItems`, `selectedItem`, etc.) deben ajustarse según los nombres reales en `AprobacionPermisosView.jsx`. Leer el archivo para encontrar los nombres correctos.

#### 5E. Limpiar URL params
Agregar al final:

```js
useEffect(() => {
  if (location.search && (urlTab || urlSolicitudId || urlEnrollmentId || urlOpenRecovery)) {
    const timer = setTimeout(() => {
      window.history.replaceState(null, "", location.pathname);
    }, 500);
    return () => clearTimeout(timer);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

---

### PASO 6: Verificación

1. Ejecutar `npm run build` o `npm run dev` en `spi_front` para verificar que no hay errores
2. Ejecutar el backend para verificar que no hay errores de sintaxis
3. Probar cada flujo de notificación:
   - Crear una solicitud de permiso → verificar notificación al solicitante y al aprobador
   - Click en notificación del solicitante → abre tab "Mis solicitudes" con el item seleccionado
   - Click en notificación del aprobador → abre vista de aprobaciones con tab "Aprobacion Parcial" y solicitud seleccionada
   - Probar cancelación → click abre tab "Cancelaciones"
   - Probar matrícula → click abre tab "Matrículas" con modal de revisión
   - Probar recovery plan → click abre vista de aprobaciones con modal de tramos

---

## NOTAS IMPORTANTES

- NO cambiar la estructura de la base de datos
- NO modificar `NotificationBell.jsx` — ya soporta `target_path` en meta (línea 145)
- Los nombres de variables internas en `AprobacionPermisosView.jsx` deben verificarse leyendo el archivo antes de editar
- El parámetro `openRecovery` solo es relevante cuando el usuario puede ver la vista de aprobaciones
- Si un usuario no es approver, las notificaciones de aprobador no le llegarán (el backend solo las envía al `approver_user_id`)
