# Matriz de acceso por modulo (backend)

Generada el 2026-10-08 por `backend/scripts/rbac/build_access_review.js` desde `backend-endpoints.json`. No editar a mano: se regenera. El detalle fila por fila esta en `backend-endpoints.csv`.

Totales: 1534 endpoints en 63 modulos · por rol 1075 · solo autenticado 386 · permiso central 5 · publicos 32 · internos 36.

Como leerla: "solo autenticado" significa que la ruta no exige rol; el control puede estar dentro del controlador o no existir. Cada escritura de esa lista debe confirmarse antes de convertirla en permiso.

## api

Endpoints: 15 | por rol: 1 | solo autenticado: 6 (2 de escritura) | permiso central: 0 | publicos: 8 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 1 · `talento_humano` 1

Escrituras sin guarda de rol en la ruta (2) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/documents/:documentId/sign` → `(anonima)`
- [ ] `POST /api/signature/documents/:documentId/sign` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## approvals

Endpoints: 3 | por rol: 3 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_servicio` 3 · `gerencia_general` 1 · `ing_servicio` 1 · `jefe_calidad` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## asistencia

Endpoints: 75 | por rol: 3 | solo autenticado: 72 (47 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 3

Escrituras sin guarda de rol en la ruta (47) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /asistencia/admin/apply-entry-regularization` → `applyEntryRegularization`
- [ ] `POST /asistencia/admin/collaborator/:userId/birthday-benefit/qr` → `generateCollaboratorBirthdayBenefitQr`
- [ ] `PUT /asistencia/admin/late-justification/:id` → `updateLateJustification`
- [ ] `POST /asistencia/birthday-benefit/:token/evidence` → `submitBirthdayBenefitEvidence`
- [ ] `POST /asistencia/birthday-benefit/:token/redeem` → `redeemBirthdayBenefit`
- [ ] `POST /asistencia/clock-in` → `clockIn`
- [ ] `POST /asistencia/clock-in-lunch` → `clockInLunch`
- [ ] `POST /asistencia/clock-out` → `clockOut`
- [ ] `POST /asistencia/clock-out-lunch` → `clockOutLunch`
- [ ] `POST /asistencia/exception` → `registerException`
- [ ] `POST /asistencia/exception/status` → `updateExceptionStatus`
- [ ] `POST /asistencia/late-justification` → `justifyLateArrival`
- [ ] `POST /asistencia/location-sync` → `syncLocation`
- [ ] `POST /asistencia/marcar/almuerzo-entrada` → `clockInLunch`
- [ ] `POST /asistencia/marcar/almuerzo-entrada-operacional` → `clockInOperationalLunch`
- [ ] `POST /asistencia/marcar/almuerzo-salida` → `clockOutLunch`
- [ ] `POST /asistencia/marcar/almuerzo-salida-operacional` → `clockOutOperationalLunch`
- [ ] `POST /asistencia/marcar/cierre-viaje` → `clockCloseTrip`
- [ ] `POST /asistencia/marcar/cliente-entrada` → `clockInField`
- [ ] `POST /asistencia/marcar/cliente-salida` → `clockOutField`
- [ ] `POST /asistencia/marcar/entrada` → `clockIn`
- [ ] `POST /asistencia/marcar/entrada-campo` → `clockInOperational`
- [ ] `POST /asistencia/marcar/entrada-imprevista` → `clockInUnexpected`
- [ ] `POST /asistencia/marcar/entrada-oficina` → `clockInOperational`
- [ ] `POST /asistencia/marcar/llegada-destino` → `clockInDestino`
- ... y 22 mas (ver backend-endpoints.csv)

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## attendance

Endpoints: 75 | por rol: 3 | solo autenticado: 72 (47 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 3

Escrituras sin guarda de rol en la ruta (47) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/attendance/admin/apply-entry-regularization` → `applyEntryRegularization`
- [ ] `POST /api/v1/attendance/admin/collaborator/:userId/birthday-benefit/qr` → `generateCollaboratorBirthdayBenefitQr`
- [ ] `PUT /api/v1/attendance/admin/late-justification/:id` → `updateLateJustification`
- [ ] `POST /api/v1/attendance/birthday-benefit/:token/evidence` → `submitBirthdayBenefitEvidence`
- [ ] `POST /api/v1/attendance/birthday-benefit/:token/redeem` → `redeemBirthdayBenefit`
- [ ] `POST /api/v1/attendance/clock-in` → `clockIn`
- [ ] `POST /api/v1/attendance/clock-in-lunch` → `clockInLunch`
- [ ] `POST /api/v1/attendance/clock-out` → `clockOut`
- [ ] `POST /api/v1/attendance/clock-out-lunch` → `clockOutLunch`
- [ ] `POST /api/v1/attendance/exception` → `registerException`
- [ ] `POST /api/v1/attendance/exception/status` → `updateExceptionStatus`
- [ ] `POST /api/v1/attendance/late-justification` → `justifyLateArrival`
- [ ] `POST /api/v1/attendance/location-sync` → `syncLocation`
- [ ] `POST /api/v1/attendance/marcar/almuerzo-entrada` → `clockInLunch`
- [ ] `POST /api/v1/attendance/marcar/almuerzo-entrada-operacional` → `clockInOperationalLunch`
- [ ] `POST /api/v1/attendance/marcar/almuerzo-salida` → `clockOutLunch`
- [ ] `POST /api/v1/attendance/marcar/almuerzo-salida-operacional` → `clockOutOperationalLunch`
- [ ] `POST /api/v1/attendance/marcar/cierre-viaje` → `clockCloseTrip`
- [ ] `POST /api/v1/attendance/marcar/cliente-entrada` → `clockInField`
- [ ] `POST /api/v1/attendance/marcar/cliente-salida` → `clockOutField`
- [ ] `POST /api/v1/attendance/marcar/entrada` → `clockIn`
- [ ] `POST /api/v1/attendance/marcar/entrada-campo` → `clockInOperational`
- [ ] `POST /api/v1/attendance/marcar/entrada-imprevista` → `clockInUnexpected`
- [ ] `POST /api/v1/attendance/marcar/entrada-oficina` → `clockInOperational`
- [ ] `POST /api/v1/attendance/marcar/llegada-destino` → `clockInDestino`
- ... y 22 mas (ver backend-endpoints.csv)

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## audit-prep

Endpoints: 11 | por rol: 5 | solo autenticado: 6 (2 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 5

Escrituras sin guarda de rol en la ruta (2) — confirmar si el control esta en el controlador o falta:

- [ ] `PATCH /api/v1/audit-prep/documents/:id/status` → `(anonima)`
- [ ] `POST /api/v1/audit-prep/documents/upload` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## auditoria

Endpoints: 3 | por rol: 3 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 3 · `jefe_ti` 3 · `talento_humano` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## auth

Endpoints: 11 | por rol: 2 | solo autenticado: 4 (3 de escritura) | permiso central: 0 | publicos: 5 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 2 · `jefe_ti` 2

Escrituras sin guarda de rol en la ruta (3) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/auth/change-password` → `changePassword`
- [ ] `POST /api/v1/auth/logout` → `logout`
- [ ] `POST /api/v1/auth/lopdp/accept` → `acceptInternalLopdp`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## bc-availability

Endpoints: 6 | por rol: 6 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 6 · `comercial` 3 · `jefe_comercial` 3 · `gerencia_general` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## business-case

Endpoints: 124 | por rol: 115 | solo autenticado: 9 (6 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_comercial` 104 · `gerencia_general` 86 · `acp_comercial` 81 · `jefe_operaciones` 74 · `jefe_servicio` 74 · `jefe_ti` 73 · `comercial` 71 · `jefe_financiero` 70 · `operaciones` 68 · `ing_servicio` 67 · `jefe_logistica` 67 · `jefe_calidad` 2

Escrituras sin guarda de rol en la ruta (6) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/business-case/:id/investments/values` → `saveInvestmentValues`
- [ ] `POST /api/v1/business-case/:id/investments/values/:catalogId/quotation-files` → `uploadInvestmentQuotationFile`
- [ ] `DELETE /api/v1/business-case/:id/investments/values/quotation-files/:fileId` → `removeInvestmentQuotationFile`
- [ ] `POST /api/v1/business-case/:id/investments/values/sync-sheet` → `syncInvestmentValuesSheet`
- [ ] `POST /api/v1/business-case/:id/pricing-lab/preview` → `preview`
- [ ] `POST /api/v1/business-case/matrix-calculations/preview` → `preview`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## calculation-templates

Endpoints: 5 | por rol: 5 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 5 · `jefe_servicio` 5 · `acp_comercial` 1 · `comercial` 1 · `ing_servicio` 1 · `jefe_comercial` 1 · `jefe_financiero` 1 · `jefe_logistica` 1 · `jefe_operaciones` 1 · `jefe_ti` 1 · `operaciones` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## calidad

Endpoints: 157 | por rol: 157 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_calidad` 157 · `gerencia_general` 136 · `talento_humano` 9 · `ing_servicio` 4 · `jefe_servicio` 4 · `jefe_operaciones` 2 · `operaciones` 2 · `acp_comercial` 2 · `comercial` 2 · `jefe_comercial` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## clients

Endpoints: 12 | por rol: 8 | solo autenticado: 4 (2 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_operaciones` 8 · `acp_comercial` 3 · `comercial` 3 · `gerencia_general` 3 · `jefe_comercial` 3 · `jefe_ti` 3

Escrituras sin guarda de rol en la ruta (2) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/clients/:id/visit-status` → `setVisitStatus`
- [ ] `POST /api/v1/clients/prospect-visit` → `registerProspectVisit`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## collab-deliveries

Endpoints: 36 | por rol: 36 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`financiero` 36 · `jefe_financiero` 36 · `talento_humano` 28 · `jefe_servicio` 25 · `gerencia_general` 20 · `jefe_ti` 20

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## collaborators

Endpoints: 9 | por rol: 9 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 8 · `talento_humano` 8 · `acp_comercial` 5 · `comercial` 5 · `jefe_comercial` 5 · `jefe_calidad` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## consumable-files

Endpoints: 24 | por rol: 24 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 22 · `comercial` 22 · `jefe_comercial` 22 · `gerencia_general` 21 · `jefe_logistica` 8 · `jefe_operaciones` 8 · `logistica` 8 · `operaciones` 7

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## crm-fam

Endpoints: 119 | por rol: 119 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 113 · `jefe_comercial` 113 · `acp_comercial` 96 · `comercial` 96 · `jefe_ti` 58

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## dashboard

Endpoints: 1 | por rol: 1 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 1 · `comercial` 1 · `gerencia_general` 1 · `jefe_comercial` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## delivery-ceilings

Endpoints: 1 | por rol: 1 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 1 · `comercial` 1 · `gerencia_general` 1 · `ing_servicio` 1 · `jefe_comercial` 1 · `jefe_logistica` 1 · `jefe_operaciones` 1 · `jefe_servicio` 1 · `operaciones` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## delivery-requests

Endpoints: 6 | por rol: 6 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 6 · `gerencia_general` 6 · `jefe_comercial` 6 · `comercial` 3 · `jefe_logistica` 3 · `jefe_operaciones` 3 · `operaciones` 3 · `ing_servicio` 2 · `jefe_servicio` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## departments

Endpoints: 5 | por rol: 5 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 5 · `jefe_ti` 5 · `talento_humano` 5 · `financiero` 2 · `jefe_financiero` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## determinations-catalog

Endpoints: 7 | por rol: 7 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 7 · `jefe_servicio` 7 · `acp_comercial` 5 · `comercial` 5 · `jefe_comercial` 5 · `ing_servicio` 2 · `jefe_financiero` 2 · `jefe_logistica` 2 · `jefe_operaciones` 2 · `jefe_ti` 2 · `operaciones` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## documents

Endpoints: 6 | por rol: 4 | solo autenticado: 2 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 4 · `ing_servicio` 4 · `jefe_servicio` 4 · `acp_comercial` 1 · `comercial` 1 · `jefe_comercial` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## equipment-catalog

Endpoints: 10 | por rol: 10 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 10 · `jefe_servicio` 10 · `acp_comercial` 7 · `comercial` 7 · `ing_servicio` 7 · `jefe_comercial` 7 · `jefe_financiero` 7 · `jefe_logistica` 7 · `jefe_operaciones` 7 · `jefe_ti` 7 · `operaciones` 7

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## equipment-management

Endpoints: 20 | por rol: 20 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 20 · `gerencia_general` 20 · `jefe_servicio` 20 · `jefe_ti` 20 · `ing_servicio` 17 · `jefe_logistica` 17 · `jefe_operaciones` 17 · `logistica` 17 · `operaciones` 17 · `jefe_comercial` 11 · `comercial` 8

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## equipment-purchases

Endpoints: 67 | por rol: 67 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 64 · `jefe_comercial` 54 · `gerencia_general` 53 · `jefe_servicio` 21 · `comercial` 20 · `ing_servicio` 19 · `jefe_logistica` 19 · `jefe_operaciones` 19 · `logistica` 10 · `operaciones` 10

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## famdays

Endpoints: 30 | por rol: 0 | solo autenticado: 30 (15 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Escrituras sin guarda de rol en la ruta (15) — confirmar si el control esta en el controlador o falta:

- [ ] `PUT /api/v1/famdays/configurators` → `setConfigurators`
- [ ] `POST /api/v1/famdays/events` → `createEvent`
- [ ] `DELETE /api/v1/famdays/events/:eventId` → `deleteEvent`
- [ ] `PATCH /api/v1/famdays/events/:eventId` → `updateEvent`
- [ ] `POST /api/v1/famdays/events/:eventId/presentations` → `createPresentation`
- [ ] `POST /api/v1/famdays/events/:eventId/qr/regenerate` → `regenerateEventQr`
- [ ] `POST /api/v1/famdays/events/:eventId/questions` → `createEventQuestion`
- [ ] `DELETE /api/v1/famdays/presentations/:presentationId` → `deletePresentation`
- [ ] `PATCH /api/v1/famdays/presentations/:presentationId` → `updatePresentation`
- [ ] `POST /api/v1/famdays/presentations/:presentationId/questions` → `createQuestion`
- [ ] `PATCH /api/v1/famdays/questions/:questionId/answer` → `answerQuestion`
- [ ] `PATCH /api/v1/famdays/questions/:questionId/hide` → `hideQuestion`
- [ ] `PATCH /api/v1/famdays/questions/:questionId/highlight` → `highlightQuestion`
- [ ] `PATCH /api/v1/famdays/questions/:questionId/moderate` → `moderateQuestion`
- [ ] `POST /api/v1/famdays/questions/:questionId/rate-aporte` → `rateAporte`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## famsheets

Endpoints: 23 | por rol: 23 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 23 · `comercial` 23 · `gerencia_general` 23 · `jefe_comercial` 23 · `ing_servicio` 6 · `jefe_operaciones` 6 · `jefe_servicio` 6 · `operaciones` 6

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## files

Endpoints: 5 | por rol: 3 | solo autenticado: 2 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 3 · `acp_comercial` 2 · `comercial` 2 · `ing_servicio` 2 · `jefe_comercial` 2 · `jefe_servicio` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## finanzas

Endpoints: 4 | por rol: 4 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`financiero` 4 · `gerencia_general` 4 · `jefe_financiero` 4

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## gmail

Endpoints: 5 | por rol: 0 | solo autenticado: 4 (2 de escritura) | permiso central: 0 | publicos: 1 | internos: 0

Escrituras sin guarda de rol en la ruta (2) — confirmar si el control esta en el controlador o falta:

- [ ] `DELETE /api/v1/gmail/auth/revoke` → `(anonima)`
- [ ] `POST /api/v1/gmail/send` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## gmail-context

Endpoints: 16 | por rol: 0 | solo autenticado: 8 (3 de escritura) | permiso central: 0 | publicos: 8 | internos: 0

Escrituras sin guarda de rol en la ruta (3) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/gmail-context/communications` → `register`
- [ ] `POST /api/v1/gmail-context/communications/:id/auto-link` → `autoLink`
- [ ] `POST /api/v1/gmail-context/communications/:id/link` → `link`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## hiring-pipeline

Endpoints: 17 | por rol: 14 | solo autenticado: 3 (2 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 14 · `talento_humano` 14

Escrituras sin guarda de rol en la ruta (2) — confirmar si el control esta en el controlador o falta:

- [ ] `PATCH /api/v1/hiring-pipeline/my-test-assignments/:entryId/confirm` → `confirmTestDate`
- [ ] `POST /api/v1/hiring-pipeline/my-test-assignments/:entryId/result` → `submitTestResult`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## integrations

Endpoints: 7 | por rol: 6 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 1 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 6 · `jefe_servicio` 6 · `jefe_ti` 6 · `ing_servicio` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## internal

Endpoints: 36 | por rol: 0 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 36

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## inventario

Endpoints: 11 | por rol: 7 | solo autenticado: 4 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 7 · `ing_servicio` 7 · `jefe_logistica` 7 · `jefe_operaciones` 7 · `jefe_servicio` 7 · `jefe_ti` 7 · `logistica` 7 · `operaciones` 7 · `financiero` 6 · `jefe_financiero` 6 · `acp_comercial` 1 · `comercial` 1 · `jefe_comercial` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## kickoff

Endpoints: 38 | por rol: 12 | solo autenticado: 26 (14 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 12

Escrituras sin guarda de rol en la ruta (14) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/kickoff/presentations/:presentationId/blocks/next` → `nextBlock`
- [ ] `POST /api/v1/kickoff/presentations/:presentationId/blocks/previous` → `prevBlock`
- [ ] `POST /api/v1/kickoff/presentations/:presentationId/finish` → `finishPresentation`
- [ ] `POST /api/v1/kickoff/presentations/:presentationId/qr/regenerate` → `regenerateQr`
- [ ] `POST /api/v1/kickoff/presentations/:presentationId/questions` → `createQuestion`
- [ ] `POST /api/v1/kickoff/presentations/:presentationId/start` → `startPresentation`
- [ ] `PATCH /api/v1/kickoff/questions/:questionId/answer` → `moderateQuestion`
- [ ] `PATCH /api/v1/kickoff/questions/:questionId/approve` → `moderateQuestion`
- [ ] `PATCH /api/v1/kickoff/questions/:questionId/hide` → `moderateQuestion`
- [ ] `PATCH /api/v1/kickoff/questions/:questionId/highlight` → `moderateQuestion`
- [ ] `PATCH /api/v1/kickoff/questions/:questionId/moderate` → `moderateQuestion`
- [ ] `POST /api/v1/kickoff/questions/:questionId/rate` → `rateQuestion`
- [ ] `POST /api/v1/kickoff/questions/:questionId/rate-aporte` → `rateAporte`
- [ ] `POST /api/v1/kickoff/tiebreaker/rounds/:roundId/vote` → `castTiebreakerVote`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## management

Endpoints: 4 | por rol: 4 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Endpoints por rol que hoy ningun rol real puede usar (4):

- `GET /api/v1/management/documents/:id` — exige: admin, gerente_general
- `GET /api/v1/management/requests` — exige: admin, gerente_general
- `GET /api/v1/management/stats` — exige: admin, gerente_general
- `GET /api/v1/management/trace/:id` — exige: admin, gerente_general

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## mantenimientos

Endpoints: 28 | por rol: 27 | solo autenticado: 1 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 26 · `jefe_servicio` 25 · `ing_servicio` 20 · `jefe_comercial` 20 · `acp_comercial` 15 · `comercial` 15 · `jefe_logistica` 15 · `logistica` 15 · `jefe_ti` 3

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## module-access

Endpoints: 5 | por rol: 0 | solo autenticado: 0 (0 de escritura) | permiso central: 5 | publicos: 0 | internos: 0

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## notifications

Endpoints: 10 | por rol: 0 | solo autenticado: 10 (7 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Escrituras sin guarda de rol en la ruta (7) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/notifications` → `create`
- [ ] `DELETE /api/v1/notifications/:id` → `remove`
- [ ] `PATCH /api/v1/notifications/:id/read` → `markRead`
- [ ] `DELETE /api/v1/notifications/clear` → `clear`
- [ ] `POST /api/v1/notifications/push/subscribe` → `subscribePush`
- [ ] `POST /api/v1/notifications/push/unsubscribe` → `unsubscribePush`
- [ ] `PATCH /api/v1/notifications/read-all` → `markAll`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## offboarding

Endpoints: 6 | por rol: 6 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 6 · `jefe_financiero` 6 · `jefe_ti` 6 · `talento_humano` 6

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## opportunities

Endpoints: 23 | por rol: 23 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 23 · `comercial` 23 · `gerencia_general` 23 · `jefe_comercial` 23 · `ing_servicio` 6 · `jefe_operaciones` 6 · `jefe_servicio` 6 · `operaciones` 6

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## permisos

Endpoints: 23 | por rol: 0 | solo autenticado: 22 (13 de escritura) | permiso central: 0 | publicos: 1 | internos: 0

Escrituras sin guarda de rol en la ruta (13) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/permisos` → `create`
- [ ] `POST /api/v1/permisos/:id/aprobar-final` → `aprobarFinal`
- [ ] `POST /api/v1/permisos/:id/aprobar-parcial` → `aprobarParcial`
- [ ] `POST /api/v1/permisos/:id/cancelar` → `cancelar`
- [ ] `POST /api/v1/permisos/:id/cancelar/revisar` → `revisarCancelacion`
- [ ] `POST /api/v1/permisos/:id/justificantes` → `uploadJustificantes`
- [ ] `POST /api/v1/permisos/:id/justificantes/revisar` → `revisarJustificantes`
- [ ] `POST /api/v1/permisos/:id/rechazar` → `rechazar`
- [ ] `POST /api/v1/permisos/:id/recovery-plan` → `updateRecoveryPlan`
- [ ] `POST /api/v1/permisos/:id/regularizar` → `resolverRegularizacion`
- [ ] `POST /api/v1/permisos/:id/regularizar/convertir-vacaciones` → `convertirAVacaciones`
- [ ] `POST /api/v1/permisos/estudios/matricula` → `registerStudyEnrollment`
- [ ] `POST /api/v1/permisos/estudios/matriculas/:id/revisar` → `reviewStudyEnrollment`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## personnel-requests

Endpoints: 15 | por rol: 10 | solo autenticado: 5 (1 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 10 · `talento_humano` 10 · `jefe_calidad` 1 · `jefe_comercial` 1 · `jefe_operaciones` 1 · `jefe_servicio` 1

Escrituras sin guarda de rol en la ruta (1) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/personnel-requests/:id/comments` → `addComment`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## private-purchases

Endpoints: 62 | por rol: 62 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_comercial` 57 · `acp_comercial` 56 · `gerencia_general` 54 · `jefe_servicio` 28 · `comercial` 26 · `ing_servicio` 23 · `jefe_logistica` 23 · `jefe_operaciones` 23 · `logistica` 23 · `operaciones` 21

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## process-notes

Endpoints: 5 | por rol: 0 | solo autenticado: 5 (3 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Escrituras sin guarda de rol en la ruta (3) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/process-notes/:entityType/:entityId` → `(anonima)`
- [ ] `POST /api/v1/process-notes/:entityType/:entityId/:noteId/read` → `(anonima)`
- [ ] `POST /api/v1/process-notes/:entityType/:entityId/email` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## public-delivery-plans

Endpoints: 4 | por rol: 4 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 4 · `gerencia_general` 4 · `jefe_comercial` 4 · `jefe_operaciones` 4

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## requests

Endpoints: 18 | por rol: 12 | solo autenticado: 6 (4 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_comercial` 8 · `acp_comercial` 6 · `comercial` 6 · `jefe_calidad` 6 · `gerencia_general` 5 · `jefe_ti` 4 · `jefe_financiero` 3 · `jefe_servicio` 3 · `financiero` 2 · `ing_servicio` 2 · `jefe_operaciones` 2 · `operaciones` 2 · `talento_humano` 2

Endpoints por rol que hoy ningun rol real puede usar (1):

- `PUT /api/v1/requests/new-client/:id/process` — exige: backoffice_comercial

Escrituras sin guarda de rol en la ruta (4) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/requests/new-client` → `(anonima)`
- [ ] `PUT /api/v1/requests/new-client/:id` → `(anonima)`
- [ ] `POST /api/v1/requests/new-client/consent-token` → `(anonima)`
- [ ] `POST /api/v1/requests/new-client/consent-token/verify` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## schedules

Endpoints: 21 | por rol: 21 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_comercial` 21 · `acp_comercial` 16 · `comercial` 16 · `gerencia_general` 11

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## security

Endpoints: 4 | por rol: 4 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 4

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## servicio

Endpoints: 62 | por rol: 62 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 62 · `jefe_servicio` 62 · `ing_servicio` 61 · `acp_comercial` 29 · `comercial` 29 · `jefe_comercial` 29 · `jefe_ti` 25 · `jefe_logistica` 12 · `jefe_operaciones` 10 · `operaciones` 10 · `logistica` 2

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## signature

Endpoints: 5 | por rol: 0 | solo autenticado: 3 (1 de escritura) | permiso central: 0 | publicos: 2 | internos: 0

Escrituras sin guarda de rol en la ruta (1) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/signature/documents/:documentId/sign` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## signature-workflows

Endpoints: 18 | por rol: 0 | solo autenticado: 16 (9 de escritura) | permiso central: 0 | publicos: 2 | internos: 0

Escrituras sin guarda de rol en la ruta (9) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/signature-workflows` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/cancel` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/send` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/signers/:signerId/correct-placement` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/signers/:signerId/open` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/signers/:signerId/reassign` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/signers/:signerId/reject` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/:id/signers/:signerId/sign` → `(anonima)`
- [ ] `POST /api/v1/signature-workflows/validate-signer-profiles` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## suggestion-box

Endpoints: 5 | por rol: 3 | solo autenticado: 1 (1 de escritura) | permiso central: 0 | publicos: 1 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 3 · `jefe_calidad` 3 · `jefe_ti` 3 · `talento_humano` 3

Escrituras sin guarda de rol en la ruta (1) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/suggestion-box/submissions` → `(anonima)`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## support-tickets

Endpoints: 22 | por rol: 13 | solo autenticado: 9 (5 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 13 · `ing_servicio` 5 · `jefe_servicio` 5

Escrituras sin guarda de rol en la ruta (5) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/support-tickets` → `create`
- [ ] `POST /api/v1/support-tickets/:id/close` → `closeByRequester`
- [ ] `POST /api/v1/support-tickets/:id/comments` → `addComment`
- [ ] `POST /api/v1/support-tickets/:id/reopen` → `reopen`
- [ ] `POST /api/v1/support-tickets/:id/satisfaction` → `rateSatisfaction`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## talento-humano

Endpoints: 4 | por rol: 4 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 4 · `talento_humano` 4

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## technical-applications

Endpoints: 1 | por rol: 1 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 1 · `ing_servicio` 1 · `jefe_servicio` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## ti-assets

Endpoints: 63 | por rol: 61 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 2 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`jefe_ti` 61 · `gerencia_general` 59 · `jefe_financiero` 33 · `financiero` 32 · `pasante` 1 · `acp_comercial` 1

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## trainings

Endpoints: 19 | por rol: 15 | solo autenticado: 4 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`acp_comercial` 15 · `comercial` 15 · `financiero` 15 · `gerencia_general` 15 · `ing_servicio` 15 · `jefe_calidad` 15 · `jefe_comercial` 15 · `jefe_financiero` 15 · `jefe_operaciones` 15 · `jefe_servicio` 15 · `jefe_ti` 15 · `operaciones` 15 · `talento_humano` 15

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## users

Endpoints: 18 | por rol: 7 | solo autenticado: 11 (6 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`gerencia_general` 7 · `talento_humano` 7 · `jefe_ti` 5 · `acp_comercial` 3 · `comercial` 1 · `financiero` 1 · `jefe_comercial` 1 · `jefe_financiero` 1 · `jefe_operaciones` 1 · `jefe_servicio` 1

Escrituras sin guarda de rol en la ruta (6) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/users/me/certifications` → `createMyCertification`
- [ ] `DELETE /api/v1/users/me/certifications/:certId` → `deleteMyCertification`
- [ ] `POST /api/v1/users/me/certifications/bulk` → `createMyBulkCertifications`
- [ ] `POST /api/v1/users/me/profile` → `createMine`
- [ ] `PUT /api/v1/users/me/profile` → `updateMine`
- [ ] `POST /api/v1/users/me/profile/documents` → `uploadMyDocument`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## vacaciones

Endpoints: 9 | por rol: 0 | solo autenticado: 8 (5 de escritura) | permiso central: 0 | publicos: 1 | internos: 0

Escrituras sin guarda de rol en la ruta (5) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/vacaciones` → `create`
- [ ] `POST /api/v1/vacaciones/:id/cancel` → `cancel`
- [ ] `POST /api/v1/vacaciones/:id/cancel/review` → `reviewCancel`
- [ ] `PATCH /api/v1/vacaciones/:id/dates` → `updateDates`
- [ ] `PATCH /api/v1/vacaciones/:id/status` → `updateStatus`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## viaticos

Endpoints: 47 | por rol: 47 | solo autenticado: 0 (0 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Roles reales con acceso (endpoints por rol que pasan):

`financiero` 46 · `jefe_financiero` 46 · `talento_humano` 34 · `gerencia_general` 29 · `acp_comercial` 25 · `comercial` 25 · `ing_servicio` 25 · `ing_servicio_ext` 25 · `jefe_comercial` 25 · `jefe_operaciones` 25 · `jefe_servicio` 25 · `jefe_ti` 25

Responsable funcional: _por asignar_ · Aprobado: _pendiente_

## work-management

Endpoints: 33 | por rol: 0 | solo autenticado: 33 (22 de escritura) | permiso central: 0 | publicos: 0 | internos: 0

Escrituras sin guarda de rol en la ruta (22) — confirmar si el control esta en el controlador o falta:

- [ ] `POST /api/v1/work-management/boards/:boardId/groups` → `createGroup`
- [ ] `DELETE /api/v1/work-management/checklist-items/:checklistItemId` → `deleteChecklistItem`
- [ ] `PATCH /api/v1/work-management/checklist-items/:checklistItemId` → `updateChecklistItem`
- [ ] `POST /api/v1/work-management/groups/:groupId/items` → `createItem`
- [ ] `DELETE /api/v1/work-management/items/:itemId` → `deleteItem`
- [ ] `PATCH /api/v1/work-management/items/:itemId` → `updateItem`
- [ ] `PUT /api/v1/work-management/items/:itemId/assignees` → `updateItemAssignees`
- [ ] `POST /api/v1/work-management/items/:itemId/attachments` → `uploadItemAttachment`
- [ ] `POST /api/v1/work-management/items/:itemId/checklist-items` → `createChecklistItem`
- [ ] `POST /api/v1/work-management/items/:itemId/comments` → `createItemComment`
- [ ] `POST /api/v1/work-management/items/:itemId/reorder` → `reorderItem`
- [ ] `POST /api/v1/work-management/items/:itemId/supporters` → `addItemSupporter`
- [ ] `DELETE /api/v1/work-management/items/:itemId/supporters/:supporterUserId` → `removeItemSupporter`
- [ ] `DELETE /api/v1/work-management/projects/:projectId` → `deleteProject`
- [ ] `POST /api/v1/work-management/projects/:projectId/boards` → `createBoard`
- [ ] `POST /api/v1/work-management/projects/from-opportunity/:opportunityId` → `createProjectFromOpportunity`
- [ ] `POST /api/v1/work-management/workspaces` → `createWorkspace`
- [ ] `DELETE /api/v1/work-management/workspaces/:workspaceId` → `deleteWorkspace`
- [ ] `PATCH /api/v1/work-management/workspaces/:workspaceId` → `updateWorkspace`
- [ ] `POST /api/v1/work-management/workspaces/:workspaceId/members` → `addWorkspaceMember`
- [ ] `DELETE /api/v1/work-management/workspaces/:workspaceId/members/:memberUserId` → `removeWorkspaceMember`
- [ ] `POST /api/v1/work-management/workspaces/:workspaceId/projects` → `createProject`

Responsable funcional: _por asignar_ · Aprobado: _pendiente_
