# VARIANTE GEON/OMCL Annex 2 — FamSPI v1.0.0

> **Carpeta:** `docs/validation/general_GEON/`
> **Estado:** EN REVISIÓN TÉCNICA
> **Fecha de emisión:** 2026-05-13
> **Referencia metodológica:** GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 — Validation of Complex Computerised Systems (adoptada como referencia de buena práctica documental)

---

## 1. Propósito de esta carpeta

Esta carpeta contiene el **Paquete de Validación General Inicial de FamSPI v1.0.0 — Variante GEON/OMCL Annex 2**. Se trata de una variante documental alternativa a la variante WHO que reside en `docs/validation/general/`.

La variante GEON/OMCL Annex 2 **no reemplaza** a la variante WHO. Ambas variantes coexisten dentro del repositorio y responden a distintos enfoques metodológicos de documentación de validación de sistemas computarizados. La organización determinará cuál variante se adopta como paquete definitivo para producción, o bien si se mantienen ambas como referencia cruzada.

El propósito de esta carpeta es:

- Proporcionar un paquete de validación estructurado conforme a la lógica del marco GEON/OMCL Annex 2, más práctico y directo en su presentación que la variante WHO.
- Cubrir el mismo alcance validado (sistema global, dimensión transversal, módulo funcional activo) con una organización documental diferente.
- Facilitar la comparación entre variantes para que el equipo responsable tome una decisión documental informada.
- Servir de base para la generación del documento DOCX final mediante el script PowerShell correspondiente.

---

## 2. Diferencia frente a la variante WHO

Las dos variantes cubren el mismo sistema, la misma versión y el mismo alcance validado. La diferencia radica en el enfoque metodológico, la profundidad normativa y la estructura de los documentos generados.

| Dimensión | Variante WHO | Variante GEON/OMCL Annex 2 |
|---|---|---|
| Marco de referencia principal | WHO Technical Report Series (TRS) | GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 |
| Orientación general | Exhaustiva, normativa, multi-guía | Práctica, directa, orientada a evidencia objetiva |
| Profundidad regulatoria | Mayor — incluye referencias cruzadas a múltiples guías WHO | Proporcional al riesgo — enfocada en trazabilidad y control |
| Estructura documental | Más granular, mayor número de secciones por documento | Consolidada, flujo más lineal de evidencia |
| Extensión esperada de documentos | Mayor | Más concisa sin perder rigor |
| Audiencia primaria de referencia | Organizaciones que alinean con guidelines WHO | Organizaciones que adoptan marco GEON/OMCL como buena práctica |
| Uso de riesgo como eje | Presente pero como sección adicional | Central y transversal a todo el paquete |
| Aplicabilidad institucional directa | Alta, con adaptación regulatoria | Alta, con adaptación de contexto institucional |
| Generación de DOCX | Script `generate_validation_general_docx.ps1` | Script `generate_validation_general_geon_docx.ps1` |

**Conclusión de la comparativa:** Ninguna variante es superior en términos absolutos. La variante WHO es más adecuada si la organización anticipa auditorías externas con referencia directa a normativa WHO. La variante GEON/OMCL Annex 2 es más adecuada si se busca un paquete de validación operativo, proporcional al riesgo y alineado con las prácticas de laboratorios de metrología y control que han adoptado GEON como marco de referencia.

---

## 3. Alcance validado

El alcance de esta variante es idéntico al de la variante WHO. Se estructura en tres capas:

**Capa 1 — Sistema global:**
FamSPI v1.0.0 como sistema computarizado institucional de gestión de recursos humanos y procesos internos. Esta capa constituye la primera línea base validada del sistema en su conjunto.

**Capa 2 — Dimensión transversal de control:**
Gobierno y Seguridad, validada como dimensión transversal que aplica sobre la totalidad del sistema. Abarca control de acceso por roles, trazabilidad de operaciones, integridad de registros y mecanismos de auditoría.

**Capa 3 — Módulo funcional activo:**
Permisos y Vacaciones, validado como el primer módulo funcional activo dentro de la línea base. Cubre la operación funcional completa del proceso de solicitud, aprobación y registro de permisos y vacaciones del personal.

La validación aplica únicamente al alcance definido y no constituye validación de funcionalidades no desarrolladas, no implementadas o no liberadas en FamSPI v1.0.0.

---

## 4. Estructura documental GEON/OMCL Annex 2

El paquete documental de esta variante se compone de los siguientes 8 archivos principales (más este README y el documento comparativo, excluidos del DOCX):

| N.° | Archivo | Descripción |
|---|---|---|
| 01 | `01_control_documental_autorizacion.md` | Metadatos del documento, historial de revisiones, tabla de aprobaciones y declaración de adopción metodológica. Equivalente a la portada formal del paquete. |
| 02 | `02_introduccion_alcance.md` | Introducción al sistema, justificación de la validación, necesidad documental, propósito, adopción metodológica GEON, alcance validado por capas, exclusiones explícitas, enfoque basado en riesgo, clasificación del sistema y ruta de validación adoptada. |
| 03 | `03_descripcion_sistema_infraestructura.md` | Descripción técnica de FamSPI: arquitectura, stack tecnológico, componentes de infraestructura, dependencias externas, diagrama lógico de capas y configuración del entorno validado. |
| 04 | `04_analisis_riesgo_geon.md` | Análisis de riesgo proporcional conforme al enfoque GEON/OMCL Annex 2. Identificación de funciones críticas, matriz de riesgo por módulo, nivel de impacto y estrategia de mitigación aplicada. |
| 05 | `05_especificacion_requisitos_urs.md` | Especificación de Requisitos de Usuario (URS) en el contexto GEON. Define los requisitos funcionales, no funcionales y de control aplicables al alcance validado, trazados al análisis de riesgo. |
| 06 | `06_protocolo_calificacion_iq_oq.md` | Protocolo de Calificación de Instalación (IQ) y Calificación de Operación (OQ). Incluye criterios de aceptación, evidencia requerida y registros de ejecución dentro del alcance validado. |
| 07 | `07_protocolo_calificacion_pq_uat.md` | Protocolo de Calificación de Desempeño (PQ) / Pruebas de Aceptación de Usuario (UAT). Casos de prueba funcional sobre Permisos y Vacaciones y sobre Gobierno y Seguridad, con criterios de aceptación y evidencia objetiva. |
| 08 | `08_informe_validacion_final.md` | Informe de Validación Final. Consolidación de resultados de IQ, OQ y PQ/UAT. Declaración de estado validado, desviaciones encontradas, acciones correctivas y declaración de liberación de la línea base FamSPI v1.0.0. |

Adicionalmente, esta carpeta contiene:

| Archivo | Rol |
|---|---|
| `00_README_VALIDACION_FAMSPI_GEON_ANNEX2.md` | Este archivo. Orientación general de la carpeta. Excluido del DOCX. |
| `09_comparativo_variantes_WHO_GEON.md` | Análisis comparativo detallado entre la variante WHO y la variante GEON/OMCL Annex 2. Excluido del DOCX. |

---

## 5. Advertencia metodológica

La adopción del marco **GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2** en este paquete de validación se realiza exclusivamente como **referencia de buena práctica documental**.

Las siguientes declaraciones son aplicables y deben tenerse en cuenta al interpretar este paquete:

- **FamProject no es un OMCL (Official Medicines Control Laboratory).** La adopción de este marco metodológico no implica pertenencia a ninguna red de laboratorios oficiales de control de medicamentos, ni a ninguna red GEON.
- **No se declara cumplimiento GMP (Good Manufacturing Practices).** Este paquete no constituye documentación de cumplimiento GMP bajo ninguna regulación farmacéutica nacional o internacional.
- **No se declara cumplimiento integral de ISO/IEC 17025.** Este paquete no reemplaza ni sustituye un proceso de acreditación ISO/IEC 17025 ni ningún otro proceso de acreditación formal.
- **El marco se adopta por su pertinencia estructural.** GEON/OMCL Annex 2 ofrece una guía práctica para la validación de sistemas computarizados complejos que resulta aplicable como referencia para organizaciones institucionales que buscan documentar sus sistemas de forma rigurosa, proporcional al riesgo y con trazabilidad verificable.
- **La interpretación y aplicación de este marco es responsabilidad del equipo técnico de FamProject**, quien ha adaptado su estructura a las características del sistema FamSPI y al contexto institucional de la organización.

---

## 6. Comandos de generación

Los siguientes comandos PowerShell permiten generar el documento DOCX consolidado de cada variante a partir de los archivos Markdown de esta carpeta y de `docs/validation/general/`.

**Variante WHO:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate_validation_general_docx.ps1 -Mode Final
```

**Variante GEON/OMCL Annex 2:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate_validation_general_geon_docx.ps1 -Mode Final
```

Ambos comandos deben ejecutarse desde la raíz del repositorio (`C:\Users\Departamento de TI\Desktop\PROYECTOS\FamSPI\`).

---

## 7. Salida esperada

| Variante | Ruta de salida del DOCX generado |
|---|---|
| WHO | `docs/validation/general/PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0.docx` |
| GEON/OMCL Annex 2 | `docs/validation/general_GEON/PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0_GEON_ANNEX2.docx` |

Los archivos DOCX generados son los documentos formales del paquete de validación. Los archivos Markdown son la fuente de verdad y deben mantenerse bajo control de versiones en el repositorio.

---

## 8. Decisión pendiente

Ninguna de las dos variantes se convierte automáticamente en el paquete definitivo de validación de FamSPI v1.0.0. La decisión sobre cuál variante adoptar como documento oficial del paquete de validación corresponde a la organización, con base en los siguientes criterios:

- Audiencia prevista del documento (interna, externa, auditores).
- Marco de referencia que la organización desea citar explícitamente.
- Profundidad de detalle requerida para el propósito del proceso de formalización.
- Alineación con procesos de revisión documental futuros.

Hasta tanto se tome esta decisión, ambas variantes tienen el mismo estatus: **EN REVISIÓN TÉCNICA**. Una vez tomada la decisión, el documento oficial se marcará con estado **APROBADO** y el otro podrá archivarse o mantenerse como referencia alternativa.

---

## 9. Archivos excluidos del DOCX

Los siguientes archivos de esta carpeta **no se incluyen** en el documento DOCX generado por el script de generación GEON:

- `00_README_VALIDACION_FAMSPI_GEON_ANNEX2.md` — Este archivo. Es orientativo y no forma parte del paquete documental formal.
- `09_comparativo_variantes_WHO_GEON.md` — Análisis comparativo interno. Es un documento de apoyo a la decisión organizacional, no un documento de validación.

El script de generación DOCX está configurado para incluir únicamente los archivos `01` a `08` en el orden indicado en la sección 4.

---

*Documento generado por el equipo TI de FamProject — 2026-05-13*
*Referencia metodológica adoptada: GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 — Validation of Complex Computerised Systems*
