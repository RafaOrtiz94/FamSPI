# CONTEXT.md — calidad

## 1. Descripción
Módulo de Calidad GXP/ISO 9001. Contiene 17 sub-módulos (CA-01-01 a CA-01-17) que cubren procesos de control de calidad. Cada sub-módulo tiene su propio controller, repository, service, routes y state machine. Todos comparten el prefijo `/api/v1/calidad`.

---

## Sub-módulo CA-01-01: Control de Temperatura

### Endpoints
- **POST /api/v1/calidad/temperature/readings** — `registerReading` — roles: `calidad`, `servicio_tecnico`, `operaciones`
- **GET /api/v1/calidad/temperature/alarms** — `getActiveAlarms` — roles: `calidad`, `gerencia`
- **PUT /api/v1/calidad/temperature/alarms/:alarmId** — `transitionAlarm` — roles: `calidad`

### Flujo
1. Operador registra lectura de termohigrómetro
2. Sistema detecta desviación → genera alarma
3. Calidad evalúa alarma y escala o cierra (state machine)

### Frontend: `/dashboard/calidad/temperatura` → `CA0101Workspace`

---

## Sub-módulo CA-01-02: Limpieza de Áreas

Prefijo: `/api/v1/calidad/cleaning`

### Endpoints
- **POST /cleaning/areas** — `createArea` — roles: `calidad`
- **GET /cleaning/areas** — `getAreas` — roles: `calidad`, `gerencia`
- **POST /cleaning/logs** — `registerCleaning` — roles: `calidad`, `servicio_tecnico`, `operaciones`
- **GET /cleaning/logs** — `getActiveLogs` — roles: `calidad`, `gerencia`
- **PUT /cleaning/logs/:logId** — `transitionLog` — roles: `calidad`

### Frontend: `/dashboard/calidad/limpieza` → `CA0102Workspace`

---

## Sub-módulos CA-01-03 a CA-01-17

Los siguientes sub-módulos siguen el mismo patrón (controller + repository + service + stateMachine + routes):

| Código | Prefijo | Descripción | Frontend |
|--------|---------|-------------|----------|
| CA-01-03 | `/api/v1/calidad/buenas-practicas` | Buenas Prácticas GXP | `CA0103Workspace` |
| CA-01-04 | (No en registerRoutes) | Control de Plagas | `CA0104Workspace` |
| CA-01-05 | `/api/v1/calidad/documentos` | Gestión Documental | `CA0105Workspace` |
| CA-01-06 | `/api/v1/calidad/recall` | Recall de Productos | `CA0106Workspace` |
| CA-01-07 | `/api/v1/calidad/quejas` | Quejas de Clientes | `CA0107Workspace` |
| CA-01-08 | `/api/v1/calidad/refrigerados` | Control Refrigerados | `CA0108Workspace` |
| CA-01-09 | `/api/v1/calidad/capa` | CAPA (Corrective Action) | `CA0109Workspace` |
| CA-01-10 | `/api/v1/calidad/riesgos` | Gestión de Riesgos | `CA0110Workspace` |
| CA-01-11 | `/api/v1/calidad/incidentes` | Incidentes/Derrames | `CA0111Workspace` |
| CA-01-12 | `/api/v1/calidad/higiene` | Higiene de Personal | `CA0112Workspace` |
| CA-01-13 | `/api/v1/calidad/comunicaciones` | Comunicaciones Internas | `CA0113Workspace` |
| CA-01-14 | `/api/v1/calidad/areas-calificadas` | Áreas Calificadas | `CA0114Workspace` |
| CA-01-15 | `/api/v1/calidad/auditorias` | Auditorías Internas | `CA0115Workspace` |
| CA-01-16 | `/api/v1/calidad/muestreo` | Muestreo | `CA0116Workspace` |
| CA-01-17 | `/api/v1/calidad/tecnovigilancia` | Tecnovigilancia | `CA0117Workspace` |

**Nota CA-01-04**: El backend `ca0104.routes.js` existe pero NO está registrado en `registerRoutes.js`. El frontend sí tiene ruta `/dashboard/calidad/plagas` → `CA0104Workspace`. Posible módulo incompleto o en desarrollo.

## 3. Patrón de flujo general (todos los sub-módulos)

1. Operador/Calidad registra un evento/registro
2. State machine maneja transiciones de estado (borrador → activo → cerrado/escalado)
3. Jefe de calidad o gerencia revisa y valida
4. Registros almacenados en DB con trazabilidad

## 4. Validaciones
- Cada sub-módulo tiene su propia state machine (`ca01XX StateMachine.service.js`)
- Roles predominantes: `calidad`, `gerencia`, `servicio_tecnico`, `operaciones`
- Todos los endpoints requieren `verifyToken`

## 5. Base de datos
- Migración `130_ca0101_temperature_control.sql` confirmada en código abierto
- Migración `132_ca0104_pest_control.sql` confirmada en código abierto
- No verificado en DB directamente

## 6. Relaciones
- `signature`: firma digital en documentos de calidad
- `audit-prep`: documentos de calidad son auditables
- `notifications`: probable notificación en alarmas y escalaciones
- `servicio`: técnicos participan en limpieza, desinfección

## 7. Frontend asociado
- Dashboard: `/dashboard/calidad` → `DashboardCalidad`
- Todas las rutas bajo `/dashboard/calidad/[proceso]`
- Roles con acceso: `calidad`, `jefe_calidad`, y roles extendidos según sub-módulo

## 8. Riesgos detectados
- CA-01-04 backend no registrado en `registerRoutes.js` pero frontend tiene ruta activa
- CA-01-16 y CA-01-17 tienen tamaños muy pequeños (service: 507 y 337 bytes) — posiblemente incompletos
- 86 archivos en un solo directorio — gestión compleja

## 9. Notas técnicas
- Patrón uniforme: controller + repository + service + stateMachine por cada CA
- `ca0114Calibration.service.js`: sub-servicio específico para calibración de áreas calificadas
- Directorio `integrations/` y `services/` presentes para funcionalidades compartidas entre CAs
