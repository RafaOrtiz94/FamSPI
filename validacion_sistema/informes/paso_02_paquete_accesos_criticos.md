# PASO 02 - PAQUETE DE ACCESOS CRITICOS

## Objetivo
Traducir los hallazgos confirmados del Paso 1 a un paquete minimo de cambios seguros para `dashboard`, `notifications`, `users`, `departments` e `inventario`, minimizando regresiones en frontend y procesos internos.

## Regla aplicada en este paso
- No se propone cerrar endpoints de lectura que hoy alimentan varias pantallas activas sin antes separar contratos.
- Se prioriza cerrar mutaciones expuestas y mover autorizacion defectuosa a middleware de ruta.
- Se usa evidencia de backend, frontend y URS; no se asumen actores adicionales fuera de lo encontrado.

---

## Confirmaciones relevantes

### Dashboard comercial
- La ruta `GET /api/v1/dashboard/comercial/summary` solo valida JWT en `backend/src/modules/dashboard/dashboard.routes.js`.
- La autorizacion actual esta dentro del controlador y usa `middlewares/auth.requireRole`, lo que deja un flujo defectuoso.
- El frontend permite acceder a `/dashboard/comercial` por URL directa porque la ruta no tiene `ProtectedRoute` dedicado.

### Usuarios
- `GET /users` hoy alimenta:
  - panel de Talento Humano
  - panel de TI
  - reporte de asistencia
  - pagina de clientes para seleccionar asesores
- `POST/PUT/DELETE /users` no tienen consumidores mas alla de la UI administrativa de usuarios.

### Departamentos
- `GET /departments` hoy alimenta:
  - panel de Talento Humano
  - panel de TI
  - UI administrativa de usuarios/departamentos
- No se detectaron consumidores comerciales ni operativos fuera de esos contextos.

### Notificaciones
- No se detecto uso de `createNotification()` desde frontend.
- Los productores reales del sistema usan `notifications.service` o `notificationManager` directamente, no `POST /notifications`.

### Inventario
- `createUnidad()` si se usa desde frontend comercial en `CreateRequestModal`.
- `captureSerial()`, `assignUnidad()`, `cambiarEstadoUnidad()` y `registrarMovimiento()` no se detectaron como llamadas directas amplias desde frontend general.
- `requests.service` invoca funciones de inventario directamente, por lo que endurecer rutas no rompe esos flujos internos.

---

## Matriz minima de cambios seguros

### 1. Dashboard comercial
Endpoint:
- `GET /api/v1/dashboard/comercial/summary`

Estado actual:
- JWT en ruta.
- Autorizacion manual en controlador.

Cambio minimo propuesto:
- Mover `requireRole` a middleware de ruta.
- Usar `middlewares/roles.requireRole`.
- Roles backend propuestos:
  - `comercial`
  - `jefe_comercial`
  - `backoffice_comercial`
  - `acp_comercial`
  - `gerencia`

Ajuste frontend recomendado:
- Agregar `ProtectedRoute` especifico a `/dashboard/comercial`.
- Roles frontend propuestos:
  - `comercial`
  - `jefe_comercial`
  - `backoffice_comercial`
  - `acp_comercial`
  - `gerencia`
  - `gerencia_general`
  - `gerente_general`
  - `director`

Riesgo de regresion:
- Bajo.
- El `RoleRedirect` ya envia a dashboards por rol; el cambio bloquea acceso directo impropio.

Validaciones obligatorias:
- Usuario `comercial` obtiene `200`.
- Usuario `jefe_comercial` obtiene `200`.
- Usuario `gerencia_general` obtiene `200`.
- Usuario `ti` recibe `403`.
- Verificar que ante `403` no se ejecuten consultas del servicio.

### 2. Usuarios
Endpoints:
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `POST /api/v1/users`
- `PUT /api/v1/users/:id`
- `DELETE /api/v1/users/:id`

Estado actual:
- Todos con JWT solamente.

Cambio minimo propuesto:
- Mantener `GET /users` temporalmente sin endurecimiento fuerte en esta fase.
  Motivo:
  - tiene varios consumidores activos de roles distintos
  - mezclar lectura operativa y administracion en un solo endpoint hoy impide un cierre simple sin romper UI
- Endurecer de inmediato:
  - `GET /users/:id`
  - `POST /users`
  - `PUT /users/:id`
  - `DELETE /users/:id`

Roles backend propuestos para endpoints administrativos:
- `talento_humano`
- `jefe_talento_humano`
- `gerencia`
- `ti`
- `jefe_ti`
- `admin_ti`
- `admin`
- `administrador`

Ajuste frontend recomendado:
- Agregar `ProtectedRoute` especifico a `/dashboard/talento-humano/usuarios` con la misma matriz.

Riesgo de regresion:
- Bajo para escritura.
- Medio si se endurece `GET /users` en esta misma fase; por eso no se recomienda hacerlo aun.

Deuda residual aceptada en esta fase:
- `GET /users` sigue amplio hasta separar:
  - listado administrativo completo
  - listado operativo reducido para asesores/seleccion
  - listado para reportes RH

Validaciones obligatorias:
- `talento_humano` puede crear, editar y eliminar usuarios.
- `ti` puede acceder a la UI administrativa de usuarios.
- `comercial` no puede crear, editar ni eliminar usuarios.
- `GET /users` sigue funcionando para:
  - `Clientes`
  - `DashboardTI`
  - `DashboardTalento`
  - `AsistenciaReportes`

### 3. Departamentos
Endpoints:
- `GET /api/v1/departments`
- `GET /api/v1/departments/:id`
- `POST /api/v1/departments`
- `PUT /api/v1/departments/:id`
- `DELETE /api/v1/departments/:id`

Estado actual:
- Todos con JWT solamente.

Cambio minimo propuesto:
- Endurecer todas las rutas del modulo.

Roles backend propuestos:
- `talento_humano`
- `jefe_talento_humano`
- `gerencia`
- `ti`
- `jefe_ti`
- `admin_ti`
- `admin`
- `administrador`

Ajuste frontend recomendado:
- Agregar `ProtectedRoute` especifico a `/dashboard/talento-humano/departamentos` con la misma matriz.

Riesgo de regresion:
- Bajo.
- No se detectaron consumidores fuera de TH/TI/gerencia.

Validaciones obligatorias:
- `talento_humano` y `ti` pueden listar/crear/editar/eliminar.
- `comercial` recibe `403`.
- `DashboardTalento`, `DashboardTI` y `Usuarios` siguen cargando departamentos.

### 4. Notificaciones
Endpoint:
- `POST /api/v1/notifications`

Estado actual:
- Cualquier usuario autenticado puede enviar a cualquier `user_id`.

Cambio minimo propuesto:
- Para usuarios comunes: forzar `payload.user_id = req.user.id`.
- Solo permitir envio a terceros si el actor tiene rol privilegiado.

Roles backend propuestos para envio a terceros:
- `ti`
- `jefe_ti`
- `admin_ti`
- `admin`
- `administrador`

Riesgo de regresion:
- Muy bajo.
- No se detecto consumidor frontend de esta ruta.
- Los productores internos no dependen del endpoint HTTP.

Validaciones obligatorias:
- Usuario comun creando notificacion con `user_id` ajeno termina creando para si mismo o recibe `403` segun implementacion elegida.
- Rol `ti` puede crear para un tercero.
- `GET`, `PATCH`, `DELETE` de notificaciones propias siguen sin cambios.
- Procesos internos con `notificationManager` siguen funcionando.

Decision recomendada:
- Implementar `403` cuando `payload.user_id` apunte a tercero sin rol privilegiado.
- No hacer silent override a menos que se quiera compatibilidad oculta.

### 5. Inventario
Endpoints de lectura:
- `GET /api/v1/inventario`
- `GET /api/v1/inventario/equipos-disponibles`
- `GET /api/v1/inventario/equipos-cliente/:cliente_id`
- `GET /api/v1/inventario/modelos`

Endpoints de escritura:
- `POST /api/v1/inventario/equipos-unidad`
- `POST /api/v1/inventario/equipos-unidad/:id/serial`
- `POST /api/v1/inventario/equipos-unidad/:id/asignar`
- `POST /api/v1/inventario/equipos-unidad/:id/cambiar-estado`
- `POST /api/v1/inventario/movimiento`

Estado actual:
- Todo el modulo usa solo JWT.

Cambio minimo propuesto:
- Mantener lectura sin endurecimiento fuerte en esta fase.
  Motivo:
  - consumo operativo amplio desde comercial y servicio
  - no existe aun separacion por perfil de lectura
- Endurecer escritura por accion.

Roles backend propuestos para `POST /equipos-unidad`:
- `comercial`
- `jefe_comercial`
- `backoffice_comercial`
- `acp_comercial`
- `servicio_tecnico`
- `tecnico`
- `jefe_tecnico`
- `jefe_servicio_tecnico`
- `operaciones`
- `jefe_operaciones`
- `logistica`
- `jefe_logistica`
- `gerencia`
- `ti`
- `admin`

Roles backend propuestos para:
- `POST /equipos-unidad/:id/serial`
- `POST /equipos-unidad/:id/asignar`
- `POST /equipos-unidad/:id/cambiar-estado`
- `POST /movimiento`

Roles:
- `servicio_tecnico`
- `tecnico`
- `jefe_tecnico`
- `jefe_servicio_tecnico`
- `operaciones`
- `jefe_operaciones`
- `logistica`
- `jefe_logistica`
- `finanzas`
- `jefe_finanzas`
- `gerencia`
- `ti`
- `admin`

Riesgo de regresion:
- Bajo a medio.
- `POST /equipos-unidad` debe conservar acceso comercial porque se usa en el flujo de creacion de solicitudes.
- Endurecer las otras mutaciones por ruta no afecta los usos internos de `requests.service`.

Validaciones obligatorias:
- `comercial` puede crear unidad desde `CreateRequestModal`.
- `comercial` no puede cambiar estado manualmente por API si no esta en la lista final.
- `servicio_tecnico` puede cambiar estado.
- `finanzas` puede registrar movimientos.
- Flujo de solicitud que dispara `captureSerial`, `assignUnidad` o `cambiarEstadoUnidad` desde servicio interno sigue intacto.

---

## Decision tecnica transversal

### Middleware de autorizacion a usar en este paquete
Usar `backend/src/middlewares/roles.js` para los nuevos cierres de ruta.

Motivo:
- soporta aliases y grupos
- entiende `role`, `scope`, `roles` y `scopes`
- evita depender de la jerarquia simplificada de `middlewares/auth.js`

No hacer en esta fase:
- reemplazo global de todos los `requireRole` del sistema

Eso queda para una fase posterior de homogenizacion.

---

## Orden recomendado de implementacion
1. `dashboard/comercial/summary`
2. `POST /notifications`
3. `departments` completo
4. `users` administrativos
5. `inventario` escritura
6. `ProtectedRoute` especificos para UI de usuarios, departamentos y dashboard comercial

## Criterio de salida del Paso 2
El paso queda listo para implementacion cuando:
- la matriz de roles por endpoint este congelada
- se acepte mantener `GET /users` y lecturas de inventario abiertos temporalmente
- se definan las pruebas de no regresion para frontend y backend

## Siguiente paso
- Aplicar este paquete en codigo con cambios pequeños, prueba por prueba, y luego registrar el resultado en `informes`.
