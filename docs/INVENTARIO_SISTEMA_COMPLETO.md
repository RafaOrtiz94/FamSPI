# Inventario Operativo del Sistema FamSPI

Fecha de corte: 2026-06-24  
Entorno validado: produccion  
Zona horaria de referencia: America/Guayaquil

## Fuente de verdad utilizada

Este inventario fue levantado sin asumir nada, validando:

- Frontend real: `spi_front/src/routes/AppRoutes.jsx`
- Backend real: `backend/src/routes/registerRoutes.js`
- RBAC real: `backend/src/middlewares/roles.js`
- Base de datos real de produccion: tabla `public.users` y `public.departments` en Neon

Hallazgo de contexto:

- `backend/src/modules/INDEX_CONTEXT.md` esta desactualizado frente al codigo real montado hoy.

## Resumen ejecutivo

- Total de usuarios en produccion: 32
- Usuarios activos: 27
- Usuarios inactivos: 5
- Roles presentes realmente en produccion: 16
- Existen roles/estados de rol no homologados en produccion: `null`, `pending`, `pendiente`

## 1. Modulos backend montados actualmente

Cada item corresponde a una ruta base registrada hoy en `registerRoutes.js`.

| Ruta base | Modulo / dominio |
|---|---|
| `/api/v1/auth` | Autenticacion |
| `/api/applicants` | Postulantes |
| `/api/v1/integrations/crm/webhook` | Webhook CRM |
| `/api/v1/requests` | Solicitudes |
| `/api/v1/approvals` | Aprobaciones |
| `/api/v1/finanzas` | Finanzas |
| `/api/v1/talento-humano` | Talento humano |
| `/api/v1/departments` | Departamentos |
| `/api/v1/auditoria` | Auditoria |
| `/api/v1/audit-prep` | Preparacion de auditoria |
| `/api/v1/security` | Seguridad |
| `/api/v1/management` | Gestion / management |
| `/api/v1/documents` | Documentos |
| `/api/v1/files` | Archivos |
| `/api/v1/servicio` | Servicio tecnico |
| `/api/v1/technical-applications` | Aplicaciones tecnicas |
| `/api/v1/business-case` | Business case |
| `/api/v1/equipment-catalog` | Catalogo de equipos |
| `/api/v1/determinations-catalog` | Catalogo de determinaciones |
| `/api/v1/calculation-templates` | Plantillas de calculo |
| `/api/v1/mantenimientos` | Mantenimientos |
| `/api/v1/integrations` | Integraciones |
| `/internal/integration` | Integraciones internas |
| `/api/v1/servicio/external-cases` | Casos externos de servicio |
| `/api/v1/calidad` | Calidad |
| `/api/v1/calidad/cleaning` | Calidad - limpieza |
| `/api/v1/calidad/buenas-practicas` | Calidad - buenas practicas |
| `/api/v1/calidad/documentos` | Calidad - documentos |
| `/api/v1/calidad/recall` | Calidad - recall |
| `/api/v1/calidad/quejas` | Calidad - quejas |
| `/api/v1/calidad/refrigerados` | Calidad - refrigerados |
| `/api/v1/calidad/capa` | Calidad - CAPA |
| `/api/v1/calidad/riesgos` | Calidad - riesgos |
| `/api/v1/calidad/incidentes` | Calidad - incidentes |
| `/api/v1/calidad/higiene` | Calidad - higiene |
| `/api/v1/calidad/comunicaciones` | Calidad - comunicaciones |
| `/api/v1/calidad/areas-calificadas` | Calidad - areas calificadas |
| `/api/v1/calidad/auditorias` | Calidad - auditorias |
| `/api/v1/calidad/muestreo` | Calidad - muestreo |
| `/api/v1/calidad/tecnovigilancia` | Calidad - tecnovigilancia |
| `/api/v1/users` | Usuarios |
| `/api/v1/collaborators` | Colaboradores |
| `/api/v1/offboarding` | Offboarding |
| `/api/v1/inventario` | Inventario |
| `/api/v1/equipment-management` | Gestion de equipos |
| `/api/v1/attendance` | Asistencia |
| `/asistencia` | Asistencia publica / acceso alterno |
| `/api/v1/gmail` | Gmail |
| `/api/v1/equipment-purchases` | Compras de equipos |
| `/api/v1/private-purchases` | Compras privadas |
| `/api/v1/delivery-ceilings` | Techos / maximos de entrega |
| `/api/v1/delivery-requests` | Solicitudes de entrega |
| `/api/v1/public-delivery-plans` | Planes publicos de entrega |
| `/api/v1/personnel-requests` | Solicitudes de personal |
| `/api/v1/permisos` | Permisos |
| `/api/v1/vacaciones` | Vacaciones |
| `/api/v1/clients` | Clientes |
| `/api/v1/schedules` | Planificacion |
| `/api/v1/notifications` | Notificaciones |
| `/api/v1/dashboard` | Dashboard |
| `/api/v1/support-tickets` | Tickets de soporte |
| `/api/v1/ti-assets` | Activos TI |
| `/api/v1/collab-deliveries` | Entregas a colaboradores |
| `/api/v1/module-access` | Acceso a modulos |
| `/api/v1/kickoff` | Kickoff |
| `/api/v1/famsheets` | FamSheets |
| `/api/v1/opportunities` | Oportunidades |
| `/api/v1/hiring-pipeline` | Pipeline de contratacion |
| `/api/v1/trainings` | Capacitaciones |
| `/api/v1/viaticos` | Viaticos |
| `/internal/jobs` | Jobs internos |
| `/api/v1/users/me/profile` | Perfil propio |
| `/api/v1/signature` | Firma |
| `/api/v1/signature-workflows` | Workflows de firma |
| `/api` | Rutas legacy / complementarias de firma |

## 2. Vistas frontend registradas actualmente

Las siguientes rutas existen hoy en `AppRoutes.jsx`.

### 2.1 Vistas publicas y transversales

| Ruta | Vista / uso |
|---|---|
| `/login` | Inicio de sesion |
| `/login/callback` | Callback de autenticacion |
| `/unauthorized` | Acceso denegado |
| `/registro-en-proceso` | Rol pendiente / registro en proceso |
| `/verificar/:token` | Verificacion documental |
| `/verificar/famsign/:token` | Verificacion de workflow de firma |
| `/kickoff/sala/:token` | Ingreso QR a sala kickoff |
| `/mobile-shortcuts` | Accesos rapidos moviles |
| `/asistencia/mobile-shortcuts` | Accesos rapidos de asistencia |
| `/asistencia/marcar/:action` | Marcacion de asistencia |
| `/requests` | Solicitudes compartidas |
| `/mantenimientos` | Mantenimientos compartidos |
| `/documents` | Documentos compartidos |
| `/configuration` | Configuracion |
| `/dashboard/mi-perfil` | Perfil personal |
| `/` | Redireccion a login |
| `*` | Not Found |

### 2.2 Gerencia y finanzas

| Ruta | Vista / uso |
|---|---|
| `/dashboard/gerencia` | Dashboard de gerencia |
| `/dashboard/gerencia/aprobaciones-contratos` | Album / aprobaciones gerencia |
| `/dashboard/gerencia/compras-album` | Album de compras |
| `/dashboard/finanzas` | Dashboard de finanzas |
| `/dashboard/finanzas/viaticos` | Workspace de viaticos |
| `/dashboard/collab/entregas` | Entregas a colaboradores para financiero / TH / jefe tecnico |
| `/dashboard/collab/resumen` | Resumen de entregas para gerencia |

### 2.3 Comercial, clientes y business case

| Ruta | Vista / uso |
|---|---|
| `/dashboard/comercial` | Dashboard comercial |
| `/dashboard/comercial/solicitudes` | Solicitudes comerciales |
| `/dashboard/comercial/clientes` | Clientes |
| `/dashboard/comercial/new-client-request` | Nueva solicitud de cliente |
| `/dashboard/comercial/equipment-purchases` | Compras de equipos |
| `/dashboard/comercial/delivery-ceilings` | Maximos / techos de entrega |
| `/dashboard/comercial/planificacion` | Planificacion mensual |
| `/dashboard/comercial/famsheets` | Vista principal de FamSheets |
| `/dashboard/comercial/famsheets/dashboard` | Dashboard de FamSheets |
| `/dashboard/comercial/famsheets/:id` | Workspace de oportunidad |
| `/dashboard/comercial/opportunities` | Redireccion a FamSheets |
| `/dashboard/comercial/opportunities/:id` | Workspace de oportunidad |
| `/dashboard/comercial/acp-compras` | Compras ACP comercial |
| `/dashboard/comercial/aprobaciones-planificacion` | Aprobaciones de cronogramas |
| `/dashboard/business-case` | Workspace de business case |
| `/dashboard/comercial/business-case` | Workspace de business case desde comercial |
| `/dashboard/business-case/workspace` | Workspace de business case |
| `/dashboard/business-case/workspace/:id` | Workspace puntual de business case |
| `/dashboard/business-case/observabilidad` | Observabilidad de business case |
| `/dashboard/clientes` | Clientes compartido |
| `/dashboard/backoffice/client-requests` | Solicitudes de cliente para backoffice |
| `/dashboard/backoffice/client-request/:id` | Revision puntual de solicitud de cliente |

### 2.4 Servicio tecnico, operaciones, logistica y calidad

| Ruta | Vista / uso |
|---|---|
| `/dashboard/servicio-tecnico` | Dashboard de servicio tecnico |
| `/dashboard/servicio-tecnico/mantenimientos` | Mantenimientos de servicio |
| `/dashboard/servicio-tecnico/solicitudes` | Solicitudes de servicio |
| `/dashboard/servicio-tecnico/disponibilidad` | Disponibilidad |
| `/dashboard/servicio-tecnico/capacitaciones` | Capacitaciones de servicio |
| `/dashboard/servicio-tecnico/equipos` | Equipos de servicio |
| `/dashboard/equipos` | Workspace de equipos |
| `/dashboard/equipos/activos` | Workspace de equipos / activos |
| `/dashboard/servicio-tecnico/aprobaciones` | Aprobaciones de servicio |
| `/dashboard/servicio-tecnico/aplicaciones` | Aplicaciones tecnicas |
| `/dashboard/servicio-tecnico/desinfeccion` | Proceso de desinfeccion |
| `/dashboard/servicio-tecnico/asistencia` | Asistencia operativa |
| `/dashboard/servicio-tecnico/verificacion` | Verificacion de equipos |
| `/dashboard/servicio-tecnico/workspace-procedimiento` | Redireccion a workspace de compras publicas |
| `/dashboard/servicio-tecnico/retiros` | Retiros |
| `/dashboard/servicio-tecnico/casos-externos` | Casos externos |
| `/dashboard/ti/casos-externos` | Casos externos desde TI |
| `/dashboard/servicio-tecnico/entregas-privadas` | Redireccion a compras privadas |
| `/dashboard/operaciones` | Dashboard operaciones |
| `/dashboard/logistica` | Dashboard logistica |
| `/dashboard/operaciones/private-purchases` | Compras privadas para jefe operaciones |
| `/dashboard/logistica/private-purchases` | Compras privadas para jefe logistica |
| `/dashboard/purchases/workspace` | Workspace de compras |
| `/dashboard/operaciones/determinaciones` | Catalogo de determinaciones |
| `/dashboard/links-interes` | Links de interes |
| `/dashboard/calidad` | Dashboard calidad |
| `/dashboard/calidad/temperatura` | CA-01-01 |
| `/dashboard/calidad/limpieza` | CA-01-02 |
| `/dashboard/calidad/buenas-practicas` | CA-01-03 |
| `/dashboard/calidad/plagas` | CA-01-04 |
| `/dashboard/calidad/documentos` | CA-01-05 |
| `/dashboard/calidad/recall` | CA-01-06 |
| `/dashboard/calidad/quejas` | CA-01-07 |
| `/dashboard/calidad/refrigerados` | CA-01-08 |
| `/dashboard/calidad/capa` | CA-01-09 |
| `/dashboard/calidad/riesgos` | CA-01-10 |
| `/dashboard/calidad/incidentes` | CA-01-11 |
| `/dashboard/calidad/higiene` | CA-01-12 |
| `/dashboard/calidad/comunicaciones` | CA-01-13 |
| `/dashboard/calidad/areas` | CA-01-14 |
| `/dashboard/calidad/auditorias` | CA-01-15 |
| `/dashboard/calidad/muestreo` | CA-01-16 |
| `/dashboard/calidad/tecnovigilancia` | CA-01-17 |

### 2.5 Tecnologia / TI

| Ruta | Vista / uso |
|---|---|
| `/dashboard/ti` | Dashboard TI |
| `/dashboard/ti/workspace` | Workspace de tickets TI |
| `/dashboard/ti/dispositivos` | Gestion de dispositivos |
| `/dashboard/ti/actas` | Actas TI |
| `/dashboard/ti/mantenimientos` | Redireccion a dispositivos |
| `/dashboard/ti/modulos` | Acceso a modulos |
| `/dashboard/ti/modulos/*` | Acceso a modulos anidado |
| `/dashboard/ti/activos` | Activos TI para financiero / TH / jefe tecnico |

### 2.6 Talento humano y control laboral

| Ruta | Vista / uso |
|---|---|
| `/dashboard/talento-humano` | Dashboard talento humano |
| `/dashboard/talento-humano/pruebas-tecnicas` | Responsable de pruebas tecnicas |
| `/dashboard/talento-humano/command-center` | Command center TH |
| `/dashboard/talento-humano/command-center/:kind` | Command center filtrado |
| `/dashboard/talento-humano/command-center/:kind/:id` | Command center detalle |
| `/dashboard/talento-humano/colaboradores` | Command center en vista colaboradores |
| `/dashboard/talento-humano/colaboradores/:id` | Colaborador puntual |
| `/dashboard/talento-humano/gestion` | People admin hub |
| `/dashboard/talento-humano/usuarios` | Gestion de usuarios |
| `/dashboard/talento-humano/departamentos` | Gestion de departamentos |
| `/dashboard/talento-humano/solicitudes` | Solicitudes de personal |
| `/dashboard/talento-humano/workspace-personal` | Workspace personal |
| `/dashboard/talento-humano/workspace-personal/:id` | Workspace personal detalle |
| `/dashboard/talento-humano/asistencia-reportes` | Reportes de asistencia |
| `/dashboard/talento-humano/permisos` | Permisos |
| `/dashboard/capacitaciones` | Capacitaciones |
| `/dashboard/capacitaciones/:id` | Detalle de capacitacion |

### 2.7 Auditoria, kickoff y firma

| Ruta | Vista / uso |
|---|---|
| `/dashboard/auditoria` | Auditoria |
| `/dashboard/auditoria/preparacion` | Preparacion de auditoria |
| `/dashboard/kickoff` | Kickoff |
| `/dashboard/kickoff/presentacion/:presentationId` | Presentacion kickoff |
| `/dashboard/kickoff/sala/:presentationId` | Sala kickoff |
| `/dashboard/signatures` | Redireccion a bandeja de firma |
| `/dashboard/signatures/inbox` | Bandeja de firma |
| `/dashboard/signatures/created` | Documentos creados |
| `/dashboard/signatures/completed` | Documentos completados |
| `/dashboard/signatures/all` | Todos los documentos de firma |
| `/dashboard/signatures/:documentId/sign` | Firma de documento |
| `/dashboard/signatures/workflows/:workflowId` | Detalle de workflow de firma |

## 3. Catalogo de roles definido en RBAC

Los siguientes grupos de roles estan definidos en `roles.js`.

| Grupo RBAC | Roles incluidos |
|---|---|
| `comercial` | `comercial`, `jefe_comercial`, `jefe_de_comercial`, `backoffice_comercial`, `asesor_comercial`, `analista_comercial`, `acp_comercial`, `backoffice` |
| `tecnico` | `tecnico`, `servicio_tecnico`, `jefe_servicio_tecnico`, `jefe_de_servicio_tecnico`, `jefe_tecnico`, `jefe_de_tecnico` |
| `servicio_tecnico` | `servicio_tecnico`, `tecnico`, `jefe_servicio_tecnico`, `jefe_de_servicio_tecnico`, `jefe_tecnico`, `jefe_de_tecnico` |
| `gerencia` | `gerencia`, `gerencia_general`, `gerente_general`, `director`, `gerente` |
| `operaciones` | `operaciones`, `jefe_operaciones`, `jefe_de_operaciones`, `analista_operaciones` |
| `calidad` | `calidad`, `jefe_calidad` |
| `ti` | `ti`, `jefe_ti`, `jefe_de_ti`, `desarrollador`, `soporte` |
| `admin` | `admin`, `administrador` |
| `talento_humano` | `talento_humano`, `jefe_talento_humano`, `jefe_de_talento_humano`, `analista_talento_humano`, `asistente_talento_humano`, `auxiliar_talento_humano`, `rh`, `rrhh` |
| `finanzas` | `finanzas`, `financiero`, `jefe_finanzas`, `jefe_de_finanzas`, `contador`, `jefe_financiero` |
| `jefe_comercial` | `jefe_comercial`, `jefe_de_comercial` |
| `jefe_servicio_tecnico` | `jefe_servicio_tecnico`, `jefe_de_servicio_tecnico` |
| `jefe_tecnico` | `jefe_tecnico`, `jefe_de_tecnico` |
| `jefe_operaciones` | `jefe_operaciones`, `jefe_de_operaciones` |
| `jefe_calidad` | `jefe_calidad`, `jefe_de_calidad` |
| `jefe_ti` | `jefe_ti`, `jefe_de_ti` |
| `jefe_talento_humano` | `jefe_talento_humano`, `jefe_de_talento_humano` |
| `jefe_finanzas` | `jefe_finanzas`, `jefe_de_finanzas` |
| `backoffice_comercial` | `backoffice_comercial` |

Roles superusuario definidos:

- `admin`
- `administrador`

## 4. Roles presentes realmente en produccion

Conteo validado directamente sobre `public.users`.

| Rol real en DB | Total usuarios |
|---|---:|
| `tecnico` | 9 |
| `comercial` | 6 |
| `talento_humano` | 3 |
| `null` | 2 |
| `pending` | 2 |
| `acp_comercial` | 1 |
| `financiero` | 1 |
| `gerencia_general` | 1 |
| `jefe_calidad` | 1 |
| `jefe_comercial` | 1 |
| `jefe_financiero` | 1 |
| `jefe_logistica` | 1 |
| `jefe_operaciones` | 1 |
| `jefe_ti` | 1 |
| `logistica` | 1 |
| `pendiente` | 1 |

## 5. Usuarios en produccion

Listado validado directamente en Neon. Estado `Activo` corresponde al campo booleano `active`.

| ID | Nombre | Email | Rol | Departamento | Estado |
|---|---|---|---|---|---|
| 13 | Evelyn Rojas | `evelyn.rojas@fam-project.com` | `acp_comercial` | Comercial | Activo |
| 23 | Eric Gavilanes | `eric.gavilanes@fam-project.com` | `comercial` | Comercial | Activo |
| 28 | Galo Leon | `galo.leon@fam-project.com` | `comercial` | Comercial | Activo |
| 14 | Jose Morales | `jose.morales@fam-project.com` | `comercial` | Comercial | Activo |
| 29 | Karen Barberan | `karen.barberan@fam-project.com` | `comercial` | Comercial | Activo |
| 39 | Liliana Romero | `liliana.romero@fam-project.com` | `comercial` | Gerencia General | Activo |
| 37 | Zuley Tamayo | `zuley.tamayo@fam-project.com` | `comercial` | Comercial | Inactivo |
| 30 | Soledad Fiallos | `soledad.fiallos@fam-project.com` | `financiero` | Finanzas | Activo |
| 22 | Pamela Altamirano | `pamela.altamirano@fam-project.com` | `gerencia_general` | Gerencia General | Activo |
| 25 | Veronica Medina | `veronica.medina@fam-project.com` | `jefe_calidad` | Calidad | Activo |
| 12 | Alex Farino | `alex.farino@fam-project.com` | `jefe_comercial` | Comercial | Activo |
| 32 | Alexandra Molina | `alexandra.molina@fam-project.com` | `jefe_financiero` | Finanzas | Activo |
| 27 | Flavio Acosta | `flavio.acosta@fam-project.com` | `jefe_logistica` | Operaciones | Activo |
| 31 | Lidia Viracocha | `lidia.viracocha@fam-project.com` | `jefe_operaciones` | Operaciones | Activo |
| 1 | Rafael Ortiz | `rafael.ortiz@fam-project.com` | `jefe_ti` | Tecnologia / TI | Activo |
| 34 | Jose Viracocha | `jose.viracocha@fam-project.com` | `logistica` | Operaciones | Activo |
| 6 | Emily Sevilla | `emily.sevilla@fam-project.com` | `null` | Comercial | Inactivo |
| 36 | Fabian Carpio | `fabian.carpio@fam-project.com` | `null` | Comercial | Inactivo |
| 40 | Andres Piedra | `andres.piedra@fam-project.com` | `pendiente` | Servicio Tecnico | Activo |
| 24 | Edison Bonilla | `edison.bonilla@fam-project.com` | `pending` | Comercial | Inactivo |
| 11 | Persona Pedidos | `pedidos@fam-project.com` | `pending` | Comercial | Activo |
| 5 | Famproject TICs | `administrador@fam-project.com` | `talento_humano` | Gerencia General | Activo |
| 21 | Talento Humano | `talento.humano@fam-project.com` | `talento_humano` | Comercial | Activo |
| 38 | Valeria Revelo | `valeria.revelo@fam-project.com` | `talento_humano` | Talento Humano | Activo |
| 41 | Aura Jimenez | `aura.jimenez@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 35 | Clara Arroyo | `clara.arroyo@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 42 | Daniel Fiallos | `daniel.fiallos@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 43 | Ilsy Ramirez | `ilsy.ramirez@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 33 | Kevin Lalaleo | `kevin.lalaleo@fam-project.com` | `tecnico` | Comercial | Activo |
| 44 | Kevin Loor | `kevin.loor@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 45 | Lizbeth Rivadeneira | `lizbeth.rivadeneira@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 46 | Luisao Escobar | `luisao.escobar@fam-project.com` | `tecnico` | Servicio Tecnico | Activo |
| 26 | Vinicio Gallo | `vinicio.gallo@fam-project.com` | `tecnico` | Comercial | Inactivo |

## 6. Hallazgos operativos relevantes

1. El inventario previo ya no era confiable para salida a produccion porque no reflejaba todas las rutas hoy montadas.
2. Hay divergencia entre el catalogo RBAC del codigo y los roles realmente presentes en produccion.
3. Existen roles con apariencia de estado o dato sucio en `public.users`: `null`, `pending`, `pendiente`.
4. Existen usuarios ubicados en departamentos que no necesariamente coinciden con el rol operativo asignado; esto debe revisarse antes de endurecer permisos o reportes por area.
5. `administrador@fam-project.com` hoy figura en produccion con rol `talento_humano`, no con `admin` ni `administrador`.

## 7. Recomendacion para salida a produccion

Antes de abrir varios modulos simultaneamente, conviene cerrar un saneamiento minimo de seguridad operativa:

1. Homologar roles reales de `public.users` contra el catalogo RBAC esperado.
2. Resolver los usuarios con roles `null`, `pending` y `pendiente`.
3. Confirmar si el usuario `administrador@fam-project.com` debe conservar rol operativo o rol superusuario.
4. Validar por cada modulo que la vista frontend abierta al usuario coincide con un rol existente y activo.
