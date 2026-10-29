# Especificación de Requerimientos de Usuario (URS)

**Documento:** URS-FAMSPI-001  
**Sistema:** FamSPI v1.0.0  
**Organización:** FamProject  
**Marco documental:** GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 (adoptado como buena práctica documental)  
**Versión del documento:** 1.0  
**Fecha de emisión:** 2026-05-13  
**Estado:** Aprobado para ejecución de pruebas  
**Preparado por:** Departamento de TI — FamProject  
**Revisado por:** Responsable de Validación — FamProject  

---

## Descripción del software

FamSPI (Sistema de Procesos Internos de FamProject) es una plataforma institucional computarizada diseñada para la gestión centralizada de recursos humanos y procesos internos de la organización. El sistema provee funcionalidades para el registro, flujo de aprobación y trazabilidad de solicitudes de permisos y vacaciones del personal, así como mecanismos transversales de gobierno, seguridad, auditoría y control de acceso.

FamSPI está orientado al uso exclusivo del personal interno de FamProject y opera bajo un modelo de roles y permisos que garantiza que cada usuario únicamente pueda ejecutar las acciones correspondientes a su nivel de autorización. El sistema no constituye un sistema crítico de calidad farmacéutica ni opera en el ámbito de redes OMCL; sin embargo, se adopta el marco GEON/OMCL Annex 2 como referencia de buena práctica documental para estructurar su validación de primera línea base.

---

## Versión del software

| Parámetro | Valor |
|---|---|
| Nombre del sistema | FamSPI |
| Versión validada | 1.0.0 |
| Entorno de despliegue | Google Cloud Platform — Cloud Run |
| Backend | Node.js / Express |
| Frontend | React (SPA) |
| Base de datos | PostgreSQL (instancia Cloud SQL) |
| Autenticación | Google OAuth2 + JWT |
| Fecha de congelamiento de versión | 2026-05-13 |
| Hash de commit de referencia | Ver registro de control de cambios |

---

## Uso previsto

FamSPI v1.0.0 está destinado a:

1. Gestionar solicitudes de permisos laborales del personal interno (creación, revisión, aprobación y rechazo).
2. Gestionar solicitudes de vacaciones (registro de saldo, solicitud, aprobación y cancelación).
3. Proveer un gobierno de seguridad transversal que garantice autenticación, autorización por roles, auditoría de eventos críticos y notificaciones internas.
4. Mantener trazabilidad completa de las acciones ejecutadas en el sistema mediante un módulo de auditoría persistente.

El sistema no está diseñado para uso clínico, farmacéutico ni regulatorio externo. El alcance de validación de primera línea base abarca el sistema completo en su conjunto, con énfasis en la dimensión de Gobierno y Seguridad y el módulo funcional de Permisos y Vacaciones.

---

## Descripción del sistema

### Arquitectura

FamSPI sigue una arquitectura de tres capas desacopladas:

- **Capa de presentación:** Aplicación de página única (SPA) construida con React, servida desde infraestructura estática en GCP. Se comunica exclusivamente con el backend mediante API REST.
- **Capa de lógica de negocio:** Servidor Node.js con framework Express, desplegado en contenedores sobre Google Cloud Run. Expone endpoints REST protegidos por middleware de autenticación y autorización. Gestiona validaciones, flujos de aprobación y lógica de auditoría.
- **Capa de datos:** Base de datos relacional PostgreSQL, alojada en Google Cloud SQL. Garantiza integridad referencial, transacciones ACID y persistencia de todos los registros del sistema.

La arquitectura de contenedores en Cloud Run permite escalabilidad automática, aislamiento de versiones y control de despliegue sin servidor. Las variables de entorno sensibles (credenciales, secretos JWT, configuración de base de datos) se gestionan mediante Google Secret Manager y no se almacenan en el código fuente.

### Autenticación y autorización

FamSPI implementa un modelo de autenticación federada mediante Google OAuth2, complementado con tokens JWT de sesión:

- El usuario inicia sesión a través del flujo OAuth2 de Google. El backend valida el token de identidad emitido por Google y genera un JWT propio con claims de rol, identificador de usuario y tiempo de expiración.
- Todas las rutas privadas del backend exigen el JWT en el encabezado `Authorization: Bearer <token>`. El middleware de autenticación valida la firma, la expiración y la vigencia del token antes de procesar cualquier solicitud.
- El sistema implementa refresh token para renovación silenciosa de sesión, evitando que el usuario sea desconectado abruptamente durante el uso activo.
- La autorización se gestiona mediante RBAC (Control de Acceso Basado en Roles). Cada rol tiene un conjunto definido de capacidades. El middleware de autorización verifica el rol incluido en el JWT contra los permisos requeridos por cada endpoint.

### Módulos en alcance validado

| Dimensión | Módulo | Descripción |
|---|---|---|
| Sistema global (primera línea base) | FamSPI completo | Infraestructura, despliegue, configuración, integraciones |
| Gobierno y Seguridad (transversal) | auth | Autenticación OAuth2 + JWT, sesión, refresh token |
| Gobierno y Seguridad (transversal) | security | Políticas de acceso, middleware de protección |
| Gobierno y Seguridad (transversal) | auditoria | Registro persistente de eventos críticos del sistema |
| Gobierno y Seguridad (transversal) | approvals | Flujo de aprobación de solicitudes por roles autorizados |
| Gobierno y Seguridad (transversal) | signature | Firma electrónica de aprobaciones o rechazos |
| Gobierno y Seguridad (transversal) | notifications | Notificaciones internas a usuarios sobre cambios de estado |
| Gobierno y Seguridad (transversal) | dashboard | Vista consolidada de indicadores y estados por rol |
| Permisos y Vacaciones (funcional) | permisos | Registro, aprobación y consulta de permisos laborales |
| Permisos y Vacaciones (funcional) | vacaciones | Registro de saldo, solicitud, aprobación y cancelación de vacaciones |
| Permisos y Vacaciones (funcional) | attendance | Control de asistencia relacionado con permisos y vacaciones |

---

## Requisitos funcionales

**RF-001:** El sistema debe permitir al usuario registrar una solicitud de permiso laboral completando todos los campos obligatorios definidos (tipo de permiso, fecha inicio, fecha fin, motivo, usuario solicitante). La solicitud debe quedar registrada en base de datos con estado inicial "Pendiente".

**RF-002:** El sistema debe permitir al usuario registrar una solicitud de vacaciones indicando el período solicitado. El sistema debe validar que el saldo de días disponibles sea suficiente antes de confirmar el registro.

**RF-003:** El sistema debe permitir a un usuario con rol autorizado (responsable o admin) aprobar o rechazar solicitudes de permisos y vacaciones, con registro obligatorio del motivo de rechazo cuando aplique.

**RF-004:** El sistema debe permitir consultar el historial de solicitudes de un usuario filtrado por período de tiempo, tipo de solicitud y estado.

**RF-005:** El sistema debe enviar notificaciones internas al solicitante cuando su solicitud cambia de estado (aprobada, rechazada, cancelada).

**RF-006:** El sistema debe mostrar en el dashboard un resumen del estado de solicitudes pendientes, aprobadas y rechazadas, diferenciado por rol del usuario autenticado.

**RF-007:** El sistema debe permitir la cancelación de una solicitud previamente registrada, siempre que no haya sido procesada aún, con registro del evento en el audit trail.

**RF-008:** El sistema debe validar que los campos de formularios no excedan los límites de longitud definidos y que los campos de tipo fecha sean coherentes (fecha fin no anterior a fecha inicio).

---

## Requisitos técnicos

**RT-001:** El backend debe estar desplegado en Google Cloud Run con imagen de contenedor versionada y trazable mediante registro en Artifact Registry de GCP.

**RT-002:** La base de datos debe ser PostgreSQL en Google Cloud SQL con respaldos automáticos habilitados, replicación y conexión cifrada (SSL/TLS).

**RT-003:** El frontend debe ser una SPA construida con React, compatible con navegadores modernos (Chrome, Firefox, Edge en versiones vigentes al momento de liberación).

**RT-004:** La API REST del backend debe implementar control de versiones en la ruta base (ej. `/api/v1/`) para garantizar compatibilidad ante futuras evoluciones.

**RT-005:** El sistema debe responder a solicitudes de endpoints críticos en menos de 3 segundos bajo condiciones normales de operación (carga promedio esperada).

**RT-006:** Las variables de entorno que contienen credenciales y secretos deben gestionarse exclusivamente mediante Google Secret Manager. No deben existir secretos en texto plano en el repositorio de código fuente.

**RT-007:** El sistema debe implementar limitación de tasa (rate limiting) en los endpoints de autenticación para mitigar ataques de fuerza bruta.

**RT-008:** El sistema debe operar bajo HTTPS en todas las comunicaciones entre el cliente y el servidor. El protocolo HTTP sin cifrar debe ser redirigido automáticamente.

---

## Requisitos de seguridad

**RS-001:** El acceso a todas las rutas privadas del sistema debe requerir un token JWT válido, no expirado y con firma verificable por el secreto del servidor.

**RS-002:** El sistema debe implementar RBAC mediante middleware centralizado que evalúe el rol del usuario para cada endpoint privado antes de ejecutar la lógica de negocio.

**RS-003:** Los tokens JWT deben tener un tiempo de expiración definido y configurable. El sistema no debe aceptar tokens expirados ni tokens con firma inválida.

**RS-004:** El sistema debe rechazar y registrar en el audit trail cualquier intento de acceso a rutas o recursos no autorizados para el rol del usuario autenticado (respuesta HTTP 403).

**RS-005:** Las contraseñas o credenciales de servicio no deben ser transmitidas en texto plano en ningún punto del sistema. La autenticación se delega a Google OAuth2.

**RS-006:** El sistema debe implementar protección contra inyección SQL mediante el uso de consultas parametrizadas o un ORM que evite la construcción dinámica de consultas con datos de usuario.

**RS-007:** Los mensajes de error devueltos por el sistema no deben exponer información interna (stack traces, nombres de tablas, rutas del servidor) en entornos de producción.

**RS-008:** El sistema debe cerrar la sesión del usuario correctamente al recibir una solicitud de logout, invalidando el token en el lado del servidor cuando sea posible.

---

## Requisitos de integridad de datos

**RID-001:** Todas las operaciones de escritura que involucren múltiples tablas relacionadas (ej. creación de solicitud + registro de auditoría) deben ejecutarse dentro de una transacción de base de datos para garantizar atomicidad.

**RID-002:** Los registros de solicitudes de permisos y vacaciones, una vez aprobados o rechazados, no deben poder ser modificados ni eliminados por ningún usuario, incluidos los administradores, salvo mediante un proceso documentado de corrección con trazabilidad completa.

**RID-003:** La base de datos debe implementar restricciones de integridad referencial (claves foráneas) para evitar registros huérfanos o inconsistentes entre tablas relacionadas.

**RID-004:** El backend debe validar todos los datos de entrada mediante esquemas de validación (Joi o Zod) antes de persistir cualquier registro en la base de datos.

**RID-005:** Los campos de auditoría (usuario que ejecutó la acción, timestamp, tipo de evento, resultado) deben ser generados por el servidor y nunca por el cliente, para garantizar su integridad.

---

## Requisitos de trazabilidad

**RTZ-001:** El sistema debe registrar en el módulo de auditoría todas las acciones críticas: inicio de sesión, cierre de sesión, creación de solicitud, aprobación, rechazo, cancelación y cambios de rol o permisos.

**RTZ-002:** Cada registro de auditoría debe contener como mínimo: identificador de usuario, rol en el momento de la acción, tipo de evento, entidad afectada, identificador de la entidad, resultado de la acción y timestamp en UTC.

**RTZ-003:** Los registros de auditoría deben ser de solo lectura para todos los roles de usuario, incluyendo el administrador. Solo pueden ser consultados, no modificados ni eliminados desde la interfaz del sistema.

**RTZ-004:** El sistema debe permitir consultar el audit trail filtrado por usuario, tipo de evento y rango de fechas, para facilitar revisiones de cumplimiento y resolución de incidencias.

**RTZ-005:** Cada solicitud de permiso o vacaciones debe mantener un historial de estados con registro del usuario responsable de cada cambio de estado y el timestamp correspondiente.

---

## Requisitos de evidencia

**RE-001:** El sistema debe producir respuestas API verificables y reproducibles ante cada escenario de prueba definido en los protocolos OQ y PQ, de modo que puedan capturarse como evidencia objetiva.

**RE-002:** Los logs de Cloud Run deben registrar el identificador de solicitud (request ID), método HTTP, ruta, código de respuesta y duración para cada llamada a la API.

**RE-003:** Las capturas de pantalla de la interfaz de usuario obtenidas durante la ejecución de pruebas deben reflejar el estado real del sistema en el momento de la prueba, con fecha y usuario autenticado visibles.

**RE-004:** La evidencia de cada prueba ejecutada debe ser archivada en el repositorio de documentación de validación con referencia explícita al ID de prueba y al URS que satisface.

**RE-005:** El sistema debe proveer endpoints o mecanismos de consulta que permitan verificar el estado de configuración del entorno (versión desplegada, variables de entorno activas sin exponer valores sensibles) como parte de la evidencia de IQ.

---

## Requisitos de control de cambios

**RCC-001:** Cualquier modificación al código fuente del sistema después de la liberación de la versión validada debe seguir un proceso formal de control de cambios que incluya evaluación de impacto sobre la validación existente.

**RCC-002:** Los cambios que afecten módulos en alcance validado deben requerir la actualización de los documentos de validación correspondientes (URS, FRS, protocolos de prueba) y la ejecución de pruebas de regresión antes de la liberación del cambio.

**RCC-003:** El repositorio de código fuente (Git) debe mantener el historial completo de commits como evidencia de los cambios aplicados al sistema, con mensajes de commit descriptivos y referencias al ítem de cambio cuando aplique.

**RCC-004:** Las versiones liberadas del sistema deben estar etiquetadas (git tag) en el repositorio con número de versión semántico, facilitando la identificación del estado exacto del código validado.

---

## Requisitos de usuario

**RU-001:** La interfaz de usuario debe ser accesible desde navegadores web modernos sin requerir instalación de software adicional en el equipo del usuario.

**RU-002:** Los formularios de solicitud deben mostrar mensajes de validación claros y específicos cuando el usuario omite campos obligatorios o introduce datos con formato incorrecto.

**RU-003:** El sistema debe mostrar el estado actual de las solicitudes del usuario de forma clara y sin ambigüedades en la vista principal del módulo correspondiente.

**RU-004:** Los usuarios con rol de responsable o administrador deben poder visualizar las solicitudes pendientes de aprobación desde su dashboard sin necesidad de navegar por múltiples pantallas.

**RU-005:** El sistema debe mostrar un mensaje de error comprensible cuando el usuario intenta acceder a una función para la cual no tiene autorización, sin exponer detalles técnicos del sistema.

---

## Atributos de datos

### Solicitud de Permiso

| Campo | Tipo | Obligatorio | Longitud máx. | Descripción |
|---|---|---|---|---|
| id | UUID | Sí (generado) | — | Identificador único de la solicitud |
| usuario_id | UUID | Sí | — | Referencia al usuario solicitante |
| tipo_permiso | String (enum) | Sí | 50 | Categoría del permiso (médico, personal, etc.) |
| fecha_inicio | Date | Sí | — | Fecha de inicio del permiso |
| fecha_fin | Date | Sí | — | Fecha de fin del permiso |
| motivo | Text | Sí | 500 | Descripción del motivo del permiso |
| estado | String (enum) | Sí (generado) | 20 | Estado: Pendiente / Aprobado / Rechazado / Cancelado |
| aprobado_por | UUID | No | — | Referencia al usuario que aprobó o rechazó |
| motivo_rechazo | Text | Condicional | 300 | Obligatorio si estado = Rechazado |
| created_at | Timestamp | Sí (generado) | — | Fecha y hora de creación en UTC |
| updated_at | Timestamp | Sí (generado) | — | Fecha y hora de última modificación en UTC |

### Solicitud de Vacaciones

| Campo | Tipo | Obligatorio | Longitud máx. | Descripción |
|---|---|---|---|---|
| id | UUID | Sí (generado) | — | Identificador único de la solicitud |
| usuario_id | UUID | Sí | — | Referencia al usuario solicitante |
| fecha_inicio | Date | Sí | — | Primer día del período de vacaciones |
| fecha_fin | Date | Sí | — | Último día del período de vacaciones |
| dias_solicitados | Integer | Sí (calculado) | — | Número de días hábiles solicitados |
| saldo_disponible | Integer | Sí (consulta) | — | Días disponibles al momento de la solicitud |
| estado | String (enum) | Sí (generado) | 20 | Estado: Pendiente / Aprobado / Rechazado / Cancelado |
| aprobado_por | UUID | No | — | Referencia al usuario que aprobó o rechazó |
| motivo_rechazo | Text | Condicional | 300 | Obligatorio si estado = Rechazado |
| created_at | Timestamp | Sí (generado) | — | Fecha y hora de creación en UTC |
| updated_at | Timestamp | Sí (generado) | — | Fecha y hora de última modificación en UTC |

---

## Campos obligatorios

Los siguientes campos son obligatorios en todos los formularios de registro y deben ser validados en el backend antes de la persistencia:

| Módulo | Campo obligatorio | Validación aplicada |
|---|---|---|
| Permisos | tipo_permiso | Debe ser un valor del enum definido |
| Permisos | fecha_inicio | Formato de fecha válido; no puede ser pasada |
| Permisos | fecha_fin | Posterior o igual a fecha_inicio |
| Permisos | motivo | No vacío; máximo 500 caracteres |
| Vacaciones | fecha_inicio | Formato de fecha válido |
| Vacaciones | fecha_fin | Posterior a fecha_inicio |
| Vacaciones | saldo_disponible | Debe ser mayor o igual a dias_solicitados |
| Auth | token JWT | Presente, no expirado, firma válida |
| Auditoría | usuario_id | Extraído del JWT; no proporcionado por cliente |
| Auditoría | timestamp | Generado por el servidor en UTC |

---

## Estados de solicitud (permisos y vacaciones)

El sistema implementa la siguiente máquina de estados para solicitudes de permisos y vacaciones:

| Estado | Descripción | Transiciones permitidas |
|---|---|---|
| Pendiente | Solicitud registrada, en espera de revisión | Aprobado, Rechazado, Cancelado |
| Aprobado | Solicitud aprobada por responsable o admin | Cancelado (bajo condiciones específicas) |
| Rechazado | Solicitud rechazada con motivo obligatorio | Ninguna (estado terminal) |
| Cancelado | Solicitud cancelada por el solicitante o un admin | Ninguna (estado terminal) |

Reglas de transición:
- Solo usuarios con rol `responsable` o `admin` pueden ejecutar transiciones hacia Aprobado o Rechazado.
- El solicitante puede cancelar su solicitud únicamente mientras está en estado Pendiente.
- Un admin puede cancelar una solicitud Aprobada, con registro obligatorio en el audit trail.

---

## Protección de la aplicación

FamSPI implementa las siguientes capas de protección a nivel de aplicación:

| Capa | Mecanismo | Descripción |
|---|---|---|
| Red | HTTPS/TLS | Todas las comunicaciones cifradas en tránsito |
| Autenticación | Google OAuth2 + JWT | Verificación de identidad mediante proveedor federado |
| Autorización | Middleware RBAC | Verificación de rol en cada endpoint privado |
| Validación | Joi/Zod en backend | Sanitización y validación de todos los datos de entrada |
| Base de datos | Consultas parametrizadas | Prevención de inyección SQL |
| Secretos | Google Secret Manager | Credenciales nunca en texto plano en código o contenedor |
| Rate limiting | Middleware Express | Limitación de intentos en endpoints de autenticación |
| Errores | Handler centralizado | Mensajes de error controlados sin exposición de internos |

---

## Rutas protegidas

Todas las rutas bajo el prefijo `/api/v1/` (excepto `/api/v1/auth/login` y `/api/v1/auth/callback`) son consideradas rutas privadas y están protegidas por el middleware de autenticación JWT. El acceso sin token válido resulta en respuesta HTTP 401. El acceso con token válido pero rol insuficiente resulta en respuesta HTTP 403.

| Prefijo de ruta | Módulo | Roles con acceso |
|---|---|---|
| `/api/v1/permisos` | Permisos | usuario, responsable, admin |
| `/api/v1/vacaciones` | Vacaciones | usuario, responsable, admin |
| `/api/v1/attendance` | Asistencia | usuario, responsable, admin |
| `/api/v1/approvals` | Aprobaciones | responsable, admin |
| `/api/v1/audit` | Auditoría (lectura) | admin |
| `/api/v1/users` | Gestión de usuarios | admin |
| `/api/v1/dashboard` | Dashboard | usuario, responsable, admin |
| `/api/v1/notifications` | Notificaciones | usuario, responsable, admin |
| `/api/v1/auth/logout` | Sesión | Cualquier autenticado |

---

## Roles y permisos

FamSPI implementa cuatro roles principales con las siguientes capacidades:

| Capacidad | usuario | responsable | admin | sistema (interno) |
|---|---|---|---|---|
| Registrar solicitud de permiso propio | Sí | Sí | Sí | No |
| Registrar solicitud de vacaciones propias | Sí | Sí | Sí | No |
| Cancelar solicitud propia (Pendiente) | Sí | Sí | Sí | No |
| Consultar historial propio | Sí | Sí | Sí | No |
| Aprobar / rechazar solicitudes de otros | No | Sí | Sí | No |
| Consultar solicitudes de todos los usuarios | No | Sí (su área) | Sí | No |
| Cancelar solicitud ajena (Aprobada) | No | No | Sí | No |
| Consultar audit trail | No | No | Sí | No |
| Gestionar usuarios y roles | No | No | Sí | No |
| Registrar eventos de auditoría | No | No | No | Sí |
| Enviar notificaciones internas | No | No | No | Sí |

**Notas:**
- El rol `sistema (interno)` corresponde a operaciones ejecutadas por el propio backend de forma automática (registro de auditoría, envío de notificaciones). No es asignable a usuarios.
- Los roles son asignados por el administrador mediante la interfaz de gestión de usuarios y quedan registrados en la base de datos.
- El rol activo del usuario se incluye en el JWT al momento de la autenticación y es verificado en cada solicitud.

---

## Audit trail y logs

### Eventos registrados en el módulo de auditoría

El módulo `auditoria` registra de forma automática los siguientes eventos críticos del sistema:

| Código de evento | Descripción | Módulo origen | Nivel de criticidad |
|---|---|---|---|
| AUTH_LOGIN_SUCCESS | Inicio de sesión exitoso | auth | Media |
| AUTH_LOGIN_FAILURE | Intento de inicio de sesión fallido | auth | Alta |
| AUTH_LOGOUT | Cierre de sesión del usuario | auth | Baja |
| AUTH_TOKEN_EXPIRED | Acceso rechazado por token expirado | auth | Media |
| AUTH_ACCESS_DENIED | Acceso denegado por rol insuficiente (403) | security | Alta |
| PERMISO_CREATED | Solicitud de permiso registrada | permisos | Media |
| PERMISO_APPROVED | Solicitud de permiso aprobada | approvals | Alta |
| PERMISO_REJECTED | Solicitud de permiso rechazada | approvals | Alta |
| PERMISO_CANCELLED | Solicitud de permiso cancelada | permisos | Media |
| VACACION_CREATED | Solicitud de vacaciones registrada | vacaciones | Media |
| VACACION_APPROVED | Solicitud de vacaciones aprobada | approvals | Alta |
| VACACION_REJECTED | Solicitud de vacaciones rechazada | approvals | Alta |
| VACACION_CANCELLED | Solicitud de vacaciones cancelada | vacaciones | Media |
| USER_ROLE_CHANGED | Cambio de rol de usuario | users | Alta |
| SYSTEM_ERROR | Error interno no controlado capturado | sistema | Alta |

### Estructura de cada registro de auditoría

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | Identificador único del registro |
| evento | String | Código de evento (ver tabla anterior) |
| usuario_id | UUID | Identificador del usuario que originó el evento |
| rol_usuario | String | Rol activo del usuario en el momento del evento |
| entidad | String | Tipo de entidad afectada (permiso, vacacion, user, etc.) |
| entidad_id | UUID | Identificador de la entidad afectada |
| resultado | String | SUCCESS o FAILURE |
| metadata | JSON | Información adicional contextual del evento |
| ip_origen | String | Dirección IP del cliente (cuando aplique) |
| timestamp | Timestamp | Fecha y hora del evento en UTC (generada por el servidor) |

Los registros del audit trail son de solo lectura desde la interfaz del sistema. No existe endpoint de escritura, modificación ni eliminación expuesto a usuarios. El acceso al audit trail está restringido exclusivamente al rol `admin`.

---

## Matriz URS

| ID | Categoría | Descripción | Criticidad | Componente | Criterio de Aceptación | Prueba Relacionada | Evidencia Esperada | Estado |
|---|---|---|---|---|---|---|---|---|
| URS-001 | Funcional | FamSPI debe permitir registrar una solicitud de permiso válida con todos los campos requeridos. | Alta | permisos | El sistema devuelve HTTP 201 y crea el registro en BD con estado "Pendiente" al enviar todos los campos obligatorios válidos. | OQ-001 | Captura de respuesta API HTTP 201 con cuerpo JSON de la solicitud creada | Pendiente ejecución |
| URS-002 | Funcional | FamSPI debe permitir registrar una solicitud de vacaciones válida con todos los campos requeridos. | Alta | vacaciones | El sistema devuelve HTTP 201 y crea el registro en BD con estado "Pendiente" y saldo descontado correctamente. | OQ-002 | Captura de respuesta API HTTP 201 con cuerpo JSON de la solicitud creada | Pendiente ejecución |
| URS-003 | Funcional | FamSPI debe permitir aprobar o rechazar solicitudes por un rol autorizado. | Alta | approvals | El sistema devuelve HTTP 200 y actualiza el estado de la solicitud en BD al recibir la acción de un usuario con rol responsable o admin. | OQ-003 | Captura de respuesta API HTTP 200 y verificación del estado en BD | Pendiente ejecución |
| URS-004 | Funcional | FamSPI debe permitir consultar el historial de solicitudes por usuario y por período. | Media | permisos, vacaciones | El sistema devuelve HTTP 200 con la lista filtrada de solicitudes del usuario según los parámetros de consulta proporcionados. | OQ-004 | Captura de respuesta API con listado JSON filtrado correctamente | Pendiente ejecución |
| URS-005 | Seguridad | FamSPI debe exigir autenticación válida para acceder a rutas privadas (OAuth2 + JWT). | Alta | auth, security | El sistema devuelve HTTP 401 ante solicitudes sin token o con token inválido/expirado a cualquier ruta privada. | OQ-005 | Captura de respuesta API HTTP 401 con mensaje controlado | Pendiente ejecución |
| URS-006 | Seguridad | FamSPI debe restringir acciones según el rol o permiso del usuario autenticado (RBAC). | Alta | security, approvals | El sistema devuelve HTTP 403 cuando un usuario con token válido pero rol insuficiente intenta ejecutar una acción restringida. | OQ-006 | Captura de respuesta API HTTP 403 con mensaje controlado; sin exposición de datos internos | Pendiente ejecución |
| URS-007 | Trazabilidad | FamSPI debe conservar trazabilidad de acciones críticas en el módulo de auditoría. | Alta | auditoria | Tras cada acción crítica (login, aprobación, rechazo, cancelación), existe un registro en la tabla de auditoría con todos los campos requeridos. | OQ-007 | Consulta directa a BD o endpoint de audit mostrando registro creado con timestamp, usuario_id, evento y resultado | Pendiente ejecución |
| URS-008 | Evidencia | FamSPI debe permitir generar evidencia objetiva verificable para cada prueba crítica definida. | Alta | Sistema completo | Cada prueba del protocolo OQ/PQ produce una respuesta API o comportamiento de UI capturable y reproducible. | OQ-008 | Capturas de pantalla y/o respuestas API documentadas por cada caso de prueba ejecutado | Pendiente ejecución |
| URS-009 | No funcional | FamSPI debe operar en un ambiente controlado e identificable (Cloud Run, GCP), verificable en IQ. | Alta | Infraestructura | El entorno de Cloud Run está activo, la versión del contenedor corresponde a FamSPI v1.0.0 y los servicios dependientes (Cloud SQL, Secret Manager) están operativos. | IQ-001 | Captura del panel de Cloud Run mostrando servicio activo con imagen de contenedor identificada; captura de Cloud SQL activo | Pendiente ejecución |
| URS-010 | Control de cambios | FamSPI debe mantener control de cambios documentado para modificaciones posteriores a la liberación. | Media | Proceso / Repositorio | Existe un procedimiento documentado de control de cambios y el historial de commits del repositorio refleja los cambios aplicados con mensajes descriptivos. | IQ-002 | Captura del historial de commits del repositorio; documento de control de cambios disponible | Pendiente ejecución |
| URS-011 | Funcional | FamSPI debe manejar errores esperados (credenciales inválidas, campos faltantes, permisos insuficientes) de forma controlada sin exponer datos internos. | Media | auth, security, permisos, vacaciones | El sistema devuelve respuestas de error HTTP 400/401/403/404 con mensajes descriptivos controlados, sin stack traces ni datos internos en el cuerpo de respuesta. | OQ-009 | Capturas de respuesta API para escenarios de error: HTTP 400 (campo faltante), HTTP 401 (sin token), HTTP 403 (rol insuficiente), HTTP 404 (recurso inexistente) | Pendiente ejecución |
| URS-012 | Integridad de datos | FamSPI debe preservar la integridad de los registros generados (solicitudes, aprobaciones, auditoría) sin permitir modificación no autorizada. | Alta | BD, auditoria | No existe endpoint que permita modificar o eliminar registros de solicitudes aprobadas/rechazadas ni registros de auditoría. Un intento de modificación no autorizada devuelve HTTP 403 o 405. | OQ-010 | Captura de respuesta API HTTP 403/405 ante intento de modificación de registro aprobado; verificación en BD de inmutabilidad del registro | Pendiente ejecución |
| URS-013 | Seguridad | FamSPI debe cifrar todas las comunicaciones entre cliente y servidor mediante HTTPS/TLS. | Alta | Infraestructura, red | El acceso al sistema mediante HTTP redirige automáticamente a HTTPS. El certificado TLS está vigente y emitido por una autoridad reconocida. | IQ-003 | Captura del navegador mostrando conexión segura (candado); resultado de verificación del certificado TLS | Pendiente ejecución |
| URS-014 | Trazabilidad | FamSPI debe registrar en el audit trail los intentos de acceso denegado (401 y 403) con identificación del usuario cuando sea posible. | Alta | auditoria, security | Tras cada respuesta HTTP 401 o 403, existe un registro en la tabla de auditoría con el evento correspondiente (AUTH_TOKEN_EXPIRED o AUTH_ACCESS_DENIED). | OQ-011 | Consulta a audit trail mostrando registro de evento de acceso denegado con timestamp y contexto | Pendiente ejecución |
| URS-015 | Funcional | FamSPI debe enviar notificaciones internas al solicitante cuando el estado de su solicitud cambia. | Media | notifications | El usuario solicitante recibe una notificación interna visible en la interfaz dentro de un tiempo razonable tras el cambio de estado de su solicitud. | OQ-012 | Captura de pantalla de la notificación interna mostrada al usuario tras aprobación o rechazo de su solicitud | Pendiente ejecución |
| URS-016 | No funcional | FamSPI debe responder a solicitudes de endpoints críticos en menos de 3 segundos bajo condiciones normales de operación. | Media | Backend, Cloud Run | El tiempo de respuesta de los endpoints de registro y consulta de solicitudes, medido desde el cliente, es inferior a 3 segundos en condiciones de carga promedio. | PQ-001 | Capturas de herramienta de medición de tiempos de respuesta (ej. logs de Cloud Run o herramienta de prueba) mostrando tiempos inferiores a 3 s | Pendiente ejecución |
| URS-017 | Integridad de datos | FamSPI debe validar en el backend todos los datos de entrada antes de persistirlos, rechazando datos malformados o incompletos. | Alta | Backend, permisos, vacaciones | El backend devuelve HTTP 400 con mensaje descriptivo ante cualquier solicitud con campos faltantes, tipos incorrectos o valores fuera de rango, sin crear ningún registro en BD. | OQ-013 | Capturas de respuesta API HTTP 400 para múltiples escenarios de datos inválidos; verificación en BD de ausencia de registros creados | Pendiente ejecución |
| URS-018 | Control de cambios | FamSPI debe mantener el código fuente versionado en un repositorio Git con etiquetas que identifiquen la versión validada. | Media | Repositorio | Existe una etiqueta Git correspondiente a la versión v1.0.0 validada. El commit referenciado corresponde al estado del sistema bajo validación. | IQ-004 | Captura del listado de tags del repositorio mostrando la etiqueta de versión validada | Pendiente ejecución |

---

## Matriz de riesgos integrada

| ID Riesgo | URS relacionado | Descripción del riesgo | Probabilidad | Impacto | Nivel | Mitigación implementada |
|---|---|---|---|---|---|---|
| RSK-001 | URS-005 | Acceso no autorizado por token JWT comprometido o robado | Media | Alto | Alto | Expiración de token configurable; HTTPS obligatorio; refresh token con rotación |
| RSK-002 | URS-006 | Escalada de privilegios por validación de rol incorrecta en el backend | Baja | Alto | Medio | Middleware RBAC centralizado; rol extraído del JWT generado por el servidor |
| RSK-003 | URS-012 | Modificación no autorizada de registros de solicitudes o auditoría | Baja | Alto | Medio | Ausencia de endpoints de modificación; restricciones de BD; validación de rol |
| RSK-004 | URS-007 | Pérdida de registros de auditoría por error en la transacción | Baja | Alto | Medio | Registro de auditoría dentro de transacción; manejo de errores con retry |
| RSK-005 | URS-001, URS-002 | Registros duplicados por doble envío del formulario (doble clic) | Media | Medio | Medio | Control de idempotencia en frontend; validación de unicidad en backend cuando aplique |
| RSK-006 | URS-009 | Interrupción del servicio por fallo en Cloud Run o Cloud SQL | Baja | Alto | Medio | Alta disponibilidad de Cloud Run; respaldos automáticos de Cloud SQL; alertas de monitoreo |
| RSK-007 | URS-011 | Exposición accidental de datos internos en mensajes de error en producción | Media | Medio | Medio | Handler centralizado de errores; configuración NODE_ENV=production; revisión de respuestas en pruebas |
| RSK-008 | URS-017 | Inyección de datos maliciosos por omisión de validación en algún endpoint | Baja | Alto | Medio | Validación Joi/Zod en todos los endpoints; consultas parametrizadas en ORM |

---

## Matriz de trazabilidad integrada

| ID URS | Requisito | Protocolo IQ | Protocolo OQ | Protocolo PQ | FRS relacionado |
|---|---|---|---|---|---|
| URS-001 | Registro de permiso válido | — | OQ-001 | PQ-001 | FRS-RF-001 |
| URS-002 | Registro de vacaciones válido | — | OQ-002 | PQ-001 | FRS-RF-002 |
| URS-003 | Aprobación / rechazo de solicitudes | — | OQ-003 | PQ-002 | FRS-RF-003 |
| URS-004 | Historial de solicitudes por usuario y período | — | OQ-004 | — | FRS-RF-004 |
| URS-005 | Autenticación JWT en rutas privadas | — | OQ-005 | — | FRS-RS-001 |
| URS-006 | RBAC por rol autenticado | — | OQ-006 | — | FRS-RS-002 |
| URS-007 | Trazabilidad en módulo de auditoría | — | OQ-007 | PQ-003 | FRS-RTZ-001 |
| URS-008 | Evidencia objetiva verificable | — | OQ-008 | — | FRS-RE-001 |
| URS-009 | Ambiente Cloud Run identificable | IQ-001 | — | — | FRS-RT-001 |
| URS-010 | Control de cambios documentado | IQ-002 | — | — | FRS-RCC-001 |
| URS-011 | Manejo controlado de errores | — | OQ-009 | — | FRS-RS-007 |
| URS-012 | Integridad de registros sin modificación no autorizada | — | OQ-010 | — | FRS-RID-002 |
| URS-013 | HTTPS/TLS en todas las comunicaciones | IQ-003 | — | — | FRS-RS-008 |
| URS-014 | Registro en audit trail de accesos denegados | — | OQ-011 | — | FRS-RTZ-002 |
| URS-015 | Notificaciones internas por cambio de estado | — | OQ-012 | — | FRS-RF-005 |
| URS-016 | Tiempo de respuesta menor a 3 segundos | — | — | PQ-001 | FRS-RT-005 |
| URS-017 | Validación de datos de entrada en backend | — | OQ-013 | — | FRS-RID-004 |
| URS-018 | Versión versionada con etiqueta Git | IQ-004 | — | — | FRS-RCC-004 |

---

## Revisión de adecuación del diseño (DQ integrado)

La presente sección documenta la revisión de adecuación del diseño (Design Qualification) integrada al URS, evaluando si las decisiones de diseño e implementación de FamSPI v1.0.0 son adecuadas para satisfacer los requerimientos de usuario especificados. Esta revisión se basa en el análisis del código fuente, la arquitectura desplegada y la documentación técnica disponible.

### Arquitectura general

El sistema adopta una arquitectura de tres capas (frontend SPA, backend API REST, base de datos relacional) desplegada en Google Cloud Platform. La separación de responsabilidades es clara: el frontend únicamente presenta datos y captura entrada del usuario; el backend ejecuta toda la lógica de negocio, validaciones y persistencia; la base de datos garantiza integridad y persistencia de los datos. Esta arquitectura es adecuada para los requerimientos funcionales, de seguridad y de integridad de datos especificados.

Cloud Run provee aislamiento de versiones por imagen de contenedor, lo que facilita la identificación de la versión validada y el control de despliegues. La escalabilidad automática garantiza disponibilidad ante variaciones de carga.

### Autenticación (OAuth2 / Google + JWT)

La autenticación federada mediante Google OAuth2 delega la verificación de credenciales a un proveedor de identidad de confianza, eliminando la necesidad de gestionar contraseñas en el sistema. El JWT generado por el backend incluye claims de identidad, rol y tiempo de expiración, y es firmado con un secreto gestionado en Google Secret Manager. La implementación de refresh token garantiza continuidad de sesión sin comprometer la seguridad por tokens de larga duración. Este diseño es adecuado para los requerimientos URS-005 y URS-008 del sistema.

### Autorización (RBAC por middleware)

La autorización se implementa mediante un middleware centralizado en Express que verifica el rol incluido en el JWT antes de ejecutar la lógica de cada endpoint. Los roles están definidos y documentados. La centralización del middleware reduce el riesgo de omisión de verificación en endpoints individuales. Este diseño es adecuado para los requerimientos URS-006 y URS-012.

### Roles definidos

Los cuatro roles implementados (usuario, responsable, admin, sistema interno) cubren los perfiles de uso esperados del sistema. La matriz de capacidades está claramente definida y es consistente con los requerimientos funcionales. La asignación de roles por el administrador y su inclusión en el JWT garantizan que la verificación sea ejecutada por el servidor, no por el cliente.

### Rutas protegidas

El middleware de autenticación está aplicado de forma global a todas las rutas bajo `/api/v1/` excepto las rutas de login y callback de OAuth2. Esta implementación garantiza que no existan rutas privadas accidentalmente desprotegidas. Las respuestas HTTP 401 y 403 están implementadas de forma diferenciada y con mensajes controlados.

### Auditoría (módulo `auditoria`)

El módulo de auditoría es transversal y registra eventos de forma automática sin intervención del usuario. Los campos de auditoría (timestamp, usuario_id, rol, evento, entidad, resultado) son generados por el servidor, garantizando su integridad. La tabla de auditoría no expone endpoints de escritura, modificación ni eliminación a usuarios. El diseño es adecuado para los requerimientos URS-007 y URS-014.

### Módulo de permisos

El módulo implementa el ciclo completo de vida de una solicitud de permiso: registro con validación de campos, transición de estados (Pendiente → Aprobado/Rechazado/Cancelado), consulta de historial y registro de cada cambio de estado en el audit trail. La validación de campos obligatorios se ejecuta en el backend mediante esquema Joi/Zod antes de la persistencia. Este diseño satisface los requerimientos URS-001, URS-003, URS-004, URS-011 y URS-017.

### Módulo de vacaciones

El módulo implementa verificación de saldo disponible antes de confirmar el registro, flujo de aprobación equivalente al de permisos y posibilidad de cancelación con trazabilidad. El cálculo de días solicitados se realiza en el servidor. Este diseño satisface los requerimientos URS-002, URS-003 y URS-017.

### Manejo de errores

El backend implementa un handler centralizado de errores que intercepta todas las excepciones y produce respuestas HTTP con código y mensaje controlado. En entorno de producción (`NODE_ENV=production`), los stack traces no son incluidos en la respuesta. Los códigos HTTP utilizados son semánticamente correctos: 400 (datos inválidos), 401 (no autenticado), 403 (no autorizado), 404 (recurso no encontrado), 500 (error interno). Este diseño satisface los requerimientos URS-007 (aspecto de mensajes) y URS-011.

### Integridad de datos

Las operaciones que involucran múltiples tablas (creación de solicitud + registro de auditoría) se ejecutan dentro de transacciones PostgreSQL, garantizando atomicidad. Las restricciones de integridad referencial están implementadas a nivel de base de datos. La validación con Joi/Zod en el backend previene la persistencia de datos malformados. Este diseño satisface los requerimientos URS-012 y URS-017.

### Evidencia

Los logs de Cloud Run registran cada solicitud HTTP con método, ruta, código de respuesta y duración. Las respuestas de la API son deterministas y reproducibles ante los mismos datos de entrada, facilitando la generación de evidencia objetiva durante la ejecución de pruebas. Este diseño satisface el requerimiento URS-008.

### Tabla de conclusión de adecuación del diseño

| Aspecto | Diseño implementado | Adecuación | Observación |
|---|---|---|---|
| Arquitectura general | SPA React + API REST Node.js/Express + PostgreSQL en Cloud Run / Cloud SQL | Adecuada | Separación de capas clara; aislamiento de versiones por contenedor |
| Autenticación | Google OAuth2 + JWT con expiración configurable y refresh token | Adecuada | Delegación a proveedor de confianza; secreto JWT en Secret Manager |
| Autorización | Middleware RBAC centralizado; rol en JWT generado por el servidor | Adecuada | Verificación centralizada; diferenciación semántica 401 vs 403 |
| Roles definidos | 4 roles: usuario, responsable, admin, sistema interno | Adecuada | Cubre todos los perfiles de uso identificados |
| Rutas protegidas | Middleware global en `/api/v1/`; excepciones solo en rutas de auth | Adecuada | Sin rutas privadas desprotegidas; implementación global reduce riesgo de omisión |
| Auditoría | Módulo `auditoria` transversal; 15 tipos de eventos; tabla de solo lectura | Adecuada | Campos generados por servidor; sin endpoints de modificación expuestos |
| Módulo permisos | Ciclo completo: registro, aprobación, rechazo, cancelación, historial | Adecuada | Validación backend con Joi/Zod; trazabilidad de cambios de estado |
| Módulo vacaciones | Registro con verificación de saldo, aprobación, cancelación | Adecuada | Cálculo de días en servidor; consistente con módulo de permisos |
| Manejo de errores | Handler centralizado; respuestas HTTP semánticas; sin exposición de internos en producción | Adecuada | Requiere verificar configuración `NODE_ENV=production` en IQ |
| Integridad de datos | Transacciones PostgreSQL; restricciones FK; validación Joi/Zod | Adecuada | Atomicidad garantizada; validación previa a persistencia |
| Evidencia | Logs de Cloud Run; respuestas API deterministas | Adecuada | Logs deben ser exportados y archivados como evidencia de prueba |
| Secretos y configuración | Google Secret Manager; sin secretos en texto plano en código | Adecuada | Verificar en IQ que `.env` de producción no contenga secretos hardcodeados |

---

*Fin del documento URS-FAMSPI-001 — Versión 1.0 — 2026-05-13*  
*Próxima revisión: ante cualquier cambio que afecte módulos en alcance validado o ante apertura de nuevo ciclo de validación.*
