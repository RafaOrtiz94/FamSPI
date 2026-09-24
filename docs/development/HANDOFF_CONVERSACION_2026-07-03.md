# Handoff Tecnico - Conversacion acumulada al 2026-07-03

## Objetivo de este documento
Este archivo resume el estado tecnico de lo trabajado en esta conversacion para retomar sin reconstruir todo el contexto. Se prioriza:

- que cambios ya quedaron implementados o ajustados
- que modulos fueron intervenidos
- que decisiones funcionales quedaron definidas
- que puntos siguen pendientes o requieren validacion final
- que pruebas end to end conviene repetir

Cuando exista duda, la fuente de verdad sigue siendo:

1. `backend/src/modules/<modulo>/CONTEXT.md`
2. codigo real
3. Neon PostgreSQL

## Estado general
Durante esta conversacion se trabajaron y/o alinearon principalmente estos frentes:

- permisos y vacaciones para roles externos especiales
- viaticos y salidas operacionales
- asistencia y regularizaciones
- cronograma comercial, aprobaciones y enlace con CRM-FAM
- UI responsive y coherencia visual segun `DESIGN.md`
- ajustes puntuales en talento humano, navegacion y planeacion comercial
- limpieza de datos de prueba y correcciones operativas en base

No todo el trabajo de esta conversacion esta necesariamente desplegado en produccion al momento de este handoff. Hay cambios ya aplicados en base y cambios aun pendientes de verificacion final en Cloud Run.

## Modulos intervenidos o revisados
- `attendance`
- `viaticos`
- `permisos`
- `vacaciones`
- `schedules`
- `crm-fam`
- `clients`
- `talento_humano` / workspace talento
- `notifications`
- `calendar`
- `support-tickets`
- `capacitaciones`
- `consumable-files`

## Lineamientos funcionales ya definidos en la conversacion

### 1. Permisos y vacaciones para roles `ing_servicio_ext` y `esp_app_ext`
Se definio un flujo especial solo para esos roles, sin afectar a los demas:

- al crear nueva solicitud deben elegir `Permisos` o `Vacaciones`
- para cualquier tipo de permiso y tambien vacaciones, primero deben subir evidencia de coordinacion externa
- esa evidencia habilita fecha, hora inicio, duracion y demas campos
- no aplica aprobacion de jefe inmediato
- al confirmar debe generarse documento/acta automaticamente
- debe notificarse la ausencia y registrarse en calendario
- `talento_humano` conserva visibilidad y capacidad de cancelar si corresponde

### 2. Viaticos y salidas operacionales
Se aterrizo el flujo objetivo del workspace de viaticos:

- el expediente nace desde una salida operacional registrada en asistencia
- el colaborador clasifica la salida como `dentro del area` o `fuera del area`
- `dentro del area`: queda visible en seccion separada del workspace de viaticos y no entra al flujo de reembolso
- `fuera del area`: habilita proceso de carga de gastos o acumulacion para cierre del mes
- el colaborador puede procesar manualmente o agrupar salidas pendientes del mes
- existen subexpedientes separados segun clasificacion economica:
  - gastos con tarjeta -> flujo financiero
  - gastos sin tarjeta -> flujo talento humano
- estados definidos del expediente/subexpediente:
  - `borrador`
  - `enviado`
  - `en revision`
  - `aprobado/rechazado`
  - `liquidado`
- al rechazar vuelve a `borrador` con observacion e historial
- el padre general conserva trazabilidad e historial
- resultado economico final del flujo:
  - valor adicional a pagar al colaborador
  - saldo en cero
  - valor a devolver por el colaborador
- anticipos:
  - los solicita el colaborador
  - los registra finanzas
  - deben tener evidencia
  - al liquidar recien se consideran pagados/descontados
- vencimiento:
  - el llenado puede hacerse hasta el ultimo dia calendario del mes
  - tiene gracia fija de 7 dias del mes siguiente
  - pasado eso queda anulado para viaticos pero visible

Tambien se definio la informacion obligatoria visible para talento humano, finanzas y dueño del expediente:

- fecha
- hora de salida
- hora de retorno
- motivo
- destino
- si uso vehiculo personal
- km inicial
- km final
- fotos de kilometraje
- total de kilometros recorridos

### 3. Asistencia y salidas operacionales
Quedaron varios ajustes funcionales definidos:

- la salida operacional debe contemplar flujo general para visitas a clientes y tambien gestiones de oficina
- las salidas inesperadas deben desaparecer de UI donde correspondan
- para usuarios generales y personal de campo autorizado debe respetarse su vista diferenciada
- la marcacion operacional debe contemplar:
  - salida de oficina
  - llegada/entrada a destino
  - salida del destino
  - llegada a oficina
- se pidio consolidar `llegada a destino` + `entrada al cliente` en una sola marcacion
- el sistema no debe disparar salida a almuerzo automatica antes de las 14:00 solo por haber retornado de una salida operacional antes de esa hora
- se pidio permitir marcaciones operacionales opcionales de almuerzo, sin romper la regularizacion normal
- en asistencia por expediente debe existir visualizacion de:
  - marcaciones regularizadas
  - marcaciones reales
  - permisos
- al hacer clic en una marcacion debe poder verse el mapa/ubicacion
- para permisos aprobados se definio un flujo especial de marcaciones:
  - salida a permiso
  - regreso de permiso
  - combinaciones especiales cuando coincide con entrada o con salida

### 4. Cumpleanos / dia libre
Se definio un beneficio de cumpleanos:

- talento humano genera una tarjeta imprimible con QR
- el colaborador ingresa a una pantalla de canje
- debe subir evidencia de coordinacion con jefe inmediato antes de poder canjear
- una vez canjeado se regulariza la jornada completa en `F-RH-09`
- el beneficio vale una sola vez y vence el dia anterior al siguiente cumpleanos
- debe notificar ausencia igual que permisos/vacaciones

### 5. Planeacion comercial / cronogramas
Se definio para la vista comercial:

- el mes se divide en 4 semanas
- se selecciona ciudad
- al seleccionar ciudad deben cargarse automaticamente los clientes asignados a ese asesor en esa ciudad
- `agregar visita manual` queda para prospectos
- al aprobar el cronograma, las visitas aprobadas deben:
  - convertirse en actividades de `CRM-FAM`
  - generar eventos en Google Calendar

En la vista de aprobacion del jefe comercial se pidio mostrar:

- semanas
- dias
- fechas de visita
- detalle de clientes/prospectos
- botones de aprobar/rechazar

## Cambios y estado mas reciente confirmados por codigo/DB

### Cronograma aprobado -> CRM-FAM
Este fue el ultimo punto trabajado y si esta validado tecnicamente.

#### Hallazgo
El cronograma de `rafael.ortiz@fam-project.com` estaba aprobado en Neon, pero al aprobar no se estaban creando actividades en `CRM-FAM`.

#### Evidencia encontrada
- `schedules` ya estaba intentando sincronizar artefactos externos al aprobar
- en Neon se verifico que el cronograma de Rafael tenia:
  - `status = approved`
  - visitas existentes
  - `crm_synced = 0`
  - `external_synced = 3`
- en produccion no existia configuracion valida para EspoCRM externo
- el modulo correcto disponible en este proyecto es el interno `crm-fam`
- Neon si tiene tablas reales del CRM interno, incluyendo `crm.crm_activities`

#### Correccion aplicada en codigo
Se ajusto `backend/src/modules/schedules/schedules.service.js` para que al aprobar un cronograma:

- cree o actualice actividades internas en `crm.crm_activities`
- use `crm_activity_id` por visita en `public.scheduled_visits`
- conserve el flujo de calendar sync existente
- no dependa de EspoCRM externo para cumplir el requerimiento real

Se agrego la migracion:

- `backend/migrations/239_scheduled_visits_crm_activity_id.sql`

Esta migracion agrega:

- `public.scheduled_visits.crm_activity_id UUID`

#### Estado en Neon
La columna `crm_activity_id` ya fue aplicada y verificada en Neon.

#### Estado del cronograma de Rafael
Se revirtio el cronograma aprobado para permitir repetir la prueba:

- `schedule id = 16`
- `user_email = rafael.ortiz@fam-project.com`
- `month = 7`
- `year = 2026`
- `status = pending_approval`

#### Pendiente final
La correccion estaba lista en codigo, pero el deploy a Cloud Run no quedo confirmado al cierre de este tramo. La revision activa seguia siendo:

- `spi-backend-00681-pg2`

Por tanto, antes de reintentar la prueba E2E de aprobacion del cronograma, conviene:

1. terminar/verificar el deploy de backend
2. confirmar que la revision activa ya contiene este cambio
3. volver a aprobar el cronograma de Rafael
4. validar en Neon que se poblaron `scheduled_visits.crm_activity_id`
5. validar inserciones reales en `crm.crm_activities`

## Ajustes operativos/datos que se tocaron durante la conversacion
Durante la conversacion tambien se hicieron varias acciones de soporte operativo y limpieza de datos, incluyendo:

- reseteos o correcciones de estados para salidas operacionales y viaticos de usuarios de prueba
- eliminacion o depuracion de registros de prueba
- ajuste de historicos de vacaciones para usuarios puntuales
- limpieza de usuarios duplicados o problematicos de autenticacion
- reinicios puntuales para repetir pruebas end to end

Estos cambios fueron contextuales a pruebas y diagnosticos. Antes de repetir una prueba sensible, conviene validar en Neon el estado actual del usuario/expediente involucrado.

## UI / UX y coherencia visual
Se trabajo con el criterio de mantener coherencia con `DESIGN.md`, especialmente en:

- navegacion
- dashboards por rol
- rework del flujo de viaticos
- correcciones responsive en capacitaciones
- mejoras visuales para clientes y planificacion

Si se retoma UI, debe mantenerse:

- tipografia `Geist`
- paleta base definida en `DESIGN.md`
- estados de carga/vacio/error/confirmacion
- responsive real en movil
- evitar duplicacion de funciones en navegacion y vistas

## Documentos de apoyo ya existentes en el repo
Conviene revisar estos archivos al retomar:

- [PLAN_CORRECCION_MODULO_VIATICOS_ALINEACION.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/PLAN_CORRECCION_MODULO_VIATICOS_ALINEACION.md)
- [ESPECIFICACION_OBJETIVO_VIATICOS_WORKSPACE.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/ESPECIFICACION_OBJETIVO_VIATICOS_WORKSPACE.md)
- [DISENO_MODELO_OBJETIVO_VIATICOS_FASE2.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/DISENO_MODELO_OBJETIVO_VIATICOS_FASE2.md)
- [MATRIZ_ACTUAL_VS_OBJETIVO_VIATICOS.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/MATRIZ_ACTUAL_VS_OBJETIVO_VIATICOS.md)
- [PLAN_ALINEACION_TECNICA_CRONOGRAMA.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/PLAN_ALINEACION_TECNICA_CRONOGRAMA.md)
- [MATRIZ_TECNICA_RBAC_Y_CRONOGRAMA.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/MATRIZ_TECNICA_RBAC_Y_CRONOGRAMA.md)
- [docs/development/VIATICOS_REWORK_PLAN.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/docs/development/VIATICOS_REWORK_PLAN.md)
- [docs/development/MODULO_TALENTO_HUMANO_ASPIRANTES.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/docs/development/MODULO_TALENTO_HUMANO_ASPIRANTES.md)
- [docs/development/CRM-Fam/CRM-Fam_Plan_Desarrollo_MultiAgente.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/docs/development/CRM-Fam/CRM-Fam_Plan_Desarrollo_MultiAgente.md)

## Archivos clave para retomar rapido

### Backend
- [backend/src/modules/schedules/CONTEXT.md](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/schedules/CONTEXT.md)
- [backend/src/modules/schedules/schedules.service.js](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/schedules/schedules.service.js)
- [backend/src/modules/crm-fam/crm.service.js](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/src/modules/crm-fam/crm.service.js)
- [backend/migrations/239_scheduled_visits_crm_activity_id.sql](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/backend/migrations/239_scheduled_visits_crm_activity_id.sql)

### Frontend
- [spi_front/src/modules/comercial/components/schedules/ScheduleWorkspace.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/comercial/components/schedules/ScheduleWorkspace.jsx)
- [spi_front/src/modules/comercial/components/schedules/ScheduleDetailModal.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/comercial/components/schedules/ScheduleDetailModal.jsx)
- [spi_front/src/core/ui/widgets/AttendanceWidget.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/core/ui/widgets/AttendanceWidget.jsx)
- [spi_front/src/modules/finanzas/pages/ViaticosDeclarant.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/modules/finanzas/pages/ViaticosDeclarant.jsx)
- [spi_front/src/core/ui/components/NavigationBar.jsx](/C:/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/spi_front/src/core/ui/components/NavigationBar.jsx)

## Proximo paso recomendado
Si se retoma desde el ultimo punto funcional:

1. verificar o repetir deploy de backend a Cloud Run
2. confirmar revision activa
3. volver a aprobar el cronograma pendiente de Rafael
4. validar creacion de actividades en `CRM-FAM`
5. si eso pasa, continuar con pruebas UI/E2E del flujo de aprobacion y consumo en dashboards/CRM

## Nota final
Este handoff resume el trabajo de esta conversacion a nivel operativo. Para auditoria exacta de archivos modificados, revisar tambien `git status` y `git diff` antes de continuar, porque el arbol de trabajo contiene muchos cambios concurrentes en el proyecto.
