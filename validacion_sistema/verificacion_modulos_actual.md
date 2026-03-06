# VERIFICACION MODULO POR MODULO (CODIGO ACTUAL)

## Contexto
- Verificacion ejecutada directamente sobre rutas, controladores y servicios en `backend/src` y consumidores en `spi_front/src`.
- El sistema corresponde a una plataforma de procesos internos, no a un ERP tradicional.

## 1) Autenticacion y Sesiones
- Rutas verificadas: `backend/src/modules/auth/auth.routes.js`
- Controlador verificado: `backend/src/modules/auth/auth.controller.js`
- Hallazgos clave:
- Login Google OAuth2 + JWT (`accessToken`/`refreshToken`).
- Auditoria de sesiones restringida a TI/Gerencia.
- LOPDP interno con evidencia documental.

## 2) Gestion de Usuarios
- Rutas verificadas: `users.routes.js`, `userProfile.routes.js`, `userCertifications.routes.js`
- Controladores verificados: `users.controller.js`, `userProfile.controller.js`, `userCertifications.controller.js`
- Hallazgos clave:
- CRUD de usuarios con `verifyToken` (sin `requireRole` explicito en CRUD base).
- Perfil propio con avatar (MIME y tamano validados).
- Certificaciones con carga individual/masiva y PDF consolidado por roles.

## 3) Comercial y Gestion de Clientes
- Rutas verificadas: `requests.routes.js`, `clients.routes.js`, `equipmentPurchases.routes.js`, `privatePurchases.routes.js`, `schedules.routes.js`
- Controladores verificados: `requests.controller.js`, `clients.controller.js`, `equipmentPurchases.controller.js`, `privatePurchases.controller.js`, `schedules.controller.js`
- Servicios verificados: `requests.service.js`, `clients.service.js`, `equipmentPurchases.service.js`, `privatePurchases.service.js`, `schedules.service.js`
- Hallazgos clave:
- Flujo de nuevo cliente con consentimiento y checklist de calidad.
- Gestion de cartera, asignaciones y visitas comerciales.
- Compras publicas/privadas con workflow multirol.
- Cronogramas mensuales con aprobacion de jefatura/gerencia.

## 4) Business Case Comercial
- Rutas verificadas: `businessCase.routes.js`
- Controladores verificados: `businessCase.controller.js`, `equipmentCatalog.controller.js`, `determinationsCatalog.controller.js`, `calculationTemplates.controller.js`
- Servicios verificados: `businessCase.service.js`, `businessCaseStateMachine.js`, `businessCaseSheetGeneration.service.js`, `investments.service.js`
- Hallazgos clave:
- Flujo unificado tecnico-economico por etapas.
- Lock/unlock de secciones por rol y ownership de datos.
- Generacion asincrona de hojas BC con cola dedicada.
- Endpoints de observabilidad y feature flags para workspace.

## 5) Talento Humano y Gestion de Personal
- Rutas verificadas: `hr.routes.js`, `permisos.routes.js`, `vacaciones.routes.js`, `personnel-requests.routes.js`, `collaborators.routes.js`, `departments.routes.js`, `attendance.routes.js`
- Controladores verificados: `hr.controller.js`, `permisos.controller.js`, `vacaciones.controller.js`, `personnel-requests.controller.js`, `collaborators.controller.js`, `departments.controller.js`, `attendance.controller.js`
- Servicios verificados: `permisos.service.js`, `vacaciones.service.js`, `personnel-requests.service.js`, `collaborators.service.js`, `attendance.service.js`
- Hallazgos clave:
- Matriz completa de permisos/vacaciones con firma legal y cancelaciones.
- Solicitudes de personal con perfil y expediente documental.
- Asistencia con excepciones, horas extra y reporte PDF.
- Rutas `hr` mantienen prefijo redundante (`/api/v1/talento-humano/api/v1/hr/...`).

## 6) Servicio Tecnico y Mantenimientos
- Rutas verificadas: `servicio.routes.js`, `mantenimientos.routes.js`, `technicalApplications.routes.js`, `approvals.routes.js`
- Controladores verificados: `servicio.controller.js`, `mantenimientos.controller.js`, `technicalApplications.controller.js`, `approvals.controller.js`
- Servicios verificados: `mantenimientos.service.js`, `desinfeccion.service.js`, `entrenamiento.service.js`, `verificacion-equipos.service.js`
- Hallazgos clave:
- Cronogramas tecnicos, disponibilidad y actividades multirol.
- Mantenimientos con firmas, aprobacion y exportacion PDF.
- Catalogo de aplicaciones tecnicas activas.
- Evidencias en Drive y documentos de workflow.

## 7) Inventario
- Rutas verificadas: `inventario.routes.js`
- Controlador verificado: `inventario.controller.js`
- Servicio verificado: `inventario.service.js`
- Hallazgos clave:
- Unidades por modelo, serializacion, asignacion y cambio de estado.
- Reglas de unicidad de serial y dominio de estados.
- Trazabilidad en `equipos_historial` + `inventory_movements`.

## 8) Control Financiero Operativo y Viaticos
- Rutas verificadas: `finanzas.routes.js`, `viaticos.routes.js`
- Controladores verificados: `finanzas.controller.js`, `viaticos.controller.js`
- Servicio verificado: `viaticos.service.js`
- Hallazgos clave:
- Movimiento de inventario financiero y reporte CSV.
- Viaticos con estados, soportes y reporte de cotejo.
- Integracion externa Silver + Drive.

## 9) Documentos, Archivos y Firma Digital
- Rutas verificadas: `documents.routes.js`, `files.routes.js`, `signature.routes.js`
- Controladores verificados: `documents.controller.js`, `files.controller.js`, `signature.controller.js`
- Servicios verificados: `document.service.js`, `file.service.js`
- Hallazgos clave:
- Generacion documental desde plantilla y firmado por tag.
- Carga/descarga/eliminacion de adjuntos por solicitud.
- Firma avanzada FamSign con hash, sello institucional, QR y verificacion publica.

## 10) Notificaciones y Comunicaciones
- Rutas verificadas: `notifications.routes.js`, `routes/internalJobs.routes.js` (dispatch)
- Controlador verificado: `notifications.controller.js`
- Servicios verificados: `notifications.service.js`, `notificationManager.js`, `notificationRecipientsConfig.service.js`
- Hallazgos clave:
- Notificaciones in-app con estados de lectura y limpieza.
- Despacho asincrono por cola (email/chat) con reintentos.
- Soporte de thread por proceso en Gmail.
- Notificaciones de seguridad por login fuera de horario.

## 11) TI Soporte y Tickets
- Rutas verificadas: `supportTickets.routes.js`
- Controlador verificado: `supportTickets.controller.js`
- Servicio verificado: `supportTickets.service.js`
- Hallazgos clave:
- Mesa de ayuda con estados controlados y transiciones validadas.
- KPI de workspace (respuesta, ciclo, entrega, vencimientos SLA).
- Comentarios publicos/internos y trazabilidad de eventos.
- Integracion nativa con notificaciones para solicitante y equipo TI.

## 12) Reportes y Auditoria
- Rutas verificadas: `dashboard.routes.js`, `audit.routes.js`, `auditPrep.routes.js`
- Controladores verificados: `dashboard.controller.js`, `audit.controller.js`, `auditPrep.controller.js`
- Servicios verificados: `dashboard.service.js`, `auditoria.service.js`, `auditPrep.service.js`
- Hallazgos clave:
- Dashboard comercial de procesos internos.
- Consulta/exportacion de auditoria.
- Preparacion documental de auditoria con ACL por seccion.
