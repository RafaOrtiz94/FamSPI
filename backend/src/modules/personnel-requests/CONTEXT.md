# CONTEXT.md — personnel-requests

## 1. Descripción
Módulo de solicitudes de personal (requerimientos de contratación). Permite a jefes de área crear solicitudes de nuevos empleados, a TH gestionar el proceso de selección, vincular candidatos y colaboradores, y contratar al postulante seleccionado.

## 2. Endpoints

Prefijo: `/api/v1/personnel-requests`

- **POST /** — `createRequest` — verifyToken, requireRole(`jefe_comercial`, `jefe_servicio_tecnico`, `jefe_tecnico`, `jefe_operaciones`, `jefe_finanzas`, `jefe_calidad`, `gerencia`, `admin`, `talento_humano`, `jefe_talento_humano`, `gerencia_general`)
- **GET /** — `getRequests` — verifyToken (sin requireRole — filtrado por rol en service)
- **GET /stats** — `getStats` — verifyToken, requireRole(`talento_humano`, `gerencia`, `admin`)
- **GET /:id/workspace** — `getRequestWorkspace` — requireRole(`talento_humano`, `gerencia`, `gerencia_general`, `admin`)
- **GET /:id/applicants** — `getRequestApplicants` — mismos roles
- **GET /:id** — `getRequestById` — verifyToken (sin requireRole)
- **PATCH /:id/collaborator** — `linkCollaborator` — requireRole(`talento_humano`, `gerencia`, `gerencia_general`, `admin`)
- **PATCH /:id/applicant** — `linkApplicant` — mismos roles
- **PATCH /:id/status** — `updateRequestStatus` — mismos roles
- **POST /:id/hire** — `hireApplicant` — mismos roles
- **GET /:id/profile** — `getPersonnelProfile` — mismos roles
- **PUT /:id/profile** — `updatePersonnelProfile` — mismos roles
- **POST /:id/documents** — `uploadPersonnelDocument` — mismos roles, multer.single('file')
- **POST /:id/comments** — `addComment` — verifyToken (sin requireRole)

## 3. Flujo principal

1. Jefe de área crea solicitud de personal con perfil requerido
2. TH revisa y actualiza el estado de la solicitud
3. TH vincula candidatos del módulo `applicants`
4. Se evalúa el perfil del candidato seleccionado
5. TH contrata al candidato: `POST /:id/hire`
6. Se crea el colaborador en el sistema

## 4. Validaciones
- `personnel-requests.notifications.js` (2KB): notificaciones específicas del módulo
- `personnel-requests.service.js` (72KB) — grande
- `multer.memoryStorage()` para documentos del candidato

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `applicants`: candidatos del ATS se vinculan aquí
- `collaborators`: al contratar, se crea un colaborador
- `talento_humano`: complementa la gestión de RRHH

## 7. Frontend asociado
- No verificado en frontend (probable integración en `CollaboratorCommandCenter`)

## 8. Riesgos detectados
- `GET /` y `GET /:id` sin `requireRole` — acceso a datos de solicitudes sin restricción de rol
- `personnel-requests.service.js` (72KB) — muy grande

## 9. Notas técnicas
- `personnel-requests.notifications.js`: servicio dedicado de notificaciones para este flujo
