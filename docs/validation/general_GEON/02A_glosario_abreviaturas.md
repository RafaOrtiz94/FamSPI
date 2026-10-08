# Glosario y Abreviaturas — FamSPI v1.0.0

## Introducción

Este documento define los términos técnicos, abreviaturas y conceptos regulatorios empleados en el paquete de validación de FamSPI v1.0.0. La validación cubre el sistema como totalidad, con énfasis en la dimensión transversal de **Gobierno y Seguridad** — que rige el control de acceso, la trazabilidad y el cumplimiento regulatorio en toda la plataforma — y el módulo funcional activo de **Permisos y Vacaciones**, que gestiona las solicitudes de ausencia del personal y el cálculo de saldo de vacaciones.

Un lector que consulte este apartado podrá comprender sin ambigüedad todos los documentos del paquete de validación (URS, FRS, IQ, OQ, PQ, FMEA, RTM y Anexos).

---

## Abreviaturas

| Abreviatura | Término completo |
|---|---|
| ALCOA+ | Attributable, Legible, Contemporáneo, Original, Accurate — principios de integridad de datos extendidos |
| API | Application Programming Interface |
| ARCO | Acceso, Rectificación, Cancelación y Oposición (derechos del titular del dato — LOPDP) |
| BC | Business Case |
| CORS | Cross-Origin Resource Sharing |
| CSV | Computerized System Validation |
| DD | Data Dictionary — Diccionario de Datos |
| DDS | Design Description Specification — Especificación de Descripción de Diseño |
| DQ | Design Qualification — Calificación de Diseño |
| FMEA | Failure Mode and Effects Analysis — Análisis de Modos de Falla y Efectos |
| FRS | Functional Requirements Specification — Especificación de Requerimientos Funcionales |
| GAMP | Good Automated Manufacturing Practice |
| GCP | Google Cloud Platform |
| GCS | Google Cloud Storage |
| HTTP | Hypertext Transfer Protocol |
| HTTPS | HTTP Secure — HTTP con cifrado TLS |
| IQ | Installation Qualification — Calificación de Instalación |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| LOPDP | Ley Orgánica de Protección de Datos Personales (Ecuador, 2021) |
| OQ | Operational Qualification — Calificación Operacional |
| PQ | Performance Qualification — Calificación de Desempeño |
| RBAC | Role-Based Access Control — Control de Acceso Basado en Roles |
| REST | Representational State Transfer |
| RPN | Risk Priority Number — Número de Prioridad de Riesgo |
| RRHH | Recursos Humanos |
| RTM | Requirements Traceability Matrix — Matriz de Trazabilidad de Requerimientos |
| SIEM | Security Information and Event Management |
| SOP | Standard Operating Procedure — Procedimiento Operativo Estándar |
| SSO | Single Sign-On — Inicio de Sesión Único |
| TLS | Transport Layer Security |
| TRS | Technical Report Series (serie de informes técnicos de la OMS) |
| UAT | User Acceptance Testing — Prueba de Aceptación de Usuario |
| URS | User Requirements Specification — Especificación de Requerimientos de Usuario |
| WHO | World Health Organization — Organización Mundial de la Salud |

---

## Definiciones

### Términos de Validación y Ciclo de Vida

| Término | Definición |
|---|---|
| Calificación de Diseño (DQ) | Verificación documentada de que el diseño técnico de FamSPI (arquitectura, módulos, base de datos, integraciones) satisface los requerimientos del usuario y del entorno regulatorio antes de la implementación. |
| Calificación de Instalación (IQ) | Verificación documentada de que el entorno de producción de FamSPI está correctamente configurado: variables de entorno, servicios GCP, base de datos Neon, imagen Docker y accesos de red. |
| Calificación Operacional (OQ) | Verificación documentada de que FamSPI opera conforme a sus especificaciones funcionales en condiciones definidas. Incluye casos de prueba de autenticación, permisos, vacaciones, RBAC y auditoría. |
| Calificación de Desempeño (PQ) | Demostración documentada de que FamSPI cumple consistentemente su función en condiciones reales de uso con usuarios reales, incluyendo flujos completos y escenarios de carga representativos. |
| Control de cambios | Proceso formal para evaluar, aprobar e implementar modificaciones al sistema validado. Clasifica los cambios por impacto (mayor, menor, emergencia) y determina el alcance de revalidación requerido. |
| Desviación | Diferencia documentada entre el resultado esperado y el resultado obtenido durante la ejecución de un caso de prueba (IQ/OQ/PQ). Requiere análisis de causa raíz y acción correctiva antes de la liberación del sistema. |
| Estado validado | Condición en la que FamSPI mantiene evidencia vigente de que opera conforme a su diseño aprobado, dentro del alcance declarado, sin desviaciones abiertas no resueltas. |
| Evidencia objetiva | Registro verificable (captura de pantalla, log de ejecución, resultado de caso de prueba) que demuestra el cumplimiento de un requerimiento o la ejecución de una actividad de calificación. |
| Línea base validada | Versión específica del sistema (FamSPI v1.0.0) para la cual existe un paquete de validación completo y aprobado. Toda modificación posterior debe pasar por el proceso de control de cambios. |
| Revalidación proporcional | Repetición parcial o total de las actividades de calificación cuyo alcance es proporcional al impacto del cambio. Un cambio menor puede requerir solo re-ejecución de los casos OQ afectados; un cambio mayor puede requerir IQ + OQ + PQ completos. |
| Revisión periódica | Evaluación programada (anual o por evento) del estado validado del sistema. Verifica que no han ocurrido cambios no documentados y que el sistema sigue siendo adecuado para su uso previsto. |
| Trazabilidad | Capacidad de rastrear cada requerimiento de usuario (URS) hasta su implementación técnica (FRS/DDS), su caso de prueba (OQ/PQ) y su evidencia de ejecución. Documentada en la RTM. |
| Uso previsto | Conjunto de funciones para las cuales FamSPI fue diseñado, validado y liberado: gestión de permisos del personal, cálculo y acreditación de vacaciones, control de acceso basado en roles, y trazabilidad completa de acciones. |

### Términos Técnicos del Sistema

| Término | Definición |
|---|---|
| API REST | Interfaz de programación que sigue el estilo arquitectónico REST. Cada endpoint de FamSPI corresponde a un recurso y un método HTTP (GET, POST, PUT, PATCH, DELETE). Las respuestas se devuelven en formato JSON. |
| Artifact Registry | Repositorio de artefactos de GCP donde se almacenan las imágenes Docker de FamSPI. Actúa como fuente de verdad de las versiones desplegadas en Cloud Run. |
| Backend | Componente servidor de FamSPI. Construido con Node.js 18 y Express v5.1.0. Expone la API REST, implementa la lógica de negocio, la autenticación, la autorización y el registro de auditoría. |
| Bucket | Contenedor de almacenamiento en Google Cloud Storage. FamSPI utiliza buckets para almacenar archivos adjuntos a solicitudes, documentos generados y recursos del sistema con retención configurable. |
| Cloud Build | Servicio de integración continua de GCP. Construye la imagen Docker del backend de FamSPI y la publica en Artifact Registry como parte del proceso de despliegue. |
| Cloud Run | Servicio de contenedores serverless de GCP donde se despliega el backend de FamSPI. Escala automáticamente según la demanda y ejecuta imágenes Docker. Cada despliegue genera una revisión identificada por hash. |
| Docker | Tecnología de contenedores. El backend de FamSPI se empaqueta como imagen Docker, garantizando que el entorno de ejecución sea idéntico en desarrollo, pruebas y producción. |
| Endpoint | URL específica dentro de la API REST de FamSPI que recibe peticiones y devuelve respuestas. Cada endpoint está protegido por middlewares de autenticación y autorización. Ejemplo: `POST /api/permisos` crea una solicitud de permiso. |
| Frontend | Componente cliente de FamSPI. Construido con React v19.2.0. Se comunica exclusivamente con el backend a través de la API REST autenticada mediante JWT Bearer Token. |
| Google Secret Manager | Servicio de GCP para la gestión segura de secretos (credenciales, claves de API, tokens). En producción, FamSPI accede a todos sus secretos exclusivamente a través de este servicio. Ningún secreto se almacena en el código fuente. |
| Health check | Verificación periódica del estado operativo del backend de FamSPI. El endpoint `/health` retorna el estado del servicio y permite a Cloud Run detectar instancias no saludables y reiniciarlas automáticamente. |
| Log de aplicación | Registro estructurado de eventos generado por el backend en tiempo de ejecución. Almacenado en Google Cloud Logging. Incluye trazas de errores, tiempos de respuesta y eventos de seguridad. |
| Middleware | Función que intercepta las peticiones HTTP antes de que lleguen al controlador del módulo. Los middlewares críticos de FamSPI son: `authenticateToken` (verifica JWT), `requireRole` (verifica RBAC), `Helmet` (cabeceras de seguridad) y `CORS` con whitelist. |
| Módulo | Agrupación lógica de funcionalidades del backend. Cada módulo contiene su router, controlador y servicio. Los módulos activos de FamSPI son: auth, permisos, vacaciones, security, auditoria, approvals, signature, documents, files, notifications, dashboard, gmail y management. |
| Neon | Proveedor de base de datos PostgreSQL serverless en la nube utilizado por FamSPI en producción. La instancia reside en la región us-east-2. Es el almacén principal de todos los datos del sistema. |
| NODE_ENV | Variable de entorno del runtime Node.js que define el entorno de ejecución. Los valores posibles en FamSPI son `development`, `test` y `production`. Controla el comportamiento de logging, caché y restricciones de seguridad. |
| PostgreSQL | Sistema de gestión de base de datos relacional de código abierto. FamSPI utiliza PostgreSQL 16 a través del proveedor cloud Neon como motor de base de datos. |
| Revisión (Cloud Run) | Versión específica desplegada de un servicio en Google Cloud Run. Cada despliegue genera una nueva revisión. Permite hacer rollback apuntando el tráfico a una revisión anterior válida. |
| Rollback | Retorno a una revisión anterior del sistema ante un fallo en producción. En FamSPI se ejecuta redirigiendo el tráfico de Cloud Run a la última revisión estable. |
| Variable de entorno | Valor de configuración externo al código fuente, inyectado en tiempo de ejecución. Permite que el mismo código se comporte de forma diferente en cada entorno sin modificar el código fuente. En producción, gestionadas a través de Google Secret Manager. |

### Términos de Autenticación y Seguridad

| Término | Definición |
|---|---|
| Bearer Token | Esquema de autenticación HTTP en el que el poseedor del token tiene acceso a los recursos protegidos. El frontend de FamSPI incluye el JWT como Bearer Token en la cabecera `Authorization: Bearer <token>` de cada petición. |
| Bitácora de auditoría | Registro inmutable y cronológico de todas las acciones relevantes ejecutadas en FamSPI: logins, cambios de datos, aprobaciones, rechazos y firmas electrónicas. Almacenada en base de datos sin posibilidad de eliminación por usuarios regulares. |
| CORS (configuración) | Política de seguridad del backend que define qué dominios externos pueden realizar peticiones. FamSPI configura CORS con una whitelist de orígenes autorizados. Solo el frontend de FamSPI en su URL de producción está permitido. |
| Firma electrónica | Mecanismo de FamSPI que aplica una marca criptográfica sobre un documento, incluyendo el hash del contenido firmado. Garantiza la identidad del firmante y la integridad del documento en cualquier momento posterior. |
| Google OAuth2 | Implementación del protocolo OAuth2 por parte de Google. FamSPI la usa como mecanismo de SSO. El usuario concede consentimiento explícito y Google emite un código que el backend intercambia por tokens de acceso. Solo cuentas corporativas autorizadas pueden acceder. |
| Hash de documento | Valor de longitud fija (digest) calculado mediante una función criptográfica aplicada al contenido de un documento. FamSPI incluye el hash en la firma electrónica para garantizar que el documento no fue alterado tras ser firmado. |
| Helmet | Biblioteca Node.js que establece cabeceras HTTP de seguridad (Content-Security-Policy, X-Frame-Options, HSTS, etc.) para proteger el backend de FamSPI frente a vulnerabilidades web comunes (XSS, clickjacking, etc.). |
| JWT (token de acceso) | Token de corta duración emitido por el backend de FamSPI tras autenticación exitosa. Contiene los claims del usuario (id, email, roles) firmados criptográficamente. El cliente lo adjunta como Bearer Token en cada petición a la API. |
| Login off-hours | Inicio de sesión fuera del horario laboral definido. FamSPI registra estos eventos en la bitácora de auditoría para revisión por parte del equipo de TI. |
| No repudio | Propiedad que garantiza que una acción ejecutada en FamSPI (aprobación, firma, cambio de datos) no puede ser negada por quien la realizó, gracias al registro en la bitácora de auditoría y a la firma electrónica con hash. |
| OAuth2 | Protocolo estándar de autorización (RFC 6749) que permite a FamSPI delegar la autenticación a Google Identity, sin gestionar contraseñas directamente. |
| RBAC (implementación) | Paradigma de autorización en el que los permisos se asignan a roles predefinidos. Los roles de FamSPI son: `ADMIN` (acceso total), `MANAGER` (gestión de equipo y aprobaciones), `RRHH` (recursos humanos y vacaciones), `EMPLOYEE` (empleado estándar). Implementado a través del middleware `requireRole`. |
| Refresh Token | Token de larga duración que permite obtener un nuevo token de acceso JWT sin que el usuario vuelva a autenticarse. FamSPI implementa rotación de refresh tokens: cada uso invalida el token anterior y emite uno nuevo, detectando así el uso de tokens comprometidos. |
| Rotación de refresh token | Mecanismo de seguridad en el que cada uso de un refresh token lo invalida y genera un nuevo par de tokens. Si un atacante intenta reusar un token ya rotado, el sistema lo detecta y puede invalidar la sesión completa. |
| Sesión | Período de interacción autenticada de un usuario con FamSPI, delimitada por el login y el logout. El logout implica la revocación explícita del refresh token activo. |
| Token de verificación pública | Código único almacenado en base de datos y expuesto en un endpoint público de FamSPI que permite a terceros verificar la autenticidad e integridad de un documento firmado electrónicamente, sin necesidad de acceso al sistema. |
| Whitelist | Lista de valores explícitamente autorizados. En FamSPI: (a) whitelist de orígenes CORS — dominios permitidos para peticiones al backend; (b) whitelist de roles — roles autorizados para acceder a un endpoint específico. |

### Términos del Dominio: Permisos y Vacaciones

| Término | Definición |
|---|---|
| Antigüedad | Tiempo transcurrido desde la fecha de ingreso del empleado a la organización. Base del cálculo del derecho acumulado de vacaciones según las reglas laborales configuradas en FamSPI. |
| Estado de solicitud | Valor que indica la etapa del flujo de aprobación de una solicitud de permiso. Los estados posibles en FamSPI son: `pending` (pendiente de primera revisión), `partially_approved` (aprobación parcial en flujo multinivel), `pending_final` (pendiente de aprobación final), `approved` (aprobado), `rejected` (rechazado), `cancelled` (cancelado por el solicitante). |
| Flujo de aprobación | Secuencia de pasos que sigue una solicitud de permiso desde su creación hasta su resolución. Según el tipo de permiso, puede requerir aprobación de MANAGER, RRHH o ambos en secuencia. |
| Matrícula | Identificador único del empleado dentro del sistema FamSPI. Clave de negocio que identifica al usuario como trabajador en los registros de permisos y vacaciones. |
| Permiso | Solicitud formal de ausencia laboral por motivo justificado. En FamSPI los tipos de permiso válidos son: `estudios`, `personal`, `salud` y `calamidad`. |
| Recuperable | Indicador booleano (`true`/`false`) asociado a una solicitud de permiso. Si es `true`, las horas de ausencia deben ser recuperadas en un plazo acordado. Si es `false`, la ausencia no genera deuda de horas. |
| Saldo de vacaciones | Número de días de vacaciones disponibles para un empleado en un período dado. Calculado en base a la antigüedad del empleado y las vacaciones ya tomadas o aprobadas. |
| Tipo de permiso | Categoría que clasifica la naturaleza de la ausencia solicitada. Determina las reglas de aprobación y si las horas son recuperables. Valores posibles en FamSPI: `estudios`, `personal`, `salud`, `calamidad`. |

### Términos Regulatorios y de Protección de Datos

| Término | Definición |
|---|---|
| Consentimiento LOPDP | Acto voluntario, informado y explícito por el cual el usuario autoriza el tratamiento de sus datos personales. FamSPI implementa un flujo de consentimiento obligatorio y no salteable durante el proceso de autenticación OAuth2. |
| Dato personal | Toda información que identifica o hace identificable a una persona natural. En FamSPI: nombre completo, correo corporativo, matrícula, historial de permisos y vacaciones, y logs de acceso. |
| Derechos ARCO | Derechos del titular reconocidos por la LOPDP: Acceso a sus datos, Rectificación de datos incorrectos, Cancelación del tratamiento y Oposición al tratamiento. La organización debe garantizar mecanismos para su ejercicio. |
| Integridad de datos | Propiedad que garantiza que los datos almacenados en FamSPI son exactos, completos y no han sido alterados de manera no autorizada. Implementada mediante transacciones de base de datos ACID, controles de acceso RBAC y firma electrónica con hash. |
| LOPDP (alcance) | Ley Orgánica de Protección de Datos Personales del Ecuador (2021). Regula el tratamiento de datos personales en Ecuador. FamSPI gestiona datos de carácter personal y está diseñado para cumplir sus principios, incluyendo el de minimización. |
| Principio de minimización | Principio establecido por la LOPDP (Art. 10 y siguientes) que dispone que solo deben recopilarse y tratarse los datos personales estrictamente necesarios para la finalidad declarada. FamSPI aplica este principio limitando los datos recopilados a los campos funcionales imprescindibles (nombre, correo, rol, historial de ausencias) sin solicitar información adicional no requerida. |
| Responsable del tratamiento | Entidad que determina los fines y medios del tratamiento de datos personales. La organización que despliega FamSPI asume este rol conforme a la LOPDP y es responsable de garantizar los derechos de los titulares. |
| Retención de datos | Política que define el período mínimo durante el cual se conservan los registros del sistema. Para datos de validación, auditoría y firmas electrónicas, FamSPI aplica un período mínimo de 10 años conforme a los requisitos regulatorios. |
| Titular del dato | Persona natural a quien pertenecen los datos personales. En FamSPI: el empleado cuyos datos de permisos, vacaciones e identidad son gestionados por el sistema. |
| Tratamiento de datos | Cualquier operación realizada sobre datos personales: recopilación, almacenamiento, uso, modificación, comunicación o eliminación. FamSPI documenta las finalidades de cada operación de tratamiento en su flujo de consentimiento OAuth2. |
