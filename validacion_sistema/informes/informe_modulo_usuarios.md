# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Gestion de Usuarios

## Descripcion del modulo
Administra el ciclo de vida de colaboradores internos, perfiles personales y certificaciones profesionales (individuales y masivas), incluyendo evidencia documental y exportacion consolidada.

## Alcance funcional
- CRUD de usuarios.
- Actualizacion de rol/departamento.
- Eliminacion con limpieza de dependencias transaccionales.
- Perfil del usuario autenticado (metadata, preferencias, avatar).
- Gestion de certificaciones (alta, consulta, baja logica, bulk upload, PDF consolidado).

## Componentes del sistema
### Controladores
- `backend/src/modules/users/users.controller.js`
- `backend/src/modules/user-profile/userProfile.controller.js`
- `backend/src/modules/user-certifications/userCertifications.controller.js`

### Servicios
- `backend/src/modules/user-profile/userProfile.service.js`
- `backend/src/modules/user-certifications/userCertifications.service.js`
- Integraciones: `utils/drive.js`, `utils/audit.js`

### Modelos
- Sin ORM; consultas SQL directas en controladores/servicios.

### Rutas
- `backend/src/modules/users/users.routes.js`
- `backend/src/modules/user-profile/userProfile.routes.js`
- `backend/src/modules/user-certifications/userCertifications.routes.js`

### Componentes de interfaz
- `spi_front/src/modules/talento/pages/Usuarios.jsx`
- `spi_front/src/modules/profile/MyProfilePage.jsx`
- `spi_front/src/modules/profile/components/CertificationsBoard.jsx`
- `spi_front/src/core/api/usersApi.js`
- `spi_front/src/core/api/userProfileApi.js`
- `spi_front/src/core/api/userCertificationsApi.js`

## Endpoints de API
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

## Tablas de base de datos asociadas
- `users`
- `departments`
- `user_profile`
- `user_certifications`
- `collaborator_profiles`
- `collaborator_documents`
- Tablas impactadas por limpieza al borrar usuario:
- `requests`, `request_attachments`, `request_versions`, `request_approvals`, `request_status_history`, `document_signatures`, `inventory_movements`

## Dependencias con otros modulos
- Autenticacion (identidad y token).
- Talento Humano/Colaboradores (sincronizacion de perfil).
- Solicitudes e Inventario (referencias FK de usuario).
- Auditoria (registro de eventos de perfil/certificaciones).

## Controles de seguridad
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

## Riesgos operativos
- CRUD de `users` carece de `requireRole` explicito: riesgo de escalamiento de privilegios por usuarios autenticados.
- Eliminacion de usuario puede generar perdida historica si no se resguarda trazabilidad previa.
- Fallas Drive degradan evidencia documental (certificaciones/avatar).

## Posibles escenarios de falla
- Actualizacion de rol por actor no autorizado (si no existe control de rol estricto a nivel gateway).
- Carga masiva de certificaciones con metadata inconsistente.
- Inconsistencia entre `user_profile` y `collaborator_profiles`.

## Nivel de criticidad
CRITICO

## Prioridad de validacion
MUY ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-USR-001`: Gestionar usuarios activos/inactivos y sus roles.
- `URS-USR-002`: Mantener perfil personal actualizado con imagen y preferencias.
- `URS-USR-003`: Registrar certificaciones con soporte documental.
- `URS-USR-004`: Permitir consulta de certificaciones por Talento Humano/Gerencia.
- `URS-USR-005`: Eliminar usuarios sin romper integridad referencial.

## Requerimientos funcionales
- `RF-USR-001`: Exponer CRUD de usuarios autenticados.
- `RF-USR-002`: Persistir perfil en `user_profile` y sincronizar con `collaborator_profiles`.
- `RF-USR-003`: Validar tipos y tamano de archivo en avatar/certificaciones.
- `RF-USR-004`: Implementar baja logica de certificaciones.
- `RF-USR-005`: Generar PDF consolidado de certificaciones por usuario.

## Resumen del diseño tecnico
- Capa SQL directa en Node.js.
- Archivos en memoria (`multer`) con subida a Drive.
- Frontend React con formularios de perfil/certificaciones.
- Limpieza transaccional en eliminacion de usuario (`BEGIN/COMMIT/ROLLBACK`).

## Escenarios de prueba
### Funcionalidad
- Caso: Alta de certificacion individual con archivo PDF.
- Resultado esperado: Registro en `user_certifications` y URL de evidencia.

### Seguridad
- Caso: Usuario sin rol autorizado consulta certificaciones de tercero.
- Resultado esperado: `403 Forbidden`.

### Manejo de errores
- Caso: Avatar > 2MB.
- Resultado esperado: `400` con mensaje de tamano excedido.

### Integridad de datos
- Caso: Eliminar usuario con historial transaccional.
- Resultado esperado: limpieza controlada sin violaciones FK y con resumen de operaciones.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-USR-001 Administrar usuarios | `users.controller` | CRUD completo con validacion de permisos |
| REQ-USR-002 Perfil personal | `userProfile.service.updateProfile` | Actualizar metadata/preferencias/avatar |
| REQ-USR-003 Certificaciones con soporte | `userCertifications.service.createCertification` | Crear certificacion con archivo y verificar Drive |
| REQ-USR-004 Consulta de terceros por rol | `userCertifications.routes` + `requireRole` | Acceso con rol permitido y rol denegado |
| REQ-USR-005 Eliminacion segura | `users.controller.deleteUser` | Borrado transaccional y verificacion de consistencia |
