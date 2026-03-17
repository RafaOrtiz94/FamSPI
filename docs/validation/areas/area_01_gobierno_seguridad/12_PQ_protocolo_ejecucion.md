# PROTOCOLO PQ - CALIFICACION DE DESEMPENO
## Area 01: Gobierno, Seguridad y Cumplimiento

## 1. Objetivo
Demostrar que el area 01 funciona consistentemente en condiciones representativas de uso real, manteniendo estabilidad, seguridad y trazabilidad.

## 2. Referencias
- `02_FRS_requerimientos_funcionales.md`
- `03_DDS_diseno_tecnico.md`
- `06_PQ_validacion_operacion_real.md`
- `09_informe_hallazgos_area_01.md`

## 3. Datos de ejecucion
| Campo | Valor |
|---|---|
| Sistema | SPI |
| Area | Gobierno, Seguridad y Cumplimiento |
| Ambiente | __________________ |
| Fecha de ejecucion | __________________ |
| Ejecutado por | __________________ |
| Revisado por | __________________ |
| Ventana de prueba | __________________ |

## 4. Precondiciones generales
- IQ y OQ aprobados o aprobados con desviaciones controladas.
- Ambiente estable con monitoreo y acceso a logs.
- Conjunto de usuarios de prueba o usuarios controlados por rol.
- Datos de prueba en `requests`, `auditoria.logs`, `documents`, `audit_documents` y `notifications`.

## 5. Protocolos PQ
| ID | Modulo | Escenario de uso real | Volumen o repeticion | Pasos de ejecucion | Evidencia esperada | Criterio de aceptacion | Resultado | Estado |
|---|---|---|---|---|---|---|---|---|
| PQP-GSC-001 | auth | Consultas repetidas de perfil | 20 llamadas secuenciales a `/api/v1/auth/me` | 1. Ejecutar las 20 consultas con el mismo token. | Respuestas consistentes. | No debe haber side effects de asistencia desde `/auth/me`. | ______ | ______ |
| PQP-GSC-002 | auth | Renovacion continua de sesion | 10 refresh encadenados con el ultimo refresh valido | 1. Ejecutar refresh sucesivos. | Renovacion estable. | No debe aceptar refresh token viejo o invalido. | ______ | ______ |
| PQP-GSC-003 | auth | Login repetido mismo dia | 3 inicios de sesion del mismo usuario en el mismo dia | 1. Realizar 3 logins controlados. | Sesion creada y trazabilidad consistente. | No debe duplicar indebidamente clock-in diario. | ______ | ______ |
| PQP-GSC-004 | security | Revision operativa de eventos off-hours | 10 consultas + 3 revisiones + 1 export | 1. Consultar. 2. Revisar. 3. Exportar. | Cola, revision y export operativos. | Respuesta estable y saneada. | ______ | ______ |
| PQP-GSC-005 | auditoria | Explotacion de bitacora | 5 listados filtrados + 20 detalles + 1 export | 1. Ejecutar secuencia completa. | Auditoria consistente. | Sin errores de paginacion ni export. | ______ | ______ |
| PQP-GSC-006 | audit-prep | Carga sostenida documental | 5 cargas validas en secciones diferentes | 1. Cargar archivos consecutivos. 2. Consultar documentos. | Persistencia y consulta estables. | Todos los documentos deben quedar registrados y recuperables. | ______ | ______ |
| PQP-GSC-007 | audit-prep | Gestion de accesos temporales | 2 altas + 2 revocaciones + 1 intento extra | 1. Crear dos accesos. 2. Intentar un tercero. 3. Revocar. | Regla de maximo 2 activa. | El exceso debe rechazarse sin corromper estado. | ______ | ______ |
| PQP-GSC-008 | approvals | Cola de aprobaciones bajo uso operativo | 10 consultas y 6 decisiones | 1. Consultar pendientes desde roles autorizados. 2. Ejecutar decisiones. | Cola y decisiones estables. | Registrar si la cola muestra mas universo del esperado. | ______ | ______ |
| PQP-GSC-009 | management | Dashboard y trazabilidad gerencial | 10 consultas `stats`, 10 `requests`, 5 `trace`, 5 `documents` | 1. Ejecutar las consultas en secuencia. | Respuesta funcional sostenida. | Registrar diferencias entre lote devuelto y total real. | ______ | ______ |
| PQP-GSC-010 | signature | Verificacion publica repetida | 10 consultas sobre token valido | 1. Invocar el token repetidamente. | Respuesta estable y tracking coherente. | El modulo no debe degradarse ni devolver errores intermitentes. | ______ | ______ |
| PQP-GSC-011 | signature | Firma repetida en entorno controlado | 3 firmas validas sobre documentos preparados | 1. Ejecutar firma. 2. Consultar dashboard y trail. | Persistencia consistente de hash, firma, sello y QR. | Aprobado solo si existen dependencias SQL requeridas. | ______ | ______ |
| PQP-GSC-012 | area | Trazabilidad integral del area | Login off-hours + revision TI + consulta auditoria + consulta gerencial | 1. Generar evento. 2. Revisarlo. 3. Buscarlo en auditoria y management. | Trazabilidad cruzada verificable. | Debe poder seguirse el evento a traves de modulos relacionados. | ______ | ______ |

## 6. Criterio global de aceptacion PQ
- Aprobado: el area mantiene operacion estable en los flujos representativos sin degradacion funcional critica.
- Aprobado con desviaciones: hay hallazgos residuales documentados pero el servicio se mantiene usable y trazable.
- Rechazado: existe degradacion severa de autenticacion, seguridad, trazabilidad o firma bajo uso repetido.

## 7. Resultado final PQ
| Campo | Valor |
|---|---|
| Estado global PQ | __________________ |
| Total ejecutado | __________________ |
| Total aprobado | __________________ |
| Total con desviacion | __________________ |
| Total rechazado | __________________ |
| Aprobacion final | __________________ |
