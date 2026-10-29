# Introducción y Alcance

> **Documento:** VAL-FAMSPI-GEON-V1-0-0 — Sección 02
> **Sistema:** FamSPI v1.0.0
> **Estado:** EN REVISIÓN TÉCNICA
> **Fecha:** 2026-05-13

---

## 1. Introducción

FamSPI es el sistema computarizado institucional desarrollado por FamProject para la gestión integrada de recursos humanos y procesos internos de la organización. El sistema centraliza la administración de personal, el control de permisos y vacaciones, la gestión de compras de equipamiento, las solicitudes de entrega, el seguimiento de casos de negocio y la administración de roles y permisos de acceso, entre otras funcionalidades.

Como sistema computarizado institucional, FamSPI opera como soporte directo de procesos internos de la organización. Su correcto funcionamiento, la integridad de los registros que genera, la trazabilidad de las operaciones que ejecuta y la solidez de sus mecanismos de control de acceso son condiciones necesarias para garantizar que los procesos que dependen de él operen de manera ordenada, verificable y confiable.

FamSPI v1.0.0 representa la primera versión del sistema lista para su uso formal como herramienta de soporte de procesos internos. Antes de su formalización documental y su uso pleno como soporte de procesos, la organización ha determinado la necesidad de establecer una línea base validada que evidencie el correcto funcionamiento del sistema dentro del alcance definido, con criterios de aceptación documentados y evidencia objetiva verificable.

El presente documento corresponde a la sección de Introducción y Alcance del Paquete de Validación General Inicial de FamSPI v1.0.0, variante GEON/OMCL Annex 2.

---

## 2. Justificación

La validación de FamSPI v1.0.0 responde a una necesidad organizacional explícita, articulada por la Gerencia General como responsable de los procesos internos de la organización.

La validación se ejecuta por solicitud de Gerencia General, con el objetivo de establecer una línea base documentada sobre el funcionamiento de FamSPI v1.0.0, evidenciando controles de acceso, trazabilidad, operación funcional y registros verificables, previo a su formalización documental y uso como soporte de procesos internos.

Esta justificación determina tanto el alcance del proceso de validación como la profundidad de la documentación generada. El proceso no busca demostrar cumplimiento regulatorio externo, sino establecer una base documental sólida, verificable y trazable que respalde la confianza de la organización en su propio sistema.

---

## 3. Necesidad

La necesidad que da origen a este proceso de validación es la siguiente:

Necesidad de evidenciar el control, la trazabilidad y el correcto funcionamiento del sistema FamSPI dentro del alcance validado, con el fin de demostrar que la herramienta opera de manera ordenada, verificable y controlada antes de su formalización documental y uso como soporte de procesos internos.

Esta necesidad se concreta en los siguientes requisitos documentales y operacionales:

- Disponer de una especificación de requisitos de usuario (URS) documentada y trazable al alcance validado.
- Disponer de protocolos de calificación (IQ, OQ, PQ/UAT) ejecutados con criterios de aceptación definidos y evidencia objetiva registrada.
- Disponer de un informe de validación final que consolide los resultados, declare el estado validado del sistema dentro del alcance y establezca las condiciones de liberación de la línea base.
- Asegurar que los controles de acceso por roles funcionen conforme a lo especificado en los requisitos del sistema.
- Asegurar que los registros generados por el sistema sean íntegros, trazables y verificables.
- Asegurar que el módulo funcional Permisos y Vacaciones opere conforme a los flujos de proceso definidos.

---

## 4. Propósito de la validación

El propósito de la presente validación es establecer, mediante evidencia objetiva documentada, que el sistema computarizado FamSPI v1.0.0 cumple con los requisitos especificados dentro del alcance validado, y que su operación es ordenada, verificable, controlada y trazable.

De manera específica, la validación persigue los siguientes objetivos:

- Establecer la primera línea base validada de FamSPI v1.0.0 como sistema computarizado institucional.
- Documentar el alcance, los límites y las exclusiones de la validación de forma explícita.
- Ejecutar y registrar protocolos de calificación (IQ, OQ, PQ/UAT) con criterios de aceptación formalmente definidos.
- Validar Gobierno y Seguridad como dimensión transversal de control que aplica sobre la totalidad del sistema.
- Validar Permisos y Vacaciones como el primer módulo funcional activo del sistema dentro de la línea base.
- Generar un paquete documental completo, estructurado conforme al marco GEON/OMCL Annex 2 adoptado como referencia de buena práctica.
- Establecer las condiciones de liberación de la línea base y los mecanismos de control de cambios aplicables a versiones futuras.

---

## 5. Adopción metodológica GEON/OMCL Annex 2

El presente paquete de validación adopta el marco **GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 — Validation of Complex Computerised Systems** como referencia metodológica de buena práctica para la estructuración y documentación del proceso de validación de FamSPI v1.0.0.

La adopción de este marco se justifica por su orientación práctica hacia la validación de sistemas computarizados complejos, su enfoque basado en riesgo, su estructura de calificación por fases (IQ, OQ, PQ) y la pertinencia de sus requisitos documentales para el contexto institucional de FamProject.

La adopción de este marco tiene carácter estrictamente metodológico. Se realizan las siguientes advertencias:

- **FamProject no es un OMCL.** La organización no pertenece a ninguna red de Laboratorios Oficiales de Control de Medicamentos ni a ninguna red GEON. La adopción del marco se realiza exclusivamente en virtud de su pertinencia estructural para la documentación de sistemas computarizados.
- **No se declara cumplimiento GMP.** Este paquete no constituye documentación de cumplimiento de Buenas Prácticas de Manufactura bajo ninguna regulación farmacéutica aplicable.
- **No se declara cumplimiento integral de ISO/IEC 17025.** Este proceso de validación no reemplaza ni sustituye un proceso de acreditación formal bajo la norma ISO/IEC 17025 ni ninguna otra norma de acreditación.
- **El marco se adapta al contexto institucional.** La aplicación del marco GEON/OMCL Annex 2 en este paquete refleja una interpretación adaptada al sistema FamSPI y al entorno organizacional de FamProject, realizada con criterio técnico por el equipo responsable de la validación.

---

## 6. Alcance validado

La presente validación establece la primera línea base validada de FamSPI v1.0.0 como sistema computarizado institucional. Dentro de esta línea base, Gobierno y Seguridad se valida como dimensión transversal de control, y Permisos y Vacaciones se valida como módulo funcional activo. La validación aplica únicamente al alcance definido y no constituye validación de funcionalidades no desarrolladas, no implementadas o no liberadas.

El alcance se estructura en tres capas:

**Capa 1 — Sistema global: FamSPI v1.0.0**

FamSPI v1.0.0 es validado como sistema computarizado institucional en su primera línea base. Esta capa abarca la arquitectura general del sistema, su infraestructura de despliegue, sus mecanismos de autenticación y autorización, su capacidad de registro y trazabilidad a nivel de sistema, y su configuración de entorno. La validación a nivel de sistema global establece que FamSPI opera como plataforma confiable y controlada sobre la cual se ejecutan los módulos y dimensiones validados.

**Capa 2 — Dimensión transversal de control: Gobierno y Seguridad**

Gobierno y Seguridad es validado como una dimensión transversal que aplica sobre la totalidad del sistema. Esta dimensión abarca:

- Control de acceso basado en roles (RBAC): asignación, restricción y verificación de permisos por rol de usuario.
- Integridad de registros: garantía de que los registros generados por el sistema no son alterados de forma no autorizada.
- Trazabilidad de operaciones: capacidad del sistema de registrar y recuperar el historial de operaciones relevantes.
- Mecanismos de auditoría: disponibilidad de registros de auditoría para la revisión de operaciones críticas.

**Capa 3 — Módulo funcional activo: Permisos y Vacaciones**

Permisos y Vacaciones es validado como el primer módulo funcional activo dentro de la línea base de FamSPI v1.0.0. Este módulo abarca:

- Proceso de solicitud de permisos y vacaciones por parte del personal.
- Flujo de aprobación por parte de los responsables designados.
- Registro y consulta del estado de las solicitudes.
- Integración con los controles de acceso definidos en la dimensión Gobierno y Seguridad.
- Generación de registros trazables de las operaciones ejecutadas dentro del módulo.

---

## 7. Exclusiones explícitas

La presente validación excluye expresamente los siguientes elementos:

- Módulos de FamSPI no implementados o no liberados en la versión v1.0.0 al momento de la validación.
- Funcionalidades en desarrollo, en estado de prueba interna o marcadas como experimentales dentro del sistema.
- Integraciones externas no activas o no configuradas en el entorno validado.
- Módulos funcionales distintos a Permisos y Vacaciones, aunque existan en el sistema (por ejemplo, Compras de Equipamiento, Solicitudes de Entrega, Casos de Negocio, entre otros), ya que no forman parte del alcance de la primera línea base validada.
- Procesos organizacionales externos al sistema FamSPI, aunque estén relacionados con los procesos soportados por el módulo validado.
- Validación de la infraestructura de hosting de terceros más allá de la verificación de disponibilidad y configuración del entorno validado.
- Cualquier funcionalidad, módulo o configuración que no esté documentada en la especificación de requisitos (URS) asociada a este paquete de validación.

Las exclusiones son definitivas para el alcance de la versión v1.0.0. Funcionalidades excluidas podrán incorporarse al alcance validado en versiones futuras mediante el proceso formal de control de cambios y extensión de la línea base.

---

## 8. Enfoque basado en riesgo

La presente validación adopta un enfoque proporcional al riesgo, conforme a los principios del marco GEON/OMCL Annex 2. Este enfoque implica que la profundidad, extensión y rigor de la documentación y las pruebas de calificación son proporcionales al nivel de riesgo asociado a cada función del sistema dentro del alcance validado.

Los criterios de evaluación de riesgo aplicados son:

- **Impacto sobre la integridad de datos:** funciones que generan, modifican o eliminan registros de forma que podría afectar la trazabilidad o la completitud de los datos del sistema.
- **Impacto sobre el control de acceso:** funciones que determinan qué usuarios pueden ejecutar qué operaciones dentro del sistema.
- **Impacto sobre la operación del proceso:** funciones cuya falla podría interrumpir o distorsionar el proceso de negocio soportado por el módulo validado.
- **Frecuencia de uso:** funciones de uso frecuente o crítico en la operación diaria del sistema.

Las funciones identificadas como de riesgo alto o crítico reciben mayor cobertura en los protocolos de calificación y mayor profundidad de evidencia requerida. Las funciones de riesgo bajo o negligible pueden cubrirse con niveles de evidencia proporcionales, sin requerir el mismo nivel de detalle.

El análisis de riesgo completo se documenta en el archivo `04_analisis_riesgo_geon.md` de este paquete.

---

## 9. Clasificación del sistema

Para efectos documentales de la variante GEON/OMCL Annex 2, FamSPI v1.0.0 se clasifica como:

| Criterio de clasificación | Valor asignado |
|---|---|
| Tipo de sistema | Sistema computarizado complejo |
| Referencia de clasificación | GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 |
| Categoría funcional | Sistema de gestión institucional (ERP/HRMS) |
| Modalidad de despliegue | Aplicación web con backend en la nube |
| Nivel de criticidad funcional | Medio-alto (soporte de procesos internos con impacto directo en personal y operaciones) |
| Impacto sobre datos regulados | No aplicable (sistema institucional no regulado externamente) |
| Impacto sobre procesos internos | Alto (gestión de permisos, vacaciones, accesos y trazabilidad de operaciones) |

La clasificación como sistema computarizado complejo determina la aplicación del conjunto completo de fases de calificación (IQ, OQ, PQ/UAT) y la generación del informe de validación final como requisitos documentales mínimos para la liberación de la línea base.

---

## 10. Evolución controlada

FamSPI no se considera un sistema estático, sino un sistema computarizado en evolución controlada, validado por versión, alcance, riesgo, evidencia objetiva y control de cambios.

Esta declaración establece el principio rector que gobierna la gestión del estado validado de FamSPI a lo largo del tiempo. Las implicaciones prácticas de este principio son:

- **Validación por versión:** cada versión mayor o significativa de FamSPI que introduzca cambios en el alcance validado requiere una nueva actividad de validación o una extensión documentada de la línea base existente.
- **Validación por alcance:** el estado validado aplica únicamente al alcance definido en el paquete de validación correspondiente. Funcionalidades no validadas no se consideran parte del estado validado.
- **Validación por riesgo:** la extensión y profundidad de las actividades de validación para nuevas versiones o funcionalidades se determina mediante análisis de impacto de cambio (AIC) proporcional al riesgo introducido.
- **Validación por evidencia objetiva:** el estado validado solo se sostiene si existe evidencia objetiva, documentada y verificable, de que el sistema cumple con los requisitos especificados dentro del alcance.
- **Control de cambios:** cualquier modificación al sistema que pueda afectar el estado validado debe pasar por el proceso formal de control de cambios antes de ser liberada en el entorno validado. Los cambios no controlados invalidan la línea base en la medida en que afecten el alcance validado.

La primera línea base validada establecida por este paquete de validación es el punto de partida de este proceso de evolución controlada. Las versiones futuras de FamSPI se validarán sobre la base de esta primera línea, mediante procesos de validación incremental documentados.

---

## 11. Ruta de validación adoptada

La ruta de validación adoptada para FamSPI v1.0.0, variante GEON/OMCL Annex 2, sigue las fases estándar de calificación de sistemas computarizados, adaptadas al contexto institucional de FamProject.

| Fase | Nombre | Descripción | Documento asociado |
|---|---|---|---|
| 1 | URS — Especificación de Requisitos de Usuario | Definición formal de los requisitos funcionales, no funcionales y de control que el sistema debe satisfacer dentro del alcance validado. Trazados al análisis de riesgo. | `05_especificacion_requisitos_urs.md` |
| 2 | IQ — Calificación de Instalación | Verificación de que el sistema está instalado y configurado correctamente en el entorno validado, conforme a las especificaciones del proveedor/equipo de desarrollo. | `06_protocolo_calificacion_iq_oq.md` (sección IQ) |
| 3 | OQ — Calificación de Operación | Verificación de que el sistema opera conforme a las especificaciones dentro del entorno validado, incluyendo la operación de los controles de seguridad y las funciones del sistema global. | `06_protocolo_calificacion_iq_oq.md` (sección OQ) |
| 4 | PQ/UAT — Calificación de Desempeño / Pruebas de Aceptación de Usuario | Verificación de que el sistema desempeña las funciones del alcance validado de manera consistente y conforme a los requisitos del usuario bajo condiciones de operación real o representativas. | `07_protocolo_calificacion_pq_uat.md` |
| 5 | Informe final de validación | Consolidación de resultados de todas las fases. Declaración del estado validado. Registro de desviaciones, acciones correctivas y condiciones de liberación. | `08_informe_validacion_final.md` |
| 6 | Liberación de la línea base | Decisión formal de la organización de liberar FamSPI v1.0.0 dentro del alcance validado como sistema computarizado institucional operativo. | `08_informe_validacion_final.md` (sección de liberación) |
| 7 | Archivo del paquete de validación | Archivo controlado del paquete completo de validación bajo control de versiones. Punto de referencia para futuras actividades de control de cambios y validación incremental. | Repositorio Git — rama `main` |

La ruta es secuencial. El paso a cada fase posterior requiere la compleción satisfactoria de la fase anterior, o la documentación formal de las desviaciones y acciones correctivas que justifican el avance. No se libera la línea base sin la aprobación formal del informe de validación final por parte de los responsables designados.

---

*Documento emitido por el equipo TI de FamProject — 2026-05-13*
*Código: VAL-FAMSPI-GEON-V1-0-0 — Sección 02 — Versión 1.0*
