# FRS - AREA 02 PERSONAS, TALENTO Y CONTROL LABORAL

## 1. Introduccion
La presente especificacion funcional describe el comportamiento verificable del Area 02 del sistema SPI. Cada funcion incluida en este documento se apoya en rutas realmente montadas, componentes frontend consumidores y consultas o persistencias presentes en el codigo vigente. El objetivo es traducir el dominio de personas y control laboral a funciones observables y comprobables.

## 2. Objetivo
Definir de manera funcional las capacidades del area para `talento_humano`, `personnel-requests`, `users`, `collaborators`, `departments`, `user-profile`, `user-certifications`, `attendance`, `permisos` y `vacaciones`, indicando por que existe cada funcion, como debe responder el sistema y cuando debe ejecutarse.

## 3. Alcance funcional
El alcance funcional comprende administracion de personal y estructura, perfil del colaborador, certificaciones, solicitudes de personal, control diario de asistencia, excepciones y horas extra, permisos con coordinacion de recuperacion y solicitudes de vacaciones con resumen de saldo.

## 4. Requerimientos funcionales detallados
### FR-PT-001 Gestion de usuarios y departamentos
- Endpoints: `GET/POST/PUT/DELETE /api/v1/users*`, `GET/POST/PUT/DELETE /api/v1/departments*`.
- Proposito: permitir administracion de usuarios y estructura organizacional.
- Como opera: lista usuarios con alcance diferenciado entre directorio y vista administrativa, permite filtrar por texto, rol, departamento y estado activo, valida que el departamento destino siga activo y usa baja logica para desactivar usuarios sin perder trazabilidad. En departamentos, permite alta, edicion, desactivacion y reactivacion controlada.
- Cuando aplica: mantenimiento administrativo del personal, control de estructura interna y saneamiento de usuarios o departamentos sin destruccion del historico.

### FR-PT-002 Modulo HR legacy de empleados
- Endpoint base montado: `/api/v1/talento-humano`.
- Rutas internas definidas en el modulo: `POST/GET /employees`, `PUT /employees/:id`, `POST /documents/:id`.
- Proposito: mantener registro basico de empleados y documentos.
- Cuando aplica: gestion basica legacy desde talento humano cuando aun existe operacion heredada no absorbida por `collaborators`.

### FR-PT-003 Workspace de colaboradores
- Endpoints: `GET /api/v1/collaborators/stats`, `GET /api/v1/collaborators`, `GET/PUT /api/v1/collaborators/:id/profile`, `POST /api/v1/collaborators/:id/documents`.
- Proposito: consolidar perfil, checklist de onboarding y documentos del colaborador.
- Como opera: mezcla datos de `users`, `departments`, `collaborator_profiles`, `user_profile` y documentos asociados; ademas calcula completitud, revision anual pendiente y alertas de certificaciones vencidas o por vencer. El workspace separa las acciones de expandir, bloquear y guardar seccion para evitar ambiguedades de clic y mantener accesibilidad en desktop y movil.
- Cuando aplica: revision, actualizacion y seguimiento del colaborador activo.

### FR-PT-004 Perfil propio del usuario
- Endpoints: `GET/POST/PUT /api/v1/users/me/profile`.
- Proposito: mantener metadata personal, preferencias y avatar del usuario autenticado.
- Como opera: crea o actualiza `user_profile` y sincroniza un conjunto unico de claves compartidas con `collaborator_profiles` mediante una utilidad comun de sincronizacion. La revision anual solo puede cerrarse cuando los campos criticos de contacto personal, domicilio y emergencia estan completos; la pantalla expone solo preferencias con efecto real en la aplicacion.
- Cuando aplica: revision anual de datos, cambios personales o ajuste de preferencias.

### FR-PT-005 Certificaciones del usuario
- Endpoints: `POST /api/v1/users/me/certifications`, `POST /api/v1/users/me/certifications/bulk`, `GET /api/v1/users/me/certifications`, `DELETE /api/v1/users/me/certifications/:certId`, `GET /api/v1/users/:id/certifications`, `GET /api/v1/users/:id/certifications/pdf`.
- Proposito: registrar y consultar competencias con soporte documental.
- Como opera: crea registros activos, permite baja logica y genera un PDF consolidado para roles autorizados como `acp_comercial`, `talento_humano`, `gerencia` y `gerencia_general`. Las acciones de ver y eliminar permanecen visibles en interfaces tactiles y los formularios de vigencia se adaptan a una sola columna en pantallas pequenas.
- Cuando aplica: gestion de vigencias, soporte de habilitaciones y auditoria interna de certificaciones.

### FR-PT-006 Solicitudes de personal
- Endpoints: `POST /api/v1/personnel-requests`, `GET /api/v1/personnel-requests`, `GET /api/v1/personnel-requests/stats`, `GET /api/v1/personnel-requests/:id`.
- Proposito: abrir requerimientos de personal y seguir su ciclo de aprobacion.
- Como opera: registra solicitud, historial, comentarios, perfil esperado, documentos y responsables. La navegacion del hub respeta la vista inicial solicitada para `solicitudes`, `usuarios`, `departamentos` y `colaboradores`, evitando desviar al usuario a una pantalla no esperada.
- Cuando aplica: cuando un area necesita cubrir una necesidad de talento.

### FR-PT-007 Perfil y documentos de la solicitud de personal
- Endpoints: `GET/PUT /api/v1/personnel-requests/:id/profile`, `POST /api/v1/personnel-requests/:id/documents`, `POST /api/v1/personnel-requests/:id/comments`.
- Proposito: completar el expediente del proceso de incorporacion.
- Como opera: persiste perfil especifico de la solicitud, registra archivos y comentarios asociados.
- Cuando aplica: durante evaluacion, seleccion y preparacion de incorporacion.

### FR-PT-008 Vinculacion y contratacion en solicitud de personal
- Endpoints: `PATCH /api/v1/personnel-requests/:id/collaborator`, `PATCH /api/v1/personnel-requests/:id/applicant`, `PATCH /api/v1/personnel-requests/:id/status`, `POST /api/v1/personnel-requests/:id/hire`.
- Proposito: asociar candidato o colaborador y cerrar la solicitud mediante contratacion.
- Como opera: actualiza la solicitud, migra o replica informacion documental y crea o actualiza relacion con colaborador.
- Cuando aplica: en la fase de seleccion, aprobacion y cierre del requerimiento.

### FR-PT-008A Validacion de avance por bloque en la creacion de la solicitud
- Interfaz consumidora: `PersonnelRequestForm.jsx`.
- Proposito: impedir que el usuario avance a un paso posterior si el bloque actual no tiene los datos obligatorios completos.
- Como opera: valida el paso actual antes de permitir avanzar; en el primer bloque verifica titulo, tipo de contratacion, cantidad y justificacion; en los pasos siguientes verifica el conjunto de campos obligatorios definidos por cada seccion.
- Cuando aplica: durante la captura inicial de la necesidad de personal.

### FR-PT-008B Formalizacion del estado y transiciones de la solicitud
- Interfaz consumidora: `PersonnelWorkspace.jsx`, `PersonnelHeader.jsx`, `PersonnelRequestProgress.jsx`, `PersonnelRequestReview.jsx`.
- Proposito: representar el ciclo de vida de la solicitud como una secuencia de estados verificables.
- Como opera: la solicitud pasa por `pendiente`, `en_revision`, `aprobada`, `en_proceso` y `completada`, con estados terminales `rechazada` y `cancelada`.
- Cuando aplica: durante revision, aprobacion, cierre y consulta historica del requerimiento.

### FR-PT-008C Tiempos por etapa y deteccion de estancamiento
- Interfaz consumidora: `PersonnelRequestProgress.jsx`, `PersonnelHeader.jsx`, `RequestList.jsx`.
- Proposito: mostrar cuanto tiempo lleva la solicitud en la etapa actual y alertar cuando excede el limite operativo previsto.
- Como opera: calcula tiempo transcurrido, fecha limite y bandera de estancamiento a partir de la fecha de inicio de etapa y de la configuracion de cada estado.
- Cuando aplica: en la vista principal del workspace, en listados y en el detalle de aprobacion.

### FR-PT-008D Responsable actual y reasignacion operacional
- Interfaz consumidora: `PersonnelWorkspace.jsx`.
- Proposito: reflejar el responsable vigente de la etapa y permitir su reasignacion cuando el rol lo autoriza.
- Como opera: expone el responsable actual en la cabecera y habilita un selector para vincular un colaborador operativo a la solicitud. En movil, el workspace incorpora un selector visible de contexto para navegar entre solicitudes, postulantes y colaboradores sin depender de un sidebar oculto.
- Cuando aplica: cuando talento humano o gerencia deben cambiar el operador que atiende una solicitud activa.

### FR-PT-008E Comentarios internos trazables
- Interfaz consumidora: `PersonnelRequestComments.jsx`, `PersonnelWorkspace.jsx`.
- Proposito: dejar constancia textual de decisiones, observaciones y notas operativas asociadas al expediente.
- Como opera: registra comentario con usuario, fecha y marca de visibilidad interna; la marca interna solo aplica para roles autorizados y los comentarios se listan en orden cronologico dentro del workspace.
- Cuando aplica: durante revisiones, observaciones, reasignaciones y seguimiento de la solicitud.

### FR-PT-008F Progreso de contratacion y checklist
- Interfaz consumidora: `PersonnelChecklist.jsx`, `PersonnelDocuments.jsx`, `PersonnelRequestReview.jsx`, `PersonnelWorkspace.jsx`.
- Proposito: mostrar de forma visible la completitud de datos, validaciones y documentos previos al cierre de contratacion.
- Como opera: calcula porcentaje de avance de checklist, progreso documental y habilita la accion de contratacion solo cuando el expediente esta completo.
- Cuando aplica: cuando la solicitud ya fue aprobada y se prepara el cierre operativo o la contratacion.

### FR-PT-009 Asistencia diaria
- Endpoints: `POST /api/v1/attendance/clock-in`, `POST /api/v1/attendance/clock-out-lunch`, `POST /api/v1/attendance/clock-in-lunch`, `POST /api/v1/attendance/clock-out`, `GET /api/v1/attendance/today`.
- Proposito: registrar la jornada ordinaria del colaborador.
- Como opera: usa `user_attendance_records` por fecha de negocio, calcula tiempos y expone estado del dia.
- Cuando aplica: al inicio, pausa de almuerzo, retorno y cierre de jornada.

### FR-PT-010 Excepciones, ubicacion y horas extra
- Endpoints: `POST /api/v1/attendance/location-sync`, `POST /api/v1/attendance/exception`, `POST /api/v1/attendance/exception/status`, `GET /api/v1/attendance/exception/active`, `POST/GET /api/v1/attendance/overtime`.
- Proposito: controlar salidas inesperadas y overtime.
- Como opera: registra excepciones activas, sincroniza ubicacion posterior y guarda overtime manual o calculado.
- Cuando aplica: cuando la jornada se desvia del flujo normal o requiere regularizacion.

### FR-PT-011 Consultas y reportes de asistencia
- Endpoints: `GET /api/v1/attendance/user/:userId`, `GET /api/v1/attendance/range?status=...`, `GET /api/v1/attendance/pdf/:userId`.
- Proposito: consultar historico, exponer el estado derivado de la jornada y emitir PDF oficial RH-09.
- Como opera: filtra por rango, valida si la consulta corresponde al usuario propio o a un tercero autorizado, agrega `attendance_status` y `attendance_status_label`, separa la consulta administrativa del reporte oficial y exige usuario especifico para el PDF RH-09.
- Cuando aplica: control interno, revision de talento, control financiero autorizado y respaldo administrativo formal.

### FR-PT-011A Consulta administrativa de asistencia por estado
- Endpoint: `GET /api/v1/attendance/range?status=...`.
- Proposito: permitir consulta administrativa por usuario, rango y estado sin alterar el flujo oficial del PDF.
- Como opera: filtra registros derivados por estado de jornada, expone resumen agregando totales por estado y admite alcance global solo para roles de reporte autorizados.
- Cuando aplica: cuando talento humano, gerencia o finanzas autorizadas necesitan revisar jornadas abiertas, almuerzos abiertos o cierres incompletos.

### FR-PT-012 Permisos
- Endpoint base: `POST /api/v1/permisos`, `GET /api/v1/permisos/mis-solicitudes`, `GET /api/v1/permisos/pendientes`, `GET /api/v1/permisos/resumen-colaboradores`.
- Proposito: gestionar permisos por estudios, salud, calamidad o motivo personal.
- Como opera: persiste en `permisos_vacaciones`, resuelve etapa de aprobacion y construye visibilidad personal o consolidada.
- Cuando aplica: cuando el colaborador requiere ausentarse o talento necesita control del estado de solicitudes.

### FR-PT-013 Matriculas, justificantes y firma legal de permisos
- Endpoints: `POST /api/v1/permisos/estudios/matricula`, `GET /api/v1/permisos/estudios/matricula/activa`, `GET /api/v1/permisos/estudios/matriculas`, `GET /api/v1/permisos/estudios/matriculas/pendientes`, `POST /api/v1/permisos/estudios/matriculas/:id/revisar`, `POST /api/v1/permisos/:id/justificantes`, `GET /api/v1/permisos/legal-coverage`, `GET /api/v1/permisos/legal-verification/:token`.
- Proposito: habilitar permisos por estudios y soportar evidencia juridica de permisos firmados.
- Cuando aplica: antes del permiso por estudios, durante carga de justificantes o durante validacion publica de firma.

### FR-PT-014 Aprobacion, cancelacion y coordinacion de recuperacion
- Endpoints: `POST /api/v1/permisos/:id/aprobar-parcial`, `POST /api/v1/permisos/:id/aprobar-final`, `POST /api/v1/permisos/:id/rechazar`, `POST /api/v1/permisos/:id/cancelar`, `POST /api/v1/permisos/:id/cancelar/revisar`, `POST /api/v1/permisos/:id/recovery-plan`.
- Proposito: cerrar el ciclo de aprobacion y, cuando corresponda, coordinar recuperacion o cargar a vacaciones.
- Como opera: cambia estados, exige justificantes en ciertos tipos y registra coordinacion o cierre unilateral por vencimiento.
- Cuando aplica: cuando la solicitud llega a decision del jefe, cancelacion o compensacion laboral.

### FR-PT-015 Vacaciones
- Endpoints: `POST /api/v1/vacaciones`, `GET /api/v1/vacaciones`, `PATCH /api/v1/vacaciones/:id/status`, `POST /api/v1/vacaciones/:id/cancel`, `POST /api/v1/vacaciones/:id/cancel/review`, `GET /api/v1/vacaciones/summary/data`, `GET /api/v1/vacaciones/legal-verification/:token`.
- Proposito: administrar vacaciones y su saldo.
- Como opera: crea solicitudes, resume allowance y remanente, aprueba, rechaza, cancela y revisa cancelaciones.
- Cuando aplica: durante planificacion de descanso o control de dias disponibles por talento y gerencia.

## 5. Flujos principales
### Flujo A - Solicitud y contratacion de personal
```text
[Jefe de area crea solicitud] -> [Talento revisa expediente]
-> [Se vincula postulante o colaborador]
-> [Se completa perfil y documentos]
-> [Se aprueba estado]
-> [Se ejecuta hire]
-> [Queda colaborador asociado]
```

### Flujo B - Gestion de perfil y certificaciones
```text
[Usuario consulta mi perfil] -> [Actualiza metadata y preferencias]
-> [Carga avatar si aplica]
-> [Registra certificacion]
-> [Consulta vigencia]
-> [Descarga PDF consolidado si el rol lo permite]
```

### Flujo C - Asistencia diaria
```text
[Entrada] -> [Salida a almuerzo]
-> [Entrada de almuerzo]
-> [Salida]
-> [Calculo de horas]
-> [Consulta o reporte PDF]
```

### Flujo D - Excepcion y retorno
```text
[Salida inesperada] -> [Estado ACTIVE]
-> [Estado ON_SITE]
-> [Estado RETURNING]
-> [Estado COMPLETED]
-> [Cierre de excepcion]
```

### Flujo E - Permiso recuperable
```text
[Colaborador solicita permiso] -> [Jefe aprueba parcialmente o final]
-> [Se cargan justificantes si aplica]
-> [Se coordina plan de recuperacion]
-> [Se acepta y cierra]
-> [Si no hay acuerdo al vencimiento, se carga a vacaciones]
```

### Flujo F - Vacaciones
```text
[Colaborador consulta saldo] -> [Crea solicitud]
-> [Jefe revisa]
-> [Aprueba o rechaza]
-> [Si hay cancelacion, se revisa]
-> [Se actualiza resumen de dias y horas]
```

### Flujo G - Solicitud de personal con seguimiento operativo
```text
[Se crea la solicitud]
-> [El sistema valida datos obligatorios por paso]
-> [La solicitud queda en pendiente]
-> [Gerencia revisa o reasigna responsable]
-> [Talento humano valida perfil y documentos]
-> [Se registran comentarios trazables]
-> [Se muestra progreso y tiempo por etapa]
-> [Se completa la contratacion]
```

## 6. Conclusion
La FRS del Area 02 describe un dominio operativo amplio pero coherente: personas, talento y control laboral. Las funciones verificadas demuestran que el area no se limita a administracion de datos, sino que gobierna procesos continuos del colaborador desde su incorporacion hasta su jornada, ausencias y descanso anual.
