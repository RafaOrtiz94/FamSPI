# Guía de uso — Hiring Pipeline (Pipeline de Selección)

> **Para quién es esta guía:** Talento Humano, jefes de Talento Humano, gerencia y admin que gestiona el proceso de selección de personal desde la solicitud hasta la contratación.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el **pipeline completo de selección** de personal. Se activa a partir de una solicitud de personal (creada previamente) y permite administrar cada postulante a lo largo de las etapas de evaluación hasta llegar a la contratación.

Funcionalidades principales:
- Visualizar el pipeline de postulantes por solicitud.
- Iniciar evaluaciones individuales.
- Avanzar etapas del proceso (primera entrevista, evaluación psicológica, entrevista de gerencia, etc.).
- Registrar puntajes, observaciones y datos parciales por etapa.
- Generar propuestas salariales.
- Subir el contrato del candidato.
- Rechazar o reactivar postulantes.
- Crear notificaciones y eventos de calendario para entrevistas.

Relaciones:
- Se apoya en `calendar.service.js` para generar eventos de entrevista.
- Envía notificaciones a postulantes cuando se agenda una entrevista.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `talento_humano` | Acceso completo |
| `jefe_talento_humano` | Acceso completo |
| `gerencia_general`, `gerencia` | Acceso completo |
| `admin` | Acceso completo |

> Acceso restringido a Talento Humano y roles superiores.

---

## Pantalla principal

No se verificó un workspace frontend propio. Las operaciones se realizan mayormente a través de endpoints REST desde herramientas administrativas o workspaces de Talento Humano.

---

## Flujo principal — Iniciar pipeline de selección

### Paso 1 — Obtener el pipeline de una solicitud

Endpoint: `GET /request/:requestId`.

Devuelve la estructura del pipeline para una solicitud de personal específica.

### Paso 2 — Iniciar evaluación

Endpoint: `POST /request/:requestId/start`.

Body: `{ applicant_id }`.

Crea las entradas del pipeline para el postulante y deja el proceso listo para avanzar etapas.

---

## Flujo principal — Avanzar etapas

Etapas documentadas (según controlador):
- `primera_entrevista` (primera entrevista).
- `evaluacion_psicologica` (evaluación psicológica).
- `entrevista_gerencia` (entrevista con gerencia).

(El servicio puede tener más etapas definidas en `STAGE_LABELS`.)

### Paso 1 — Obtener el detalle del entry

Endpoint: `GET /entries/:entryId`.

### Paso 2 — Avanzar etapa

Endpoint: `POST /entries/:entryId/stages/:stage/advance`.

Body:
- `data` (opcional): datos específicos de la etapa.
- `observations` (opcional): comentarios del evaluador.
- `score` (opcional): puntaje asignado.

### Paso 3 — Actualizar datos parciales

Endpoint: `PATCH /entries/:entryId/stages/:stage`.

Permite guardar avances sin avanzar de etapa.

### Paso 4 — Rechazar en una etapa

Endpoint: `POST /entries/:entryId/stages/:stage/reject`.

---

## Flujo principal — Propuesta salarial

### Paso 1 — Crear propuesta

Endpoint: `POST /entries/:entryId/proposals`.

### Paso 2 — Actualizar respuesta

Endpoint: `PATCH /entries/:entryId/proposals/:proposalId`.

---

## Flujo principal — Contratación

### Paso 1 — Subir contrato

Endpoint: `POST /entries/:entryId/contract`.

Sube el documento del contrato (multipart, máximo 20 MB).

---

## Flujo principal — Rechazo y reactivación

### Rechazar postulante

Endpoint: `POST /entries/:entryId/stages/:stage/reject`.

### Reactivar postulante

Endpoint: `POST /entries/:entryId/reactivate`.

---

## Flujo principal — Mis asignaciones como responsable de prueba

Si un usuario fue designado para aplicar pruebas o evaluar:

Endpoint: `GET /my-test-assignments`.

Devuelve las asignaciones pendientes del usuario autenticado. No requiere rol de Talento Humano; cualquier usuario autenticado puede consultar las suyas.

---

## Flujo principal — Notificaciones y calendario (automáticos)

Cuando se agenda una entrevista en etapas como `primera_entrevista`, `evaluacion_psicologica` o `entrevista_gerencia` y se cumplen condiciones:
- Se notifica al postulante por correo (fecha, modalidad, link).
- Se crea un evento en el calendario interno para el evaluador.

---

## Preguntas frecuentes

**[Un postulante no aparece en el pipeline]**

Verifica que se haya iniciado la evaluación con `POST /request/:requestId/start` y que se haya enviado el `applicant_id` correcto.

**[No se envió la notificación de entrevista]**

Confirma que la etapa incluye `meeting_datetime`, que `phase` sea `scheduled` y que no exista ya un `meeting_summary`. Si falta alguno, el sistema no dispara la notificación.

**[Puedo editar el puntaje después de avanzar la etapa]**

Usa `PATCH /entries/:entryId/stages/:stage` para actualizar datos parciales sin necesidad de volver a avanzar la etapa.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver postulantes de una solicitud | `GET /request/:requestId` |
| Iniciar selección para un postulante | `POST /request/:requestId/start` |
| Avanzar a la siguiente etapa | `POST /entries/:entryId/stages/:stage/advance` |
| Rechazar al postulante | `POST /entries/:entryId/stages/:stage/reject` |
| Guardar observaciones o puntaje | `PATCH /entries/:entryId/stages/:stage` |
| Enviar propuesta salarial | `POST /entries/:entryId/proposals` |
| Subir el contrato | `POST /entries/:entryId/contract` |
| Consultar mis pruebas asignadas | `GET /my-test-assignments` |
