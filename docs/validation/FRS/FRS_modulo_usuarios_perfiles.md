# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Usuarios y Perfiles

## Descripcion funcional
Administra el ciclo de vida de colaboradores internos, perfiles personales y certificaciones profesionales (individuales y masivas), incluyendo evidencia documental y exportacion consolidada.

## Logica funcional observada
- CRUD de usuarios.
- Actualizacion de rol/departamento.
- Eliminacion con limpieza de dependencias transaccionales.
- Perfil del usuario autenticado (metadata, preferencias, avatar).
- Gestion de certificaciones (alta, consulta, baja logica, bulk upload, PDF consolidado).

## Especificaciones funcionales
### FRS-USR-001
**Descripcion:** CRUD de usuarios.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-USR-002
**Descripcion:** Actualizacion de rol/departamento.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-USR-003
**Descripcion:** Eliminacion con limpieza de dependencias transaccionales.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-USR-004
**Descripcion:** Perfil del usuario autenticado (metadata, preferencias, avatar).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-USR-005
**Descripcion:** Gestion de certificaciones (alta, consulta, baja logica, bulk upload, PDF consolidado).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Usuarios
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `POST /api/v1/users`
- `PUT /api/v1/users/:id`
- `DELETE /api/v1/users/:id`

### Perfil
- `GET /api/v1/users/me/profile`
- `POST /api/v1/users/me/profile`
- `PUT /api/v1/users/me/profile`

### Certificaciones
- `POST /api/v1/users/me/certifications`
- `POST /api/v1/users/me/certifications/bulk`
- `GET /api/v1/users/me/certifications`
- `GET /api/v1/users/:id/certifications`
- `DELETE /api/v1/users/me/certifications/:certId`
- `GET /api/v1/users/:id/certifications/pdf`

## Validaciones y controles funcionales
### Control de acceso
- `verifyToken` en todas las rutas.
- `requireRole` solo en endpoints de certificaciones de terceros.

### Autenticacion
- Basada en JWT y contexto de usuario autenticado.

### Autorizacion
- Reglas de ownership en perfil y certificaciones propias.
- Restriccion de consulta de certificaciones de terceros por rol.

### Registro de auditoria
- `logAction` en creacion/actualizacion de perfil y certificaciones.

### Proteccion de datos
- Validacion MIME/tamano en avatar y certificados.
- Upload a Drive con control de carpeta por usuario.

## Dependencias funcionales
- Autenticacion (identidad y token).
- Talento Humano/Colaboradores (sincronizacion de perfil).
- Solicitudes e Inventario (referencias FK de usuario).
- Auditoria (registro de eventos de perfil/certificaciones).

## Observaciones
- CRUD de `users` carece de `requireRole` explicito: riesgo de escalamiento de privilegios por usuarios autenticados.
- Eliminacion de usuario puede generar perdida historica si no se resguarda trazabilidad previa.
- Fallas Drive degradan evidencia documental (certificaciones/avatar).
