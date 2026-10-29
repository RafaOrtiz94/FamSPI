# Guía de uso — Postulantes (Applicants)

> **Para quién es esta guía:** Sistemas externos (ATS/portales de empleo), Talento Humano y procesos de selección que importan y consulta candidatos.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona los **perfiles de postulantes/candidatos** que ingresan a la empresa desde fuentes externas. Está diseñado principalmente como una **API de integración**, no como un workspace interactivo para usuarios finales.

Funcionalidades:
- **Lectura pública**: listar y consultar candidatos (`GET /api/applicants`).
- **Importación segura**: recibir candidatos desde un ATS o portal de empleo externo usando API Key (`POST /api/applicants/import`), con rate limit de 10 req/min.
- **Vinculación**: los candidatos pueden asociarse a solicitudes de personal en `personnel-requests` para iniciar un proceso formal.

El objetivo es centralizar el pozo de candidatos sin depender de captura manual repetitiva.

---

## Acceso público

> **Importante:** Los endpoints de lectura (`GET /api/applicants` y `GET /api/applicants/:id`) **no requieren autenticación JWT**. Cualquier persona puede acceder a esta información. Si necesitas restringir el acceso, solicita a TI evaluar el ajuste de seguridad.

---

## Flujo principal — Importar candidatos (sistema externo)

### Paso 1 — Obtener API Key

El sistema externo debe contar con la `applicantsApiKey` válida.

### Paso 2 — Enviar el POST a `/import`

Endpoint: `POST /api/applicants/import`.

- Autenticación por API Key.
- Límite de tasa: 10 solicitudes por minuto.
- Tamaño máximo del body: 5 MB.
- El sistema almacena el perfil del candidato.

### Paso 3 — Confirmar importación

El sistema devuelve la confirmación de creación del postulante.

---

## Flujo principal — Consultar candidatos (Talento Humano)

### Paso 1 — Acceder al listado

Usa `GET /api/applicants/` desde el área de Talento Humano o una herramienta administrativa.

### Paso 2 — Consultar detalle

Usa `GET /api/applicants/:id` para ver el perfil completo.

### Paso 3 — Vincular a una solicitud de personal

Si el candidato debe entrar al proceso formal, vincúlalo a la solicitud en `personnel-requests` para activar el `hiring-pipeline`.

---

## Seguridad y riesgos

- Lectura pública: cualquier persona puede listar candidatos.
- Autenticación de importación por API Key (no JWT).
- Prefijo inconsistente: `/api/applicants` no usa `/v1/`.
- Servicio grande (`applicants.service.js` de 44KB), lo que sugiere lógica considerable.

---

## Preguntas frecuentes

**[Cómo sé si un candidato fue importado correctamente]**

Consulta el listado por nombre o documento. Si no aparece, revisa la respuesta del POST `/import`.

**[Puedo editar un candidato desde este módulo]**

El CONTEXT.md no expone endpoints de edición. Es probable que la edición se gestione por otros módulos o no esté implementada.

**[Qué pasa si el ATS envía duplicados]**

El módulo no documenta validación de duplicados en la importación. Verifica en el backend antes de conectar sistemas.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Importar candidatos automáticamente | POST `/api/applicants/import` con API Key |
| Consultar listado de candidatos | GET `/api/applicants/` |
| Ver detalle de un candidato | GET `/api/applicants/:id` |
| Iniciar proceso formal | Vincula a `personnel-requests` / `hiring-pipeline` |
