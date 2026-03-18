# PROTOCOLO DE EJECUCION PQ

## 1. Objetivo
Definir los escenarios de prueba para demostrar que el Area 02 mantiene estabilidad y consistencia en condiciones representativas de uso real.

## 2. Casos PQ
| ID | Modulo | Escenario | Resultado esperado |
|---|---|---|---|
| PQP-PT-001 | attendance | Uso diario repetido del widget de asistencia | No se generan inconsistencias de jornada |
| PQP-PT-002 | permisos y vacaciones | Consulta y actualizacion repetida de resumentes | Los indicadores permanecen consistentes |
| PQP-PT-003 | personnel-requests | Seguimiento prolongado de expediente de personal | Historial, perfil y documentos se conservan |
| PQP-PT-004 | collaborators y profile | Revision y actualizacion continua de perfil | El area mantiene datos recuperables y coherentes |
| PQP-PT-005 | reportes | Generacion reiterada de PDF de asistencia | El servicio responde para periodos operativos habituales |

## 3. Evidencias requeridas
- repeticion de casos
- consistencia de resultados entre ejecuciones
- ausencia de estados huerfanos o bloqueos
- estabilidad de datos visibles en UI y backend

## 4. Criterio de aceptacion
La PQ se aprueba cuando el area conserva comportamiento estable, repetible y trazable durante el uso operativo representativo.
