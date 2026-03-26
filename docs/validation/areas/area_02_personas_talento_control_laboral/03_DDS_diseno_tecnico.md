# DDS - AREA 02 PERSONAS, TALENTO Y CONTROL LABORAL

## 1. Introducción
El presente documento describe el diseño técnico final del Área 02 del sistema SPI. Esta arquitectura ha sido refinada para garantizar el cumplimiento de los 40 requerimientos de producción, enfocándose en la integridad transaccional, la observabilidad del flujo de trabajo y una experiencia de usuario fluida mediante técnicas avanzadas de renderizado asíncrono.

## 2. Objetivo
Documentar la arquitectura técnica, los patrones de diseño y las integraciones que permiten que el área opere al 100% de su capacidad funcional.

## 3. Arquitectura del Área
### 3.1 Capas y Patrones
- **Frontend (React)**: Implementa el patrón **Command Center** para unificar vistas. Utiliza **Skeleton Loaders** para mitigar el impacto visual de la latencia de red.
- **API (Node.js/Express)**: Organizada por módulos funcionales con controladores y servicios desacoplados.
- **Persistencia (PostgreSQL)**: Utiliza **Transacciones SQL** en procesos críticos para asegurar la consistencia.
- **Notificaciones (Event-Driven)**: Disparadores automáticos (Hooks) para alertas a TI y Talento Humano.

### 3.2 Componentes Técnicos Clave
- **Command Center State Hook (`useCommandCenterState`)**: Gestiona la sincronización entre la URL, el estado global de Redux/Query y el contexto de la entidad seleccionada.
- **Motor de SLA (`buildWorkflowSummary`)**: Inyecta lógica de tiempos en tiempo de ejecución para detectar estancamientos basados en `maxHours`.
- **Sincronizador de Perfiles (`profileSync`)**: Garantiza la paridad de datos entre `user_profile` y `collaborator_profiles` sin duplicidad de lógica.

## 4. Diseño por Módulo (Actualizado)

### 4.1 Personnel Requests & Hiring
El flujo de contratación ha sido blindado mediante:
- **Transacciones Atómicas**: La función `hirePersonnelRequest` envuelve la creación de la identidad, el expediente y la actualización del flujo en un bloque `BEGIN/COMMIT`.
- **Validación de Completitud**: El backend rechaza transiciones de estado si el perfil profesional no alcanza el 100% de campos obligatorios o si faltan documentos en el checklist.
- **Integración con TI**: Un hook post-contratación dispara una solicitud de credenciales al equipo técnico, incluyendo metadatos del colaborador recién ingresado.

### 4.2 Workspace (UI/UX)
- **Skeleton Loaders**: Se han desarrollado componentes de placeholder que imitan la estructura del `JourneyPanel` y el `SummaryStrip`. Se activan durante los estados `isLoading` y `isFetching` de React Query.
- **Navegación por Tabs Contextuales**: El sistema de pestañas se reconfigura dinámicamente según la fase del colaborador (Postulante vs Activo).

### 4.3 User Certifications
- **Generador de Dossier**: Un nuevo servicio de backend consolida registros de la tabla `user_certifications` en un flujo de stream para generar un PDF profesional con marcas de agua y verificación de integridad.

### 4.4 Attendance & Exceptions
- **Notificador de Irregularidades**: El controlador de asistencia ahora integra lógica de detección de anomalías (marcaciones fuera de horario o sin geolocalización válida) y notifica proactivamente a Talento Humano.

### 4.5 Vacaciones y Permisos
- **Motor de Recálculo**: Al cancelar o reprogramar una solicitud aprobada, el sistema revierte el impacto en `vacaciones_saldos_historicos` y recalcula la disponibilidad del colaborador de forma inmediata.

## 5. Modelo de Datos y Relaciones
Se han reforzado las siguientes entidades:
- `personnel_request_history`: Ahora registra metadatos de estancamiento (SLA).
- `collaborator_profiles`: Incluye validaciones JSONB estrictas para asegurar completitud.
- `audit_logs`: Captura eventos de UI para trazabilidad de experiencia de usuario.

## 6. Conclusión
El diseño técnico del Área 02 ha evolucionado de una gestión de datos básica a una arquitectura orientada a procesos empresariales. La implementación de transacciones, notificaciones automáticas y optimizaciones de UI aseguran un sistema robusto, escalable y listo para el entorno de producción.
