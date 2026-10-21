# Plan Maestro - Asistencia, Salidas Operacionales y UX Movil

## Objetivo
Aplicar las 20 recomendaciones de mejora orientadas a facilidad de uso, con foco en:

- `asistencia`
- `salidas operacionales`
- `atajos iPhone` / deep-links
- `sesion y continuidad de uso`
- `permisos` integrados a asistencia
- `cronogramas / visitas` integrados a marcacion
- `viaticos` como consecuencia operacional

El objetivo final es dejar un sistema mas completo, mas claro y mas resistente a errores de uso real, sin romper el comportamiento actual que ya depende de:

- `AttendanceWidget`
- `AttendanceAction`
- `attendanceApi`
- `attendance.controller.js`
- `attendance.routes.js`
- `auth.controller.js`
- `AuthContext.jsx`
- `ProtectedRoute.jsx`

## Fuente de contexto verificada

### Backend
- `backend/src/modules/attendance/CONTEXT.md`
- `backend/src/modules/attendance/attendance.routes.js`
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/auth/auth.controller.js`
- `backend/src/middlewares/auth.js`

### Frontend
- `spi_front/src/core/ui/widgets/AttendanceWidget.jsx`
- `spi_front/src/modules/shared/pages/AttendanceAction.jsx`
- `spi_front/src/modules/shared/pages/MobileShortcuts.jsx`
- `spi_front/src/core/api/attendanceApi.js`
- `spi_front/src/core/auth/AuthContext.jsx`
- `spi_front/src/core/auth/ProtectedRoute.jsx`
- `spi_front/src/routes/AppRoutes.jsx`

## Reglas de ejecucion

1. Ninguna fase debe pisar a la anterior.
2. Ningun agente debe editar al mismo tiempo el mismo archivo.
3. Cada fase debe cerrar con validacion funcional antes de abrir la siguiente.
4. Cuando una fase crea contratos o estados nuevos, las fases posteriores deben consumirlos, no redefinirlos.
5. Toda mejora visual debe respetar `DESIGN.md`.
6. Todo cambio de flujo debe mantenerse consistente en:
   - `AttendanceWidget`
   - `AttendanceAction`
   - `MobileShortcuts`
   - endpoints backend
7. Si una mejora requiere DB, primero validar Neon y luego crear migracion idempotente.

## Las 20 recomendaciones, agrupadas por dominio

### Dominio A - Flujo unificado
1. Unificar flujo de `AttendanceWidget` y `AttendanceAction`.
2. Mostrar siempre el siguiente paso principal.
3. Mostrar estado de sesion antes de marcar.
4. Mantener contexto de atajo tras login.
5. Crear vista movil realmente optimizada para iPhone.

### Dominio B - Claridad operativa
6. Timeline visual de jornada.
7. Errores operativos claros.
8. Cola/reintento ante fallas de red.
9. Confirmacion visual de geolocalizacion.
10. Asistente corto para salidas operacionales.

### Dominio C - Inteligencia por contexto
11. Autocompletar clientes desde cronograma.
12. Ocultar opciones irrelevantes segun rol/estado.
13. Resumen del dia en dashboard.
14. Reintento rapido de marcaciones fallidas.
15. Visibilidad permanente de salida operacional abierta.

### Dominio D - Automatizacion y ayudas
16. Recordatorios inteligentes.
17. Integracion visible de permisos/vacaciones con asistencia.
18. Bandeja personal de acciones pendientes.
19. Reduccion de campos manuales con contexto conocido.
20. Ayuda contextual breve por modulo/flujo.

## Arquitectura de ejecucion por dos IAs

### IA-1
Enfocada en:

- backend de asistencia
- contratos API
- auth/sesion
- estados operacionales
- integraciones entre asistencia, permisos, cronogramas y viaticos

Archivos primarios de IA-1:

- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendance.routes.js`
- `backend/src/modules/attendance/*`
- `backend/src/modules/auth/auth.controller.js`
- `backend/src/middlewares/auth.js`
- migraciones si aplican

### IA-2
Enfocada en:

- UX/UI
- deep-links y mobile shortcuts
- dashboard/widget
- mensajes, ayudas y continuidad de flujo

Archivos primarios de IA-2:

- `spi_front/src/core/ui/widgets/AttendanceWidget.jsx`
- `spi_front/src/modules/shared/pages/AttendanceAction.jsx`
- `spi_front/src/modules/shared/pages/MobileShortcuts.jsx`
- `spi_front/src/core/api/attendanceApi.js`
- `spi_front/src/core/auth/AuthContext.jsx`
- `spi_front/src/core/auth/ProtectedRoute.jsx`

### Regla de no colision
- IA-1 no toca frontend salvo contrato documentado.
- IA-2 no toca backend salvo para documentar dependencias.
- Los puntos de cruce se hacen por fases de handoff.

## Estrategia de fases

Las fases estan ordenadas para que cada una habilite a la siguiente.

---

## Fase 0 - Baseline y observabilidad

### Objetivo
Congelar el comportamiento actual y dejar herramientas para medir el impacto.

### Recomendaciones cubiertas
- 3
- 7
- 14
- 15

### Trabajo IA-1
- Auditar respuestas `401`, `409`, `500` de endpoints de asistencia.
- Identificar todos los `message`, `code`, `nextStep`, `data` usados por asistencia.
- Mapear estados reales de `attendance_exceptions`, `user_attendance_records`, visitas y permisos.
- Verificar en Neon tablas/columnas usadas por:
  - asistencia normal
  - excepciones operacionales
  - visitas a cliente
  - permisos reflejados en asistencia
- Proponer matriz de errores funcionales con severidad.

### Trabajo IA-2
- Inventariar todos los estados visuales en:
  - `AttendanceWidget`
  - `AttendanceAction`
  - `MobileShortcuts`
- Detectar duplicidades visuales y decisiones inconsistentes.
- Documentar todos los botones visibles por flujo.
- Levantar matriz:
  - accion
  - endpoint
  - pantalla origen
  - mensajes
  - siguiente paso esperado

### Entregables
- matriz de endpoints y estados
- matriz de errores y mensajes
- inventario de pantallas / botones / pasos
- baseline E2E del flujo actual

### Criterio de salida
- flujo actual completamente mapeado
- nombres reales de estados verificados
- no queda ninguna suposicion sobre session, mark flow y operational flow

---

## Fase 1 - Contrato unico de flujo de marcacion

### Objetivo
Crear un modelo canonico de flujo para que widget y deep-link hablen el mismo idioma.

### Recomendaciones cubiertas
- 1
- 2
- 10
- 12
- 15

### Trabajo IA-1
- Definir contrato canonico de backend para “siguiente paso”.
- Normalizar respuestas backend de asistencia para incluir, cuando aplique:
  - `flow_kind`
  - `current_step`
  - `next_step`
  - `allowed_actions`
  - `context_flags`
- Mantener compatibilidad con `{ ok: true|false }`.
- No romper contratos antiguos; agregar campos progresivamente.

### Trabajo IA-2
- Definir un `flow resolver` de frontend reutilizable para:
  - widget
  - deep-link
  - shortcuts
- Extraer labels y rutas de “siguiente accion” a un solo mapa reutilizable.
- Evitar que cada pantalla decida por su cuenta el flujo.

### Entregables
- especificacion de contrato canonico
- helper/shared map de flujo
- matriz de compatibilidad con flujos existentes

### Dependencias
- requiere Fase 0 completa

### Criterio de salida
- frontend y backend comparten un mismo vocabulario de pasos

---

## Fase 2 - Sesion, continuidad y deep-link seguro

### Objetivo
Eliminar friccion de login repetido y asegurar continuidad al volver desde OAuth o refresh.

### Recomendaciones cubiertas
- 3
- 4
- 5

### Trabajo IA-1
- Auditar `auth/refresh`, `user_sessions`, rotacion de refresh y cierre de sesiones.
- Verificar si hace falta distinguir sesiones por dispositivo.
- Exponer diagnostico simple para sesión si ya existe punto seguro donde colgarlo.
- Si aplica, registrar telemetry minima:
  - login source
  - refresh success/fail
  - expired session source path

### Trabajo IA-2
- Mejorar `ProtectedRoute`, `AuthContext`, `Login`, `LoginCallback`:
  - conservar `returnUrl` exacta
  - conservar query original del atajo
  - distinguir “sesion expirada” de “sin sesion”
- Diseñar vista movil de reentrada:
  - “vamos a continuar tu marcacion”
- Preparar manejo consistente para Safari/PWA cuando sea detectable.

### Entregables
- flujo de relogin con retorno exacto
- mensajes claros de sesion
- menor friccion en atajos iPhone

### Dependencias
- contrato de Fase 1

### Criterio de salida
- si la sesion se vence, el usuario vuelve al mismo paso y no a una pantalla genérica

---

## Fase 3 - Rework UX movil de asistencia

### Objetivo
Convertir la marcacion movil en una experiencia corta, clara y robusta.

### Recomendaciones cubiertas
- 5
- 7
- 8
- 9
- 10
- 14

### Trabajo IA-2
- Rediseñar `MobileShortcuts` para iPhone:
  - botones mas claros
  - jerarquia de acciones
  - mostrar solo lo util
- Rediseñar `AttendanceAction`:
  - menos texto inicial
  - pasos claros
  - geolocalizacion visible
  - confirmacion resumida antes de enviar en acciones sensibles
- Añadir reintento rapido y mensajes orientados a usuario.
- Diseñar fallback cuando no hay GPS o red.

### Trabajo IA-1
- Asegurar que backend soporte idempotencia razonable o mensajes seguros ante reintentos.
- Revisar rate limits y respuestas repetidas para no bloquear UX.
- Ajustar errores backend para distinguir:
  - ya marcada
  - salida activa distinta
  - falta geolocalizacion
  - sesion invalida

### Entregables
- nueva UX movil
- estrategia de reintento
- mensajes operativos claros

### Dependencias
- Fase 2

### Criterio de salida
- marcar desde iPhone debe poder hacerse con minimo esfuerzo y minima ambiguedad

---

## Fase 4 - Timeline, resumen diario y visibilidad de estado

### Objetivo
Dar al usuario una lectura inmediata de su situacion actual.

### Recomendaciones cubiertas
- 6
- 13
- 15
- 18

### Trabajo IA-1
- Consolidar payload para `today` o `workspace/overview` con:
  - jornada actual
  - salida operacional activa
  - permiso activo
  - horas acumuladas
  - pendientes accionables

### Trabajo IA-2
- Rediseñar `AttendanceWidget` para mostrar:
  - timeline actual
  - estado del dia
  - siguiente accion principal
  - tareas pendientes
- Añadir visibilidad permanente cuando exista:
  - salida operacional abierta
  - permiso en curso
  - solicitud pendiente del usuario

### Entregables
- timeline visual
- resumen del dia
- mini bandeja personal

### Dependencias
- Fase 1 y Fase 3

### Criterio de salida
- el usuario entiende en 3 segundos que ya hizo, que le falta y que no puede hacer

---

## Fase 5 - Operacional inteligente por contexto

### Objetivo
Reducir campos manuales y hacer que el sistema ayude segun rol, cronograma y tipo de gestion.

### Recomendaciones cubiertas
- 11
- 12
- 19

### Trabajo IA-1
- Verificar fuentes de contexto:
  - cronograma comercial aprobado
  - visitas tecnicas o planificadas
  - permisos del dia
  - salida operacional activa
- Exponer en endpoints la informacion precargable:
  - clientes del dia
  - prospectos pendientes
  - destino sugerido
  - tipo de flujo sugerido

### Trabajo IA-2
- Prellenar UI segun contexto:
  - cliente de cronograma
  - permiso activo
  - visita anterior
  - cierre esperado
- Ocultar campos redundantes cuando el sistema ya conoce el dato.

### Entregables
- formularios mas cortos
- decisiones contextuales automáticas

### Dependencias
- Fase 4

### Criterio de salida
- el sistema pregunta menos y resuelve mas

---

## Fase 6 - Recordatorios y automatizaciones suaves

### Objetivo
Evitar olvidos sin volver invasivo el sistema.

### Recomendaciones cubiertas
- 16
- 18

### Trabajo IA-1
- Definir reglas de recordatorio:
  - salida operacional abierta sin cierre
  - almuerzo pendiente
  - permiso en curso sin retorno
  - viatico pendiente por salida fuera del area
- Evaluar si se resuelven:
  - en polling frontend
  - por jobs backend
  - por notificaciones

### Trabajo IA-2
- Crear bandeja de “acciones pendientes”.
- Mostrar nudges suaves, no intrusivos.
- Evitar duplicidad entre toast, modal, banner y widget.

### Entregables
- recordatorios consistentes
- pendientes accionables

### Dependencias
- Fase 4 y Fase 5

### Criterio de salida
- el sistema acompaña al usuario y evita olvidos frecuentes

---

## Fase 7 - Integracion visible con permisos, vacaciones y viaticos

### Objetivo
Que el usuario entienda que asistencia no es un modulo aislado.

### Recomendaciones cubiertas
- 17
- 18
- 19

### Trabajo IA-1
- Unificar payloads visibles entre:
  - asistencia
  - permisos
  - vacaciones
  - viaticos originados por salidas
- Verificar reglas de negocio:
  - permiso activo modifica flujo
  - salida cerrada puede crear viatico
  - salidas dentro/fuera del area

### Trabajo IA-2
- Mostrar en widget y deep-link:
  - “estas en permiso”
  - “tu salida generara viatico”
  - “te falta clasificar esta salida”
- Enlazar desde asistencia a las acciones relacionadas.

### Entregables
- experiencia conectada entre modulos

### Dependencias
- Fase 5 y Fase 6

### Criterio de salida
- el usuario ya no percibe modulos aislados ni procesos opacos

---

## Fase 8 - Ayuda contextual y onboarding funcional

### Objetivo
Reducir errores de usuario sin capacitacion extensa.

### Recomendaciones cubiertas
- 20
- 7

### Trabajo IA-2
- Crear ayuda contextual breve:
  - primera vez
  - ayuda por paso
  - ayuda por error
- Crear mini guias embebidas:
  - salida operacional
  - permiso
  - visita a cliente
  - viatico derivado

### Trabajo IA-1
- Validar que la ayuda no contradiga reglas reales.
- Documentar estados y transiciones reales consumibles por frontend.

### Entregables
- microcopys
- hints contextuales
- ayuda embebida

### Dependencias
- fases funcionales anteriores estables

### Criterio de salida
- el sistema explica lo necesario en el momento correcto

---

## Fase 9 - Consolidacion y hardening E2E

### Objetivo
Cerrar vacios de logica, asegurar no regresiones y dejarlo operable.

### Recomendaciones cubiertas
- todas

### Trabajo compartido
- revisar duplicidades entre widget y deep-link
- revisar consistencia de nombres de acciones
- revisar consistencia visual `DESIGN.md`
- pruebas E2E reales:
  - jornada normal
  - jornada con permiso
  - salida operacional simple
  - salida con varios clientes
  - salida con vehiculo personal
  - retorno a oficina
  - cierre fuera de oficina
  - cronograma precargado
  - reingreso por login desde atajo
  - fallos de red

### Entregables
- checklist E2E
- lista de vacios cerrados
- matriz de regresion

### Dependencias
- todas las fases previas

### Criterio de salida
- sistema estable y consistente en dashboard y atajos

---

## Matriz de paralelizacion real por fases

### Tramo paralelo 1
- IA-1: Fase 0 backend
- IA-2: Fase 0 frontend

### Tramo paralelo 2
- IA-1: Fase 1 backend canonico
- IA-2: prepara shared flow map y consumo frontend

### Tramo paralelo 3
- IA-1: Fase 2 auth/backend
- IA-2: Fase 2 UX de continuidad de sesion

### Tramo paralelo 4
- IA-1: Fase 3 soporte backend de reintentos/errores
- IA-2: Fase 3 rework UI movil

### Tramo paralelo 5
- IA-1: Fase 4 payload resumen/timeline
- IA-2: Fase 4 widget y tablero personal

### Tramo paralelo 6
- IA-1: Fase 5 contexto y reglas
- IA-2: Fase 5 formularios y precarga contextual

### Tramo paralelo 7
- IA-1: Fase 6 reglas de recordatorio
- IA-2: Fase 6 bandeja de pendientes

### Tramo paralelo 8
- IA-1: Fase 7 integracion intermodular
- IA-2: Fase 8 ayuda contextual

### Tramo final
- ambas IAs: Fase 9 hardening y E2E

## Regla de handoff entre IAs

Cada cierre de fase debe dejar:

- archivos tocados
- contratos nuevos o modificados
- flags/estados agregados
- pruebas ejecutadas
- riesgos abiertos
- bloqueos para la siguiente fase

Formato recomendado de handoff:

```md
## Handoff Fase X
- Estado:
- Archivos:
- Contratos:
- Riesgos:
- Pendientes para IA-2 / IA-1:
```

## Orden recomendado de implementacion

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6
8. Fase 7
9. Fase 8
10. Fase 9

## Definicion de terminado

El plan se considera completo cuando:

- el usuario puede marcar desde iPhone sin friccion innecesaria
- la sesion no rompe continuidad del atajo
- el flujo visible coincide con la logica real backend
- permisos, salidas y viaticos se entienden como una sola experiencia
- el dashboard de asistencia muestra estado actual, historial inmediato y pendientes
- existen ayudas y errores claros
- las dos entradas al sistema (`widget` y `deep-link`) se comportan de forma consistente
