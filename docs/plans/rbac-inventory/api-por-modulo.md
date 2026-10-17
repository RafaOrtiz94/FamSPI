# Registro propuesto: ruta API -> modulo

Generado por `backend/scripts/rbac/generate_api_module_registry.js`. No editar a mano: se regenera.

Propuesta para aprobacion funcional. Hoy solo la usa el modo sombra: no autoriza ni deniega nada.

- **Observada**: llamada real vista al recorrer el menu de los 17 roles en el ambiente local.
- **Estatica**: una pantalla de ese modulo alcanza, por sus imports, codigo que llama a esa API. Exagera cuando el codigo es compartido.
- **Transversal**: se llama desde cualquier pantalla; no depende de ningun modulo.

Prefijos privados: 60. Declarados: 48 (5 transversales). Sin evidencia: 9.

| Prefijo de API | Modulos que la usan | Evidencia |
|---|---|---|
| `/api/v1/approvals` | servicio_solicitudes | estatica |
| `/api/v1/attendance` | **transversal** | observada y estatica |
| `/api/v1/audit-prep` | **transversal** | observada y estatica |
| `/api/v1/auditoria` | auditoria | observada y estatica |
| `/api/v1/bc-availability` | business_case, comercial, comercial_solicitudes, workspace_compras | estatica |
| `/api/v1/business-case` | backoffice, business_case, comercial, comercial_clientes, comercial_solicitudes, crm_fam, finanzas, gerencia, inicio, operaciones, servicio_solicitudes, workspace_compras | observada y estatica |
| `/api/v1/calculation-templates` | operaciones | estatica |
| `/api/v1/calidad` | calidad | estatica |
| `/api/v1/clients` | **transversal** | observada y estatica |
| `/api/v1/collab-deliveries` | collab_entregas, collab_resumen, talento_colaboradores, talento_command_center, talento_solicitudes, talento_workspace_personal | observada y estatica |
| `/api/v1/collaborators` | calidad, gerencia, talento_colaboradores, talento_command_center, talento_humano, talento_reporte_documentacion, talento_solicitudes, talento_workspace_personal | observada y estatica |
| `/api/v1/consumable-files` | business_case, comercial, workspace_compras | observada y estatica |
| `/api/v1/crm-fam` | comercial_planificacion, crm_fam | observada y estatica |
| `/api/v1/dashboard` | backoffice, business_case, calidad, capacitaciones, collab_entregas, comercial, comercial_clientes, comercial_solicitudes, crm_fam, finanzas, gerencia, inicio, kickoff_2026, links_interes, operaciones, servicio_capacitaciones, servicio_correctivos, servicio_mantenimientos, servicio_solicitudes, signatures, talento_colaboradores, talento_command_center, talento_departamentos, talento_gestion, talento_humano, talento_solicitudes, talento_usuarios, talento_workspace_personal, ti, ti_actas, ti_reportes, ti_workspace, work_management, workspace_compras | observada y estatica |
| `/api/v1/delivery-ceilings` | comercial_maximos_saldos | observada y estatica |
| `/api/v1/delivery-requests` | comercial_maximos_saldos | estatica |
| `/api/v1/departments` | talento_departamentos, talento_gestion, talento_usuarios, ti | observada y estatica |
| `/api/v1/determinations-catalog` | operaciones | estatica |
| `/api/v1/documents` | comercial_solicitudes | estatica |
| `/api/v1/equipment-catalog` | business_case, comercial, operaciones | estatica |
| `/api/v1/equipment-management` | business_case, comercial, servicio_equipos, workspace_compras | observada y estatica |
| `/api/v1/equipment-purchases` | backoffice, business_case, comercial, comercial_clientes, comercial_solicitudes, crm_fam, gerencia, operaciones, servicio_solicitudes, workspace_compras | observada y estatica |
| `/api/v1/famsheets` | comercial | observada y estatica |
| `/api/v1/files` | business_case, comercial, comercial_solicitudes, operaciones, servicio_solicitudes, workspace_compras | estatica |
| `/api/v1/hiring-pipeline` | talento_colaboradores, talento_command_center, talento_pruebas_tecnicas, talento_solicitudes, talento_workspace_personal | observada y estatica |
| `/api/v1/inventario` | backoffice, business_case, comercial, comercial_clientes, comercial_solicitudes, crm_fam, operaciones, servicio_solicitudes, workspace_compras | estatica |
| `/api/v1/mantenimientos` | inicio, operaciones, servicio_correctivos, servicio_mantenimientos | observada y estatica |
| `/api/v1/module-access` | ti_modulos | estatica |
| `/api/v1/notifications` | **transversal** | observada y estatica |
| `/api/v1/offboarding` | talento_colaboradores, talento_command_center, talento_solicitudes, talento_workspace_personal | estatica |
| `/api/v1/permisos` | comercial_solicitudes, finanzas, gerencia, inicio, operaciones, servicio_solicitudes, talento_permisos, ti | observada y estatica |
| `/api/v1/personnel-requests` | comercial_solicitudes, servicio_solicitudes, talento_colaboradores, talento_command_center, talento_solicitudes, talento_workspace_personal | observada y estatica |
| `/api/v1/private-purchases` | backoffice, business_case, comercial, comercial_clientes, comercial_solicitudes, crm_fam, gerencia, logistica, operaciones, servicio_solicitudes, workspace_compras | observada y estatica |
| `/api/v1/process-notes` | business_case, comercial, workspace_compras | observada y estatica |
| `/api/v1/rbac` | ti_modulos | estatica |
| `/api/v1/requests` | backoffice, business_case, comercial, comercial_clientes, comercial_solicitudes, inicio, operaciones, servicio_solicitudes, workspace_compras | observada y estatica |
| `/api/v1/schedules` | comercial_aprobacion_planes, comercial_planificacion | observada y estatica |
| `/api/v1/servicio` | inicio, servicio_aplicaciones, servicio_asistencia, servicio_capacitaciones, servicio_correctivos, servicio_cronograma, servicio_desinfeccion, servicio_disponibilidad, servicio_equipos, servicio_mantenimientos, servicio_solicitudes, servicio_verificacion, ti_casos_externos | observada y estatica |
| `/api/v1/signature-workflows` | **transversal** | observada y estatica |
| `/api/v1/suggestion-box` | inicio | estatica |
| `/api/v1/support-tickets` | ti_reportes, ti_workspace | observada y estatica |
| `/api/v1/technical-applications` | servicio_aplicaciones | observada y estatica |
| `/api/v1/ti-assets` | business_case, collab_entregas, comercial, talento_colaboradores, talento_command_center, talento_solicitudes, talento_workspace_personal, ti_actas, ti_activos, ti_dispositivos | observada y estatica |
| `/api/v1/trainings` | capacitaciones | observada y estatica |
| `/api/v1/users` | backoffice, collab_entregas, comercial_clientes, crm_fam, famdays, kickoff_2026, operaciones, servicio_solicitudes, talento_asistencia, talento_colaboradores, talento_command_center, talento_departamentos, talento_gestion, talento_solicitudes, talento_usuarios, talento_workspace_personal, ti, ti_actas, ti_activos, ti_dispositivos, ti_modulos, ti_reportes | observada y estatica |
| `/api/v1/vacaciones` | comercial_solicitudes, finanzas, gerencia, inicio, operaciones, servicio_solicitudes, talento_permisos, ti | observada y estatica |
| `/api/v1/viaticos` | finanzas_viaticos | observada y estatica |
| `/api/v1/work-management` | crm_fam, work_management | observada y estatica |

## Sin evidencia de uso desde una pantalla (9)

Ninguna pantalla con modulo las menciona: pueden ser de uso interno, de pantallas fuera de `/dashboard` o no usarse. Quedan sin declarar hasta revisarlas.

- `/api/v1/finanzas`
- `/api/v1/gmail`
- `/api/v1/integrations`
- `/api/v1/management`
- `/api/v1/opportunities`
- `/api/v1/public-delivery-plans`
- `/api/v1/security`
- `/api/v1/signature`
- `/api/v1/talento-humano`

## Solo alcanzadas desde el layout comun (3)

El codigo comun de la aplicacion las menciona, pero ninguna pantalla con modulo. Quedan sin declarar hasta que la sombra muestre desde donde se llaman.

- `/api/v1/famdays`
- `/api/v1/gmail-context`
- `/api/v1/kickoff`

## Pantallas cuyo archivo no se pudo ubicar (8)

- /dashboard (RoleRedirect)
- /dashboard/backoffice/private-purchases (LegacyPrivatePurchaseRedirect)
- /dashboard/comercial/acp-compras (LegacyPublicPurchaseRedirect)
- /dashboard/comercial/equipment-purchases (LegacyPublicPurchaseRedirect)
- /dashboard/logistica/private-purchases (LegacyPrivatePurchaseRedirect)
- /dashboard/mi-perfil ((expresion))
- /dashboard/mi-perfil (profileModalElement)
- /dashboard/operaciones/private-purchases (LegacyPrivatePurchaseRedirect)
