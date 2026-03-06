# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Area: Talento Humano

## 1. Introduccion
Este documento consolida la propuesta URS del area de Talento Humano del SPI, basada en funcionalidades activas observadas en los modulos de personas, asistencia y solicitudes laborales.

## 2. Objetivo del area
Definir requerimientos de alto nivel para administrar ciclo de vida de colaboradores, estructura organizacional y procesos de gestion humana.

## 3. Alcance funcional
- Gestion de usuarios, perfiles y certificaciones.
- Gestion de colaboradores y departamentos.
- Control de asistencia y jornada.
- Gestion de permisos, vacaciones y solicitudes de personal.
- Gestion de postulantes para procesos internos.

## 4. Actores del sistema
- Colaborador.
- Jefe de area.
- Analista de Talento Humano.
- Gerencia y TI para controles administrativos.

## 5. Descripcion general del area
El area soporta procesos de administracion de personal y estructura interna, con flujos de solicitud/aprobacion y trazabilidad sobre cambios de estado relacionados con personas.

## 6. Funcionalidades identificadas
- Registro y actualizacion de usuarios y colaboradores.
- Administracion de perfiles, datos complementarios y certificaciones.
- Registro de asistencia y consulta de historial.
- Creacion y gestion de permisos y vacaciones.
- Gestion de solicitudes de requerimiento de personal.
- Registro y evaluacion de postulantes.
- Definicion de departamentos y relacion jerarquica.
- [Funcionalidad detectada en el sistema] Enlace de datos de talento humano con flujos de aprobacion y auditoria.

## 7. Requerimientos funcionales de alto nivel
- REQ-TH-001: El sistema debe permitir crear y mantener datos de colaboradores y usuarios internos.
- REQ-TH-002: El sistema debe permitir asignar colaboradores a departamentos y estructuras organizativas.
- REQ-TH-003: El sistema debe registrar asistencia y permitir su consulta por periodos.
- REQ-TH-004: El sistema debe gestionar solicitudes de permisos y vacaciones con estados y aprobaciones.
- REQ-TH-005: El sistema debe administrar certificaciones y atributos de perfil laboral.
- REQ-TH-006: El sistema debe permitir registrar y dar seguimiento a solicitudes de personal.
- REQ-TH-007: El sistema debe permitir gestionar postulantes y su avance en el proceso.
- REQ-TH-008: El sistema debe exponer informacion de talento humano a modulos dependientes de forma controlada.

## 8. Requerimientos no funcionales
- RNF-TH-001: Debe protegerse la confidencialidad de datos personales y laborales.
- RNF-TH-002: Debe existir integridad referencial entre usuarios, perfiles, departamentos y solicitudes.
- RNF-TH-003: Toda modificacion relevante debe quedar registrada para auditoria.
- RNF-TH-004: Debe aplicarse control de acceso por rol para operaciones de gestion humana.
- RNF-TH-005: El sistema debe manejar errores de validacion con mensajes consistentes y accionables.
- RNF-TH-006: Debe mantenerse rendimiento adecuado en consultas masivas de personal y asistencia.

## 9. Reglas de negocio
- RN-TH-001: Un colaborador debe pertenecer a una estructura organizativa valida.
- RN-TH-002: No se deben aprobar permisos/vacaciones fuera de politicas y cupos definidos.
- RN-TH-003: Las solicitudes de personal deben seguir estados de proceso con responsable asignado.
- RN-TH-004: Las certificaciones deben mantenerse asociadas al colaborador correspondiente.

## 10. Dependencias con otras areas
- Gobierno, Seguridad y Cumplimiento: control de acceso, aprobaciones y trazabilidad.
- Comercial y Operaciones: consumen datos de personal para asignacion de responsables.
- Plataforma TI e Integraciones: soporte de notificaciones, archivos y comunicaciones.
- Finanzas: consume datos de personal para procesos economicos relacionados.

## 11. Modulos y URS fuente de la propuesta
- [URS_propuesta_modulo_talento_humano.md](../URS_propuesta_modulo_talento_humano.md)
- [URS_propuesta_modulo_users.md](../URS_propuesta_modulo_users.md)
- [URS_propuesta_modulo_user_profile.md](../URS_propuesta_modulo_user_profile.md)
- [URS_propuesta_modulo_user_certifications.md](../URS_propuesta_modulo_user_certifications.md)
- [URS_propuesta_modulo_collaborators.md](../URS_propuesta_modulo_collaborators.md)
- [URS_propuesta_modulo_attendance.md](../URS_propuesta_modulo_attendance.md)
- [URS_propuesta_modulo_vacaciones.md](../URS_propuesta_modulo_vacaciones.md)
- [URS_propuesta_modulo_permisos.md](../URS_propuesta_modulo_permisos.md)
- [URS_propuesta_modulo_personnel_requests.md](../URS_propuesta_modulo_personnel_requests.md)
- [URS_propuesta_modulo_applicants.md](../URS_propuesta_modulo_applicants.md)
- [URS_propuesta_modulo_departments.md](../URS_propuesta_modulo_departments.md)

## 12. Prioridad de validacion del area
- Criticidad: ALTO
- Prioridad sugerida: 2
