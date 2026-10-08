# Guía de uso — Calidad (GXP / ISO 9001)

> **Para quién es esta guía:** Personal del área de Calidad, jefe de Calidad, servicio técnico, operaciones y gerencia que participa en los procesos de control de calidad normados GXP.

---

## ¿Para qué sirve este módulo?

Este módulo centraliza todos los procesos de **control de calidad** de la empresa bajo la normativa **GXP (Good Practice)** y **ISO 9001**. No es un sistema único, sino un conjunto de **17 submódulos especializados** (identificados como CA-01-01 a CA-01-17) que cubren desde el control de temperatura de equipos hasta la gestión de incidentes, pasando por limpieza de áreas, auditorías, CAPA y más.

Cada submódulo sigue el mismo patrón operativo: un operador registra un evento o lectura, el sistema evalúa si hay desviaciones, y el responsable de calidad toma acciones correctivas o de cierre, siempre con trazabilidad completa.

El objetivo es que cualquier desviación, evento o proceso de calidad quede registrado, evaluado y documentado para cumplir con auditorías internas y externas.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad / jefe de calidad | Acceso completo a todos los submódulos |
| Gerencia | Consultar alarmas, logs y reportes de calidad |
| Servicio técnico | Registrar lecturas, limpiezas y participa en procesos técnicos |
| Operaciones | Registrar lecturas y limpiezas en áreas operativas |

> El acceso se controla por submódulo: algunos están habilitados para roles adicionales como `servicio_tecnico` y `operaciones`, mientras que las transiciones de estado críticas están reservadas exclusivamente a `calidad`.

---

## Pantalla principal — Dashboard de Calidad

Al ingresar a **"Calidad"** en el menú principal, verás el panel central con **17 tarjetas organizadas en una cuadrícula**, cada una representando un proceso GXP:

| Tarjeta | Proceso |
|---|---|
| **Temperatura** | Control de termohigrómetros y cadenas térmicas |
| **Limpieza** | Limpieza de áreas |
| **Buenas Prácticas** | Buenas prácticas GXP |
| **Control de Plagas** | Control de plagas |
| **Documentos** | Gestión documental |
| **Recall** | Retiro del mercado |
| **Quejas** | Quejas y reclamos |
| **Refrigerados** | Plan de contingencia refrigerados |
| **CAPA** | Acciones correctivas y preventivas |
| **Riesgos** | Gestión de riesgos |
| **Incidentes** | Incidentes y derrames |
| **Higiene** | Prácticas de higiene del personal |
| **Comunicaciones** | Comunicaciones internas |
| **Áreas Calificadas** | Calificación de áreas |
| **Auditorías** | Auditorías internas |
| **Muestreo** | Muestreo y aprobación |
| **Tecnovigilancia** | Tecnovigilancia |

### ¿Cómo funciona el dashboard?

Cada tarjeta muestra:
- Un **ícono** representativo del proceso.
- El **título** del submódulo.
- Un **subtítulo** descriptivo.

Al tocar cualquier tarjeta, el sistema te lleva al **workspace específico** de ese proceso.

> **Nota:** Si no tienes permisos para acceder a un submódulo, el sistema no te permitirá entrar.

---

## Flujo principal — Patrón común de todos los submódulos

Aunque cada submódulo tiene sus particularidades, todos comparten una estructura lógica similar:

### Paso 1 — Registrar un evento o lectura

Dependiendo del submódulo, el operador registra:
- Una **lectura de temperatura** (CA-01-01).
- Una **actividad de limpieza** (CA-01-02).
- Una **no conformidad o hallazgo** (CA-01-03, CA-01-09, etc.).
- Un **incidente o derrame** (CA-01-11).
- Una **queja de cliente** (CA-01-07).

Generalmente, el operador completa un formulario con los datos del evento y lo envía.

### Paso 2 — Evaluación automática o manual

El sistema puede:
- **Detectar automáticamente desviaciones**: por ejemplo, si una temperatura está fuera del rango permitido (como en CA-01-01, donde el rango válido es de 2 °C a 8 °C), el sistema genera una **alarma** sin intervención humana.
- **Quedar pendiente de revisión**: en otros casos, el registro ingresa en estado "pendiente" o "borrador" hasta que Calidad lo evalúa.

### Paso 3 — Gestión del estado (state machine)

Cada submódulo usa una **máquina de estados** para controlar las transiciones permitidas. Esto significa que no puedes saltar pasos: el registro debe seguir un flujo ordenado, por ejemplo:

- **Borrador** → **Activo** → **En revisión** → **Cerrado** o **Escalado**.

Solo Calidad puede cambiar los estados críticos (por ejemplo, cerrar una alarma, verificar una limpieza, resolver un incidente).

### Paso 4 — Acciones correctivas o de cierre

Cuando se detecta una desviación, Calidad puede:
- **Escalar** el caso a gerencia o a un proceso mayor (por ejemplo, abrir un CAPA en CA-01-09).
- **Cerrar** el caso con notas de justificación.
- **Generar documentos** de firma digital para dejar trazabilidad.

---

## Flujo principal — Navegar por los submódulos

### Paso 1 — Acceder al dashboard de Calidad

Ve a **"Calidad"** en el menú principal del sistema.

### Paso 2 — Elegir el submódulo

Toca la tarjeta del proceso que necesitas revisar. Por ejemplo:
- Si necesitas revisar temperaturas de cadena de frío → **"Temperatura"**.
- Si necesitas registrar la limpieza de una sala → **"Limpieza"**.
- Si hay un incidente de derrame → **"Incidentes"**.

### Paso 3 — Realizar la acción dentro del workspace

Cada workspace tiene su propia interfaz adaptada al proceso:
- Lista de alarmas activas o pendientes.
- Formularios de registro.
- Paneles de métricas y estado.
- Botones de transición de estado.

---

## Submódulos — Detalle rápido

### CA-01-01 | Control de Temperatura

Controla termohigrómetros y cadenas térmicas. Los operadores registran lecturas de temperatura y humedad. Si el valor está fuera del rango de **2 °C a 8 °C**, el sistema genera automáticamente una alarma. Calidad revisa las alarmas activas y las gestiona (reconoce, resuelve o cierra) con notas de justificación.

---

### CA-01-02 | Limpieza de Áreas

Registra las actividades de limpieza por área. Permite crear áreas con nivel de riesgo (alto, medio, bajo, estéril) y frecuencia requerida. Los operadores registran la limpieza indicando el tipo (rutinaria, profunda, recuperación de derrame) y el agente de limpieza usado. Calidad verifica y cierra los registros.

---

### CA-01-03 | Buenas Prácticas GXP

Gestiona el cumplimiento de buenas prácticas de fabricación y gestión. Similar al patrón general: registro de eventos, evaluación y cierre con trazabilidad.

---

### CA-01-04 | Control de Plagas

Registra el control de plagas en las instalaciones. **Importante:** actualmente el backend de este submódulo no está registrado en las rutas generales del sistema, por lo que el frontend existe pero el flujo completo puede no estar operativo. Contacta a TI si necesitas usarlo.

---

### CA-01-05 a CA-01-17

El resto de los submódulos (**Documentos, Recall, Quejas, Refrigerados, CAPA, Riesgos, Incidentes, Higiene, Comunicaciones, Áreas Calificadas, Auditorías, Muestreo, Tecnovigilancia**) siguen el mismo patrón estructural:
- Formulario de registro específico del proceso.
- Lista de pendientes o activos.
- Transiciones de estado gestionadas por Calidad.
- Posible generación de documentos con firma digital.

---

## ¿Qué significa cada estado?

Aunque cada submódulo puede tener estados próprios, los más comunes son:

| Estado | Qué significa |
|---|---|
| **Pendiente / Borrador** | El registro se creó pero no fue revisado |
| **Activo / En proceso** | Está en curso de evaluación o tratamiento |
| **Verificado** | Calidad revisó y validó el registro |
| **Resuelto / Cerrado** | La desviación o evento fue tratado y cerrado |
| **Escalado** | Se elevó a un nivel superior (gerencia, CAPA, etc.) |

---

## Preguntas frecuentes

**[No veo un submódulo en el dashboard]**

Verifica que tu rol tenga acceso. Solo roles de Calidad (`calidad`, `jefe_calidad`) y roles extendidos pueden ver los submódulos. Si crees que deberías tener acceso, solicita a TI.

**[El submódulo de Control de Plagas no me carga]**

CA-01-04 tiene el backend pendiente de registro en las rutas generales. Actualmente el frontend existe pero el flujo puede no estar operativo. Consulta a TI o usa el canal de soporte para verificar su estado.

**[Una alarma de temperatura se generó pero no sé por qué]**

Revisa la lectura asociada: si la temperatura está fuera del rango de 2 °C a 8 °C, el sistema genera la alarma automáticamente. Compara con el valor reportado por el termohigrómetro para confirmar.

**[Puedo cerrar cualquier registro de calidad]**

No. Solo Calidad puede ejecutar las transiciones de estado críticas. Los operadores de servicio técnico u operaciones pueden registrar lecturas o limpiezas, pero no verificar ni cerrar casos.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver todos los procesos de calidad | Ve a "Calidad" en el menú |
| Revisar alarmas de temperatura | Toca "Temperatura" en el dashboard |
| Registrar una limpieza de área | Toca "Limpieza" → completa el formulario |
| Gestionar un incidente | Toca "Incidentes" → busca el caso |
| Cerrar o validar un registro | Abre el caso → usa los botones de transición |
| Generar documentación de calidad | Según el submódulo, busca "Generar documento" o "Firma" |
