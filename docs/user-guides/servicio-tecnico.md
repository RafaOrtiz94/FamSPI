# Guía de uso — Servicio Técnico

> **Para quién es esta guía:** Técnicos, jefes de técnicos, jefes de servicio técnico, operaciones, comercial, TI y gerencia que gestiona mantenimientos, capacitaciones, equipos, retiros, casos correctivos y casos externos.

---

## ¿Para qué sirve este módulo?

Este módulo es el **centro de operaciones del área técnica**. Gestiona todo el ciclo de vida de los equipos, las capacitaciones del personal técnico, los mantenimientos preventivos y correctivos, los retiros de equipos del parque instalado, los casos correctivos por fallas en cliente y la integración con sistemas externos (por ejemplo, Odoo).

No es un registro simple de equipos: es un **workflow técnico completo** con:
- Generación automática de documentos PDF (formatos FST-06, FST-08, FST-11, etc.).
- Flujos de entrenamiento con control de asistencia, evaluación y certificación.
- Seguimiento de disponibilidad del equipo técnico.
- Casos correctivos con timeline, evidencias y acciones correctivas.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso principal |
|---|---|
| `tecnico` | Ver sus asignaciones, registrar asistencia, entrenamientos |
| `jefe_tecnico` | Gestionar solicitudes, mantenimientos, capacitaciones, retiros, casos correctivos |
| `jefe_servicio_tecnico` | Visión amplia del servicio |
| `servicio_tecnico` | Acceso general al módulo técnico |
| `comercial`, `acp_comercial`, `jefe_comercial` | Ver solicitudes y casos externos |
| `operaciones`, `jefe_operaciones`, `jefe_logistica` | Disponibilidad y retiros |
| `ti`, `jefe_ti`, `admin_ti` | Casos correctivos (lectura/escritura) |
| `gerencia`, `gerencia_general` | Acceso completo |

---

## Pantalla principal — Dashboard de Servicio Técnico

Al ingresar a **"Servicio Técnico"** en el menú, verás el panel principal con dos vistas principales:

### 1. Vista de Jefe / Gerencia

Muestra la foto completa del servicio:
- **Estadísticas**:
  - Mantenimientos pendientes.
  - Técnicos activos (disponibles).
  - Alertas.
  - Cumplimiento (%).
  - Mis pendientes (si aplica).
- **Solicitudes abiertas**: lista de solicitudes técnicas en curso.
- **Disponibilidad del equipo**: técnicos disponibles, en servicio o ausentes.

### 2. Vista de Técnico

Muestra el estado personal del técnico:
- Sus mantenimientos pendientes.
- Su disponibilidad (puede cambiarla).
- Sus solicitudes asignadas.

---

## Flujos principales

### Flujo A — Mantenimientos

Los mantenimientos se gestionan en este módulo y también en `mantenimientos` (otro submódulo).

**Acciones típicas:**
1. Revisar la lista de mantenimientos pendientes.
2. Ver el detalle del mantenimiento (equipo, tipo, responsable).
3. Actualizar el estado (pendiente → en curso → completado).
4. Registrar cierre con observaciones o evidencias.

> Si necesitas gestionar mantenimientos anuales, usa `/dashboard/servicio-tecnico/mantenimientos` o la sección correspondiente.

---

### Flujo B — Capacitaciones y Entrenamiento (Workflow FST)

Es uno de los sub-flujos más completos del sistema. Incluye PDFs y certificación.

**Pasos:**
1. El técnico o Calidad registra el workflow de entrenamiento.
2. El sistema genera PDFs de:
   - Coordinación de entrenamiento.
   - Lista de asistencia.
   - Evaluación.
3. Se evalúa al personal capacitado.
4. Se emite el **certificado** de entrenamiento.
5. Se registra la entrega del certificado.

**Acciones típicas:**
- Consultar el estado del workflow de entrenamiento.
- Descargar los documentos PDF generados automáticamente.
- Marcar asistencia.
- Cargar resultado de evaluación.
- Emitir y entregar certificado.

---

### Flujo C — Retiro de Equipos (Withdrawal)

Gestiona el retiro de equipos del parque instalado.

**Pasos:**
1. Se inicia el workflow de retiro.
2. El sistema genera el acta de retiro **FST-11** (documento PDF).
3. Se completa el retiro físico del equipo.
4. Se registra el estado final del retiro.

**Acciones típicas:**
- Ver listado de retiros activos.
- Iniciar un nuevo retiro.
- Generar FST-11 en PDF.
- Actualizar el estado del retiro.

---

### Flujo D — Casos Correctivos (ST-01-03)

Se usa cuando un equipo instalado en cliente presenta una falla.

**Pasos:**
1. Se crea el **caso correctivo** con la falla reportada.
2. Técnico registra el detalle de la falla, área afectada y prioridad.
3. Se registran **acciones correctivas** (qué se hizo para resolverlo).
4. Se adjuntan **evidencias** (fotos, documentos, firmas).
5. El caso se cierra cuando la falla está resuelta y documentada.

**Acciones típicas:**
- Crear un caso correctivo.
- Ver el timeline del caso.
- Agregar comentarios.
- Registrar acciones correctivas.
- Subir evidencias.
- Ver KPIs del workspace (cantidad de casos abiertos, tiempo de resolución, etc.).

---

### Flujo E — Workflow de Documentos

El sistema registra y trackeda documentos generados dentro de los workflows de servicio técnico.

**Acciones típicas:**
- Consultar el catálogo de documentos de workflow.
- Ver el resumen de documentos por workflow.
- Consultar el timeline de documentos.
- Registrar un workflow activo.

---

### Flujo F — Casos Externos

Integración con sistemas externos (por ejemplo, Odoo). Gestiona casos que provienen de fuentes externas a la empresa.

**Acciones típicas:**
- Ver casos externos recibidos.
- Sincronizar con el sistema externo.
- Actualizar estado.

---

### Flujo G — Solicitudes Técnicas

Los técnicos y jefes pueden ver y gestionar solicitudes de servicio.

**Acciones típicas:**
- Ver solicitudes abiertas.
- Asignar técnico responsable.
- Derivar entre departamentos (técnico, Calidad, comercial).
- Cerrar solicitud.

---

## Preguntas frecuentes

**[No veo un mantenimiento en mi lista]**

Los mantenimientos pueden estar asignados a otro técnico o en un estado diferente. Usa los filtros de la pantalla para buscar por equipo o por estado.

**[El PDF del entrenamiento o retiro no se genera]**

Verifica que el workflow esté en el estado correcto para generar el documento. Algunos PDFs solo se generan después de completar etapas específicas (por ejemplo, la lista de asistencia después de registrar participantes).

**[Cómo cambio mi estado de disponibilidad]**

En el dashboard, usa el control de disponibilidad (disponible / ocupado / ausente). Esto ayuda a que el sistema distribuya las solicitudes de forma equitativa.

**[Un caso correctivo no tiene acciones asociadas]**

Crea las acciones correctivas desde el detalle del caso. Sin acciones registradas, el caso no se puede cerrar.

**[Los casos externos no se actualizan]**

Los casos externos dependen de la sincronización con el sistema origen (por ejemplo, Odoo). Si no se actualizan, verifica la salud de la integración en el panel correspondiente.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver mis mantenimientos pendientes | Ve a "Servicio Técnico" → dashboard |
| Gestionar una capacitación | Accede a la sección de entrenamiento o capacitaciones |
| Generar el acta de retiro | Ve a "Retiros" → inicia o edita el retiro → genera FST-11 |
| Abrir un caso correctivo | Ve a "Casos correctivos" → crea el caso |
| Ver casos externos | Ve a "Casos externos" |
| Cambiar mi disponibilidad | Usa el control de disponibilidad en el dashboard |
