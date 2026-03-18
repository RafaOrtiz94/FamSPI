# URS - AREA 01 GOBIERNO, SEGURIDAD, CUMPLIMIENTO Y GESTION DOCUMENTAL

## 1. Introduccion
El presente documento define los requerimientos de usuario del Area 01 del sistema SPI, correspondiente a Gobierno, Seguridad, Cumplimiento y Gestion Documental. Su finalidad es establecer, desde la perspectiva del negocio y de los actores que usan el sistema, que capacidades deben existir, por que son necesarias, como deben manifestarse en la operacion diaria y cuando deben activarse dentro del ciclo real del sistema.

El area integra funciones de identidad, control de acceso, monitoreo de seguridad, auditoria, preparacion de evidencia, gestion documental, notificaciones operativas, dashboards del dominio y firma avanzada. La necesidad de estas capacidades se justifica por la obligacion de mantener trazabilidad de acciones, integridad documental, control de sesiones, evidencia sobre accesos sensibles y tratamiento responsable de la informacion. Estas exigencias son consistentes con la Ley Organica de Proteccion de Datos Personales, su reglamento general y con criterios de control de acceso, registro de eventos y seguridad de la informacion alineados con ISO/IEC 27001:2022.

## 2. Objetivo
Definir los requerimientos de usuario de alto nivel para los modulos `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management`, `signature`, `documents`, `files`, `notifications`, `dashboard` y `gmail`, estableciendo su justificacion funcional, su forma esperada de operacion y el momento o contexto en que deben intervenir.

## 3. Alcance
Incluye backend Express y middlewares transversales del area, frontend React consumidor de seguridad, auditoria, firma y soporte documental, persistencia PostgreSQL asociada a identidad, auditoria, solicitudes, documentos y notificaciones, integraciones Google OAuth, Drive, Docs y Gmail, y validacion documental y operativa de IQ, OQ y PQ para el area.

Excluye flujos de negocio propios de otras areas, automatizaciones de continuidad operativa e infraestructura y mecanismos de respaldo de base de datos.

## 4. Actores
- Colaborador autenticado
- Usuario nuevo pendiente de aceptacion LOPDP interna
- Equipo TI
- Jefe TI o administrador TI
- Gerencia o Gerencia General
- Jefe tecnico o jefe de servicio tecnico
- Firmante documental
- Revisor de seguridad
- Auditor externo temporal
- Usuario habilitado para correo con Gmail

## 5. Justificacion general del area
El Area 01 existe para sostener las capacidades transversales sin las cuales SPI no puede operar con gobierno tecnico verificable. El sistema necesita saber quien accede, bajo que rol, desde que sesion y con que evidencia; necesita registrar eventos auditables, aislar eventos de seguridad, preparar documentacion para auditorias, notificar hechos operativos, custodiar adjuntos y documentos generados, formalizar firmas avanzadas y permitir verificacion posterior de documentos. El area tambien necesita exponer visibilidad ejecutiva de partes concretas del dominio y permitir, cuando el proceso lo exige, el envio de correo desde la cuenta autorizada del usuario.

## 6. Justificacion por modulo
| Modulo | Por que existe | Como opera a alto nivel | Cuando aplica |
|---|---|---|---|
| `auth` | Para autenticar usuarios y controlar sesiones. | Google OAuth, JWT, refresh, logout y perfil. | Al iniciar, mantener o cerrar sesion. |
| `security` | Para detectar y revisar eventos de acceso sensibles. | Consulta auditoria, correlaciona notificaciones y permite revision TI. | Cuando TI necesita revisar actividad de riesgo. |
| `auditoria` | Para sostener trazabilidad institucional. | Lista, filtra, detalla y exporta bitacora transversal. | Cuando se requiere investigacion o evidencia. |
| `audit-prep` | Para preparar auditoria de forma controlada. | Administra ventana, secciones, documentos y accesos externos. | Antes y durante auditorias formales. |
| `approvals` | Para resolver decisiones del flujo tecnico soportado. | Presenta pendientes y registra aprobaciones o rechazos. | Cuando una solicitud requiere decision formal. |
| `management` | Para entregar visibilidad gerencial del dominio. | Expone metricas, listados, trazabilidad y documentos asociados. | Durante seguimiento ejecutivo. |
| `signature` | Para garantizar integridad y verificabilidad documental. | Calcula hash, firma, sella, genera QR y verifica. | Cuando un documento debe quedar formalizado. |
| `documents` | Para generar documentos operativos controlados. | Crea desde plantilla, permite firma posicionada y exporta PDF. | Cuando una solicitud necesita documento formalizable. |
| `files` | Para custodiar adjuntos por solicitud. | Carga, lista, descarga y elimina archivos con control de rol. | Cuando un flujo requiere anexos. |
| `notifications` | Para informar eventos operativos al usuario. | Lista, crea, marca como leidas y elimina notificaciones. | Cuando el sistema o un rol autorizado debe avisar un evento. |
| `dashboard` | Para exponer resumen operacional del dominio montado. | Devuelve metricas agregadas del dashboard comercial. | Cuando el rol autorizado requiere resumen ejecutivo. |
| `gmail` | Para enviar correo desde la cuenta real del usuario. | Gestiona OAuth, estado, envio y revocacion. | Cuando el flujo requiere correo autenticado. |

## 7. Requerimientos funcionales del usuario
- REQ-GD-001: El sistema debe autenticar usuarios internos mediante Google OAuth y crear una sesion trazable.
- REQ-GD-002: El sistema debe emitir `accessToken` y `refreshToken` y permitir renovar la sesion activa valida.
- REQ-GD-003: El sistema debe permitir consultar el perfil del usuario autenticado.
- REQ-GD-004: El sistema debe permitir cerrar la sesion activa del usuario y registrar dicho cierre.
- REQ-GD-005: El sistema debe permitir registrar la aceptacion interna de LOPDP con evidencia documental.
- REQ-GD-006: El sistema debe registrar eventos criticos de login y eventos fuera de horario en la bitacora de auditoria.
- REQ-GD-007: El sistema debe permitir a TI consultar, revisar y exportar eventos de login fuera de horario.
- REQ-GD-008: El sistema debe permitir activar o desactivar una ventana de auditoria y definir sus fechas de vigencia.
- REQ-GD-009: El sistema debe permitir administrar secciones y documentos de auditoria segun rol autorizado.
- REQ-GD-010: El sistema debe permitir aprobar o rechazar solicitudes del flujo tecnico habilitado y persistir la decision.
- REQ-GD-011: El sistema debe permitir a gerencia consultar metricas, trazabilidad y documentos asociados a una solicitud.
- REQ-GD-012: El sistema debe permitir crear documentos desde plantilla y recuperarlos por solicitud o identificador.
- REQ-GD-013: El sistema debe permitir insertar firma posicionada, exportar PDF y escalar a firma avanzada segun el flujo soportado.
- REQ-GD-014: El sistema debe permitir subir, listar, descargar y eliminar adjuntos segun rol.
- REQ-GD-015: El sistema debe permitir listar notificaciones del usuario y conocer su conteo no leido.
- REQ-GD-016: El sistema debe permitir crear notificaciones; solo roles privilegiados pueden direccionarlas a otros usuarios.
- REQ-GD-017: El sistema debe permitir consultar el resumen operacional disponible en `dashboard` para roles autorizados.
- REQ-GD-018: El sistema debe permitir autorizar Gmail, validar si la autorizacion existe, enviar correos y revocar el acceso.
- REQ-GD-019: El sistema debe permitir firmar un documento con hash, sello institucional y QR de verificacion.
- REQ-GD-020: El sistema debe permitir verificar publicamente un documento firmado mediante token de verificacion.

## 8. Requerimientos no funcionales
- Todo acceso autenticado debe pasar por validacion JWT y control de rol aplicable.
- Los eventos criticos deben dejar evidencia en `auditoria.logs` o en el log tecnico propio del modulo.
- La renovacion de sesion no debe operar sobre refresh tokens ya invalidados o sin sesion activa.
- Los documentos y archivos deben respetar restricciones de tipo, tamano y permisos del flujo que los consuma.
- La verificacion publica de firma debe estar protegida por rate limit y control de dependencias SQL.
- Las notificaciones a terceros deben quedar restringidas a roles privilegiados.
- El uso de Gmail debe depender de autorizacion valida del usuario y responder con error controlado cuando falte dicha autorizacion.

## 9. Conclusion
Los requerimientos de usuario del Area 01 se justifican por la necesidad institucional de mantener autenticacion confiable, seguridad observable, trazabilidad transversal, preparacion documental de auditoria, decisiones soportadas, custodia de documentos y adjuntos, notificaciones operativas, visibilidad ejecutiva del dominio y firma documental verificable.
