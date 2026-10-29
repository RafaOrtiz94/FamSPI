# Revision de escrituras sin guarda de rol en la ruta

Generada el 2026-10-07 por `backend/scripts/rbac/review_open_writes.js`. No editar a mano: se regenera.

Alcance: 222 endpoints de escritura que solo exigen estar autenticado; 175 unicos (los de `/asistencia/*` son alias de `/api/v1/attendance/*`).

Metodo: se lee el codigo que corre en cada ruta (middlewares propios, controlador y funciones del mismo modulo que llama, hasta tres niveles) y se clasifica por la evidencia encontrada. Es una ayuda para priorizar la revision humana, no una prueba de que el control sea correcto ni completo.

| Resultado | Endpoints |
|---|---|
| Sin control visible: revisar primero | 12 |
| Usa la identidad del usuario, sin validar rol | 101 |
| Valida rol o permiso dentro del codigo | 42 |
| Tiene guarda propia en la ruta (no es requireRole) | 20 |

## Sin control visible: revisar primero (12)

| Endpoint | Modulo | Controlador | Evidencia automatica | Revision manual |
|---|---|---|---|---|
| `POST /api/v1/attendance/birthday-benefit/:token/evidence` | attendance | `submitBirthdayBenefitEvidence` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: El servicio aplica assertCanAccessOwnBenefit: solo el dueno del beneficio o quien administra cumpleanos. Revisado 2026-10-07. |
| `POST /api/v1/attendance/birthday-benefit/:token/redeem` | attendance | `redeemBirthdayBenefit` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: El servicio aplica assertCanAccessOwnBenefit. Revisado 2026-10-07. |
| `POST /api/v1/auth/logout` | auth | `logout` | ni el controlador ni las funciones que llama mencionan rol o usuario | **no aplica**: Cierra la sesion del propio token; no requiere rol. Revisado 2026-10-07. |
| `POST /api/v1/permisos/:id/recovery-plan` | permisos | `updateRecoveryPlan` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: Solo el solicitante o el aprobador. Revisado 2026-10-07. |
| `POST /api/v1/permisos/:id/regularizar` | permisos | `resolverRegularizacion` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida rol**: Solo Talento Humano o administracion; en otro caso 403. Revisado 2026-10-07. |
| `POST /api/v1/permisos/:id/regularizar/convertir-vacaciones` | permisos | `convertirAVacaciones` | ni el controlador ni las funciones que llama mencionan rol o usuario | **deshabilitado**: La funcion siempre responde 409: la conversion a vacaciones esta apagada. Revisado 2026-10-07. |
| `POST /api/v1/permisos/estudios/matricula` | permisos | `registerStudyEnrollment` | ni el controlador ni las funciones que llama mencionan rol o usuario | **limitado al propio usuario**: Registra la matricula del propio usuario. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/send` | signature-workflows | `(anonima)` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: ensureCanManageWorkflow. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/signers/:signerId/correct-placement` | signature-workflows | `(anonima)` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: ensureCanViewWorkflow, ensureSignerOwnership y ensureCanManageWorkflow. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/signers/:signerId/open` | signature-workflows | `(anonima)` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: ensureCanViewWorkflow y ensureSignerOwnership: solo el firmante de ese paso. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/signers/:signerId/reject` | signature-workflows | `(anonima)` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: ensureCanViewWorkflow y ensureSignerOwnership. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/signers/:signerId/sign` | signature-workflows | `(anonima)` | ni el controlador ni las funciones que llama mencionan rol o usuario | **valida propiedad**: ensureCanViewWorkflow y ensureSignerOwnership: nadie firma por otro. Revisado 2026-10-07. |

## Usa la identidad del usuario, sin validar rol (101)

| Endpoint | Modulo | Controlador | Evidencia automatica | Revision manual |
|---|---|---|---|---|
| `POST /api/documents/:documentId/sign` | signature | `(anonima)` | controlador | - |
| `POST /api/signature/documents/:documentId/sign` | signature | `(anonima)` | controlador | - |
| `POST /api/v1/attendance/clock-in` | attendance | `clockIn` | controlador | - |
| `POST /api/v1/attendance/clock-in-lunch` | attendance | `clockInLunch` | controlador | - |
| `POST /api/v1/attendance/clock-out` | attendance | `clockOut` | controlador | - |
| `POST /api/v1/attendance/clock-out-lunch` | attendance | `clockOutLunch` | controlador | - |
| `POST /api/v1/attendance/exception` | attendance | `registerException` | controlador | - |
| `POST /api/v1/attendance/exception/status` | attendance | `updateExceptionStatus` | controlador | - |
| `POST /api/v1/attendance/late-justification` | attendance | `justifyLateArrival` | controlador | - |
| `POST /api/v1/attendance/location-sync` | attendance | `syncLocation` | controlador | - |
| `POST /api/v1/attendance/marcar/almuerzo-entrada` | attendance | `clockInLunch` | controlador | - |
| `POST /api/v1/attendance/marcar/almuerzo-entrada-operacional` | attendance | `clockInOperationalLunch` | controlador | - |
| `POST /api/v1/attendance/marcar/almuerzo-salida` | attendance | `clockOutLunch` | controlador | - |
| `POST /api/v1/attendance/marcar/almuerzo-salida-operacional` | attendance | `clockOutOperationalLunch` | controlador | - |
| `POST /api/v1/attendance/marcar/cierre-viaje` | attendance | `clockCloseTrip` | controlador | - |
| `POST /api/v1/attendance/marcar/cliente-salida` | attendance | `clockOutField` | controlador | - |
| `POST /api/v1/attendance/marcar/entrada` | attendance | `clockIn` | controlador | - |
| `POST /api/v1/attendance/marcar/entrada-campo` | attendance | `clockInOperational` | controlador | - |
| `POST /api/v1/attendance/marcar/entrada-imprevista` | attendance | `clockInUnexpected` | controlador | - |
| `POST /api/v1/attendance/marcar/entrada-oficina` | attendance | `clockInOperational` | controlador | - |
| `POST /api/v1/attendance/marcar/llegada-destino` | attendance | `clockInDestino` | controlador | - |
| `POST /api/v1/attendance/marcar/llegada-imprevista` | attendance | `clockUnexpectedArrival` | controlador | - |
| `POST /api/v1/attendance/marcar/regreso-imprevisto` | attendance | `clockInUnexpected` | controlador | - |
| `POST /api/v1/attendance/marcar/retorno-imprevisto` | attendance | `clockUnexpectedReturn` | controlador | - |
| `POST /api/v1/attendance/marcar/salida` | attendance | `clockOut` | controlador | - |
| `POST /api/v1/attendance/marcar/salida-campo` | attendance | `clockOutOperational` | controlador | - |
| `POST /api/v1/attendance/marcar/salida-imprevista` | attendance | `clockOutUnexpected` | controlador | - |
| `POST /api/v1/attendance/marcar/salida-oficina` | attendance | `clockOutOperational` | controlador | - |
| `POST /api/v1/attendance/marcar/visita-salida` | attendance | `clockOutField` | controlador | - |
| `POST /api/v1/attendance/overtime` | attendance | `markOvertime` | controlador | - |
| `POST /api/v1/attendance/permission-entry-start` | attendance | `startPermissionEntry` | controlador | - |
| `POST /api/v1/attendance/permission-exit-finish` | attendance | `finishPermissionExit` | controlador | - |
| `POST /api/v1/attendance/regularizations` | attendance | `create` | controlador | - |
| `POST /api/v1/attendance/regularize-entry` | attendance | `requestEntryRegularization` | controlador | - |
| `POST /api/v1/attendance/shortcut/location` | attendance | `recordLocationPing` | controlador | - |
| `POST /api/v1/attendance/shortcut/run-smart-mark` | attendance | `runSmartMark` | controlador | - |
| `POST /api/v1/attendance/shortcut/token` | attendance | `issueToken` | controlador | - |
| `POST /api/v1/attendance/telework/requests` | attendance | `create` | controlador | - |
| `POST /api/v1/auth/change-password` | auth | `changePassword` | controlador | - |
| `POST /api/v1/auth/lopdp/accept` | auth | `acceptInternalLopdp` | controlador | - |
| `POST /api/v1/business-case/:id/investments/values/:catalogId/quotation-files` | business-case | `uploadInvestmentQuotationFile` | controlador | - |
| `DELETE /api/v1/business-case/:id/investments/values/quotation-files/:fileId` | business-case | `removeInvestmentQuotationFile` | investments.service.js → removeQuotationFile() | - |
| `POST /api/v1/clients/:id/visit-status` | clients | `setVisitStatus` | clients.service.js → upsertVisitStatus() | **valida propiedad**: El servicio responde 403 si el cliente no fue creado por el usuario ni le esta asignado. Revisado 2026-10-07. |
| `POST /api/v1/clients/prospect-visit` | clients | `registerProspectVisit` | clients.service.js → upsertProspectVisit() | **limitado al propio usuario**: Crea o actualiza solo visitas cuyo user_email es el del usuario. Revisado 2026-10-07. |
| `POST /api/v1/gmail-context/communications` | gmail-context | `register` | controlador | - |
| `POST /api/v1/gmail-context/communications/:id/auto-link` | gmail-context | `autoLink` | controlador | - |
| `POST /api/v1/gmail-context/communications/:id/link` | gmail-context | `link` | controlador | - |
| `DELETE /api/v1/gmail/auth/revoke` | gmail | `(anonima)` | controlador | - |
| `POST /api/v1/gmail/send` | gmail | `(anonima)` | controlador | - |
| `PATCH /api/v1/hiring-pipeline/my-test-assignments/:entryId/confirm` | hiring-pipeline | `confirmTestDate` | controlador | - |
| `POST /api/v1/hiring-pipeline/my-test-assignments/:entryId/result` | hiring-pipeline | `submitTestResult` | controlador | - |
| `POST /api/v1/notifications` | notifications | `create` | controlador | - |
| `DELETE /api/v1/notifications/:id` | notifications | `remove` | controlador | - |
| `PATCH /api/v1/notifications/:id/read` | notifications | `markRead` | controlador | - |
| `DELETE /api/v1/notifications/clear` | notifications | `clear` | controlador | - |
| `POST /api/v1/notifications/push/subscribe` | notifications | `subscribePush` | controlador | - |
| `POST /api/v1/notifications/push/unsubscribe` | notifications | `unsubscribePush` | controlador | - |
| `PATCH /api/v1/notifications/read-all` | notifications | `markAll` | controlador | - |
| `POST /api/v1/permisos/:id/aprobar-final` | permisos | `aprobarFinal` | controlador | - |
| `POST /api/v1/permisos/:id/aprobar-parcial` | permisos | `aprobarParcial` | controlador | - |
| `POST /api/v1/permisos/:id/justificantes` | permisos | `uploadJustificantes` | permisos.service.js → subirJustificantes() | - |
| `POST /api/v1/permisos/:id/rechazar` | permisos | `rechazar` | controlador | - |
| `POST /api/v1/permisos/estudios/matriculas/:id/revisar` | permisos | `reviewStudyEnrollment` | controlador | - |
| `POST /api/v1/personnel-requests/:id/comments` | personnel-requests | `addComment` | controlador | - |
| `POST /api/v1/requests/new-client` | requests | `(anonima)` | controlador | - |
| `PUT /api/v1/requests/new-client/:id` | requests | `(anonima)` | controlador | - |
| `POST /api/v1/signature-workflows` | signature-workflows | `(anonima)` | signatureWorkflows.validation.js → validateCreateWorkflowPayload() | **abierto por diseno**: Cualquier usuario autenticado puede crear un flujo de firma; queda como su creador. Confirmar con el responsable si debe restringirse. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/cancel` | signature-workflows | `(anonima)` | signatureWorkflows.controller.js → validateSignerProfiles() | **valida propiedad**: ensureCanManageWorkflow: solo el creador o un administrador. Revisado 2026-10-07. |
| `POST /api/v1/signature-workflows/:id/signers/:signerId/reassign` | signature-workflows | `(anonima)` | controlador | - |
| `POST /api/v1/signature-workflows/validate-signer-profiles` | signature-workflows | `(anonima)` | signatureWorkflows.controller.js → validateSignerProfiles() | **HALLAZGO: sin control**: Cualquier usuario autenticado puede enviar una lista de IDs y recibir correo, nombre completo y que datos de perfil le faltan a cada uno (nombres, apellidos, cedula, cargo). No valida rol ni relacion con esos usuarios. Severidad baja: expone datos de perfil incompletos. Revisado 2026-10-07. |
| `POST /api/v1/signature/documents/:documentId/sign` | signature | `(anonima)` | controlador | - |
| `POST /api/v1/suggestion-box/submissions` | suggestion-box | `(anonima)` | suggestionBox.service.js → createSubmission() | **abierto por diseno**: Buzon de sugerencias: cualquier usuario interno puede enviar. Revisado 2026-10-07. |
| `POST /api/v1/support-tickets` | support-tickets | `create` | controlador | - |
| `POST /api/v1/users/me/certifications` | user-certifications | `createMyCertification` | controlador | - |
| `DELETE /api/v1/users/me/certifications/:certId` | user-certifications | `deleteMyCertification` | controlador | - |
| `POST /api/v1/users/me/certifications/bulk` | user-certifications | `createMyBulkCertifications` | controlador | - |
| `POST /api/v1/users/me/profile` | user-profile | `createMine` | controlador | - |
| `PUT /api/v1/users/me/profile` | user-profile | `updateMine` | controlador | - |
| `POST /api/v1/users/me/profile/documents` | user-profile | `uploadMyDocument` | controlador | - |
| `POST /api/v1/work-management/boards/:boardId/groups` | work-management | `createGroup` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `DELETE /api/v1/work-management/checklist-items/:checklistItemId` | work-management | `deleteChecklistItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `PATCH /api/v1/work-management/checklist-items/:checklistItemId` | work-management | `updateChecklistItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/groups/:groupId/items` | work-management | `createItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `DELETE /api/v1/work-management/items/:itemId` | work-management | `deleteItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `PATCH /api/v1/work-management/items/:itemId` | work-management | `updateItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `PUT /api/v1/work-management/items/:itemId/assignees` | work-management | `updateItemAssignees` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/items/:itemId/attachments` | work-management | `uploadItemAttachment` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/items/:itemId/checklist-items` | work-management | `createChecklistItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/items/:itemId/comments` | work-management | `createItemComment` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/items/:itemId/reorder` | work-management | `reorderItem` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/items/:itemId/supporters` | work-management | `addItemSupporter` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `DELETE /api/v1/work-management/items/:itemId/supporters/:supporterUserId` | work-management | `removeItemSupporter` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `DELETE /api/v1/work-management/projects/:projectId` | work-management | `deleteProject` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/projects/:projectId/boards` | work-management | `createBoard` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/projects/from-opportunity/:opportunityId` | work-management | `createProjectFromOpportunity` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/workspaces` | work-management | `createWorkspace` | workManagement.controller.js → getUserId() | **abierto por diseno**: Cualquier usuario autenticado puede crear un espacio de trabajo y queda como su dueno. Confirmar con el responsable. Revisado 2026-10-07. |
| `DELETE /api/v1/work-management/workspaces/:workspaceId` | work-management | `deleteWorkspace` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `PATCH /api/v1/work-management/workspaces/:workspaceId` | work-management | `updateWorkspace` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/workspaces/:workspaceId/members` | work-management | `addWorkspaceMember` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `DELETE /api/v1/work-management/workspaces/:workspaceId/members/:memberUserId` | work-management | `removeWorkspaceMember` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |
| `POST /api/v1/work-management/workspaces/:workspaceId/projects` | work-management | `createProject` | workManagement.controller.js → getUserId() | **valida pertenencia**: El servicio exige ser miembro, dueno o gestor del espacio/proyecto/item (assert...Access, 403 en otro caso). Revisado 2026-10-07. |

## Valida rol o permiso dentro del codigo (42)

| Endpoint | Modulo | Controlador | Evidencia automatica | Revision manual |
|---|---|---|---|---|
| `POST /api/v1/attendance/admin/apply-entry-regularization` | attendance | `applyEntryRegularization` | controlador | - |
| `POST /api/v1/attendance/admin/collaborator/:userId/birthday-benefit/qr` | attendance | `generateCollaboratorBirthdayBenefitQr` | controlador | - |
| `PUT /api/v1/attendance/admin/late-justification/:id` | attendance | `updateLateJustification` | controlador | **valida rol**: El controlador exige hasHrDashboardAccess y responde 403. Revisado 2026-10-07. |
| `POST /api/v1/attendance/marcar/cliente-entrada` | attendance | `clockInField` | controlador | - |
| `POST /api/v1/attendance/marcar/visita-entrada` | attendance | `clockInField` | controlador | - |
| `POST /api/v1/attendance/non-compliance/:userId/schedule-meeting` | attendance | `scheduleAttendanceFollowUpMeeting` | controlador | - |
| `POST /api/v1/attendance/period/:periodKey/status` | attendance | `transition` | controlador | - |
| `POST /api/v1/attendance/regularizations/:id/status` | attendance | `transition` | controlador | - |
| `PATCH /api/v1/audit-prep/documents/:id/status` | audit-prep | `(anonima)` | auditPrep.controller.js → updateDocumentStatus() | **valida rol**: El servicio aplica assertAllowedSection contra los roles permitidos de la seccion. Revisado 2026-10-07. |
| `POST /api/v1/audit-prep/documents/upload` | audit-prep | `(anonima)` | auditPrep.controller.js → updateDocumentStatus() | **valida rol**: El servicio aplica assertAllowedSection. Revisado 2026-10-07. |
| `POST /api/v1/business-case/:id/investments/values` | business-case | `saveInvestmentValues` | controlador | - |
| `POST /api/v1/business-case/:id/investments/values/sync-sheet` | business-case | `syncInvestmentValuesSheet` | controlador | - |
| `PUT /api/v1/famdays/configurators` | famdays | `setConfigurators` | famdays.service.js → assertCanAdmin() | - |
| `POST /api/v1/famdays/events` | famdays | `createEvent` | famdays.service.js → assertCanConfigure() | - |
| `DELETE /api/v1/famdays/events/:eventId` | famdays | `deleteEvent` | famdays.service.js → assertCanConfigure() | - |
| `PATCH /api/v1/famdays/events/:eventId` | famdays | `updateEvent` | famdays.service.js → assertCanConfigure() | - |
| `POST /api/v1/famdays/events/:eventId/presentations` | famdays | `createPresentation` | famdays.service.js → assertCanConfigure() | - |
| `POST /api/v1/famdays/events/:eventId/qr/regenerate` | famdays | `regenerateEventQr` | famdays.service.js → assertCanConfigure() | - |
| `DELETE /api/v1/famdays/presentations/:presentationId` | famdays | `deletePresentation` | famdays.service.js → assertCanConfigure() | - |
| `PATCH /api/v1/famdays/presentations/:presentationId` | famdays | `updatePresentation` | famdays.service.js → assertCanConfigure() | - |
| `PATCH /api/v1/famdays/questions/:questionId/answer` | famdays | `answerQuestion` | famdays.service.js → assertCanConfigure() | - |
| `PATCH /api/v1/famdays/questions/:questionId/hide` | famdays | `hideQuestion` | famdays.service.js → assertCanConfigure() | - |
| `PATCH /api/v1/famdays/questions/:questionId/highlight` | famdays | `highlightQuestion` | famdays.service.js → assertCanConfigure() | - |
| `PATCH /api/v1/famdays/questions/:questionId/moderate` | famdays | `moderateQuestion` | famdays.service.js → assertCanConfigure() | - |
| `POST /api/v1/permisos` | permisos | `create` | permisos.service.js → assertRequesterCanCreateTimeOff() | **limitado al propio usuario**: Crea la solicitud a nombre del usuario y aplica assertRequesterCanCreateTimeOff. Revisado 2026-10-07. |
| `POST /api/v1/permisos/:id/cancelar` | permisos | `cancelar` | permisos.service.js → cancelarSolicitud() | **valida propiedad**: Solo el solicitante o su aprobador; en otro caso 403. Revisado 2026-10-07. |
| `POST /api/v1/permisos/:id/cancelar/revisar` | permisos | `revisarCancelacion` | permisos.service.js → revisarCancelacionSolicitud() | **valida rol**: Solo el aprobador asignado o quien pueda aprobar; en otro caso 403. Revisado 2026-10-07. |
| `POST /api/v1/permisos/:id/justificantes/revisar` | permisos | `revisarJustificantes` | permisos.service.js → revisarJustificante() | - |
| `POST /api/v1/process-notes/:entityType/:entityId` | process-notes | `(anonima)` | processNotes.service.js → assertUserHasEntityTypeAccess() | - |
| `POST /api/v1/process-notes/:entityType/:entityId/:noteId/read` | process-notes | `(anonima)` | processNotes.service.js → assertUserHasEntityTypeAccess() | - |
| `POST /api/v1/process-notes/:entityType/:entityId/email` | process-notes | `(anonima)` | processNotes.service.js → assertUserHasEntityTypeAccess() | - |
| `POST /api/v1/requests/new-client/consent-token` | requests | `(anonima)` | requests.controller.js → createRequest() | - |
| `POST /api/v1/requests/new-client/consent-token/verify` | requests | `(anonima)` | requests.controller.js → createRequest() | - |
| `POST /api/v1/support-tickets/:id/close` | support-tickets | `closeByRequester` | supportTickets.service.js → closeTicketByRequester() | - |
| `POST /api/v1/support-tickets/:id/comments` | support-tickets | `addComment` | supportTickets.service.js → getTicketForActor() | **valida propiedad**: Solo el solicitante, el tecnico asignado o TI; en otro caso 403. Revisado 2026-10-07. |
| `POST /api/v1/support-tickets/:id/reopen` | support-tickets | `reopen` | supportTickets.service.js → reopenTicket() | **valida propiedad**: Solo el dueno del ticket o TI; en otro caso 403. Revisado 2026-10-07. |
| `POST /api/v1/support-tickets/:id/satisfaction` | support-tickets | `rateSatisfaction` | supportTickets.service.js → rateTicketSatisfaction() | - |
| `POST /api/v1/vacaciones` | vacaciones | `create` | vacaciones.service.js → assertRequesterCanCreateTimeOff() | - |
| `POST /api/v1/vacaciones/:id/cancel` | vacaciones | `cancel` | vacaciones.service.js → cancelVacationRequest() | - |
| `POST /api/v1/vacaciones/:id/cancel/review` | vacaciones | `reviewCancel` | vacaciones.service.js → cancelVacationRequest() | - |
| `PATCH /api/v1/vacaciones/:id/dates` | vacaciones | `updateDates` | vacaciones.service.js → updateVacationDates() | - |
| `PATCH /api/v1/vacaciones/:id/status` | vacaciones | `updateStatus` | vacaciones.service.js → updateVacationStatus() | - |

## Tiene guarda propia en la ruta (no es requireRole) (20)

| Endpoint | Modulo | Controlador | Evidencia automatica | Revision manual |
|---|---|---|---|---|
| `POST /api/v1/attendance/telework/requests/:id/decision` | attendance | `decide` | middleware requireExactTalentHumanRole | - |
| `POST /api/v1/business-case/:id/pricing-lab/preview` | business-case | `preview` | middleware requirePricingLabTi | - |
| `POST /api/v1/business-case/matrix-calculations/preview` | business-case | `preview` | middleware requirePricingLabTi | - |
| `POST /api/v1/famdays/events/:eventId/questions` | famdays | `createEventQuestion` | middleware requireFamDaysAccess | - |
| `POST /api/v1/famdays/presentations/:presentationId/questions` | famdays | `createQuestion` | middleware requireFamDaysAccess | - |
| `POST /api/v1/famdays/questions/:questionId/rate-aporte` | famdays | `rateAporte` | middleware requireFamDaysAccess | - |
| `POST /api/v1/kickoff/presentations/:presentationId/blocks/next` | kickoff | `nextBlock` | middleware requirePresenterOrAdmin | - |
| `POST /api/v1/kickoff/presentations/:presentationId/blocks/previous` | kickoff | `prevBlock` | middleware requirePresenterOrAdmin | - |
| `POST /api/v1/kickoff/presentations/:presentationId/finish` | kickoff | `finishPresentation` | middleware requirePresenterOrAdmin | - |
| `POST /api/v1/kickoff/presentations/:presentationId/qr/regenerate` | kickoff | `regenerateQr` | middleware requirePresenterOrAdmin | - |
| `POST /api/v1/kickoff/presentations/:presentationId/questions` | kickoff | `createQuestion` | middleware requireKickoffAccess | - |
| `POST /api/v1/kickoff/presentations/:presentationId/start` | kickoff | `startPresentation` | middleware requirePresenterOrAdmin | - |
| `PATCH /api/v1/kickoff/questions/:questionId/answer` | kickoff | `moderateQuestion` | middleware requireReportAccess | - |
| `PATCH /api/v1/kickoff/questions/:questionId/approve` | kickoff | `moderateQuestion` | middleware requireQuestionModerator | - |
| `PATCH /api/v1/kickoff/questions/:questionId/hide` | kickoff | `moderateQuestion` | middleware requireQuestionModerator | - |
| `PATCH /api/v1/kickoff/questions/:questionId/highlight` | kickoff | `moderateQuestion` | middleware requireQuestionModerator | - |
| `PATCH /api/v1/kickoff/questions/:questionId/moderate` | kickoff | `moderateQuestion` | middleware requireQuestionModerator | - |
| `POST /api/v1/kickoff/questions/:questionId/rate` | kickoff | `rateQuestion` | middleware requireKickoffAccess | - |
| `POST /api/v1/kickoff/questions/:questionId/rate-aporte` | kickoff | `rateAporte` | middleware requireKickoffAccess | - |
| `POST /api/v1/kickoff/tiebreaker/rounds/:roundId/vote` | kickoff | `castTiebreakerVote` | middleware requireKickoffAccess | - |
