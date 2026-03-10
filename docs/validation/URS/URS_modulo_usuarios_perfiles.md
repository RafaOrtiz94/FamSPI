# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Usuarios y Perfiles

## Descripcion general del modulo
Administra el ciclo de vida de colaboradores internos, perfiles personales y certificaciones profesionales (individuales y masivas), incluyendo evidencia documental y exportacion consolidada.

## Objetivo del modulo
Centralizar la administracion de identidades internas y sus credenciales profesionales, manteniendo consistencia operativa con los demas modulos del sistema.

## Actores del sistema
- Usuario autenticado.
- Talento Humano.
- Gerencia.
- ACP Comercial.
- Administrador/TI (segun contexto operativo).

## Alcance funcional
- CRUD de usuarios.
- Actualizacion de rol/departamento.
- Eliminacion con limpieza de dependencias transaccionales.
- Perfil del usuario autenticado (metadata, preferencias, avatar).
- Gestion de certificaciones (alta, consulta, baja logica, bulk upload, PDF consolidado).

## Listado de requerimientos del usuario
### REQ-USR-001
- Actor: Talento Humano / Administrador.
- Requerimiento: El sistema debe permitir crear usuarios internos manualmente.
- Resultado esperado: El usuario queda registrado en `users` con datos y rol inicial definido.

### REQ-USR-002
- Actor: Talento Humano / Administrador.
- Requerimiento: El sistema debe permitir consultar listado general de usuarios.
- Resultado esperado: Se presenta lista ordenada con informacion de departamento y estado de datos.

### REQ-USR-003
- Actor: Talento Humano / Administrador.
- Requerimiento: El sistema debe permitir consultar el detalle de un usuario por identificador.
- Resultado esperado: Se devuelve el registro completo del usuario solicitado.

### REQ-USR-004
- Actor: Talento Humano / Administrador.
- Requerimiento: El sistema debe permitir actualizar rol, departamento y datos basicos de usuario.
- Resultado esperado: Los cambios se persisten y se reflejan en los modulos dependientes.

### REQ-USR-005
- Actor: Talento Humano / Administrador.
- Requerimiento: El sistema debe permitir eliminar usuarios con limpieza controlada de dependencias transaccionales.
- Resultado esperado: El usuario se elimina sin violar integridad referencial.

### REQ-USR-006
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir consultar su perfil personal.
- Resultado esperado: El sistema retorna identidad y perfil consolidado.

### REQ-USR-007
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir crear o actualizar su perfil personal con metadata y preferencias.
- Resultado esperado: Los datos quedan persistidos y disponibles para sesiones futuras.

### REQ-USR-008
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir cargar avatar de perfil.
- Resultado esperado: La imagen valida se almacena y queda asociada al perfil del usuario.

### REQ-USR-009
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir registrar certificaciones con archivo de respaldo opcional.
- Resultado esperado: Cada certificacion queda vinculada al usuario y con evidencia documental cuando aplique.

### REQ-USR-010
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir carga masiva de certificaciones.
- Resultado esperado: El sistema procesa multiples registros y reporta exitos/fallos por item.

### REQ-USR-011
- Actor: Usuario autenticado / roles autorizados.
- Requerimiento: El sistema debe permitir consultar certificaciones propias y de terceros segun autorizacion.
- Resultado esperado: Se retorna solo informacion permitida por rol y ownership.

### REQ-USR-012
- Actor: Usuario autenticado / roles autorizados.
- Requerimiento: El sistema debe permitir eliminar certificaciones por baja logica.
- Resultado esperado: La certificacion deja de estar activa sin perdida de trazabilidad historica.

### REQ-USR-013
- Actor: Talento Humano / Gerencia / ACP Comercial.
- Requerimiento: El sistema debe permitir generar PDF consolidado de certificaciones por usuario.
- Resultado esperado: Se descarga un documento con resumen estructurado de credenciales activas.

## Listado de requerimientos no funcionales
### RNF-USR-001 Seguridad de acceso
Todas las rutas del modulo deben requerir usuario autenticado mediante JWT.

### RNF-USR-002 Control de autorizacion
La consulta de certificaciones de terceros y su PDF debe limitarse a roles autorizados.

### RNF-USR-003 Validacion de archivos
El sistema debe validar tipo MIME y tamano maximo para avatar y documentos de certificacion.

### RNF-USR-004 Integridad transaccional
La eliminacion de usuario debe ejecutarse en transaccion con `BEGIN/COMMIT/ROLLBACK`.

### RNF-USR-005 Auditoria
El sistema debe registrar eventos de perfil y certificaciones en el modulo de auditoria.

### RNF-USR-006 Consistencia de datos
La informacion de perfil debe sincronizar campos relevantes con `collaborator_profiles`.

### RNF-USR-007 Manejo de errores
Los endpoints deben responder mensajes controlados ante validaciones fallidas y errores internos.

### RNF-USR-008 Rendimiento operativo
Las consultas de usuarios y certificaciones deben soportar consumo frecuente de UI sin bloqueos.

## Reglas de negocio identificadas
- El perfil propio se administra por `user_id` autenticado y no por identificador arbitrario.
- Las certificaciones aceptan tipos controlados (`certification`, `course`, `diploma`, `title`, `other`).
- La baja de certificaciones es logica (`is_active = false`), no fisica.
- Solo roles autorizados pueden consultar certificaciones de terceros y exportarlas a PDF.
- Se bloquean claves sensibles de identidad en metadata para evitar sobreescritura indebida.
- La eliminacion de usuario exige limpieza previa de referencias en solicitudes, firmas y movimientos.

## Dependencias con otros modulos
- Autenticacion (identidad y token).
- Talento Humano/Colaboradores (sincronizacion de perfil).
- Solicitudes e Inventario (referencias FK de usuario).
- Auditoria (registro de eventos de perfil/certificaciones).
