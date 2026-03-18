# MAPA MAESTRO DE AREAS DE VALIDACION Y GENERACION DOCUMENTAL

## 1. Objetivo
Este documento define, con base en la evidencia real del repositorio, las áreas documentales del sistema SPI, los módulos que pertenecen a cada una, los componentes transversales que no deben asignarse de forma simplista a un solo dominio y el proceso requerido para generar expedientes documentales en formato Word usando la plantilla institucional vigente.

El criterio aplicado en este documento es de inventario técnico verificable. No se incluyen áreas, módulos o agrupaciones que no puedan justificarse mediante rutas montadas, carpetas funcionales frontend, servicios reales o scripts de generación existentes.

## 2. Base de verificación
La definición de áreas y generación documental se basa en estas evidencias:

- Backend:
  - [registerRoutes.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\routes\registerRoutes.js)
  - [app.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\app.js)
  - `backend/src/modules/*`
  - `backend/src/jobs/*`
  - `backend/src/middlewares/*`
- Frontend:
  - [AppRoutes.jsx](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\spi_front\src\routes\AppRoutes.jsx)
  - `spi_front/src/modules/*`
  - `spi_front/src/core/*`
- Documentación y automatización:
  - [validation-doc.config.json](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\validation-doc.config.json)
  - [prepare_validation_template.ps1](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\prepare_validation_template.ps1)
  - [generate_validation_docx_from_template.ps1](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\generate_validation_docx_from_template.ps1)
  - [generate_validation_area_single_docx.ps1](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\generate_validation_area_single_docx.ps1)
  - [README_AUTOMATIZACION.md](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\docs\validation\FORMATO_UNICO\README_AUTOMATIZACION.md)

## 3. Principios de agrupación
Las áreas se definen usando los siguientes criterios:

- El área debe corresponder a un dominio funcional identificable.
- Debe existir evidencia en frontend, backend o ambos.
- Los componentes transversales no se fuerzan a un solo dominio si sirven a varios.
- Los módulos no montados o artefactos inconsistentes se documentan como tales.
- La documentación por área debe poder trazarse a módulos, rutas o flujos reales.

## 4. Áreas documentales del sistema minimizadas

## 4.1 Criterio de compactación
El mapa inicial permitía separar el sistema en áreas muy finas, pero para efectos documentales conviene reducirlas siempre que:

- la operación real comparta actores y flujos
- el frontend y backend se consuman como un mismo dominio funcional
- la separación excesiva no aporte control adicional
- la validación siga siendo trazable sin perder cobertura

Con ese criterio, el sistema puede documentarse de forma suficiente en **6 áreas**.

## 4.2 Tabla de consolidación
| Mapa previo | Área compactada |
|---|---|
| Área 01 Gobierno, Seguridad y Cumplimiento | Área 01 Gobierno, Seguridad, Cumplimiento y Gestión Documental |
| Área 13 Documentos, Archivos, Notificaciones e Integraciones | Área 01 Gobierno, Seguridad, Cumplimiento y Gestión Documental |
| Área 02 Talento Humano y Administración de Personal | Área 02 Personas, Talento y Control Laboral |
| Área 03 Asistencia, Permisos y Vacaciones | Área 02 Personas, Talento y Control Laboral |
| Área 04 Comercial, Clientes y Planificación | Área 03 Comercial, Clientes, Backoffice y Business Case |
| Área 05 Business Case y Evaluación Técnico-Comercial | Área 03 Comercial, Clientes, Backoffice y Business Case |
| Área 06 Servicio Técnico y Operación de Campo | Área 04 Servicio Técnico, Operaciones y Calidad |
| Área 09 Operaciones y Catálogos Técnicos | Área 04 Servicio Técnico, Operaciones y Calidad |
| Área 11 Calidad | Área 04 Servicio Técnico, Operaciones y Calidad |
| Área 07 Compras, Abastecimiento e Inventario | Área 05 Compras, Inventario, Logística y Abastecimiento |
| Área 10 Logística | Área 05 Compras, Inventario, Logística y Abastecimiento |
| Área 08 Finanzas y Viáticos | Área 06 Finanzas, TI, Integraciones y Continuidad Operativa |
| Área 12 TI y Soporte | Área 06 Finanzas, TI, Integraciones y Continuidad Operativa |
| Área 14 Plataforma e Infraestructura Operativa | Área 06 Finanzas, TI, Integraciones y Continuidad Operativa |

## 4.3 Area 01: Gobierno, Seguridad, Cumplimiento y Gestión Documental
Estado documental:
- Área ya implementada y generable.

Backend principal:
- `auth`
- `security`
- `auditoria`
- `audit-prep`
- `approvals`
- `management`
- `signature`
- `documents`
- `files`
- `notifications`
- `dashboard`
- `gmail`

Soporte técnico relacionado:
- `middlewares/auth.js`
- `middlewares/roles.js`
- `middlewares/auditMiddleware.js`
- `utils/offHoursPolicy.js`
- `services/signatures/*`
- `utils/drive.js`
- `utils/calendar.js`
- `utils/mailer.js`
- `utils/googleChat.js`
- `services/gmail.service.js`
- `modules/calendar/calendar.service.js`
- `modules/integrations/*` como soporte técnico no montado

Frontend principal:
- `audit-prep`
- `auditoria`
- `signature`
- login/callback/LOPDP desde `shared`

Subdominios cubiertos:
- autenticación y sesión
- seguridad off-hours
- auditoría
- preparación de auditoría
- gestión gerencial del dominio
- firma documental
- soporte documental y de archivos
- notificaciones e integraciones críticas del dominio

Observaciones:
- `signature` mantiene doble montaje: `/api` y `/api/v1/signature`.
- `documents`, `files`, `notifications` y `dashboard` siguen siendo transversales, pero para simplificar el mapa se integran aquí como soporte documental y operativo del expediente.
- El backup de base de datos no pertenece a esta área.

## 4.4 Area 02: Personas, Talento y Control Laboral
Backend principal:
- `talento_humano`
- `personnel-requests`
- `users`
- `collaborators`
- `departments`
- `user-profile`
- `user-certifications`
- `attendance`
- `permisos`
- `vacaciones`

Jobs relacionados:
- `attendanceOvertimeScheduler.js`
- `permisosRecoveryCoordinationExpiryScheduler.js`

Frontend principal:
- `talento`
- `profile`
- `shared/solicitudes`
- `core/ui/widgets/AttendanceWidget.jsx`
- `talento/pages/AsistenciaReportes.jsx`

Subdominios cubiertos:
- colaboradores
- usuarios
- departamentos
- perfil y certificaciones
- solicitudes de personal
- asistencia
- horas extra
- permisos
- vacaciones
- reportes y control horario

Observaciones:
- `Permisos y Vacaciones` vive en `shared`, pero queda consolidado aquí por pertenecer al dominio de personas y control laboral.
- `DashboardTI.jsx` no pertenece a esta área aunque esté ubicado en `talento`.

## 4.5 Area 03: Comercial, Clientes, Backoffice y Business Case
Backend principal:
- `clients`
- `schedules`
- `applicants`
- `business-case`
- catálogos expuestos por `businessCase.routes.js`
  - `equipment-catalog`
  - `determinations-catalog`
  - `calculation-templates`

Jobs relacionados:
- `businessCasePreflowExpiryScheduler.js`
- `businessCaseDeterminationsGateExpiryScheduler.js`
- `businessCaseSheetGenerationQueueScheduler.js`

Frontend principal:
- `comercial`
- `backoffice`
- `comercial/pages/BusinessCaseWorkspace.jsx`
- `comercial/pages/BusinessCaseObservabilityDashboard.jsx`
- `comercial/components/workspace/*`

Subdominios cubiertos:
- clientes
- solicitudes comerciales
- planificación
- aprobación de cronogramas
- backoffice comercial
- business case
- observabilidad
- sincronización
- cantidades máximas
- factibilidad

Observaciones:
- Esta área compactada refleja mejor la operación real: comercial, backoffice y business case ya están conectados funcionalmente.
- `applicants` sigue siendo público y no usa `/api/v1`.

## 4.6 Area 04: Servicio Técnico, Operaciones y Calidad
Backend principal:
- `servicio`
- `technical-applications`

Backend con evidencia parcial:
- `operaciones` existe en código, pero no está montado en runtime
- `tecnico` existe en código, pero no está montado en runtime

Frontend principal:
- `servicio`
- `operaciones`
- `calidad`

Subdominios cubiertos:
- solicitudes técnicas
- mantenimientos desde la operación técnica
- disponibilidad
- capacitaciones
- aplicaciones técnicas
- desinfección
- verificación de equipos
- procedimientos técnicos
- determinaciones
- catálogos técnicos
- control operativo visible en frontend
- tablero de calidad

Observaciones:
- `operaciones` y `calidad` tienen evidencia frontend fuerte, pero backend parcial o indirecto.
- Se compactan aquí porque su consumo real está fuertemente ligado al flujo técnico y operativo.

## 4.7 Area 05: Compras, Inventario, Logística y Abastecimiento
Backend principal:
- `equipment-purchases`
- `private-purchases`
- `inventario`
- `mantenimientos`

Jobs relacionados:
- `checkExpiredReservations.js`
- `equipmentContractReminderEmails.js`

Backend con evidencia parcial:
- `logistica` existe en código, pero no está montado en `registerRoutes.js`

Frontend principal:
- `shared/purchases-workspace`
- `backoffice/private-purchases`
- `logistica`
- vistas de compras en `gerencia`, `operaciones`, `servicio` y `comercial`

Subdominios cubiertos:
- compras privadas
- compras de equipos
- reservas
- contratos
- inventario
- abastecimiento
- intervención logística

Observaciones:
- `PurchasesWorkspace` es transversal por naturaleza, pero para minimizar áreas se agrupa aquí como eje documental de abastecimiento.
- `mantenimientos` toca también servicio técnico; si se documenta aquí debe explicarse su cruce operativo.

## 4.8 Area 06: Finanzas, TI, Integraciones y Continuidad Operativa
Backend principal:
- `finanzas`
- `viaticos`
- `support-tickets`
- `internalJobs.routes.js`
- `jobsAuth.js`
- `server.js` en lo relativo a schedulers
- `databaseBackupToDrive.js`

Soporte técnico relacionado:
- `googleCredentials.js`
- control de contexto/request
- scheduler interno
- jobs técnicos
- continuidad operativa

Frontend principal:
- `finanzas`
- `ti`
- `talento/DashboardTI.jsx` como dashboard funcional TI

Subdominios cubiertos:
- finanzas
- viáticos
- soporte TI
- tickets
- jobs internos
- backup de base de datos
- continuidad operativa

Observaciones:
- Esta es la compactación más amplia del mapa.
- Se justifica porque los componentes agrupados aquí son esencialmente de soporte económico, técnico o de plataforma, no de flujo de negocio principal.
- El backup de BD pertenece aquí de forma explícita.

## 5. Componentes transversales que no deben asignarse ciegamente a una sola área

### 5.1 `requests`
Archivo clave:
- [requests.routes.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\modules\requests\requests.routes.js)

Razón:
- alimenta aprobaciones, gestión gerencial y otros flujos del sistema.

### 5.2 `documents` y `files`
Archivos clave:
- [documents.routes.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\modules\documents\documents.routes.js)
- [files.routes.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\modules\files\files.routes.js)

Razón:
- sirven a firma, auditoría, gestión documental y otros módulos.

### 5.3 `notifications` y `dashboard`
Archivos clave:
- [notifications.routes.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\modules\notifications\notifications.routes.js)
- [dashboard.routes.js](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\backend\src\modules\dashboard\dashboard.routes.js)

Razón:
- son capacidades transversales consumidas por múltiples áreas.

### 5.4 `shared`, `core/api`, `core/auth` y `core/ui`
Razón:
- son capas compartidas de frontend y no dominios funcionales autónomos.

## 6. Hallazgos de estructura que deben respetarse al documentar
- `comercial` dentro de backend contiene artefactos JSX y no debe tomarse como módulo backend real.
- `operaciones`, `logistica` y `tecnico` existen como rutas/estructura, pero no están montados en runtime.
- `applicants` es público y no sigue `/api/v1`.
- `signature` mantiene doble montaje.
- `PurchasesWorkspace` es realmente transversal.
- `Permisos y Vacaciones` vive en `shared`, pero documentalmente pertenece al dominio de personas/asistencia.

## 7. Reglas para generar documentación por área

### 7.1 Estructura mínima de una nueva área
Cada área nueva debe existir bajo:

- `docs/validation/areas/<area_slug>`

Ejemplo:
- `docs/validation/areas/area_02_talento_personal`

### 7.2 Archivos markdown requeridos
El generador actual espera, como mínimo:

- `01_URS_requerimientos_usuario.md`
- `02_FRS_requerimientos_funcionales.md`
- `03_DDS_diseno_tecnico.md`
- `03A_DD_diccionario_datos.md`
- `04_IQ_validacion_instalacion.md`
- `05_OQ_validacion_funcionamiento.md`
- `06_PQ_validacion_operacion_real.md`
- `09_informe_hallazgos_area_xx.md`
- `10_IQ_protocolo_ejecucion.md`
- `11_OQ_protocolo_ejecucion.md`
- `12_PQ_protocolo_ejecucion.md`
- `13_registro_evidencias_desviaciones.md`

Archivos opcionales:
- `00_indice_paquete_validacion.md`
- `08_revision_hallazgos_produccion.md`

### 7.3 Configuración obligatoria
Cada área nueva debe registrarse en:

- [validation-doc.config.json](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\validation-doc.config.json)

Con estos campos mínimos:
- `label`
- `definitions`
- `modules`

Campos recomendados:
- `supportDocuments`

### 7.4 Plantilla y content controls
La generación DOCX depende de una plantilla compatible con estos tags:

- `doc_title`
- `doc_area`
- `meta_system`
- `meta_code`
- `meta_version`
- `meta_date`
- `meta_status`
- `body_content`

Plantillas actuales:
- [Plantilla_Validacion_SPI.docx](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\docs\validation\FORMATO_UNICO\Plantilla_Validacion_SPI.docx)
- [Plantilla_Validacion_SPI_2.docx](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\docs\validation\FORMATO_UNICO\Plantilla_Validacion_SPI_2.docx)
- [Plantilla_Validacion_SPI_AUTOMATIZABLE.dotx](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\docs\validation\FORMATO_UNICO\Plantilla_Validacion_SPI_AUTOMATIZABLE.dotx)

### 7.5 Flujo real de generación
1. Preparar plantilla automatizable:
   - [prepare_validation_template.ps1](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\prepare_validation_template.ps1)
2. Generar el expediente único del área:
   - [generate_validation_area_single_docx.ps1](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\generate_validation_area_single_docx.ps1)
3. Alias operativo:
   - [generate_validation_area_docx.ps1](C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\scripts\generate_validation_area_docx.ps1)

### 7.6 Contenido agregado automáticamente por el generador
El consolidado único agrega:
- control documental
- firmas y sumillas
- introducción
- objetivo
- alcance
- base de evaluación
- marco normativo y de referencia
- documentos de soporte
- módulos evaluados
- metodología de validación
- definiciones
- matriz de trazabilidad resumida
- conclusión ejecutiva
- referencias

### 7.7 Comandos de generación
Preparar plantilla:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare_validation_template.ps1
```

Generar un área:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\generate_validation_area_single_docx.ps1 `
  -AreaPath .\docs\validation\areas\area_02_talento_personal `
  -AreaLabel "Area 02: Talento Humano y Administracion de Personal" `
  -TemplatePath .\docs\validation\FORMATO_UNICO\Plantilla_Validacion_SPI_AUTOMATIZABLE_RUNTIME.dotx `
  -Code "VAL-SPI-TH-PAQUETE" `
  -Version "1.0" `
  -Status "BORRADOR" `
  -Mode Final
```

## 8. Reglas de contenido para nuevas áreas
- Cada sección debe responder, cuando aplique, al por qué, cómo y cuándo.
- Todo apartado de `Flujos` debe incluir flujograma.
- Las referencias normativas o legales deben citarse en el texto y listarse en:
  - `Documentos de soporte`
  - `Referencias`
- No deben aparecer referencias visibles a nombres de archivos fuente `.md` dentro del documento final.
- Los componentes ambiguos deben documentarse como ambiguos; no deben reasignarse sin evidencia.

## 9. Próximo uso recomendado
Con este mapa, el siguiente paso correcto para ampliar la validación del sistema es:

1. Crear la carpeta del área siguiente.
2. Registrar el área en `validation-doc.config.json`.
3. Redactar los 12 documentos base del área con trazabilidad real a módulos verificados.
4. Ejecutar el generador consolidado.
5. Revisar el `.docx` final y ajustar evidencias o soporte normativo según el dominio documentado.

## 10. Conclusión
El sistema SPI ya permite definir y generar expedientes documentales por área, pero hoy solo el Área 01 está formalmente integrada. Este mapa maestro deja identificadas las demás áreas del sistema sobre evidencia real del repositorio, delimita los componentes transversales y establece el proceso mínimo para generar nuevos expedientes sin asumir módulos inexistentes, montajes no activos o dominios funcionales no verificados.
