# Plan Maestro y Calificacion de Diseno (DQ)

Documento vigente de plan maestro de validacion y calificacion de diseno de FamSPI.

Fecha de emision: `20 de julio de 2026`

## 1. Introduccion y alcance (WHO §1)

Este documento establece el plan maestro de validacion retrospectiva de FamSPI y la calificacion de diseno (DQ) del sistema actual, considerando los requerimientos, implementaciones, correcciones funcionales y ampliaciones de alcance ya presentes en codigo. El nivel de validacion es proporcional al riesgo, complejidad y uso previsto de cada modulo, conforme a WHO TRS 1019 Annex 3 Appendix 5 §1.1-1.5.

Antes de ejecutar IQ, OQ o PQ se debe completar lo siguiente:

1. Confirmar la version funcional a validar.
2. Congelar el alcance y el periodo de evidencia.
3. Identificar modulos, rutas y roles vigentes desde codigo real.
4. Confirmar que URS, FRS, DS y RTM no contradicen el sistema actual.
5. Clasificar cada modulo como:
   - vigente y alineado,
   - vigente con brecha documental,
   - fuera de alcance de la corrida,
   - historico o reemplazado.

## 2. Protocolo y reporte de validacion (WHO §3)

Este plan maestro, junto con los documentos de Instalacion (IQ), Operacion (OQ), Desempeno (PQ) y los Anexos retrospectivos, constituye en conjunto el protocolo y reporte de validacion de FamSPI exigido por WHO §3.1-3.8:

| Elemento exigido (WHO §3.3) | Donde se cubre |
|---|---|
| Alcance | §1 de este documento |
| Enfoque de gestion de riesgo | §11 de este documento (analisis de riesgo y brechas) |
| Especificacion | URS/FRS/DS (`docs/validation/URS`, `FRS`, `DS`) |
| Criterios de aceptacion | Checklist DQ (§8) y criterios OQ/PQ en sus documentos respectivos |
| Pruebas | Documento OQ (evidencia de ejecucion funcional) y PQ (aceptacion) |
| Revision | Bloque de aprobaciones al cierre de cada documento |
| Entrenamiento de personal | §9 del documento OQ (SOPs y entrenamiento) |
| Liberacion del sistema | Bloque de conclusion y decision de liberacion en OQ/PQ |

Toda desviacion critica o mayor detectada durante la ejecucion debe investigarse, documentarse y justificarse antes de aceptar el resultado (WHO §3.7), con causa raiz registrada en el documento OQ/PQ correspondiente.

## 3. Gestion de proveedores (WHO §4)

FamSPI depende de proveedores externos para infraestructura, autenticacion y almacenamiento. Conforme a WHO §4.1-4.3, TICS evalua estos proveedores segun riesgo y mantiene control documental de la configuracion asociada:

| Proveedor | Servicio provisto | Tipo | Evidencia / control aplicado |
|---|---|---|---|
| Neon (PostgreSQL serverless) | Base de datos principal del sistema | Infraestructura de datos | Credenciales gestionadas via gcloud Secret Manager (`DB_PASSWORD`, proyecto `famspi-sbox`), nunca en `.env` local; ver `backend/src/config/db.js` |
| Google Cloud Run | Despliegue y ejecucion del backend y jobs internos | Infraestructura de computo | Configuracion de despliegue versionada; jobs internos activados por instancia via `JOBS_RUNNER_INSTANCE` |
| Google OAuth2 | Autenticacion de usuarios | Identidad | Flujo OAuth2 documentado en `backend/src/config/oauth.js`; JWT emitido con iss/aud propios (`spi-fam-backend` / `spi-fam-frontend`) |
| Google Drive (API) | Almacenamiento de documentos y archivos generados | Almacenamiento | Gestionado por `driveClientManager.js`; alcance y permisos de API controlados por cuenta de servicio |
| Google Cloud Secret Manager | Custodia de credenciales sensibles | Gestion de secretos | Unico mecanismo autorizado para credenciales de base de datos en produccion |

No se identifican contratos de desarrollo tercerizado sobre el codigo propio de FamSPI: el desarrollo del sistema es interno (ver §6).

## 4. Fuentes de verdad para DQ 2026

- Backend de referencia: [backend/src/routes/registerRoutes.js](../../backend/src/routes/registerRoutes.js)
- Frontend de referencia: [spi_front/src/routes/AppRoutes.jsx](../../spi_front/src/routes/AppRoutes.jsx)
- Layout y consistencia visual: [DESIGN.md](../../DESIGN.md)

## 5. Inventario funcional vigente

### 5.1 Modulos transversales

- Autenticacion, login callback y sesiones
- Usuarios, perfiles, collaborator profiles y mi perfil
- Roles, scopes, module access y rutas protegidas
- Dashboard, auditoria, notifications, files, documents, signature y signature workflows

### 5.2 Dominios de negocio vigentes

- Talento humano: employees, personnel requests, applicants, collaborators, permisos, vacaciones, offboarding, asistencia, pruebas tecnicas
- Comercial: requests, clients, schedules, delivery ceilings, opportunities, FamSheets, business case, CRM-FAM
- Servicio tecnico: solicitudes, cronograma, mantenimientos, aplicaciones, disponibilidad, capacitaciones, external cases
- Compras y activos: equipment purchases, private purchases, inventario, equipment management, support tickets, ti-assets, collab deliveries
- Finanzas: finanzas y viaticos
- Calidad: lineas CA0101 a CA0117
- Otros componentes vigentes: work management, kickoff, birthday redeem y portal publico de predicciones 2026

## 6. Desarrollo del sistema e implementacion del proyecto (WHO §8)

FamSPI es un sistema de desarrollo interno (no adquirido a un proveedor externo), por lo que aplica el control de calidad documentado en WHO §8.3-8.4 para sistemas desarrollados a medida:

- **Control de versiones**: historial completo en git, con commits atribuibles y mensajes descriptivos por cambio.
- **Estandares de codigo**: ESLint configurado (`backend/eslint.config.js`, `spi_front` con `eslint src/`), ejecutado via `npm run lint` antes de integrar cambios.
- **Estructura modular obligatoria**: cada modulo backend sigue el patron `<nombre>.routes.js` / `<nombre>.controller.js` / `<nombre>.service.js` / `CONTEXT.md`, documentado en `CLAUDE.md` y reforzado por archivos `AGENTS.md` de alcance por modulo.
- **Pruebas de desarrollo**: suite Jest ejecutable via `npm test`; ver evidencia real de ejecucion en el documento OQ.
- **Control de cambios en base de datos**: migraciones SQL numeradas en `backend/migrations/` (283 archivos al `20 de julio de 2026`), aplicadas manualmente y bajo control de version, sin runner automatico.
- **Ejemplo verificable de control de cambios**: la integracion con Odoo fue retirada del sistema por decision de negocio ("Odoo ya no existe"); el modulo `backend/src/modules/integrations/` documenta la remocion en su `AGENTS.md` y conserva una prueba de verificacion (`integrationOutboxWorker.service.test.js`) que verifica explicitamente que los eventos no-CRM se marcan como omitidos por ausencia de proveedor. Este caso se referencia tambien como evidencia de retiro de componente en los Anexos (§14).

## 7. Alcance recomendado para validacion general

La validacion general debe cubrir solo funciones en operacion o listas para operacion productiva. Los portales publicos temporales o promocionales deben quedar marcados como:

- dentro de alcance si afectan datos regulados, trazabilidad o autorizaciones centrales,
- fuera de alcance general si son iniciativas auxiliares de bajo riesgo y sin impacto en cumplimiento.

## 8. Calificacion de diseno (DQ) (WHO §7)

La DQ debe confirmar:

- que la arquitectura actual sigue siendo coherente con el uso previsto,
- que los flujos actuales por rol estan bien segregados,
- que los modulos nuevos o ampliados ya fueron incorporados al mapa documental,
- que los documentos historicos no siguen gobernando flujos que ya cambiaron.

### 8.1 Checklist DQ maestro 2026

| ID | Verificacion | Fuente de evidencia | Estado esperado |
|---|---|---|---|
| DQ-01 | Inventario de rutas backend actualizado | `registerRoutes.js` | Conforme |
| DQ-02 | Inventario de pantallas privadas actualizado | `AppRoutes.jsx` | Conforme |
| DQ-03 | Matriz de roles actualizada | rutas protegidas + navegacion | Conforme |
| DQ-04 | Catalogo de modulos y workspaces vigente | frontend + backend | Conforme |
| DQ-05 | URS por dominio sin contradicciones criticas | `docs/validation/URS/` vs codigo | Conforme |
| DQ-06 | FRS por dominio sin contradicciones criticas | `docs/validation/FRS/` vs codigo | Conforme |
| DQ-07 | DS por dominio alineado con implementacion | `docs/validation/DS/` vs codigo | Conforme |
| DQ-08 | RTM refleja modulos y flujos vigentes | `docs/validation/RTM/` | Conforme |
| DQ-09 | Navegacion, layout y patrones base alineados al diseno vigente | `DESIGN.md` + frontend | Conforme |
| DQ-10 | Areas funcionales validadas y areas pendientes claramente separadas | docs + responsables | Conforme |

### 8.2 Brechas que este documento corrige

- El expediente general historico mezclaba fases de validacion en una sola narrativa sin distinguirlas por WHO §7-14.
- Varias areas nuevas del sistema no estaban expresadas en el protocolo general.
- Existen modulos operativos en produccion sin reflejo claro en el mapa maestro anterior.
- La navegacion, los roles y varios workspaces evolucionaron, pero la validacion general no lo reflejaba.

## 9. Salidas obligatorias para pasar a IQ

No se debe iniciar IQ si no existe:

- alcance congelado de la corrida,
- lista de modulos incluidos y excluidos,
- referencia de version o commit,
- responsables de aprobacion por fase,
- brechas documentales abiertas registradas.

## 10. Conclusion del plan maestro y DQ

La DQ general debe considerarse reabierta por cambio material de alcance del sistema. Este plan maestro sustituye el uso del protocolo general mezclado y obliga a ejecutar las siguientes fases (IQ, OQ, PQ) con documentos independientes, cada uno referenciado a las secciones de WHO Appendix 5 que le corresponden.

<!-- SECCION_11_ANALISIS_RIESGO_START -->

## 11. Analisis de riesgo y cobertura de pruebas

El Departamento de Tecnologias de la Informacion y Comunicacion (TICS) releva la cobertura de pruebas de verificacion y el historial de mantenimiento de cada modulo del sistema, conforme al enfoque de validacion retrospectiva para sistemas existentes de WHO TRS 1019 Annex 3 Appendix 5, §12.6-12.10. Corte de la evaluacion: 22 de julio de 2026.

De los 54 modulos que componen el backend de FamSPI, TICS confirma que **54 cuentan con suite de pruebas de verificacion** (333 casos de prueba en total) y **0 se sustentan con evidencia por historial de control**. Conforme a WHO §12.6-12.10, esta condicion no bloquea la validacion siempre que quede documentada con evidencia de riesgo y de mantenimiento activo del modulo.

**Naturaleza retrospectiva y estado sujeto a cambios:** esta evaluacion es una fotografia del sistema a la fecha de corte. Aunque los modulos esten en produccion, NO se consideran congelados: siguen siendo susceptibles a cambios funcionales y de configuracion. Todo cambio posterior debe gestionarse mediante control de cambios con ticket TI (WHO §29) y re-dispara la revalidacion del alcance afectado (DQ/IQ/OQ/PQ). Por tanto, la cobertura y las conclusiones aqui declaradas aplican a la version/configuracion vigente en la fecha de corte y deben re-confirmarse tras cada cambio material.

### 11.1 Modulos con cobertura de pruebas de verificacion

| Modulo | Riesgo | Casos de prueba | Archivos |
|---|---|---|---|
| applicants | medio-bajo | 3 | `backend/src/modules/applicants/__tests__/applicants.helpers.test.js` |
| approvals | medio-bajo | 1 | `backend/src/modules/approvals/__tests__/approvals.service.test.js` |
| attendance | medio-bajo | 83 | `backend/src/modules/attendance/__tests__/attendance.controller.flows.test.js`, `backend/src/modules/attendance/__tests__/attendance.service.test.js`, `backend/src/modules/attendance/__tests__/attendanceReports.service.test.js`, `backend/src/modules/attendance/__tests__/attendanceShortcut.service.test.js` |
| audit-prep | medio-bajo | 3 | `backend/src/modules/audit-prep/__tests__/auditPrep.helpers.test.js` |
| auditoria | alto | 2 | `backend/src/modules/auditoria/__tests__/auditoria.service.test.js` |
| auth | alto | 5 | `backend/src/modules/auth/__tests__/session.repository.test.js` |
| business-case | medio-bajo | 41 | `backend/src/modules/business-case/__tests__/businessCaseDeterminationsGate.service.test.js`, `backend/src/modules/business-case/__tests__/businessCaseSheetEquipment.helper.test.js`, `backend/src/modules/business-case/__tests__/businessCaseSheetGeneration.contract.test.js`, `backend/src/modules/business-case/__tests__/businessCaseSheetVersioning.helper.test.js`, `backend/src/modules/business-case/__tests__/calculationEngine.test.js`, `backend/src/modules/business-case/__tests__/consumptionVersionConflict.integration.test.js`, `backend/src/modules/business-case/__tests__/deliveryCeiling.service.test.js`, `backend/src/modules/business-case/__tests__/exporters.test.js`, `backend/src/modules/business-case/__tests__/investments.depreciation.test.js`, `backend/src/modules/business-case/__tests__/preflow.service.test.js`, `backend/src/modules/business-case/__tests__/syncConsumptionFromSheet.creates.test.js` |
| calendar | medio-bajo | 2 | `backend/src/modules/calendar/__tests__/calendar.service.test.js` |
| calidad | medio-bajo | 1 | `backend/src/modules/calidad/__tests__/ca0110.rpn.test.js` |
| clients | medio-bajo | 1 | `backend/src/modules/clients/__tests__/clients.helpers.test.js` |
| collab-deliveries | medio-bajo | 3 | `backend/src/modules/collab-deliveries/__tests__/collabDeliveries.helpers.test.js` |
| collaborators | medio-bajo | 2 | `backend/src/modules/collaborators/__tests__/collaborators.helpers.test.js` |
| consumable-files | medio-bajo | 9 | `backend/src/modules/consumable-files/__tests__/consumableFiles.helpers.test.js` |
| crm-fam | medio-bajo | 18 | `backend/src/modules/crm-fam/__tests__/crm.calculators.test.js` |
| dashboard | medio-bajo | 4 | `backend/src/modules/dashboard/__tests__/dashboard.helpers.test.js` |
| delivery-ceilings | medio-bajo | 2 | `backend/src/modules/delivery-ceilings/__tests__/deliveryCeilings.helpers.test.js` |
| delivery-requests | medio-bajo | 9 | `backend/src/modules/delivery-requests/__tests__/deliveryRequests.service.test.js` |
| departments | medio-bajo | 2 | `backend/src/modules/departments/__tests__/departments.helpers.test.js` |
| documents | alto | 2 | `backend/src/modules/documents/__tests__/document.service.test.js` |
| equipment-management | medio-bajo | 2 | `backend/src/modules/equipment-management/__tests__/equipmentManagement.helpers.test.js` |
| equipment-purchases | medio-bajo | 4 | `backend/src/modules/equipment-purchases/__tests__/unifiedPurchaseVisibility.test.js` |
| files | medio-bajo | 3 | `backend/src/modules/files/__tests__/file.service.test.js` |
| finanzas | alto | 5 | `backend/src/modules/finanzas/__tests__/finanzas.controller.test.js` |
| gmail | medio-bajo | 3 | `backend/src/modules/gmail/__tests__/gmail.controller.test.js` |
| hiring-pipeline | medio-bajo | 5 | `backend/src/modules/hiring-pipeline/__tests__/hiringPipeline.helpers.test.js` |
| integrations | medio-bajo | 8 | `backend/src/modules/integrations/__tests__/integrationOutbox.service.test.js`, `backend/src/modules/integrations/__tests__/integrationOutboxWorker.service.test.js`, `backend/src/modules/integrations/__tests__/productMap.service.test.js` |
| inventario | medio-bajo | 2 | `backend/src/modules/inventario/__tests__/inventario.helpers.test.js` |
| management | medio-bajo | 3 | `backend/src/modules/management/__tests__/management.service.test.js` |
| mantenimientos | medio-bajo | 4 | `backend/src/modules/mantenimientos/__tests__/mantenimientos.helpers.test.js` |
| module-access | alto | 3 | `backend/src/modules/module-access/__tests__/moduleAccess.service.test.js` |
| notifications | medio-bajo | 2 | `backend/src/modules/notifications/__tests__/notifications.helpers.test.js` |
| offboarding | medio-bajo | 2 | `backend/src/modules/offboarding/__tests__/offboarding.helpers.test.js` |
| opportunities | medio-bajo | 2 | `backend/src/modules/opportunities/__tests__/opportunities.helpers.test.js` |
| permisos | alto | 9 | `backend/src/modules/permisos/__tests__/permisos.validation.test.js` |
| personnel-requests | medio-bajo | 3 | `backend/src/modules/personnel-requests/__tests__/personnelRequests.addComment.test.js` |
| private-purchases | medio-bajo | 2 | `backend/src/modules/private-purchases/__tests__/privatePurchases.roles.test.js` |
| requests | medio-bajo | 1 | `backend/src/modules/requests/__tests__/sendConsentEmailToken.test.js` |
| schedules | medio-bajo | 3 | `backend/src/modules/schedules/__tests__/schedules.helpers.test.js` |
| security | alto | 14 | `backend/src/modules/security/__tests__/security.helpers.test.js` |
| servicio | medio-bajo | 2 | `backend/src/modules/servicio/__tests__/externalCases.helpers.test.js` |
| shared | medio-bajo | 3 | `backend/src/modules/shared/__tests__/profileSync.test.js` |
| signature | alto | 5 | `backend/src/modules/signature/__tests__/signature.validation.test.js` |
| signature-workflows | alto | 12 | `backend/src/modules/signature-workflows/__tests__/signatureWorkflows.validation.test.js` |
| support-tickets | medio-bajo | 6 | `backend/src/modules/support-tickets/__tests__/supportTickets.helpers.test.js` |
| talento_humano | medio-bajo | 3 | `backend/src/modules/talento_humano/__tests__/hr.controller.test.js` |
| technical-applications | medio-bajo | 1 | `backend/src/modules/technical-applications/__tests__/technicalApplications.helpers.test.js` |
| ti-assets | medio-bajo | 3 | `backend/src/modules/ti-assets/__tests__/tiAssets.helpers.test.js` |
| trainings | medio-bajo | 3 | `backend/src/modules/trainings/__tests__/trainings.helpers.test.js` |
| user-certifications | medio-bajo | 2 | `backend/src/modules/user-certifications/__tests__/userCertifications.helpers.test.js` |
| user-profile | medio-bajo | 5 | `backend/src/modules/user-profile/__tests__/userProfile.helpers.test.js` |
| users | medio-bajo | 5 | `backend/src/modules/users/__tests__/users.helpers.test.js` |
| vacaciones | alto | 4 | `backend/src/modules/vacaciones/__tests__/vacaciones.service.test.js` |
| viaticos | alto | 4 | `backend/src/modules/viaticos/__tests__/viaticos.access.test.js` |
| work-management | medio-bajo | 2 | `backend/src/modules/work-management/__tests__/workManagement.helpers.test.js` |

### 11.2 Brechas de alto riesgo (requieren revision prioritaria)

Ninguna.

### 11.3 Otras brechas (riesgo medio-bajo)

Ninguna.

**Regla de aceptacion de brecha (WHO §12.8):** un modulo de riesgo alto sin prueba de verificacion directa solo se considera brecha aceptada si TICS documenta evidencia de mantenimiento activo (cambios recientes revisados por par) y no existen incidentes abiertos conocidos. Los modulos de la seccion 11.2 se priorizan para cobertura futura antes que los de la seccion 11.3.

### 11.4 Exclusiones de alcance (no son brechas)

TICS reviso el inventario y determino que 7 directorios de `backend/src/modules/` no constituyen una brecha de validacion y quedan fuera del alcance, por lo que no se cuentan entre los 54 modulos evaluados.

**Ruteadores huerfanos / codigo muerto (no montado, dependencias inexistentes):**

| Modulo | Motivo de exclusion |
|---|---|
| logistica | Ruteador huerfano: depende de `auth/auth.middleware` (inexistente) y no esta montado en registerRoutes. Codigo muerto. |
| operaciones | Ruteador huerfano: depende de `auth/auth.middleware` (inexistente) y no esta montado en registerRoutes. Codigo muerto. |
| tecnico | Ruteador huerfano: depende de `auth/auth.middleware` (inexistente) y no esta montado en registerRoutes. Codigo muerto. |

**Modulos reales fuera del alcance general (WHO/DQ §7):**

| Modulo | Justificacion de exclusion |
|---|---|
| famdays | Iniciativa interna auxiliar de bajo riesgo, sin impacto en cumplimiento ni datos criticos (DQ §7). |
| kickoff | Portal auxiliar de arranque, sin datos regulados centrales (DQ §7). |
| public-delivery-plans | Portal publico de consulta, sin autorizaciones ni datos criticos GxP (DQ §7). |
| world-cup-2026 | Portal promocional temporal (predicciones 2026), sin impacto en datos regulados ni autorizaciones (DQ §7). |

Si cualquiera de estos portales pasara a manejar datos regulados, autorizaciones o trazabilidad central, debe reincorporarse al alcance y evaluarse su cobertura.

### 11.5 Modulos en desarrollo (validacion provisional)

Los siguientes modulos se encuentran en desarrollo activo: permanecen dentro del inventario y pueden contar con cobertura de pruebas, pero su validacion es PROVISIONAL y se re-evalua al estabilizarse su funcionalidad y alcance. No deben interpretarse como validados en estado final.

| Modulo | Estado |
|---|---|
| calidad | Modulo en desarrollo activo (lineas CA0101-CA0117); funcionalidad y alcance en evolucion. Validacion provisional, sujeta a re-evaluacion al estabilizarse. |

<!-- SECCION_11_ANALISIS_RIESGO_END -->
