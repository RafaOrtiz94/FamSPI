# Guía de uso — Gestión Documental (CA-01-05)

> **Para quién es esta guía:** Personal de Calidad, Gerencia y equipos delegados que administra la documentación GXP/ISO de la empresa.

---

## ¿Para qué sirve este submódulo?

Este submódulo es el repositorio documental de **Calidad**. Permite organizar, versionar, publicar y auditar todos los documentos normativos de la empresa: procedimientos, instructivos, registros, manuales, políticas y documentos SOP (Standard Operating Procedure).

A diferencia de un almacenamiento de archivos común, este sistema controla:
- La **estructura de carpetas** (jerárquica, con subcarpetas).
- El **ciclo de vida** de cada documento (borrador, revisión, aprobado, archivado).
- El **versionado** completo: cada cambio genera una nueva versión con trazabilidad de quién modificó, qué cambió y cuándo.
- Los **permisos de acceso** por rol: quién puede leer, revisar, aprobar o administrar cada documento.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo: crear carpetas, subir documentos, versionar, aprobar, archivar, gestionar permisos |
| Gerencia | Crear carpetas, subir documentos, versionar, aprobar, pero no eliminar carpetas ni gestionar todos los permisos |

> Los permisos específicos por documento o carpeta pueden restringir aún más el acceso. Consulta la sección de "Permisos" dentro del workspace para ver los niveles asignados.

---

## Pantalla principal

La pantalla muestra el workspace **"Gestión y Control de Documentos"** con:

### Encabezado
- Título: **"Gestión y Control de Documentos"**.
- Subtítulo: *"Sistema de gestión documental GXP/ISO con versionado, permisos y trazabilidad."*

### Cuatro tarjetas de flujo (lane cards)

Cada tarjeta representa un área funcional del submódulo:

| Tarjeta | Función |
|---|---|
| **Carpetas** | Estructura organizacional de carpetas y subcarpetas para clasificar documentos. |
| **Documentos** | Gestión documental con versionado y trazabilidad. |
| **Versiones** | Control de versiones, cambios y auditoría de cada documento. |
| **Permisos** | Control de acceso por roles y niveles de permisos. |

### Métricas generales

- **Flujos activos**: 4 (carpetas, documentos, versiones, permisos).
- **RBAC**: Privado, con rutas protegidas.
- **Trazabilidad**: GXP.
- **Versionado**: Integral, con historial completo de cambios.

---

## Flujo principal — Crear una carpeta (Calidad o Gerencia)

### Paso 1 — Acceder a "Carpetas"

Toca la tarjeta **"Carpetas"** en el workspace.

### Paso 2 — Tocar "Nueva carpeta" o "+"

Busca el botón para crear una carpeta.

### Paso 3 — Completar los datos

- **Nombre de la carpeta**: ejemplo: "Procedimientos de producción", "Registros de calidad 2026".
- **Carpeta padre** (opcional): si quieres crear una subcarpeta dentro de otra existente, selecciona la carpeta padre.
- **Descripción** (opcional): para qué sirve esta carpeta o qué documentos alojará.
- **Creado por**: se asigna automáticamente según tu usuario.

### Paso 4 — Guardar

Toca **"Guardar"**. La carpeta queda disponible para recibir documentos.

> **Nota:** Solo Calidad puede eliminar carpetas. Gerencia puede crearlas y editarlas, pero no borrarlas.

---

## Flujo principal — Subir un documento

### Paso 1 — Acceder a "Documentos"

Toca la tarjeta **"Documentos"**.

### Paso 2 — Tocar "Nuevo documento" o "+"

### Paso 3 — Completar los datos

- **Nombre del documento**.
- **Categoría**: elige entre:
  - `sop` (procedimiento estándar).
  - `procedimiento`.
  - `instructivo`.
  - `registro`.
  - `manual`.
  - `politica`.
  - `otro`.
- **Carpeta**: selecciona la carpeta donde se alojará.
- **Versión inicial**: número de versión (ejemplo: 1.0).
- **Archivo**: adjunta el documento.
- **Descripción** (opcional).

### Paso 4 — Guardar

El documento se registra en estado **"Borrador"** (`draft`).

---

## Flujo principal — Ciclo de vida de un documento

Cada documento pasa por estados controlados:

| Estado | Qué significa |
|---|---|
| **Borrador (draft)** | El documento está en creación o revisión inicial |
| **Revisión (review)** | Pendiente de aprobación por Calidad o Gerencia |
| **Aprobado (approved)** | Validado y vigente para uso |
| **Archivado (archived)** | Documento histórico, ya no está vigente |

### Paso 1 — Enviar a revisión

Una vez cargado el borrador, Calidad o Gerencia cambia el estado a **"Revisión"**.

### Paso 2 — Aprobar

Después de revisar el contenido, se aprueba el documento y pasa a estado **"Aprobado"**.

### Paso 3 — Archivar

Cuando el documento deja de estar vigente (por ejemplo, fue reemplazado por una versión nueva), se cambia a estado **"Archivado"**.

---

## Flujo principal — Gestionar versiones

### Paso 1 — Acceder a "Versiones"

Toca la tarjeta **"Versiones"**.

### Paso 2 — Ver el historial

El sistema mantiene un registro completo de cada cambio:
- Número de versión.
- Fecha y hora del cambio.
- Usuario que realizó la modificación.
- Descripción del cambio.

### Paso 3 — Crear una nueva versión

Cuando un documento aprobado necesita modificaciones:
1. Se genera una nueva versión (ejemplo: de 1.0 a 2.0).
2. El documento original se archiva o mantiene como referencia.
3. La nueva versión pasa por el ciclo de vida nuevamente (borrador → revisión → aprobado).

---

## Flujo principal — Gestionar permisos

### Paso 1 — Acceder a "Permisos"

Toca la tarjeta **"Permisos"**.

### Paso 2 — Revisar los niveles de acceso

Los niveles disponibles son:

| Nivel | Qué permite |
|---|---|
| `read` (lectura) | Ver el documento o carpeta |
| `review` (revisión) | Ver y comentar / sugerir cambios |
| `approve` (aprobación) | Revisar y aprobar el documento |
| `admin` (administración) | Control total: crear, editar, aprobar, eliminar, gestionar permisos |

### Paso 3 — Asignar permisos

Calidad o Gerencia puede asignar niveles de acceso a usuarios o roles específicos para cada documento o carpeta.

---

## Preguntas frecuentes

**[No puedo eliminar una carpeta]**

Solo el rol `calidad` puede eliminar carpetas. Si eres gerencia, puedes editar la carpeta pero no borrarla. Si necesitas eliminarla, contacta a Calidad.

**[Un documento aprobado necesita cambios]**

No edites directamente un documento aprobado. Crea una nueva versión y sigue el ciclo de vida (borrador → revisión → aprobado). Así mantienes la trazabilidad del cambio.

**[No veo un documento en la lista]**

Verifica que estés en la carpeta correcta y que tus permisos te permitan ver ese documento. Si el documento está en una carpeta restringida, no aparecerá en tu vista.

**[Cómo sé qué versión es la vigente]**

El estado **"Aprobado"** indica la versión vigente. Las versiones archivadas o en borrador no son las oficiales en uso.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una carpeta documental | Ve a "Carpetas" → "Nueva carpeta" |
| Subir un documento | Ve a "Documentos" → "Nuevo documento" |
| Cambiar un documento aprobado | Crea una nueva versión en "Versiones" |
| Revisar cambios historicos | Ve a "Versiones" → consulta el historial |
| Controlar quién accede | Ve a "Permisos" → asigna niveles por rol |
| Archivar un documento | Cambia el estado a "Archivado" |
