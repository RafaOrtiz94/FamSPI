# CONTEXT.md — applicants

## 1. Descripción
Módulo de gestión de postulantes/candidatos. Ruta pública montada en `/api/applicants` (sin `/v1/`). Permite listar candidatos, ver detalle e importar desde sistemas externos vía API Key. No requiere JWT para lectura.

## 2. Endpoints

Prefijo: `/api/applicants` (montado en mountPublicRoutes — sin autenticación JWT global)

- **GET /api/applicants/** — `listApplicants` — sin autenticación
- **GET /api/applicants/:id** — `getApplicantById` — sin autenticación
- **POST /api/applicants/import** — `importApplicant` — `applicantsApiKey` middleware + rate limit (10 req/min)

## 3. Flujo principal

1. Sistema externo (ATS/portal de empleo) envía candidatos via `POST /import` con API Key
2. Plataforma almacena el perfil del candidato
3. TH consulta candidatos desde `GET /applicants/`
4. Se vincula un candidato a una solicitud de personal via `personnel-requests`

## 4. Validaciones
- `applicantsApiKey`: middleware de API Key para importación (no JWT)
- `rate limit`: 10 req/min en `/import` para prevenir abusos
- Body limit: 5MB para importación masiva
- Sin autenticación en GET — acceso público

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `personnel-requests`: candidatos se vinculan a solicitudes de personal para contratación
- ATS externo: sistema origen de candidatos

## 7. Frontend asociado
- No verificado en frontend (gestión vía `CollaboratorCommandCenter` probable)

## 8. Riesgos detectados
- GET endpoints públicos sin autenticación — cualquier persona puede listar candidatos
- `applicants.service.js` (44KB) — grande para la API expuesta

## 9. Notas técnicas
- Prefijo sin `/v1/` — inconsistente con el resto del sistema
- `applicantsApiKey` middleware: autenticación por API Key para integración externa
