# README — Validación General FamSPI v1.0.0

Expediente documental alineado con WHO TRS 1019 Annex 3, Appendix 5 (Validation of computerized systems), adaptado a FamSPI v1.0.0.

---

## Estado del expediente

| Estado | Detalle |
|---|---|
| Áreas validadas | Área 01 (Gobierno/Seguridad) y Área 02 (Personas/TH) — DQ/IQ/OQ/PQ conforme |
| Áreas en construcción | Áreas 03-06 — módulos funcionales, documentación actualizada, OQ/PQ pendiente |
| Última actualización documental | 2026-06-19 |

---

## Índice de documentos

| Capítulo | Archivo | Descripción |
|---|---|---|
| 00 | `00_README_VALIDACION_FAMSPI_V1_0_0.md` | Este índice (informativo) |
| 01 | `01_control_documental_autorizacion.md` | Control documental y firmas de autorización |
| 02 | `02_introduccion_alcance.md` | Introducción al sistema y alcance de la validación |
| 03 | `03_glosario_abreviaturas.md` | Glosario y abreviaturas |
| 04 | `04_protocolo_maestro_validacion_reportes.md` | Protocolo maestro de validación |
| 05 | `05_gestion_proveedor_desarrollo_interno.md` | Modelo de desarrollo y responsabilidades |
| 06 | `06_especificacion_requerimientos_urs.md` | Metodología URS y requerimientos transversales |
| 07 | `07_especificacion_diseno_configuracion.md` | Arquitectura, módulos y variables de configuración |
| 07A | `07A_evaluacion_riesgos_fmea.md` | Evaluación de riesgos y análisis FMEA |
| 08 | `08_calificacion_diseno_dq.md` | Calificación de Diseño (DQ) |
| 09 | `09_desarrollo_implementacion_sistema.md` | Desarrollo e implementación del sistema |
| 09A | `09A_migracion_datos.md` | Migración de datos (no aplica — primera instalación) |
| 10 | `10_calificacion_instalacion_iq.md` | Calificación de Instalación (IQ) |
| 11 | `11_calificacion_operacional_oq.md` | Calificación Operacional (OQ) |
| 12 | `12_procedimientos_administracion_entrenamiento.md` | SOPs de administración y entrenamiento |
| 13 | `13_calificacion_desempeno_pq_uat.md` | Calificación de Desempeño (PQ/UAT) |
| 14 | `14_operacion_mantenimiento_estado_validado.md` | Operación y mantenimiento en estado validado |
| 14A | `14A_control_cambios.md` | Proceso de control de cambios post-validación |
| 14B | `14B_revision_periodica.md` | Revisiones periódicas del sistema |
| 15 | `15_retiro_archivo_retencion.md` | Retiro, archivo y retención documental |
| 16 | `16_famsign_hallazgos_validacion_estatica.md` | Hallazgos de validación estática módulo FamSign — 100 escenarios, 20 hallazgos, 15 corregidos (2026-06-19) |

---

## Documentos URS por módulo (`docs/validation/URS/`)

| Módulo | Archivo | Estado |
|---|---|---|
| Autenticación y Sesiones | `URS_modulo_autenticacion_sesiones.md` | Completo |
| Usuarios y Perfiles | `URS_modulo_usuarios_perfiles.md` | Completo |
| Talento Humano | `URS_modulo_talento_humano.md` | Completo |
| Comercial y Clientes | `URS_modulo_comercial_clientes.md` | v2.0 (2026-06) |
| Business Case | `URS_modulo_business_case.md` | En revisión |
| Finanzas y Viáticos | `URS_modulo_finanzas_viaticos.md` | v2.0 (2026-06) |
| Servicio Técnico | `URS_modulo_servicio_tecnico_mantenimientos.md` | v2.0 (2026-06) |
| Documentos y Firma | `URS_modulo_documentos_firma.md` | v2.0 (2026-06) |
| Notificaciones | `URS_modulo_notificaciones_comunicaciones.md` | Completo |
| Reportes y Auditoría | `URS_modulo_reportes_auditoria.md` | v2.0 (2026-06) |
| TI Soporte y Tickets | `URS_modulo_ti_soporte_tickets.md` | v2.0 (2026-06) |
| Inventario y Equipos | `URS_modulo_inventario_equipos.md` | v2.0 (2026-06) |

Los documentos FRS y DS correspondientes se encuentran en `docs/validation/FRS/` y `docs/validation/DS/` con el mismo estado.

---

## Documentos por área (`docs/validation/areas/`)

| Área | Directorio | Estado |
|---|---|---|
| Área 01 — Gobierno, Seguridad y Acceso | `area_01_gobierno_seguridad/` | Completo — DQ/IQ/OQ/PQ conforme |
| Área 02 — Personas y Talento Humano | `area_02_personas_talento_humano/` | Completo — DQ/IQ/OQ/PQ conforme |
| Área 03 — Comercial y Business Case | `area_03_comercial_business_case/` | URS completa (80 REQ); FRS/DS/IQ/OQ/PQ pendientes |
| Área 04 — Servicio Técnico y Operaciones | `area_04_servicio_tecnico/` | Pendiente de creación completa |
| Área 05 — Compras, Inventario y Logística | `area_05_compras_inventario/` | Pendiente de creación |
| Área 06 — Finanzas y TI | `area_06_finanzas_ti/` | Pendiente de creación |

---

## Trazabilidad (RTM)

El documento de trazabilidad del sistema se encuentra en:
`docs/validation/RTM/RTM_sistema_spi.md`

---

*Este archivo es informativo y no se consolida al expediente formal de validación.*
