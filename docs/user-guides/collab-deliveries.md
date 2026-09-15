# Guía de uso — Entregas de Colaboradores (Collab Deliveries)

> **Para quién es esta guía:** Talento Humano, gerencia, servicio técnico y TI que gestiona la entrega de equipos, documentos y activos a colaboradores (o su retiro al desvincularse).

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el ciclo completo de **entrega y retiro de activos** a colaboradores. Cubre:
- Asignación de equipos, accesorios y documentos al personal.
- Generación y gestión de **actas de entrega**.
- Control de **sesiones de entrega** multi-ítem.
- Procesos de **desvinculación** (offboarding): generación de tareas de retiro de activos.
- Reportes ejecutivos y por colaborador (en PDF).
- Integración con **workflows de firma digital** para_validar las actas.

Es un módulo crítico para asegurar que cada colaborador reciba lo que necesita y que la empresa recupere los activos cuando la persona se va.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `talento_humano`, `jefe_talento_humano` | Acceso completo: crear, editar, cerrar entregas y actas |
| `gerencia`, `gerencia_general` | Lectura y operación amplia |
| `servicio_tecnico`, `tecnico`, `jefe_tecnico` | Participación en sesiones de entrega técnica |
| `ti`, roles de TI | Crear sesiones propias (infraestructura) |
| Otros roles | Acceso de lectura configurado |

---

## Pantalla principal

No tiene workspace propio confirmado como página standalone. Se accede mediante endpoints REST desde:
- Módulo **Talento Humano** (onboarding/offboarding).
- Módulo **Servicio Técnico** (entregas de equipos).
- Posible workspace de Colaboradores.

---

## Flujo principal — Generar una entrega

### Paso 1 — Acceder al endpoint de creación

### Paso 2 — Registrar la entrega

Completa:
- Colaborador destinatario (`userId`).
- Categoría o tipo de activo entregado.
- Lista de ítems.
- Fecha de entrega.
- Responsable de la entrega.

### Paso 3 — Guardar

Queda registrada la entrega y disponible para vincularle documentos y actas.

---

## Flujo principal — Generar el acta de entrega

### Paso 1 — Acceder a la entrega

### Paso 2 — Generar el acta

El sistema puede generar un acta automática con:
- Datos del colaborador.
- Detalle de los ítems entregados.
- Fecha y responsables.

### Paso 3 — Iniciar firma digital

El acta puede enviarse a firma si el flujo lo requiere.

### Paso 4 — Subir acta firmada (si aplica)

Una vez firmada, el usuario autorizado sube el documento firmado para cerrar el circuito.

---

## Flujo principal — Gestionar sesiones de entrega

### Paso 1 — Crear una sesión

Una **sesión** agrupa varias entregas por categoría bajo un solo acta.

### Paso 2 — Agregar entregas a la sesión

Vincula las entregas individuales a la sesión.

### Paso 3 — Cerrar la sesión

Actualiza el estado de la sesión cuando todas las entregas estén completas y firmadas.

---

## Flujo principal — Generar reportes

### Paso 1 — Acceder a reportes

El módulo expone reportes ejecutivos y por colaborador en PDF.

### Paso 2 — Exportar

Descarga:
- Reporte full del sistema.
- Reporte individual por colaborador.

---

## Flujo principal — Renovaciones

### Paso 1 — Acceder a renovaciones

### Paso 2 — Completar la renovación

Actualiza el estado de activos que requieren renovación (por ejemplo, equipos en garantía, certificaciones por vencer).

---

## Flujo principal — Desvinculación (offboarding)

### Paso 1 — Iniciar tareas de offboarding

Desde el endpoint de offboarding, se generan las tareas de retiro de activos para el colaborador.

### Paso 2 — Gestionar retiros

El sistema lista los activos que deben devolverse y registra su retiro efectivo.

---

## Preguntas frecuentes

**[El acta no aparece en la lista de actas de la entrega]**

Verifica que se haya generado correctamente y que estés filtrando por la entrega correcta.

**[No puedo subir el acta firmada]**

Verifica que tengas el rol de escritura sobre la entrega o acta correspondiente.

**[Qué es una sesión de entrega]**

Es un agrupador de múltiples entregas bajo una misma acta por categoría. Sirve para jornadas de entrega masiva (por ejemplo, entrega de kits a todo un equipo nuevo).

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar una entrega a un colaborador | Crea la entrega con ítems y fecha |
| Generar el acta de entrega | Genera el acta desde la entrega |
| Firmar el acta | Inicia el workflow de firma digital |
| Gestionar entrega masiva | Crea una sesión y agrupa las entregas |
| Ver retiros pendientes por offboarding | Consulta las tareas de desvinculación |
| Obtener reporte | Exporta reporte full o por colaborador |
