# Calificación de Desempeño (PQ/UAT)

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 13

---

## 1. Objetivo

Confirmar que FamSPI v1.0.0 rinde de forma consistente y aceptable en condiciones representativas de uso real, mediante escenarios de aceptación ejecutados por usuarios funcionales designados.

---

## 2. Estado de ejecución por área

| Área | Nombre | Estado PQ/UAT | Fecha ejecución |
|---|---|---|---|
| Área 01 | Gobierno, Seguridad y Acceso | **Conforme** | 2026-05-13 |
| Área 02 | Personas y Talento Humano | **Conforme** | 2026-05-13 |
| Área 03 | Comercial y Business Case | Pendiente | — |
| Área 04 | Servicio Técnico y Operaciones | Pendiente | — |
| Área 05 | Compras, Inventario y Logística | Pendiente | — |
| Área 06 | Finanzas y TI | Pendiente | — |

Los protocolos PQ/UAT completos de cada área se encuentran en sus respectivos directorios bajo `docs/validation/areas/`.

---

## 3. Escenarios PQ/UAT — Área 01 y Área 02 (Ejecutados)

| ID | Escenario | Participantes | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| PQ-001 | Permiso punta a punta — solicitante envía, aprobador decide | Solicitante + aprobador | Flujo completo y trazable; estado final correcto | Conforme — flujo ejecutado sin errores | Conforme |
| PQ-002 | Vacaciones punta a punta — solicitante envía, aprobador decide | Solicitante + aprobador | Flujo completo y trazable; estado final correcto | Conforme — flujo ejecutado sin errores | Conforme |
| PQ-003 | Aprobación y rechazo por responsable funcional | Responsable funcional | Decisión coherente registrada con motivo | Conforme — ambas transiciones funcionaron | Conforme |
| PQ-004 | Consulta posterior de evidencia de solicitudes | TI + funcional | Historial recuperable con filtros correctos | Conforme — endpoint de historial funciona | Conforme |
| PQ-005 | Aceptación funcional del módulo por usuario clave | Responsable funcional + Gerencia | Conformidad con el uso previsto del módulo | Conforme — aceptación registrada | Conforme |

**Evidencia de referencia:** `docs/validation/areas/area_01_*/` y `docs/validation/areas/area_02_*/`

---

## 4. Escenarios PQ/UAT — Pendientes (Áreas 03–06)

Los siguientes escenarios deben ejecutarse por área correspondiente cuando se complete la documentación de IQ/OQ:

### Área 03 — Comercial y Business Case

| ID | Escenario | Participantes |
|---|---|---|
| PQ-006 | Business Case completo de oportunidad a cierre | Comercial + Gerencia |
| PQ-007 | Asignación de cliente y registro de visita | Comercial + Administrador |
| PQ-008 | Aceptación funcional del módulo comercial | Jefe Comercial + Gerencia |

### Área 04 — Servicio Técnico y Operaciones

| ID | Escenario | Participantes |
|---|---|---|
| PQ-009 | Capacitación punta a punta (planificación → certificado) | TH + Instructor + Técnico |
| PQ-010 | Orden de mantenimiento preventivo completa | Técnico + Supervisor |
| PQ-011 | Proyecto externo con hitos GoApp | Técnico + Cliente externo |
| PQ-012 | Aceptación funcional del módulo servicio técnico | Jefe Técnico + Gerencia |

### Área 05 — Compras, Inventario y Logística

| ID | Escenario | Participantes |
|---|---|---|
| PQ-013 | Alta, asignación y baja de activo TI | TI + Usuario receptor |
| PQ-014 | Ticket de soporte de creación a cierre | Usuario + Técnico TI |
| PQ-015 | Aceptación funcional del módulo inventario/TI | Jefe TI + Gerencia |

### Área 06 — Finanzas y TI

| ID | Escenario | Participantes |
|---|---|---|
| PQ-016 | Viático punta a punta — borrador → revisión → pago | Solicitante + Jefe + Finanzas |
| PQ-017 | Categorización de facturas y exportación ATS/XML | Finanzas |
| PQ-018 | Aceptación funcional del módulo finanzas/viáticos | Jefe Finanzas + Gerencia |

---

## 5. Criterio de aceptación PQ/UAT

Para declarar la PQ/UAT de un área como conforme:

| Criterio | Descripción |
|---|---|
| Todos los escenarios ejecutados | No quedan escenarios en estado "no ejecutado" |
| Sin desviaciones críticas abiertas | Si existen desviaciones, son de severidad menor o tienen justificación aceptada |
| Acta de aceptación firmada | El responsable funcional y un representante de gerencia firman el acta |
| Evidencia objetiva generada | Capturas de pantalla, registros de BD o logs adjuntos a la evidencia del escenario |

---

## 6. Conclusión PQ/UAT

**PQ/UAT Áreas 01 y 02: CONFORME.** Los escenarios de flujo completo de permisos, vacaciones y aceptación funcional por parte de usuarios clave resultaron conformes. El sistema opera de manera consistente y aceptable para el alcance de estas áreas.

**PQ/UAT Áreas 03 a 06: Pendiente de ejecución.** Los escenarios de estas áreas deben planificarse con usuarios funcionales designados y ejecutarse en entorno productivo con datos reales antes de declarar el cierre del proceso de validación completo.
