# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Usuarios y Perfiles

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

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

## Modelo de datos asociado
- `users`
- `departments`
- `user_profile`
- `user_certifications`
- `collaborator_profiles`
- `collaborator_documents`
- Tablas impactadas por limpieza al borrar usuario:
- `requests`, `request_attachments`, `request_versions`, `request_approvals`, `request_status_history`, `document_signatures`, `inventory_movements`

## Interfaces API
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

## Dependencias tecnicas
- Autenticacion (identidad y token).
- Talento Humano/Colaboradores (sincronizacion de perfil).
- Solicitudes e Inventario (referencias FK de usuario).
- Auditoria (registro de eventos de perfil/certificaciones).

## Controles de seguridad y operacion
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

## Riesgos tecnicos detectados
- CRUD de `users` carece de `requireRole` explicito: riesgo de escalamiento de privilegios por usuarios autenticados.
- Eliminacion de usuario puede generar perdida historica si no se resguarda trazabilidad previa.
- Fallas Drive degradan evidencia documental (certificaciones/avatar).

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API USR]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
