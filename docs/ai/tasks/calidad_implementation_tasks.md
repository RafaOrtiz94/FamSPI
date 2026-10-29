# Plan de Micro-Tareas: Implementación Módulo de Calidad GXP

> **NOTA DE OPERACIÓN (AGENTS.md):** Cada tarea debe ejecutarse tocando un máximo de 1 a 3 archivos y abarcando un único subdominio para reducir contexto y fallos (Regla de oro de FamSPI Root Router).

## Epic: CA-01-01 - Control de Sistemas de Temperatura
### Fase 1: Persistencia
- [x] `CA-01-01-T01`: Implementar tablas ORM (schema.prisma o similar) para Control de Sistemas de Temperatura.
- [x] `CA-01-01-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [x] `CA-01-01-T03`: Desarrollar `ca0101StateMachine.service.js` para control de transiciones.
- [x] `CA-01-01-T04`: Integrar servicio Core (`ca0101.service.js`) inyectando logica GXP Audit.
- [x] `CA-01-01-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [x] `CA-01-01-T06`: Implementar `ca0101.controller.js` usando validaciones DTO y Zod.
- [x] `CA-01-01-T07`: Registrar rutas en `ca0101.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [x] `CA-01-01-T08`: Desarrollar componente Master (`CA0101Workspace.jsx`).
- [x] `CA-01-01-T09`: Desarrollar Stepper/Timeline (`CA0101Stepper.jsx`) con checks visuales.
- [x] `CA-01-01-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [x] `CA-01-01-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [x] `CA-01-01-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-02 - Limpieza de Áreas
### Fase 1: Persistencia
- [x] `CA-01-02-T01`: Implementar tablas ORM (schema.prisma o similar) para Limpieza de Áreas.
- [x] `CA-01-02-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [x] `CA-01-02-T03`: Desarrollar `ca0102StateMachine.service.js` para control de transiciones.
- [x] `CA-01-02-T04`: Integrar servicio Core (`ca0102.service.js`) inyectando logica GXP Audit.
- [x] `CA-01-02-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [x] `CA-01-02-T06`: Implementar `ca0102.controller.js` usando validaciones DTO y Zod.
- [x] `CA-01-02-T07`: Registrar rutas en `ca0102.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [x] `CA-01-02-T08`: Desarrollar componente Master (`CA0102Workspace.jsx`).
- [x] `CA-01-02-T09`: Desarrollar Stepper/Timeline (`CA0102Stepper.jsx`) con checks visuales.
- [x] `CA-01-02-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [x] `CA-01-02-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [x] `CA-01-02-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-03 - Buenas Prácticas
### Fase 1: Persistencia
- [x] `CA-01-03-T01`: Implementar tablas ORM (schema.prisma o similar) para Buenas Prácticas.
- [x] `CA-01-03-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [x] `CA-01-03-T03`: Desarrollar `ca0103StateMachine.service.js` para control de transiciones.
- [x] `CA-01-03-T04`: Integrar servicio Core (`ca0103.service.js`) inyectando logica GXP Audit.
- [x] `CA-01-03-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [x] `CA-01-03-T06`: Implementar `ca0103.controller.js` usando validaciones DTO y Zod.
- [x] `CA-01-03-T07`: Registrar rutas en `ca0103.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [x] `CA-01-03-T08`: Desarrollar componente Master (`CA0103Workspace.jsx`).
- [x] `CA-01-03-T09`: Desarrollar Stepper/Timeline (`CA0103Stepper.jsx`) con checks visuales.
- [x] `CA-01-03-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [x] `CA-01-03-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [x] `CA-01-03-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-04 - Control de Plagas
### Fase 1: Persistencia
- [x] `CA-01-04-T01`: Implementar tablas ORM (schema.prisma o similar) para Control de Plagas.
- [x] `CA-01-04-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [x] `CA-01-04-T03`: Desarrollar `ca0104StateMachine.service.js` para control de transiciones.
- [x] `CA-01-04-T04`: Integrar servicio Core (`ca0104.service.js`) inyectando logica GXP Audit.
- [x] `CA-01-04-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [x] `CA-01-04-T06`: Implementar `ca0104.controller.js` usando validaciones DTO y Zod.
- [x] `CA-01-04-T07`: Registrar rutas en `ca0104.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [x] `CA-01-04-T08`: Desarrollar componente Master (`CA0104Workspace.jsx`).
- [x] `CA-01-04-T09`: Desarrollar Stepper/Timeline (`CA0104Stepper.jsx`) con checks visuales.
- [x] `CA-01-04-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [x] `CA-01-04-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [x] `CA-01-04-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-05 - Gestion y Control de Documentos
### Fase 1: Persistencia
- [x] `CA-01-05-T01`: Implementar tasblas ORM (schema.prisma o similar) para Gestão y Control de Documentos.
- [x] `CA-01-05-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [x] `CA-01-05-T03`: Desarrollar `ca0105StateMachine.service.js` para control de transiciones.
- [x] `CA-01-05-T04`: Integrar servicio Core (`ca0105.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-05-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-05-T06`: Implementar `ca0105.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-05-T07`: Registrar rutas en `ca0105.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-05-T08`: Desarrollar componente Master (`CA0105Workspace.jsx`).
- [ ] `CA-01-05-T09`: Desarrollar Stepper/Timeline (`CA0105Stepper.jsx`) con checks visuales.
- [ ] `CA-01-05-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-05-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-05-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-06 - Retiro del Mercado (Recall)
### Fase 1: Persistencia
- [ ] `CA-01-06-T01`: Implementar tablas ORM (schema.prisma o similar) para Retiro del Mercado (Recall).
- [ ] `CA-01-06-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-06-T03`: Desarrollar `ca0106StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-06-T04`: Integrar servicio Core (`ca0106.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-06-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-06-T06`: Implementar `ca0106.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-06-T07`: Registrar rutas en `ca0106.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-06-T08`: Desarrollar componente Master (`CA0106Workspace.jsx`).
- [ ] `CA-01-06-T09`: Desarrollar Stepper/Timeline (`CA0106Stepper.jsx`) con checks visuales.
- [ ] `CA-01-06-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-06-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-06-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-07 - Quejas y Reclamos
### Fase 1: Persistencia
- [ ] `CA-01-07-T01`: Implementar tablas ORM (schema.prisma o similar) para Quejas y Reclamos.
- [ ] `CA-01-07-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-07-T03`: Desarrollar `ca0107StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-07-T04`: Integrar servicio Core (`ca0107.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-07-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-07-T06`: Implementar `ca0107.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-07-T07`: Registrar rutas en `ca0107.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-07-T08`: Desarrollar componente Master (`CA0107Workspace.jsx`).
- [ ] `CA-01-07-T09`: Desarrollar Stepper/Timeline (`CA0107Stepper.jsx`) con checks visuales.
- [ ] `CA-01-07-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-07-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-07-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-08 - Plan de Contingencia Refrigerados
### Fase 1: Persistencia
- [ ] `CA-01-08-T01`: Implementar tablas ORM (schema.prisma o similar) para Plan de Contingencia Refrigerados.
- [ ] `CA-01-08-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-08-T03`: Desarrollar `ca0108StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-08-T04`: Integrar servicio Core (`ca0108.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-08-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-08-T06`: Implementar `ca0108.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-08-T07`: Registrar rutas en `ca0108.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-08-T08`: Desarrollar componente Master (`CA0108Workspace.jsx`).
- [ ] `CA-01-08-T09`: Desarrollar Stepper/Timeline (`CA0108Stepper.jsx`) con checks visuales.
- [ ] `CA-01-08-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-08-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-08-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-09 - CAPA (Acciones Correctivas)
### Fase 1: Persistencia
- [ ] `CA-01-09-T01`: Implementar tablas ORM (schema.prisma o similar) para CAPA (Acciones Correctivas).
- [ ] `CA-01-09-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-09-T03`: Desarrollar `ca0109StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-09-T04`: Integrar servicio Core (`ca0109.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-09-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-09-T06`: Implementar `ca0109.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-09-T07`: Registrar rutas en `ca0109.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-09-T08`: Desarrollar componente Master (`CA0109Workspace.jsx`).
- [ ] `CA-01-09-T09`: Desarrollar Stepper/Timeline (`CA0109Stepper.jsx`) con checks visuales.
- [ ] `CA-01-09-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-09-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-09-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-10 - Gestión de Riesgos
### Fase 1: Persistencia
- [ ] `CA-01-10-T01`: Implementar tablas ORM (schema.prisma o similar) para Gestión de Riesgos.
- [ ] `CA-01-10-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-10-T03`: Desarrollar `ca0110StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-10-T04`: Integrar servicio Core (`ca0110.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-10-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-10-T06`: Implementar `ca0110.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-10-T07`: Registrar rutas en `ca0110.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-10-T08`: Desarrollar componente Master (`CA0110Workspace.jsx`).
- [ ] `CA-01-10-T09`: Desarrollar Stepper/Timeline (`CA0110Stepper.jsx`) con checks visuales.
- [ ] `CA-01-10-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-10-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-10-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-11 - Manejo de Derrames e Incidentes
### Fase 1: Persistencia
- [ ] `CA-01-11-T01`: Implementar tablas ORM (schema.prisma o similar) para Manejo de Derrames e Incidentes.
- [ ] `CA-01-11-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-11-T03`: Desarrollar `ca0111StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-11-T04`: Integrar servicio Core (`ca0111.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-11-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-11-T06`: Implementar `ca0111.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-11-T07`: Registrar rutas en `ca0111.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-11-T08`: Desarrollar componente Master (`CA0111Workspace.jsx`).
- [ ] `CA-01-11-T09`: Desarrollar Stepper/Timeline (`CA0111Stepper.jsx`) con checks visuales.
- [ ] `CA-01-11-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-11-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-11-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-12 - Prácticas de Higiene Personal
### Fase 1: Persistencia
- [ ] `CA-01-12-T01`: Implementar tablas ORM (schema.prisma o similar) para Prácticas de Higiene Personal.
- [ ] `CA-01-12-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-12-T03`: Desarrollar `ca0112StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-12-T04`: Integrar servicio Core (`ca0112.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-12-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-12-T06`: Implementar `ca0112.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-12-T07`: Registrar rutas en `ca0112.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-12-T08`: Desarrollar componente Master (`CA0112Workspace.jsx`).
- [ ] `CA-01-12-T09`: Desarrollar Stepper/Timeline (`CA0112Stepper.jsx`) con checks visuales.
- [ ] `CA-01-12-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-12-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-12-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-13 - Comunicación Interna/Externa
### Fase 1: Persistencia
- [ ] `CA-01-13-T01`: Implementar tablas ORM (schema.prisma o similar) para Comunicación Interna/Externa.
- [ ] `CA-01-13-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-13-T03`: Desarrollar `ca0113StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-13-T04`: Integrar servicio Core (`ca0113.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-13-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-13-T06`: Implementar `ca0113.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-13-T07`: Registrar rutas en `ca0113.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-13-T08`: Desarrollar componente Master (`CA0113Workspace.jsx`).
- [ ] `CA-01-13-T09`: Desarrollar Stepper/Timeline (`CA0113Stepper.jsx`) con checks visuales.
- [ ] `CA-01-13-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-13-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-13-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-14 - Calificación Áreas Controladas
### Fase 1: Persistencia
- [ ] `CA-01-14-T01`: Implementar tablas ORM (schema.prisma o similar) para Calificación Áreas Controladas.
- [ ] `CA-01-14-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-14-T03`: Desarrollar `ca0114StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-14-T04`: Integrar servicio Core (`ca0114.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-14-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-14-T06`: Implementar `ca0114.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-14-T07`: Registrar rutas en `ca0114.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-14-T08`: Desarrollar componente Master (`CA0114Workspace.jsx`).
- [ ] `CA-01-14-T09`: Desarrollar Stepper/Timeline (`CA0114Stepper.jsx`) con checks visuales.
- [ ] `CA-01-14-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-14-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-14-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-15 - Auditorías Internas/Externas
### Fase 1: Persistencia
- [ ] `CA-01-15-T01`: Implementar tablas ORM (schema.prisma o similar) para Auditorías Internas/Externas.
- [ ] `CA-01-15-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-15-T03`: Desarrollar `ca0115StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-15-T04`: Integrar servicio Core (`ca0115.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-15-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-15-T06`: Implementar `ca0115.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-15-T07`: Registrar rutas en `ca0115.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-15-T08`: Desarrollar componente Master (`CA0115Workspace.jsx`).
- [ ] `CA-01-15-T09`: Desarrollar Stepper/Timeline (`CA0115Stepper.jsx`) con checks visuales.
- [ ] `CA-01-15-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-15-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-15-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-16 - Muestreo y Aprobación de Mercadería
### Fase 1: Persistencia
- [ ] `CA-01-16-T01`: Implementar tablas ORM (schema.prisma o similar) para Muestreo y Aprobación de Mercadería.
- [ ] `CA-01-16-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-16-T03`: Desarrollar `ca0116StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-16-T04`: Integrar servicio Core (`ca0116.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-16-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-16-T06`: Implementar `ca0116.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-16-T07`: Registrar rutas en `ca0116.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-16-T08`: Desarrollar componente Master (`CA0116Workspace.jsx`).
- [ ] `CA-01-16-T09`: Desarrollar Stepper/Timeline (`CA0116Stepper.jsx`) con checks visuales.
- [ ] `CA-01-16-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-16-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-16-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CA-01-17 - Tecnovigilancia
### Fase 1: Persistencia
- [ ] `CA-01-17-T01`: Implementar tablas ORM (schema.prisma o similar) para Tecnovigilancia.
- [ ] `CA-01-17-T02`: Desarrollar logica transaccional de DB e indexacion con soporte soft_delete.
### Fase 2: State Machine y Core Services
- [ ] `CA-01-17-T03`: Desarrollar `ca0117StateMachine.service.js` para control de transiciones.
- [ ] `CA-01-17-T04`: Integrar servicio Core (`ca0117.service.js`) inyectando logica GXP Audit.
- [ ] `CA-01-17-T05`: Programar CRON workers asincronos para SLAs y escalamientos.
### Fase 3: Endpoints y Security Edge
- [ ] `CA-01-17-T06`: Implementar `ca0117.controller.js` usando validaciones DTO y Zod.
- [ ] `CA-01-17-T07`: Registrar rutas en `ca0117.routes.js` con middleware RBAC autoritativo.
### Fase 4: Micro-Frontends & UI Workspaces
- [ ] `CA-01-17-T08`: Desarrollar componente Master (`CA0117Workspace.jsx`).
- [ ] `CA-01-17-T09`: Desarrollar Stepper/Timeline (`CA0117Stepper.jsx`) con checks visuales.
- [ ] `CA-01-17-T10`: Conectar Hooks/Queries contra los endpoints API REST.
### Fase 5: Firma & Sellado Documental GXP
- [ ] `CA-01-17-T11`: Acoplar widget de Firma Electrónica/2FA en modal de validación final.
- [ ] `CA-01-17-T12`: Módulo de impresión PDF on-the-fly (pdf-lib) incrustando QR de trazabilidad.

## Epic: CORE - Arquitectura y Optimizaciones Globales
- [ ] `CORE-T01`: Integración de validadores paramétricos y reglas sanitizadoras anti-inyecciones a nivel Calidad.
- [ ] `CORE-T02`: Centralizar validación y middlewares en `registerRoutes.js`.
- [ ] `CORE-T03`: Dashboard unificado para métricas de Calidad General.
