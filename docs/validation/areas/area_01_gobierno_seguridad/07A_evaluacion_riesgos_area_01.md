# Evaluación de Riesgos — Área 01: Gobierno, Seguridad, Cumplimiento y Gestión Documental

## Propósito

Este documento establece la evaluación específica de riesgos del Área 01 del sistema SPI, cubriendo los módulos: auth, security, auditoria, audit-prep, approvals, management, signature, documents, files, notifications, dashboard y gmail. La evaluación aplica metodología FMEA conforme a WHO TRS 1019 Appendix 5.

## Metodología FMEA

RPN = Severidad × Probabilidad × Detectabilidad. Umbrales: RPN ≥ 50 = Crítico (bloquea IQ), RPN 30–49 = Alto (mitigación requerida antes de OQ), RPN 20–29 = Medio (seguimiento en OQ/PQ).

## Matriz FMEA — Área 01

| ID | Módulo | Modo de Falla | Efecto | S | P | D | RPN | Mitigación | Riesgo Residual | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| R-A01-001 | auth | Compromiso de token OAuth2 | Acceso no autorizado al sistema | 5 | 2 | 3 | 30 | JWT de corta duración, refresh token con rotación, revocación en logout | Medio | Activo — verificar en OQ |
| R-A01-002 | auth | Bypass de consentimiento LOPDP | Incumplimiento regulatorio | 5 | 1 | 2 | 10 | Flujo de consentimiento obligatorio, no salteable en UI/backend | Bajo | Mitigado |
| R-A01-003 | security | Login off-hours no alertado | Acceso sin supervisión fuera de horario | 4 | 2 | 2 | 16 | Evento registrado, alerta disponible para revisión TI | Bajo | Mitigado |
| R-A01-004 | auditoria | Pérdida de entradas en bitácora | Falta de trazabilidad de eventos | 5 | 1 | 2 | 10 | Escritura sincrónica en DB, sin acceso de eliminación para usuarios | Bajo | Mitigado |
| R-A01-005 | auditoria | Bitácora consultada por rol no autorizado | Exposición de información sensible de auditoría | 4 | 2 | 3 | 24 | RBAC en endpoint de consulta, roles habilitados solo para TI/auditor | Bajo | Mitigado |
| R-A01-006 | audit-prep | Acceso externo no controlado durante auditoría | Exposición de datos a tercero no autorizado | 5 | 1 | 2 | 10 | Acceso con credenciales temporales, scope limitado, registro de sesión | Bajo | Mitigado |
| R-A01-007 | approvals | Aprobación sin quorum o incorrecta | Acción crítica ejecutada sin autorización completa | 4 | 2 | 2 | 16 | Validación de estado de cola, doble verificación de rol aprobador | Bajo | Mitigado |
| R-A01-008 | signature | Firma aplicada sobre documento incorrecto | Documento firmado con contenido erróneo | 5 | 1 | 2 | 10 | Hash del documento incluido en firma, verificación post-firma disponible | Bajo | Mitigado |
| R-A01-009 | signature | Token de verificación pública inaccesible | Verificación externa del documento falla | 3 | 2 | 2 | 12 | Token almacenado en DB, endpoint público de verificación | Bajo | Mitigado |
| R-A01-010 | documents | Generación de documento con datos incorrectos | Documento oficial con información errónea | 4 | 2 | 3 | 24 | Plantillas controladas, datos tomados directamente del backend validado | Bajo | Mitigado |
| R-A01-011 | documents | Pérdida de documento generado | Documento no recuperable post-generación | 4 | 1 | 2 | 8 | Almacenamiento en bucket GCS con retención configurada | Bajo | Mitigado |
| R-A01-012 | files | Carga de archivo malicioso | Riesgo de seguridad o infección | 4 | 2 | 2 | 16 | Validación de tipo MIME, límite de tamaño, almacenamiento en GCS aislado | Bajo | Mitigado |
| R-A01-013 | notifications | Notificación no entregada | Usuario sin aviso de evento crítico | 2 | 3 | 2 | 12 | Almacenamiento de notificación en DB independiente del canal de entrega | Bajo | Mitigado |
| R-A01-014 | gmail | Token Gmail expirado sin renovación | Envío de correo falla silenciosamente | 3 | 2 | 2 | 12 | Verificación de vigencia del token antes de envío, reautorización guiada | Bajo | Mitigado |
| R-A01-015 | management | Dashboard con datos desactualizados | Decisión gerencial sobre datos incorrectos | 3 | 2 | 3 | 18 | Datos consultados en tiempo real desde DB, sin caché de larga duración | Bajo | Mitigado |

## Resumen por Nivel de Riesgo — Área 01

| Nivel | Cantidad | Acción |
|---|---|---|
| Crítico (RPN ≥ 50) | 0 | No aplica |
| Alto (RPN 30–49) | 1 (R-A01-001) | Verificar mitigación en OQ — caso OQ-002 y OQ-003 |
| Medio (RPN 20–29) | 2 (R-A01-005, R-A01-010) | Seguimiento en OQ |
| Bajo (RPN < 20) | 12 | Monitoreo en operación normal |

## Conclusión

El Área 01 presenta un perfil de riesgo bajo. El único riesgo Alto (R-A01-001: compromiso de token OAuth2) tiene mitigaciones técnicas robustas implementadas y debe ser verificado explícitamente durante OQ. No existen riesgos críticos que bloqueen el inicio de los protocolos de calificación.

## Firmas de Aprobación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Elaborado por | __________________ | __________________ | __________ |
| Revisado por (Funcional) | __________________ | __________________ | __________ |
| Aprobado por (TI) | __________________ | __________________ | __________ |
