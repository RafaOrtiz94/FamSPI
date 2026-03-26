# URS - AREA 03 COMERCIAL, CLIENTES, BACKOFFICE Y BUSINESS CASE

## 1. Introducción
El presente documento define los requerimientos de usuario del Área 03 del sistema SPI. Este dominio consolida las capacidades críticas para la gestión del ciclo de ventas, administración de clientes, planificación operativa comercial y la evaluación de viabilidad técnico-económica a través del Business Case (BC). 

La razón de existir de esta área es asegurar que las oportunidades comerciales se capturen de forma estructurada, se validen técnicamente, se evalúen financieramente y se planifiquen operativamente antes de su ejecución. Sin este dominio, el sistema carecería de control sobre la rentabilidad de los proyectos y la trazabilidad de las promesas comerciales hacia los clientes.

## 2. Objetivo
Definir los requerimientos de usuario de alto nivel para los módulos de `clients`, `comercial`, `backoffice`, `business-case` y catálogos asociados, estableciendo los estándares funcionales necesarios para operar en un entorno de producción de alta exigencia.

## 3. Alcance
Incluye:
- Gestión integral de clientes (CRM básico).
- Ciclo de vida de solicitudes comerciales (ingreso, revisión de backoffice, aprobación).
- Planificación mensual y aprobación de cronogramas.
- Motor de cálculo de Business Case (ROI, Rentabilidad, Inversiones).
- Catálogos de equipos, determinaciones y plantillas de cálculo.
- Observabilidad y métricas del proceso comercial.
- Integración con Google Drive para expedientes de BC.

## 4. Actores
- **Asesor Comercial**: Genera oportunidades y solicitudes iniciales.
- **Backoffice Comercial**: Revisa factibilidad básica y documentos.
- **ACP Comercial**: Encargado de la configuración técnica y económica del BC.
- **Jefe Comercial / Gerencia**: Aprueba o rechaza proyectos basados en el BC.
- **Operaciones / Técnico**: Aporta datos de factibilidad operativa y técnica.

## 5. Justificación por Módulo
| Módulo | Por qué existe |
|---|---|
| `clients` | Centraliza la información de entidades externas para asegurar facturación y servicio correctos. |
| `comercial` | Provee la interfaz para la fuerza de ventas y la planificación de rutas/visitas. |
| `backoffice` | Actúa como filtro de calidad y cumplimiento normativo para las solicitudes comerciales. |
| `business-case` | Es el núcleo de inteligencia de negocio que determina si un contrato es viable o no. |
| `observability` | Permite identificar cuellos de botella en el embudo de ventas y aprobación. |

## 6. Requerimientos de Usuario (URS) - 40 Requisitos para Producción

### 6.1 Gestión de Clientes y CRM
- **REQ-COM-001**: El sistema debe permitir el registro, edición y consulta de clientes con datos fiscales y de contacto.
- **REQ-COM-002**: El sistema debe permitir categorizar clientes por sector, región y tipo de cuenta.
- **REQ-COM-003**: El sistema debe impedir el registro de clientes con identificaciones (RUC/Cédula) duplicadas.
- **REQ-COM-004**: El sistema debe permitir asociar múltiples sedes o departamentos a un mismo cliente principal.
- **REQ-COM-005**: El sistema debe mantener un historial de interacciones comerciales asociadas al cliente.

### 6.2 Solicitudes Comerciales y Backoffice
- **REQ-COM-006**: El sistema debe permitir al asesor comercial crear solicitudes de nuevos proyectos o servicios.
- **REQ-COM-007**: El sistema debe notificar automáticamente al equipo de Backoffice cuando se crea una nueva solicitud.
- **REQ-COM-008**: El sistema debe permitir al Backoffice validar la documentación adjunta y aprobar/rechazar la solicitud inicial.
- **REQ-COM-009**: El sistema debe impedir que una solicitud pase a la fase de Business Case sin la aprobación previa de Backoffice.
- **REQ-COM-010**: El sistema debe permitir el seguimiento del estado de la solicitud en tiempo real para el asesor.

### 6.3 Planificación y Cronogramas
- **REQ-COM-011**: El sistema debe permitir la creación de planes mensuales de actividades comerciales.
- **REQ-COM-012**: El sistema debe permitir la visualización de cronogramas en formato de calendario interactivo.
- **REQ-COM-013**: El sistema debe implementar un flujo de aprobación de cronogramas por parte de la Jefatura Comercial.
- **REQ-COM-014**: El sistema debe permitir el registro de cambios en el cronograma con justificación obligatoria.
- **REQ-COM-015**: El sistema debe sincronizar las actividades aprobadas con el calendario personal del colaborador.

### 6.4 Business Case - Configuración Técnica
- **REQ-COM-016**: El sistema debe permitir la selección de equipos del catálogo oficial para cada proyecto.
- **REQ-COM-017**: El sistema debe permitir configurar las determinaciones (pruebas/servicios) asociadas a cada equipo seleccionado.
- **REQ-COM-018**: El sistema debe validar automáticamente la capacidad técnica del equipo contra la demanda solicitada.
- **REQ-COM-019**: El sistema debe permitir adjuntar documentos técnicos de factibilidad emitidos por el área de operaciones.
- **REQ-COM-020**: El sistema debe soportar la configuración de consumibles y reactivos necesarios para la operación.

### 6.5 Business Case - Evaluación Económica
- **REQ-COM-021**: El sistema debe calcular automáticamente el ROI (Retorno de Inversión) basado en costos y proyecciones de ingresos.
- **REQ-COM-022**: El sistema debe permitir la configuración de inversiones (CAPEX) y costos operativos (OPEX).
- **REQ-COM-023**: El sistema debe aplicar plantillas de cálculo estandarizadas para asegurar la consistencia de las evaluaciones.
- **REQ-COM-024**: El sistema debe permitir el análisis de "Escenarios" (pesimista, esperado, optimista) dentro del BC.
- **REQ-COM-025**: El sistema debe alertar visualmente cuando la rentabilidad proyectada sea inferior al umbral mínimo de la empresa.

### 6.6 Workflow y Aprobaciones de BC
- **REQ-COM-026**: El sistema debe implementar una máquina de estados para el BC (Borrador -> Evaluación -> Aprobación -> Ganado/Perdido).
- **REQ-COM-027**: El sistema debe bloquear la edición de secciones del BC una vez que han sido marcadas como completas o enviadas a aprobación.
- **REQ-COM-028**: El sistema debe permitir la re-apertura de un BC cerrado solo bajo autorización de un rol administrativo.
- **REQ-COM-029**: El sistema debe registrar un historial detallado de decisiones de aprobación con comentarios del aprobador.
- **REQ-COM-030**: El sistema debe asegurar que toda decisión de factibilidad final sea firmada electrónicamente o vinculada a un usuario responsable.

### 6.7 Observabilidad y Documentación
- **REQ-COM-031**: El sistema debe proveer un dashboard de métricas comerciales (BCs por estado, montos proyectados, tiempos de ciclo).
- **REQ-COM-032**: El sistema debe generar automáticamente un resumen ejecutivo del Business Case en formato PDF para presentación a Gerencia.
- **REQ-COM-033**: El sistema debe permitir la exportación de los datos detallados del BC a formato Excel para análisis profundo.
- **REQ-COM-034**: El sistema debe crear automáticamente una estructura de carpetas en Google Drive para cada BC y almacenar allí los soportes.
- **REQ-COM-035**: El sistema debe registrar eventos de interacción en el frontend para auditoría de experiencia de usuario.

### 6.8 Requerimientos No Funcionales y Seguridad
- **REQ-COM-036**: El sistema debe implementar un sistema de bloqueo de concurrencia (Optimistic Locking) para evitar sobrescritura de datos en el BC.
- **REQ-COM-037**: El sistema debe asegurar que los cálculos complejos se ejecuten en menos de 2 segundos para no degradar la experiencia de usuario.
- **REQ-COM-038**: El sistema debe restringir la visibilidad de datos económicos sensibles solo a roles autorizados (ACP, Jefatura, Gerencia).
- **REQ-COM-039**: El sistema debe permitir el guardado automático (Autosave) configurable mediante Feature Flags.
- **REQ-COM-040**: El sistema debe garantizar la integridad transaccional en el backend para operaciones que afecten múltiples tablas de BC.

## 7. Conclusión
Este conjunto de 40 requerimientos define un estándar de producción para el Área Comercial de SPI, asegurando que la tecnología soporte eficazmente la toma de decisiones estratégicas y la operación diaria de la fuerza de ventas.
