# Guía de uso — Seguridad Operacional

> **Para quién es esta guía:** Personal de tecnología (TI) encargado de monitorear accesos sospechosos, revisar accesos fuera de horario y gestionar la seguridad del sistema.

---

## ¿Para qué sirve este módulo?

Este módulo funciona como un detector de anomalías de acceso. El sistema registra automáticamente cada vez que alguien ingresa fuera del horario laboral habitual y te permite revisar esos eventos. Además, incluye herramientas básicas para evaluar la seguridad: revisión de IPs permitidas, historial de accesos sospechosos y detección de actividad inusual.

Su objetivo es que TI pueda enterarse de inmediato si hay accesos que se salen de la rutina normal, sin tener que revisar logs manualmente.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| TI / jefe de TI | Ver lista de accesos fuera de horario, revisar el detalle de cada evento, marcarlo como revisado |
| Desarrollador | Ver accesos fuera de horario (según configuración) |
| Soporte | Ver accesos fuera de horario (según configuración) |
| Gerencia general | Ver reportes de seguridad (si está habilitado) |

> Solo TI tiene acceso a este módulo. Otros roles no pueden ingresar.

---

## Pantalla principal

La pantalla principal muestra una **lista de eventos de acceso fuera de horario**. Cada fila representa un intento de ingreso que el sistema detectó como sospechoso.

### ¿Qué significa cada estado?

| Lo que ves | Qué significa |
|---|---|
| **Pendiente / Sin revisar** | El evento fue detectado y todavía nadie de TI lo ha revisado. |
| **Revisado** | Un miembro de TI ya analizó el evento y lo marcó como atendido. |
| **Prioridad alta** | El acceso se realizó en un horario muy inusual o desde una IP desconocida. |

---

## Flujo principal — Revisar un acceso fuera de horario

### Paso 1 — Ingresar al módulo

Ve al área de **TI** del sistema y busca la sección **"Seguridad"** o **"Accesos fuera de horario"**.

### Paso 2 — Ver la lista de eventos

El sistema muestra todos los accesos detectados en los últimos días. Cada uno incluye:

- **Fecha y hora** exactas del acceso.
- **Nombre del usuario** que ingresó.
- **Dirección IP** desde la que se conectó.
- **Estado**: pendiente o revisado.

### Paso 3 — Tocar un evento para ver el detalle

Selecciona el acceso que te llame la atención. Se abrirá una pantalla con el **timeline completo** del evento, que incluye:

- Antecedentes: qué actividad tuvo ese usuario en horas previas.
- Contexto: si hubo otros accesos cercanos en el tiempo.
- Origen: desde qué IP y dispositivo se conectó.

### Paso 4 — Evaluar

Pregúntate:

- ¿Es un horario normal para ese colaborador? (ejemplo: ¿suele trabajar de noche?)
- ¿Reconoce la IP? (¿es la oficina, su casa, un lugar conocido?)
- ¿Hay más de un acceso sospechoso seguido?

### Paso 5 — Marcar como revisado

Si ya entendiste el evento y no representa un riesgo, toca el botón **"Marcar como revisado"** o **"Confirmar revisión"**. El evento pasa a estado **Revisado** y deja de aparecer como pendiente.

---

## Flujo principal — Filtrar accesos

### Paso 1 — Aplicar filtros

Usa los filtros disponibles para reducir la lista:

- **Por estado**: ver solo pendientes o solo revisados.
- **Por usuario**: escribir un nombre para buscar accesos de esa persona.
- **Por fecha**: elegir un rango de días específico.

### Paso 2 — Analizar

Concéntrate primero en los accesos **pendientes** y de **prioridad alta**.

---

## Flujo principal — Exportar el historial

Si necesitas llevar el listado a un informe o compartirlo:

### Paso 1 — Tocar "Exportar"

Busca el botón **"Exportar"** o **"Descargar CSV"** en la parte superior de la lista.

### Paso 2 — Guardar el archivo

El navegador descargará un archivo con todas las columnas: fecha, usuario, IP, estado, etc.

---

## ¿Por qué el sistema detecta ciertos accesos como sospechosos?

El sistema calcula qué horario es laboral para cada usuario. Si alguien entra en un horario muy diferente (por ejemplo, a las 2 de la madrugada en un día hábil), el sistema lo marca automáticamente como "fuera de horario". También considera los feriados nacionales de Ecuador para no generar falsas alarmas en días libres.

> **Precisión:** Un acceso no es necesariamente un problema; puede ser un colaborador haciendo horas extras, un viaje de trabajo o una situación justificada. Por eso es importante revisar cada caso antes de concluir.

---

## Flujo principal — Revisar la lista de IPs permitidas (whitelist)

### Paso 1 — Acceder a la sección de IPs

En el área de seguridad, busca la opción **"Whitelist"** o **"IPs permitidas"**.

### Paso 2 — Ver las IPs registradas

Verás una lista de direcciones IP que el sistema reconoce como seguras (por ejemplo, la oficina, redes corporativas).

### Paso 3 — Agregar o eliminar IPs

Si necesitas agregar una nueva red (por ejemplo, una sucursal nueva):

1. Toca **"Agregar IP"** o **"Nueva"**.
2. Escribe la dirección IP o rango.
3. Guarda.

Si una IP ya no debe estar permitida, selecciónala y toca **"Eliminar"**.

---

## Preguntas frecuentes

**[Un acceso fuera de horario me preocupa]**

Sigue los pasos de revisión. Si confirmas que no corresponde a la persona, contacta al usuario para averiguar si alguien más usó su cuenta, y notifica a TI para bloquear accesos no autorizados.

**[Recibo demasiadas alertas]**

Puede ser que tu equipo tenga horarios variables o trabaje fuera de hora regularmente. En ese caso, coordina con TI para ajustar los horarios laborales de cada usuario en el sistema.

**[El sistema marcó un feriado como día hábil]**

El módulo incluye el calendario de feriados de Ecuador. Si falta un feriado, avisa a TI para agregarlo.

**[No veo el módulo de seguridad]**

Solo los roles de TI pueden ver este módulo. Si crees que deberías tener acceso, solicita a gerencia o TI que revisen tu rol.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver accesos sospechosos | Ingresa a Seguridad del área TI |
| Revisar el detalle de un evento | Toca el evento en la lista y explora el timeline |
| Marcar algo como revisado | Toca "Marcar como revisado" |
| Filtrar por usuario o fecha | Usa los filtros superiores |
| Exportar el historial | Toca "Exportar" |
| Gestionar IPs permitidas | Busca "Whitelist" o "IPs permitidas" |
