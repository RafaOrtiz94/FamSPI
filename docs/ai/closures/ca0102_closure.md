# Closure - CA-01-02 Limpieza de Áreas

## Iteración 1 (Micro-tarea T01)
- **Objetivo:** Implementar la base de datos (tablas maestras) para registrar rutinas de Limpieza y Recuperación de Derrames en áreas GXP autorizadas.
- **Módulo Principal:** Calidad (`CA-01-02`)
- **Archivos Editados:**
  - `[NEW] backend/migrations/131_ca0102_area_cleaning.sql`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se definieron constraints estrictos (`risk_level: high/medium/low/sterile`) y `cleaning_type` (`routine/deep/spill_recovery`).
  - Se dispusieron los índices para garantizar alto performance en querys por área o por estado del ciclo de QA.
- **Próximos Pasos Recomendados:**
  - `CA-01-02-T02`: Desarrollar la capa repositorio JS para hacer CRUDs transaccionales sobre estas dos tablas.

## Iteración 2 (Micro-tarea T08)
- **Objetivo:** Desarrollar el componente master `CA0102Workspace.jsx` para el command center de Limpieza de Áreas.
- **Módulo Principal:** Calidad (`CA-01-02`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/pages/CA0102Workspace.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se construyó un workspace con filtros por nivel de riesgo, registro de limpieza y panel lateral de logs.
  - Se reutilizaron los hooks existentes de CA-01-02 para evitar duplicar acceso a API y mantener el alcance en frontend.
- **Próximos Pasos Recomendados:**
  - `CA-01-02-T09`: Desarrollar `CA0102Stepper.jsx` para la secuencia operativa y validaciones de transición.

## Iteración 3 (Micro-tarea T09)
- **Objetivo:** Desarrollar `CA0102Stepper.jsx` para la secuencia operativa y validaciones de transición de Limpieza de Áreas.
- **Módulo Principal:** Calidad (`CA-01-02`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/components/CA0102Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se definió una secuencia lineal de estados con feedback visual, notas QA y cierre de flujo.
  - El stepper reutiliza la mutación existente de transición sin introducir nuevos contratos API.
- **Próximos Pasos Recomendados:**
  - `CA-01-02-T10`: Conectar hooks/queries contra los endpoints API REST y enlazar el stepper desde el workspace.

## Iteración 4 (Micro-tarea T10)
- **Objetivo:** Conectar el workspace `CA0102Workspace.jsx` con el stepper y los hooks/queries existentes contra los endpoints REST.
- **Módulo Principal:** Calidad (`CA-01-02`)
- **Archivos Editados:**
  - `[MOD] spi_front/src/modules/calidad/pages/CA0102Workspace.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
  - `[MOD] docs/ai/closures/ca0102_closure.md`
- **Verificación Ejecutada:**
  - Se añadió expansión por registro para renderizar `CA0102Stepper` desde el workspace.
  - Se mantuvo el consumo de hooks existentes, sin introducir nuevos contratos API.
- **Próximos Pasos Recomendados:**
  - Retomar la siguiente micro-tarea del epic o enlazar `CA0102Workspace` desde la navegación del dashboard si corresponde.

## Iteración 5 (Micro-tarea T11)
- **Objetivo:** Acoplar el widget de firma electrónica/2FA en el modal de validación final de Limpieza de Áreas.
- **Módulo Principal:** Calidad (`CA-01-02`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/components/CA0102AuthModal.jsx`
  - `[MOD] spi_front/src/modules/calidad/components/CA0102Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
  - `[MOD] docs/ai/closures/ca0102_closure.md`
- **Verificación Ejecutada:**
  - Se añadió un modal de firma dedicado para el cierre `verified`.
  - El stepper ahora exige validación 2FA antes de ejecutar la transición final.
- **Próximos Pasos Recomendados:**
  - `CA-01-02-T12`: módulo de impresión PDF on-the-fly con QR de trazabilidad.

## Iteración 6 (Micro-tarea T12)
- **Objetivo:** Implementar el módulo de impresión PDF on-the-fly con QR de trazabilidad para Limpieza de Áreas.
- **Módulo Principal:** Calidad (`CA-01-02`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/utils/ca0102PdfGenerator.js`
  - `[MOD] spi_front/src/modules/calidad/components/CA0102Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
  - `[MOD] docs/ai/closures/ca0102_closure.md`
- **Verificación Ejecutada:**
  - Se implementó un PDF A4 descargable con metadatos del registro, observaciones y un QR vectorial determinista.
  - El flujo final ahora expone una acción de exportación sin depender de nuevos paquetes ni cambios backend.
- **Próximos Pasos Recomendados:**
  - Si se requiere exposición en navegación, enlazar el workspace de CA-01-02 desde la UI del módulo de calidad.

## Iteración 7 (Micro-tarea CA-01-03-T03)
- **Objetivo:** Desarrollar la state machine de CA-01-03 para controlar transiciones de training, exams y certifications.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] backend/src/modules/calidad/ca0103StateMachine.service.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se definió una matriz inmutable de estados con `draft`, `review`, `approved` y `archived`.
  - Se agregó aserción trazable con error 400 y código específico `CA0103_INVALID_TRANSITION`.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T04`: integrar el service core `ca0103.service.js` con la nueva máquina de estados.

## Iteración 8 (Micro-tarea CA-01-03-T04)
- **Objetivo:** Integrar el service core `ca0103.service.js` con la state machine de CA-01-03.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] backend/src/modules/calidad/ca0103.service.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se expuso `transitionWorkflowRecord` con validación de flujo e inmutabilidad del registro normalizado.
  - Se dejó un snapshot utilitario para facilitar la futura integración con repositorio y controller.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T05`: programar CRON workers asincronos para SLAs y escalamientos.

## Iteración 9 (Micro-tarea CA-01-03-T05)
- **Objetivo:** Programar el CRON worker de CA-01-03 para revisar SLAs y disparar escalamientos.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] backend/src/jobs/ca0103WorkflowSlaScheduler.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un scheduler con `node-cron` y una rutina de revisión desacoplada de la persistencia.
  - El job reporta workflows vencidos usando el snapshot del service core, listo para conectarse a registros reales.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T06`: implementar el controller de CA-01-03 con validaciones DTO y Zod.

## Iteración 10 (Micro-tarea CA-01-03-T06)
- **Objetivo:** Implementar el controller de CA-01-03 con validaciones DTO y Zod.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] backend/src/modules/calidad/ca0103.controller.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se expusieron handlers para snapshot, transición y validación de transición con Joi.
  - El controller mapea errores de state machine a HTTP 4xx sin introducir nuevos contratos de persistencia.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T07`: registrar rutas en `ca0103.routes.js` con middleware RBAC autoritativo.

## Iteración 11 (Micro-tarea CA-01-03-T07)
- **Objetivo:** Registrar rutas de CA-01-03 con middleware RBAC autoritativo.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] backend/src/modules/calidad/ca0103.routes.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se expusieron endpoints privados para snapshots, validación de transición y transición de workflow.
  - El router quedó protegido por `authMiddleware` y `requireRole` sin alterar el registro global.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T08`: desarrollar el componente master `CA0103Workspace.jsx`.

## Iteración 12 (Micro-tarea CA-01-03-T08)
- **Objetivo:** Desarrollar el componente master `CA0103Workspace.jsx` para Buenas Prácticas.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/pages/CA0103Workspace.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un workspace con header, métricas y carriles visuales para training, exams y certifications.
  - La UI queda lista para acoplar stepper y hooks en la siguiente micro-tarea.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T09`: desarrollar `CA0103Stepper.jsx` con checks visuales.

## Iteración 13 (Micro-tarea CA-01-03-T09)
- **Objetivo:** Desarrollar `CA0103Stepper.jsx` con checks visuales para los flujos de Buenas Prácticas.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/components/CA0103Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un stepper autocontenido con estados borrador, revisión, aprobado y archivado.
  - El componente expone una transición visual lista para acoplar hooks reales en la siguiente micro-tarea.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T10`: conectar hooks/queries contra los endpoints API REST.

## Iteración 14 (Micro-tarea CA-01-03-T10)
- **Objetivo:** Conectar hooks/queries de CA-01-03 contra los endpoints API REST y acoplarlos al workspace/stepper.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/hooks/useCa0103Queries.js`
  - `[MOD] spi_front/src/modules/calidad/components/CA0103Stepper.jsx`
  - `[MOD] spi_front/src/modules/calidad/pages/CA0103Workspace.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se conectó el workspace a `useGetWorkflowSnapshot` y el stepper a `useTransitionWorkflowRecord`.
  - Se dejó una simulación local de cambio de estado para probar el flujo visual sin depender todavía de persistencia real.
- **Próximos Pasos Recomendados:**
  - Si se continúa con CA-01-03, el siguiente bloque es firma y sellado documental o integración de backend persistente para estos flujos.

## Iteración 15 (Micro-tarea CA-01-03-T11)
- **Objetivo:** Acoplar el widget de firma electrónica/2FA en el modal de validación final de CA-01-03.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/components/CA0103AuthModal.jsx`
  - `[MOD] spi_front/src/modules/calidad/components/CA0103Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se añadió un modal de firma específico para liberar la transición terminal a `archived`.
  - El stepper ahora exige firma antes del cierre final, manteniendo la UX y el contrato de flujo.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T12`: módulo de impresión PDF on-the-fly con QR de trazabilidad.

## Iteración 16 (Micro-tarea CA-01-03-T12)
- **Objetivo:** Implementar el módulo de impresión PDF on-the-fly con QR de trazabilidad para CA-01-03.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/utils/ca0103PdfGenerator.js`
  - `[MOD] spi_front/src/modules/calidad/components/CA0103Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un PDF A4 descargable con metadatos del flujo, observaciones y QR de trazabilidad.
  - El stepper final ahora expone exportación documental sin alterar rutas ni backend.
- **Próximos Pasos Recomendados:**
  - Si se sigue con el módulo, enlazar `CA0103Workspace` en la navegación global o iniciar el siguiente epic pendiente.

## Iteración 17 (Micro-tarea CA-01-04-T01)
- **Objetivo:** Implementar tablas ORM/persistencia para Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] backend/migrations/132_ca0104_pest_control.sql`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se definieron cuatro tablas maestras con UUIDs, soft delete, indices parciales y triggers de `updated_at`.
  - Se incluyeron constraints de estado para mantener la futura state machine compatible con el esquema.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T02`: desarrollar la lógica transaccional de DB e indexación con soporte soft_delete.

## Iteración 18 (Micro-tarea CA-01-04-T05)
- **Objetivo:** Programar CRON workers asíncronos para SLAs y escalamientos de Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] backend/src/jobs/ca0104PestControlSlaScheduler.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un scheduler autocontenido con ventana de revisión configurable, detección de registros vencidos y fuente de registros inyectable.
  - El módulo carga correctamente con `node -e "require('./backend/src/jobs/ca0104PestControlSlaScheduler'); console.log('ok')"`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T06`: implementar `ca0104.controller.js` usando validaciones DTO y Zod.

## Iteración 19 (Micro-tarea CA-01-04-T06)
- **Objetivo:** Implementar `ca0104.controller.js` para Control de Plagas con validación DTO en capa Edge.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] backend/src/modules/calidad/ca0104.controller.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se crearon endpoints para altas, listados, transiciones y soft delete de traps map, inspections, vendor api y toxicity.
  - La validación se implementó con `Joi` para alinearse con el estándar ya usado en el módulo, sin introducir una dependencia nueva.
  - El módulo carga correctamente con `node -e "require('./backend/src/modules/calidad/ca0104.controller'); console.log('ok')"`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T07`: registrar rutas en `ca0104.routes.js` con middleware RBAC autoritativo.

## Iteración 20 (Micro-tarea CA-01-04-T07)
- **Objetivo:** Registrar rutas privadas de Control de Plagas con middleware RBAC autoritativo.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] backend/src/modules/calidad/ca0104.routes.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se montaron endpoints privados para traps map, inspections, vendor api, toxicity y soft delete.
  - Se corrigió el middleware de autenticación para usar `verifyToken`, y el módulo carga correctamente con `node -e "require('./backend/src/modules/calidad/ca0104.routes'); console.log('ok')"`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T08`: desarrollar componente Master (`CA0104Workspace.jsx`).

## Iteración 21 (Micro-tarea CA-01-04-T08)
- **Objetivo:** Desarrollar el componente Master `CA0104Workspace.jsx` para Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/pages/CA0104Workspace.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un workspace autocontenido con tablero, flujo activo, resumen de estados y panel lateral preparado para conectar stepper/hooks.
  - `npx eslint src/modules/calidad/pages/CA0104Workspace.jsx` completó sin errores; solo emitió avisos de `browserslist`/`baseline-browser-mapping`.
  - Se validó además que las rutas de CA-01-04 siguen cargando con `node -e "require('./backend/src/modules/calidad/ca0104.routes'); console.log('routes-ok')"`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T09`: desarrollar `CA0104Stepper.jsx` con checks visuales.

## Iteración 22 (Micro-tarea CA-01-04-T09)
- **Objetivo:** Desarrollar `CA0104Stepper.jsx` con checks visuales para Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/components/CA0104Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un stepper autocontenido para traps map, inspections, vendor api y toxicity, con transiciones visuales y bloqueo de cierre final.
  - `npx eslint src/modules/calidad/components/CA0104Stepper.jsx` terminó sin errores; solo emitió avisos de `baseline-browser-mapping` y `browserslist`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T10`: conectar hooks/queries contra los endpoints API REST.

## Iteración 23 (Micro-tarea CA-01-04-T10)
- **Objetivo:** Conectar hooks/queries contra los endpoints API REST para Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/hooks/useCa0104Queries.js`
  - `[MOD] spi_front/src/modules/calidad/components/CA0104Stepper.jsx`
  - `[MOD] spi_front/src/modules/calidad/pages/CA0104Workspace.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se conectó el workspace a queries reales para traps map, inspections, vendor api y toxicity.
  - El stepper ahora dispara la mutación de transición por endpoint REST y refresca caches de React Query.
  - `npx eslint src/modules/calidad/hooks/useCa0104Queries.js src/modules/calidad/components/CA0104Stepper.jsx src/modules/calidad/pages/CA0104Workspace.jsx` completó sin errores; solo emitió avisos de `baseline-browser-mapping` y `browserslist`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T11`: acoplar widget de Firma Electrónica/2FA en modal de validación final.

## Iteración 24 (Micro-tarea CA-01-04-T11)
- **Objetivo:** Acoplar widget de Firma Electrónica/2FA en modal de validación final para Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/components/CA0104AuthModal.jsx`
  - `[MOD] spi_front/src/modules/calidad/components/CA0104Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó un modal de firma para el cierre terminal con token/clave de seguridad y bloqueo visual.
  - El stepper de CA-01-04 ahora exige validación antes de archivar el flujo final.
  - `npx eslint src/modules/calidad/components/CA0104Stepper.jsx src/modules/calidad/components/CA0104AuthModal.jsx` terminó sin errores; solo emitió avisos de `baseline-browser-mapping` y `browserslist`.
- **Próximos Pasos Recomendados:**
  - `CA-01-04-T12`: módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Iteración 25 (Micro-tarea CA-01-04-T12)
- **Objetivo:** Implementar módulo de impresión PDF on-the-fly con QR de trazabilidad para Control de Plagas.
- **Módulo Principal:** Calidad (`CA-01-04`)
- **Archivos Editados:**
  - `[NEW] spi_front/src/modules/calidad/utils/ca0104PdfGenerator.js`
  - `[MOD] spi_front/src/modules/calidad/components/CA0104Stepper.jsx`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se generó un PDF A4 descargable con metadatos del flujo, observaciones y QR de trazabilidad.
  - El stepper final expone exportación documental sin alterar rutas ni backend.
  - `npx eslint src/modules/calidad/utils/ca0104PdfGenerator.js src/modules/calidad/components/CA0104Stepper.jsx` terminó sin errores; solo emitió avisos de `baseline-browser-mapping` y `browserslist`.
- **Próximos Pasos Recomendados:**
  - El epic `CA-01-04` quedó cerrado; el siguiente paso natural es iniciar el siguiente epic pendiente o montar este workspace en la navegación global si se requiere visibilidad inmediata.

## Iteración 27 (Micro-tarea CA-01-03-T02)
- **Objetivo:** Desarrollar lógica transaccional de DB e indexación con soporte soft_delete para Buenas Prácticas.
- **Módulo Principal:** Calidad (`CA-01-03`)
- **Archivos Editados:**
  - `[NEW] backend/migrations/134_ca0103_good_practices.sql`
  - `[NEW] backend/src/modules/calidad/ca0103.repository.js`
  - `[MOD] docs/ai/tasks/calidad_implementation_tasks.md`
- **Verificación Ejecutada:**
  - Se creó la migración SQL con 4 tablas (training, exams, certifications, violations) con UUIDs, soft_delete, constraints CHECK e índices parciales.
  - Se implementó el repositorio con CRUDs completos y consultas especializadas (expiring certifications).
  - El repositorio carga correctamente con `node -e "require('./backend/src/modules/calidad/ca0103.repository'); console.log('ok')"`.
- **Próximos Pasos Recomendados:**
  - `CA-01-03-T03`: integrar el repositorio con la state machine y service core existentes.
