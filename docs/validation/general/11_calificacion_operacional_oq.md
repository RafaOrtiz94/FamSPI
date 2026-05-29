# Calificacion Operacional (OQ)

## Casos criticos
| ID | Objetivo | Resultado esperado | Resultado obtenido | Evidencia | Estado | Responsable |
|---|---|---|---|---|---|---|
| OQ-001 | Login correcto | Acceso autorizado | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-001_20260513_R1 | No ejecutado | TICs |
| OQ-002 | Login fallido | Denegacion controlada | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-002_20260513_R1 | No ejecutado | TICs |
| OQ-003 | Usuario sin sesion | Bloqueo | Control evidenciado en codigo; prueba runtime pendiente | EV_FAMSPI_V1_0_0_OQ_OQ-003_20260513_R1 | Parcial | TICs |
| OQ-004 | Usuario sin permiso | Denegacion | No ejecutado con perfiles reales | EV_FAMSPI_V1_0_0_OQ_OQ-004_20260513_R1 | No ejecutado | TICs |
| OQ-005 | Rol incorrecto | Bloqueo de accion | No ejecutado con perfiles reales | EV_FAMSPI_V1_0_0_OQ_OQ-005_20260513_R1 | No ejecutado | TICs |
| OQ-006 | Acceso al modulo funcional | Acceso permitido | No ejecutado UI/API controlada | EV_FAMSPI_V1_0_0_OQ_OQ-006_20260513_R1 | No ejecutado | Funcional |
| OQ-007 | Crear permiso valido | Solicitud creada | No ejecutado en DB real | EV_FAMSPI_V1_0_0_OQ_OQ-007_20260513_R1 | No ejecutado | Funcional |
| OQ-008 | Crear vacaciones valida | Solicitud creada | No ejecutado en DB real | EV_FAMSPI_V1_0_0_OQ_OQ-008_20260513_R1 | No ejecutado | Funcional |
| OQ-009 | Solicitud incompleta | Error controlado | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-009_20260513_R1 | No ejecutado | TICs |
| OQ-010 | Aprobar solicitud | Estado aprobado | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-010_20260513_R1 | No ejecutado | Funcional |
| OQ-011 | Rechazar solicitud | Estado rechazado | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-011_20260513_R1 | No ejecutado | Funcional |
| OQ-012 | Cambio de estado | Estado trazable | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-012_20260513_R1 | No ejecutado | Funcional |
| OQ-013 | Consulta historica | Registros recuperables | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-013_20260513_R1 | No ejecutado | Funcional |
| OQ-014 | Trazabilidad/log | Trail coherente | Middleware audit evidenciado; evidencia runtime pendiente | EV_FAMSPI_V1_0_0_OQ_OQ-014_20260513_R1 | Parcial | TICs |
| OQ-015 | Modificacion no permitida | Bloqueo | No ejecutado en entorno controlado | EV_FAMSPI_V1_0_0_OQ_OQ-015_20260513_R1 | No ejecutado | TICs |
| OQ-016 | Manejo de errores controlados | Error controlado | Parcial en pruebas backend globales; no prueba directa de alcance funcional | EV_FAMSPI_V1_0_0_OQ_OQ-016_20260513_R1 | Parcial | TICs |

## Resultado de pruebas automáticas de soporte
`npm test -- --runInBand`: 21 suites (16 pass, 5 fail), 100 tests (76 pass, 22 fail, 2 skipped).

## Conclusion OQ
OQ no cerrado: requiere ejecucion controlada completa del flujo funcional en entorno validado.
