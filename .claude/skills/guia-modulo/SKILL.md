---
name: guia-modulo
description: Genera una guía de usuario paso a paso en español natural para cualquier módulo de FamSPI. El resultado es un archivo .md guardado en docs/user-guides/. Úsalo cuando el usuario quiera documentar cómo usar un módulo del sistema para que cualquier persona lo entienda sin conocimiento técnico. Invoca con: /guia-modulo <nombre-del-modulo>
---

# Skill: Generador de guías de usuario — FamSPI

Generas una guía de usuario completa, alineada al código actual, escrita en lenguaje completamente natural para que cualquier persona del equipo entienda cómo usar el módulo, sin necesidad de conocimientos técnicos.

---

## Argumento de entrada

El argumento que viene después de `/guia-modulo` es el nombre del módulo. Puede venir en distintas formas:

| El usuario escribe | Lo que debes buscar |
|---|---|
| `attendance` / `asistencia` / `marcaciones` | `backend/src/modules/attendance/` + `spi_front/src/modules/talento/` (attendance) |
| `capacitaciones` / `trainings` | `backend/src/modules/trainings/` + `spi_front/src/modules/capacitaciones/` |
| `support-tickets` / `tickets` / `ti` | `backend/src/modules/support-tickets/` + `spi_front/src/modules/ti/` |
| `collaborators` / `colaboradores` | `backend/src/modules/collaborators/` + `spi_front/src/modules/talento/` |
| `calendar` / `calendario` | `backend/src/modules/calendar/` + `spi_front/src/modules/calendario/` |
| `permisos` / `permissions` | `backend/src/modules/permisos/` + `spi_front/src/modules/permisos/` |
| `profile` / `perfil` | `backend/src/modules/user-profile/` + `spi_front/src/modules/profile/` |
| `kickoff` | `backend/src/modules/kickoff/` + `spi_front/src/modules/kickoff/` |
| Otro | Busca en `backend/src/modules/` y `spi_front/src/modules/` por nombre similar |

Si el argumento es ambiguo o no reconocido, lista los módulos disponibles y pide al usuario que aclare.

---

## Proceso obligatorio (en este orden)

### Paso 1 — Exploración del backend

Lee estos archivos del módulo backend. Si no existen, continúa con lo que haya:

1. `CONTEXT.md` del módulo — descripción de alto nivel del módulo (si existe)
2. `*.routes.js` — qué endpoints existen, qué método HTTP usa cada uno, qué middleware requiere
3. `*.controller.js` — qué hace cada endpoint, qué responde, qué errores maneja
4. `*.service.js` — lógica de negocio: validaciones, estados, flujos, reglas
5. `*.auth.js` — qué roles tienen acceso a qué endpoints
6. Migraciones relevantes en `backend/migrations/` — qué tablas y campos existen, qué estados son válidos (CHECK constraints)

**Lo que debes extraer del backend:**
- Lista de operaciones que el usuario puede hacer
- Tipos de registros y sus posibles estados
- Validaciones de negocio (qué acepta, qué rechaza, bajo qué condiciones)
- Roles que tienen acceso
- Flujos con condiciones (si X entonces Y, si no Z)

### Paso 2 — Exploración del frontend

Lee estos archivos del módulo frontend:

1. Páginas principales (`pages/*.jsx`) — qué muestra el usuario, qué acciones puede tomar
2. Componentes clave (`components/*.jsx`) — formularios, tablas, paneles, modales
3. API client (`api/*.js` o `core/api/<modulo>Api.js`) — qué parámetros envía cada llamada
4. Hooks (`hooks/*.js`) — estado de la UI, qué datos se cargan
5. Constantes y opciones (`*.constants.js`, opciones hardcodeadas en los componentes)

**Lo que debes extraer del frontend:**
- Nombres exactos de botones y labels (usa el texto tal como aparece en el código)
- Campos de formulario y sus opciones (selects, radios, etc.)
- Mensajes de confirmación y advertencia
- Estados visuales (qué ve el usuario en cada estado)
- Flujos de navegación (qué pantalla lleva a cuál)

### Paso 3 — Redactar la guía

Con toda la información recopilada, genera el documento según la plantilla de abajo.

**Principios de escritura:**
- Lenguaje completamente natural. No uses términos técnicos como "endpoint", "payload", "status", "boolean", "modal", "query", "JWT", "constraint".
- Traduce los nombres técnicos: `attendance_status: "completed"` → "Jornada cerrada"; `type: "interna"` → "La dicta alguien de la empresa".
- Escribe en segunda persona: "Haz clic en...", "Verás...", "El sistema registra...".
- Usa el nombre exacto de los botones y campos tal como aparecen en la pantalla (extráelos del código JSX).
- Explica el POR QUÉ de cada validación, no solo el QUÉ. Ejemplo: no solo "el GPS debe tener precisión de 250m" sino "si el GPS reporta un error mayor a 250 metros, el sistema no puede confirmar que estás en el lugar correcto y rechaza la marcación".
- Si hay condiciones de negocio (ej. "solo puedes hacer esto si ya hiciste aquello"), explícalas de forma narrativa.
- Incluye ejemplos concretos en los campos de texto libre.

### Paso 4 — Guardar el archivo

Guarda el resultado en: `docs/user-guides/<nombre-del-modulo>.md`

Usa el nombre del módulo en español, en minúsculas, sin espacios (usa guiones). Ejemplos:
- `docs/user-guides/capacitaciones.md`
- `docs/user-guides/asistencia-marcaciones.md`
- `docs/user-guides/tickets-soporte.md`
- `docs/user-guides/permisos.md`

Si ya existe un archivo para ese módulo, **sobrescríbelo** — la nueva guía debe reflejar el estado actual del código.

---

## Plantilla de la guía

Adapta esta plantilla al módulo. Agrega, quita o reorganiza secciones según lo que encontraste en el código. No incluyas secciones vacías.

```markdown
# Guía de uso — [Nombre del módulo en lenguaje natural]

> **Para quién es esta guía:** [Describe los perfiles de usuario que usan este módulo. Extráelos del auth/roles del backend.]

---

## ¿Para qué sirve este módulo?

[2-3 párrafos explicando qué problema resuelve, qué registra, qué genera. Sin jerga técnica.]

---

## ¿Quién puede usarlo?

[Lista de roles con acceso y qué puede hacer cada uno. Extráelo de *.auth.js o del middleware de rutas.]

---

## Pantalla principal

[Qué ve el usuario al entrar al módulo: lista, tabla, dashboard. Qué columnas hay, qué significan, cómo filtrar, cómo buscar.]

### ¿Qué significa cada estado?

| Lo que ves | Qué significa |
|---|---|
| **Estado 1** | Explicación natural |
| **Estado 2** | Explicación natural |

---

## [Flujo principal 1 — ej. "Crear un registro"]

[Paso a paso de la operación más común. Usa numeración. Menciona el nombre exacto de los botones.]

### Paso 1 — [Nombre]
...

### Paso 2 — [Nombre]
...

---

## [Flujo principal 2 — ej. "Aprobar una solicitud"]

[Si el módulo tiene flujos de aprobación, estados intermedios, o roles distintos que hacen cosas distintas, describe cada uno por separado.]

---

## [Sección especial si aplica — ej. "Cuando algo sale mal", "Correcciones", "Reportes"]

---

## Preguntas frecuentes

**[Pregunta que haría un usuario real]**
[Respuesta directa en una o dos oraciones.]

**[Otra pregunta frecuente]**
[Respuesta.]

---

## Resumen rápido

[Tabla o lista de "si necesitas hacer X → haz Y". Referencia rápida para usuarios que ya conocen el módulo.]
```

---

## Criterios de calidad

La guía está lista cuando:

- [ ] No contiene ningún término técnico que un usuario no-técnico no entendería
- [ ] Los nombres de botones, campos y estados coinciden exactamente con lo que aparece en el código JSX
- [ ] Cada flujo está descrito paso a paso con acciones concretas
- [ ] Las validaciones de negocio tienen su explicación del "por qué"
- [ ] Los estados están listados con su significado en lenguaje natural
- [ ] Hay al menos una sección de preguntas frecuentes basada en casos edge reales del código
- [ ] El archivo está guardado en `docs/user-guides/`

---

## Stop conditions

Detente y avisa al usuario si:

- El módulo no existe en el codebase con ese nombre ni con variantes cercanas.
- El frontend y el backend tienen flujos contradictorios (avisa cuál parece más actualizado).
- El módulo existe pero está vacío o sin implementar.

En esos casos, describe exactamente qué encontraste y pide confirmación antes de continuar.
