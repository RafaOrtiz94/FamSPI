# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Clientes

## 1. Introduccion
Este documento define la propuesta de requerimientos del modulo de Clientes del Sistema de Procesos Internos SPI, construido por ingenieria inversa de rutas, controladores, servicios y consumo frontend.

## 2. Objetivo del modulo
Gestionar clientes aprobados para operacion comercial interna: consulta, asignacion de responsables, actualizacion controlada de datos y registro de visitas (clientes y prospectos).

## 3. Alcance funcional
- Listado de clientes accesibles por rol y asignacion.
- Consulta detallada de cliente con asignaciones y adjuntos.
- Actualizacion de informacion de cliente aprobado.
- Asignacion permanente/temporal de cliente a asesor comercial.
- Registro de estado de visita con datos operativos y georreferenciacion.
- Registro de visitas a prospectos.

## 4. Actores del sistema
- Comercial.
- ACP Comercial.
- Backoffice Comercial.
- Jefe Comercial.
- Gerencia.
- TI (soporte y supervision).

## 5. Descripcion general del modulo
El modulo opera sobre `client_requests` en estado aprobado y agrega capacidades operativas mediante asignaciones (`client_assignments`) y bitacoras de visita (`client_visit_logs`, `prospect_visits`). Integra informacion de planificacion mensual y expone resumen diario de ejecucion comercial.

## 6. Funcionalidades identificadas
- Listado de clientes aprobados con filtros de busqueda y fecha (`GET /api/v1/clients`).
- Inclusión opcional de metadatos de cronograma y filtro por agenda aprobada.
- Consulta de detalle de cliente (`GET /api/v1/clients/:id`).
- Actualizacion de datos de cliente con control de campos por perfil (`PUT /api/v1/clients/:id`).
- Carga de documentos de respaldo de cliente (RUC, identificacion, nombramiento, etc.).
- Asignacion de cliente a asesor comercial (`POST /api/v1/clients/:id/assign`).
- Registro/actualizacion de estado de visita del cliente (`POST /api/v1/clients/:id/visit-status`).
- Registro/actualizacion de visitas a prospectos (`POST /api/v1/clients/prospect-visit`).
- [Funcionalidad detectada en el sistema] Inicializacion automatica de infraestructura SQL (`ensureTables`) al ejecutar servicios del modulo.

## 7. Requerimientos funcionales de alto nivel
- REQ-CLI-001: El sistema debe permitir listar clientes aprobados visibles para el usuario segun su rol y sus asignaciones activas.
- REQ-CLI-002: El sistema debe permitir consultar informacion detallada de un cliente incluyendo responsables asignados y metadatos operativos.
- REQ-CLI-003: El sistema debe permitir filtrar clientes por busqueda, fecha de visita y parametros de planificacion comercial.
- REQ-CLI-004: El sistema debe permitir actualizar informacion de cliente aprobado y registrar cambios documentales cuando corresponda.
- REQ-CLI-005: El sistema debe restringir los campos editables segun privilegio del actor (edicion limitada vs edicion completa).
- REQ-CLI-006: El sistema debe permitir asignar clientes a asesores comerciales, incluyendo asignaciones temporales con vigencia.
- REQ-CLI-007: El sistema debe permitir registrar inicio/cierre de visita con estado, horarios, coordenadas y observaciones.
- REQ-CLI-008: El sistema debe calcular y almacenar la duracion de visita cuando existan hora de entrada y salida validas.
- REQ-CLI-009: El sistema debe permitir registrar visitas de prospectos con trazabilidad de check-in/check-out.
- REQ-CLI-010: El sistema debe incluir en la respuesta operativa resumen diario de visitas (total, visitados, pendientes).
- REQ-CLI-011: [Funcionalidad detectada en el sistema] El sistema debe crear/ajustar estructuras auxiliares de asignacion y visitas cuando no existan en la base de datos.

## 8. Requerimientos no funcionales
- RNF-CLI-001: El acceso al modulo debe requerir autenticacion y autorizacion por rol para operaciones criticas.
- RNF-CLI-002: La consulta masiva de clientes debe limitar volumen de salida para preservar rendimiento operacional.
- RNF-CLI-003: Las operaciones de carga documental deben soportar multipart y registrar identificadores de archivo en Drive.
- RNF-CLI-004: El modulo debe preservar integridad por restricciones de unicidad en asignaciones y bitacoras de visita.
- RNF-CLI-005: Las operaciones de asignacion deben validar existencia y estado activo del usuario asignado.
- RNF-CLI-006: El modulo debe responder con codigos de error consistentes para casos de acceso denegado, datos invalidos o cliente no encontrado.
- RNF-CLI-007: El modulo debe mantener trazabilidad por auditoria transversal de cambios (middleware global).
- RNF-CLI-008: Las consultas con informacion de agenda deben ser consistentes con cronogramas comerciales aprobados.

## 9. Reglas de negocio
- RN-CLI-001: Solo clientes con estado `approved` pueden gestionarse en este modulo.
- RN-CLI-002: Usuarios no gerenciales solo pueden ver clientes creados por ellos o asignados activamente.
- RN-CLI-003: Las asignaciones temporales requieren fecha fin valida y posterior a la fecha inicio.
- RN-CLI-004: Solo usuarios comerciales activos y con rol permitido pueden recibir asignaciones.
- RN-CLI-005: Los estados de visita permitidos son `visited`, `pending`, `skipped` e `in_visit`.
- RN-CLI-006: Si existe `hora_salida`, el estado final de visita debe resolverse como `visited`.
- RN-CLI-007: En actualizacion de cliente, los perfiles con privilegio limitado solo pueden modificar campos operativos acotados.
- RN-CLI-008: [Funcionalidad detectada en el sistema] El sistema inserta asignacion inicial automatica del propietario comercial para clientes aprobados.

## 10. Dependencias con otros modulos
- Modulo Solicitudes (tabla base `client_requests`).
- Modulo Usuarios (resolucion de asesores y datos de rol).
- Modulo Cronogramas Comerciales (`schedules`).
- Modulo Autenticacion/Autorizacion.
- Integracion externa Google Drive para archivos documentales.
- Modulo Viaticos (consumo posterior de `client_visit_logs`).
