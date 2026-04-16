# Arquitectura y Requerimientos de Software - Módulo de Calidad (GXP/ISO 9001)

Este documento consolida la arquitectura orientada a workflows y 400 requerimientos técnicos estrictos para la digitalización total de los 17 procedimientos del Sistema de Gestión de Calidad y el ORM/Backend Core.

## CA-01-01 - Control de Sistemas de Temperatura

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-001]** Schema/Entity: Implementar tablas relacionales para IoT Sync con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-002]** Schema/Entity: Implementar tablas relacionales para Alerts con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-003]** Schema/Entity: Implementar tablas relacionales para Calibration con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-004]** Schema/Entity: Implementar tablas relacionales para Mapping con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-005]** Auditoría (GXP): Todo cambio en el esquema de CA-01-01 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-006]** State Machine: Definir el nodo de estado iot_sync en ca-01-01_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-007]** State Machine: Definir el nodo de estado alerts en ca-01-01_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-008]** State Machine: Definir el nodo de estado calibration en ca-01-01_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-009]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Control de Sistemas de Temperatura.
- **[REQ-010]** Event Broker: Emitir eventos asíncronos quality.ca-01-01.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-011]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-01/iotsync asegurando validación estricta con Joi/Zod.
- **[REQ-012]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-01/alerts asegurando validación estricta con Joi/Zod.
- **[REQ-013]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-01/calibration asegurando validación estricta con Joi/Zod.
- **[REQ-014]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-01/mapping asegurando validación estricta con Joi/Zod.
- **[REQ-015]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-01.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-016]** Command Center UI: Componente React tipo workspace/dashboard para IoT Sync, empleando React Query.
- **[REQ-017]** Command Center UI: Componente React tipo workspace/dashboard para Alerts, empleando React Query.
- **[REQ-018]** Command Center UI: Componente React tipo workspace/dashboard para Calibration, empleando React Query.
- **[REQ-019]** Command Center UI: Componente React tipo workspace/dashboard para Mapping, empleando React Query.
- **[REQ-020]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-01 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-021]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Control de Sistemas de Temperatura.
- **[REQ-022]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-01.

## CA-01-02 - Limpieza de Áreas

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-023]** Schema/Entity: Implementar tablas relacionales para Schedules con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-024]** Schema/Entity: Implementar tablas relacionales para QR Scans con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-025]** Schema/Entity: Implementar tablas relacionales para Chemicals con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-026]** Schema/Entity: Implementar tablas relacionales para Supervision con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-027]** Auditoría (GXP): Todo cambio en el esquema de CA-01-02 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-028]** State Machine: Definir el nodo de estado schedules en ca-01-02_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-029]** State Machine: Definir el nodo de estado qr_scans en ca-01-02_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-030]** State Machine: Definir el nodo de estado chemicals en ca-01-02_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-031]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Limpieza de Áreas.
- **[REQ-032]** Event Broker: Emitir eventos asíncronos quality.ca-01-02.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-033]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-02/schedules asegurando validación estricta con Joi/Zod.
- **[REQ-034]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-02/qrscans asegurando validación estricta con Joi/Zod.
- **[REQ-035]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-02/chemicals asegurando validación estricta con Joi/Zod.
- **[REQ-036]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-02/supervision asegurando validación estricta con Joi/Zod.
- **[REQ-037]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-02.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-038]** Command Center UI: Componente React tipo workspace/dashboard para Schedules, empleando React Query.
- **[REQ-039]** Command Center UI: Componente React tipo workspace/dashboard para QR Scans, empleando React Query.
- **[REQ-040]** Command Center UI: Componente React tipo workspace/dashboard para Chemicals, empleando React Query.
- **[REQ-041]** Command Center UI: Componente React tipo workspace/dashboard para Supervision, empleando React Query.
- **[REQ-042]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-02 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-043]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Limpieza de Áreas.
- **[REQ-044]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-02.

## CA-01-03 - Buenas Prácticas

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-045]** Schema/Entity: Implementar tablas relacionales para Training con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-046]** Schema/Entity: Implementar tablas relacionales para Exams con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-047]** Schema/Entity: Implementar tablas relacionales para Certifications con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-048]** Schema/Entity: Implementar tablas relacionales para Violations con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-049]** Auditoría (GXP): Todo cambio en el esquema de CA-01-03 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-050]** State Machine: Definir el nodo de estado training en ca-01-03_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-051]** State Machine: Definir el nodo de estado exams en ca-01-03_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-052]** State Machine: Definir el nodo de estado certifications en ca-01-03_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-053]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Buenas Prácticas.
- **[REQ-054]** Event Broker: Emitir eventos asíncronos quality.ca-01-03.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-055]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-03/training asegurando validación estricta con Joi/Zod.
- **[REQ-056]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-03/exams asegurando validación estricta con Joi/Zod.
- **[REQ-057]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-03/certifications asegurando validación estricta con Joi/Zod.
- **[REQ-058]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-03/violations asegurando validación estricta con Joi/Zod.
- **[REQ-059]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-03.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-060]** Command Center UI: Componente React tipo workspace/dashboard para Training, empleando React Query.
- **[REQ-061]** Command Center UI: Componente React tipo workspace/dashboard para Exams, empleando React Query.
- **[REQ-062]** Command Center UI: Componente React tipo workspace/dashboard para Certifications, empleando React Query.
- **[REQ-063]** Command Center UI: Componente React tipo workspace/dashboard para Violations, empleando React Query.
- **[REQ-064]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-03 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-065]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Buenas Prácticas.
- **[REQ-066]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-03.

## CA-01-04 - Control de Plagas

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-067]** Schema/Entity: Implementar tablas relacionales para Traps Map con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-068]** Schema/Entity: Implementar tablas relacionales para Inspections con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-069]** Schema/Entity: Implementar tablas relacionales para Vendor API con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-070]** Schema/Entity: Implementar tablas relacionales para Toxicity con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-071]** Auditoría (GXP): Todo cambio en el esquema de CA-01-04 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-072]** State Machine: Definir el nodo de estado traps_map en ca-01-04_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-073]** State Machine: Definir el nodo de estado inspections en ca-01-04_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-074]** State Machine: Definir el nodo de estado vendor_api en ca-01-04_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-075]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Control de Plagas.
- **[REQ-076]** Event Broker: Emitir eventos asíncronos quality.ca-01-04.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-077]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-04/trapsmap asegurando validación estricta con Joi/Zod.
- **[REQ-078]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-04/inspections asegurando validación estricta con Joi/Zod.
- **[REQ-079]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-04/vendorapi asegurando validación estricta con Joi/Zod.
- **[REQ-080]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-04/toxicity asegurando validación estricta con Joi/Zod.
- **[REQ-081]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-04.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-082]** Command Center UI: Componente React tipo workspace/dashboard para Traps Map, empleando React Query.
- **[REQ-083]** Command Center UI: Componente React tipo workspace/dashboard para Inspections, empleando React Query.
- **[REQ-084]** Command Center UI: Componente React tipo workspace/dashboard para Vendor API, empleando React Query.
- **[REQ-085]** Command Center UI: Componente React tipo workspace/dashboard para Toxicity, empleando React Query.
- **[REQ-086]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-04 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-087]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Control de Plagas.
- **[REQ-088]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-04.

## CA-01-05 - Gestión y Control de Documentos

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-089]** Schema/Entity: Implementar tablas relacionales para Versioning con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-090]** Schema/Entity: Implementar tablas relacionales para Approval Flow con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-091]** Schema/Entity: Implementar tablas relacionales para PDF Stamp con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-092]** Schema/Entity: Implementar tablas relacionales para Archiving con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-093]** Auditoría (GXP): Todo cambio en el esquema de CA-01-05 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-094]** State Machine: Definir el nodo de estado versioning en ca-01-05_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-095]** State Machine: Definir el nodo de estado approval_flow en ca-01-05_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-096]** State Machine: Definir el nodo de estado pdf_stamp en ca-01-05_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-097]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Gestión y Control de Documentos.
- **[REQ-098]** Event Broker: Emitir eventos asíncronos quality.ca-01-05.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-099]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-05/versioning asegurando validación estricta con Joi/Zod.
- **[REQ-100]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-05/approvalflow asegurando validación estricta con Joi/Zod.
- **[REQ-101]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-05/pdfstamp asegurando validación estricta con Joi/Zod.
- **[REQ-102]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-05/archiving asegurando validación estricta con Joi/Zod.
- **[REQ-103]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-05.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-104]** Command Center UI: Componente React tipo workspace/dashboard para Versioning, empleando React Query.
- **[REQ-105]** Command Center UI: Componente React tipo workspace/dashboard para Approval Flow, empleando React Query.
- **[REQ-106]** Command Center UI: Componente React tipo workspace/dashboard para PDF Stamp, empleando React Query.
- **[REQ-107]** Command Center UI: Componente React tipo workspace/dashboard para Archiving, empleando React Query.
- **[REQ-108]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-05 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-109]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Gestión y Control de Documentos.
- **[REQ-110]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-05.

## CA-01-06 - Retiro del Mercado (Recall)

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-111]** Schema/Entity: Implementar tablas relacionales para Traceability con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-112]** Schema/Entity: Implementar tablas relacionales para Communication con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-113]** Schema/Entity: Implementar tablas relacionales para Quarantine con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-114]** Schema/Entity: Implementar tablas relacionales para Logistics con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-115]** Auditoría (GXP): Todo cambio en el esquema de CA-01-06 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-116]** State Machine: Definir el nodo de estado traceability en ca-01-06_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-117]** State Machine: Definir el nodo de estado communication en ca-01-06_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-118]** State Machine: Definir el nodo de estado quarantine en ca-01-06_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-119]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Retiro del Mercado (Recall).
- **[REQ-120]** Event Broker: Emitir eventos asíncronos quality.ca-01-06.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-121]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-06/traceability asegurando validación estricta con Joi/Zod.
- **[REQ-122]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-06/communication asegurando validación estricta con Joi/Zod.
- **[REQ-123]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-06/quarantine asegurando validación estricta con Joi/Zod.
- **[REQ-124]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-06/logistics asegurando validación estricta con Joi/Zod.
- **[REQ-125]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-06.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-126]** Command Center UI: Componente React tipo workspace/dashboard para Traceability, empleando React Query.
- **[REQ-127]** Command Center UI: Componente React tipo workspace/dashboard para Communication, empleando React Query.
- **[REQ-128]** Command Center UI: Componente React tipo workspace/dashboard para Quarantine, empleando React Query.
- **[REQ-129]** Command Center UI: Componente React tipo workspace/dashboard para Logistics, empleando React Query.
- **[REQ-130]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-06 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-131]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Retiro del Mercado (Recall).
- **[REQ-132]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-06.

## CA-01-07 - Quejas y Reclamos

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-133]** Schema/Entity: Implementar tablas relacionales para Intake Form con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-134]** Schema/Entity: Implementar tablas relacionales para Investigation con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-135]** Schema/Entity: Implementar tablas relacionales para Refunds con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-136]** Schema/Entity: Implementar tablas relacionales para CAPA Link con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-137]** Auditoría (GXP): Todo cambio en el esquema de CA-01-07 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-138]** State Machine: Definir el nodo de estado intake_form en ca-01-07_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-139]** State Machine: Definir el nodo de estado investigation en ca-01-07_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-140]** State Machine: Definir el nodo de estado refunds en ca-01-07_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-141]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Quejas y Reclamos.
- **[REQ-142]** Event Broker: Emitir eventos asíncronos quality.ca-01-07.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-143]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-07/intakeform asegurando validación estricta con Joi/Zod.
- **[REQ-144]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-07/investigation asegurando validación estricta con Joi/Zod.
- **[REQ-145]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-07/refunds asegurando validación estricta con Joi/Zod.
- **[REQ-146]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-07/capalink asegurando validación estricta con Joi/Zod.
- **[REQ-147]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-07.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-148]** Command Center UI: Componente React tipo workspace/dashboard para Intake Form, empleando React Query.
- **[REQ-149]** Command Center UI: Componente React tipo workspace/dashboard para Investigation, empleando React Query.
- **[REQ-150]** Command Center UI: Componente React tipo workspace/dashboard para Refunds, empleando React Query.
- **[REQ-151]** Command Center UI: Componente React tipo workspace/dashboard para CAPA Link, empleando React Query.
- **[REQ-152]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-07 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-153]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Quejas y Reclamos.
- **[REQ-154]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-07.

## CA-01-08 - Plan de Contingencia Refrigerados

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-155]** Schema/Entity: Implementar tablas relacionales para Power Outage con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-156]** Schema/Entity: Implementar tablas relacionales para Dry Ice Calc con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-157]** Schema/Entity: Implementar tablas relacionales para Transfer con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-158]** Schema/Entity: Implementar tablas relacionales para Validation con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-159]** Auditoría (GXP): Todo cambio en el esquema de CA-01-08 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-160]** State Machine: Definir el nodo de estado power_outage en ca-01-08_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-161]** State Machine: Definir el nodo de estado dry_ice_calc en ca-01-08_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-162]** State Machine: Definir el nodo de estado transfer en ca-01-08_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-163]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Plan de Contingencia Refrigerados.
- **[REQ-164]** Event Broker: Emitir eventos asíncronos quality.ca-01-08.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-165]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-08/poweroutage asegurando validación estricta con Joi/Zod.
- **[REQ-166]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-08/dryicecalc asegurando validación estricta con Joi/Zod.
- **[REQ-167]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-08/transfer asegurando validación estricta con Joi/Zod.
- **[REQ-168]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-08/validation asegurando validación estricta con Joi/Zod.
- **[REQ-169]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-08.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-170]** Command Center UI: Componente React tipo workspace/dashboard para Power Outage, empleando React Query.
- **[REQ-171]** Command Center UI: Componente React tipo workspace/dashboard para Dry Ice Calc, empleando React Query.
- **[REQ-172]** Command Center UI: Componente React tipo workspace/dashboard para Transfer, empleando React Query.
- **[REQ-173]** Command Center UI: Componente React tipo workspace/dashboard para Validation, empleando React Query.
- **[REQ-174]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-08 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-175]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Plan de Contingencia Refrigerados.
- **[REQ-176]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-08.

## CA-01-09 - CAPA (Acciones Correctivas)

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-177]** Schema/Entity: Implementar tablas relacionales para RCA con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-178]** Schema/Entity: Implementar tablas relacionales para Action Plan con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-179]** Schema/Entity: Implementar tablas relacionales para Escalation con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-180]** Schema/Entity: Implementar tablas relacionales para Effectiveness con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-181]** Auditoría (GXP): Todo cambio en el esquema de CA-01-09 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-182]** State Machine: Definir el nodo de estado rca en ca-01-09_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-183]** State Machine: Definir el nodo de estado action_plan en ca-01-09_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-184]** State Machine: Definir el nodo de estado escalation en ca-01-09_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-185]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de CAPA (Acciones Correctivas).
- **[REQ-186]** Event Broker: Emitir eventos asíncronos quality.ca-01-09.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-187]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-09/rca asegurando validación estricta con Joi/Zod.
- **[REQ-188]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-09/actionplan asegurando validación estricta con Joi/Zod.
- **[REQ-189]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-09/escalation asegurando validación estricta con Joi/Zod.
- **[REQ-190]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-09/effectiveness asegurando validación estricta con Joi/Zod.
- **[REQ-191]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-09.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-192]** Command Center UI: Componente React tipo workspace/dashboard para RCA, empleando React Query.
- **[REQ-193]** Command Center UI: Componente React tipo workspace/dashboard para Action Plan, empleando React Query.
- **[REQ-194]** Command Center UI: Componente React tipo workspace/dashboard para Escalation, empleando React Query.
- **[REQ-195]** Command Center UI: Componente React tipo workspace/dashboard para Effectiveness, empleando React Query.
- **[REQ-196]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-09 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-197]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en CAPA (Acciones Correctivas).
- **[REQ-198]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-09.

## CA-01-10 - Gestión de Riesgos

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-199]** Schema/Entity: Implementar tablas relacionales para FMEAMatrix con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-200]** Schema/Entity: Implementar tablas relacionales para Mitigation con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-201]** Schema/Entity: Implementar tablas relacionales para Reviews con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-202]** Schema/Entity: Implementar tablas relacionales para Impact Assessment con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-203]** Auditoría (GXP): Todo cambio en el esquema de CA-01-10 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-204]** State Machine: Definir el nodo de estado fmeamatrix en ca-01-10_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-205]** State Machine: Definir el nodo de estado mitigation en ca-01-10_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-206]** State Machine: Definir el nodo de estado reviews en ca-01-10_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-207]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Gestión de Riesgos.
- **[REQ-208]** Event Broker: Emitir eventos asíncronos quality.ca-01-10.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-209]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-10/fmeamatrix asegurando validación estricta con Joi/Zod.
- **[REQ-210]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-10/mitigation asegurando validación estricta con Joi/Zod.
- **[REQ-211]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-10/reviews asegurando validación estricta con Joi/Zod.
- **[REQ-212]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-10/impactassessment asegurando validación estricta con Joi/Zod.
- **[REQ-213]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-10.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-214]** Command Center UI: Componente React tipo workspace/dashboard para FMEAMatrix, empleando React Query.
- **[REQ-215]** Command Center UI: Componente React tipo workspace/dashboard para Mitigation, empleando React Query.
- **[REQ-216]** Command Center UI: Componente React tipo workspace/dashboard para Reviews, empleando React Query.
- **[REQ-217]** Command Center UI: Componente React tipo workspace/dashboard para Impact Assessment, empleando React Query.
- **[REQ-218]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-10 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-219]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Gestión de Riesgos.
- **[REQ-220]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-10.

## CA-01-11 - Manejo de Derrames

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-221]** Schema/Entity: Implementar tablas relacionales para SOS Alert con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-222]** Schema/Entity: Implementar tablas relacionales para Kit Tracking con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-223]** Schema/Entity: Implementar tablas relacionales para Neutralization con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-224]** Schema/Entity: Implementar tablas relacionales para Disposal con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-225]** Auditoría (GXP): Todo cambio en el esquema de CA-01-11 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-226]** State Machine: Definir el nodo de estado sos_alert en ca-01-11_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-227]** State Machine: Definir el nodo de estado kit_tracking en ca-01-11_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-228]** State Machine: Definir el nodo de estado neutralization en ca-01-11_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-229]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Manejo de Derrames.
- **[REQ-230]** Event Broker: Emitir eventos asíncronos quality.ca-01-11.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-231]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-11/sosalert asegurando validación estricta con Joi/Zod.
- **[REQ-232]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-11/kittracking asegurando validación estricta con Joi/Zod.
- **[REQ-233]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-11/neutralization asegurando validación estricta con Joi/Zod.
- **[REQ-234]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-11/disposal asegurando validación estricta con Joi/Zod.
- **[REQ-235]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-11.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-236]** Command Center UI: Componente React tipo workspace/dashboard para SOS Alert, empleando React Query.
- **[REQ-237]** Command Center UI: Componente React tipo workspace/dashboard para Kit Tracking, empleando React Query.
- **[REQ-238]** Command Center UI: Componente React tipo workspace/dashboard para Neutralization, empleando React Query.
- **[REQ-239]** Command Center UI: Componente React tipo workspace/dashboard para Disposal, empleando React Query.
- **[REQ-240]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-11 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-241]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Manejo de Derrames.
- **[REQ-242]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-11.

## CA-01-12 - Prácticas de Higiene Personal

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-243]** Schema/Entity: Implementar tablas relacionales para Daily Checks con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-244]** Schema/Entity: Implementar tablas relacionales para Uniforms con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-245]** Schema/Entity: Implementar tablas relacionales para Illness Log con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-246]** Schema/Entity: Implementar tablas relacionales para Sanctions con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-247]** Auditoría (GXP): Todo cambio en el esquema de CA-01-12 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-248]** State Machine: Definir el nodo de estado daily_checks en ca-01-12_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-249]** State Machine: Definir el nodo de estado uniforms en ca-01-12_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-250]** State Machine: Definir el nodo de estado illness_log en ca-01-12_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-251]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Prácticas de Higiene Personal.
- **[REQ-252]** Event Broker: Emitir eventos asíncronos quality.ca-01-12.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-253]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-12/dailychecks asegurando validación estricta con Joi/Zod.
- **[REQ-254]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-12/uniforms asegurando validación estricta con Joi/Zod.
- **[REQ-255]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-12/illnesslog asegurando validación estricta con Joi/Zod.
- **[REQ-256]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-12/sanctions asegurando validación estricta con Joi/Zod.
- **[REQ-257]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-12.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-258]** Command Center UI: Componente React tipo workspace/dashboard para Daily Checks, empleando React Query.
- **[REQ-259]** Command Center UI: Componente React tipo workspace/dashboard para Uniforms, empleando React Query.
- **[REQ-260]** Command Center UI: Componente React tipo workspace/dashboard para Illness Log, empleando React Query.
- **[REQ-261]** Command Center UI: Componente React tipo workspace/dashboard para Sanctions, empleando React Query.
- **[REQ-262]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-12 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-263]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Prácticas de Higiene Personal.
- **[REQ-264]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-12.

## CA-01-13 - Comunicación

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-265]** Schema/Entity: Implementar tablas relacionales para Templates con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-266]** Schema/Entity: Implementar tablas relacionales para Approval con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-267]** Schema/Entity: Implementar tablas relacionales para Mass Mail con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-268]** Schema/Entity: Implementar tablas relacionales para Read Receipts con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-269]** Auditoría (GXP): Todo cambio en el esquema de CA-01-13 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-270]** State Machine: Definir el nodo de estado templates en ca-01-13_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-271]** State Machine: Definir el nodo de estado approval en ca-01-13_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-272]** State Machine: Definir el nodo de estado mass_mail en ca-01-13_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-273]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Comunicación.
- **[REQ-274]** Event Broker: Emitir eventos asíncronos quality.ca-01-13.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-275]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-13/templates asegurando validación estricta con Joi/Zod.
- **[REQ-276]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-13/approval asegurando validación estricta con Joi/Zod.
- **[REQ-277]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-13/massmail asegurando validación estricta con Joi/Zod.
- **[REQ-278]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-13/readreceipts asegurando validación estricta con Joi/Zod.
- **[REQ-279]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-13.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-280]** Command Center UI: Componente React tipo workspace/dashboard para Templates, empleando React Query.
- **[REQ-281]** Command Center UI: Componente React tipo workspace/dashboard para Approval, empleando React Query.
- **[REQ-282]** Command Center UI: Componente React tipo workspace/dashboard para Mass Mail, empleando React Query.
- **[REQ-283]** Command Center UI: Componente React tipo workspace/dashboard para Read Receipts, empleando React Query.
- **[REQ-284]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-13 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-285]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Comunicación.
- **[REQ-286]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-13.

## CA-01-14 - Calificación Áreas Controladas

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-287]** Schema/Entity: Implementar tablas relacionales para HVAC Specs con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-288]** Schema/Entity: Implementar tablas relacionales para Particles con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-289]** Schema/Entity: Implementar tablas relacionales para Pressure con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-290]** Schema/Entity: Implementar tablas relacionales para Recertification con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-291]** Auditoría (GXP): Todo cambio en el esquema de CA-01-14 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-292]** State Machine: Definir el nodo de estado hvac_specs en ca-01-14_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-293]** State Machine: Definir el nodo de estado particles en ca-01-14_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-294]** State Machine: Definir el nodo de estado pressure en ca-01-14_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-295]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Calificación Áreas Controladas.
- **[REQ-296]** Event Broker: Emitir eventos asíncronos quality.ca-01-14.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-297]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-14/hvacspecs asegurando validación estricta con Joi/Zod.
- **[REQ-298]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-14/particles asegurando validación estricta con Joi/Zod.
- **[REQ-299]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-14/pressure asegurando validación estricta con Joi/Zod.
- **[REQ-300]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-14/recertification asegurando validación estricta con Joi/Zod.
- **[REQ-301]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-14.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-302]** Command Center UI: Componente React tipo workspace/dashboard para HVAC Specs, empleando React Query.
- **[REQ-303]** Command Center UI: Componente React tipo workspace/dashboard para Particles, empleando React Query.
- **[REQ-304]** Command Center UI: Componente React tipo workspace/dashboard para Pressure, empleando React Query.
- **[REQ-305]** Command Center UI: Componente React tipo workspace/dashboard para Recertification, empleando React Query.
- **[REQ-306]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-14 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-307]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Calificación Áreas Controladas.
- **[REQ-308]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-14.

## CA-01-15 - Auditorías

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-309]** Schema/Entity: Implementar tablas relacionales para Checklists con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-310]** Schema/Entity: Implementar tablas relacionales para Schedules con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-311]** Schema/Entity: Implementar tablas relacionales para Findings con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-312]** Schema/Entity: Implementar tablas relacionales para CAPA Sync con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-313]** Auditoría (GXP): Todo cambio en el esquema de CA-01-15 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-314]** State Machine: Definir el nodo de estado checklists en ca-01-15_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-315]** State Machine: Definir el nodo de estado schedules en ca-01-15_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-316]** State Machine: Definir el nodo de estado findings en ca-01-15_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-317]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Auditorías.
- **[REQ-318]** Event Broker: Emitir eventos asíncronos quality.ca-01-15.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-319]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-15/checklists asegurando validación estricta con Joi/Zod.
- **[REQ-320]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-15/schedules asegurando validación estricta con Joi/Zod.
- **[REQ-321]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-15/findings asegurando validación estricta con Joi/Zod.
- **[REQ-322]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-15/capasync asegurando validación estricta con Joi/Zod.
- **[REQ-323]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-15.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-324]** Command Center UI: Componente React tipo workspace/dashboard para Checklists, empleando React Query.
- **[REQ-325]** Command Center UI: Componente React tipo workspace/dashboard para Schedules, empleando React Query.
- **[REQ-326]** Command Center UI: Componente React tipo workspace/dashboard para Findings, empleando React Query.
- **[REQ-327]** Command Center UI: Componente React tipo workspace/dashboard para CAPA Sync, empleando React Query.
- **[REQ-328]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-15 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-329]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Auditorías.
- **[REQ-330]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-15.

## CA-01-16 - Muestreo y Aprobación

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-331]** Schema/Entity: Implementar tablas relacionales para AQL Tables con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-332]** Schema/Entity: Implementar tablas relacionales para Retain Samples con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-333]** Schema/Entity: Implementar tablas relacionales para LIMS Sync con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-334]** Schema/Entity: Implementar tablas relacionales para Release con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-335]** Auditoría (GXP): Todo cambio en el esquema de CA-01-16 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-336]** State Machine: Definir el nodo de estado aql_tables en ca-01-16_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-337]** State Machine: Definir el nodo de estado retain_samples en ca-01-16_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-338]** State Machine: Definir el nodo de estado lims_sync en ca-01-16_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-339]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Muestreo y Aprobación.
- **[REQ-340]** Event Broker: Emitir eventos asíncronos quality.ca-01-16.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-341]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-16/aqltables asegurando validación estricta con Joi/Zod.
- **[REQ-342]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-16/retainsamples asegurando validación estricta con Joi/Zod.
- **[REQ-343]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-16/limssync asegurando validación estricta con Joi/Zod.
- **[REQ-344]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-16/release asegurando validación estricta con Joi/Zod.
- **[REQ-345]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-16.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-346]** Command Center UI: Componente React tipo workspace/dashboard para AQL Tables, empleando React Query.
- **[REQ-347]** Command Center UI: Componente React tipo workspace/dashboard para Retain Samples, empleando React Query.
- **[REQ-348]** Command Center UI: Componente React tipo workspace/dashboard para LIMS Sync, empleando React Query.
- **[REQ-349]** Command Center UI: Componente React tipo workspace/dashboard para Release, empleando React Query.
- **[REQ-350]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-16 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-351]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Muestreo y Aprobación.
- **[REQ-352]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-16.

## CA-01-17 - Tecnovigilancia

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-353]** Schema/Entity: Implementar tablas relacionales para Adverse Events con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-354]** Schema/Entity: Implementar tablas relacionales para Patient Data con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-355]** Schema/Entity: Implementar tablas relacionales para Manufacturer Notify con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-356]** Schema/Entity: Implementar tablas relacionales para ARCSA Sync con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-357]** Auditoría (GXP): Todo cambio en el esquema de CA-01-17 debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-358]** State Machine: Definir el nodo de estado adverse_events en ca-01-17_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-359]** State Machine: Definir el nodo de estado patient_data en ca-01-17_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-360]** State Machine: Definir el nodo de estado manufacturer_notify en ca-01-17_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-361]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Tecnovigilancia.
- **[REQ-362]** Event Broker: Emitir eventos asíncronos quality.ca-01-17.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-363]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-17/adverseevents asegurando validación estricta con Joi/Zod.
- **[REQ-364]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-17/patientdata asegurando validación estricta con Joi/Zod.
- **[REQ-365]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-17/manufacturernotify asegurando validación estricta con Joi/Zod.
- **[REQ-366]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/ca-01-17/arcsasync asegurando validación estricta con Joi/Zod.
- **[REQ-367]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CA-01-17.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-368]** Command Center UI: Componente React tipo workspace/dashboard para Adverse Events, empleando React Query.
- **[REQ-369]** Command Center UI: Componente React tipo workspace/dashboard para Patient Data, empleando React Query.
- **[REQ-370]** Command Center UI: Componente React tipo workspace/dashboard para Manufacturer Notify, empleando React Query.
- **[REQ-371]** Command Center UI: Componente React tipo workspace/dashboard para ARCSA Sync, empleando React Query.
- **[REQ-372]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CA-01-17 mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-373]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Tecnovigilancia.
- **[REQ-374]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CA-01-17.

## CORE - Arquitectura y Plataforma Base

### Capa de Datos (PostgreSQL / Prisma)
- **[REQ-375]** Schema/Entity: Implementar tablas relacionales para RBAC con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-376]** Schema/Entity: Implementar tablas relacionales para Webhooks con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-377]** Schema/Entity: Implementar tablas relacionales para GXP Audit con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-378]** Schema/Entity: Implementar tablas relacionales para Storage con soporte soft_delete, constraints CHECK, y UUIDs primarios. Asegurar foreign keys hacia tablas base.
- **[REQ-379]** Auditoría (GXP): Todo cambio en el esquema de CORE debe registrase en udit_logs con diff X/Y, user_id, timestamp y firma IP/Token.
### Máquina de Estados y Workflow Engine (Node.js)
- **[REQ-380]** State Machine: Definir el nodo de estado rbac en core_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-381]** State Machine: Definir el nodo de estado webhooks en core_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-382]** State Machine: Definir el nodo de estado gxp_audit en core_state_machine.service.js, bloqueando transiciones ilegales basadas en asserts.
- **[REQ-383]** Jobs/CRON: Configurar Worker en Redis/BullMQ para procesar expiraciones y SLAs de Arquitectura y Plataforma Base.
- **[REQ-384]** Event Broker: Emitir eventos asíncronos quality.core.updated en la capa de servicio.
### Endpoints y API REST (Express)
- **[REQ-385]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/core/rbac asegurando validación estricta con Joi/Zod.
- **[REQ-386]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/core/webhooks asegurando validación estricta con Joi/Zod.
- **[REQ-387]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/core/gxpaudit asegurando validación estricta con Joi/Zod.
- **[REQ-388]** Endpoint: Exponer POST/PUT/GET /api/v1/quality/core/storage asegurando validación estricta con Joi/Zod.
- **[REQ-389]** RBAC: Inyectar middleware RBAC requiriendo roles explícitos (ej. jefe_calidad, suntos_regulatorios) para CORE.
### FrontEnd y UX (React, UI Steppers)
- **[REQ-390]** Command Center UI: Componente React tipo workspace/dashboard para RBAC, empleando React Query.
- **[REQ-391]** Command Center UI: Componente React tipo workspace/dashboard para Webhooks, empleando React Query.
- **[REQ-392]** Command Center UI: Componente React tipo workspace/dashboard para GXP Audit, empleando React Query.
- **[REQ-393]** Command Center UI: Componente React tipo workspace/dashboard para Storage, empleando React Query.
- **[REQ-394]** UX Stepper: Integrar Stepper.jsx/Timeline.jsx bloqueando avance en CORE mediante rendering condicional usando locked_reasons analítico del framework ST-01.
### Firma Digital y Trazabilidad (GXP)
- **[REQ-395]** Signature 2FA: Invocar y acoplar el módulo modal 2FA/Password centralizado para liberación de actas en Arquitectura y Plataforma Base.
- **[REQ-396]** Document Gen: Generar PDF estático en docs/pdf o Firebase con librerías pdf-lib inyectando firmas, UUIDs y QR codes de trazabilidad de CORE.

- **[REQ-397]** System Security: Sanitizar inputs y parsear raw SQL outputs con prepared statements para robustecer métricas anti-inyecciones.
- **[REQ-398]** System Security: Sanitizar inputs y parsear raw SQL outputs con prepared statements para robustecer métricas anti-inyecciones.
- **[REQ-399]** System Security: Sanitizar inputs y parsear raw SQL outputs con prepared statements para robustecer métricas anti-inyecciones.
- **[REQ-400]** System Security: Sanitizar inputs y parsear raw SQL outputs con prepared statements para robustecer métricas anti-inyecciones.
