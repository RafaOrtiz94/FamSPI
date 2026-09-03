# Calificacion de Instalacion (IQ)

## Objetivo IQ
Verificar instalacion y configuracion de FamSPI v1.0.0 para ejecucion de pruebas y operacion controlada.

## Alcance IQ
Ambiente, version, frontend/backend, base de datos, variables logicas, migraciones, usuarios/roles base, logs, respaldo/recuperacion, contingencia.

| ID IQ | Verificacion | Resultado | Evidencia | Estado |
|---|---|---|---|---|
| IQ-01 | Ambiente validado | Entorno local de auditoria identificado; entorno productivo no auditado | Corridas locales backend | Parcial |
| IQ-02 | Version | `backend` en `1.0.0` | `backend/package.json` | Aceptado |
| IQ-03 | Frontend/backend | Backend probado; frontend no ejecutado en esta corrida | `npm test` backend | Parcial |
| IQ-04 | Base de datos | Sin prueba de DB real en entorno validado | N/A | No ejecutado |
| IQ-05 | Commit/tag/release | Commit identificado `e0792ab`; sin tag en HEAD | `git rev-parse`, `git tag --points-at HEAD` | Parcial |
| IQ-06 | Variables logicas sin secretos | Variables identificadas y documentadas | `rg process.env` | Aceptado |
| IQ-07 | Migraciones | Migraciones presentes en repo; no ejecutadas en esta auditoria | `backend/migrations` | Parcial |
| IQ-08 | Usuarios base | No evidenciado | N/A | No ejecutado |
| IQ-09 | Roles base | Definidos en middleware; asignacion real no auditada | `roles.js` | Parcial |
| IQ-10 | Logs/auditoria | Middleware de auditoria disponible | `auditMiddleware.js` | Aceptado con observacion |
| IQ-11 | Respaldo/recuperacion | No evidenciado en esta corrida | N/A | No ejecutado |
| IQ-12 | Rollback/contingencia | No evidenciado en esta corrida | N/A | No ejecutado |

## Desviaciones
Pendientes IQ-04, IQ-08, IQ-11, IQ-12 por falta de ejecucion en entorno controlado con evidencia operativa.

## Conclusion IQ
IQ parcial: existe evidencia objetiva de configuracion logica y versionado, pendiente cierre de ambiente validado integral.
