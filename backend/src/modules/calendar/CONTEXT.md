# CONTEXT.md — calendar

## 1. Descripción
Módulo de calendario compartido. Contiene únicamente un service (`calendar.service.js`) — sin controller ni routes expuestas. Es un módulo de servicio interno que provee funcionalidad de calendario a otros módulos.

## 2. Endpoints

**Ninguno** — este módulo no expone endpoints HTTP propios.

## 3. Uso interno

`calendar.service.js` (6KB) es consumido internamente por:
- `schedules`: para cálculo de disponibilidad y feriados
- `attendance`: para validación de días laborales
- `permisos`/`vacaciones`: para cálculo de días hábiles

## 4. Validaciones
- N/A — módulo de servicio interno

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `schedules`, `attendance`, `permisos`, `vacaciones`: consumidores principales
- `security.holidays.ec.js`: complementario para feriados Ecuador (en módulo security)

## 7. Frontend asociado
- No aplica — servicio interno

## 8. Riesgos detectados
- Sin rutas — no se puede testear externamente
- Cambios en este service afectan múltiples módulos

## 9. Notas técnicas
- Solo existe `calendar.service.js` — sin controller ni routes
- Módulo de infraestructura compartida
