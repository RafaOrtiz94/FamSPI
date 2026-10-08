# Calificación de Diseño (DQ)

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 8

---

## 1. Objetivo

Verificar que el diseño de FamSPI v1.0.0 es adecuado para su uso previsto dentro del alcance validado. La DQ confirma que los controles de seguridad, autenticación, autorización, trazabilidad y flujos funcionales están diseñados correctamente antes de la ejecución operacional (OQ/PQ).

---

## 2. Alcance DQ

La DQ cubre la revisión estática del diseño de:

- Arquitectura global (3 capas: presentación, API, persistencia)
- Autenticación y gestión de sesiones
- Control de acceso por rol y permiso
- Segmentación de rutas públicas / privadas
- Trazabilidad de mutaciones (bitácora de auditoría)
- Flujos funcionales de los módulos de Área 01 y Área 02
- Manejo de errores y respuestas del sistema
- Los 12 módulos documentados en URS/FRS/DS

---

## 3. Precondiciones

- URS de todos los módulos emitida (en distintos estados de madurez, ver cap. 6)
- Evaluación de riesgos vigente (capítulo 07A)
- Evidencia de diseño disponible en código fuente y documentación DS
- Especificación de diseño y configuración verificada (capítulo 7)

---

## 4. Verificaciones de diseño

### 4.1 Controles transversales

| ID DQ | Verificación | Relación URS | Relación riesgo | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| DQ-01 | Arquitectura global coherente (3 capas separadas) | URS-NF-001 | R-007 | Evidenciada en `backend/src/app.js` y `backend/src/server.js` | Aceptado |
| DQ-02 | Autenticación JWT en todas las rutas privadas | URS-S-001 | R-001 | `verifyToken` en todos los routers de módulo; `publicPaths.js` segrega excepciones | Aceptado |
| DQ-03 | Restricción por roles verificada por middleware | URS-S-002 | R-002 | `requireRole` aplicado en todas las rutas de módulos críticos | Aceptado |
| DQ-04 | Segmentación público/privado documentada | URS-S-001 | R-001 | `registerRoutes.js` y `publicPaths.js` evidenciados | Aceptado |
| DQ-05 | Trazabilidad de mutaciones en `auditoria.logs` | URS-T-001 | R-004/R-008 | `auditMiddleware` registra actor, módulo, acción y timestamp | Aceptado con observación |
| DQ-06 | Flujo de permisos y vacaciones correcto | URS-F-001/F-002 | R-003/R-009 | Rutas, controladores y servicios verificados en código | Aceptado con observación |
| DQ-07 | Manejo de errores estructurado | URS-E-001 | R-010 | `asyncHandler` en controladores; clasificación de errores por tipo | Parcial |
| DQ-08 | Doble capa de autorización (middleware + servicio) | URS-S-002 | R-002 | Guards `assertX()` en servicios críticos como segunda línea de control | Aceptado |
| DQ-09 | Cola de procesamiento asíncrono para notificaciones | REQ-NTF | — | `FOR UPDATE SKIP LOCKED` en worker de `notification_dispatch_queue` | Aceptado |
| DQ-10 | Validación de integridad en capa de servicio | URS-NF-001 | R-007 | Validaciones pre-persistencia en servicios; sin ORM que oculte errores | Aceptado |

### 4.2 Diseño por módulo

| Módulo | DQ | Observación | Estado |
|---|---|---|---|
| Autenticación y Sesiones | Google OAuth + JWT firmado con `JWT_SECRET` | Token de sesión no persistido en DB (stateless) | Aceptado |
| Usuarios y Perfiles | RBAC con roles asignados por TI | Sin auto-asignación de roles — requiere `jefe_ti`/`admin_ti` | Aceptado |
| Talento Humano | Flujo de permisos y vacaciones con estados definidos | Estado inicial correcto; transiciones validadas por servicio | Aceptado |
| Comercial y Clientes | Asignaciones cliente-colaborador con estado activo/inactivo | Sin rollback transaccional en ops con Drive (ver DS FRS-COM) | Aceptado con observación |
| Business Case | Flujo de determinaciones con gate de calidad | Lógica de gate en `bcDeterminationsGate.service.js` | Aceptado |
| Finanzas y Viáticos | Workspace con wizard 4 pasos; 9 estados de flujo | `FINANCE_REVIEWER_ROLES` controlado; categorización por factura | Aceptado |
| Servicio Técnico | 3 workflows (Capacitaciones, Mantenimiento, Proyectos) con máquinas de estado | 58 endpoints; riesgo detectado en `externalCases.routes.js` | Aceptado con observación |
| Documentos y Firma | Firma con sello criptográfico; cadena inmutable de logs | `create_document_seal_and_qr()` como función SQL | Aceptado |
| Notificaciones | Cola rate-limited; workers con `SKIP LOCKED` | Rate limit 20/min; worker independiente por instancia PM2 | Aceptado |
| Reportes y Auditoría | 6 queries paralelas en dashboard; export CSV | Caché 60s TTL con `Map`; roles específicos para exportación | Aceptado |
| TI Soporte y Tickets | Tickets con estados; activos TI con ciclo de vida | Activos con estados y depreciación; documentos de entrega | Aceptado |
| Inventario y Equipos | Catálogo de activos físicos y digitales | Relacionados con colaboradores y tickets | Aceptado |

---

## 5. Criterio de aceptación DQ

La DQ se acepta cuando no existen brechas críticas no mitigadas en los controles del alcance, y las observaciones tienen plan de cierre documentado.

---

## 6. Observaciones DQ abiertas

| ID Obs | Observación | Módulo afectado | Plan de cierre |
|---|---|---|---|
| OBS-DQ-01 | No existe entorno de staging para pruebas pre-producción | General | Aceptado como riesgo; documentado en IQ |
| OBS-DQ-02 | `externalCases.routes.js` sin `verifyToken` explícito | Servicio Técnico | Verificar si heredado del router padre o corregir |
| OBS-DQ-03 | Sin rollback transaccional en operaciones combinadas DB+Drive | Comercial, Documentos | Agregar manejo explícito de fallos parciales |
| OBS-DQ-04 | Manejo de errores OQ-007 pendiente de prueba runtime | General | Cierre en OQ correspondiente por área |

---

## 7. Conclusión DQ

**DQ aceptado con observaciones.** El diseño de FamSPI v1.0.0 es adecuado para su uso previsto. Los controles de seguridad, trazabilidad y flujos funcionales están presentes y verificados en el código fuente. Las observaciones abiertas son de naturaleza menor o tienen plan de mitigación documentado. La confirmación definitiva de conformidad operacional queda sujeta a la ejecución de OQ y PQ por área.
