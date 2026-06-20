# URS — MÓDULO SERVICIO TÉCNICO Y MANTENIMIENTOS

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento define los requerimientos de usuario del módulo Servicio Técnico y Mantenimientos del sistema FamSPI. Su propósito es establecer, desde la perspectiva de los actores que operan el área técnica, qué capacidades debe proveer el sistema, por qué son necesarias y cómo deben manifestarse en la operación diaria de campo, coordinación interna y generación de evidencia documental.

El módulo cubre la totalidad del ciclo de vida técnico de los equipos gestionados por la organización: desde la planificación de capacitaciones del equipo de técnicos hasta la resolución de mantenimientos correctivos complejos con cotización de repuestos, visitas de campo y cierre documentado. Es el módulo de mayor superficie funcional del sistema, e integra cuatro procedimientos técnicos formales (ST-01-01 a ST-01-04), nueve tipos de documentos PDF controlados (F.ST-02, F.ST-07, F.ST-09 al F.ST-12, F.ST-14, F.ST-16, F.ST-20) y tres máquinas de estado independientes gestionadas por el backend.

## 2. Objetivo

Definir los requerimientos de usuario de alto nivel para el módulo Servicio Técnico y Mantenimientos, estableciendo qué debe hacer el sistema para cada actor técnico autorizado, qué resultado se espera y bajo qué condiciones funciona cada capacidad.

## 3. Alcance

**Incluye:**
- Gestión de cronograma de capacitaciones del equipo técnico (CRUD completo).
- Gestión de disponibilidad individual de técnicos y registro de actividades técnicas.
- Registro de equipos y planificación de mantenimientos anuales.
- Consulta de mantenimientos registrados.
- Generación de documentos PDF operativos controlados: desinfección, coordinación de entrenamiento, lista de asistencia, evaluación de entrenamiento, evaluación de especialista, conformidad, verificación de equipos nuevos, FST-11 (acta de retiro).
- Workflow de entrenamiento con máquina de estado (ST-01-01): coordinación, asistencia, evaluación, evaluación de especialista, reentrenamiento, conformidad, emisión de certificado y entrega.
- Workflow de retiro de equipos con máquina de estado (ST-01-01): solicitud, coordinación, desinfección, embalaje, ejecución y cierre.
- Workflow de mantenimientos correctivos con máquina de estado propia (ST-01-03): CEAC recibido, diagnóstico, escalada, visita, clasificación, gestión de repuestos, cierre.
- Workflow de casos externos con máquina de estado (ST-01-04): creación en plataformas externas (Navify, Rexis, GoApp, Online Support), despacho CEAC, seguimiento de hitos GoApp y cierre.
- Infraestructura de workflow transversal: catálogo de procedimientos, registro de estado, timeline de eventos, documentos de workflow, resúmenes operacionales y reporting.

**Excluye explícitamente:**
- Módulo de Business Case y aprobaciones comerciales.
- Módulo de Colaboradores y entregas de colaboradores.
- Módulo de Compras privadas.
- Módulo de Activos TI y certificaciones de usuario.
- Módulo de Personal y solicitudes de personal.
- Módulo de Oportunidades comerciales.
- Gestión de autenticación, sesiones y firma digital avanzada (Area 01).

## 4. Actores

| Actor | Rol en el sistema | Acciones principales |
|---|---|---|
| `tecnico` | Técnico de campo o laboratorio | Registra disponibilidad, actividades, equipos, mantenimientos, genera PDFs, opera workflows de entrenamiento y retiro, crea y avanza casos correctivos |
| `servicio_tecnico` | Coordinador de servicio técnico | Gestiona disponibilidad y actividades, consulta y opera workflows, administra casos correctivos y casos externos |
| `jefe_tecnico` | Jefe del equipo técnico | Todas las operaciones de técnico más escritura en registro de workflow y upsert de estado del registry |
| `jefe_servicio_tecnico` | Jefe del área de servicio técnico | Control total del módulo: todas las operaciones incluyendo registro de workflow y workflows externos |
| `gerencia` / `gerencia_general` | Alta dirección | Consulta de todos los workflows, operaciones de escritura críticas, upsert del registry, acceso al reporting y resumen operacional |
| `comercial` / `jefe_comercial` / `acp_comercial` / `backoffice_comercial` | Roles comerciales | Lectura de workflows, consulta de actividades técnicas, lectura y escritura de casos correctivos y casos externos |
| `operaciones` / `jefe_operaciones` / `jefe_logistica` / `logistica` | Operaciones y logística | Lectura de workflows, escritura en workflow de retiro |
| `ti` / `jefe_ti` / `admin_ti` | Área de TI | Lectura y escritura de casos correctivos y casos externos, consulta de equipos |
| `dispatcher` / `ceac` | Roles especializados de despacho | Lectura y escritura en casos externos únicamente |

## 5. Justificación del módulo

El módulo Servicio Técnico y Mantenimientos existe porque la organización opera equipos médicos o de laboratorio cuyo ciclo de vida requiere trazabilidad formal en cada etapa: capacitación del personal que los usa, instalación, entrenamiento, mantenimientos preventivos y correctivos, retiro y disposición. Ninguno de estos procesos puede quedar sin evidencia documental, aprobación de rol autorizado o historial de estados auditables.

Sin este módulo, el sistema carecería de capacidad para:
- Coordinar y documentar la formación técnica del personal.
- Registrar y controlar el estado de cada equipo bajo responsabilidad técnica.
- Ejecutar mantenimientos correctivos con flujo de diagnóstico, escalada, cotización de repuestos y cierre formal.
- Publicar evidencia documental alineada con los procedimientos ST-01-01 a ST-01-04.
- Interoperar con plataformas externas de soporte (Navify, Rexis, GoApp) mediante adaptadores controlados y sincronización por cola.

## 6. Requerimientos funcionales del usuario

### REQ-SRV-001 — Gestión de capacitaciones técnicas

**Actor:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`
**Enunciado:** El sistema debe permitir crear, consultar, modificar y eliminar registros de capacitaciones técnicas programadas para el equipo.
**Resultado esperado:** El cronograma de capacitaciones queda actualizado y accesible para los roles autorizados; cada operación queda identificada con el usuario que la realizó.
**Criticidad:** Media

---

### REQ-SRV-002 — Gestión de disponibilidad de técnicos

**Actor:** `servicio_tecnico`, `tecnico`, `jefe_servicio_tecnico`, `gerencia`
**Enunciado:** El sistema debe permitir consultar y actualizar el estado de disponibilidad individual de cada técnico para planificación de visitas y asignación de actividades.
**Resultado esperado:** La disponibilidad actual del equipo técnico es visible en tiempo real para quienes planifican actividades de campo.
**Criticidad:** Alta

---

### REQ-SRV-003 — Registro y consulta de actividades técnicas

**Actor:** `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `comercial`, `acp_comercial`, `jefe_comercial`
**Enunciado:** El sistema debe permitir listar las actividades técnicas registradas y crear nuevas actividades con su descripción y asignación.
**Resultado esperado:** Las actividades técnicas quedan registradas y son consultables por los roles operativos y comerciales que necesitan visibilidad del estado del campo.
**Criticidad:** Media

---

### REQ-SRV-004 — Gestión de equipos

**Actor:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `ti`, `jefe_ti`, `admin_ti`
**Enunciado:** El sistema debe permitir consultar los equipos registrados y crear nuevos registros de equipo con sus datos identificativos.
**Resultado esperado:** El catálogo de equipos queda actualizado y accesible para técnicos y TI; los equipos registrados sirven de base para los flujos de mantenimiento y retiro.
**Criticidad:** Alta

---

### REQ-SRV-005 — Consulta y planificación de mantenimientos anuales

**Actor:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`
**Enunciado:** El sistema debe permitir consultar el cronograma de mantenimientos registrados y crear nuevos eventos de mantenimiento anual planificado.
**Resultado esperado:** El cronograma anual de mantenimientos es visible y gestionable; los eventos quedan trazados por equipo y fecha.
**Criticidad:** Alta

---

### REQ-SRV-006 — Generación de PDF de desinfección de instrumentos

**Actor:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`
**Enunciado:** El sistema debe permitir generar el documento PDF de registro de desinfección de instrumentos con los datos del procedimiento, equipo y responsable.
**Resultado esperado:** Se obtiene un documento PDF de desinfección (F.ST-02) con los datos ingresados, listo para firma y archivo.
**Criticidad:** Alta

---

### REQ-SRV-007 — Workflow de entrenamiento con máquina de estado (ST-01-01)

**Actor escritura:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`
**Actor lectura:** todos los roles de `workflowReadRoles` (técnicos, comerciales, operaciones, logística, gerencia)
**Enunciado:** El sistema debe soportar el flujo completo de entrenamiento de equipos: coordinación, asistencia, evaluación, evaluación de especialista, conformidad, reentrenamiento cuando aplique, emisión de certificado y entrega. Cada etapa debe estar controlada por una máquina de estado (ST-01-01) que valide transiciones permitidas. El sistema debe generar los documentos PDF correspondientes a cada etapa del flujo.
**Resultado esperado:** El entrenamiento avanza por etapas formalmente validadas; cada etapa genera un documento PDF controlado (coordinación, asistencia, evaluación, evaluación de especialista, conformidad, verificación); el certificado se emite y se registra su entrega. El historial de estados queda en la línea de tiempo del workflow.
**Criticidad:** Alta

---

### REQ-SRV-008 — Workflow de retiro de equipos con máquina de estado (ST-01-01)

**Actor escritura:** `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`, `servicio_tecnico`, `logistica`, `jefe_logistica`, `comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`
**Actor lectura:** todos los roles de `workflowReadRoles`
**Enunciado:** El sistema debe soportar el flujo de retiro de equipos desde la solicitud inicial hasta el cierre: solicitud, coordinación de retiro, desinfección, embalaje, ejecución del retiro y cierre. Cada transición debe ser validada por la máquina de estado. El sistema debe generar el acta de retiro FST-11 en PDF.
**Resultado esperado:** El retiro de equipos avanza por etapas controladas; se genera el acta FST-11; el estado final queda registrado y el workflow pasa a `completed`.
**Criticidad:** Alta

---

### REQ-SRV-009 — Mantenimientos correctivos (ST-01-03) con workspace y KPIs

**Actor escritura:** `correctiveWriteRoles` (técnicos, TI, comerciales, gerencia)
**Actor lectura:** `correctiveReadRoles` (técnicos, TI, comerciales, gerencia)
**Enunciado:** El sistema debe permitir crear casos de mantenimiento correctivo que pasen por el flujo CEAC: recepción, diagnóstico, escalada a despacho, visita, clasificación (aplicaciones/ingeniería/proveedor), gestión de repuestos (cotización, aprobación del cliente, rechazo), revisita, reemplazo de piezas, desinfección pendiente y cierre. El workspace debe listar todos los casos con filtros y exponer KPIs operacionales. Cada caso debe admitir timeline de eventos, comentarios y evidencias.
**Resultado esperado:** Los casos correctivos se crean, avanzan por estados validados y se cierran con trazabilidad completa. El workspace muestra el estado consolidado del área correctiva. Los KPIs reflejan la carga operativa en tiempo real. Los comentarios, eventos y evidencias quedan asociados al caso.
**Criticidad:** Alta

---

### REQ-SRV-010 — Casos externos con integración a plataformas de soporte (ST-01-04)

**Actor escritura:** `WRITE_ROLES` de externalCases (técnicos, TI, CEAC, dispatcher, gerencia)
**Actor lectura:** `READ_ROLES` de externalCases (técnicos, TI, comerciales, CEAC, dispatcher, gerencia)
**Enunciado:** El sistema debe permitir crear y gestionar casos que se sincronizan con plataformas externas de soporte: Navify, Online Support, Rexis y GoApp. Debe soportar: creación de caso por proveedor mediante adaptadores, despacho CEAC, reconciliación de estado, reintentos de sincronización, seguimiento de hitos de GoApp (aceptar OT, inicio de viaje, tiempo de trabajo, finalizar OT, cita de seguimiento), decisión CEAC y consulta de salud de proveedores.
**Resultado esperado:** Los casos externos quedan creados, sincronizados y rastreados en sus plataformas de destino. El workspace muestra el estado de todos los casos externos. Los hitos de GoApp quedan registrados con sus precondiciones validadas. Los errores de sincronización pasan al estado `sync_error` y permiten reintento.
**Criticidad:** Alta

---

### REQ-SRV-011 — Infraestructura de workflow: catálogo, registry, timeline y reporting

**Actor escritura del registry:** `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia`, `gerencia_general`
**Actor lectura:** todos los roles de `workflowReadRoles`
**Enunciado:** El sistema debe exponer el catálogo de procedimientos técnicos (ST-01-01 a ST-01-04) con sus máquinas de estado, el estado actual del registry de workflows activos, la línea de tiempo de eventos de todos los workflows, los documentos de workflow generados, el resumen de documentos y el resumen de reporting operacional.
**Resultado esperado:** Los supervisores y gerencia pueden consultar el estado completo del área técnica desde un punto central. El catálogo permite auditar qué procedimientos están activos, qué estados son permitidos y cuáles son las transiciones válidas de cada máquina de estado.
**Criticidad:** Media

## 7. Requerimientos no funcionales

### RNF-SRV-001 — Autenticación obligatoria
Todos los endpoints del módulo deben exigir token JWT válido mediante el middleware `verifyToken`. Ningún endpoint del módulo es público.

### RNF-SRV-002 — Control de acceso por rol
Cada endpoint aplica `requireRole` con la lista exacta de roles permitidos según la operación (lectura vs. escritura, workflow general vs. correctivos vs. externos). Los roles están definidos en cuatro grupos: `workflowReadRoles`, `withdrawalWriteRoles`, `correctiveReadRoles`, `correctiveWriteRoles`, más los roles por ruta específica de capacitaciones, disponibilidad, equipos y desinfección.

### RNF-SRV-003 — Integridad de máquinas de estado
El sistema no debe permitir transiciones de estado inválidas en ninguno de los tres workflows (ST-01-01, ST-01-03, ST-01-04). Toda transición debe ser validada por la función `isValidTransition` del servicio de máquina de estado correspondiente antes de persistirse.

### RNF-SRV-004 — Trazabilidad de eventos
Cada avance de estado en los workflows debe generar un evento en la tabla de auditoría de workflow mediante `appendWorkflowAuditEvent`. La línea de tiempo de cada workflow debe ser reconstruible desde los eventos persistidos.

### RNF-SRV-005 — Tolerancia a fallos de sincronización externa
Los casos del workflow ST-01-04 deben tolerar fallos de sincronización con plataformas externas mediante cola de reintentos con backoff exponencial, configurable mediante variables de entorno (`EXTERNAL_CASE_SYNC_MAX_ATTEMPTS`, `EXTERNAL_CASE_SYNC_BACKOFF_BASE_MS`, `EXTERNAL_CASE_SYNC_BACKOFF_MAX_MS`).

### RNF-SRV-006 — Disponibilidad de generación de PDF
Los servicios de generación de PDF deben responder de forma controlada ante datos incompletos y no deben bloquear otros flujos del módulo en caso de error de renderizado.

### RNF-SRV-007 — Rendimiento en consultas de workspace
Las consultas de listado de workspace y KPIs de casos correctivos y externos deben responder en tiempos aptos para operación en campo con límite de registros por consulta (default 100 en casos externos).

## 8. Reglas de negocio

Las siguientes reglas están extraídas directamente del código de servicios y máquinas de estado:

| Regla | Fuente | Descripción |
|---|---|---|
| RN-SRV-001 | `workflowStateMachine.service.js` | El procedimiento ST-01-01 tiene estado inicial `initiated` y estados terminales `completed` y `cancelled`. No existen transiciones saliendo de estos. |
| RN-SRV-002 | `workflowStateMachine.service.js` | El estado `blocked` en ST-01-01 permite retroceder a cualquier estado previo al bloqueo, excepto `completed`. |
| RN-SRV-003 | `workflowStateMachine.service.js` | El documento F.ST-11 mapea al estado `withdrawal_executed`; F.ST-20 mapea a `fst20_requested`; F.ST-07 mapea a `fst07_recorded`. |
| RN-SRV-004 | `correctiveStateMachine.service.js` | El estado inicial de casos correctivos es `ceac_received`. Los estados terminales son `closed` y `cancelled` sin transiciones de salida. |
| RN-SRV-005 | `correctiveStateMachine.service.js` | Un caso correctivo puede escalarse desde `ceac_received` directamente a `escalated_dispatch` o resolverse remotamente (`resolved_remote`) sin necesidad de visita. |
| RN-SRV-006 | `correctiveStateMachine.service.js` | La clasificación de un caso (aplicaciones / ingeniería / proveedor LIS) se refleja en estados diferenciados (`classified_applications`, `classified_engineering`, `classified_provider`). |
| RN-SRV-007 | `correctiveStateMachine.service.js` | Los repuestos requieren aprobación del cliente antes de pasar a `parts_approved`; el rechazo del cliente lleva al cierre directo (`parts_rejected` → `closed`). |
| RN-SRV-008 | `trainingWorkflow.service.js` | La regla de asistencia mínima por defecto es 100%; la nota de evaluación mínima por defecto es 80%; la nota de especialista por defecto es 80%. |
| RN-SRV-009 | `trainingWorkflow.service.js` | El plazo máximo por defecto para emisión de certificado es 30 días desde la aprobación del entrenamiento. |
| RN-SRV-010 | `withdrawalWorkflow.service.js` | El flujo de retiro requiere que el caso proveedor esté en estado `not_required`, `resolved` o `closed` para avanzar; la orden de trabajo debe estar en `pending`, `closed` o `completed`. |
| RN-SRV-011 | `externalCases.service.js` | Los proveedores externos soportados son: `navify`, `online_support`, `rexis`, `goapp`. Cualquier otro valor es rechazado en la creación del caso. |
| RN-SRV-012 | `externalCases.service.js` | Los hitos de GoApp tienen precondiciones: `start_travel` requiere `accept_work_order`; `work_time` requiere `start_travel`; `finalize_work_order` requiere `work_time`. |
| RN-SRV-013 | `externalCases.service.js` | El upsert de identidad de proveedor (provider identity) está restringido a `WRITE_ROLES`; la lectura de identidades a `READ_ROLES`. |
| RN-SRV-014 | `workflowRegistry.service.js` | El upsert del registry (estado de workflows activos) está restringido a `jefe_tecnico`, `jefe_servicio_tecnico`, `gerencia` y `gerencia_general`. |

## 9. Dependencias con otros módulos

| Módulo | Tipo de dependencia | Descripción |
|---|---|---|
| `auth` | Obligatoria | JWT verificado en todos los endpoints mediante `verifyToken` |
| `roles` | Obligatoria | `requireRole` con grupos de roles definidos por funcionalidad |
| `auditoria` / `workflowAudit` | Obligatoria | `appendWorkflowAuditEvent` registra cada transición de estado en todos los workflows |
| `drive` (Google Drive) | Funcional | El workflow de retiro (`withdrawalWorkflow.service.js`) sube archivos PDF a Drive mediante `ensureFolder` y `uploadBase64File` |
| `ceacDispatch.service.js` | Interna | Despacho de casos correctivos a roles CEAC/dispatcher con notificación de usuarios |
| Plataformas externas | Integración externa | Navify, Rexis, GoApp mediante adaptadores en `adapters/` con cola de sincronización |
| `documents` / `files` | Funcional | Tracking de documentos de workflow mediante `fst14.service.js` y `documentCompatibility.service.js` |

## 10. Conclusión

El módulo Servicio Técnico y Mantenimientos es el componente de mayor complejidad funcional de FamSPI. Integra cuatro procedimientos técnicos formales con sus máquinas de estado, nueve tipos de documentos PDF controlados, tres grupos de roles con permisos diferenciados y dos canales de integración externa. Los requerimientos definidos en este documento cubren la totalidad de las capacidades identificadas en el código fuente, con énfasis en la trazabilidad de estados, la integridad documental y el control de acceso por rol.
