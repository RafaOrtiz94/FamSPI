# Guía de uso — Registro de Asistencia

Esta guía está escrita para dos perfiles:

- **Colaborador** — la persona que marca su entrada, almuerzo y salida cada día.
- **Supervisor / RRHH** — la persona que consulta reportes y descarga documentos oficiales.

---

## Parte 1 — Para el colaborador: cómo registrar tu asistencia

### ¿Qué necesito antes de empezar?

- Tener sesión iniciada en el sistema.
- Permitir que el navegador o la app acceda a tu **ubicación GPS**. Sin esto, ninguna marcación funciona — es obligatorio.
- Buena señal de internet en el momento de marcar.

> Cuando el sistema está buscando tu ubicación verás un ícono de pin que parpadea y el mensaje "Obteniendo ubicación". Espera unos segundos sin cerrar la pantalla.

---

### Orden de marcaciones durante el día

El sistema espera que sigas este orden. Si lo rompes (por ejemplo, intentas marcar la salida sin haber marcado la entrada) el sistema te lo indicará con un mensaje de error.

```
1. Entrada a la jornada
2. Salida a almuerzo         (cuando sales a almorzar)
3. Regreso de almuerzo       (cuando vuelves del almuerzo)
4. Salida final              (al terminar tu jornada)
```

Cada marcación registra automáticamente la hora y tu ubicación GPS en ese momento.

---

### Marcaciones especiales — cuando saliste de la oficina

El sistema contempla varios tipos de salida fuera de la jornada normal. Estas son las más comunes:

#### Salida inesperada (imprevista)
Cuando tienes que salir antes de terminar la jornada por algo que no estaba planeado (permiso personal, cita médica, emergencia, etc.).

- Usa **"Salida inesperada"**
- Cuando vuelves, usa **"Regreso inesperado"**

#### Salida operacional (de oficina o campo)
Cuando vas a una reunión, visita técnica, trámite u otro asunto de trabajo durante la jornada pero vas a regresar.

- Usa **"Salida oficina / viaje"** o **"Salida de campo"** según corresponda.
- Cuando regresas, usa **"Entrada oficina / viaje"** o **"Entrada de campo"**.

#### Visita a un cliente
Si vas a visitar a un cliente específico:

1. Al llegar donde el cliente → **"Entrada cliente"**
2. Al salir de donde el cliente → **"Salida cliente"**

El sistema te pedirá seleccionar el cliente de una lista o escribir su nombre si no aparece. También puedes agregar observaciones sobre la visita.

---

### ¿Qué pasa después de marcar?

Cuando la marcación es exitosa verás una pantalla verde con el mensaje **"¡Listo!"** y te redirige automáticamente al panel principal después de unos segundos. Si quieres ir antes, haz clic en "Ir ahora".

Si algo falla, verás una pantalla roja con el detalle del problema. Puedes intentarlo de nuevo con el botón **"Reintentar"** o volver al panel con "Ir al Dashboard".

---

### Errores frecuentes y qué hacer

| Mensaje que ves | Qué significa | Qué hacer |
|---|---|---|
| "Obteniendo ubicación" por más de 15 segundos | El GPS no pudo capturar tu posición | Sal al aire libre, activa el GPS del dispositivo e intenta de nuevo |
| "No tienes una salida activa para cerrar" | Intentaste marcar un regreso sin haber marcado la salida previa | Verifica el orden de tus marcaciones del día |
| "La ruta solicitada no existe" | La acción en la URL no es válida | Vuelve al panel principal y usa los botones desde ahí |
| "Selecciona un cliente o escribe el nombre del prospecto" | Intentaste registrar visita cliente sin indicar a quién | Selecciona el cliente de la lista o escribe el nombre |

---

## Parte 2 — Para RRHH / Supervisor: cómo ver los reportes de asistencia

La pantalla de **Reportes de Asistencia** tiene dos modos. Elige el que necesites.

---

### Modo A — Reporte oficial RH-09 (PDF para entregar)

Este modo genera el documento oficial del colaborador en formato PDF. Se usa para:

- Entregar evidencia de asistencia a una institución.
- Guardar el registro mensual o anual del colaborador.

**Cómo usarlo:**

1. Selecciona las **fechas de inicio y fin** del período que quieres reportar.
2. En "Usuario", selecciona el **colaborador específico** (no puedes generar el PDF de "todos" a la vez).
3. Elige si el reporte es **Mensual** o **Anual** (12 meses).
   - Si es anual, escribe el año en el campo que aparece.
4. Haz clic en **"Descargar PDF"**.

El archivo se descarga a tu computadora. El PDF viene bloqueado (no se puede editar) y tiene un código de verificación SHA-256 al final para garantizar su autenticidad.

---

### Modo B — Consulta administrativa (para revisar y analizar)

Este modo muestra una tabla con los registros del período seleccionado. Sirve para revisar el estado diario de cada colaborador, detectar inconsistencias y analizar puntualidad.

**Cómo usarlo:**

1. Selecciona el **colaborador** o deja "Todos los usuarios" para ver a todos.
2. Elige el **período** usando las pestañas: Día, Semana, Mes o Año.
   - Haz clic en los botones rápidos **"Hoy"**, **"Esta semana"** o **"Este mes"** para ir directo al período más común.
3. Aplica filtros adicionales si los necesitas (ver tabla más abajo).
4. Haz clic en **"Consultar rango"** para cargar los datos.

---

### Filtros disponibles en la consulta administrativa

| Filtro | Para qué sirve |
|---|---|
| **Colaborador** | Ver solo un empleado específico o todos |
| **Departamento** | Filtrar por área de la empresa |
| **Estado** | Ver solo los que tienen jornada abierta, sin entrada, en almuerzo o jornada cerrada |
| **Solo discrepancias** | Ver únicamente registros que tienen algo inconsistente o irregular |
| **Solo geolocalización** | Ver solo los registros que tienen coordenadas GPS capturadas |

---

### Qué significan los estados de asistencia

| Estado | Qué quiere decir |
|---|---|
| **Sin entrada** | El colaborador no ha marcado ninguna acción en ese día |
| **Jornada abierta** | Ya marcó entrada pero aún no ha marcado la salida final |
| **Almuerzo abierto** | Marcó la salida a almuerzo pero no el regreso |
| **Jornada cerrada** | Marcó entrada y salida correctamente — día completo |

---

### Vista de mapa

Puedes cambiar la tabla por una vista de mapa haciendo clic en el botón de vista (tabla / mapa) que aparece en la barra de herramientas.

En el mapa verás puntos GPS de las marcaciones del día o del período seleccionado. Puedes filtrar el mapa a un día específico usando el calendario que aparece sobre el mapa.

---

### Perfil diario de un colaborador

Cuando estás en la tabla, puedes hacer clic sobre cualquier fila para abrir el **Perfil diario**. Ahí verás:

- **Radar operativo**: una puntuación del 0 al 100 que resume qué tan completo fue el registro del día (entrada, almuerzo, salida, con o sin GPS).
- **Timeline de jornada**: las horas exactas de entrada, salida a almuerzo, regreso de almuerzo y salida final, con el enlace al punto GPS en Google Maps si está disponible.
- **Marcaciones de campo**: si el colaborador realizó visitas a clientes o salidas operacionales, aquí se ven los eventos de ese tipo con sus horarios.
- **Comparativo semanal**: una vista de los 7 días de la semana del colaborador, mostrando si llegó a tiempo, tarde o no marcó.
- **Liga de puntualidad**: un ranking del período con todos los colaboradores, ordenados por puntualidad. Puedes ver la posición del colaborador seleccionado y la de sus compañeros.

---

### Consejos rápidos

- Si la consulta tarda mucho, el sistema te avisa cuando el rango supera 31 días. Es normal que tome más tiempo.
- El botón **"Limpiar"** en la barra de herramientas resetea todos los filtros al estado inicial.
- El PDF oficial y la consulta administrativa usan los mismos datos, pero el PDF es el documento formal y la consulta es solo para revisión interna.

---

*Guía generada el 27/04/2026 — Sistema FamSPI de gestión de asistencia.*
