# FRS - AREA 02 PERSONAS, TALENTO Y CONTROL LABORAL

## 1. Introducción
La presente especificación funcional describe el comportamiento verificable del Área 02 del sistema SPI. Cada función incluida en este documento se apoya en rutas realmente montadas, componentes frontend consumidores y persistencias en base de datos. El objetivo es traducir el dominio de personas y control laboral a funciones observables, comprobables y listas para producción.

## 2. Objetivo
Definir detalladamente las capacidades funcionales del área, estableciendo un estándar de cumplimiento del 100% para los 40 requerimientos de usuario (URS) definidos.

## 3. Alcance Funcional
El alcance comprende la gestión del ciclo de vida del colaborador: desde la solicitud de vacante, selección de postulantes, contratación atómica, control de asistencia con geolocalización, gestión de permisos y vacaciones, hasta la auditoría integral de procesos.

## 4. Requerimientos Funcionales Detallados

### 4.1 Gestión Organizacional y Usuarios
- **FR-PT-001 (Administración Unificada)**: El sistema expone una interfaz centralizada para la gestión de usuarios y departamentos. Valida la existencia y estado activo de departamentos antes de cualquier asignación de personal.
- **FR-PT-002 (Baja Lógica)**: La eliminación de usuarios se ejecuta mediante desactivación lógica (`active = false`), preservando la integridad referencial en históricos de asistencia y solicitudes.
- **FR-PT-003 (Restricción de Roles)**: Implementa middleware de autorización que restringe el acceso a la configuración organizacional exclusivamente a los roles de `talento_humano` y `ti`.

### 4.2 Workspace del Colaborador (Command Center)
- **FR-PT-004 (Experiencia Unificada)**: El `CollaboratorCommandCenter` integra en un solo canvas las solicitudes de contratación y el personal activo, permitiendo la gestión sin cambios de contexto de página.
- **FR-PT-005 (Navegación Contextual)**: Utiliza un sistema de pestañas (Tabs) dinámicas: `Postulante`, `Perfil`, `Checklist`, `Documentos` y `Comentarios`, adaptando la visibilidad según si se trata de una vacante o un colaborador activo.
- **FR-PT-006 (Encabezado Operativo)**: Muestra de forma persistente la foto, nombre, estado del flujo y responsable, facilitando la identificación inmediata del contexto de trabajo.
- **FR-PT-007 (Optimización Visual - Skeleton Loaders)**: Durante la carga asíncrona de datos pesados (perfiles JSONB y documentos), el sistema renderiza placeholders animados (`animate-pulse`) para eliminar el salto visual (Layout Shift).

### 4.3 Perfil y Certificaciones
- **FR-PT-008 (Sincronización de Perfiles)**: El sistema garantiza que los cambios realizados en el perfil personal del usuario impacten automáticamente en el expediente laboral del colaborador mediante la utilidad `profileSync`.
- **FR-PT-009 (Dossier PDF de Certificaciones)**: Genera un documento consolidado en formato PDF que agrupa todas las habilitaciones vigentes del usuario, incluyendo códigos de verificación y links a soportes en Google Drive.

### 4.4 Proceso de Contratación (Hiring Flow)
- **FR-PT-010 (Selección de Postulantes)**: Permite la vinculación secuencial de candidatos a una solicitud aprobada. El flujo bloquea el inicio del expediente profesional hasta que se haya fijado un postulante.
- **FR-PT-011 (Checklist con Carga Documental)**: Los puntos de verificación que requieren soporte físico integran un botón de "Subir Documento". La carga exitosa marca el ítem como "Cargado" automáticamente.
- **FR-PT-012 (Validación de Contrato Firmado)**: El sistema impide la ejecución de la contratación final si no se detecta un documento de tipo `CONTRATO_TRABAJO` cargado y validado.
- **FR-PT-013 (Transacción Atómica de Contratación)**: El cierre de la contratación envuelve la creación del usuario, migración de perfil y actualización de solicitud en un bloque `BEGIN/COMMIT` de base de datos para evitar registros huérfanos.
- **FR-PT-014 (Notificación Automática a TI)**: Al finalizar la contratación, el sistema dispara un evento de notificación a los roles de Tecnología para la creación inmediata de credenciales corporativas.

### 4.5 Inteligencia de Negocio y SLA
- **FR-PT-015 (Control de Estancamiento - SLA)**: Calcula el tiempo transcurrido en la etapa actual versus el límite permitido (`maxHours`). Muestra alertas visuales de "Estancada" en el Journey Panel si se excede el tiempo operativo.
- **FR-PT-016 (Trazabilidad de Comentarios)**: Permite registrar notas operativas con distinción de visibilidad (Pública/Involucrados o Interna de Talento Humano).

### 4.6 Control de Asistencia y Jornada
- **FR-PT-017 (Marcación con Geolocalización)**: Captura coordenadas GPS en cada evento de jornada (Entrada, Almuerzo, Salida). Valida la ubicación contra el perímetro permitido si está configurado.
- **FR-PT-018 (Atajos Móviles)**: Expone rutas optimizadas para Shortcuts de iOS/Android, permitiendo marcaciones rápidas sin navegar por la interfaz completa.
- **FR-PT-019 (Cálculo Automático de Overtime)**: El motor de backend calcula diariamente las horas extra trabajadas basándose en el cierre de jornada y el horario base del colaborador.
- **FR-PT-020 (Reporte Oficial RH-09)**: Genera reportes PDF firmados electrónicamente por cada colaborador, listos para auditoría de entes reguladores.
- **FR-PT-021 (Notificación de Excepciones)**: Envía alertas automáticas a TH cuando un colaborador registra una salida inesperada o marca fuera de su horario habitual.

### 4.7 Permisos y Vacaciones
- **FR-PT-022 (Flujo de Aprobación Multinivel)**: Implementa una máquina de estados para ausencias: Solicitado -> Aprobación Jefe -> Aprobación TH -> Cerrado.
- **FR-PT-023 (Gestión de Saldo de Vacaciones)**: Calcula en tiempo real el remanente de días basándose en la fecha de ingreso, días gozados y solicitudes aprobadas futuras.
- **FR-PT-024 (Cancelación y Reprogramación)**: Permite al usuario o TH cancelar solicitudes aprobadas que no han iniciado, liberando el saldo de días de forma inmediata y notificando a las partes.

## 5. Matriz de Trazabilidad Funcional (Resumen)
| Módulo | Funciones Clave | Estado |
|---|---|:---:|
| Contratación | Transacciones, Checklist, TI Notif. | ✅ |
| Workspace | Skeleton Loaders, Tabs Contextuales | ✅ |
| Asistencia | Geolocalización, RH-09, Atajos | ✅ |
| Vacaciones | Saldo Real, Reprogramación | ✅ |
| Auditoría | Log Detallado, Auditoría de UI | ✅ |

## 6. Conclusión
La FRS del Área 02 demuestra un sistema maduro, con controles de integridad robustos y una interfaz optimizada para la operación diaria. El cumplimiento del 100% de los requerimientos garantiza que SPI está listo para su despliegue en producción bajo estándares corporativos.
