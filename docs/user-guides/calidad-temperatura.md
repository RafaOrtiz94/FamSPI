# Guía de uso — Control de Temperatura (CA-01-01)

> **Para quién es esta guía:** Operadores que registran lecturas de termohigrómetros, y personal de Calidad y Gerencia que revisa alarmas de desviación térmica.

---

## ¿Para qué sirve este submódulo?

Este submódulo garantiza que la cadena de frío de productos sensibles se mantenga dentro de los límites seguros. Los operadores registran lecturas de temperatura y humedad de los termohigrómetros distribuidos en las áreas críticas. Si una lectura se sale del rango permitido, el sistema genera automáticamente una **alarma de desviación térmica** que Calidad debe investigar y cerrar.

El rango de temperatura permitido es de **2 °C a 8 °C**. Cualquier valor por debajo de 2 o por encima de 8 dispara una alerta inmediata.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Registrar lecturas, ver alarmas, gestionar el cierre o escalamiento de alarmas |
| Servicio técnico | Registrar lecturas de termohigrómetros |
| Operaciones | Registrar lecturas de termohigrómetros |
| Gerencia | Ver el listado de alarmas activas |

> Solo Calidad puede cambiar el estado de una alarma (reconocer, resolver o cerrar). Los demás roles pueden registrar lecturas y consultar el estado del sistema.

---

## Pantalla principal

La pantalla se llama **"GXP Command Center"** y tiene el subtítulo **"CA-01-01 | Control de Termohigrómetros y Cadenas Térmicas"**.

Está dividida en dos zonas principales:

1. **Estado del Sistema** (panel izquierdo): muestra un ícono y un número grande con la cantidad de **desviaciones abiertas**.
   - Si hay alarmas: ícono rojo de advertencia y contador en rojo.
   - Si no hay alarmas: ícono verde de confirmación y texto **"Entorno Estabilizado"**.

2. **Búsqueda y Trazabilidad Activa** (panel derecho): lista todas las alarmas activas con:
   - Estado de la alarma (ejemplo: `OPEN`, `ACKNOWLEDGED`).
   - Fecha y hora de creación.
   - Nombre del dispositivo (termohigrómetro).
   - Ubicación del dispositivo.
   - Temperatura registrada en la excursión (en °C, resaltada en rojo).

---

## Flujo principal — Registrar una lectura de temperatura

### Paso 1 — Acceder al registro de lecturas

Dentro del workspace **"Temperatura"**, busca la opción para **registrar una nueva lectura** (formulario o botón de acceso).

### Paso 2 — Completar los datos de la lectura

Debes ingresar:

- **ID del dispositivo (deviceId)**: el identificador único del termohigrómetro que registraste. Debe ser un ID válido en formato UUID.
- **Temperatura**: el valor medido en grados Celsius. Puede ser negativo o positivo (rango aceptado por el sistema: -100 °C a 100 °C).
- **Humedad** (opcional): porcentaje de humedad relativa registrado, entre 0 % y 100 %.
- **Fecha y hora de la lectura (recordedAt)**: cuándo se tomó la medición, en formato de fecha y hora válido.

### Paso 3 — Enviar la lectura

Toca **"Guardar"** o **"Registrar"**. El sistema procesa la lectura y te confirma si se guardó correctamente.

---

## Flujo principal — Entender qué pasa después de registrar una lectura

El sistema evalúa automáticamente la temperatura contra el rango permitido:

### Si la temperatura está dentro del rango (2 °C a 8 °C)

- La lectura se guarda como **normal**.
- No se genera ninguna alarma.
- El panel **"Estado del Sistema"** continúa mostrando **"Entorno Estabilizado"**.

### Si la temperatura está fuera del rango (menor a 2 °C o mayor a 8 °C)

- El sistema marca la lectura como **desviación**.
- Genera automáticamente una **alarma** de tipo **"Excursión Térmica"**.
- La alarma aparece en la lista de trazabilidad activa con el valor reportado y la nota: *"Excursión térmica sistémica (Fuera de rango 2-8°C). Valor reportado: X°C. Requiere investigación inmediata."*
- El contador de desviaciones abiertas aumenta en la zona de **Estado del Sistema**.

---

## Flujo principal — Gestionar una alarma (Calidad)

### Paso 1 — Ver las alarmas activas

En el panel **"Búsqueda y Trazabilidad Activa"** verás la lista de alarmas. Cada una muestra:

- El estado actual de la alarma.
- La fecha y hora en que se generó.
- El nombre del termohigrómetro que la generó.
- La ubicación del dispositivo.
- La temperatura de la excursión en °C (en rojo).

Si no hay alarmas, verás el mensaje: *"Los termohigrómetros no reportan excursiones recientes (Rango 2-8°C)."*

### Paso 2 — Tocar "Gestionar CAPA" en la alarma

Para cada alarma en la lista, toca el botón **"Gestionar CAPA"**. Se expandirá un panel con pasos para investigar la causa raíz de la desviación.

### Paso 3 — Transicionar el estado de la alarma

Dentro del panel expandido, podrás cambiar el estado de la alarma. Los estados permitidos son:

| Estado | Cuándo usarlo |
|---|---|
| **acknowledged** | Cuando Calidad reconoce la alarma y comienza la investigación |
| **resolved** | Cuando se identifica la causa y se aplica la corrección |
| **closed** | Cuando se cierra formalmente la desviación con todas las acciones completas |

> El sistema impide saltos de estado inválidos. Por ejemplo, no puedes cerrar una alarma sin antes haberla reconocido.

### Paso 4 — Agregar notas de justificación

Al cambiar el estado, puedes agregar un comentario explicando:
- Qué encontraste en la investigación.
- Qué acción correctiva aplicaste.
- Por qué cierras o resuelves la alarma.

Estas notas quedan registradas en la trazabilidad.

---

## Flujo principal — Consultar el estado de las alarmas (Gerencia)

### Paso 1 — Ingresar al submódulo

Gerencia puede ver el listado de alarmas pero no modificarlas.

### Paso 2 — Revisar las alarmas abiertas

Observa el contador de desviaciones y revisa las tarjetas de alarma. Puedes identificar rápidamente:
- Qué dispositivo generó la alarma.
- En qué ubicación está instalado.
- Qué tan grave fue la excursión (valor de temperatura).

### Paso 3 — Derivar a Calidad

Si ves una alarma que requiere atención urgente, comunícate con el área de Calidad para que la gestione. Gerencia no tiene botones para cambiar estados.

---

## Flujo principal — Refrescar la información

### Paso 1 — Tocar "Refrescar"

En la parte superior de la lista de alarmas, toca el botón **"Refrescar"**. El sistema consulta nuevamente el estado de las alarmas y actualiza la pantalla.

Esto es útil cuando varias personas trabajan al mismo tiempo y necesitas ver los cambios en tiempo real.

---

## Preguntas frecuentes

**[Registré una temperatura fuera de rango por error]**

Si te equivocaste al escribir el valor, registra una nueva lectura correcta. La alarma generada por la lectura errónea deberá ser gestionada por Calidad (reconocida y cerrada con la justificación correspondiente).

**[La alarma no desaparece después de cerrarla]**

Después de cerrar una alarma, usa el botón **"Refrescar"** para actualizar la lista. Si sigue apareciendo, contacta a TI.

**[No veo el botón "Gestionar CAPA"]**

Ese botón solo está disponible para usuarios con rol `calidad`. Si tienes otro rol (servicio técnico, operaciones o gerencia), solo podrás consultar las alarmas, no modificarlas.

**[El sistema dice que el deviceId no es válido]**

El identificador del termohigrómetro debe ser un UUID válido. Verifica que estés copiando el ID completo y sin espacios. Si el problema persiste, contacta a Calidad o TI para confirmar el ID del dispositivo.

**[Qué significa "Excursión Térmica"]**

Es el término técnico para una desviación de temperatura fuera de los límites permitidos. En este módulo, significa que un producto o ambiente sensible estuvo expuesto a una temperatura no segura y requiere investigación.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar una lectura de temperatura | Completa el formulario con deviceId, temperatura, humedad y fecha |
| Saber si una temperatura es segura | Verifica que esté entre 2 °C y 8 °C |
| Ver alarmas activas | Revisa la lista en "Búsqueda y Trazabilidad Activa" |
| Gestionar una alarma (Calidad) | Toca "Gestionar CAPA" → cambia el estado (acknowledged / resolved / closed) |
| Actualizar la lista de alarmas | Toca "Refrescar" |
