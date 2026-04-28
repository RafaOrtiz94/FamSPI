# Plan de Implementación: Flujo Operacional de Asistencia

Se ha elaborado el siguiente plan para cumplir con las marcaciones operacionales, la llegada a destino, y la doble marcación de almuerzo en el acta.

## Resumen del requerimiento
1. **Llegada a Destino**: Nuevo endpoint que marca la llegada al hotel/destino. Si es después del horario laboral, regulariza el acta a las 18:00 pero sigue contando el tiempo real en la excepción operacional. El siguiente paso sugerido será "Entrada Cliente".
2. **Salida/Entrada Almuerzo durante Operación**: Si el usuario está en salida operacional y marca almuerzo, el sistema registrará en la tabla oficial `14:00:00` y `15:00:00` (para el acta), pero guardará en la base de datos la hora real exacta y la ubicación de esa marcación.
3. **Flujo Cíclico**: Tras una "Entrada Cliente", sigue "Salida Cliente". Tras la salida, si no retorna a oficina/viaje, el siguiente paso debe ser otra "Entrada Cliente".

## Open Questions

> [!IMPORTANT]
> **Preguntas para el usuario antes de proceder:**
> 1. **Doble marcación de almuerzo**: Para reflejar la "hora real", crearé dos nuevas columnas en la tabla `user_attendance_records` (`real_lunch_start_time` y `real_lunch_end_time`). ¿Estás de acuerdo con ejecutar esta migración de base de datos?
> 2. **Llegada a Destino (Regularización a 6PM)**: Entiendo que si marcan llegada a destino a las p.ej. 20:00, el acta (`exit_time`) se cierra a las 18:00. ¿Si llegan a destino a las 15:00, no se altera el acta hasta que marquen otra salida más tarde?
> 3. **Almuerzo en Operación**: Si alguien marca "Salida Almuerzo" a las 13:00, el acta dirá 14:00. Si luego marca "Entrada Almuerzo" a las 13:45, el acta dirá 15:00. ¿Esto es siempre así si hay una "salida operacional" abierta?

## Proposed Changes

### 1. Migración de Base de Datos
#### [NEW] `backend/migrations/151_attendance_operational_updates.sql`
- Agregar columnas `real_lunch_start_time` (TIMESTAMPTZ) y `real_lunch_end_time` (TIMESTAMPTZ) a `user_attendance_records`.
- *(Nota: No usaremos Neon directamente por ahora por error de credenciales, pero dejaré el SQL listo y documentado, y lo aplicaremos si se me proporcionan credenciales o el entorno lo permite. Por ahora modificaré el código para usar estas columnas)*.

### 2. Modificaciones al Controlador de Asistencia
#### [MODIFY] `backend/src/modules/attendance/attendance.controller.js`
- **Nuevo endpoint `clockInDestino`**:
  - Validará que exista una excepción operacional activa.
  - Actualizará la excepción operacional con `status = 'AT_DESTINATION'` y `arrival_time = now`.
  - Si la hora actual es mayor o igual a las 18:00, actualizará el `user_attendance_records.exit_time` a las `18:00:00` de ese día para el acta (regularización).
  - Devolverá como sugerencia `nextStep: 'entrada_cliente'`.
- **Modificar `clockOutLunch`**:
  - Evaluará `getActiveExceptionByFlow({ userId, flow: "operational" })`.
  - Si hay operación activa, actualizará `lunch_start_time` con la fecha actual a las `14:00:00` y `real_lunch_start_time` con la hora `now`.
  - Si no hay operación activa, actualizará ambas columnas con `now`.
- **Modificar `clockInLunch`**:
  - Similar al anterior, pero para `lunch_end_time` (a las `15:00:00`) y `real_lunch_end_time` (a la hora `now`).
- **Ajustar Flujo Siguiente en `clockInField` / `clockOutField`**:
  - En `clockInField` responder con `nextStep: 'salida_cliente'`.
  - En `clockOutField` responder con `nextStep: returnToOffice ? 'retorno_oficina_viaje' : 'entrada_cliente'`.

### 3. Rutas de Asistencia
#### [MODIFY] `backend/src/modules/attendance/attendance.routes.js`
- Exponer `router.post("/marcar/llegada-destino", verifyToken, controller.clockInDestino);`.
- Exportar `clockInDestino` en el controlador.

## Verification Plan
1. Se añadirá el endpoint de "Llegada a Destino".
2. Se modificará la lógica del almuerzo.
3. Se verificará que el código esté listo para interactuar con las nuevas columnas de la base de datos para la hora real del almuerzo.
