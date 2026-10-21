# Evaluación de Riesgos y FMEA (Failure Mode and Effects Analysis)

## Propósito

Este documento establece la evaluación formal de riesgos del sistema FamSPI v1.0.0 conforme a los requisitos de WHO TRS 1019 Annex 3, Appendix 5 para sistemas computarizados en entornos regulados. El análisis cubre todos los módulos incluidos en el alcance de validación inicial.

## Metodología

Se aplica la metodología FMEA (Análisis de Modos de Falla y sus Efectos) con puntuación de Número de Prioridad de Riesgo (RPN = Severidad × Probabilidad × Detectabilidad). Los riesgos con RPN ≥ 30 o Severidad = 5 requieren mitigación obligatoria antes del inicio de los protocolos IQ/OQ/PQ.

| Escala | Severidad | Probabilidad | Detectabilidad |
|---|---|---|---|
| 1 | Insignificante | Muy baja (< 1% ciclos) | Detectado inmediatamente |
| 2 | Menor | Baja (1–5% ciclos) | Detectado rápidamente |
| 3 | Moderado | Media (5–20% ciclos) | Detectado en revisión |
| 4 | Mayor | Alta (20–50% ciclos) | Difícil de detectar |
| 5 | Crítico / Catastrófico | Muy alta (> 50% ciclos) | Muy difícil de detectar |

## Matriz FMEA — Riesgos del Sistema FamSPI v1.0.0

| ID | Módulo / Área | Modo de Falla | Efecto Potencial | S | P | D | RPN | Mitigación | Riesgo Residual | Estado | Responsable |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | Infraestructura / Cloud Run | Interrupción del servicio de contenedor | Indisponibilidad total del sistema | 5 | 2 | 2 | 20 | Alta disponibilidad GCP, reinicio automático, monitoreo de uptime | Bajo (RPN 10) | Mitigado | TI |
| R-002 | auth | Compromiso de credenciales OAuth2 | Acceso no autorizado al sistema | 5 | 2 | 3 | 30 | OAuth2 con Google, JWT de corta duración, refresh token rotación | Medio (RPN 15) | Activo | TI / Seguridad |
| R-003 | auth | Sesión no invalidada en logout | Acceso residual con token robado | 4 | 2 | 3 | 24 | Blacklist de tokens en invalidación, expiración corta JWT | Bajo | Mitigado | TI |
| R-004 | security | Login fuera de horario no detectado | Acceso no autorizado fuera de control | 4 | 3 | 2 | 24 | Registro de eventos off-hours, alerta a TI | Bajo | Mitigado | TI |
| R-005 | auditoria | Pérdida de registros de auditoría | No trazabilidad de eventos críticos | 5 | 1 | 2 | 10 | Almacenamiento persistente, logs no eliminables por usuario | Bajo | Mitigado | TI |
| R-006 | Base de datos (PostgreSQL) | Corrupción o pérdida de datos | Pérdida de información operativa | 5 | 1 | 3 | 15 | Transacciones ACID, backups periódicos a Drive | Bajo | Mitigado | TI |
| R-007 | signature | Firma avanzada invalidada | Documentos sin validez legal | 5 | 2 | 2 | 20 | Verificación de hash, QR de validación, audit trail documental | Bajo | Mitigado | TI |
| R-008 | documents | Generación de documento corrupto | Entrega de documento inválido | 3 | 2 | 2 | 12 | Validación post-generación, reintentos automáticos | Bajo | Mitigado | TI |
| R-009 | Usuarios (RBAC) | Asignación incorrecta de rol | Acceso a funciones no autorizadas | 4 | 2 | 3 | 24 | Validación de permisos por middleware en cada endpoint | Bajo | Mitigado | TI |
| R-010 | Integración Gmail | Falla en envío de correo | Notificación no entregada | 2 | 3 | 2 | 12 | Reintentos con backoff, registro de errores | Bajo | Mitigado | TI |
| R-011 | permisos / vacaciones | Cálculo incorrecto de saldo | Error en nómina o control laboral | 4 | 2 | 3 | 24 | Validación unitaria, pruebas OQ/PQ específicas | Medio | Bajo seguimiento | Funcional |
| R-012 | attendance | Registro de marcación duplicado | Horas extra incorrectas | 3 | 2 | 3 | 18 | Idempotencia en API, validación de timestamp único | Bajo | Mitigado | TI |
| R-013 | personnel-requests | Datos de candidato incompletos en contratación | Expediente laboral incompleto | 3 | 3 | 3 | 27 | Validaciones de campos obligatorios en frontend y backend | Bajo | Mitigado | TI |
| R-014 | Entorno de producción | Despliegue en entorno incorrecto | Ejecución sobre datos reales no intencionados | 5 | 1 | 2 | 10 | Separación de ambientes, variables por entorno, IQ verifica | Bajo | Mitigado | TI |
| R-015 | Confidencialidad datos personales (LOPDP) | Exposición de datos personales sensibles | Incumplimiento legal / sanción | 5 | 1 | 3 | 15 | RBAC, cifrado en tránsito (HTTPS/TLS), políticas de privacidad | Bajo | Mitigado | TI / Legal |

## Resumen de Riesgos por Nivel

| Nivel de Riesgo | RPN Umbral | Cantidad de Riesgos | Acción Requerida |
|---|---|---|---|
| Crítico | RPN ≥ 50 o S=5 sin mitigación | 0 | Bloquea inicio de IQ |
| Alto | RPN 30–49 | 1 (R-002) | Mitigación documentada requerida antes de OQ |
| Medio | RPN 20–29 | 4 (R-003, R-004, R-009, R-011) | Seguimiento en OQ/PQ |
| Bajo | RPN < 20 | 10 | Monitoreo en operación normal |

## Conclusión del Análisis de Riesgos

El análisis identifica un (1) riesgo de nivel Alto (R-002: compromiso de credenciales OAuth2) que requiere verificación de sus controles de mitigación durante el protocolo OQ. Los demás riesgos se encuentran en nivel Bajo o Medio con mitigaciones técnicas implementadas y verificables durante IQ/OQ/PQ. No se identifican riesgos críticos que bloqueen el inicio de los protocolos de calificación.

## Firmas de Aprobación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Elaborado por | __________________ | __________________ | __________ |
| Revisado por (Funcional) | __________________ | __________________ | __________ |
| Aprobado por (TI) | __________________ | __________________ | __________ |
