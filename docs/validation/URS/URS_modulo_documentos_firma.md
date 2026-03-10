# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Documentos, Archivos y Firma Digital

## Descripcion general del modulo
Gestiona la evidencia documental de procesos internos: creacion de documentos desde plantilla, carga de adjuntos por solicitud y firma digital avanzada con verificacion publica.

## Objetivo del modulo
Garantizar integridad, trazabilidad y disponibilidad de documentos usados en procesos internos y auditorias.

## Actores del sistema
- Tecnico.
- Comercial.
- Gerencia.
- Administrador.
- Usuario externo de verificacion (token publico).

## Alcance funcional
- Creacion de documentos en Drive a partir de plantilla.
- Insercion de firma por tag y firma avanzada.
- Exportacion de documento firmado a PDF.
- Carga, listado, descarga y eliminacion de adjuntos por solicitud.
- Verificacion publica de autenticidad por token/QR.
- Consulta de audit trail y metricas de firma.

## Listado de requerimientos del usuario
### REQ-DOC-001
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir crear documentos desde plantillas para solicitudes.
- Resultado esperado: El documento queda asociado a la solicitud origen.

### REQ-DOC-002
- Actor: Usuario autorizado.
- Requerimiento: El sistema debe permitir firmar digitalmente documentos y exportarlos a PDF.
- Resultado esperado: El documento firmado queda bloqueado y con evidencia de firma.

### REQ-DOC-003
- Actor: Usuario operativo autenticado.
- Requerimiento: El sistema debe permitir cargar, listar y descargar adjuntos por solicitud.
- Resultado esperado: Los adjuntos quedan trazables y accesibles segun permiso.

### REQ-DOC-004
- Actor: Usuario autorizado.
- Requerimiento: El sistema debe permitir eliminar adjuntos cuando la politica de rol lo permita.
- Resultado esperado: El adjunto se elimina sin romper consistencia de metadatos.

### REQ-DOC-005
- Actor: Usuario externo de verificacion.
- Requerimiento: El sistema debe permitir validar autenticidad de un documento por token/QR.
- Resultado esperado: Se retorna estado de verificacion y metadatos de integridad.

## Listado de requerimientos no funcionales
### RNF-DOC-001 Seguridad
Endpoints privados deben exigir JWT y control por rol.

### RNF-DOC-002 Integridad criptografica
La firma avanzada debe respaldarse en hash/sello/QR verificable.

### RNF-DOC-003 Trazabilidad
El sistema debe conservar audit trail de firmas y eventos documentales.

### RNF-DOC-004 Disponibilidad
La integracion con Drive debe manejar errores sin dejar registros inconsistentes.

### RNF-DOC-005 Manejo de errores
Operaciones de firma/exportacion/verificacion deben responder codigos coherentes.

### RNF-DOC-006 Proteccion de evidencia
La eliminacion de archivos debe restringirse a roles autorizados.

## Reglas de negocio identificadas
- Un documento puede localizarse por `id` local o identificador Drive.
- Firmas avanzadas deben registrar metadatos de consentimiento y rol.
- El endpoint de verificacion publica no requiere login, pero depende de token valido.
- Adjuntos se relacionan a `request_id` y su ciclo depende del workflow de negocio.

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Servicio Tecnico y Mantenimientos.
- Talento Humano y Gestion de Personal.
- Notificaciones y Comunicaciones.
