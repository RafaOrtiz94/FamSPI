# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Area: Gobierno, Seguridad y Cumplimiento

## 1. Introduccion
Este documento define la propuesta URS del area de Gobierno, Seguridad y Cumplimiento del Sistema de Procesos Internos (SPI), obtenida por ingenieria inversa de los modulos implementados.

## 2. Objetivo del area
Establecer los requerimientos de alto nivel para controlar autenticacion, autorizacion, auditoria, aprobaciones y firma digital/electronica en todos los procesos internos.

## 3. Alcance funcional
- Gestion del ciclo de autenticacion y sesiones.
- Administracion de politicas de seguridad y roles.
- Registro de eventos de auditoria y preparacion de evidencia.
- Ejecucion de flujos de aprobacion multinivel.
- Firma y formalizacion de documentos/procesos.

## 4. Actores del sistema
- Usuario interno autenticado.
- Lider de area y gerencia.
- Equipo de TI y seguridad.
- Auditor interno/externo.

## 5. Descripcion general del area
El area centraliza los controles transversales de acceso, cumplimiento y trazabilidad. Su comportamiento integra rutas API, controladores y servicios de seguridad, con dependencia de datos de usuarios y soporte de notificaciones/archivos.

## 6. Funcionalidades identificadas
- Inicio, renovacion y cierre de sesion.
- Consulta de identidad activa y sesiones vigentes.
- Aplicacion de controles por rol/permiso.
- Registro de eventos criticos para auditoria.
- Gestion de aprobaciones de solicitudes y transacciones internas.
- Gestion de firmas para cierre formal de procesos.
- [Funcionalidad detectada en el sistema] Preparacion y consolidacion de evidencia para revisiones de control.

## 7. Requerimientos funcionales de alto nivel
- REQ-GSC-001: El sistema debe autenticar usuarios internos antes de permitir acceso a modulos de negocio.
- REQ-GSC-002: El sistema debe controlar sesiones activas, renovacion de token y cierre de sesion seguro.
- REQ-GSC-003: El sistema debe autorizar operaciones segun rol, perfil y permiso configurado.
- REQ-GSC-004: El sistema debe registrar eventos de seguridad y auditoria con usuario, fecha, accion y contexto.
- REQ-GSC-005: El sistema debe soportar flujos de aprobacion para procesos que requieran control jerarquico.
- REQ-GSC-006: El sistema debe gestionar firma/aprobacion final de documentos o hitos del proceso.
- REQ-GSC-007: El sistema debe permitir consultar trazabilidad de decisiones y cambios para fines de control interno.
- REQ-GSC-008: El sistema debe bloquear o rechazar operaciones sin autorizacion valida.

## 8. Requerimientos no funcionales
- RNF-GSC-001: Debe existir cifrado de credenciales y datos sensibles en transito y almacenamiento.
- RNF-GSC-002: El registro de auditoria debe ser integro, trazable y resistente a alteraciones no autorizadas.
- RNF-GSC-003: Los errores de autenticacion/autorizacion deben responderse de forma estandarizada y segura.
- RNF-GSC-004: El area debe mantener alta disponibilidad para no bloquear operaciones de otros modulos.
- RNF-GSC-005: Debe existir segregacion de funciones para operaciones administrativas de seguridad.
- RNF-GSC-006: Debe mantenerse evidencia suficiente para cumplimiento regulatorio y auditorias.

## 9. Reglas de negocio
- RN-GSC-001: Ningun actor puede ejecutar operaciones sensibles sin sesion valida.
- RN-GSC-002: Toda accion critica debe dejar rastro de auditoria.
- RN-GSC-003: Una aprobacion solo es valida si el actor posee rol habilitado para ese nivel.
- RN-GSC-004: La firma de un proceso requiere estado previo de aprobacion conforme.

## 10. Dependencias con otras areas
- Talento Humano: provee datos maestros de usuarios, estructura y jerarquias.
- Plataforma TI e Integraciones: provee notificaciones, documentos, archivos e integraciones externas.
- Comercial, Operaciones y Finanzas: consumen controles de acceso, aprobacion y auditoria de forma transversal.

## 11. Modulos y URS fuente de la propuesta
- [URS_propuesta_modulo_auth.md](../URS_propuesta_modulo_auth.md)
- [URS_propuesta_modulo_security.md](../URS_propuesta_modulo_security.md)
- [URS_propuesta_modulo_auditoria.md](../URS_propuesta_modulo_auditoria.md)
- [URS_propuesta_modulo_audit_prep.md](../URS_propuesta_modulo_audit_prep.md)
- [URS_propuesta_modulo_approvals.md](../URS_propuesta_modulo_approvals.md)
- [URS_propuesta_modulo_management.md](../URS_propuesta_modulo_management.md)
- [URS_propuesta_modulo_signature.md](../URS_propuesta_modulo_signature.md)

## 12. Prioridad de validacion del area
- Criticidad: CRITICO
- Prioridad sugerida: 1
