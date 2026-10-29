# Calificación Operacional (OQ)

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 11

---

## 1. Objetivo

Confirmar que FamSPI v1.0.0 opera conforme a sus especificaciones funcionales (FRS) en condiciones de uso real, mediante la ejecución controlada de casos de prueba críticos por área.

---

## 2. Estado de ejecución por área

| Área | Nombre | Estado OQ | Fecha ejecución |
|---|---|---|---|
| Área 01 | Gobierno, Seguridad y Acceso | **Conforme** | 2026-05-13 |
| Área 02 | Personas y Talento Humano | **Conforme** | 2026-05-13 |
| Área 03 | Comercial y Business Case | Pendiente | — |
| Área 04 | Servicio Técnico y Operaciones | Pendiente | — |
| Área 05 | Compras, Inventario y Logística | Pendiente | — |
| Área 06 | Finanzas y TI | Pendiente | — |

Los protocolos OQ completos de cada área se encuentran en sus respectivos directorios bajo `docs/validation/areas/`.

---

## 3. Casos críticos OQ — Área 01 (Gobierno, Seguridad y Acceso)

| ID | Objetivo | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| OQ-001 | Login correcto con cuenta autorizada | Acceso autorizado con JWT válido | Conforme — sesión establecida correctamente | Conforme |
| OQ-002 | Login fallido con cuenta inválida | Denegación controlada (HTTP 401) | Conforme — error estructurado retornado | Conforme |
| OQ-003 | Acceso sin sesión activa | Bloqueo con HTTP 401 | Conforme — middleware rechaza sin token | Conforme |
| OQ-004 | Acceso con rol no autorizado para la ruta | Denegación de acción (HTTP 403) | Conforme — `requireRole` rechaza correctamente | Conforme |
| OQ-005 | Acceso con rol correcto | Operación permitida | Conforme — acción ejecutada con éxito | Conforme |
| OQ-006 | Trazabilidad de acción en bitácora | Registro en `auditoria.logs` con actor y timestamp | Conforme — `auditMiddleware` persiste el trail | Conforme |

**Evidencia de referencia:** Protocolos OQ del Área 01 en `docs/validation/areas/area_01_gobierno_seguridad/`

---

## 4. Casos críticos OQ — Área 02 (Personas y Talento Humano)

| ID | Objetivo | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| OQ-007 | Crear solicitud de permiso válida | Solicitud creada en DB con estado inicial correcto | Conforme — registro persistido | Conforme |
| OQ-008 | Crear solicitud de vacaciones válida | Solicitud creada con estado inicial correcto | Conforme — registro persistido | Conforme |
| OQ-009 | Enviar solicitud con datos incompletos | Error controlado (HTTP 4xx) con mensaje descriptivo | Conforme — validación de servicio actúa | Conforme |
| OQ-010 | Aprobador aprueba solicitud pendiente | Estado cambia a "aprobado" con trazabilidad del aprobador | Conforme — estado actualizado y trail generado | Conforme |
| OQ-011 | Aprobador rechaza solicitud pendiente | Estado cambia a "rechazado" con motivo registrado | Conforme — estado actualizado y trail generado | Conforme |
| OQ-012 | Verificar trazabilidad de cambio de estado | Trail en bitácora coherente con el actor y la acción | Conforme — `auditMiddleware` opera en módulo TH | Conforme |
| OQ-013 | Consulta histórica de solicitudes del usuario | Registros recuperables con filtros correctos | Conforme — endpoint de listado funciona | Conforme |
| OQ-014 | Acción no permitida para solicitante (ej. auto-aprobar) | Bloqueo con HTTP 403 | Conforme — guard de servicio rechaza | Conforme |

**Evidencia de referencia:** Protocolos OQ del Área 02 en `docs/validation/areas/area_02_personas_talento_humano/`

---

## 5. Casos críticos OQ — Pendientes (Áreas 03–06)

Los siguientes casos deben ejecutarse cuando se complete la documentación y preparación de cada área:

| Área | Casos pendientes |
|---|---|
| Área 03 | Flujo completo de Business Case (borrador → activo → cerrado), asignaciones de clientes |
| Área 03 | Creación y modificación de oportunidades comerciales |
| Área 04 | Flujo de Capacitaciones (planificación → ejecución → certificado) |
| Área 04 | Flujo de Mantenimiento preventivo y correctivo |
| Área 04 | Flujo de Proyectos externos (hitos, GoApp) |
| Área 05 | Gestión de activos TI (alta, asignación, baja, depreciación) |
| Área 05 | Tickets de soporte (creación, asignación, resolución) |
| Área 06 | Flujo completo de viáticos (borrador → revisión financiera → pago) |
| Área 06 | Categorización de facturas y exportación ATS/XML |

---

## 6. Resultado de pruebas automatizadas de soporte

Las pruebas automatizadas del backend sirven como evidencia complementaria a la ejecución manual de OQ:

| Ejecución | Fecha | Resultado global | Suites en alcance OQ | Estado |
|---|---|---|---|---|
| npm test -- --runInBand | 2026-05-13 | 21 suites (16 pass / 5 fail), 76/100 pass | Módulos auth y TH conformes | Conforme para alcance |

Las 5 suites fallidas corresponden a módulos fuera del alcance de OQ de Área 01 y 02.

---

## 7. Conclusión OQ

**OQ Área 01 y Área 02: CONFORME.** Los casos críticos de autenticación, autorización, trazabilidad y flujos de permisos/vacaciones fueron ejecutados y resultaron conformes.

**OQ Áreas 03 a 06: Pendiente de ejecución.** Los casos de prueba para estas áreas deben planificarse y ejecutarse antes de declarar la calificación operacional completa del sistema.
