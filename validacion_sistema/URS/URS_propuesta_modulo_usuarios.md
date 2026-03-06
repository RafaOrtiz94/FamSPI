# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Usuarios

## 1. Introduccion
Este documento define la propuesta de requerimientos del modulo de Usuarios del Sistema de Procesos Internos SPI, derivada de analisis de controladores, rutas, servicios y componentes frontend actuales.

## 2. Objetivo del modulo
Administrar el ciclo de vida de usuarios internos, su informacion de perfil, preferencias y certificaciones, garantizando trazabilidad y controles de acceso por autenticacion y rol.

## 3. Alcance funcional
- CRUD de usuarios internos.
- Gestion del perfil propio del usuario (`metadata`, `preferences`, avatar).
- Gestion de certificaciones profesionales (individual y carga masiva).
- Consulta y exportacion PDF de certificaciones.
- Eliminacion de usuario con limpieza referencial de datos asociados.

## 4. Actores del sistema
- Usuario autenticado (gestion de su perfil y certificaciones propias).
- Talento Humano.
- ACP Comercial.
- Gerencia.
- Equipo TI/Administracion tecnica.

## 5. Descripcion general del modulo
El modulo combina tres subcomponentes de negocio: `users`, `user-profile` y `user-certifications`. Permite administrar cuentas internas, mantener informacion extendida del colaborador y gestionar evidencia de certificaciones con soporte de Google Drive. El modulo incorpora auditoria funcional, validaciones de archivo y controles de autorizacion por rol para consulta de informacion sensible.

## 6. Funcionalidades identificadas
- Listado de usuarios con datos de departamento (`GET /api/v1/users`).
- Consulta de usuario por ID (`GET /api/v1/users/:id`).
- Creacion, actualizacion y eliminacion de usuarios (`POST/PUT/DELETE /api/v1/users`).
- Eliminacion de usuario con limpieza en cascada de referencias operativas y documentales.
- Consulta de perfil propio (`GET /api/v1/users/me/profile`).
- Creacion/actualizacion de perfil propio con avatar (`POST/PUT /api/v1/users/me/profile`).
- [Funcionalidad detectada en el sistema] Sincronizacion bidireccional parcial entre `user_profile` y `collaborator_profiles`.
- Creacion de certificacion individual con archivo opcional.
- Carga masiva de certificaciones con multiples archivos.
- Consulta de certificaciones propias y de terceros autorizados.
- Eliminacion logica (soft delete) de certificaciones.
- Generacion de PDF consolidado de certificaciones por usuario.

## 7. Requerimientos funcionales de alto nivel
- REQ-USU-001: El sistema debe permitir listar usuarios internos con sus datos principales y departamento asociado para gestion administrativa.
- REQ-USU-002: El sistema debe permitir crear cuentas de usuario internas con rol y departamento cuando el area autorizada lo requiera.
- REQ-USU-003: El sistema debe permitir actualizar datos de usuario (rol, departamento, identidad basica) manteniendo historial de cambios.
- REQ-USU-004: El sistema debe permitir eliminar usuarios aplicando limpieza de relaciones para preservar integridad referencial.
- REQ-USU-005: El sistema debe permitir al usuario consultar su perfil consolidado de identidad y configuracion personal.
- REQ-USU-006: El sistema debe permitir al usuario actualizar su perfil (`metadata`, `preferences`) y cargar avatar institucional.
- REQ-USU-007: [Funcionalidad detectada en el sistema] El sistema debe sincronizar campos de perfil compartidos con el expediente de colaborador para evitar divergencias entre modulos.
- REQ-USU-008: El sistema debe permitir registrar certificaciones profesionales individuales con datos estructurados y archivo de respaldo.
- REQ-USU-009: El sistema debe permitir carga masiva de certificaciones, devolviendo resultado por item (exitos/fallos).
- REQ-USU-010: El sistema debe permitir consultar certificaciones propias y restringir certificaciones de terceros segun rol autorizado.
- REQ-USU-011: El sistema debe permitir eliminar certificaciones mediante desactivacion logica (`is_active = false`).
- REQ-USU-012: El sistema debe permitir generar y descargar un PDF consolidado de certificaciones para revision de areas autorizadas.
- REQ-USU-013: El sistema debe registrar eventos de auditoria para operaciones de perfil y certificaciones.

## 8. Requerimientos no funcionales
- RNF-USU-001: Todas las rutas del modulo deben requerir usuario autenticado por token valido.
- RNF-USU-002: La gestion de archivos debe validar tipo MIME permitido y tamano maximo configurado (avatar/certificaciones).
- RNF-USU-003: El modulo debe almacenar archivos en Google Drive cuando exista configuracion y degradar de forma controlada cuando no exista.
- RNF-USU-004: Las operaciones de eliminacion de usuario deben ejecutarse en transaccion para evitar inconsistencias.
- RNF-USU-005: La consulta de certificaciones de terceros debe aplicar autorizacion por rol y registrar acceso en auditoria.
- RNF-USU-006: El sistema debe responder errores de validacion con mensajes tecnicos consumibles por frontend.
- RNF-USU-007: Los cambios de perfil y certificaciones deben registrar trazabilidad de datos previos/nuevos.
- RNF-USU-008: La exportacion PDF debe ser deterministicamente reproducible para revision documental.

## 9. Reglas de negocio
- RN-USU-001: El titulo de certificacion es obligatorio y no puede exceder longitud maxima definida.
- RN-USU-002: El tipo de credencial debe pertenecer a catalogo permitido (`certification`, `course`, `diploma`, `title`, `other`).
- RN-USU-003: Solo el propietario o roles autorizados pueden eliminar certificaciones de un usuario.
- RN-USU-004: La eliminacion de certificaciones es logica; no debe borrar historico fisico.
- RN-USU-005: El perfil no debe aceptar en `metadata` campos bloqueados de identidad critica (ej. `email`, `google_id`).
- RN-USU-006: El avatar debe ser imagen valida (PNG/JPEG/WEBP) y respetar limites de carga.
- RN-USU-007: La eliminacion de usuario debe limpiar referencias en solicitudes, adjuntos, firmas y movimientos para conservar integridad.
- RN-USU-008: [Funcionalidad detectada en el sistema] El perfil de colaborador y el perfil de usuario comparten campos sincronizados de manera automatica.

## 10. Dependencias con otros modulos
- Modulo Autenticacion (contexto de usuario y token).
- Modulo Departamentos (catalogo organizacional).
- Modulo Colaboradores (`collaborator_profiles`).
- Modulo Solicitudes e Inventario (referencias que se limpian al eliminar usuario).
- Modulo Auditoria.
- Integracion externa Google Drive y generacion PDF.
