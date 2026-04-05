# Levantamiento de requerimientos para automatizacion integral de procedimientos ST-01

## 1. Objetivo

Este documento levanta requerimientos de software para automatizar de forma integral los procedimientos `ST-01-01`, `ST-01-02`, `ST-01-03` y `ST-01-04`, cotejando exclusivamente:

- el contenido verificable de los procedimientos PDF ubicados en `docs/Procedimientos`
- el codigo actual del frontend y backend del sistema
- las plantillas PDF y los servicios que hoy ya realizan autollenado

Regla metodologica aplicada: no se asume comportamiento no evidenciado. Cuando el procedimiento exige algo y el codigo no lo demuestra, el documento lo marca como brecha y lo convierte en requerimiento.

## 2. Fuentes verificadas

### 2.1 Procedimientos analizados

- `ST-01-01_V09_INSTALACION, RETIRO, ENTRENEMIENTO DE EQUIPO Y SOFTWARE.pdf`
- `ST-01-02_V08_PLANIFICACION Y EJECUCION DE MANTENIMIENTOS PREVENTIVOS.pdf`
- `ST-01-03_V08_MANTENIMIENTOS CORRECTIVOS DE EQUIPOS Y SOFTWARE.pdf`
- `ST-01-04_V01_CREACION DE CASOS DE ATENCION PARA REPORTE EN REXIS - GO.pdf`

### 2.2 Modulos y archivos de codigo cotejados

- Frontend comercial: `spi_front/src/modules/comercial`
- Frontend servicio tecnico: `spi_front/src/modules/servicio`
- Frontend cronogramas comerciales: `spi_front/src/modules/comercial/hooks/useSchedules.js`, `useScheduleApproval.js`
- Frontend tickets TI reutilizable como patron: `spi_front/src/modules/ti/pages/TicketsWorkspace.jsx`
- Backend servicio tecnico: `backend/src/modules/servicio`
- Backend solicitudes / F.ST-20: `backend/src/modules/requests/requests.service.js`
- Backend compras publicas: `backend/src/modules/equipment-purchases/equipmentPurchases.service.js`
- Backend compras privadas: `backend/src/modules/private-purchases/privatePurchases.service.js`
- Backend acta F.ST-10: `backend/src/modules/private-purchases/privatePurchases.acta.js`
- Backend business case / preflow: `backend/src/modules/business-case/businessCasePreflow.service.js`
- Backend mantenimientos: `backend/src/modules/mantenimientos/mantenimientos.service.js`
- Backend cronogramas: `backend/src/modules/schedules/schedules.service.js`
- Backend tickets de soporte reutilizable como patron: `backend/src/modules/support-tickets`

## 3. Estado actual cotejado con codigo

- `ST-01-01`: implementado parcial. Existe un workspace tecnico unificado y generacion de `F.ST-20`, `F.ST-02`, `F.ST-04`, `F.ST-05`, `F.ST-09`, con trazabilidad de documentos en `servicio.workflow_documents`.
- `ST-01-02`: implementado parcial reusable. Existe un modulo de mantenimientos, pero no se evidencio el flujo completo del procedimiento con `F.ST-16`, `F.ST-17`, oferta de mantenimiento, reprogramacion formal y cumplimiento mensual segun procedimiento.
- `ST-01-03`: implementado parcial reusable. Existe soporte generico para mantenimientos correctivos y piezas, pero no se evidencio el circuito completo `CEAC -> dispatcher -> caso/WO -> cotizacion -> repuesto -> cierre` exigido por el procedimiento.
- `ST-01-04`: no evidenciado. No se encontro integracion directa con `REXIS`, `Navify`, `Online Support` o `GoApp` en `spi_front/src` ni en `backend/src`.
- `Business Case / Comercial`: implementado parcial reusable. Existe `preflow` de business case con secciones obligatorias, SLA, creacion automatica de proceso de compra y bandera de coordinacion de inspeccion.
- `Cronogramas comerciales`: implementado parcial reusable. Existe planificacion, aprobacion, equipo, analitica y uso del cronograma aprobado para filtrar cartera, pero no se evidencio acople integral con todos los workflows tecnicos ST.
- `Tickets TI`: implementado reusable. Existe un modulo de tickets maduro, util como patron tecnico, pero no reemplaza la integracion funcional requerida por `ST-01-04`.

## 4. Formatos y datos auto llenables verificados

### 4.1 Formatos con evidencia de autollenado actual

- `F.ST-20 Solicitud de inspeccion de ambiente`
  Campos verificados en servicio actual: `asesor`, `fecha`, `correo`, `cliente`, `dir_cliente`, `pc_cliente`, `cp_cliente`, `fecha_ins`, `req_lis`, `Acc_extras`, `obs`, `equipo_1..4`, `e_equipo_1..4`.

- `F.ST-02 Desinfeccion de instrumentos y partes`
  Campos generales verificados: `Fecha`, `Equipo`, `Serie`, `Responsable`, `parte_repuesto`.
  Checks verificados: `chk_general`, `chk_PEO`, `chk_PEO_1`, `chk_OP_1`, `chk_en`, `chk_CP`, `chk_lim`, `chk_cloro`, `chk_OP_cloro`, `chk_PS`, `chk_PS_peo`, `chk_PS_op`, `chk_tras`, `chk_tras_peo`, `chk_tras_op`, `chk_CD_op`, `chk_CD_peo`, `chk_CD`, `chk_DFD`, `chk_DFD_peo`, `chk_DFD_op`, `chk_CVTE`, `chk_CP_op`, `chk_en_op`.
  Campos de imagen verificados: `firma_ing_SC_af_image`, `adjunto_af_image`.

- `F.ST-04 Coordinacion de la fecha de entrenamiento`
  Campos verificados: `ORDEquipo`, `ORDSerie`, `ORDResponsable`, `ORDCliente`, `ORDNumero`, `Fecha_Inicio`, `Fecha_final`, `Dias`, `Horas`, `Num_P`, `Obs_1`, `Obs_2`, `Obs_3`, `Obs_4`, `Firma_af_image`.

- `F.ST-05 Lista de asistencia entrenamientos`
  Campos generales verificados: `ORDFecha`, `ORDCliente`, `ORDEquipo`, `ORDSerie`, `ORDResponsable`, `Num_Orden`.
  Filas de asistentes verificadas: `Nombres_Apellidos1..7`, `Cargo1..7`, `Correo_Electrónico1..7`.
  Marcas de asistencia verificadas en plantilla inspeccionada: `Dia_1`, `Dia_1_2..7`, `Dia_2`, `Dia_2_2..7`, `Dia_3`, `Dia_3_2..7`.

- `F.ST-09 Verificacion de equipos nuevos`
  Campos verificados en plantilla: `Fecha`, `Cliente`, `Equipo`, `Serie`, `RESULTADOS`, `ANÁLISIS`, `frima_af_image`, `anexos_af_image`.
  Campos que el servicio actual intenta llenar: `Fecha`, `Cliente`, `Equipo`, `Serie`, `RESULTADOS`, `ANALISIS`, `firma_af_image`, `anexos_af_image`.

- `F.ST-10 Acta de entrega`
  Campos que el codigo actual intenta llenar: `num_acta`, `nom_cliente`, `ruc_cedula`, `dir`, `tel`, `fecha_entrega`, `cod_equipo_1..7`, `nom_equipo_1..7`, `cant_equipo_1..7`, `serie_equipo_1..7`, `ob_1..3`, `des_por`, `fecha_des`, `ent_por`, `fecha_ent`.

### 4.2 Formatos citados en procedimiento sin evidencia suficiente de autollenado actual

- `F.ST-07` inspeccion de ambiente / sitio
- `F.ST-11` acta de retiro
- `F.ST-12` acta de conformidad posterior a entrenamiento
- `F.ST-14` informe de instalacion / recepcion visual
- `F.ST-16` cronograma anual de mantenimiento preventivo
- `F.ST-17` cronograma de mantenimiento preventivo por equipo
- `F.ST-18` cronograma de entrenamiento de servicio
- `F.ST-19` solicitud alternativa para negociaciones especificas
- `F.ST-21` citado en relacionados de `ST-01-01`
- anexos operativos citados en los procedimientos que deben quedar digitalizados y ligados al workflow

### 4.3 Inconsistencias verificadas entre codigo y plantilla

- `F.ST-09`: la plantilla inspeccionada expone `frima_af_image`, mientras el servicio busca `firma_af_image`.
- `F.ST-09`: la plantilla inspeccionada expone `ANÁLISIS`, mientras el servicio escribe `ANALISIS`.
- `F.ST-05`: el servicio llena `Dia_1_1..Dia_3_7`, pero la plantilla inspeccionada expone `Dia_1`, `Dia_1_2..7`, `Dia_2`, `Dia_2_2..7`, `Dia_3`, `Dia_3_2..7`.
- `F.ST-05`: el servicio espera `Firma_Especialista`, pero ese campo no fue evidenciado en la plantilla inspeccionada.
- `F.ST-02`: el frontend y el servicio manejan `chk_CVITE`, pero la plantilla inspeccionada expone `chk_CVTE`.
- `F.ST-02`: el frontend y el servicio manejan `chk_DFD_o`, pero la plantilla inspeccionada expone `chk_DFD_op`.

## 5. Catalogo de requerimientos

### 5.1 Gobierno, trazabilidad y maestros

- `REQ-ST-001`. El sistema debera asignar un identificador unico de workflow por cada ejecucion de `ST-01-01`, `ST-01-02`, `ST-01-03` y `ST-01-04`, enlazado a `source_type`, `source_id`, `request_id`, cliente, equipo, estado y documentos. Estado actual: parcial.
- `REQ-ST-002`. El sistema debera mantener una maquina de estados por procedimiento y subetapa, con transiciones auditables para inspeccion, instalacion, entrenamiento, retiro, mantenimiento preventivo, mantenimiento correctivo y reporte externo. Estado actual: parcial.
- `REQ-ST-003`. El sistema debera administrar una matriz de roles y permisos alineada con los procedimientos para `Gerencia General`, `Responsable Tecnico`, `Jefe de Servicio Tecnico`, `Ingeniero de Servicio de Campo`, `Especialista de Aplicaciones`, `Comercial`, `Backoffice Comercial`, `CEAC` y `Dispatcher`. Estado actual: parcial.
- `REQ-ST-004`. El sistema debera registrar auditoria completa de cada cambio de estado, aprobacion, rechazo, coordinacion, carga documental, firma, reprogramacion y cierre, incluyendo actor, fecha, hora, modulo origen y payload relevante. Estado actual: parcial.
- `REQ-ST-005`. El sistema debera mantener un repositorio documental por workflow con versionado, estado de emision, referencia al template usado, hash del archivo final y relacion con el equipo y el cliente. Estado actual: parcial.
- `REQ-ST-006`. El sistema debera unificar un maestro de equipos para que comercial, servicio, compras, business case, mantenimientos y correctivos usen el mismo identificador tecnico del equipo, serie, modelo, marca, garantia y contrato. Estado actual: parcial.
- `REQ-ST-007`. El sistema debera congelar un `snapshot` del cliente y del contexto comercial al inicio del workflow para evitar que cambios posteriores alteren la evidencia historica de formularios ya emitidos. Estado actual: parcial.
- `REQ-ST-008`. El sistema debera enlazar cada etapa tecnica con su `Work Order` o referencia CRM, y si una etapa se ejecuta sin `WO` debera registrar motivo, aprobador y fecha. Estado actual: parcial.
- `REQ-ST-009`. El sistema no debera permitir saltar prerequisitos obligatorios de un procedimiento, salvo excepcion aprobada por rol autorizado y con justificacion documentada. Estado actual: parcial.
- `REQ-ST-010`. El sistema debera exponer una vista consolidada de avance por workflow con documentos generados, hitos pendientes, responsables actuales, proxima accion y alertas de incumplimiento. Estado actual: parcial.

### 5.2 Business case, comercial y planeacion previa

- `REQ-ST-011`. El sistema debera exigir en `Business Case Preflow` las secciones `general`, `lab`, `requirement`, `equipment` y `lis` antes de permitir crear el proceso comercial derivado. Estado actual: implementado parcial.
- `REQ-ST-012`. El sistema debera manejar un SLA configurable de `48` horas para el preflow, con ventanas por etapa, tiempo restante, expiracion y evidencia de quien activo y quien cerro cada etapa. Estado actual: implementado parcial.
- `REQ-ST-013`. El sistema debera crear automaticamente el proceso de compra publica o compra privada en comodato cuando el `Business Case` complete sus secciones requeridas y pase la fase aplicable. Estado actual: implementado parcial.
- `REQ-ST-014`. El sistema debera persistir en el `Business Case` los metadatos `preflow_process_created`, `preflow_process_type`, `preflow_process_id` y `preflow_inspection_coordination_required` para garantizar trazabilidad aguas abajo. Estado actual: implementado parcial.
- `REQ-ST-015`. El sistema debera notificar a los actores comerciales y tecnicos cuando un `Business Case` quede listo para coordinacion de inspeccion, indicando el proceso creado y la accion esperada. Estado actual: implementado parcial.
- `REQ-ST-016`. El sistema debera soportar reapertura, extension y resolucion de casos `preflow` expirados, conservando motivo, aprobador, horas adicionales y nuevas fechas compromiso. Estado actual: implementado parcial.
- `REQ-ST-017`. El sistema debera distinguir claramente workflows originados en `Business Case` de workflows originados en solicitud comercial directa, sin perder trazabilidad comun de documentos y actividades. Estado actual: parcial.
- `REQ-ST-018`. El sistema debera permitir que comercial solicite la inspeccion de ambiente definiendo ventana minima y maxima de visita, y opcionalmente indicando requerimientos complementarios como `starter kit` cuando el flujo lo use. Estado actual: implementado parcial.
- `REQ-ST-019`. El sistema debera validar que toda fecha propuesta de inspeccion caiga dentro de la ventana comercial aprobada y debera rechazar fechas fuera de rango con mensaje funcional y evidencia del intento. Estado actual: implementado parcial.
- `REQ-ST-020`. El sistema debera validar capacidad tecnica diaria antes de aceptar fechas de inspeccion, reinspeccion, instalacion, entrenamiento o mantenimiento, cruzando agenda tecnica, conflictos del dia y capacidad maxima configurada. Estado actual: parcial.
- `REQ-ST-021`. El sistema debera permitir revision y aprobacion o rechazo de fechas propuestas por parte del jefe tecnico, registrando notas de revision, actor, fecha, motivo y fecha final aceptada. Estado actual: implementado parcial.
- `REQ-ST-022`. El sistema debera integrar los cronogramas comerciales aprobados con la planeacion de cartera, visitas y rutas, de forma que la planificacion comercial no quede aislada del workflow tecnico posterior. Estado actual: parcial reusable.

### 5.3 ST-01-01 - Inspeccion de ambiente y habilitacion del sitio

- `REQ-ST-023`. El sistema debera generar automaticamente `F.ST-20` a partir de datos de cliente, direccion, equipos y ventana de inspeccion provenientes de compras publicas, compras privadas o solicitudes comerciales formales. Estado actual: implementado parcial.
- `REQ-ST-024`. El sistema debera autollenar en `F.ST-20` exactamente los campos hoy evidenciados: `asesor`, `fecha`, `correo`, `cliente`, `dir_cliente`, `pc_cliente`, `cp_cliente`, `fecha_ins`, `req_lis`, `Acc_extras`, `obs`, `equipo_1..4`, `e_equipo_1..4`. Estado actual: implementado.
- `REQ-ST-025`. El sistema debera soportar la ruta alternativa `F.ST-19` para negociaciones especificas donde comercial requiera obtener costos de instalacion antes de cerrar la venta. Estado actual: no evidenciado.
- `REQ-ST-026`. El sistema debera enrutar toda solicitud de inspeccion al jefe de servicio tecnico para aprobacion o negacion, registrando la decision y su fundamento. Estado actual: parcial.
- `REQ-ST-027`. El sistema debera registrar la comunicacion de fecha y hora de inspeccion al cliente por correo y la confirmacion verbal exigida por el procedimiento, dejando evidencia del responsable y del canal utilizado. Estado actual: no evidenciado.
- `REQ-ST-028`. El sistema debera coordinar la fecha de inspeccion con disponibilidad real del ingeniero de campo y debera prevenir sobreasignaciones en una misma jornada. Estado actual: parcial.
- `REQ-ST-029`. El sistema debera digitalizar y mantener `F.ST-07` como registro estructurado de checklist, resultado, observaciones, recomendaciones, responsable en sitio y fecha de reinspeccion cuando aplique. Estado actual: parcial.
- `REQ-ST-030`. El sistema debera exigir legalizacion del resultado conforme del sitio mediante firma y, cuando el modelo documental lo requiera, sello del cliente equivalente a los puntos formales del `F.ST-07`. Estado actual: parcial.
- `REQ-ST-031`. El sistema debera obligar fecha de seguimiento o reinspeccion cuando el resultado de `F.ST-07` sea no conforme, y debera dejar el workflow en estado `non_compliant_reinspection_pending` o equivalente trazable. Estado actual: implementado parcial.
- `REQ-ST-032`. El sistema debera soportar multiples reinspecciones conservando historial completo de hallazgos, acciones correctivas solicitadas al cliente y fecha en que el sitio finalmente quedo conforme. Estado actual: parcial.
- `REQ-ST-033`. El sistema no debera permitir continuar a instalacion fisica mientras el sitio no este conforme, salvo autorizacion excepcional documentada por rol competente. Estado actual: parcial.
- `REQ-ST-034`. El sistema debera almacenar y publicar en el workflow el enlace al acta `F.ST-20`, el reporte `F.ST-07`, el checklist de inspeccion, el resultado de preparacion y cualquier evidencia fotografica asociada. Estado actual: implementado parcial.
- `REQ-ST-035`. El sistema debera habilitar el mismo manejo de inspeccion para compras publicas y privadas dentro del workspace tecnico, sin fragmentar la experiencia ni perder diferencias de negocio entre ambos flujos. Estado actual: parcial.
- `REQ-ST-036`. El sistema debera emitir notificaciones en cada hito de inspeccion: solicitud creada, fecha propuesta, fecha aprobada, fecha rechazada, resultado conforme, resultado no conforme, reinspeccion pendiente y reinspeccion cerrada. Estado actual: parcial.

### 5.4 ST-01-01 - Instalacion, entrega y verificacion de equipos

- `REQ-ST-037`. El sistema debera gestionar la solicitud de despacho al proveedor con al menos `15` dias de anticipacion cuando el procedimiento lo exija para instalaciones nuevas. Estado actual: no evidenciado.
- `REQ-ST-038`. El sistema debera registrar en la solicitud de despacho los datos minimos del cliente, direccion, fecha requerida, equipo, cantidad y serie cuando ya exista. Estado actual: no evidenciado.
- `REQ-ST-039`. El sistema debera registrar la validacion de logistica respecto a guia contra proforma antes de liberar la instalacion. Estado actual: no evidenciado.
- `REQ-ST-040`. El sistema debera registrar la inspeccion fisica del ingeniero contra guias, empaque, indicadores de inclinacion y manipulacion antes de mover el equipo a instalacion. Estado actual: parcial.
- `REQ-ST-041`. El sistema debera digitalizar `F.ST-14` para registrar recepcion visual, hallazgos, fotos y acciones derivadas de instalacion o preinstalacion. Estado actual: no evidenciado.
- `REQ-ST-042`. El sistema debera soportar el flujo diferenciado para equipos `CU`, incluyendo solicitud previa de partes y accesorios necesarios antes de instalar. Estado actual: no evidenciado.
- `REQ-ST-043`. El sistema debera registrar la coordinacion con logistica para traslado, embalaje interno y cadena de custodia del equipo hasta el punto de instalacion. Estado actual: no evidenciado.
- `REQ-ST-044`. El sistema debera generar `F.ST-10` como acta de entrega con detalle por item, serie, cantidad, actores de despacho y entrega y fechas de cada acto. Estado actual: implementado parcial.
- `REQ-ST-045`. El sistema debera soportar la emision de dos copias legalizadas o equivalente digital formal del `F.ST-10`, garantizando que una quede en historial interno y otra disponible para el cliente. Estado actual: parcial.
- `REQ-ST-046`. El sistema debera exigir una validacion comercial previa de que el cliente cuenta con insumos, consumibles y reactivos antes de la fecha de instalacion. Estado actual: no evidenciado.
- `REQ-ST-047`. El sistema debera crear, tomar y cerrar `Work Orders` de tipo `Installation` y `Installation Continued` segun la continuidad real de la ejecucion en campo. Estado actual: no evidenciado en forma integral.
- `REQ-ST-048`. El sistema debera registrar actividades de instalacion tanto en `Anexo 5 Reporte de Servicio` como en `F.ST-14`, y adjuntar `F.ST-14` al `WO/CRM`. Estado actual: no evidenciado.
- `REQ-ST-049`. El sistema debera registrar la decision de si aplica o no verificacion del equipo segun guia del fabricante o portal del proveedor, indicando la fuente tecnica de esa decision. Estado actual: no evidenciado.
- `REQ-ST-050`. El sistema debera permitir al especialista ejecutar y documentar en `F.ST-09` las pruebas de precision o pruebas basicas, comparando resultados contra la guia del fabricante y almacenando el criterio usado. Estado actual: implementado parcial.
- `REQ-ST-051`. El sistema debera crear un ciclo de remediacion cuando la verificacion arroje valores incorrectos, obligando a revision del ingeniero y repeticion formal de la verificacion antes del cierre final. Estado actual: no evidenciado.
- `REQ-ST-052`. El sistema debera permitir el cierre de la instalacion sin `F.ST-09` solo cuando la verificacion no aplique, y debera registrar esa excepcion con justificacion y aprobador. Estado actual: no evidenciado.
- `REQ-ST-053`. El sistema debera adjuntar el reporte de reparacion del proveedor para equipos `CU` cuando el procedimiento lo requiera antes del cierre de instalacion. Estado actual: no evidenciado.

### 5.5 ST-01-01 - Entrenamiento y entrenamiento de software

- `REQ-ST-054`. El sistema debera permitir que comercial coordine fecha, hora y numero de participantes del entrenamiento con el cliente y con jefatura tecnica. Estado actual: parcial.
- `REQ-ST-055`. El sistema debera generar `F.ST-04` autollenando los campos hoy evidenciados: `ORDEquipo`, `ORDSerie`, `ORDResponsable`, `ORDCliente`, `ORDNumero`, `Fecha_Inicio`, `Fecha_final`, `Dias`, `Horas`, `Num_P`, `Obs_1..4`, `Firma_af_image`. Estado actual: implementado parcial.
- `REQ-ST-056`. El sistema debera exigir confirmacion comercial de disponibilidad de insumos, consumibles y reactivos antes de la fecha del entrenamiento. Estado actual: no evidenciado.
- `REQ-ST-057`. El sistema debera crear y trazar el `Work Order` de tipo `Training Initial` para el especialista de aplicaciones. Estado actual: no evidenciado en forma integral.
- `REQ-ST-058`. El sistema debera disponibilizar al especialista el paquete documental digital requerido por el procedimiento: `F.ST-05`, `F.ST-06`, `F.ST-08` y `F.ST-12`, ligado al mismo workflow de entrenamiento. Estado actual: parcial.
- `REQ-ST-059`. El sistema debera generar `F.ST-05` con datos generales del entrenamiento y filas de asistentes con nombres, cargo y correo, evitando captura duplicada cuando esa data ya exista en el cliente o en el entrenamiento. Estado actual: implementado parcial.
- `REQ-ST-060`. El sistema debera manejar la limitacion actual de plantilla de `F.ST-05` para `7` asistentes por bloque y debera definir estrategia formal para grupos mayores sin perder validez documental. Estado actual: no evidenciado.
- `REQ-ST-061`. El sistema debera capturar legalizacion de asistencia por participante con evidencia equivalente a firma en la lista de asistencia. Estado actual: parcial.
- `REQ-ST-062`. El sistema debera permitir la creacion o habilitacion de usuarios entrenados en la plataforma del proveedor cuando el procedimiento requiera que esos usuarios puedan crear casos futuros. Estado actual: no evidenciado.
- `REQ-ST-063`. El sistema debera registrar las evaluaciones `F.ST-08` y aplicar las reglas del procedimiento: asistencia del `100%` y aprobacion minima del `80%` para considerar completado el entrenamiento. Estado actual: no evidenciado.
- `REQ-ST-064`. El sistema debera abrir automaticamente un flujo de reentrenamiento cuando la asistencia no llegue al `100%` o la evaluacion no alcance el `80%`, bloqueando la emision del certificado hasta regularizar el caso. Estado actual: no evidenciado.
- `REQ-ST-065`. El sistema debera registrar la evaluacion que el participante hace del especialista y disparar acciones correctivas cuando el puntaje sea menor al umbral definido por el procedimiento. Estado actual: no evidenciado.
- `REQ-ST-066`. El sistema debera cerrar el `WO` de entrenamiento registrando actividades, horas, materiales y anexos asociados al evento formativo. Estado actual: no evidenciado en forma integral.
- `REQ-ST-067`. El sistema debera digitalizar `F.ST-12` para registrar conformidad del entrenamiento con firma y, cuando aplique, sello del cliente. Estado actual: no evidenciado.
- `REQ-ST-068`. El sistema debera emitir y controlar certificados de entrenamiento dentro del plazo maximo de `30` dias, con alertas por vencimiento y trazabilidad de entrega al participante. Estado actual: no evidenciado.
- `REQ-ST-069`. El sistema debera modelar el entrenamiento de software como una etapa formalmente entregada al proveedor TI, con handoff, responsable, fecha y evidencia de cierre. Estado actual: no evidenciado.

### 5.6 ST-01-01 - Retiro, desinstalacion y salida de equipos

- `REQ-ST-070`. El sistema debera permitir que comercial solicite el formulario de desinstalacion o retiro al jefe de servicio tecnico, dejando referencia del origen contractual o comercial del retiro. Estado actual: no evidenciado.
- `REQ-ST-071`. El sistema debera registrar la solicitud del jefe de servicio tecnico al proveedor para la creacion del caso de retiro cuando el procedimiento lo exija. Estado actual: no evidenciado.
- `REQ-ST-072`. El sistema debera generar o recibir automaticamente el `WO` de retiro para el ingeniero de campo, con referencia al equipo, cliente, serie y motivo de salida. Estado actual: no evidenciado.
- `REQ-ST-073`. El sistema debera obligar el registro de desinstalacion y desinfeccion conforme a manual del fabricante y norma `DS23`, utilizando `F.ST-02` como evidencia formal cuando aplique. Estado actual: parcial.
- `REQ-ST-074`. El sistema debera autollenar `F.ST-02` con los campos hoy evidenciados y asociar firma, fotos y anexos al mismo workflow de retiro o cambio de parte. Estado actual: implementado parcial.
- `REQ-ST-075`. El sistema debera registrar la solicitud de retiro en la plataforma del proveedor con evidencia fotografica del equipo y del embalaje, cuando el procedimiento lo exija. Estado actual: no evidenciado.
- `REQ-ST-076`. El sistema debera digitalizar los anexos de etiquetado y embalaje de retiro citados en el procedimiento, incluyendo numero de bultos, etiquetas generadas y responsable de empaque. Estado actual: no evidenciado.
- `REQ-ST-077`. El sistema debera registrar horas, actividades y cierre del `WO` de retiro por parte del ingeniero y la posterior validacion o cierre por jefatura tecnica. Estado actual: no evidenciado.
- `REQ-ST-078`. El sistema debera generar `F.ST-11` como acta de retiro con legalizacion del cliente y relacion directa al equipo retirado, al motivo y a los bultos despachados. Estado actual: no evidenciado.
- `REQ-ST-079`. El sistema debera exigir presencia del ingeniero al momento del retiro fisico para validar cantidad de paquetes y debera dejar evidencia de esa verificacion. Estado actual: no evidenciado.
- `REQ-ST-080`. El sistema debera modelar el retiro de software como una etapa formalmente entregada al proveedor TI, con trazabilidad de solicitud, ejecucion y cierre. Estado actual: no evidenciado.

### 5.7 ST-01-02 - Planificacion y ejecucion de mantenimientos preventivos

- `REQ-ST-081`. El sistema debera generar `F.ST-16 Cronograma Anual de Mantenimiento Preventivo` a partir de una base maestra de equipos y de una base de equipos para mantenimiento. Estado actual: no evidenciado.
- `REQ-ST-082`. El sistema debera generar `F.ST-17 Cronograma de Mantenimiento Preventivo` por cada equipo derivado del `F.ST-16`. Estado actual: no evidenciado.
- `REQ-ST-083`. El sistema debera mantener en la base de planificacion el contexto de garantia, contrato, propietario del equipo, frecuencia y condiciones de mantenimiento para decidir correctamente el flujo preventivo aplicable. Estado actual: parcial.
- `REQ-ST-084`. El sistema debera permitir que, durante el primer trimestre, comercial entregue o notifique al cliente el `F.ST-17` de equipos en garantia y conserve evidencia de esa comunicacion. Estado actual: no evidenciado.
- `REQ-ST-085`. El sistema debera emitir una oferta formal de mantenimiento preventivo `Anexo 4` al menos un mes antes para equipos fuera de garantia. Estado actual: no evidenciado.
- `REQ-ST-086`. El sistema debera registrar la aceptacion o rechazo del cliente a la oferta preventiva y, si es rechazada, debera cancelar la visita en `F.ST-16` dejando motivo y fecha de decision. Estado actual: no evidenciado.
- `REQ-ST-087`. El sistema debera enviar mensualmente al proveedor y a gerencia general el avance del `F.ST-16`, respaldado por evidencia de `WO/CRM` y por el estado real de ejecucion. Estado actual: no evidenciado.
- `REQ-ST-088`. El sistema debera generar una comunicacion formal de reprogramacion `Anexo 5` cuando exista desviacion del cronograma, incluyendo razon, fecha inicialmente comprometida y nueva fecha objetivo. Estado actual: no evidenciado.
- `REQ-ST-089`. El sistema debera permitir al ingeniero coordinar con el cliente el dia y la hora exacta antes de la semana planificada de mantenimiento preventivo. Estado actual: parcial.
- `REQ-ST-090`. El sistema debera crear automaticamente el `WO` preventivo cuando el ingeniero detecte que aun no existe uno asociado al mantenimiento programado. Estado actual: no evidenciado.
- `REQ-ST-091`. El sistema debera soportar la solicitud de kits o repuestos preventivos en el sistema administrativo-financiero dentro de los ultimos `10` dias del mes previo a la ejecucion, generando una solicitud por equipo. Estado actual: no evidenciado.
- `REQ-ST-092`. El sistema debera obligar que la solicitud de kits incluya cliente, equipo, serie y numero de `WO` en observaciones o en campos estructurados equivalentes. Estado actual: no evidenciado.
- `REQ-ST-093`. El sistema debera registrar la salida de kits desde bodega y asociarla al mantenimiento preventivo especifico para cerrar la trazabilidad de consumos. Estado actual: no evidenciado.
- `REQ-ST-094`. El sistema debera guiar la ejecucion del mantenimiento preventivo conforme a manuales del fabricante, tiempos promedio por equipo y normas aplicables, no solo como captura libre de observaciones. Estado actual: parcial.
- `REQ-ST-095`. El sistema debera registrar al cierre del preventivo actividades, tiempos, partes reemplazadas, repuestos usados, observaciones y evidencia documental tanto en `WO` como en `F.ST-17` y `Anexo 6 Reporte de Servicio`. Estado actual: no evidenciado.
- `REQ-ST-096`. El sistema debera calcular el cumplimiento preventivo con la regla exacta del procedimiento: un mantenimiento se considera cumplido unicamente si se ejecuta dentro del mismo mes planificado. Estado actual: no evidenciado.
- `REQ-ST-097`. El sistema debera usar los tiempos promedio por equipo del `Anexo 7` para estimar carga operativa y capacidad del cronograma anual y mensual. Estado actual: no evidenciado.
- `REQ-ST-098`. El sistema debera proveer tableros de cumplimiento preventivo por mes, cliente, marca, equipo, ingeniero, garantia y desvio de programacion. Estado actual: parcial.
- `REQ-ST-099`. El sistema debera permitir rebaselinar el plan anual cuando cambie la base de equipos, cambie la frecuencia o cambie la condicion contractual del equipo, dejando historial de versiones del cronograma. Estado actual: no evidenciado.
- `REQ-ST-100`. El sistema debera adjuntar toda la evidencia preventiva al historial del equipo y al historial del cliente, no solo al registro puntual de mantenimiento. Estado actual: parcial.

### 5.8 ST-01-03 - Mantenimientos correctivos de equipos y software

- `REQ-ST-101`. El sistema debera exigir que todo requerimiento correctivo ingrese por `CEAC` como primer nivel de soporte antes de escalar a visita tecnica, salvo excepcion formalmente autorizada. Estado actual: no evidenciado.
- `REQ-ST-102`. El sistema debera permitir cierre remoto por `CEAC` cuando el problema se resuelva en primer nivel, dejando documentada la solucion sin generar visita en sitio innecesaria. Estado actual: no evidenciado.
- `REQ-ST-103`. El sistema debera permitir que `CEAC` o `Dispatcher local` soliciten visita tecnica en sitio cuando el primer nivel no resuelva el caso. Estado actual: no evidenciado.
- `REQ-ST-104`. El sistema debera notificar al area de servicio tecnico cada nuevo caso correctivo escalado, usando un canal configurable y auditable equivalente al flujo descrito por el procedimiento. Estado actual: no evidenciado.
- `REQ-ST-105`. El sistema debera clasificar cada caso correctivo para `Especialista de Aplicaciones` o `Ingeniero de Campo` segun la naturaleza del problema. Estado actual: no evidenciado.
- `REQ-ST-106`. El sistema debera obligar al asignado a registrar fecha, hora y accion de `qualify`, `dispatch` y `attend` cuando el caso sea gestionado como caso formal y no solo como nota libre. Estado actual: no evidenciado.
- `REQ-ST-107`. El sistema debera exigir que la solucion tecnica quede respaldada por manual del fabricante, guia del proveedor o referencia tecnica validada, almacenando la base de la decision. Estado actual: no evidenciado.
- `REQ-ST-108`. El sistema debera permitir que el especialista cierre el correctivo documentando actividades en el reporte de servicio aplicable y recabando firma del cliente cuando corresponda. Estado actual: parcial reusable.
- `REQ-ST-109`. El sistema debera permitir que el ingeniero cierre el correctivo sin repuestos cuando el problema quede resuelto en una sola visita, documentando actividades y tiempos en el reporte de servicio aplicable. Estado actual: parcial reusable.
- `REQ-ST-110`. El sistema debera reprogramar el `WO` y generar solicitud de repuesto al sistema administrativo-financiero cuando el correctivo requiera partes, incluyendo cliente, equipo, serie y `WO` vinculados. Estado actual: parcial.
- `REQ-ST-111`. El sistema debera distinguir repuestos en garantia de repuestos fuera de garantia, marcando los primeros con costo cero y regla contractual correspondiente. Estado actual: no evidenciado.
- `REQ-ST-112`. El sistema debera permitir que el ingeniero solicite cotizacion a comercial con codigo y descripcion de la parte cuando el equipo este fuera de garantia. Estado actual: no evidenciado.
- `REQ-ST-113`. El sistema debera registrar la decision del cliente sobre la cotizacion del repuesto y debera impedir cambio de parte mientras no exista aceptacion formal. Estado actual: no evidenciado.
- `REQ-ST-114`. El sistema debera cerrar el caso con causal `sin cambio de parte por falta de aprobacion del cliente` cuando la cotizacion sea rechazada. Estado actual: no evidenciado.
- `REQ-ST-115`. El sistema debera coordinar automaticamente una nueva visita para instalar el repuesto aprobado y debera registrar la parte finalmente usada en el cierre del caso. Estado actual: no evidenciado.
- `REQ-ST-116`. El sistema debera obligar desinfeccion y trazabilidad logistica de partes retiradas sin contacto con fluidos usando `F.ST-02` y formulario de recojo del proveedor cuando el procedimiento lo exija. Estado actual: parcial.
- `REQ-ST-117`. El sistema debera enrutar los correctivos de software o de `LIS` al ingeniero del proveedor correspondiente, manteniendo visibilidad del caso dentro del historial del cliente y del equipo. Estado actual: no evidenciado.
- `REQ-ST-118`. El sistema debera incorporar la categorizacion de clientes del anexo referido en el procedimiento para modular prioridad, SLA, despacho y seguimiento de correctivos. Estado actual: no evidenciado.
- `REQ-ST-119`. El sistema debera preservar la trazabilidad integral del correctivo vinculando caso, `WO`, cotizacion, repuesto, desinfeccion, evidencia, causa raiz y resultado final. Estado actual: parcial.

### 5.9 ST-01-04 - Creacion de casos y reporte en REXIS / Navify / GoApp

- `REQ-ST-120`. El sistema debera integrar la creacion de casos correctivos provenientes de `Navify` o `Online Support` sin recaptura manual de informacion ya ingresada por el cliente. Estado actual: no evidenciado.
- `REQ-ST-121`. El sistema debera administrar credenciales y asociaciones de usuarios cliente autorizados para `Navify` u otra plataforma equivalente, vinculandolos con area, laboratorio y equipos habilitados. Estado actual: no evidenciado.
- `REQ-ST-122`. El sistema debera exigir en la creacion del caso la seleccion de area y del equipo por numero de serie cuando el procedimiento asi lo establece. Estado actual: no evidenciado.
- `REQ-ST-123`. El sistema debera exigir registro del codigo de alarma y del tipo de incidencia para poder despachar y reportar correctamente en la plataforma externa. Estado actual: no evidenciado.
- `REQ-ST-124`. El sistema debera exigir descripcion detallada del problema y debera permitir carga de imagenes al momento de crear el caso externo. Estado actual: no evidenciado.
- `REQ-ST-125`. El sistema debera sincronizar hacia `REXIS/GoApp` al menos cliente, serie del equipo, alarma, tipo de problema, fecha-hora de creacion y fotos, preservando la correspondencia con el caso interno. Estado actual: no evidenciado.
- `REQ-ST-126`. El sistema debera permitir que `CEAC` visualice el caso externo, determine si resuelve en primer nivel o si escala a visita, y deje esa decision dentro del expediente unico del caso. Estado actual: no evidenciado.
- `REQ-ST-127`. El sistema debera generar una tarea de `Dispatcher local` y una notificacion por canal configurable equivalente a `Google Chat` cuando el caso deba pasar a visita en campo. Estado actual: no evidenciado.
- `REQ-ST-128`. El sistema debera permitir al tecnico aceptar la `Work Order` en `GoApp` o plataforma equivalente y registrar formalmente `start travel` antes de iniciar `work time`. Estado actual: no evidenciado.
- `REQ-ST-129`. El sistema debera registrar tiempos de trabajo y desplazamiento de forma estructurada, no solo en texto libre, para poder legalizar el reporte tecnico y medir productividad. Estado actual: no evidenciado.
- `REQ-ST-130`. El sistema debera validar antes de `Finalize Work Order` que existan tiempos cargados, partes usadas, descripcion del problema, solucion aplicada, comunicacion al cliente y producto afectado cuando corresponda. Estado actual: no evidenciado.
- `REQ-ST-131`. El sistema debera crear citas, tareas o requerimientos futuros enlazados a la misma `WO` cuando el caso requiera repuesto, seguimiento o visita adicional. Estado actual: no evidenciado.
- `REQ-ST-132`. El sistema debera exigir legalizacion del reporte tecnico con firma del cliente y firma del personal de servicio antes del cierre final en plataforma externa o interna. Estado actual: no evidenciado.
- `REQ-ST-133`. El sistema debera modelar en la plataforma externa los preventivos con checklist por tipo de equipo, tiempos, actividades y repuestos usados, sin marcar producto afectado cuando el procedimiento no lo exige. Estado actual: no evidenciado.
- `REQ-ST-134`. El sistema debera modelar instalaciones y desinstalaciones en plataforma externa con checklist de descontaminacion y con el codigo unico `INS` requerido para activar equipos en la plataforma. Estado actual: no evidenciado.
- `REQ-ST-135`. El sistema debera modelar modificaciones dentro del `WO` del equipo con dispatch manual desde `CEAC`, registro de tiempos, actividades, partes usadas y producto afectado. Estado actual: no evidenciado.
- `REQ-ST-136`. El sistema debera reconciliar estados entre plataforma externa y sistema interno, mostrando diferencias de sincronizacion, casos desalineados y ultimo estado valido conocido. Estado actual: no evidenciado.
- `REQ-ST-137`. El sistema debera registrar errores de sincronizacion con `REXIS`, `Navify`, `Online Support` o `GoApp`, permitir reintentos controlados y mostrar alertas operativas antes de que se pierda la trazabilidad del caso. Estado actual: no evidenciado.

### 5.10 Automatizacion documental, autollenado, seguridad y reporting

- `REQ-ST-138`. El sistema debera administrar un catalogo de plantillas por codigo documental, version, revision, vigencia y modulo responsable de autollenado. Estado actual: parcial.
- `REQ-ST-139`. El sistema debera mantener un diccionario formal de campos para `F.ST-20`, incluyendo nombre tecnico del campo, origen del dato, regla de formato y condicion de obligatoriedad. Estado actual: implementado parcial.
- `REQ-ST-140`. El sistema debera mantener un diccionario formal de campos para `F.ST-02`, incluyendo checks, firmas e imagenes, de modo que los nombres del formulario no dependan de conocimiento tacito del desarrollador. Estado actual: parcial.
- `REQ-ST-141`. El sistema debera mantener un diccionario formal de campos para `F.ST-04` y debera documentar el origen exacto de `dias`, `horas`, `numero de participantes` y observaciones. Estado actual: parcial.
- `REQ-ST-142`. El sistema debera mantener un diccionario formal de campos para `F.ST-05`, incluyendo la estrategia para asistentes mayores a siete y la correspondencia exacta de campos de asistencia por dia. Estado actual: parcial.
- `REQ-ST-143`. El sistema debera mantener un diccionario formal de campos para `F.ST-09`, incluyendo resultados, analisis, firma del especialista y anexos de evidencia. Estado actual: parcial.
- `REQ-ST-144`. El sistema debera mantener un diccionario formal de campos para `F.ST-10`, incluyendo cabecera, filas de equipos, observaciones, datos de despacho y datos de entrega. Estado actual: parcial.
- `REQ-ST-145`. El sistema no debera automatizar `F.ST-07`, `F.ST-11`, `F.ST-12`, `F.ST-14`, `F.ST-16`, `F.ST-17`, `F.ST-18`, `F.ST-19`, `F.ST-21` ni anexos faltantes sin levantar antes un diccionario aprobado de campos, reglas y firmantes requeridos. Estado actual: no evidenciado.
- `REQ-ST-146`. El sistema debera ejecutar una validacion previa de compatibilidad `codigo vs plantilla` antes de emitir cualquier PDF, detectando campos inexistentes, campos con acentos distintos, nombres mal escritos y campos de imagen faltantes. Estado actual: no evidenciado.
- `REQ-ST-147`. El sistema debera corregir la inconsistencia verificada en `F.ST-09` entre `frima_af_image` de plantilla y `firma_af_image` del servicio antes de considerar estable el autollenado productivo. Estado actual: pendiente.
- `REQ-ST-148`. El sistema debera corregir la inconsistencia verificada en `F.ST-09` entre `ANÁLISIS` de la plantilla y `ANALISIS` del servicio, o documentar una estrategia tecnica que garantice escritura correcta sobre el campo real. Estado actual: pendiente.
- `REQ-ST-149`. El sistema debera corregir las inconsistencias verificadas en `F.ST-05` respecto a nombres de campos `Dia_*` y respecto a la ausencia evidenciada del campo `Firma_Especialista` en la plantilla inspeccionada. Estado actual: pendiente.
- `REQ-ST-150`. El sistema debera corregir las inconsistencias verificadas en `F.ST-02` respecto a `chk_CVITE/chk_CVTE` y `chk_DFD_o/chk_DFD_op`, evitando perdida silenciosa de informacion al generar el PDF. Estado actual: pendiente.
- `REQ-ST-151`. El sistema debera versionar, almacenar, controlar acceso y sellar con hash cada PDF final emitido, incluyendo actor emisor, fecha, template usado, origen del workflow y enlace al expediente del equipo. Estado actual: parcial.
- `REQ-ST-152`. El sistema debera proveer reportes y APIs de resumen documental para identificar workflows con documentos pendientes, certificados vencidos, reinspecciones abiertas, cotizaciones de repuesto sin resolver y reprogramaciones fuera de plazo. Estado actual: parcial.

## 6. Pendientes obligatorios de relevamiento antes de automatizar al 100%

- Levantar y aprobar las plantillas reales de `F.ST-07`, `F.ST-11`, `F.ST-12`, `F.ST-14`, `F.ST-16`, `F.ST-17`, `F.ST-18`, `F.ST-19`, `F.ST-21` y anexos citados, porque su autollenado completo no esta evidenciado en el codigo actual.
- Definir el contrato tecnico de integracion con `REXIS`, `Navify`, `Online Support` y `GoApp`, incluyendo autenticacion, eventos, payloads, errores, reintentos y reconciliacion de estados.
- Confirmar el sistema externo o interno que hoy representa `CRM/WO` para instalaciones, entrenamientos, preventivos y correctivos, porque el procedimiento exige interacciones que no aparecen completamente materializadas en el codigo actual.
- Definir equivalencia legal entre firma/sello fisico del cliente y firma digital para `F.ST-07`, `F.ST-10`, `F.ST-11`, `F.ST-12` y reportes tecnico-legales.
- Resolver primero las inconsistencias verificadas de plantillas y servicios (`F.ST-02`, `F.ST-05`, `F.ST-09`) antes de ampliar la automatizacion a mas documentos.
- Validar si `F.ST-06`, `F.ST-08`, `Anexo 4`, `Anexo 5`, `Anexo 6` y `Anexo 7` tienen plantillas oficiales digitalizables o si deben modelarse como formularios nativos del sistema antes de generar PDF.

## 7. Resultado del levantamiento

Total de requerimientos levantados: `152`.

Distribucion:

- Gobierno, trazabilidad y maestros: `10`
- Business case, comercial y planeacion previa: `12`
- ST-01-01 inspeccion: `14`
- ST-01-01 instalacion, entrega y verificacion: `17`
- ST-01-01 entrenamiento: `16`
- ST-01-01 retiro: `11`
- ST-01-02 preventivos: `20`
- ST-01-03 correctivos: `19`
- ST-01-04 REXIS / Navify / GoApp: `18`
- Automatizacion documental, seguridad y reporting: `15`

Este documento no declara como implementado nada que no haya quedado evidenciado en los procedimientos o en el codigo revisado.
