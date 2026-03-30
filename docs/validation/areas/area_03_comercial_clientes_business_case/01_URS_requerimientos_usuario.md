# URS - AREA 03 COMERCIAL, CLIENTES, BACKOFFICE Y BUSINESS CASE

## 1. Introducción
El presente documento define los requerimientos de usuario del Área 03 del sistema SPI. Este dominio consolida las capacidades críticas para la gestión del ciclo de ventas, administración de clientes, planificación operativa comercial y la evaluación de viabilidad técnico-económica a través del Business Case (BC). 

La razón de existir de esta área es asegurar que las oportunidades comerciales se capturen de forma estructurada, se validen técnicamente, se evalúen financieramente y se planifiquen operativamente antes de su ejecución. Sin este dominio, el sistema carecería de control sobre la rentabilidad de los proyectos y la trazabilidad de las promesas comerciales hacia los clientes.

## 2. Objetivo
Definir los requerimientos de usuario de alto nivel para los módulos de `clients`, `comercial`, `backoffice`, `business-case` y catálogos asociados, estableciendo los estándares funcionales necesarios para operar en un entorno de producción de alta exigencia, con un enfoque en la rentabilidad y la integridad operativa.

## 3. Alcance
Incluye:
- Gestión integral de clientes y prospectos (CRM).
- Ciclo de vida de solicitudes comerciales y validación de Backoffice.
- Planificación mensual, cronogramas y rutas comerciales.
- Motor de cálculo de Business Case (ROI, Payback, Margen, Inversiones).
- Configuración técnica (Equipos, Determinaciones, LIS, Infraestructura).
- Planificación de Despacho y consumo proyectado.
- Observabilidad, métricas y dashboards comerciales.
- Automatización documental e integración con almacenamiento en la nube.

## 4. Actores
- **Asesor Comercial**: Genera oportunidades y gestiona su cartera de clientes.
- **Backoffice Comercial**: Filtro de calidad, cumplimiento normativo y validación documental.
- **ACP Comercial (Analista de Casos)**: Configura la estructura técnica y económica del BC.
- **Jefe Comercial / Gerencia**: Aprueba o rechaza proyectos basados en indicadores financieros.
- **Operaciones / Técnico**: Aporta datos de factibilidad, infraestructura y logística.
- **Administrador del Sistema**: Gestiona catálogos de precios, equipos y fórmulas.

## 5. Justificación por Módulo
| Módulo | Por qué existe |
|---|---|
| `clients` | Centraliza la información de entidades externas para asegurar facturación y servicio correctos. |
| `comercial` | Provee la interfaz para la fuerza de ventas y la planificación de rutas/visitas. |
| `backoffice` | Actúa como filtro de calidad y cumplimiento normativo para las solicitudes comerciales. |
| `business-case` | Núcleo de inteligencia de negocio que determina la viabilidad y rentabilidad de los contratos. |
| `dispatch` | Conecta la promesa comercial con la capacidad operativa de entrega y consumo. |

## 6. Requerimientos de Usuario (URS) - 80 Requisitos para Producción

### 6.1 Gestión de Clientes y CRM (CRM-01 a CRM-10)
- **REQ-COM-001**: Registro, edición y consulta de clientes con datos fiscales, segmentación y geolocalización.
- **REQ-COM-002**: Categorización avanzada por sector (Público/Privado), región, importancia (ABC) y tipo de cuenta.
- **REQ-COM-003**: Validación estricta de RUC/Cédula para evitar duplicidad y asegurar integridad fiscal.
- **REQ-COM-004**: Gestión de múltiples sedes, departamentos y contactos por cada cliente principal.
- **REQ-COM-005**: Registro de historial de interacciones, visitas y minutas de reuniones comerciales.
- **REQ-COM-006**: Sistema de alertas para clientes inactivos o con contratos próximos a vencer.
- **REQ-COM-007**: Capacidad de adjuntar documentos legales del cliente (RUC, Nombramiento, Cédula Representante).
- **REQ-COM-008**: Asignación y transferencia masiva de cartera entre asesores comerciales.
- **REQ-COM-009**: Dashboard de vista 360° del cliente (solicitudes, contratos activos, rentabilidad histórica).
- **REQ-COM-010**: Integración de mapas para visualización de cobertura de clientes por zona geográfica.

### 6.2 Solicitudes Comerciales y Backoffice (SOL-01 a SOL-10)
- **REQ-COM-011**: Creación de solicitudes comerciales vinculadas a clientes existentes o nuevos prospectos.
- **REQ-COM-012**: Notificación automática al Backoffice ante cada nueva solicitud para revisión inmediata.
- **REQ-COM-013**: Checklist obligatorio de documentos mínimos para que una solicitud sea procesada.
- **REQ-COM-014**: Flujo de aprobación/rechazo de solicitudes con retroalimentación obligatoria al asesor.
- **REQ-COM-015**: Bloqueo de avance al Business Case si la solicitud no tiene el "visto bueno" de Backoffice.
- **REQ-COM-016**: Seguimiento visual del estado de la solicitud (pipeline) para el equipo de ventas.
- **REQ-COM-017**: Capacidad de priorizar solicitudes urgentes según criterios de negocio (SLA comercial).
- **REQ-COM-018**: Registro de motivos de rechazo para análisis de efectividad del embudo comercial.
- **REQ-COM-019**: Asociación automática de la solicitud al flujo de creación de Business Case tras su aprobación.
- **REQ-COM-020**: Control de versiones de la solicitud ante cambios significativos en el requerimiento del cliente.

### 6.3 Planificación y Cronogramas (PLAN-01 a PLAN-10)
- **REQ-COM-021**: Elaboración de planes mensuales de actividades comerciales (visitas, cierres, mantenimientos).
- **REQ-COM-022**: Interfaz de calendario interactivo con drag-and-drop para reprogramación de actividades.
- **REQ-COM-023**: Flujo de aprobación de cronogramas por la Jefatura Comercial antes del inicio del mes.
- **REQ-COM-024**: Registro de ejecución de actividades (check-in/check-out) mediante geolocalización móvil.
- **REQ-COM-025**: Sincronización bidireccional con calendarios externos (Google/Outlook).
- **REQ-COM-026**: Reporte de cumplimiento de cronograma vs. actividades planificadas.
- **REQ-COM-027**: Justificación obligatoria para la cancelación o postergación de visitas planificadas.
- **REQ-COM-028**: Optimización de rutas basada en la ubicación de los clientes asignados.
- **REQ-COM-029**: Visibilidad de cronogramas de compañeros para coordinación de visitas conjuntas.
- **REQ-COM-030**: Alertas de conflicto cuando se planifican múltiples actividades en el mismo horario.

### 6.4 Business Case - Configuración Técnica (BC-TECH-01 a BC-TECH-15)
- **REQ-COM-031**: Selección de equipos del catálogo oficial con validación de estado (Nuevo, Reacondicionado, Backup).
- **REQ-COM-032**: Configuración de determinaciones (pruebas) por equipo con cantidades mensuales proyectadas.
- **REQ-COM-033**: Cálculo automático de capacidad del equipo vs. demanda para detectar sobrecarga o subutilización.
- **REQ-COM-034**: Sección de entorno de laboratorio (turnos, días laborables, niveles de control de calidad).
- **REQ-COM-035**: Gestión de integración LIS (Laboratory Information System) e interfaces de equipos.
- **REQ-COM-036**: Registro de infraestructura requerida (aire acondicionado, UPS, espacio físico, tomas eléctricas).
- **REQ-COM-037**: Evaluación de factibilidad técnica firmada por el Jefe de Operaciones/Técnico.
- **REQ-COM-038**: Configuración de equipos de backup y redundancia para servicios críticos.
- **REQ-COM-039**: Gestión de consumibles y reactivos asociados automáticamente según la determinación elegida.
- **REQ-COM-040**: Capacidad de excluir ítems específicos del cálculo de consumo si el cliente los provee.
- **REQ-COM-041**: Definición de tiempos de entrega y compromiso de instalación.
- **REQ-COM-042**: Registro de ubicación física exacta de la instalación (coordenadas o croquis).
- **REQ-COM-043**: Validación de compatibilidad entre equipos seleccionados y determinaciones configuradas.
- **REQ-COM-044**: Historial de cambios técnicos en la configuración del BC durante la fase de preventa.
- **REQ-COM-045**: Bloqueo de cambios técnicos una vez que el BC pasa a evaluación económica.

### 6.5 Business Case - Evaluación Económica (BC-ECON-01 a BC-ECON-15)
- **REQ-COM-046**: Motor de cálculo dinámico para ROI, Payback (meses), Margen Bruto y Neto.
- **REQ-COM-047**: Configuración detallada de inversiones iniciales (CAPEX) y gastos recurrentes (OPEX).
- **REQ-COM-048**: Uso de plantillas de cálculo flexibles basadas en el tipo de negocio (Comodato, Venta Directa, Servicio).
- **REQ-COM-049**: Análisis de sensibilidad mediante escenarios (Pesimista, Base, Optimista).
- **REQ-COM-050**: Alerta de rentabilidad crítica cuando los indicadores están por debajo del umbral corporativo.
- **REQ-COM-051**: Cálculo automático del costo por prueba (cost per test) consolidado.
- **REQ-COM-052**: Gestión de precios especiales y descuentos con niveles de aprobación escalonados.
- **REQ-COM-053**: Inclusión de costos indirectos (logística, capacitación, seguros) en el modelo económico.
- **REQ-COM-054**: Visualización gráfica del punto de equilibrio (break-even point) del proyecto.
- **REQ-COM-055**: Comparativa de rentabilidad vs. proyectos similares o históricos.
- **REQ-COM-056**: Soporte para múltiples monedas y tasas de conversión actualizables.
- **REQ-COM-057**: Cálculo de impuestos (IVA, retenciones) según la normativa local vigente.
- **REQ-COM-058**: Registro de financiamiento y plazos de pago acordados con el cliente.
- **REQ-COM-059**: Reporte detallado de flujo de caja proyectado a lo largo del contrato.
- **REQ-COM-060**: Bloqueo de la sección económica tras el envío a aprobación definitiva.

### 6.6 Workflow, Despacho y Operaciones (BC-FLOW-01 a BC-FLOW-10)
- **REQ-COM-061**: Máquina de estados formal (Borrador -> Viabilidad -> Económico -> Aprobación -> Ganado/Perdido).
- **REQ-COM-062**: Control de "Ownership" de secciones para evitar ediciones concurrentes por distintos roles.
- **REQ-COM-063**: Planificación de despacho vinculada al consumo mensual configurado en el BC.
- **REQ-COM-064**: Workspace de Despacho para seguimiento de entregas planificadas vs. ejecutadas.
- **REQ-COM-065**: Notificación automática a Logística y Bodega ante la aprobación de un nuevo Business Case.
- **REQ-COM-066**: Registro de firmas electrónicas de todos los responsables intervinientes en el BC.
- **REQ-COM-067**: Capacidad de realizar "Ajustes Operativos" post-aprobación técnica sin afectar el modelo económico.
- **REQ-COM-068**: Trazabilidad completa de quién, cuándo y qué cambió en cada versión del Business Case.
- **REQ-COM-069**: Integración con el sistema de inventario para reservar equipos tras la aprobación del BC.
- **REQ-COM-070**: Cierre administrativo del BC con reporte final de lecciones aprendidas si el caso se pierde.

### 6.7 Observabilidad, Reportes y Auditoría (OBS-01 a OBS-10)
- **REQ-COM-071**: Dashboard de Observabilidad con tiempos de permanencia en cada estado del workflow.
- **REQ-COM-072**: Generación automática de Resumen Ejecutivo en PDF (Hoja BC) para firma de Gerencia.
- **REQ-COM-073**: Exportación masiva de datos a Excel para análisis externo y auditoría.
- **REQ-COM-074**: Creación automática de expedientes digitales en Google Drive para cada oportunidad comercial.
- **REQ-COM-075**: Auditoría técnica de cálculos (bitácora de fórmulas aplicadas en cada iteración).
- **REQ-COM-076**: KPIs de efectividad comercial: Tasa de conversión de solicitudes a BCs ganados.
- **REQ-COM-077**: Alertas de "cuello de botella" cuando un BC supera el tiempo promedio en evaluación.
- **REQ-COM-078**: Reporte de proyecciones de venta consolidado para planificación financiera anual.
- **REQ-COM-079**: Registro de logs de visualización de datos sensibles para cumplimiento de LOPDP.
- **REQ-COM-080**: Backup automático y versionado de los documentos generados por el sistema.

### 6.8 Integraciones Inter-Áreas y Cierre de Gaps (INT-01 a INT-07)
- **REQ-COM-INT-01**: Sincronización Transaccional de Inventario: Reserva lógica en `equipos_unidad` al marcar un BC como Factible, evitando duplicidad de asignación.
- **REQ-COM-INT-02**: Orquestación de Capacidad de Servicio: Validación de disponibilidad de técnicos en tiempo real contra el esquema `servicio.disponibilidad_tecnicos`.
- **REQ-COM-INT-03**: Workflow de Notificaciones Multi-Área: Disparo automático de eventos SSE y correos a Logística/Servicio tras hitos comerciales.
- **REQ-COM-INT-04**: Normalización Unificada de Actores: Uso de middleware de roles centralizado para acceso multi-área sin permisos redundantes.
- **REQ-COM-INT-05**: Win-Probability Scoring: Algoritmo predictivo de cierre basado en margen y tiempos de respuesta.
- **REQ-COM-INT-06**: Auto-Drafting de Contratos Legales: Generación automática de borradores legales inyectando datos del BC aprobado.
- **REQ-COM-INT-07**: Post-Implementation Review (PIR): Módulo de auditoría de consumo real vs proyectado a los 6 meses de instalación.

## 7. Requerimientos No Funcionales y Seguridad
- **REQ-COM-NF-01**: Integridad transaccional (ACID) en el guardado de múltiples secciones de Business Case.
- **REQ-COM-NF-02**: Control de acceso granular (RBAC) que limite la visibilidad de costos y márgenes.
- **REQ-COM-NF-03**: Disponibilidad del motor de cálculos offline o mediante caché para evitar pérdidas de datos.
- **REQ-COM-NF-04**: Encriptación de documentos sensibles almacenados en la nube.
- **REQ-COM-NF-05**: Escalabilidad para manejar catálogos de miles de equipos y determinaciones sin degradación.

## 8. Conclusión
Este conjunto de 80 requerimientos representa la visión de un sistema comercial de clase empresarial, diseñado no solo para registrar datos, sino para actuar como un motor de decisiones financieras y operativas. La implementación de estos requisitos garantiza una operación comercial rentable, trazable y alineada con los objetivos estratégicos de la compañía.
