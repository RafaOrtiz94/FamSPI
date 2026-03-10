# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Autenticacion y Sesiones

## Descripcion general del modulo
Gestiona el acceso al sistema mediante Google OAuth2, emision y renovacion de JWT, cierre de sesion, consulta de usuario autenticado y auditoria de sesiones activas/historicas.

## Objetivo del modulo
Garantizar que solo usuarios autorizados accedan al sistema, con trazabilidad de sesiones y controles de seguridad para accesos sensibles.

## Actores del sistema
- Colaborador interno autenticado.
- Usuario nuevo con rol `pendiente`.
- Personal de TI.
- Gerencia.
- Servicio externo Google OAuth2.
- Servicio de notificaciones de seguridad.

## Alcance funcional
- Inicio de sesion con Google (`/auth/google`, callback OAuth).
- Emision de `accessToken` y `refreshToken`.
- Renovacion de sesion con `x-refresh-token`.
- Cierre de sesiones.
- Registro de aceptacion LOPDP interna con evidencia documental.
- Auditoria de sesiones (`sessions`, `active-users`).
- Deteccion y notificacion de accesos fuera de horario.

## Listado de requerimientos del usuario
### REQ-AUTH-001
- Actor: Colaborador interno.
- Requerimiento: El sistema debe permitir iniciar sesion mediante cuenta Google.
- Resultado esperado: El usuario autenticado es redirigido al dashboard correspondiente a su rol.

### REQ-AUTH-002
- Actor: Sistema.
- Requerimiento: El sistema debe validar que el dominio del correo pertenezca al dominio corporativo configurado.
- Resultado esperado: Usuarios de dominio no permitido no pueden ingresar.

### REQ-AUTH-003
- Actor: Sistema.
- Requerimiento: El sistema debe crear automaticamente un usuario cuando autentica por primera vez.
- Resultado esperado: El usuario queda registrado con rol inicial `pendiente` y datos basicos de identidad.

### REQ-AUTH-004
- Actor: Sistema.
- Requerimiento: El sistema debe actualizar datos del usuario existente cuando vuelve a autenticarse.
- Resultado esperado: Se sincronizan datos de perfil (correo, nombre, google_id, estado LOPDP).

### REQ-AUTH-005
- Actor: Colaborador interno.
- Requerimiento: El sistema debe emitir token de acceso y token de refresco tras un login exitoso.
- Resultado esperado: El frontend recibe ambos tokens y habilita sesion autenticada.

### REQ-AUTH-006
- Actor: Colaborador interno.
- Requerimiento: El sistema debe permitir renovar la sesion sin pedir nuevo login mientras el refresh token sea valido.
- Resultado esperado: Se emiten nuevos tokens y se actualiza el registro de sesion.

### REQ-AUTH-007
- Actor: Colaborador interno.
- Requerimiento: El sistema debe permitir cerrar sesion de forma explicita.
- Resultado esperado: La sesion activa queda cerrada en `user_sessions`.

### REQ-AUTH-008
- Actor: Colaborador interno.
- Requerimiento: El sistema debe permitir consultar su identidad autenticada.
- Resultado esperado: Se retorna perfil de sesion con rol, scope y datos de usuario.

### REQ-AUTH-009
- Actor: Colaborador interno.
- Requerimiento: El sistema debe registrar aceptacion interna LOPDP con firma y documento.
- Resultado esperado: Se persiste evidencia en base de datos y repositorio documental.

### REQ-AUTH-010
- Actor: TI y Gerencia.
- Requerimiento: El sistema debe permitir consultar historial de sesiones y usuarios activos.
- Resultado esperado: Solo usuarios con rol autorizado acceden a auditoria de sesiones.

### REQ-AUTH-011
- Actor: TI.
- Requerimiento: El sistema debe detectar accesos fuera de horario laboral.
- Resultado esperado: Se genera evento de seguridad y se notifica al equipo TI.

### REQ-AUTH-012
- Actor: Sistema.
- Requerimiento: El sistema debe registrar eventos de autenticacion en auditoria.
- Resultado esperado: Queda evidencia trazable de login, refresh, logout y consentimientos.

## Listado de requerimientos no funcionales
### RNF-AUTH-001 Seguridad de tokens
El sistema debe firmar JWT con secretos dedicados para acceso y refresh, incluyendo claims `iss`, `aud` y `sub`.

### RNF-AUTH-002 Tiempo de vigencia
El `accessToken` debe expirar en 8 horas y el `refreshToken` en 7 dias.

### RNF-AUTH-003 Control de acceso
Los endpoints de auditoria de sesiones deben restringirse a roles de TI y Gerencia.

### RNF-AUTH-004 Trazabilidad
El sistema debe almacenar IP, agente de usuario, correlation_id y estado de sesion para auditoria forense.

### RNF-AUTH-005 Integridad de sesion
Ante error en registro de sesion, el sistema debe mantener manejo controlado y registrar advertencia operativa.

### RNF-AUTH-006 Manejo de errores
El sistema debe responder codigos HTTP coherentes para token ausente, token invalido y fallas internas.

### RNF-AUTH-007 Disponibilidad de integraciones
El sistema debe degradar de manera controlada si falla Google OAuth o servicios de notificacion.

### RNF-AUTH-008 Politica horaria
La deteccion fuera de horario debe evaluarse con zona horaria `America/Guayaquil`.

## Reglas de negocio identificadas
- Solo se permite login para usuarios de dominio autorizado (`ALLOWED_DOMAIN`) cuando esta configurado.
- Usuario nuevo se crea con rol `pendiente` y acceso inicial restringido.
- Los roles definen `scope` y `dashboard` de redireccion post-login.
- Refresh token invalido o expirado debe invalidar continuidad de sesion.
- Aceptacion LOPDP requiere trazabilidad del actor y evidencia documental.
- Logins en fines de semana, feriados o fuera de franja laboral deben marcarse como evento de riesgo.

## Dependencias con otros modulos
- Usuarios y Perfiles (datos de identidad y rol).
- Notificaciones (alertas fuera de horario).
- Auditoria (registro de acciones de login/seguridad).
- Documentos (carga de firma/PDF LOPDP en Drive).
