# Guía de uso — Planificación de Visitas (Schedules)

> **Para quién es esta guía:** Asesores comerciales, analistas comerciales, backoffice comercial, jefes comerciales y gerencia que planifica, envía a aprobación y consulta cronogramas mensuales de visitas.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona la **planificación mensual de visitas comerciales**. Permite a los asesores construir su cronograma de visitas a clientes y prospectos, agregar detalles por visita, enviarlo a aprobación de su jefe y justificar desviaciones posteriormente.

Incluye:
- Creación y edición del cronograma mensual.
- Alta, modificación y baja de visitas.
- Envío a aprobación por parte del asesor.
- Aprobación / rechazo por jefes.
- Analíticas de cumplimiento.
- Exportación a calendario ICS.
- Optimización de rutas.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `comercial`, `asesor_comercial`, `analista_comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial` | Crear, editar, enviar a aprobación, agregar/editar/borrar visitas, justificar desviaciones |
| `jefe_comercial`, `jefe_de_comercial`, `gerencia`, `gerencia_general`, `admin`, `administrador` | Aprobar, rechazar, ver analíticas, ver equipo |

---

## Pantalla principal

Rutas frontend asociadas:
- `/dashboard/comercial/planificacion` → `PlanificacionMensual`.
- `/dashboard/comercial/aprobaciones-planificacion` → `AprobacionCronogramas`.

---

## Flujo principal — Crear un cronograma mensual

### Paso 1 — Acceder a Planificación Mensual

Ve al área Comercial → Planificación.

### Paso 2 — Crear el cronograma

Registra:
- Mes y año del cronograma.
- Asesor responsable.
- Objetivo o meta del mes.
- Cantidad de visitas previstas.

### Paso 3 — Agregar visitas

Por cada visita planificada, registra:
- Cliente o prospecto.
- Fecha y hora estimada.
- Dirección o zona.
- Tipo de visita (presencia, virtual, seguimiento).
- Notas previas.

### Paso 4 — Guardar

Queda el cronograma en estado borrador o en construcción.

---

## Flujo principal — Enviar a aprobación

### Paso 1 — Revisar el cronograma

Verifica que todas las visitas estén cargadas correctamente.

### Paso 2 — Enviar a aprobación

Toca **"Enviar a aprobación"**. El sistema notifica al jefe comercial para su revisión.

### Paso 3 — Esperar resolución

El asesor no puede modificar el cronograma mientras está en revisión (salvo que la regla de negocio lo permita).

---

## Flujo principal — Aprobar / rechazar (jefe)

### Paso 1 — Revisar pendientes

Accede a **Aprobación de Cronogramas**. Verás los cronogramas enviados por tus asesores.

### Paso 2 — Evaluar el plan

Revisa distribución de visitas, metas, congruencia comercial y cobertura de clientes.

### Paso 3 — Aprobar o rechazar

- **Aprobar**: el cronograma queda publicado y listo para ejecutarse.
- **Rechazar**: agrega observaciones. El asesor debe ajustar y volver a enviar.

---

## Flujo principal — Justificar desviaciones

### Paso 1 — Registrar desviación

Si una visita no se realizó o cambió de fecha después de la aprobación, el asesor accede a la visita y ejecuta **"Justificar"**.

### Paso 2 — Explicar el cambio

Agrega el motivo (cliente canceló, tráfico, reunión interna, etc.).

Queda trazada la variación para las analíticas.

---

## Flujo principal — Consultar analíticas

### Paso 1 — Acceder a analíticas (jefes/gerencia)

### Paso 2 — Interpretar las métricas

El panel muestra:
- Cantidad de visitas planificadas vs realizadas.
- Cumplimiento por asesor.
- Cobertura de clientes.
- Tendencias mensuales.

---

## Flujo principal — Exportar y sincronizar

### Exportar a ICS

Descarga el calendario en formato `.ics` para importarlo en Google Calendar, Outlook, etc.

### Optimizar ruta

Usa la herramienta de optimización de ruta para sugerir el orden más eficiente de visitas por zona.

---

## Preguntas frecuentes

**[No puedo editar el cronograma después de enviarlo a aprobación]**

El cronograma queda bloqueado para edición mientras está en revisión. Espera la resolución del jefe o usa la justificación para registrar cambios posteriores.

**[El jefe no ve mi cronograma en pendientes]**

Verifica que hayas ejecutado la acción de envío a aprobación. Un cronograma en borrador no aparece en la bandeja de aprobaciones.

**[Cómo sé si mi cronograma fue aprobado]**

Recibirás una notificación. También puedes consultar el estado en la pantalla de planificación.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear mi plan del mes | Ve a Planificación → crea el cronograma |
| Agregar o editar visitas | Dentro del cronograma, agrega visitas |
| Enviar a aprobación | Toca "Enviar a aprobación" |
| Aprobar o rechazar (jefe) | Ve a Aprobaciones → revisa → decide |
| Justificar una desviación | Toca "Justificar" en la visita afectada |
| Ver analíticas del equipo | Accede a Analíticas (jefes) |
| Sincronizar con mi calendario | Exporta el ICS |
