# Especificación de Requerimientos del Usuario (URS)

**Sistema:** FamSPI  
**Versión:** 1.0  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5, Sección 6

---

## 1. Objetivo

Describir la metodología de especificación de requerimientos de usuario aplicada en FamSPI, la estructura de los documentos URS por módulo y área, los criterios de trazabilidad que conectan los requerimientos con la especificación funcional (FRS) y el diseño (DS), y los requerimientos transversales del sistema.

---

## 2. Estructura de los documentos URS en FamSPI

Cada módulo del sistema tiene un documento URS propio ubicado en `docs/validation/URS/`. Cada área de validación tiene su URS en `docs/validation/areas/area_XX_*/01_URS_requerimientos_usuario.md`.

La estructura estándar de cada documento URS es:

| Sección | Contenido |
|---|---|
| 1. Introducción | Contexto del módulo, por qué existe, marco regulatorio |
| 2. Objetivo | Qué define este documento |
| 3. Alcance | Qué incluye y qué excluye explícitamente |
| 4. Actores | Tabla de actores, su rol en el sistema y sus acciones principales |
| 5. Justificación | Por qué el módulo existe en términos de negocio |
| 6. Requerimientos funcionales | `REQ-XXX-NNN` con actor, enunciado, resultado esperado y criticidad |
| 7. Requerimientos no funcionales | `RNF-XXX-NNN` con descripción del control no funcional |
| 8. Reglas de negocio | Reglas derivadas del código real del sistema |
| 9. Dependencias | Relación con otros módulos del sistema |
| 10. Conclusión | Síntesis del propósito del módulo |

---

## 3. Convención de identificadores de requerimientos

Los prefijos de requerimientos siguen la convención:

| Módulo | Prefijo URS | Prefijo FRS |
|---|---|---|
| Autenticación y Sesiones | `REQ-AUTH-` | `FRS-AUTH-` |
| Usuarios y Perfiles | `REQ-USR-` | `FRS-USR-` |
| Talento Humano | `REQ-TH-` | `FRS-TH-` |
| Comercial y Clientes | `REQ-COM-` | `FRS-COM-` |
| Business Case | `REQ-BC-` | `FRS-BC-` |
| Finanzas y Viáticos | `REQ-VT-` | `FRS-VT-` |
| Servicio Técnico | `REQ-SRV-` | `FRS-SRV-` |
| Documentos y Firma | `REQ-DOC-` | `FRS-DOC-` |
| Notificaciones | `REQ-NOT-` | `FRS-NTF-` |
| Reportes y Auditoría | `REQ-RPT-` | `FRS-RPT-` |
| TI Soporte y Tickets | `REQ-TI-` | `FRS-TI-` |
| Inventario y Equipos | `REQ-INV-` | `FRS-INV-` |
| Área 01 (Gobierno) | `REQ-GD-` | — |
| Área 02 (Personas) | `REQ-TH-`, `REQ-RRHH-` | — |
| Área 03 (Comercial) | `REQ-COM-` | — |

---

## 4. Requerimientos transversales del sistema

Los siguientes requerimientos aplican a todo el sistema FamSPI, independientemente del módulo:

| ID | Categoría | Enunciado | Criterio de aceptación | Estado |
|---|---|---|---|---|
| URS-S-001 | Seguridad | FamSPI debe exigir autenticación para todas las rutas privadas | Acceso denegado sin JWT válido (HTTP 401) | Implementado |
| URS-S-002 | Seguridad | FamSPI debe restringir acciones según rol o permiso del usuario | Acción no autorizada rechazada (HTTP 403) | Implementado |
| URS-T-001 | Trazabilidad | FamSPI debe registrar todas las acciones críticas en bitácora de auditoría | Trail auditable en `auditoria.logs` con actor, módulo, acción y timestamp | Implementado |
| URS-NF-001 | No funcional | FamSPI debe operar en entorno identificado, documentado y controlado | Entorno documentado en IQ con versiones verificadas | Parcial |
| URS-E-001 | Evidencia | FamSPI debe generar evidencia objetiva de pruebas críticas | Evidencia referenciada con ID único por caso | En construcción |
| URS-CC-001 | Control de cambios | FamSPI debe aplicar control formal de cambios tras el estado validado | Cambio registrado con impacto evaluado, aprobación y validación proporcional | Definido (ver capítulo 14A) |
| URS-F-001 | Funcional | FamSPI debe permitir registrar solicitudes de permisos y vacaciones válidas | Solicitud creada con estado inicial correcto en DB | Implementado (Área 02 OQ conforme) |
| URS-F-002 | Funcional | FamSPI debe permitir el flujo completo de aprobación/rechazo de solicitudes | Decisión persiste con trazabilidad del aprobador | Implementado (Área 02 OQ conforme) |

---

## 5. Ciclo de vida de un requerimiento

```
URS (necesidad del usuario)
  ↓
FRS (cómo el sistema lo implementa)
  ↓
DS (cómo está diseñado técnicamente)
  ↓
IQ (está instalado como se diseñó)
  ↓
OQ (opera como se especificó)
  ↓
PQ (rinde de forma consistente en producción)
```

El documento RTM (`RTM/RTM_sistema_spi.md`) traza cada requerimiento URS a su especificación FRS y a los archivos de implementación correspondientes.

---

## 6. Criterios de calidad de un requerimiento URS

Un requerimiento URS en FamSPI es válido cuando cumple:

| Criterio | Descripción |
|---|---|
| Verificable | Puede comprobarse mediante prueba funcional o inspección del código |
| Específico | Describe una capacidad concreta del sistema, no una generalidad |
| Trazable | Tiene ID único y puede vincularse a una especificación FRS |
| Completo | Incluye actor, enunciado y resultado esperado mínimamente |
| Coherente | No contradice otros requerimientos del mismo módulo o del sistema |

---

## 7. Estado actual de la documentación URS por módulo

| Módulo | Documento | Versión | Estado |
|---|---|---|---|
| Autenticación y Sesiones | URS_modulo_autenticacion_sesiones.md | 1.x | Completo |
| Usuarios y Perfiles | URS_modulo_usuarios_perfiles.md | 1.x | Completo |
| Talento Humano | URS_modulo_talento_humano.md | 1.x | Completo |
| Comercial y Clientes | URS_modulo_comercial_clientes.md | 2.0 | En revisión |
| Business Case | URS_modulo_business_case.md | 1.x | En revisión |
| Finanzas y Viáticos | URS_modulo_finanzas_viaticos.md | 2.0 | Actualizado |
| Servicio Técnico | URS_modulo_servicio_tecnico_mantenimientos.md | 2.0 | En revisión |
| Documentos y Firma | URS_modulo_documentos_firma.md | 2.0 | En revisión |
| Notificaciones | URS_modulo_notificaciones_comunicaciones.md | 1.x | Completo |
| Reportes y Auditoría | URS_modulo_reportes_auditoria.md | 2.0 | Actualizado |
| TI Soporte y Tickets | URS_modulo_ti_soporte_tickets.md | 2.0 | En revisión |
| Inventario y Equipos | URS_modulo_inventario_equipos.md | 2.0 | En revisión |
