# Plan De Alineacion De Asistencia Y Atajos

Fecha: 2026-07-09  
Modulo principal: `attendance`  
Frontend afectado: `AttendanceWidget`, `AttendanceAction`, `MobileShortcuts`, `attendanceFlowUtils`, `attendanceApi`  
Backend relacionado: `attendance.controller.js`, `attendanceState.service.js`, `GET /attendance/today`

## 1. Objetivo

Alinear completamente el flujo de marcaciones de asistencia entre:

- widget normal de asistencia
- enlaces directos usados por atajos del iPhone
- pantalla `MobileShortcuts`
- ruta deep-link `AttendanceAction`

sin perder funcionamiento actual para:

- jornada normal
- permisos
- salidas operacionales
- visitas a clientes
- salidas inesperadas
- regularizacion de entrada
- almuerzo normal y almuerzo operacional

El objetivo funcional es que los atajos sean:

- rapidos
- consistentes con el widget
- guiados por el estado real del dia
- resistentes a enlaces viejos o fuera de contexto
- con menos pasos manuales cuando el flujo lo permita

---

## 2. Evidencia Confirmada En Codigo

### 2.1 Estado actual del widget

Fuente:

- `spi_front/src/core/ui/widgets/AttendanceWidget.jsx`

Hallazgos confirmados:

1. El widget ya tiene la orquestacion mas completa del flujo.
2. Decide acciones segun:
   - `attendance`
   - `activeException`
   - `active_time_off`
   - `active_field_visit`
   - `late_policy`
3. La salida final pide confirmacion modal.
4. La regularizacion de entrada existe solo en widget.
5. La justificacion de atraso existe solo en widget.
6. El flujo operacional tipo cliente ya es mas rico que el deep-link:
   - categoria
   - tipo de visita
   - cliente cronograma
   - prospecto
   - emergencia
   - cliente abierto/cerrado
   - continuar operacion o terminar
7. El widget ya unifico llegada a destino + entrada a cliente para cliente.
8. El widget ya soporta permisos:
   - `startPermissionEntry`
   - `finishPermissionExit`

### 2.2 Estado actual de la ruta deep-link

Fuente:

- `spi_front/src/modules/shared/pages/AttendanceAction.jsx`

Hallazgos confirmados:

1. `AttendanceAction` ejecuta una accion fija definida por la URL.
2. Tiene validaciones parciales, pero no reconstruye todo el flujo real antes de actuar.
3. Tiene pasos manuales solo para ciertos casos:
   - seleccionar cliente/prospecto
   - decision posterior a salida de cliente
   - inicio/cierre operacional con datos de vehiculo
4. No tiene implementados en su `ACTION_MAP`:
   - `permission-entry-start`
   - `permission-exit-finish`
5. No tiene confirmacion para `salida final`.
6. No tiene flujo de regularizacion de entrada.
7. No tiene flujo de justificacion de atraso.
8. Mantiene acciones separadas para:
   - `llegada-destino`
   - `cliente-entrada`
   aunque el widget ya las trata como una sola accion operativa en el caso cliente.

### 2.3 Estado actual de la pantalla de atajos

Fuente:

- `spi_front/src/modules/shared/pages/MobileShortcuts.jsx`

Hallazgos confirmados:

1. Ya consulta `getTodayAttendance()`.
2. Ya usa `canonical_flow` y `allowed_actions`.
3. Ya no muestra todas las acciones siempre.
4. Pero sigue siendo un catalogo de acciones individuales, no de intenciones de flujo.
5. No expone permisos aunque `attendanceFlowUtils` ya define metadata para ellos.

### 2.4 Estado actual de la API frontend

Fuente:

- `spi_front/src/core/api/attendanceApi.js`

Hallazgos confirmados:

1. Existen APIs separadas para:
   - flujo normal
   - aliases para atajos
   - permisos
   - operacional
   - visitas
2. La capa API no es hoy el principal problema.
3. El problema principal esta en la orquestacion UI y en la estrategia de enlaces.

### 2.5 Estado actual del backend

Fuentes:

- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendanceState.service.js`

Hallazgos confirmados:

1. `GET /attendance/today` ya expone `canonical_flow`.
2. El backend ya conoce `allowed_actions`.
3. El backend ya maneja permisos, visitas, operational flow y estado del dia.
4. El frontend no consume de manera uniforme todo ese conocimiento.

---

## 3. Problemas Reales A Resolver

## 3.1 Descoordinacion de prompts y pasos

Hoy el widget solicita datos o confirmaciones que el atajo no solicita:

- confirmacion de salida final
- regularizacion de entrada
- justificacion de atraso
- flujo completo de cliente en salida operacional
- permisos en atajos

Impacto:

- errores de uso
- inconsistencias de experiencia
- marcaciones fuera de contexto
- mas soporte manual

## 3.2 Exceso de enlaces orientados a accion y no a estado

Hoy los atajos siguen pensando en:

- marcar entrada
- marcar salida
- marcar llegada
- marcar cliente

en vez de pensar en:

- iniciar jornada
- continuar jornada
- iniciar salida operacional
- continuar salida operacional
- atender permiso activo

Impacto:

- enlaces obsoletos en iPhone
- usuario elige una accion incorrecta
- mayor carga cognitiva

## 3.3 Duplicacion de UI de flujo

Hay logica rica en el widget y logica parcial en `AttendanceAction`.

Impacto:

- divergencia funcional
- bugs por mantenimiento duplicado
- futuras correcciones mas lentas

## 3.4 Los atajos no son lo suficientemente rapidos para movil

Aunque el GPS ya esta optimizado, el costo principal hoy viene de:

- entrar a una pagina intermedia
- revalidar contexto
- mostrar pasos distintos al widget
- usar atajos viejos de acciones fijas

---

## 4. Objetivo Tecnico Del Refactor

Migrar de un modelo:

- `atajo = accion fija`

a un modelo:

- `atajo = intencion`
- `AttendanceAction = resolvedor inteligente del siguiente paso`
- `widget y atajo = misma logica de flujo`

Sin romper:

- rutas actuales
- accesos viejos ya guardados en iPhone
- contratos API
- flujo normal del widget

---

## 5. Estrategia General

Se aplicara en capas:

1. Normalizar modelo de flujo en frontend
2. Redefinir catalogo de enlaces para iPhone
3. Convertir `AttendanceAction` en resolvedor inteligente
4. Reusar subflujos del widget en deep-link
5. Cubrir permisos y regularizaciones
6. Mantener compatibilidad con enlaces viejos
7. Validar end-to-end por matriz de escenarios

---

## 6. Fases De Implementacion

## Fase 0. Inventario Tecnico Y Mapa De Compatibilidad

Objetivo:

Congelar el mapa actual de acciones, rutas y equivalencias antes del refactor.

Trabajo:

1. Documentar todas las acciones canonicas hoy soportadas.
2. Documentar aliases viejos y su traduccion.
3. Documentar que acciones son:
   - atomicas
   - guiadas
   - contextuales
4. Crear tabla de compatibilidad:
   - enlace viejo
   - nueva intencion objetivo
   - comportamiento de fallback

Entregable:

- seccion nueva en `attendanceFlowUtils` o documento de soporte con mapa de compatibilidad

Criterio de salida:

- ningun enlace viejo queda sin mapping definido

---

## Fase 1. Modelo Canonico De Intenciones En Frontend

Objetivo:

Crear una capa unica de intenciones de flujo para widget, atajos y deep-link.

Trabajo:

1. Extender `attendanceFlowUtils.js` con un nuevo modelo:
   - `start-day`
   - `continue-day`
   - `start-operational-flow`
   - `continue-operational-flow`
   - `handle-active-permission`
   - `resolve-late-entry`
2. Mantener el modelo actual de acciones canonicas sin romperlo.
3. Crear resolvedores:
   - `resolveIntentToAction`
   - `resolveShortcutIntent`
   - `resolveDeepLinkBehavior`
4. Definir por cada intencion:
   - cuando aplica
   - que accion backend dispara
   - si requiere UI intermedia
   - si necesita confirmacion

Criterio de salida:

- widget y `AttendanceAction` pueden consultar la misma semantica de flujo

Riesgo:

- no mezclar intencion con endpoint

---

## Fase 2. Catalogo Nuevo De Atajos Moviles

Objetivo:

Reducir el numero de atajos expuestos y orientarlos por intencion.

Trabajo:

1. Rediseñar `MobileShortcuts.jsx` para mostrar dos grupos:
   - Atajos recomendados hoy
   - Atajos avanzados / legacy
2. Atajos recomendados:
   - `iniciar-jornada`
   - `continuar-jornada`
   - `iniciar-salida-operacional`
   - `continuar-salida-operacional`
   - `gestionar-permiso-activo` cuando aplique
3. Atajos legacy:
   - mantener visibles solo si hace falta depuracion o compatibilidad
4. Mostrar debajo de cada atajo:
   - que hara hoy realmente
   - ejemplo: “Hoy resolvera: Salida a almuerzo”

Criterio de salida:

- la pantalla de atajos ya no depende de que el usuario entienda todas las acciones tecnicas

Riesgo:

- no romper usuarios que ya conocen el flujo actual

---

## Fase 3. Motor De Resolucion Inteligente En AttendanceAction

Objetivo:

Convertir `AttendanceAction` en la capa principal de resolucion de enlaces externos.

Trabajo:

1. Soportar dos tipos de rutas:
   - acciones legacy actuales
   - nuevas intenciones
2. Al cargar la pagina:
   - consultar `getTodayAttendance()`
   - resolver `canonical_flow`
   - leer `activeException`
   - leer `active_time_off`
3. Si el enlace es una intencion:
   - resolver la accion real del momento
4. Si el enlace es legacy:
   - validar si sigue permitido
   - si no, redirigir al flujo correcto con mensaje claro
5. Crear un mecanismo de “auto-upgrade”:
   - si llega `/asistencia/marcar/salida` pero hoy corresponde otra cosa, se informa y se reencamina cuando sea seguro

Criterio de salida:

- los enlaces de iPhone dejan de ser peligrosamente literales

Riesgo:

- no autoejecutar una accion distinta sin feedback visible cuando la diferencia sea sensible

---

## Fase 4. Unificacion De Confirmaciones Y Solicitudes

Objetivo:

Que el deep-link tenga las mismas protecciones UX del widget cuando aplique.

Trabajo:

1. Replicar en `AttendanceAction` la confirmacion de salida final.
2. Agregar flujo de regularizacion de entrada:
   - si la entrada esta bloqueada por 09:20, no caer en error seco
   - ofrecer accion directa para solicitar regularizacion
3. Agregar flujo de justificacion de atraso cuando el backend indique que aplica.
4. Mantener “fast path” en casos seguros:
   - entrada normal
   - salida a almuerzo
   - entrada de almuerzo

Decision UX:

- confirmar solo acciones irreversibles o propensas a error
- no meter confirmaciones en todos los pasos

Criterio de salida:

- atajo y widget dejan de divergir en protecciones criticas

---

## Fase 5. Unificacion Del Flujo Operacional Tipo Cliente

Objetivo:

Eliminar la divergencia entre el flujo operacional del widget y el deep-link.

Trabajo:

1. Reusar la misma estructura de subflujo del widget en `AttendanceAction` para categoria `cliente`.
2. El inicio operacional tipo cliente debe pedir:
   - tipo de visita
   - cliente cronograma o prospecto o emergencia
   - motivo cuando aplique
3. La llegada a destino y la entrada a cliente deben resolverse como una sola accion cuando corresponda.
4. La salida del cliente no debe decidir sola el fin del flujo.
5. La decision posterior debe mantenerse:
   - continuar operacion
   - terminar operaciones

Criterio de salida:

- no hay dos experiencias funcionalmente distintas para el mismo proceso

Riesgo:

- no duplicar componentes; idealmente extraer secciones compartidas

---

## Fase 6. Soporte Completo De Permisos En Atajos

Objetivo:

Que los enlaces directos soporten el flujo de permisos igual que el widget.

Trabajo:

1. Agregar a `AttendanceAction` soporte para:
   - `permission-entry-start`
   - `permission-exit-finish`
2. Exponer esos atajos en `MobileShortcuts` solo si el estado del dia lo permite.
3. Integrar esos caminos al modelo de intenciones:
   - `handle-active-permission`
4. Si el permiso coincide con inicio de jornada:
   - permitir “entrada + salida a permiso”
5. Si el permiso coincide con fin de jornada:
   - permitir “fin permiso + salida”

Criterio de salida:

- permisos ya no dependen exclusivamente del widget

---

## Fase 7. Reutilizacion De Componentes Compartidos

Objetivo:

Reducir divergencia futura.

Trabajo:

1. Identificar subcomponentes del widget que deben extraerse:
   - selector de tipo de visita
   - picker de cliente/prospecto/emergencia
   - bloque de decision post-visita
   - formulario operacional de vehiculo
   - confirmacion de salida final
   - formulario de regularizacion
2. Crear componentes compartidos en ruta neutral:
   - `spi_front/src/core/ui/attendance/...`
3. Reemplazar implementaciones duplicadas en widget y `AttendanceAction`.

Criterio de salida:

- la logica critica de formularios ya no existe duplicada

Riesgo:

- no hacer un refactor cosmetico grande; solo extraer lo realmente compartido

---

## Fase 8. Compatibilidad Con Enlaces Viejos De iPhone

Objetivo:

No romper shortcuts ya guardados en dispositivos.

Trabajo:

1. Mantener activas las rutas actuales:
   - `/asistencia/marcar/entrada`
   - `/asistencia/marcar/salida`
   - etc.
2. Añadir capa de compatibilidad dentro de `AttendanceAction`:
   - validar si la accion sigue vigente
   - si no, ofrecer redireccion al paso correcto
3. Mensajes de compatibilidad:
   - “Este atajo ya no es el paso correcto de hoy. Te llevamos al siguiente paso permitido.”
4. Evitar ejecutar silenciosamente una accion distinta si cambia el significado funcional.

Criterio de salida:

- usuarios con shortcuts viejos siguen pudiendo operar sin rehacer todo manualmente

---

## Fase 9. Optimizacion De Rapidez Percibida

Objetivo:

Reducir tiempo real y tiempo percibido de marcacion.

Trabajo:

1. Mantener `startLocationPrewarm()` como base.
2. Evaluar en `AttendanceAction` si puede mostrarse un estado “Preparando marcacion” mas corto antes de entrar a `processing`.
3. Reducir pantallas intermedias solo cuando:
   - la accion es atomica
   - no requiere confirmacion
   - no requiere datos extra
4. Reusar `cached canonical flow` si ya existe en memoria de sesion.
5. Evitar doble fetch innecesario:
   - hoy `AttendanceAction` en algunos casos consulta `getTodayAttendance` y luego otras APIs
6. Evaluar una resolucion anticipada:
   - si `MobileShortcuts` ya conoce el `next_step`, puede construir enlace con pista de contexto
   - pero la validacion final debe seguir en `AttendanceAction`

Metricas objetivo:

- entrada/almuerzo en cache GPS caliente: sensacion de respuesta casi inmediata
- flujo operacional: menos pantallas duplicadas
- menos errores de contexto

---

## Fase 10. QA End-To-End

Objetivo:

Validar que widget y atajos producen el mismo resultado funcional.

Matriz minima:

1. Entrada normal antes de 09:20
2. Entrada normal despues de 09:20
3. Salida a almuerzo con entrada existente
4. Salida a almuerzo sin entrada
5. Regreso de almuerzo correcto
6. Salida final despues de almuerzo
7. Salida final accidental inmediata
8. Permiso al inicio de jornada
9. Permiso a mitad de jornada
10. Permiso al final de jornada
11. Salida operacional general no cliente
12. Salida operacional cliente con cronograma
13. Salida operacional cliente con prospecto
14. Salida operacional cliente con emergencia
15. Llegada a destino + entrada a cliente
16. Salida de cliente + continuar operacion
17. Salida de cliente + terminar operaciones
18. Cierre operacional con vehiculo personal
19. Atajo legacy fuera de contexto
20. Sin conexion con cola offline en acciones soportadas

Validaciones por caso:

- UI correcta
- endpoint correcto
- mensajes correctos
- estado final correcto en `today`
- sin duplicacion de pasos
- sin pantallas innecesarias

---

## 7. Orden Recomendado De Aplicacion

Orden seguro:

1. Fase 0
2. Fase 1
3. Fase 3
4. Fase 4
5. Fase 5
6. Fase 6
7. Fase 7
8. Fase 2
9. Fase 8
10. Fase 9
11. Fase 10

Razon:

- primero se estabiliza la semantica
- luego la resolucion
- despues la UI visible

---

## 8. Archivos Probablemente Afectados

### Frontend

- `spi_front/src/core/ui/widgets/AttendanceWidget.jsx`
- `spi_front/src/modules/shared/pages/AttendanceAction.jsx`
- `spi_front/src/modules/shared/pages/MobileShortcuts.jsx`
- `spi_front/src/core/ui/attendanceFlowUtils.js`
- `spi_front/src/core/api/attendanceApi.js`
- nuevos componentes compartidos en `spi_front/src/core/ui/attendance/`

### Backend

Solo si hace falta soporte adicional de metadata o compatibilidad:

- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendanceState.service.js`

Nota:

Con la evidencia actual, el refactor principal es frontend. Backend ya expone suficiente estado para resolver mejor el flujo.

---

## 9. Riesgos Y Controles

### Riesgo 1

Romper shortcuts ya guardados.

Control:

- compatibilidad legacy obligatoria en `AttendanceAction`

### Riesgo 2

Introducir demasiados pasos y volver lento el atajo.

Control:

- confirmaciones solo en acciones sensibles
- fast path para acciones atomicas

### Riesgo 3

Duplicar otra vez el flujo entre widget y deep-link.

Control:

- extraer componentes compartidos
- centralizar semantica en `attendanceFlowUtils`

### Riesgo 4

Auto-redirigir a una accion distinta y confundir al usuario.

Control:

- mostrar siempre mensaje claro cuando un atajo legacy se remapea

---

## 10. Criterios Finales De Aceptacion

Se considera completo cuando:

1. Un mismo caso de negocio se comporta igual desde widget y desde atajo.
2. Los atajos directos ya no omiten pasos o prompts criticos.
3. Los atajos siguen siendo rapidos para acciones simples.
4. Los permisos funcionan tambien por atajo.
5. El flujo operacional tipo cliente no diverge entre widget y deep-link.
6. Los enlaces viejos siguen funcionando con compatibilidad controlada.
7. La experiencia movil queda mas simple que hoy.

---

## 11. Siguiente Paso Operativo

Empezar por:

- Fase 0
- Fase 1
- Fase 3

porque ahi se define la base del sistema de atajos inteligente antes de tocar mas UI visible.
