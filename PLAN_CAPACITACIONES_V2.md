
# Plan de Implementación: Módulo de Capacitaciones (Flujo Completo)

## Objetivo
Alinear el módulo de capacitaciones al flujo completo descrito por el usuario, con máxima precisión y sin suposiciones.

## DESCIRPCION 

flujo de capacitaciones, cualquier usuario del sistema puede crear capacitaciones asi que todos tendran el acceso mediante la barra de navegacion, cuando el usuario entre al apartado de capacitaciones aqui podra ver las capacitaciones en las que esta como participante, y las que tiene registradas o creadas del usuario que seria el capacitador o instructor y el estado de cada una, al crear una nueva capacitacion debe llenar ¿Qué tipo de actividad es?

Capacitación

Inducción

Charla

Reunión

¿Quién la dicta?

La dicta alguien de la empresa

El creador es el responsable. Todos firmarán digitalmente el registro.

Viene un instructor externo

El instructor externo firma en papel; los participantes lo firman digitalmente después.

Los colaboradores van a otro lugar

Se desplazan a capacitarse fuera. No requiere firma digital.

¿Cómo se llama? *

Ej. Taller de Seguridad Industrial

Área responsable

Ej. Producción, Administración, Ventas…

¿Cómo asisten los participantes?

Presencial

Virtual

Híbrida

¿Cuándo es? pero fecha, hora y duracion y en donde se va a realizar

cual es el objetivo y que material va a utilizar

en el segundo paso seleccionara los usuarios por grupos o todos o solo de uno en uno y crea la capacitacion agendando en el calendar de google, generando el enlace de meet de google y avisando a todos los asistentes toda la informacion por correo. ahora el siguiente paso sera posterior a la capacitacion en donde el creador debe marcar quien asistio y quien no asistio una vez que marca las asistencias y las inasistencias pasara al siguiente paso que sera poner las observaciones que se dieron en la reunion y las conclusiones el sisguiente paso realizara un  calculo del porcentaje de asistencia cuantos convocados cuantos asistieron el porcentaje de asistencia y el porcentaje de no asistencia en el sigiente paso se generara 2 actas la una con todos los asistentes y la otra llenando el mismo formato de docs con los inasistentes la de los inasistentes debera marcar unas observaciones distintas y unas conlusiones distintas la de los inasistentes, en el siguiente paso el creador, instructor debe firmar con famsign las dos actas y una vez que firma empieza dos workflow distintos uno para los asistentes y otra para los inasistentes. asi es como deberia funcionar haz el plan sin asumir nada y sin alucinar

## Fase 1: Configuración Base y Datos
1. **Migración de Base de Datos**:
   - Añadir campos en tabla `trainings`: `observaciones_inasistentes`, `conclusiones_inasistentes`, `meet_link`
   - Verificar que ya existan los campos de Google Calendar (`calendar_event_id`, `calendar_event_link`) de la migración `223_trainings_external_attendees.sql`

2. **Validar Integración Google Calendar**:
   - Asegurar que la función `createTrainingCalendarEvent` pueda generar enlaces de Google Meet
   - Asegurar que las invitaciones se envíen automáticamente a todos los asistentes
   - Validar que el link del evento se guarde en la capacitación

3. **Modificar `trainings.service.js`**:
   - Actualizar `createTraining` y `updateTraining` para aceptar y guardar `observaciones_inasistentes` y `conclusiones_inasistentes`
   - Actualizar `fetchTrainingById` para retornar estos nuevos campos

---

## Fase 2: Frontend - Creación y Edición de Capacitaciones
1. **Actualizar Modal de Creación**:
   - Añadir campos: `objetivo` (ya está), `material` (ya está)
   - Añadir selector de hora inicial y hora final en el formulario de creación
   - Validar que la creación del evento en Google Calendar genere el enlace de Meet

2. **Actualizar Página de Detalle**:
   - Agregar campos para `observaciones_inasistentes` y `conclusiones_inasistentes` en la etapa de contenido
   - Actualizar la etapa de "Estadísticas" para mostrar:
     - Cantidad de convocados
     - Cantidad de asistentes
     - Porcentaje de asistencia
     - Porcentaje de inasistencia
   - Asegurar que el contador regresivo y el link de Google Calendar estén visibles

---

## Fase 3: Generación de Actas y Workflows de Firma
1. **Modificar `trainings.drive.js`**:
   - Asegurar que al generar el acta de inasistentes se utilicen las `observaciones_inasistentes` y `conclusiones_inasistentes` en la plantilla, en lugar de las generales
   - Mantener el mismo formato y estructura para ambas actas

2. **Actualizar `trainings.service.js`**:
   - Modificar el flujo para que el creador/instructor firme primero las dos actas (asistentes e inasistentes)
   - Después de la firma del creador, iniciar los dos workflows de FamSign separados
   - Verificar que el estado de la capacitación se actualice correctamente

3. **Actualizar `signatureWorkflows.service.js`**:
   - Asegurar que se puedan crear dos workflows simultáneos para una misma capacitación
   - Mantener la trazabilidad entre workflows y capacitaciones

---

## Fase 4: Pruebas y Validación
1. **Pruebas de Base de Datos**:
   - Ejecutar migraciones y verificar que los campos se creen correctamente
   - Verificar que los registros de asistentes externos e internos se guarden y recuperen correctamente

2. **Pruebas de Integración**:
   - Probar la creación de capacitaciones con el evento en Google Calendar y enlace de Meet
   - Probar el envío de correos a los asistentes
   - Probar la generación de ambas actas
   - Probar los dos workflows de firma
   - Probar el cálculo de estadísticas

3. **Pruebas de Frontend**:
   - Validar el flujo completo desde la creación hasta el final de los workflows
   - Verificar que todos los campos se muestren y editen correctamente
   - Verificar que el contador regresivo funcione
   - Verificar que el link de Google Calendar y Meet se muestren

---

## Notas Importantes
- No modificar el contrato `{ ok: true/false }` existente
- Mantener la compatibilidad con el código ya implementado
- No asumir nada, basarse solo en el flujo descrito y el código existente
- Mantener la estructura de rutas y middlewares actuales
