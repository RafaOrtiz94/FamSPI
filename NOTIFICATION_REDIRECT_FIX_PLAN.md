# Plan: Corrección de Redirecciones de Notificaciones

## Fecha: 2026-04-01
## Alcance: Permisos, Vacaciones, Cancelaciones, Tramos (Recovery Plan) y Matrículas

---

## 1. DIAGNÓSTICO ACTUAL

### 1.1 Arquitectura de Notificaciones

```
Backend (notificationManager.sendNotification)
  └─ Crea notificación en DB (tabla: notifications)
      └─ Campo `meta` (JSONB) almacena IDs y datos contextuales
          └─ Frontend (NotificationBell.jsx) lee notificaciones
              └─ resolveTargetPath() determina URL de redirección
                  └─ navigate(targetPath) navega al hacer click
```

### 1.2 Flujo de Resolución de URL en NotificationBell.jsx

```
1. ¿meta.target_path existe?  →  SÍ: usarlo directamente
                                 NO: pasar a paso 2
2. resolveFallbackTargetPath() → construye URL por source prefix + meta IDs
3. ¿URL construida?           →  SÍ: navigate()
                                 NO: null (click no hace nada)
```

**Archivo:** `spi_front/src/core/ui/components/NotificationBell.jsx` (líneas 118-155)

### 1.3 Arquitectura de Vistas en PermisosPage

La página `PermisosPage.jsx` tiene 5 secciones renderizadas por `activeSection`:

| Sección | Componente | Quién lo ve |
|---------|-----------|-------------|
| `"mine"` | `PermisosStatusWidget` | Todos los usuarios |
| `"collaborators"` | `PermisosColaboradoresWidget` | Talent role |
| `"global"` | `PermisosGlobalRequestsWidget` | Jefe TI/Financiero |
| `"gerencia_album"` | `PermisosColaboradoresAlbum` | Gerencia General |
| `"gerencia_approvals"` | `AprobacionPermisosView` | Jefes y Gerencia |

**`PermisosStatusWidget`** tiene tabs internos: `mine`, `approve`, `cancellation_requests`, `study_enrollments`, `waiting`

**`AprobacionPermisosView`** tiene tabs internos: `pending`, `pending_final`, `cancellation_pending`, `study_enrollments`, `approved`

**Ninguno de los dos componentes lee parámetros de URL actualmente.**

### 1.4 Problemas Encontrados

#### PROBLEMA 1: Permisos y Vacaciones — solicitudId se envía pero se ignora

| Aspecto | Detalle |
|---------|---------|
| **Notificación** | Todas las de `source: "permisos_vacaciones"` y `source: "vacaciones"` |
| **Backend meta** | `{ solicitud_id: <id>, tipo_solicitud: "..." }` ✅ |
| **URL construida** | `/dashboard/talento-humano/permisos?solicitudId=<id>` ✅ |
| **Raíz del bug** | `PermisosStatusWidget.jsx` **NO lee `useSearchParams()` ni `location.search`** |
| **Resultado** | El usuario llega a la página pero la `solicitudId` se ignora completamente |

#### PROBLEMA 2: Cancelaciones — No redirige a la tab correcta

| Aspecto | Detalle |
|---------|---------|
| **Notificación** | Cancelación pendiente/revisada |
| **URL construida** | `/dashboard/talento-humano/permisos?solicitudId=<id>` |
| **Raíz del bug** | No pasa parámetro `tab`. Se queda en tab `"mine"` por defecto |
| **Resultado** | Usuario llega a "Mis solicitudes" en vez de "Cancelaciones" |

#### PROBLEMA 3: Tramos (Recovery Plan) — No redirige a la acción correcta

| Aspecto | Detalle |
|---------|---------|
| **Notificación** | Recovery plan actualizado |
| **URL construida** | `/dashboard/talento-humano/permisos?solicitudId=<id>` |
| **Raíz del bug** | No pasa parámetro `openRecovery`. No auto-abre modal de tramos |
| **Resultado** | Usuario llega a la página pero no se abre el editor de tramos |

#### PROBLEMA 4: Matrículas — No redirige en absoluto

| Aspecto | Detalle |
|---------|---------|
| **Notificación** | Matrícula pendiente/validada/rechazada |
| **Backend meta** | `{ enrollment_id: <id> }` — **NO tiene `solicitud_id`** |
| **URL construida** | `null` (NotificationBell busca `solicitud_id` y no lo encuentra) |
| **Resultado** | **Click en la notificación no hace nada** |

#### PROBLEMA 5: No `target_path` en ninguna notificación de permisos/vacaciones

Las notificaciones de permisos y vacaciones NO establecen `target_path` en meta. Dependen completamente del fallback del frontend que no funciona correctamente.

---

## 2. SOLUCIÓN PROPUESTA

### Estrategia: Enfoque híbrido (Backend + Frontend)

1. **Backend**: Agregar `target_path` explícito en meta de cada notificación
2. **Frontend**: Hacer que `PermisosStatusWidget`, `AprobacionPermisosView` y `PermisosPage` lean URL params

### 2.1 Cambios en Backend

#### Archivo: `backend/src/modules/permisos/permisos.service.js`

**A. Matrícula pendiente de validación (línea ~1463)**
```js
meta: { enrollment_id: rows[0]?.id, user_id: actorId, status: "pending_validation",
  target_path: `/dashboard/talento-humano/permisos?tab=study_enrollments&enrollmentId=${rows[0]?.id}` },
```

**B. Revisión de matrícula (línea ~1567)**
```js
meta: { enrollment_id: updated?.id, decision: normalizedDecision, reason: reviewReason,
  target_path: `/dashboard/talento-humano/permisos?tab=mine` },
```

**C. Solicitud enviada — al solicitante (línea ~1919)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}` },
```

**D. Solicitud enviada — al aprobador (línea ~1937)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${rows[0].id}` },
```

**E. Aprobación parcial/final (línea ~2039)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}` },
```

**F. Justificantes subidos (línea ~2184)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${solicitud.id}` },
```

**G. Aprobación final (línea ~2233)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${update.rows[0].id}` },
```

**H. Rechazo (línea ~2487)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}` },
```

**I. Cancelación pendiente (línea ~2597)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=cancellation_requests&solicitudId=${updated.id}` },
```

**J. Cancelación ejecutada (línea ~2640)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${updated.id}` },
```

**K. Revisión de cancelación (línea ~2774)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=cancellation_requests&solicitudId=${updated.id}` },
```

**L. Recovery plan (línea ~2958)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${updated.id}&openRecovery=true` },
```

#### Archivo: `backend/src/modules/vacaciones/vacaciones.service.js`

**M. Vacaciones enviadas — al solicitante (línea ~733)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}` },
```

**N. Vacaciones enviadas — al aprobador (línea ~745)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${rows[0].id}` },
```

**O. Vacaciones aprobadas/rechazadas (línea ~848)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${updated[0].id}` },
```

**P. Vacaciones reprogramadas/canceladas (línea ~927)**
```js
meta: { ...existing, target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${solicitud.id}` },
```

### 2.2 Cambios en Frontend

#### Archivo: `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx`

- Agregar `useLocation` de `react-router-dom`
- Leer `tab`, `solicitudId`, `enrollmentId`, `openRecovery` de URL params
- useEffect para cambiar `activeTab` según `tab` de URL
- useEffect para auto-expandir solicitud seleccionada
- useEffect para auto-abrir modal de matrícula
- useEffect para auto-abrir modal de recovery plan
- useEffect para limpiar URL params después de procesar

#### Archivo: `spi_front/src/modules/shared/solicitudes/components/AprobacionPermisosView.jsx`

- Agregar `useLocation` de `react-router-dom`
- Mapear `tab` de URL a `stage` interno:
  - `tab=approve` → `stage="pending"`
  - `tab=cancellation_requests` → `stage="cancellation_pending"`
  - `tab=study_enrollments` → `stage="study_enrollments"`
- useEffect para cambiar `stage` según parámetros de URL
- useEffect para auto-expandir solicitud seleccionada
- useEffect para limpiar URL params

#### Archivo: `spi_front/src/modules/shared/solicitudes/pages/PermisosPage.jsx`

- Agregar `useLocation` de `react-router-dom`
- Mapear `tab` de URL a sección activa:
  - `tab` que corresponda a approval (`approve`, `cancellation_requests`, `study_enrollments`, `waiting`) → `activeSection="gerencia_approvals"`
  - `tab=mine` → `activeSection="mine"`
- El componente hijo (`PermisosStatusWidget` o `AprobacionPermisosView`) luego lee el `tab` de URL internamente

---

## 3. MATRIZ DE COMPORTAMIENTO ESPERADO

| Notificación | URL | PermisosPage sección | Componente | Tab interno |
|---|---|---|---|---|
| Solicitud enviada (solicitante) | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Solicitud enviada (aprobador) | `?tab=approve&solicitudId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"pending"` |
| Aprobación parcial/final | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Justificantes subidos | `?tab=approve&solicitudId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"pending_final"` |
| Aprobación final | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Rechazo | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Cancelación pendiente | `?tab=cancellation_requests&solicitudId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"cancellation_pending"` |
| Cancelación ejecutada | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Revisión de cancelación | `?tab=cancellation_requests&solicitudId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"cancellation_pending"` |
| Recovery plan | `?tab=approve&solicitudId=X&openRecovery=true` | `"gerencia_approvals"` | AprobacionPermisosView | `"pending"` |
| Matrícula pendiente | `?tab=study_enrollments&enrollmentId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"study_enrollments"` |
| Matrícula validada/rechazada | `?tab=mine` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Vacaciones enviada (solicitante) | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Vacaciones enviada (aprobador) | `?tab=approve&solicitudId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"pending"` |
| Vacaciones aprobadas/rechazadas | `?tab=mine&solicitudId=X` | `"mine"` | PermisosStatusWidget | `"mine"` |
| Vacaciones reprogramada/cancelada | `?tab=approve&solicitudId=X` | `"gerencia_approvals"` | AprobacionPermisosView | `"pending"` |

---

## 4. ARCHIVOS AFECTADOS

### Backend (2 archivos)
| Archivo | Cambio |
|---------|--------|
| `backend/src/modules/permisos/permisos.service.js` | Agregar `target_path` a 12 notificaciones |
| `backend/src/modules/vacaciones/vacaciones.service.js` | Agregar `target_path` a 4 notificaciones |

### Frontend (3 archivos)
| Archivo | Cambio |
|---------|--------|
| `spi_front/src/modules/shared/solicitudes/components/PermisosStatusWidget.jsx` | Leer URL params, auto-navegar tabs y expandir items |
| `spi_front/src/modules/shared/solicitudes/components/AprobacionPermisosView.jsx` | Leer URL params, auto-navegar tabs y expandir items |
| `spi_front/src/modules/shared/solicitudes/pages/PermisosPage.jsx` | Leer URL params para seleccionar sección correcta |

### Sin cambios necesarios
| Archivo | Razón |
|---------|-------|
| `spi_front/src/core/ui/components/NotificationBell.jsx` | Ya soporta `target_path` del meta (línea 145) |

---

## 5. ORDEN DE IMPLEMENTACIÓN

1. **Backend**: Agregar `target_path` a todas las notificaciones (permisos.service.js + vacaciones.service.js)
2. **Frontend - PermisosPage**: Agregar lectura de URL params para `activeSection`
3. **Frontend - PermisosStatusWidget**: Agregar lectura de URL params y efectos de auto-navegación
4. **Frontend - AprobacionPermisosView**: Agregar lectura de URL params y efectos de auto-navegación
5. **Testing**: Verificar cada flujo de notificación haciendo click desde el campana

---

## 6. NOTAS TÉCNICAS

- El campo `meta` en la tabla `notifications` es `JSONB`, por lo que agregar `target_path` es un cambio no destructivo
- `NotificationBell.jsx:145-153` ya soporta `target_path` en meta
- Los parámetros de URL se limpian con `window.history.replaceState` después de procesarlos
- Si un usuario no tiene permisos de approver, la tab `approve` no existirá en PermisosStatusWidget. El useEffect manejará esto con `tabs.some()` — si la tab no existe, no cambia nada
- Para usuarios que ven `AprobacionPermisosView` como vista principal (jefes/gerencia), las notificaciones de aprobación los llevan a esa vista con el tab correcto
