# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Servicio Tecnico y Mantenimientos

## Descripcion funcional
Coordina procesos tecnicos internos: capacitaciones, disponibilidad de tecnicos, actividades, mantenimientos, aplicaciones tecnicas y generacion de documentos operativos de soporte en campo.

## Logica funcional observada
- Gestion de cronograma de capacitaciones tecnicas.
- Gestion de disponibilidad y actividades del equipo tecnico.
- Gestion de equipos y mantenimientos anuales.
- Registro y seguimiento de mantenimientos con firmas.
- Generacion de PDFs operativos (desinfeccion, entrenamiento, verificacion).
- Publicacion de documentos de workflow tecnico.
- Aprobaciones tecnicas de solicitudes y acceso a aplicaciones tecnicas.

## Especificaciones funcionales
### FRS-STM-001
**Descripcion:** Gestion de cronograma de capacitaciones tecnicas.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-STM-002
**Descripcion:** Gestion de disponibilidad y actividades del equipo tecnico.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-STM-003
**Descripcion:** Gestion de equipos y mantenimientos anuales.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-STM-004
**Descripcion:** Registro y seguimiento de mantenimientos con firmas.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-STM-005
**Descripcion:** Generacion de PDFs operativos (desinfeccion, entrenamiento, verificacion).

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-STM-006
**Descripcion:** Publicacion de documentos de workflow tecnico.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-STM-007
**Descripcion:** Aprobaciones tecnicas de solicitudes y acceso a aplicaciones tecnicas.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Servicio tecnico
- `GET /api/v1/servicio/capacitaciones`
- `POST /api/v1/servicio/capacitaciones`
- `PUT /api/v1/servicio/capacitaciones/:id`
- `DELETE /api/v1/servicio/capacitaciones/:id`
- `GET /api/v1/servicio/disponibilidad`
- `POST /api/v1/servicio/disponibilidad`
- `GET /api/v1/servicio/actividades`
- `POST /api/v1/servicio/actividades`
- `GET /api/v1/servicio/equipos`
- `POST /api/v1/servicio/equipos`
- `GET /api/v1/servicio/mantenimientos`
- `GET /api/v1/servicio/mantenimientos-anuales`
- `POST /api/v1/servicio/mantenimientos-anuales`
- `POST /api/v1/servicio/desinfeccion/pdf`
- `POST /api/v1/servicio/entrenamiento/pdf`
- `POST /api/v1/servicio/entrenamiento/asistencia/pdf`
- `POST /api/v1/servicio/entrenamiento/verificacion/pdf`
- `GET /api/v1/servicio/workflow-documents`
- `GET /api/v1/servicio/workflow-documents/summary`

### Mantenimientos
- `POST /api/v1/mantenimientos`
- `GET /api/v1/mantenimientos`
- `GET /api/v1/mantenimientos/:id`
- `POST /api/v1/mantenimientos/:id/sign`
- `POST /api/v1/mantenimientos/:id/sign-advanced`
- `POST /api/v1/mantenimientos/:id/approve`
- `POST /api/v1/mantenimientos/:id/export`

### Aplicaciones tecnicas y aprobaciones
- `GET /api/v1/technical-applications/available`
- `GET /api/v1/approvals/pending`
- `POST /api/v1/approvals/:id/approve`
- `POST /api/v1/approvals/:id/reject`

## Validaciones y controles funcionales
### Control de acceso
- JWT obligatorio y `requireRole` en rutas tecnicas criticas.
- Restriccion por perfiles tecnicos, jefaturas y gerencia.

### Autenticacion
- Todas las operaciones requieren usuario autenticado.

### Autorizacion
- Segmentacion de acciones por rol (tecnico, jefe_tecnico, jefe_servicio_tecnico, gerencia).
- Aprobaciones tecnicas separadas en modulo `approvals`.

### Registro de auditoria
- Registros de workflow tecnico y estados de mantenimiento.
- Historial de firma/aprobacion en mantenimiento.

### Proteccion de datos
- Cargas controladas con `multer`.
- Documentos y evidencias enviados a Drive con identificadores de trazabilidad.

## Dependencias funcionales
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.

## Observaciones
- Multiplicidad de roles puede generar configuracion inconsistente de autorizacion.
- Uso de almacenamiento temporal (`/tmp`) para archivos en algunos flujos.
- Dependencia de Drive y correo para evidencia y recordatorios.
- Acoplamiento entre mantenimiento y tabla `documents` puede impactar trazabilidad documental.
