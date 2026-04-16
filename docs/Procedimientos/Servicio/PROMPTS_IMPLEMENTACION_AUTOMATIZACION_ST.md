# Prompts de implementacion para IA programadora - automatizacion integral ST

## 1. Objetivo

Este documento contiene un pack de prompts para guiar a una IA programadora en la implementacion completa de los requerimientos levantados en [LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md](./LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md).

La intencion no es producir prompts genericos, sino prompts ejecutables, con alcance claro, archivos concretos, restricciones de arquitectura, reglas de coherencia visual y criterios de aceptacion. Cada prompt debe usarse con el documento de requerimientos anterior abierto al mismo tiempo.

## 2. Orden recomendado de ejecucion

1. `Prompt 00` - Alineacion, lectura del repo y plan de ejecucion
2. `Prompt 01` - Fundacion transversal de workflows, estados y catalogo documental
3. `Prompt 02` - Integracion Business Case, Comercial, compras e inspeccion F.ST-20
4. `Prompt 03` - Inspeccion de sitio F.ST-07, reinspecciones y workspace tecnico unificado
5. `Prompt 04` - Instalacion, entrega, F.ST-10, F.ST-14 y verificacion F.ST-09
6. `Prompt 05` - Entrenamientos, reentrenamientos, evaluaciones y certificados
7. `Prompt 06` - Retiro, desinstalacion, F.ST-02, F.ST-11 y logistica de salida
8. `Prompt 07` - Mantenimientos preventivos ST-01-02
9. `Prompt 08` - Mantenimientos correctivos ST-01-03 y flujo CEAC
10. `Prompt 09` - Casos externos REXIS / Navify / GoApp ST-01-04
11. `Prompt 10` - Unificacion frontend, QA, regresion, trazabilidad y cierre

## 3. Reglas globales para la IA programadora

- Fuente de verdad funcional: `docs/Procedimientos/LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md`
- No asumir payloads, campos, estados, integraciones ni templates no evidenciados.
- Antes de editar, leer los archivos citados en cada prompt y confirmar el write-set.
- Mantener la separacion backend `routes -> controller -> service`.
- En backend, preservar patrones existentes de `db.query`, `logger`, `notificationManager`, integridad documental, `ensure*Table`, `columnExists` y middlewares de roles.
- En frontend, preservar el lenguaje visual y los primitivos existentes en:
  - `spi_front/src/core/ui/components/Card.jsx`
  - `spi_front/src/core/ui/components/Button.jsx`
  - `spi_front/src/core/ui/components/Modal.jsx`
  - `spi_front/src/core/ui/components/ProcessingOverlay.jsx`
- No crear un design system nuevo ni pantallas desconectadas del resto del dashboard.
- Reutilizar patrones visuales y de interaccion ya visibles en:
  - `spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx`
  - `spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx`
  - `spi_front/src/modules/servicio/pages/Mantenimientos.jsx`
  - `spi_front/src/modules/ti/pages/TicketsWorkspace.jsx`
- Todo endpoint nuevo debe quedar registrado en backend y consumido desde la capa `spi_front/src/core/api/*`.
- Toda pantalla nueva debe quedar registrada en `spi_front/src/routes/AppRoutes.jsx`.
- Si se crea un modulo nuevo en backend, registrarlo en `backend/src/routes/registerRoutes.js`.
- Cada entrega debe incluir pruebas o, si el slice no tiene suite automatizada, verificaciones manuales reproducibles y documentadas.
- Cada entrega debe reportar explicitamente que `REQ-ST-*` quedo cubierto y que `REQ-ST-*` sigue bloqueado por artefactos externos, si aplica.

## 4. Formato esperado de salida de la IA

Pide siempre que la IA responda con este formato:

- `Resumen ejecutivo`
- `Requerimientos REQ-ST cubiertos`
- `Archivos modificados`
- `Nuevos archivos creados`
- `Cambios de base de datos`
- `Nuevos endpoints`
- `Cambios de frontend`
- `Pruebas ejecutadas`
- `Pendientes o bloqueos reales`

## 5. Prompt 00 - Arranque controlado del trabajo

Relacion de requerimientos: transversal a todos los `REQ-ST-*`.

```text
Eres una IA programadora senior full stack especializada en sistemas empresariales. Vas a implementar por fases la automatizacion integral de los procedimientos ST del proyecto FamSPI.

Fuentes obligatorias de verdad:
- docs/Procedimientos/LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md
- docs/Procedimientos/PROMPTS_IMPLEMENTACION_AUTOMATIZACION_ST.md

Antes de escribir codigo:
1. Lee completo el levantamiento de requerimientos y extrae la matriz de cobertura REQ-ST.
2. Inspecciona obligatoriamente estos archivos para entender arquitectura, puntos de extension y patrones del sistema:
   - backend/src/routes/registerRoutes.js
   - backend/src/app.js
   - backend/src/modules/servicio/servicio.routes.js
   - backend/src/modules/servicio/servicio.controller.js
   - backend/src/modules/equipment-purchases/equipmentPurchases.routes.js
   - backend/src/modules/equipment-purchases/equipmentPurchases.service.js
   - backend/src/modules/private-purchases/privatePurchases.routes.js
   - backend/src/modules/private-purchases/privatePurchases.service.js
   - backend/src/modules/business-case/businessCasePreflow.service.js
   - backend/src/modules/mantenimientos/mantenimientos.service.js
   - backend/src/modules/support-tickets/supportTickets.service.js
   - backend/src/modules/schedules/schedules.service.js
   - backend/src/modules/requests/requests.service.js
   - spi_front/src/routes/AppRoutes.jsx
   - spi_front/src/core/ui/components/Card.jsx
   - spi_front/src/core/ui/components/Button.jsx
   - spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx
   - spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx
   - spi_front/src/modules/servicio/pages/Mantenimientos.jsx
   - spi_front/src/modules/ti/pages/TicketsWorkspace.jsx
   - spi_front/src/core/api/servicioApi.js
   - spi_front/src/core/api/equipmentPurchasesApi.js
   - spi_front/src/core/api/privatePurchasesApi.js
   - spi_front/src/core/api/schedulesApi.js

Tu tarea en este prompt no es implementar todo todavia. Tu tarea es:
- producir un plan de ejecucion por fases con write-set explicito
- mapear cada fase a rangos REQ-ST
- identificar dependencias tecnicas y funcionales
- identificar artefactos bloqueantes reales
- decidir que se implementa en la primera fase sin romper flujos existentes

Restricciones:
- No asumas templates faltantes ni payloads de terceros.
- No propongas reescribir modulos completos si existe una base reusable.
- Mantener coherencia visual con los workspaces y widgets existentes.
- Mantener compatibilidad hacia atras con los endpoints usados por el frontend actual.

Entrega esperada:
- plan por fases
- matriz REQ-ST por fase
- write-set por fase
- riesgos
- primera fase recomendada con justificacion
```

## 6. Prompt 01 - Fundacion transversal de workflows, estados y catalogo documental

Relacion de requerimientos: `REQ-ST-001` a `REQ-ST-010`, `REQ-ST-138` a `REQ-ST-146`, base parcial para `REQ-ST-151` y `REQ-ST-152`.

```text
Eres una IA programadora senior full stack. Implementa la fundacion transversal para los workflows ST sin romper los flujos existentes ya operativos.

Objetivo:
Construir la capa base que permita que instalaciones, inspecciones, entrenamientos, retiros, preventivos, correctivos y casos externos compartan:
- identificador de workflow
- maquina de estados
- expediente documental
- catalogo de plantillas y diccionario de campos
- validacion de compatibilidad plantilla-codigo
- trazabilidad de actor, fecha, origen y hash documental

Archivos obligatorios a revisar antes de editar:
- backend/src/modules/servicio/servicio.controller.js
- backend/src/modules/requests/requests.service.js
- backend/src/modules/business-case/businessCasePreflow.service.js
- backend/src/modules/equipment-purchases/equipmentPurchases.service.js
- backend/src/modules/private-purchases/privatePurchases.service.js
- backend/src/routes/registerRoutes.js
- spi_front/src/core/api/servicioApi.js
- spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx

Archivos preferidos a crear o extender:
- backend/src/modules/servicio/workflowRegistry.service.js
- backend/src/modules/servicio/workflowStateMachine.service.js
- backend/src/modules/servicio/documentTemplateRegistry.service.js
- backend/src/modules/servicio/documentCompatibility.service.js
- backend/src/modules/servicio/workflowAudit.service.js
- backend/src/modules/servicio/servicio.controller.js
- backend/src/modules/servicio/servicio.routes.js
- spi_front/src/core/api/servicioApi.js
- spi_front/src/modules/servicio/components/WorkflowTimeline.jsx
- spi_front/src/modules/servicio/components/WorkflowDocumentsPanel.jsx

Implementa en backend:
1. Un registro unico de workflows ST que relacione `source_type`, `source_id`, `request_id`, cliente, equipo, procedimiento, estado global y etapa actual.
2. Una maquina de estados versionable por procedimiento, sin hardcodear estados solo en frontend.
3. Un catalogo documental por codigo de formato, version, vigencia, ubicacion del template y lista oficial de campos.
4. Un diccionario de campos para `F.ST-20`, `F.ST-02`, `F.ST-04`, `F.ST-05`, `F.ST-09`, `F.ST-10`.
5. Una API para consultar el catalogo documental y el estado del expediente del workflow.
6. Validacion previa a emitir PDF para detectar:
   - campo inexistente
   - typo de campo
   - diferencias por acentos
   - campos de firma o imagen faltantes
   - incompatibilidad entre codigo y plantilla
7. Trazabilidad con hash, actor, fecha y template usado en cada documento emitido.
8. Endpoints de resumen documental y timeline del workflow.

Implementa en frontend:
1. Un panel reutilizable de expediente ST que consuma la nueva API de timeline y documentos.
2. Un componente reusable de estado del workflow para incrustarlo en workspaces tecnicos y comerciales.
3. Visualizacion consistente con `Card`, `Button`, `StatusBadge` y overlays existentes.

Restricciones de arquitectura:
- No elimines `servicio.workflow_documents`; evolucionarlo o encapsularlo.
- Si agregas tablas nuevas, deja `ensure*Table` o estrategia equivalente consistente con el proyecto.
- Si un template no es compatible, no silencies el error; reportalo funcionalmente.

Aceptacion obligatoria:
- Existe expediente ST consultable por API.
- Existe catalogo documental y diccionario de campos persistido.
- Existe validacion de compatibilidad previa a emitir PDFs.
- La UI muestra timeline y documentos sin romper `TechnicalProcedureWorkspace`.

Respuesta esperada:
- resumen
- REQ-ST cubiertos
- archivos modificados
- tablas nuevas
- endpoints nuevos
- pruebas ejecutadas
- incompatibilidades detectadas
```

## 7. Prompt 02 - Integracion Business Case, Comercial, compras e inspeccion F.ST-20

Relacion de requerimientos: `REQ-ST-011` a `REQ-ST-024`, `REQ-ST-035`, `REQ-ST-036`, parte de `REQ-ST-020`.

```text
Eres una IA programadora senior full stack. Debes consolidar el inicio del workflow tecnico desde Business Case, Comercial, compras publicas y compras privadas, usando F.ST-20 como documento tecnico de arranque.

Objetivo:
Eliminar la fragmentacion del arranque comercial/tecnico para que toda inspeccion nazca con trazabilidad unica, ventana valida, capacidad tecnica validada y acople a Business Case cuando corresponda.

Archivos obligatorios a revisar:
- backend/src/modules/business-case/businessCasePreflow.service.js
- backend/src/modules/equipment-purchases/equipmentPurchases.service.js
- backend/src/modules/equipment-purchases/equipmentPurchases.controller.js
- backend/src/modules/equipment-purchases/equipmentPurchases.routes.js
- backend/src/modules/private-purchases/privatePurchases.service.js
- backend/src/modules/private-purchases/privatePurchases.controller.js
- backend/src/modules/private-purchases/privatePurchases.routes.js
- backend/src/modules/requests/requests.service.js
- backend/src/modules/schedules/schedules.service.js
- spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx
- spi_front/src/core/api/equipmentPurchasesApi.js
- spi_front/src/core/api/privatePurchasesApi.js
- spi_front/src/core/api/servicioApi.js
- spi_front/src/modules/comercial/hooks/useSchedules.js
- spi_front/src/modules/comercial/pages/PlanificacionMensual.jsx
- spi_front/src/modules/comercial/pages/AprobacionCronogramas.jsx

Implementa en backend:
1. Un orquestador de inicio ST que reciba origen `business_case`, `public_purchase`, `private_purchase` o `commercial_request`.
2. Validacion centralizada de ventana minima/maxima de inspeccion.
3. Validacion centralizada de capacidad tecnica diaria cruzada con agenda y conflictos.
4. Regeneracion segura de `F.ST-20` cuando cambie la fecha coordinada.
5. Persistencia normalizada de metadatos de coordinacion, aprobacion, rechazo y actor.
6. Notificaciones consistentes entre comercial y jefatura tecnica.
7. Acople real al preflow de Business Case, sin duplicar reglas ya presentes.

Implementa en frontend:
1. Evoluciona `EquipmentPurchaseWidget.jsx` para consumir la capa unificada sin perder los flujos actuales de compra publica.
2. Expone el estado tecnico de inspeccion tambien para compra privada y casos derivados de Business Case.
3. Reutiliza hooks API existentes; no llames endpoints directos desde componentes.
4. Si agregas nuevos widgets o tarjetas, conserva el estilo actual de cards con bordes suaves, fondo translucido, jerarquia clara y controles de accion compactos.

No hacer:
- No duplicar logica de validacion de fecha en multiples componentes.
- No romper SSE ni estados existentes de compras.
- No mover la experiencia comercial a una pantalla totalmente nueva salvo que sea estrictamente necesario.

Aceptacion obligatoria:
- `F.ST-20` nace desde cualquier origen valido con el mismo modelo.
- La capacidad tecnica se valida de forma centralizada.
- Business Case deja el proceso listo para coordinacion sin hacks.
- Publico y privado comparten la misma base de trazabilidad.
```

## 8. Prompt 03 - Inspeccion de sitio F.ST-07, reinspecciones y workspace tecnico unificado

Relacion de requerimientos: `REQ-ST-025` a `REQ-ST-036`.

```text
Eres una IA programadora senior full stack. Debes implementar el flujo completo de inspeccion de ambiente y reinspecciones para ST-01-01, manteniendo un workspace tecnico unificado.

Objetivo:
Llevar `TechnicalProcedureWorkspace` desde un soporte parcial a un flujo robusto para:
- aprobacion/negacion de solicitud
- coordinacion de fecha
- ejecucion de inspeccion F.ST-07
- firma del cliente
- resultado conforme/no conforme
- reinspeccion
- bloqueo de instalacion hasta sitio conforme

Archivos obligatorios a revisar:
- spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx
- spi_front/src/core/api/equipmentPurchasesApi.js
- spi_front/src/core/api/privatePurchasesApi.js
- backend/src/modules/equipment-purchases/equipmentPurchases.service.js
- backend/src/modules/equipment-purchases/equipmentPurchases.controller.js
- backend/src/modules/private-purchases/privatePurchases.service.js
- backend/src/modules/servicio/servicio.controller.js
- backend/src/modules/requests/requests.service.js

Archivos recomendados a crear o extender:
- backend/src/modules/servicio/fst07.service.js
- backend/src/modules/servicio/fst07Pdf.service.js
- backend/src/modules/servicio/siteInspectionRules.service.js
- spi_front/src/modules/servicio/components/SiteInspectionStepper.jsx
- spi_front/src/modules/servicio/components/SiteInspectionSummaryCard.jsx
- spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx

Implementa en backend:
1. Modelo persistente para inspeccion de sitio con checklist estructurado, observaciones, recomendaciones, responsable, fecha, resultado y follow-up.
2. Soporte a multiples reinspecciones con historial.
3. Generacion de `F.ST-07` y adjunto al expediente del workflow.
4. Regla de negocio que bloquee instalacion mientras el sitio no quede conforme.
5. Regla para exigir fecha de reinspeccion cuando el resultado no sea conforme.
6. Soporte para decision de aprobacion o negacion por jefatura tecnica cuando proceda.

Implementa en frontend:
1. Refactoriza `TechnicalProcedureWorkspace.jsx` para separar:
   - filtro/lista
   - coordinacion de fecha
   - modal de inspeccion
   - historial documental
   - estado de cumplimiento del procedimiento
2. Mantener tabs publico/privado, pero con la misma experiencia funcional.
3. El checklist F.ST-07 debe mostrarse por secciones, con estados claros, validacion inline y resumen final.
4. Reutiliza modales y overlays existentes; no metas otro framework visual.

Criterios UI:
- Jerarquia visual clara: cabecera, estado, documentos, acciones.
- Mensajes de urgencia coherentes con los estados ya usados en compras.
- Responsive en desktop y laptop; no dejar tablas que desborden sin control.

Aceptacion obligatoria:
- Inspeccion y reinspeccion funcionan para ambos origenes.
- El estado del sitio condiciona el resto del workflow.
- El expediente muestra `F.ST-20` y `F.ST-07`.
- La UI sigue sintiendose parte del modulo de servicio actual.
```

## 9. Prompt 04 - Instalacion, entrega, F.ST-10, F.ST-14 y verificacion F.ST-09

Relacion de requerimientos: `REQ-ST-037` a `REQ-ST-053`, `REQ-ST-044`, `REQ-ST-045`, `REQ-ST-147`, `REQ-ST-148`.

```text
Eres una IA programadora senior full stack. Implementa el flujo completo de instalacion y entrega de equipos, incluyendo recepcion visual, acta de entrega y verificacion tecnica.

Objetivo:
Conectar logistica, servicio tecnico y documentos para que la instalacion no sea solo una serie de estados comerciales, sino un workflow tecnico y documental completo.

Archivos obligatorios a revisar:
- backend/src/modules/private-purchases/privatePurchases.acta.js
- backend/src/modules/private-purchases/privatePurchases.service.js
- backend/src/modules/equipment-purchases/equipmentPurchases.service.js
- backend/src/modules/servicio/verificacion-equipos.service.js
- backend/src/modules/servicio/servicio.controller.js
- spi_front/src/modules/servicio/components/VerificacionStepper.jsx
- spi_front/src/modules/servicio/pages/PrivatePurchaseDeliveries.jsx
- spi_front/src/modules/servicio/pages/TecnicoPrivatePurchases.jsx
- spi_front/src/core/api/servicioApi.js

Archivos sugeridos a crear o extender:
- backend/src/modules/servicio/fst14.service.js
- backend/src/modules/servicio/fst14Pdf.service.js
- backend/src/modules/servicio/installationWorkflow.service.js
- backend/src/modules/private-purchases/privatePurchases.acta.js
- backend/src/modules/servicio/verificacion-equipos.service.js
- spi_front/src/modules/servicio/components/InstallationReceptionStepper.jsx
- spi_front/src/modules/servicio/components/DeliveryActPanel.jsx
- spi_front/src/modules/servicio/components/VerificationResultPanel.jsx

Implementa en backend:
1. Registro formal de solicitud de despacho y validacion logistica.
2. Registro de inspeccion visual preinstalacion con fotos y `F.ST-14`.
3. Emision controlada de `F.ST-10` con legalizacion y evidencia documental.
4. Flujo diferenciado para equipos `CU`.
5. Decision tecnica de si aplica verificacion.
6. Ciclo de remediacion y repeticion de verificacion cuando `F.ST-09` falle.
7. Correccion de incompatibilidades de `F.ST-09` detectadas en el levantamiento:
   - `frima_af_image` vs `firma_af_image`
   - `ANÁLISIS` vs `ANALISIS`

Implementa en frontend:
1. Vista tecnica de entrega e instalacion que muestre prerequisitos, recepcion visual, documentos y verificacion.
2. Reutiliza `VerificacionStepper.jsx`, pero corrige su acople al backend y al template real.
3. Si agregas formularios nuevos, que sigan la estructura de steppers y cards ya usada en `Desinfeccion`, `Asistencia` y `Verificacion`.
4. Muestra claramente si la instalacion puede cerrarse o si esta bloqueada por verificacion pendiente o sitio no conforme.

No hacer:
- No generar `F.ST-09` si la plantilla es incompatible sin dejar error visible.
- No ocultar errores documentales con `try/catch` silenciosos.

Aceptacion obligatoria:
- Existe `F.ST-14`.
- `F.ST-10` queda integrado al workflow tecnico.
- La verificacion tiene ciclo de fallo/repeticion.
- Las incompatibilidades de `F.ST-09` quedan resueltas tecnicamente.
```

## 10. Prompt 05 - Entrenamientos, reentrenamientos, evaluaciones y certificados

Relacion de requerimientos: `REQ-ST-054` a `REQ-ST-069`, `REQ-ST-059`, `REQ-ST-060`, `REQ-ST-149`.

```text
Eres una IA programadora senior full stack. Implementa el flujo integral de entrenamiento tecnico y de aplicaciones dentro de ST-01-01.

Objetivo:
Completar el workflow de entrenamiento desde la coordinacion hasta la emision de certificados, pasando por asistencia, evaluacion, reentrenamiento y conformidad final.

Archivos obligatorios a revisar:
- backend/src/modules/servicio/entrenamiento.service.js
- backend/src/modules/servicio/asistencia-entrenamiento.service.js
- backend/src/modules/servicio/servicio.controller.js
- spi_front/src/modules/servicio/components/EntrenamientoStepper.jsx
- spi_front/src/modules/servicio/components/AsistenciaStepper.jsx
- spi_front/src/modules/servicio/pages/Aplicaciones.jsx
- spi_front/src/modules/servicio/pages/Asistencia.jsx
- spi_front/src/core/api/servicioApi.js

Archivos recomendados a crear o extender:
- backend/src/modules/servicio/trainingWorkflow.service.js
- backend/src/modules/servicio/fst06.service.js
- backend/src/modules/servicio/fst08.service.js
- backend/src/modules/servicio/fst12.service.js
- backend/src/modules/servicio/trainingCertificates.service.js
- spi_front/src/modules/servicio/components/TrainingEvaluationStepper.jsx
- spi_front/src/modules/servicio/components/TrainingConformityStepper.jsx
- spi_front/src/modules/servicio/components/TrainingCertificatePanel.jsx

Implementa en backend:
1. Modelo de evento de entrenamiento con participantes, sesiones, horas y materiales.
2. Integracion documental de `F.ST-04`, `F.ST-05`, `F.ST-06`, `F.ST-08`, `F.ST-12`.
3. Regla de aprobacion:
   - asistencia 100 por ciento
   - evaluacion minima 80 por ciento
4. Flujo automatico de reentrenamiento si no se cumple la regla.
5. Emision de certificado con vencimiento operacional de 30 dias para su entrega.
6. Integracion con el expediente del workflow y con el historial del cliente.
7. Correccion de inconsistencias de `F.ST-05` detectadas en el levantamiento:
   - nombres reales de campos `Dia_*`
   - estrategia para firma del especialista
   - estrategia para grupos mayores a 7 asistentes

Implementa en frontend:
1. Un flujo guiado para el especialista que no requiera navegar por pantallas inconexas.
2. Pantallas o modales para:
   - coordinacion
   - lista de asistencia
   - evaluacion del participante
   - evaluacion del especialista
   - conformidad final
   - estado del certificado
3. Mantener coherencia visual con steppers ya existentes.
4. Mostrar claramente cuando el entrenamiento queda `completado`, `pendiente de reentrenamiento` o `pendiente de certificado`.

Aceptacion obligatoria:
- El entrenamiento no se marca completo si no cumple reglas.
- Existe reentrenamiento trazable.
- Se emite y rastrea certificado.
- `F.ST-05` queda tecnicamente consistente con la plantilla real o con la nueva estrategia aprobada.
```

## 11. Prompt 06 - Retiro, desinstalacion, F.ST-02, F.ST-11 y logistica de salida

Relacion de requerimientos: `REQ-ST-070` a `REQ-ST-080`, parte de `REQ-ST-150`.

```text
Eres una IA programadora senior full stack. Implementa el flujo integral de retiro y desinstalacion de equipos, incluyendo descontaminacion, embalaje y acta de retiro.

Objetivo:
Convertir el retiro en un workflow controlado con:
- solicitud formal
- caso con proveedor cuando aplique
- WO de retiro
- desinfeccion documentada
- etiquetado y embalaje
- control de bultos
- acta de retiro F.ST-11

Archivos obligatorios a revisar:
- backend/src/modules/servicio/desinfeccion.service.js
- backend/src/modules/servicio/servicio.controller.js
- spi_front/src/modules/servicio/components/DesinfeccionStepper.jsx
- spi_front/src/modules/servicio/pages/Desinfeccion.jsx
- spi_front/src/modules/comercial/pages/Solicitudes.jsx
- spi_front/src/modules/comercial/components/CreateRequestModal.jsx

Archivos sugeridos a crear o extender:
- backend/src/modules/servicio/withdrawalWorkflow.service.js
- backend/src/modules/servicio/fst11.service.js
- backend/src/modules/servicio/packagingLabels.service.js
- spi_front/src/modules/servicio/components/WithdrawalStepper.jsx
- spi_front/src/modules/servicio/components/WithdrawalPackagingPanel.jsx
- spi_front/src/modules/servicio/pages/RetiroEquipos.jsx

Implementa en backend:
1. Flujo de solicitud de retiro desde comercial.
2. Orquestacion de caso con proveedor cuando aplique.
3. WO de retiro y control de estado tecnico.
4. Integracion de `F.ST-02` al retiro y al cambio de partes.
5. Correccion de incompatibilidades detectadas en `F.ST-02`:
   - `chk_CVITE/chk_CVTE`
   - `chk_DFD_o/chk_DFD_op`
6. Registro de embalaje, etiquetas, bultos y evidencia.
7. Emision de `F.ST-11`.

Implementa en frontend:
1. Paso a paso claro para retiro/desinstalacion.
2. Carga ordenada de evidencias fotograficas y control de bultos.
3. Estado visual claro de:
   - retiro solicitado
   - retiro coordinado
   - desinfectado
   - embalado
   - retirado
   - cerrado

Aceptacion obligatoria:
- `F.ST-02` queda estable y consistente.
- Existe `F.ST-11`.
- El retiro tiene trazabilidad logistica y documental.
```

## 12. Prompt 07 - Mantenimientos preventivos ST-01-02

Relacion de requerimientos: `REQ-ST-081` a `REQ-ST-100`.

```text
Eres una IA programadora senior full stack. Debes evolucionar el modulo de mantenimientos para soportar el procedimiento ST-01-02 completo y no solo registros genericos.

Objetivo:
Implementar plan anual, cronograma por equipo, oferta preventiva, reprogramaciones formales, solicitudes de kits, ejecucion preventiva con evidencia y medicion real de cumplimiento mensual.

Archivos obligatorios a revisar:
- backend/src/modules/mantenimientos/mantenimientos.service.js
- backend/src/modules/mantenimientos/mantenimientos.controller.js
- backend/src/modules/mantenimientos/mantenimientos.routes.js
- backend/src/modules/mantenimientos/mantenimiento.scheduler.js
- backend/src/modules/schedules/schedules.service.js
- spi_front/src/modules/servicio/pages/Mantenimientos.jsx
- spi_front/src/modules/servicio/components/MantenimientosList.jsx
- spi_front/src/core/api/mantenimientosApi.js
- spi_front/src/modules/comercial/hooks/useSchedules.js
- spi_front/src/modules/comercial/pages/PlanificacionMensual.jsx
- spi_front/src/modules/comercial/pages/AprobacionCronogramas.jsx

Archivos sugeridos a crear o extender:
- backend/src/modules/mantenimientos/preventivePlanning.service.js
- backend/src/modules/mantenimientos/preventiveOffer.service.js
- backend/src/modules/mantenimientos/preventiveCompliance.service.js
- backend/src/modules/mantenimientos/fst16.service.js
- backend/src/modules/mantenimientos/fst17.service.js
- spi_front/src/modules/servicio/components/PreventiveAnnualPlanBoard.jsx
- spi_front/src/modules/servicio/components/PreventiveEquipmentSchedulePanel.jsx
- spi_front/src/modules/servicio/components/PreventiveOfferModal.jsx
- spi_front/src/modules/servicio/components/ReprogrammingNoticeModal.jsx

Implementa en backend:
1. `F.ST-16` como cronograma anual preventivo.
2. `F.ST-17` por equipo.
3. Base de planificacion con garantia, contrato, frecuencia y propietario.
4. Oferta preventiva `Anexo 4` para fuera de garantia.
5. Reprogramacion formal `Anexo 5`.
6. Solicitud de kits en ventana de 10 dias del mes previo.
7. Registro de salida de bodega.
8. Cierre preventivo con `WO`, `F.ST-17`, `Anexo 6`.
9. KPI de cumplimiento segun regla exacta del procedimiento: solo cuenta como cumplido si ocurre en el mismo mes planificado.
10. Uso del `Anexo 7` para capacidad operativa y planeacion.

Implementa en frontend:
1. Evoluciona `Mantenimientos.jsx` para que deje de ser solo formulario de alta y pase a ser workspace preventivo/correctivo con tabs o vistas claramente separadas.
2. Crea visualizaciones para:
   - plan anual
   - plan por equipo
   - ofertas pendientes
   - reprogramaciones
   - kits pendientes
   - cumplimiento mensual
3. Mantener el tono visual actual:
   - chips de estado simples
   - cards suaves
   - acciones directas
   - sin tablas imposibles de usar

No hacer:
- No mezclar preventivo y correctivo en un solo flujo sin diferencia procedural.
- No usar solo observaciones libres donde el procedimiento exige estructura.

Aceptacion obligatoria:
- Existe plan anual real.
- Existe cronograma por equipo.
- Existe medicion de cumplimiento correcta.
- El frontend permite gestionar preventivos con criterio empresarial real.
```

## 13. Prompt 08 - Mantenimientos correctivos ST-01-03 y flujo CEAC

Relacion de requerimientos: `REQ-ST-101` a `REQ-ST-119`.

```text
Eres una IA programadora senior full stack. Implementa el flujo correctivo ST-01-03 completo, integrando primer nivel CEAC, escalamiento, cotizaciones de partes y cierre tecnico.

Objetivo:
Pasar de mantenimientos correctivos genericos a un flujo formal que contemple:
- primer nivel CEAC
- escalamiento a visita
- clasificacion entre aplicaciones e ingenieria
- repuestos con garantia o cotizacion
- reprogramacion de visita
- desinfeccion de partes retiradas
- cierre con trazabilidad completa

Archivos obligatorios a revisar:
- backend/src/modules/mantenimientos/mantenimientos.service.js
- backend/src/modules/support-tickets/supportTickets.service.js
- backend/src/modules/support-tickets/supportTickets.controller.js
- backend/src/modules/support-tickets/supportTickets.routes.js
- spi_front/src/modules/ti/pages/TicketsWorkspace.jsx
- spi_front/src/modules/servicio/pages/Solicitudes.jsx
- spi_front/src/modules/servicio/components/solicitudes/TecnicoSolicitudesView.jsx
- spi_front/src/modules/servicio/components/solicitudes/JefeTecnicoSolicitudesView.jsx
- spi_front/src/modules/servicio/components/solicitudes/modals/RequerimientoRepuestosModal.jsx
- backend/src/modules/servicio/desinfeccion.service.js

Archivos sugeridos a crear o extender:
- backend/src/modules/servicio/correctiveCases.service.js
- backend/src/modules/servicio/correctiveStateMachine.service.js
- backend/src/modules/servicio/ceacDispatch.service.js
- backend/src/modules/servicio/sparePartsQuotation.service.js
- spi_front/src/modules/servicio/components/CorrectiveCaseWorkspace.jsx
- spi_front/src/modules/servicio/components/CorrectiveCaseTimeline.jsx
- spi_front/src/modules/servicio/components/PartQuotationPanel.jsx

Implementa en backend:
1. Un caso correctivo formal distinto del ticket TI generico, pero reutilizando patrones maduros de SLA, comentarios y eventos de `supportTickets.service.js`.
2. Ingreso obligatorio por CEAC o equivalente funcional.
3. Cierre remoto cuando primer nivel resuelva.
4. Escalamiento a visita en sitio con dispatcher local.
5. Clasificacion a aplicaciones o ingenieria.
6. Integracion con repuestos:
   - garantia
   - fuera de garantia con cotizacion a comercial
   - aceptacion o rechazo del cliente
   - nueva visita para cambio
7. Integracion con `F.ST-02` cuando corresponda descontaminacion de partes retiradas.
8. Historial completo de causa, acciones, partes, evidencia y resultado final.

Implementa en frontend:
1. Un workspace de casos correctivos basado en el patron de `TicketsWorkspace.jsx`, pero adaptado a servicio tecnico.
2. Panel de timeline del caso, comentarios internos, evidencia y repuestos.
3. Acciones claras por rol:
   - CEAC
   - dispatcher
   - especialista de aplicaciones
   - ingeniero de campo
   - comercial para cotizacion
4. Mantener consistencia visual con tablas/cards/chips ya usados.

Aceptacion obligatoria:
- Existe primer nivel CEAC.
- Existe escalamiento y clasificacion tecnica.
- Existe flujo de cotizacion de partes fuera de garantia.
- El correctivo queda trazado de punta a punta.
```

## 14. Prompt 09 - Casos externos REXIS / Navify / GoApp ST-01-04

Relacion de requerimientos: `REQ-ST-120` a `REQ-ST-137`.

```text
Eres una IA programadora senior full stack. Implementa la capa de integracion externa para ST-01-04 sin inventar contratos no documentados.

Objetivo:
Construir una arquitectura productiva y segura para integrar casos externos con:
- Navify / Online Support
- REXIS
- GoApp

Pero hacerlo sin asumir payloads no aprobados. Si faltan contratos externos, debes dejar la capa de adaptacion lista, feature-flagged y con tracking interno completo.

Archivos obligatorios a revisar:
- backend/src/modules/support-tickets/supportTickets.service.js
- backend/src/modules/equipment-purchases/equipmentPurchases.service.js
- backend/src/modules/private-purchases/privatePurchases.service.js
- backend/src/modules/servicio/servicio.controller.js
- backend/src/modules/integrations/integrations.routes.js
- spi_front/src/modules/ti/pages/TicketsWorkspace.jsx
- spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx
- spi_front/src/routes/AppRoutes.jsx

Archivos sugeridos a crear o extender:
- backend/src/modules/servicio/externalCases.service.js
- backend/src/modules/servicio/externalCases.controller.js
- backend/src/modules/servicio/externalCases.routes.js
- backend/src/modules/servicio/adapters/navify.adapter.js
- backend/src/modules/servicio/adapters/rexis.adapter.js
- backend/src/modules/servicio/adapters/goapp.adapter.js
- backend/src/modules/servicio/externalCaseSync.service.js
- spi_front/src/modules/servicio/pages/ExternalCasesWorkspace.jsx
- spi_front/src/modules/servicio/components/ExternalIntegrationHealthPanel.jsx

Implementa en backend:
1. Modelo interno de caso externo con estado, proveedor, payload normalizado, payload original, errores de sync, intentos y ultima sincronizacion.
2. Adaptadores por proveedor desacoplados.
3. Feature flags y validacion de configuracion por proveedor.
4. Cola o mecanismo de reintento seguro para sincronizacion.
5. Registro de errores y reconciliacion de estados entre sistema interno y sistema externo.
6. Hitos operativos de GoApp:
   - accept work order
   - start travel
   - work time
   - finalize work order
   - follow-up appointment
7. Si no existe contrato oficial de un proveedor, no inventes payload final. En ese caso:
   - implementa interfaz interna
   - implementa adapter stub
   - deja error funcional controlado
   - expone health/status
   - documenta exactamente que dato externo falta

Implementa en frontend:
1. Workspace de integraciones/casos externos para jefatura tecnica y soporte.
2. Estado de salud por proveedor.
3. Lista de casos con:
   - estado interno
   - estado externo
   - fecha de ultimo sync
   - error
   - accion de reintento
4. Mantener la misma familia visual del dashboard actual.

Aceptacion obligatoria:
- Existe capa de adaptacion desacoplada.
- Existe tracking interno aunque un proveedor no este aun habilitado.
- No se inventan payloads externos no confirmados.
- Los errores de sincronizacion son visibles y reintentables.
```

## 15. Prompt 10 - Unificacion frontend, QA, regresion, trazabilidad y cierre

Relacion de requerimientos: consolidacion de todos los `REQ-ST-*`, foco especial en `REQ-ST-151` y `REQ-ST-152`.

```text
Eres una IA programadora senior full stack. Realiza la fase de consolidacion final para que la automatizacion ST quede utilizable, consistente y validable en un entorno empresarial.

Objetivo:
Cerrar la implementacion con calidad de entrega: frontend coherente, rutas registradas, APIs integradas, pruebas, trazabilidad REQ-ST y documentacion operativa.

Archivos obligatorios a revisar:
- spi_front/src/routes/AppRoutes.jsx
- spi_front/src/core/ui/components/Card.jsx
- spi_front/src/core/ui/components/Button.jsx
- spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx
- spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx
- spi_front/src/modules/servicio/pages/Mantenimientos.jsx
- spi_front/src/modules/ti/pages/TicketsWorkspace.jsx
- backend/src/routes/registerRoutes.js
- backend/src/app.js
- docs/Procedimientos/LEVANTAMIENTO_REQUERIMIENTOS_AUTOMATIZACION_ST.md

Implementa:
1. Revisión visual de todos los nuevos flujos para que mantengan:
   - mismas bases de color
   - mismas formas de boton
   - cards con radios y sombras coherentes
   - overlays y modales consistentes
   - feedback de carga/error consistente
2. Extraccion de utilidades compartidas si detectas duplicacion de:
   - normalizacion de fechas
   - mapeo de estados
   - render de badges
   - timeline de workflow
3. Verificacion de que cada endpoint nuevo tenga su cliente API en `spi_front/src/core/api`.
4. Verificacion de que cada vista nueva este registrada en `spi_front/src/routes/AppRoutes.jsx`.
5. Verificacion de que cada modulo backend nuevo este montado en `backend/src/routes/registerRoutes.js`.
6. Pruebas:
   - smoke de backend por flujo
   - smoke de frontend por ruta principal
   - prueba documental de emision
   - prueba de estados y transiciones invalidas
7. Matriz final de trazabilidad `REQ-ST -> archivo/endpoint/pantalla`.
8. Resumen de pendientes reales:
   - templates no aprobados
   - contratos externos faltantes
   - credenciales de terceros no entregadas

Entregables obligatorios:
- codigo final coherente
- lista de pruebas ejecutadas
- matriz de trazabilidad
- bloqueos reales documentados sin inventar cierres falsos

Regla final:
No declares completado ningun requerimiento si solo dejaste placeholders cosmeticos. Un REQ-ST solo cuenta como cubierto si existe logica, persistencia, UI y trazabilidad suficiente para operarlo.
```

## 16. Nota final de uso

Si se desea ejecutar esta implementacion con varias IAs o en varias sesiones, usa `Prompt 00` primero y luego asigna prompts por write-set no superpuesto. Si los write-sets se pisan, ejecuta los prompts en serie y no en paralelo.

Este pack de prompts esta diseñado para que una IA programadora trabaje con criterio de ingenieria y no como generador de codigo aislado.
