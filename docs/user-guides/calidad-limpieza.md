# Guía de uso — Limpieza de Áreas (CA-01-02)

> **Para quién es esta guía:** Operadores de limpieza, servicio técnico, operaciones y personal de Calidad que registra, supervisa y verifica las actividades de limpieza de áreasNormadas GXP.

---

## ¿Para qué sirve este submódulo?

Este submódulo registra y da seguimiento a todas las actividades de **limpieza de áreas** dentro de la empresa. Cada área tiene un nivel de riesgo y una frecuencia de limpieza requerida. Los operadores registran cuándo se realizó una limpieza, qué tipo fue y qué producto se usó. Calidad luego verifica el registro y lo cierra, dejando trazabilidad de cada evento.

Sirve para cumplir con normativas de Buenas Prácticas (GXP) y asegurar que las áreas críticas se mantengan en condiciones higiénicas controladas.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Crear áreas, registrar limpiezas, ver registros, verificar y cerrar logs |
| Servicio técnico | Registrar limpiezas |
| Operaciones | Registrar limpiezas |
| Gerencia | Ver áreas y registros de limpieza |

> Solo Calidad puede crear nuevas áreas y verificar o cerrar los registros de limpieza. Los operadores de servicio técnico y operaciones pueden registrar limpiezas, pero no validarlas.

---

## Pantalla principal

La pantalla se llama **"Command Center de saneamiento GXP"** y tiene el subtítulo **"CA-01-02 | Limpieza de Áreas"**.

Verás:

### Panel superior
- Indicador del operador activo (tu nombre y rol).
- Tres tarjetas de métricas:
  1. **Áreas monitoreadas**: cantidad total de áreas registradas.
  2. **Registros de limpieza**: cantidad de eventos de limpieza en el sistema.
  3. **Alertas**: cantidad de registros pendientes de verificación (estado `Pendiente`).

### Zona inferior
- **Filtro por nivel de riesgo**: puedes filtrar las áreas por nivel de riesgo (alto, medio, bajo, estéril) escribiendo en el campo de búsqueda.
- **Lista de registros de limpieza**: cada registro muestra el área, el tipo de limpieza, quién lo ejecutó, la fecha y el estado actual.

---

## Flujo principal — Crear un área de limpieza (Calidad)

Antes de registrar limpiezas, Calidad debe definir las áreas del sistema.

### Paso 1 — Acceder a la creación de áreas

Dentro del workspace **"Limpieza"**, busca la opción para **crear un área** (formulario o botón de acceso).

### Paso 2 — Completar los datos del área

Debes ingresar:

- **Nombre del área**: ejemplo: "Sala de envasado", "Almacén de producto terminado".
- **Nivel de riesgo**: elige entre:
  - `high` (alto)
  - `medium` (medio)
  - `low` (bajo)
  - `sterile` (estéril)
- **Frecuencia requerida**: cada cuánto debe realizarse la limpieza (ejemplo: "diaria", "cada 8 horas", "semanal").
- **Descripción** (opcional): detalles adicionales sobre el área o sus requisitos específicos.

### Paso 3 — Guardar el área

Toca **"Guardar"** o **"Crear"**. El área queda disponible para que los operadores registren limpiezas en ella.

---

## Flujo principal — Registrar una limpieza (operador)

### Paso 1 — Acceder al formulario de registro

Dentro del workspace **"Limpieza"**, busca el formulario para **registrar una limpieza**.

### Paso 2 — Seleccionar el área

Elige el **área** donde se realizó la limpieza de la lista desplegable. Solo verás las áreas previamente creadas por Calidad.

### Paso 3 — Completar los datos de la limpieza

Debes ingresar:

- **Tipo de limpieza**: elige entre:
  - `routine` (rutinaria): limpieza habitual del día a día.
  - `deep_cleaning` (limpieza profunda): limpieza exhaustiva programada.
  - `spill_recovery` (recuperación de derrame): limpieza después de un derrame o incidente.
- **Agente de limpieza utilizado**: el nombre del producto o sustancia usada (ejemplo: "Alcohol al 70 %", "Detergente neutro").
- **Notas del operador** (opcional): comentarios adicionales sobre la limpieza, incidencias o detalles relevantes.

### Paso 4 — Enviar el registro

Toca **"Guardar"** o **"Registrar"**. El sistema guarda la limpieza con estado **"Pendiente"** y notifica a Calidad para su verificación.

---

## Flujo principal — Verificar o cerrar un registro de limpieza (Calidad)

### Paso 1 — Ver el listado de registros pendientes

En la pantalla principal de **"Limpieza"**, revisa la lista de registros. Los que están en estado **"Pendiente"** son los que esperan tu verificación.

El panel de métricas muestra la cantidad de alertas (registros pendientes) para que priorices tu trabajo.

### Paso 2 — Abrir el registro de limpieza

Toca el registro que quieres verificar. Verás los datos que el operador registró:
- Área.
- Tipo de limpieza.
- Producto usado.
- Notas del operador.
- Fecha y hora del registro.

### Paso 3 — Verificar y cambiar el estado

Calidad puede transicionar el registro a dos estados:

| Estado | Cuándo usarlo |
|---|---|
| **verified** | La limpieza se realizó correctamente y cumple con los requisitos del área |
| **closed** | El registro se cierra formalmente después de la verificación |

> No puedes cerrar un registro sin antes haberlo verificado. La máquina de estados impide saltos inválidos.

### Paso 4 — Agregar notas de calidad (opcional)

Al verificar o cerrar, puedes agregar un comentario:
- "Se verificó presencia de residuos."
- "Se solicita repetir limpieza en Sector B."
- "Cumple con frecuencia semanal."

Estas notas quedan registradas en la trazabilidad del evento.

---

## Flujo principal — Filtrar áreas por nivel de riesgo

### Paso 1 — Usar el filtro de riesgo

En la zona de áreas, escribe o selecciona el nivel de riesgo que necesitas revisar:
- `high` (alto)
- `medium` (medio)
- `low` (bajo)
- `sterile` (estéril)

### Paso 2 — Interpretar el resultado

El panel de **"Áreas monitoreadas"** se actualiza mostrando solo las áreas que coinciden con el filtro seleccionado. Esto ayuda a Calidad a priorizar las áreas más críticas.

---

## Flujo principal — Refrescar la información

### Paso 1 — Actualizar los datos

Toca el botón **"Refrescar"** (ícono de flecha circular) en la parte superior de la pantalla. El sistema vuelve a consultar las áreas y los registros de limpieza.

Esto es útil cuando varios operadores están registrando limpiezas al mismo tiempo y necesitas ver los últimos registros ingresados.

---

## ¿Qué significa cada estado?

| Estado | Qué significa |
|---|---|
| **Pendiente** | La limpieza fue registrada pero Calidad todavía no la verificó |
| **En proceso** | Calidad está evaluando el registro |
| **Completado** | El operador terminó la limpieza y el registro está listo para verificar |
| **Verificado** | Calidad confirmó que la limpieza se realizó correctamente |
| **Cerrado** | El registro fue validado y cerrado formalmente |

---

## Preguntas frecuentes

**[Registré una limpieza pero no veo el área que quería]**

Verifica que el área haya sido creada previamente por Calidad. Solo puedes registrar limpiezas en áreas existentes. Si el área no existe, contacta a Calidad para que la cree.

**[No tengo la opción de crear áreas]**

Solo el rol `calidad` puede crear áreas. Si necesitas agregar una nueva área, solicita a Calidad que lo haga.

**[Registré la limpieza y ahora no puedo editarla]**

Una vez enviado el registro, el operador no puede modificarlo. Calidad puede agregar notas en la verificación, pero el contenido original del operador queda fijo.

**[El nivel de riesgo de un área cambió]**

Calidad puede editar el área para actualizar su nivel de riesgo y la frecuencia requerida. Los registros antiguos mantienen los valores originales, pero los nuevos tomarán la configuración actualizada.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una nueva área (Calidad) | Completa nombre, nivel de riesgo y frecuencia |
| Registrar una limpieza | Elige el área → tipo de limpieza → agente usado → guardar |
| Verificar una limpieza (Calidad) | Abre el registro → cambia a "Verificado" |
| Cerrar un registro (Calidad) | Abre el registro verificado → cambia a "Cerrado" |
| Filtrar áreas por riesgo | Usa el filtro de nivel de riesgo |
| Ver cuántas limpiezas están pendientes | Revisa el contador de "Alertas" en las métricas |
