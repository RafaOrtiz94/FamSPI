# Módulo Talento Humano — Gestión de Aspirantes

**Audiencia:** Desarrolladores  
**Fecha:** 2026-06-23  
**Alcance:** Flujo completo aspirante → contratación → colaborador

---

## 1. Arquitectura del Módulo

El módulo de Talento Humano está dividido en tres sub-módulos de backend independientes y un módulo frontend unificado.

```
backend/src/modules/
├── applicants/                   ← Registro y gestión de aspirantes
│   ├── applicants.service.js     (~44 KB)
│   ├── applicants.controller.js
│   └── applicants.routes.js
├── personnel-requests/           ← Flujo de solicitudes de contratación
│   ├── personnel-requests.service.js     (~72 KB)
│   ├── personnel-requests.controller.js
│   ├── personnel-requests.routes.js
│   └── personnel-requests.notifications.js
└── talento_humano/               ← Endpoint legacy/general de empleados
    ├── hr.controller.js
    └── hr.routes.js

spi_front/src/modules/talento/
├── pages/
│   ├── CollaboratorCommandCenter.jsx   ← Workspace principal de TH
│   └── Solicitudes.jsx                 ← Vista de solicitudes de personal
├── components/workspace/               ← Componentes del workspace
├── hooks/
│   └── useCommandCenterState.js        ← Estado central del módulo
└── core/api/
    ├── applicantsApi.js
    └── personnelRequestsApi.js
```

---

## 2. Tablas de Base de Datos

### 2.1 Tablas de Aspirantes

| Tabla | Descripción |
|-------|-------------|
| `applicants` | Registro principal. Email como UNIQUE key. Columnas: `id`, `email`, `fullname`, `profile` (JSONB), `status`, `created_at`, `updated_at` |
| `applicant_personal_data` | Datos personales normalizados. Relación 1:1 con `applicants`. Columnas: `nombres`, `apellidos`, `cedula`, `pasaporte`, `fecha_nacimiento`, `genero`, `tipo_sangre`, `estado_civil`, `telefono`, `lugar_residencia` |
| `applicant_licenses` | Licencia de conducción. Relación 1:1. Columnas: `tiene_licencia` (BOOLEAN), `tipo_licencia` |
| `applicant_ethnic_id` | Autoidentificación étnica. Relación 1:1. Columna: `grupo_etnico` |
| `applicant_health` | Información de salud. Relación 1:1. Columnas: `enfermedad_persistente`, `discapacidad`, `porcentaje_discapacidad`, `carnet_discapacidad` |
| `applicant_education` | Historial educativo. Relación 1:N. Columnas: `nivel` (secundaria/tercer_nivel/cuarto_nivel), `institucion`, `titulo` |
| `applicant_trainings` | Capacitaciones y certificados. Relación 1:N. Columnas: `institucion`, `tema`, `horas` |
| `applicant_personal_references` | Referencias personales. Relación 1:N. Columnas: `nombre`, `celular`, `ocupacion`, `tiempo_conocerlo_anios` |
| `applicant_work_experience` | Experiencia laboral. Relación 1:N. Columnas: `empresa`, `tiempo_anios`, `cargo`, `funciones` |
| `applicant_work_references` | Referencias laborales. Relación 1:N. Columnas: `empresa`, `nombre_contacto`, `cargo_contacto` |
| `applicant_documents` | Documentos del expediente. Columnas: `doc_type`, `drive_file_id`, `drive_url`, `content_hash_sha256` |

### 2.2 Tablas de Solicitudes de Personal

| Tabla | Descripción |
|-------|-------------|
| `personnel_requests` | Solicitudes de contratación. Columnas: `id`, `request_number` (SP-YYYY-#####), `requester_id`, `position_title`, `position_type` (permanente/temporal/reemplazo/proyecto), `status`, `applicant_id` (FK → applicants), `collaborator_user_id` (FK → users), `created_at`, `updated_at` |
| `personnel_request_profiles` | Perfil JSONB del aspirante durante el proceso. Relación 1:1 con la solicitud. Columnas: `profile` (JSONB), `qualifications` (JSONB array), `updated_by` |
| `personnel_request_documents` | Documentos del proceso de contratación. Columnas: `doc_type`, `drive_file_id`, `drive_url`, `content_hash_sha256` |
| `personnel_request_comments` | Comentarios internos/externos. Columnas: `user_id`, `comment`, `is_internal` (BOOLEAN) |
| `personnel_request_history` | Trazabilidad de cambios de estado. Columnas: `previous_status`, `new_status`, `changed_by`, `notes`, `metadata` (JSONB) |

### 2.3 Tablas de Colaboradores (destino final del flujo)

| Tabla | Descripción |
|-------|-------------|
| `collaborator_profiles` | Perfil del empleado activo. Relación 1:1 con `users`. Columna principal: `profile` (JSONB) |
| `collaborator_qualifications` | Expediente centralizado de títulos y certificados. Columnas: `qualification_type`, `title`, `institution`, `issuer`, `issue_date`, `expiry_date`, `registration_number`, `drive_file_id`, `is_active` |
| `collaborator_documents` | Documentos del empleado. Columnas: `doc_type`, `drive_file_id`, `drive_url`, `category`, `owner_area`, `source_channel`, `visibility_scope`, `is_active`, `is_required` |

---

## 3. Endpoints de API

### 3.1 Aspirantes — `/api/applicants`

> **Nota:** Esta ruta no tiene prefijo `/v1/` — inconsistencia respecto al resto del API.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/` | **Sin autenticación** | Lista aspirantes con paginación. Query params: `cargo`, `search`, `page`, `pageSize`. Consumido por widget/portal público. |
| `GET` | `/:id` | **Sin autenticación** | Devuelve perfil completo del aspirante por ID. Consumido por portal público. |
| `POST` | `/import` | API Key + Rate limit (10 req/min) | Importa un aspirante desde sistema externo (Google Form via script). Body: perfil normalizado con documentos en base64. |

**Por qué son públicos los GET:** Existe un portal o widget público (bolsa de trabajo / estado de postulación) que los consume sin sesión. No es un bug — es diseño intencional.

### 3.2 Solicitudes de Personal — `/api/v1/personnel-requests`

| Método | Ruta | Roles permitidos | Descripción |
|--------|------|-----------------|-------------|
| `POST` | `/` | jefe_*, gerencia, talento_humano, admin | Crea solicitud de personal |
| `GET` | `/` | verifyToken (filtrado por rol) | Lista solicitudes. Params: `status`, `department_id`, `urgency_level`, `position_type`, `q`, `stalled_only`, `sort_by` |
| `GET` | `/stats` | talento_humano, gerencia, admin | Métricas del dashboard |
| `GET` | `/:id` | verifyToken | Obtiene solicitud por ID |
| `GET` | `/:id/workspace` | talento_humano, gerencia, admin | Datos agregados del workspace (aspirante, documentos, perfil, historial) |
| `GET` | `/:id/applicants` | talento_humano, gerencia, admin | Lista aspirantes vinculados/sugeridos para esta solicitud |
| `GET` | `/:id/profile` | talento_humano, gerencia, admin | Perfil del aspirante en proceso |
| `PATCH` | `/:id/applicant` | talento_humano, gerencia, admin | Vincula un aspirante a la solicitud. Body: `{ applicant_id }` |
| `PATCH` | `/:id/collaborator` | talento_humano, gerencia, admin | Vincula colaborador existente. Body: `{ collaborator_user_id }` |
| `PATCH` | `/:id/status` | talento_humano, gerencia, admin | Cambia estado. Body: `{ status, notes }` |
| `PUT` | `/:id/profile` | talento_humano, gerencia, admin | Crea/actualiza perfil JSONB del aspirante |
| `POST` | `/:id/documents` | talento_humano, gerencia, admin | Sube documento (multipart/form-data) |
| `POST` | `/:id/hire` | talento_humano, gerencia, admin | **Acción crítica:** contrata al aspirante |
| `POST` | `/:id/comments` | verifyToken (cualquier usuario autenticado) | Agrega comentario a la solicitud |

---

## 4. Cómo Obtiene Datos el Módulo — Flujo Completo

### 4.1 Ingreso de Aspirantes (fuente externa)

```
Google Form (público)
        │
        │  Script de Google Apps Script
        │  (triggered al enviar el formulario)
        ▼
POST /api/applicants/import
        │  Auth: API Key en header
        │  Rate limit: 10 req/min
        ▼
applicants.service.js → importApplicant()
  1. normalizeApplicantPayload()   ← sanitiza y normaliza el payload
  2. mapApplicantToProfile()       ← convierte a estructura profile JSONB
  3. INSERT INTO applicants (email UNIQUE)
     ON CONFLICT DO UPDATE          ← upsert por email
  4. INSERT normalizado a tablas satélite:
       applicant_personal_data
       applicant_education (N registros)
       applicant_trainings (N registros)
       applicant_work_experience (N registros)
       applicant_personal_references (N registros)
       applicant_work_references (N registros)
       applicant_licenses
       applicant_ethnic_id
       applicant_health
  5. saveDocuments()
       → ensureFolder() en Google Drive: applicants/{email}/
       → uploadBase64File() para cada documento adjunto
       → INSERT INTO applicant_documents (con SHA-256 del archivo)
  6. logAction() → audit trail
```

> **Nota sobre emails al aspirante:** El backend NO envía emails al aspirante. La "confirmación automática" viene del propio Google Form (respuesta automática de Google). El backend solo notifica al equipo de TH vía `HR_NOTIFICATION_EMAILS`.

### 4.2 Creación de Solicitud de Personal

```
Manager / Jefe de área / TH
        │
        │  POST /api/v1/personnel-requests
        ▼
personnel-requests.service.js → createPersonnelRequest()
  1. INSERT INTO personnel_requests
       request_number: SP-2026-00001
       status: 'pendiente'
  2. INSERT INTO personnel_request_history (registro inicial)
  3. Notificación email a TH (via gmailService)
```

### 4.3 Vinculación de Aspirante a Solicitud

```
TH selecciona un aspirante de la lista
        │
        │  PATCH /api/v1/personnel-requests/:id/applicant
        │  Body: { applicant_id }
        ▼
personnel-requests.service.js → linkApplicantToRequest()
  1. UPDATE personnel_requests SET applicant_id = $1
  2. INSERT INTO personnel_request_history
  3. Carga perfil del aspirante desde applicants + tablas satélite
```

### 4.4 Construcción del Perfil (paso clave)

```
TH llena/edita el perfil del aspirante en el workspace
        │
        │  PUT /api/v1/personnel-requests/:id/profile
        │  Body: { profile: {...JSONB...}, qualifications: [...] }
        ▼
personnel-requests.service.js → updatePersonnelProfile()
  1. UPSERT INTO personnel_request_profiles
  2. Valida contra REQUIRED_PROFILE_FIELDS (24 campos obligatorios)
  3. Si colaborador ya existe: sync → collaborator_profiles
```

**Campos obligatorios del perfil JSONB (24 campos):**
- Personal: nombres, apellidos, cedula, fecha_nacimiento, genero, tipo_sangre, estado_civil, telefono
- Laboral: cargo, area, fecha_ingreso, tipo_contrato, salario
- Familiar: cónyuge, hijos
- Dirección: ciudad, direccion, telefono_fijo
- Contacto emergencia: nombre, telefono, parentesco
- Educación: nivel_educacion

### 4.5 Contratación (transacción crítica)

```
TH ejecuta la contratación cuando el perfil está al 100%
        │
        │  POST /api/v1/personnel-requests/:id/hire
        ▼
personnel-requests.service.js → hireApplicant()
  ┌─── Validación previa ────────────────────────────────────────┐
  │  1. Verifica perfil completo (REQUIRED_PROFILE_FIELDS)        │
  │  2. Verifica documentos requeridos (ver lista §4.6)           │
  └──────────────────────────────────────────────────────────────┘
  ┌─── Transacción DB (BEGIN/COMMIT) ───────────────────────────┐
  │  3. CREATE/UPDATE users (cuenta del sistema)                 │
  │  4. UPSERT collaborator_profiles (perfil JSONB)              │
  │  5. TRANSFER docs:                                           │
  │       personnel_request_documents                            │
  │       → collaborator_documents                               │
  │  6. MIGRATE qualifications:                                  │
  │       personnel_request_profiles.qualifications              │
  │       → collaborator_qualifications                          │
  │  7. UPDATE personnel_requests.status = 'completada'          │
  │  8. INSERT personnel_request_history                         │
  └──────────────────────────────────────────────────────────────┘
  9. ensureFolder() en Drive: collaborators/{email}/
  10. Notificaciones email a TH y Financiero
  11. logAction() → audit trail
  → Retorna: { user_id, email, collaborator_created }
```

### 4.6 Documentos Requeridos para Contratar

```
CEDULA_COLOR                    PASAPORTE_NOTARIADO
CERTIFICADO_VOTACION_COLOR      SERVICIO_BASICO
CERTIFICADO_SALUD               CARNET_TIPO_SANGRE
ACTA_MATRIMONIO                 CERTIFICADO_NACIMIENTO_HIJOS
FOTO_CARNET                     TITULOS_CURSOS
CERTIFICADO_TRABAJO_ANTERIOR    HISTORIAL_IESS (carga manual — sin integración API)
CRONOGRAMA_INDUCCION            AUTORIZACION_DESCUENTOS
ACTA_BIENES                     CONTRATO_TRABAJO
CONVENIO_CONFIDENCIALIDAD       ALCANCE_LOPDP
COMPROMISO_NO_DISCRIMINACION    INGRESO_IESS
REGISTRO_BALANCE_SOCIAL         FORMATO_DECIMOS
REGISTRO_FIRMAS                 OFERTA_SALARIO
```

> **HISTORIAL_IESS:** Se sube manualmente por TH. No existe integración API con el IESS.

---

## 5. Estados y Transiciones de Solicitudes

```
pendiente
    │
    ▼
en_revision ──► rechazada
    │
    ▼
aprobada
    │
    ▼
en_proceso
    │
    ▼
completada
```

Cada transición registra en `personnel_request_history`: estado anterior, nuevo estado, usuario que cambió, notas y timestamp.

**SLA tracking:** El servicio detecta solicitudes "estancadas" (`stalled_only=true`) cuando se supera el tiempo máximo por etapa (típicamente 72–96 horas). No hay acción automática — solo marcado para reporte.

---

## 6. Integraciones Externas

### 6.1 Google Form → Import Endpoint
- Un Google Apps Script escucha el evento `onFormSubmit`
- Transforma las respuestas al payload esperado por `/api/applicants/import`
- Envía la request con el API Key en el header
- **El Google Form envía su propia confirmación automática al aspirante** (no el backend)

### 6.2 Google Drive
- **Variables de entorno:** `DRIVE_ROOT_FOLDER_ID`, credenciales de Service Account
- **Estructura de carpetas:**
  - `ROOT/applicants/{email}/` — documentos del aspirante
  - `ROOT/collaborators/{email}/` — documentos del colaborador activo
- **Funciones clave:** `ensureFolder()`, `uploadBase64File()`, `uploadFileToDrive()`
- **Integridad:** SHA-256 calculado en cada upload y guardado en DB

### 6.3 Gmail (notificaciones internas)
- **Variable de entorno:** `HR_NOTIFICATION_EMAILS` (lista separada por comas)
- **Cuándo dispara:**
  - Al crear una solicitud de personal
  - Al contratar un aspirante (notifica a TH + Financiero)
  - En cambios de estado relevantes
- **No notifica al aspirante directamente**

---

## 7. Frontend — Cómo Consume los Datos

### 7.1 Punto de entrada principal

`CollaboratorCommandCenter.jsx` es el workspace central. Maneja tres vistas:
- **Solicitudes** — gestión de solicitudes de personal
- **Colaboradores** — gestión de empleados activos
- **Desvinculación** — proceso de offboarding

El estado global del workspace vive en `useCommandCenterState.js`, que carga en paralelo: solicitudes, aspirantes vinculados, perfil, documentos, historial.

### 7.2 Flujo de datos en el frontend

```
CollaboratorCommandCenter
        │
        ├── useCommandCenterState.js
        │       ├── GET /api/v1/personnel-requests (lista)
        │       ├── GET /api/v1/personnel-requests/:id/workspace (al seleccionar)
        │       ├── GET /api/v1/personnel-requests/:id/applicants
        │       └── GET /api/v1/personnel-requests/:id/profile
        │
        ├── ApplicantList.jsx          ← muestra aspirantes de la solicitud
        ├── ApplicantIntakeSummary.jsx ← resumen del aspirante importado
        ├── PersonnelProfile.jsx       ← editor del perfil JSONB (60 KB — god component)
        ├── PersonnelDocuments.jsx     ← upload/gestión de documentos
        ├── PersonnelChecklist.jsx     ← checklist de compleción
        └── PersonnelRequestComments.jsx ← comentarios internos/externos
```

### 7.3 Archivos de API del frontend

| Archivo | Función |
|---------|---------|
| [applicantsApi.js](../../spi_front/src/core/api/applicantsApi.js) | Llamadas a `/api/applicants` |
| [personnelRequestsApi.js](../../spi_front/src/core/api/personnelRequestsApi.js) | Llamadas a `/api/v1/personnel-requests` |

---

## 8. Control de Acceso por Rol

| Acción | talento_humano | gerencia | jefe_[area] | admin | Colaborador |
|--------|:-:|:-:|:-:|:-:|:-:|
| Crear solicitud | ✓ | ✓ | ✓ | ✓ | ✗ |
| Ver todas las solicitudes | ✓ | ✓ | Solo las propias | ✓ | ✗ |
| Vincular aspirante | ✓ | ✓ | ✗ | ✓ | ✗ |
| Editar perfil aspirante | ✓ | ✓ | ✗ | ✓ | ✗ |
| Subir documentos | ✓ | ✓ | ✗ | ✓ | ✗ |
| Contratar (hire) | ✓ | ✓ | ✗ | ✓ | ✗ |
| Ver sus propios docs | ✗ | ✗ | ✗ | ✗ | ✓ |
| Ver aspirantes (público) | ✓ | ✓ | ✓ | ✓ | Vía portal público |

La lógica de acceso a secciones del workspace está encapsulada en `workspaceAccess.js`.

---

## 9. Deudas Técnicas y Riesgos

| Ítem | Descripción |
|------|-------------|
| **Services muy grandes** | `applicants.service.js` (~44 KB) y `personnel-requests.service.js` (~72 KB). Candidatos a dividirse en sub-servicios por responsabilidad. |
| **God Component** | `PersonnelProfile.jsx` (60 KB) concentra demasiada lógica de formulario. |
| **Perfil JSONB no validado con schema** | Los 24 campos requeridos se validan con un array de strings hardcodeado (`REQUIRED_PROFILE_FIELDS`), no con JSON Schema formal. |
| **Drive síncrono en import** | `ensureFolder()` + `uploadBase64File()` bloquean la transacción del import. Un timeout de Drive falla toda la importación. |
| **Sin soft-delete en aspirantes** | Un `DELETE` en `applicants` borra en cascada toda la información normalizada. |
| **Inconsistencia de ruta** | `/api/applicants` sin `/v1/` vs `/api/v1/personnel-requests`. |

---

## 10. Variables de Entorno Relevantes

| Variable | Uso |
|----------|-----|
| `DRIVE_ROOT_FOLDER_ID` | Carpeta raíz en Google Drive para todos los documentos |
| `HR_NOTIFICATION_EMAILS` | Lista separada por comas de emails que reciben notificaciones de TH |
| `APPLICANTS_API_KEY` | API Key que autentica el script de Google Forms al llamar `/import` |
