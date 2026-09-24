# Implementacion IQ

Documento vigente de calificacion de instalacion e implementacion de FamSPI.

Fecha de emision: `16 de julio de 2026`

## 1. Objetivo

Verificar que el entorno, los componentes, la configuracion y las dependencias necesarias para FamSPI esten correctamente instaladas e identificadas antes de ejecutar pruebas funcionales controladas.

## 2. Alcance IQ

IQ aplica sobre:

- backend desplegado,
- frontend desplegado,
- base de datos y schemas en uso,
- variables de entorno y secretos,
- rutas publicas y privadas activas,
- jobs internos,
- integraciones externas requeridas para el alcance validado,
- controles de acceso base y usuarios de prueba.

## 3. Evidencia minima requerida

- version de backend y frontend validados,
- commit o release bajo validacion,
- endpoints montados en backend,
- URL y rutas vigentes de frontend,
- evidencia de despliegue e infraestructura utilizada,
- inventario de variables logicas sin exponer secretos,
- evidencia de conectividad y consistencia de base de datos,
- respaldo previo o estrategia de rollback documentada.

## 4. Checklist IQ maestro 2026

| ID | Verificacion | Evidencia minima | Estado esperado |
|---|---|---|---|
| IQ-01 | Version del backend identificada | `backend/package.json` + commit | Conforme |
| IQ-02 | Version del frontend identificada | `spi_front/package.json` + commit | Conforme |
| IQ-03 | Rutas backend montadas segun alcance | `registerRoutes.js` | Conforme |
| IQ-04 | Rutas frontend privadas y publicas segun alcance | `AppRoutes.jsx` | Conforme |
| IQ-05 | Base de datos accesible y coherente con el sistema | esquema real + tablas criticas | Conforme |
| IQ-06 | Variables logicas y dependencias externas documentadas | inventario de `process.env` y servicios | Conforme |
| IQ-07 | Integraciones activas identificadas | Gmail, CRM webhook, Drive, firma, jobs | Conforme |
| IQ-08 | Usuarios y roles de prueba definidos | matriz de prueba | Conforme |
| IQ-09 | Trazabilidad tecnica disponible | logs, auditoria, colas o workers | Conforme |
| IQ-10 | Mecanismo de recuperacion o rollback documentado | procedimiento operativo | Conforme |

## 5. Modulos que requieren especial atencion en IQ

- `business-case`
- `private-purchases`
- `servicio`
- `ti-assets`
- `collab-deliveries`
- `signature-workflows`
- `crm-fam`
- `work-management`
- `world-cup-2026` solo si se incluye en alcance

## 6. Criterios de implementacion correcta

Se considera que IQ esta en condicion de conformidad cuando:

- el entorno bajo validacion es identificable y repetible,
- las rutas y pantallas del alcance responden desde la version correcta,
- los componentes base del sistema estan presentes,
- no existen dependencias criticas sin documentar,
- las brechas tecnicas abiertas quedan registradas como desviaciones.

## 7. Desviaciones tipicas a registrar

- entorno productivo sin staging equivalente,
- rutas vigentes no documentadas en URS/FRS/DS,
- tablas o columnas reales no reflejadas en documentos,
- integraciones activas sin evidencia de configuracion,
- jobs en ejecucion sin protocolo de verificacion.

## 8. Entregables de salida de IQ

- lista de componentes instalados y verificados,
- matriz de evidencias tecnicas,
- lista de desviaciones IQ abiertas,
- autorizacion de paso a OQ por alcance.

## 9. Conclusion operativa

IQ ya no debe tratarse como una simple verificacion de presencia de archivos. En FamSPI 2026 debe actuar como validacion de implementacion real del ecosistema desplegado y de sus dependencias activas.
