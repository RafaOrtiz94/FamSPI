# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)
## Area: Plataforma TI e Integraciones

## 1. Introduccion
Este documento detalla la especificacion funcional del area de Plataforma TI e Integraciones para servicios transversales del SPI.

## 2. Referencias
- URS base: `validacion_sistema/URS/areas/area_06_plataforma_ti_integraciones.md`
- Modulos fuente: `dashboard`, `files`, `documents`, `notifications`, `gmail`, `integrations`, `schedules`, `calendar`, `support-tickets`

## 3. Objetivo funcional
Definir funciones de plataforma para tablero, documentacion, archivos, notificaciones, integraciones y soporte TI.

## 4. Alcance funcional detallado
- Visualizacion de indicadores y tableros.
- Gestion de archivos y documentos.
- Gestion de notificaciones y correo.
- Integraciones con servicios externos.
- Gestion de agendas/calendarios.
- Atencion de tickets de soporte.
- Respaldo automatizado de base de datos y ejecucion segura de jobs tecnicos.

## 5. Actores y perfiles
- Equipo TI/soporte.
- Administrador de integraciones.
- Usuario interno consumidor de servicios.
- Gerencia para monitoreo de indicadores.

## 6. Componentes funcionales involucrados
- Backend: modulos de plataforma e integraciones.
- Frontend: paneles, bandejas de notificacion, calendario y mesa de ayuda.
- Datos: documentos, archivos, eventos de integracion, tickets, programaciones.

## 7. Especificaciones funcionales
### FR-PTI-001 Tablero de indicadores
- Descripcion: Mostrar indicadores operativos relevantes para seguimiento.
- Entradas: fuentes de datos autorizadas.
- Salidas: panel con metricas actualizadas.
- Reglas: visibilidad segun perfil.

### FR-PTI-002 Gestion de archivos y documentos
- Descripcion: Cargar, almacenar, versionar y consultar evidencias.
- Entradas: archivo/documento y metadatos.
- Salidas: recurso disponible con referencia a proceso.
- Reglas: formato permitido y relacion obligatoria a entidad.

### FR-PTI-003 Notificaciones
- Descripcion: Emitir alertas por eventos de negocio/tecnicos.
- Entradas: evento, destinatarios, plantilla.
- Salidas: notificacion enviada y registrada.
- Reglas: destinatarios validos y control de frecuencia.

### FR-PTI-004 Integraciones externas
- Descripcion: Intercambiar informacion con servicios de terceros.
- Entradas: payload, configuracion de conector.
- Salidas: respuesta de integracion y log tecnico.
- Reglas: autenticacion de integracion y reintentos controlados.

### FR-PTI-005 Calendario y agenda
- Descripcion: Gestionar planificacion de actividades y compromisos.
- Entradas: evento, fecha, responsables.
- Salidas: agenda consolidada por actor/area.
- Reglas: conflictos de agenda detectables.

### FR-PTI-006 Mesa de ayuda TI
- Descripcion: Registrar y atender tickets de soporte.
- Entradas: incidencia, prioridad, solicitante.
- Salidas: ticket con estado y responsable.
- Reglas: ciclo de estados y SLA interno.

### FR-PTI-007 Servicios transversales reutilizables
- Descripcion: Exponer capacidades comunes para consumo de otras areas.
- Entradas: solicitud de servicio autenticada.
- Salidas: respuesta funcional del servicio transversal.
- Reglas: contratos estables y control de acceso.

### FR-PTI-008 Trazabilidad tecnica
- Descripcion: Registrar ejecuciones de integracion y soporte para diagnostico.
- Entradas: evento tecnico, resultado, contexto.
- Salidas: bitacora tecnica consultable.
- Reglas: correlacion de eventos por identificador unico.

### FR-PTI-009 Respaldo automatizado de base de datos
- Descripcion: Ejecutar respaldos de base de datos de forma automatica, segura y trazable sobre infraestructura GCP.
- Entradas: configuracion de base de datos, credenciales, carpeta destino, programacion y clave de jobs.
- Salidas: archivo de respaldo generado, comprimido, cargado al destino definido y registrado en logs.
- Reglas:
  - La ejecucion productiva debe realizarse mediante `Cloud Scheduler` hacia endpoint interno protegido.
  - El endpoint debe exigir autenticacion interna mediante `JOBS_KEY`.
  - El respaldo debe almacenar evidencia suficiente para verificar fecha, tamano y destino.
  - Toda falla debe quedar registrada para diagnostico posterior.

## 8. Validaciones de negocio y datos
- Todo documento/archivo debe referenciar proceso origen.
- Todo ticket debe tener prioridad, estado y responsable.
- Integraciones requieren configuracion valida y credenciales activas.
- Eventos de notificacion deben registrar resultado de entrega.
- Todo respaldo automatico debe dejar evidencia verificable de ejecucion y destino.

## 9. Seguridad y control
- Control de acceso para administracion de integraciones y archivos.
- Trazabilidad de acciones administrativas y tecnicas.
- Proteccion de informacion en transferencias con terceros.

## 10. Manejo de errores y excepciones
- `400/422`: metadatos o payload invalidos.
- `401`: acceso sin autenticacion.
- `403`: accion no autorizada.
- `404`: recurso no encontrado (archivo, ticket, evento).
- `502/504`: error de dependencia externa/integracion.

## 11. Interfaces e integraciones
- Integracion transversal con todas las areas del SPI.
- Integracion con servicios de correo/proveedores externos.
- Integracion con seguridad para autenticacion y autorizacion.
- Integracion con Cloud Run, Cloud Scheduler, Secret Manager, PostgreSQL y Google Drive para jobs tecnicos.

## 12. Matriz de trazabilidad URS -> FRS -> Prueba
| URS | FRS | Caso de prueba funcional |
|---|---|---|
| REQ-PTI-001 | FR-PTI-001 | Consultar tablero con datos autorizados |
| REQ-PTI-002 | FR-PTI-002 | Cargar documento y recuperar por referencia |
| REQ-PTI-003 | FR-PTI-003 | Generar notificacion por evento de negocio |
| REQ-PTI-004 | FR-PTI-004 | Ejecutar integracion y validar respuesta/log |
| REQ-PTI-005 | FR-PTI-005 | Crear evento de agenda y detectar conflictos |
| REQ-PTI-006 | FR-PTI-006 | Registrar ticket y mover estados de atencion |
| REQ-PTI-007 | FR-PTI-007 | Consumir servicio transversal desde otro modulo |
| REQ-PTI-008 | FR-PTI-008 | Verificar bitacora tecnica de integracion |
| REQ-PTI-009 | FR-PTI-009 | Ejecutar backup automatico y validar evidencia en destino |

## 13. Criterios de aceptacion del area
- Servicios transversales disponibles con control de acceso.
- Integraciones con trazabilidad y manejo de fallos.
- Tickets y notificaciones con ciclo de vida consistente.
- Evidencia documental gestionada con referencia valida.
- Jobs tecnicos criticos con autenticacion interna, programacion externa y evidencia de ejecucion.
