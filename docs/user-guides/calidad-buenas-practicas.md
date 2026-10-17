# Guía de uso — Buenas Prácticas GXP (CA-01-03)

> **Para quién es esta guía:** Personal de Calidad, Gerencia y Talento Humano que administra capacitaciones, evaluaciones, certificaciones y violaciones de buenas prácticas GXP.

---

## ¿Para qué sirve este submódulo?

Este submódulo centraliza la gestión de **buenas prácticas GXP (Good Practice)** relacionadas con el personal. Agrupa cuatro flujos clave:

1. **Training (Capacitaciones)**: registro y seguimiento de capacitaciones internas y externas del personal.
2. **Exámenes**: evaluaciones escritas, prácticas, orales, en línea o de certificación.
3. **Certificaciones**: gestión de certificaciones profesionales, renovaciones y archivos GXP.
4. **Violaciones**: registro y seguimiento de violaciones a buenas prácticas (asistencia, conducta, certificación, seguridad, política).

Cada flujo sigue el mismo patrón: se crea un registro, se hace seguimiento de su estado y se cierra con trazabilidad completa.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo a los cuatro flujos |
| Gerencia | Acceso completo a los cuatro flujos |
| Talento Humano | Crear y consultar capacitaciones, exámenes y certificaciones |

---

## Pantalla principal

La pantalla se llama **"Command Center de formación y certificación"** y tiene el subtítulo **"CA-01-03 | Buenas Prácticas"**.

Verás:

- Tres **tarjetas de flujo** principales:
  1. **Training**: seguimiento de capacitaciones, asistencia y cierre documental.
  2. **Exams**: consolidación de evaluaciones, resultados y aprobaciones.
  3. **Certifications**: gestión de certificaciones, renovaciones y archivos GXP.
- **Métricas superiores**:
  - Flujos activos (cantidad de flujos preparados).
  - Estado controlado (bloqueo de transiciones ilegales mediante state machine).
  - Trazabilidad GXP (snapshots y auditoría).
- **Selector de flujo**: cambia entre Training, Exams y Certifications para ver el detalle de cada uno.
- **Métricas del flujo seleccionado**: estado actual, nombre del flujo y si es terminal.

---

## Flujo principal — Gestionar capacitaciones (Training)

### Paso 1 — Crear una capacitación

Pueden crearla: Calidad, Gerencia y Talento Humano.

Completa:

- **Empleado (employeeId)**: ID del colaborador a capacitar.
- **Tipo de capacitación**:
  - `induction` (inducción).
  - `on_the_job` (práctica laboral).
  - `safety` (seguridad).
  - `technical` (técnica).
  - `gmp` (buenas prácticas de fabricación).
  - `refresh` (reciclaje / actualización).
- **Título** de la capacitación.
- **Descripción** (opcional).
- **Fecha programada**.
- **Instructor** (opcional).
- **Lugar** (opcional).
- **Duración en horas** (opcional).

### Paso 2 — Consultar capacitaciones

Puedes filtrar por:
- Empleado.
- Estado.
- Tipo de capacitación.

### Paso 3 — Actualizar la capacitación

Solo Calidad y Gerencia pueden editar campos como:
- Título, descripción, fecha, instructor, lugar, duración.
- Estado.
- URL del certificado.
- Puntuación de evaluación.
- Notas.

---

## Flujo principal — Gestionar exámenes (Exams)

El flujo de exámenes sigue el mismo patrón CRUD:

### Tipos de examen

| Tipo | Cuándo se usa |
|---|---|
| `written` | Escrito |
| `practical` | Práctico |
| `oral` | Oral |
| `online` | En línea |
| `certification` | Certificación |

### Resultados posibles

- `passed` (aprobado).
- `failed` (reprobado).
- `pending` (pendiente).
- `absent` (ausente).

### Acciones disponibles

- **Crear examen**: Calidad, Gerencia y Talento Humano.
- **Consultar exámenes**: filtrado por empleado, tipo, estado, resultado.
- **Actualizar examen**: solo Calidad y Gerencia.
- **Eliminar examen**: según configuración del módulo.

---

## Flujo principal — Gestionar certificaciones (Certifications)

### Tipos de certificación

- `gmp` (buenas prácticas de fabricación).
- `safety` (seguridad).
- `technical` (técnica).
- `quality` (calidad).
- `regulatory` (normativa).
- `specialty` (especialidad).

### Estados posibles

- `active` (vigente).
- `expired` (vencida).
- `revoked` (revocada).
- `pending_renewal` (pendiente de renovación).

El flujo permite registrar, consultar y mantener actualizadas las certificaciones del personal, gestionando su vigencia y archivos asociados.

---

## Flujo principal — Gestionar violaciones (Violations)

### Tipos de violación

- `attendance` (asistencia).
- `conduct` (conducta).
- `certification` (certificación).
- `safety` (seguridad).
- `policy` (política).
- `other` (otra).

### Severidad

- `minor` (leve).
- `major` (grave).
- `critical` (crítica).

### Estados de investigación

- `open` (abierta).
- `investigating` (en investigación).
- `resolved` (resuelta).
- `closed` (cerrada).
- `appeal` (apelación).

El submódulo registra violaciones a las buenas prácticas, las clasifica por severidad y permite hacer seguimiento de la investigación hasta su cierre.

---

## Flujo principal — Usar el selector de flujo en el workspace

### Paso 1 — Elegir el flujo

En la pantalla principal, toca una de las tarjetas: **Training**, **Exams** o **Certifications**. El sistema carga el flujo correspondiente.

### Paso 2 — Revisar el snapshot del flujo

El panel superior muestra el **estado actual** del flujo seleccionado, el nombre y si es un estado terminal (es decir, si el flujo ya terminó y no se puede modificar).

### Paso 3 — Realizar la acción

Según el flujo elegido, completa el formulario correspondiente (crear capacitación, registrar examen, subir certificación, etc.).

---

## Preguntas frecuentes

**[No veo la opción de crear exámenes]**

Solo Calidad, Gerencia y Talento Humano pueden crear registros en este submódulo. Si necesitas acceso, solicita a TI o a Calidad.

**[Una capacitación ya pasó su fecha pero sigue en estado "programada"]**

Actualiza el estado de la capacitación manualmente si corresponde. El sistema no cambia estados automáticamente por fecha vencida.

**[Una certificación venció pero el sistema no lo marcó]**

El estado `expired` debe asignarse manualmente o mediante un proceso automático externo. Verifica la fecha de vencimiento registrada y actualiza el estado si es necesario.

**[Qué es un estado "terminal"]**

Un estado terminal es aquel en el que el flujo ya no puede avanzar ni retroceder. Por ejemplo, un examen `failed` (reprobado) o una certificación `revoked` (revocada) pueden ser estados terminales según la state machine configurada.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar una capacitación | Elige "Training" → completa datos del curso y empleado |
| Registrar un examen | Elige "Exams" → completa tipo, empleado y resultado |
| Gestionar certificaciones | Elige "Certifications" → registra vigencia y archivos |
| Registrar una violación | Completa tipo, severidad y descripción |
| Consultar el estado de un flujo | Mira el panel superior del selector de flujo |
