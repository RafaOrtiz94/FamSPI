# IQ - VALIDACION DE INSTALACION

## 1. Introduccion
La calificacion de instalacion del Area 02 verifica que los componentes tecnicos necesarios para operar el dominio de personas, talento y control laboral se encuentren montados, disponibles y conectados con sus dependencias principales.

## 2. Objetivo
Confirmar que rutas, modulos, tablas, jobs y consumidores frontend del area estan presentes y alineados con la arquitectura declarada.

## 3. Componentes a verificar
- Modulos backend montados en `registerRoutes.js`
- Frontend de talento, perfil, asistencia y solicitudes
- Componentes del workspace de solicitudes de personal para progreso, comentarios, checklist y revision
- Persistencia de usuarios, perfiles, asistencia, permisos y vacaciones
- Jobs programados del area
- Integraciones de soporte documental y PDF

## 4. Verificaciones de instalacion
| ID | Elemento | Verificacion |
|---|---|---|
| IQ-PT-001 | `registerRoutes.js` | Confirmar montaje de `talento-humano`, `personnel-requests`, `users`, `collaborators`, `departments`, `attendance`, `permisos`, `vacaciones`, `user-profile`, `user-certifications` |
| IQ-PT-002 | Frontend | Confirmar rutas del dashboard de talento, permisos, asistencia reportes, workspaces de personal y colaborador |
| IQ-PT-003 | Base de datos | Confirmar presencia de tablas nucleares del area |
| IQ-PT-004 | Jobs | Confirmar existencia de `attendanceOvertimeScheduler.js` y `permisosRecoveryCoordinationExpiryScheduler.js` |
| IQ-PT-005 | Reportes | Confirmar capacidad de generacion PDF para asistencia y certificaciones |
| IQ-PT-006 | Consulta administrativa de asistencia | Confirmar que el rango admite filtro por estado derivado y respeta el alcance por rol |

## 5. Prerrequisitos de base de datos
- `users`
- `departments`
- `employees`
- `collaborator_profiles`
- `collaborator_documents`
- `user_profile`
- `user_certifications`
- `personnel_requests`
- `personnel_request_history`
- `personnel_request_comments`
- `personnel_request_profiles`
- `personnel_request_documents`
- `user_attendance_records`
- `attendance_exceptions`
- `attendance_overtime`
- `permisos_vacaciones`
- `permisos_vacaciones_firmas`
- `permisos_estudios_matriculas`
- `vacaciones_solicitudes`
- `vacaciones_saldos_historicos`

## 6. Dependencias tecnicas
- middleware `verifyToken`
- middleware `requireRole`
- helper de autorizacion de reportes de asistencia para lectura propia y de terceros autorizados
- helper de derivacion de estado de asistencia para distinguir consulta administrativa y PDF oficial
- almacenamiento temporal para cargas multipart
- utilitarios de Drive y generacion de PDF
- utilidad compartida de sincronizacion entre `user-profile` y `collaborators`
- componentes del workspace de personal para progreso, comentarios, checklist, revision y reasignacion operativa
- trazabilidad de auditoria donde el modulo la invoque

## 7. Consideraciones de instalacion vigentes
- El submodulo `talento_humano` dispone de rutas relativas alineadas a su montaje bajo `/api/v1/talento-humano`.
- La asistencia dispone de un contrato doble: consulta administrativa por rango y estado derivado, y reporte oficial RH-09 por usuario especifico.
- El workspace de solicitudes de personal debe quedar instalado con sus componentes de progreso, comentarios, checklist, revision y reasignacion para que la experiencia de seguimiento sea completa.
- El area convive con dos modelos de almacenamiento para vacaciones y tiempo libre (`vacaciones_solicitudes` y `permisos_vacaciones`), por lo que la instalacion debe verificar la presencia de ambas estructuras y su lectura consistente por los servicios del dominio.

## 8. Criterio de aceptacion IQ
La IQ del area se considera satisfactoria cuando los componentes declarados estan montados, las rutas son alcanzables segun configuracion, las tablas requeridas existen y las dependencias documentales o de reporte no presentan ausencia estructural bloqueante.

## 9. Conclusion
La IQ del Area 02 se centra en asegurar que el dominio de talento y control laboral cuente con los cimientos tecnicos necesarios antes de validar comportamiento u operacion real.
