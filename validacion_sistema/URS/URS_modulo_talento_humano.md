# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Talento Humano y Gestion de Personal

## Descripcion general del modulo
El modulo administra procesos de personal interno: permisos, vacaciones, asistencia, solicitudes de personal, colaboradores y estructura departamental.

## Objetivo del modulo
Garantizar control operativo del ciclo de vida del personal y cumplimiento de politicas internas de aprobacion, asistencia y evidencia documental.

## Actores del sistema
- Talento Humano.
- Jefaturas de area.
- Gerencia / Gerencia General.
- Colaboradores.
- Administrador.

## Alcance funcional
- Gestionar solicitudes de permisos/vacaciones y sus aprobaciones.
- Gestionar matrículas de estudios y validaciones.
- Gestionar solicitudes de personal y proceso de contratacion.
- Gestionar perfiles/documentos de colaboradores.
- Gestionar departamentos organizacionales.
- Registrar asistencia diaria, excepciones y horas extra.

## Listado de requerimientos del usuario
### REQ-TH-001
- Actor: Talento Humano.
- Requerimiento: El sistema debe permitir administrar informacion de colaboradores y perfiles de personal.
- Resultado esperado: Los perfiles quedan actualizados con trazabilidad.

### REQ-TH-002
- Actor: Colaborador y aprobadores.
- Requerimiento: El sistema debe permitir crear y resolver solicitudes de permisos/vacaciones por flujo jerarquico.
- Resultado esperado: La solicitud avanza por estados validos hasta cierre.

### REQ-TH-003
- Actor: Talento Humano / Gerencia.
- Requerimiento: El sistema debe permitir gestionar solicitudes de personal, incluyendo perfil, documentos y contratacion.
- Resultado esperado: El expediente de vacante queda completo y consistente.

### REQ-TH-004
- Actor: Colaborador autenticado.
- Requerimiento: El sistema debe permitir registrar marcaciones de asistencia, excepciones y overtime.
- Resultado esperado: Los registros quedan consolidados para reporte y control.

### REQ-TH-005
- Actor: Talento Humano.
- Requerimiento: El sistema debe permitir administrar departamentos organizacionales.
- Resultado esperado: La estructura departamental se mantiene vigente para otros modulos.

### REQ-TH-006
- Actor: Sistema.
- Requerimiento: El sistema debe emitir links de verificacion legal para firmas de permisos/vacaciones.
- Resultado esperado: Las validaciones legales quedan verificables por token.

## Listado de requerimientos no funcionales
### RNF-TH-001 Seguridad
Todas las operaciones privadas deben requerir JWT.

### RNF-TH-002 Autorizacion
El sistema debe aplicar matriz de rol (talento_humano, jefaturas, gerencia, admin) por accion.

### RNF-TH-003 Integridad documental
Cargas de expediente deben validar formato y asociacion correcta a solicitud/colaborador.

### RNF-TH-004 Integridad transaccional
Contratacion y vinculaciones de solicitud de personal deben ejecutarse en transaccion.

### RNF-TH-005 Trazabilidad
Cambios de estado y aprobaciones deben quedar registrados con actor y timestamp.

### RNF-TH-006 Manejo de errores
Errores de flujo (aprobador invalido, estado invalido, token no valido) deben responderse de forma controlada.

### RNF-TH-007 Cumplimiento interno
El modulo debe conservar evidencia suficiente para auditoria interna de personal.

## Reglas de negocio identificadas
- Permisos/vacaciones usan estados secuenciales con aprobacion parcial/final.
- Cancelaciones requieren flujo de revision.
- Solicitudes de personal solo pueden cerrarse por rutas de contratacion autorizadas.
- Comentarios/expedientes internos dependen del rol actor.
- Las marcaciones de asistencia deben mantener orden logico de jornada.

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.
