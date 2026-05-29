# Automatización de Generación de Documentos de Validación

## Descripción general

Este directorio contiene la plantilla institucional Word y los recursos de configuración del sistema de generación automatizada de paquetes de validación para FamSPI. Los scripts generan documentos DOCX profesionales a partir de archivos Markdown, usando Word COM (sin Pandoc).

## Variantes documentales disponibles

El repositorio mantiene **dos variantes documentales independientes** para la validación general de FamSPI v1.0.0. Ninguna reemplaza automáticamente a la otra. La organización decide cuál adoptar formalmente.

| Aspecto | Variante WHO | Variante GEON/OMCL Annex 2 |
|---|---|---|
| Marco metodológico | WHO TRS 1019 Annex 3, Appendix 5 | GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 |
| Carpeta fuente | `docs/validation/general` | `docs/validation/general_GEON` |
| Documentos | 20 archivos | 8 archivos principales |
| Salida DOCX | `PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0.docx` | `PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0_GEON_ANNEX2.docx` |
| Script | `generate_validation_general_docx.ps1` | `generate_validation_general_geon_docx.ps1` |
| Enfoque | Exhaustivo, normativo, marco general | Práctico, directo, sistemas computarizados complejos |

---

## Variante WHO — Comando de generación

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate_validation_general_docx.ps1 -Mode Final
```

**Salida esperada:**
`docs/validation/general/PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0.docx`

**Alcance validado:**
- FamSPI v1.0.0 como sistema computarizado institucional en su primera línea base validada.
- Gobierno y Seguridad como dimensión transversal de control.
- Permisos y Vacaciones como módulo funcional activo.

**Estructura documental WHO (20 archivos en orden):**
1. `01_control_documental_autorizacion.md`
2. `02_introduccion_alcance.md`
3. `03_glosario_abreviaturas.md`
4. `04_protocolo_maestro_validacion_reportes.md`
5. `05_gestion_proveedor_desarrollo_interno.md`
6. `06_especificacion_requerimientos_urs.md`
7. `07_especificacion_diseno_configuracion.md`
8. `07A_evaluacion_riesgos_fmea.md` *(nuevo — Risk Assessment/FMEA)*
9. `08_calificacion_diseno_dq.md`
10. `09_desarrollo_implementacion_sistema.md`
11. `09A_migracion_datos.md` *(nuevo — declaración de no migración)*
12. `10_calificacion_instalacion_iq.md`
13. `11_calificacion_operacional_oq.md`
14. `12_procedimientos_administracion_entrenamiento.md`
15. `13_calificacion_desempeno_pq_uat.md`
16. `14_operacion_mantenimiento_estado_validado.md`
17. `14A_control_cambios.md` *(nuevo — procedimiento formal)*
18. `14B_revision_periodica.md` *(nuevo — revisión periódica)*
19. `15_retiro_archivo_retencion.md`
20. `16_informe_final_validacion_liberacion.md`

---

## Variante GEON/OMCL Annex 2 — Comando de generación

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate_validation_general_geon_docx.ps1 -Mode Final
```

**Salida esperada:**
`docs/validation/general_GEON/PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0_GEON_ANNEX2.docx`

**Alcance validado:** idéntico a la variante WHO.

**Advertencia metodológica:** GEON/OMCL Annex 2 se adopta como referencia de buena práctica documental. FamProject no es un OMCL. No se declara cumplimiento GMP ni ISO/IEC 17025 integral.

**Estructura documental GEON (8 archivos en orden — excluye 00_README y 09_comparativo):**
1. `01_control_documental_autorizacion.md`
2. `02_introduccion_alcance.md`
3. `03_urs_requerimientos_usuario.md` *(URS + DQ integrado)*
4. `04_iq_calificacion_instalacion.md`
5. `05_oq_calificacion_operacional.md`
6. `06_pq_uat_calificacion_desempeno.md`
7. `07_informe_final_liberacion_uso.md`
8. `08_archivo_retencion_control_posterior.md`

**Archivos excluidos del DOCX principal GEON:**
- `00_README_VALIDACION_FAMSPI_GEON_ANNEX2.md` — orientativo de la carpeta
- `09_comparativo_who_vs_geon.md` — análisis interno de decisión

---

## Generación de paquetes por área

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate_validation_area_single_docx.ps1 `
  -AreaPath docs\validation\areas\area_01_gobierno_seguridad `
  -Code "VAL-SPI-AREA-01-V1-0" `
  -Version "1.0" `
  -Status "BORRADOR" `
  -Mode Final
```

---

## Archivos de la infraestructura

| Archivo | Descripción |
|---|---|
| `Plantilla_Validacion_SPI_AUTOMATIZABLE.dotx` | Plantilla Word con content controls (dotx) |
| `scripts/validation-doc.config.json` | Configuración central: plantillas, estilos, orden documental, áreas, secciones WHO y GEON |
| `scripts/modules/ValidationDocTools.psm1` | Módulo PowerShell: logging, COM Word, retry, Markdown→HTML→Word, anexos WHO App5 |
| `scripts/generate_validation_docx_from_template.ps1` | Motor base: genera .docx desde .md |
| `scripts/generate_validation_general_docx.ps1` | Entrypoint variante WHO |
| `scripts/generate_validation_general_geon_docx.ps1` | Entrypoint variante GEON/OMCL Annex 2 |
| `scripts/generate_validation_area_single_docx.ps1` | Consolida paquete de área en un .docx |
| `scripts/prepare_validation_template.ps1` | Crea plantilla automatizable desde plantilla original |

## Tags de content controls (plantilla .dotx)

| Tag | Contenido |
|---|---|
| `doc_title` | Título del documento |
| `doc_area` | Área / alcance |
| `meta_system` | Sistema (FamSPI) |
| `meta_code` | Código documental |
| `meta_version` | Versión |
| `meta_date` | Fecha de emisión |
| `meta_status` | Estado (BORRADOR/APROBADO/VIGENTE) |
| `body_content` | Cuerpo principal del documento |

## Flujo de trabajo recomendado

1. Ejecutar `prepare_validation_template.ps1` una vez (o al cambiar la plantilla base).
2. Elegir variante: WHO (`generate_validation_general_docx.ps1`) o GEON (`generate_validation_general_geon_docx.ps1`).
3. Usar `-Mode Preview` para salida rápida sin TOC, o `-Mode Final` para documento completo.
4. Revisar el DOCX resultante en Word y ajustar si es necesario.

## Capacidades del módulo ValidationDocTools.psm1

- Configuración central por JSON con secciones independientes WHO y GEON.
- Logging técnico por ejecución en `docs/validation/FORMATO_UNICO/logs/`.
- Barra de progreso durante consolidación y render.
- Validación de content controls antes de llenar plantilla (preflight).
- Reintentos ante fallos transitorios de COM Word.
- Liberación explícita de objetos COM y garbage collection.
- Modo Preview y modo Final (con TOC, paginación, cabeceras y postformato).
- Generación de Anexos WHO App5 estructurados (A–H): URS, FRS, FMEA, protocolos, ejecución, desviaciones, entrenamiento, RTM.
- Corrección automática de tildes y caracteres especiales en español.
- Soporte de flujos mermaid/texto convertidos a tablas de pasos.
- Soporte de imágenes como anexos gráficos (assets/).

## Limitaciones actuales

- Requiere Microsoft Word instalado (COM automation). No usa Pandoc.
- Markdown avanzado (HTML embebido, tablas complejas anidadas) puede renderizarse de forma simplificada.
- La revisión final en Word es recomendable para documentos regulados antes de su firma.
- Los resultados OQ/PQ están PENDIENTES DE EJECUCIÓN; los documentos son protocolos listos para ejecutar.

## Decisión sobre variante definitiva

La organización debe decidir qué variante adoptar formalmente, o si mantener ambas con fines distintos:
- **Variante WHO**: recomendada si se necesita mayor cobertura normativa o presentación a auditores externos.
- **Variante GEON**: recomendada si la prioridad es velocidad de ejecución, claridad operativa y mantenimiento ágil.
- Ver `docs/validation/general_GEON/09_comparativo_who_vs_geon.md` para el análisis comparativo detallado.
