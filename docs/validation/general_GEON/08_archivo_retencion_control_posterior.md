# Archivo, Retención y Control Posterior

**Sistema:** FamSPI v1.0.0
**Variante de validación:** GEON/OMCL Annex 2 — adoptado como buena práctica
**Versión del documento:** 1.0
**Fecha de emisión:** 2026-05-13
**Estado del documento:** VIGENTE
**Clasificación:** Documento de gestión del ciclo de vida — uso interno

---

## 1. Propósito

Este documento establece los criterios, responsabilidades y procedimientos para el archivo, la retención documental, el control posterior de cambios y el mantenimiento del estado validado de FamSPI a lo largo de su ciclo de vida. Su objetivo es garantizar que la documentación de validación generada para FamSPI v1.0.0 permanezca accesible, íntegra y trazable durante todo el período de uso activo del sistema y durante el período adicional de retención post-retiro, y que cualquier cambio posterior al sistema sea evaluado, documentado y gestionado de manera que no comprometa el estado validado establecido.

Este documento aplica a todas las versiones de FamSPI a partir de la v1.0.0 y a todos los módulos cubiertos por el alcance de validación definido en el paquete GEON. Complementa el Informe Final de Validación y Liberación para Uso (documento 07) y establece el vínculo entre el estado validado actual y los ciclos de revalidación futuros.

---

## 2. Archivo de la Documentación

El paquete de validación de FamSPI v1.0.0 comprende los siguientes documentos, que deben ser archivados en su versión final aprobada:

| N.° | Documento | Descripción |
|---|---|---|
| 01 | URS — Especificación de Requisitos de Usuario | Define todos los requisitos funcionales y no funcionales del sistema |
| 02 | Análisis de Riesgo y Plan de Validación | Evaluación de riesgos y estrategia general de validación |
| 03 | RTM — Matriz de Trazabilidad de Requisitos | Trazabilidad entre URS, diseño y casos de prueba |
| 04 | Informe de Diseño Técnico (DQ) | Arquitectura, stack tecnológico y configuración del sistema |
| 05 | Informe de Diseño Funcional (FRS equivalente) | Especificación funcional detallada de módulos |
| 06 | Protocolos de prueba IQ, OQ y PQ/UAT | Casos de prueba diseñados con resultados a completar |
| 07 | Informe Final de Validación y Liberación para Uso | Consolidación del paquete y acta de liberación |
| 08 | Archivo, Retención y Control Posterior (este documento) | Gestión del ciclo de vida post-validación |
| 09 | Análisis Comparativo WHO vs. GEON (referencia interna) | Documento de soporte de decisión, no parte del paquete principal |

**Formato de archivo:** Los documentos se archivan en formato DOCX generado desde las fuentes Markdown del repositorio, utilizando el script de generación automatizada del paquete de validación. Las fuentes Markdown originales se conservan en el repositorio Git del proyecto como evidencia de origen y trazabilidad de versiones.

**Ubicación de archivo:** El paquete documental se archiva en las siguientes ubicaciones complementarias:

- **Repositorio Git del proyecto (FamSPI):** carpeta `/docs/validation/general_GEON/` para fuentes Markdown; carpeta `/docs/validation/FORMATO_UNICO/` para versiones DOCX generadas.
- **Almacenamiento en la nube corporativo de FamProject:** carpeta designada de validación, con control de acceso restringido al personal autorizado.
- **Respaldo físico o en medio externo:** copia del paquete DOCX completo en medio de almacenamiento externo, etiquetado con versión del sistema, fecha de emisión y responsable de custodia.

---

## 3. Retención Documental

La siguiente tabla define los períodos mínimos de retención para cada tipo de documento del paquete de validación de FamSPI. El período de retención se cuenta desde la fecha de retiro formal del sistema de producción, salvo indicación contraria.

| Tipo de documento | Período de retención | Responsable de custodia | Ubicación principal |
|---|---|---|---|
| Paquete de validación GEON (archivos DOCX) | Mientras el sistema esté en uso + 5 años adicionales tras retiro | Responsable de TI / Área de Calidad | Repositorio Git + almacenamiento en la nube corporativo |
| Evidencias de ejecución de pruebas (capturas de pantalla, logs, registros de resultado) | Mientras el sistema esté en uso + 3 años adicionales tras retiro | Responsable de TI | Almacenamiento en la nube corporativo (carpeta de evidencias) |
| Protocolos de prueba firmados (IQ, OQ, PQ/UAT con resultados y firmas) | Mientras el sistema esté en uso + 5 años adicionales tras retiro | Responsable de TI / Área de Calidad | Almacenamiento en la nube corporativo + copia en medio físico |
| Informe Final de Validación y Liberación para Uso (firmado) | Mientras el sistema esté en uso + 5 años adicionales tras retiro | Responsable de TI / Gerencia General | Almacenamiento en la nube corporativo + copia en medio físico |
| Registros de control de cambios post-validación | Mientras el sistema esté en uso + 5 años adicionales tras retiro | Responsable de TI | Repositorio Git (historial de commits + documentos de cambio) |
| Declaraciones de aceptación de usuarios (PQ/UAT firmadas) | Mientras el sistema esté en uso + 5 años adicionales tras retiro | Responsable de TI / Área de Calidad | Almacenamiento en la nube corporativo |
| Análisis comparativo WHO vs. GEON (referencia interna) | Mientras el sistema esté en uso | Responsable de TI | Repositorio Git |

---

## 4. Responsable de Custodia

La custodia del paquete de validación de FamSPI v1.0.0 y de todos los documentos relacionados con el ciclo de vida validado del sistema recae sobre el **Responsable de Tecnología de la Información (Jefe / Coordinador de TI)** de FamProject, en coordinación con el **Responsable de Calidad o la función equivalente** dentro de la organización.

El Responsable de Custodia tiene las siguientes responsabilidades específicas:

- Garantizar la disponibilidad, integridad y accesibilidad de la documentación durante todo el período de retención.
- Controlar el acceso a la documentación, permitiendo la consulta a personal autorizado y protegiendo los documentos de modificaciones no autorizadas.
- Actualizar el repositorio de documentación tras cada cambio validado del sistema, incorporando los nuevos documentos de revalidación al paquete histórico.
- Notificar a la Gerencia General cuando un documento del paquete de validación requiera actualización como consecuencia de un cambio significativo en el sistema.
- Gestionar el proceso de archivo final y eliminación controlada de la documentación al vencimiento del período de retención aplicable.

---

## 5. Conservación Mientras la Aplicación Esté en Uso

Durante todo el período en que FamSPI se encuentre en uso productivo activo, sin importar la versión que esté operando en ese momento, la documentación de validación debe mantenerse en las siguientes condiciones:

- **Accesibilidad:** Los documentos deben estar disponibles para consulta en un plazo máximo de 24 horas hábiles ante cualquier solicitud interna o de auditoría.
- **Integridad:** Los documentos archivados no deben ser modificados. Cualquier actualización genera una nueva versión con identificador diferente; la versión anterior se conserva como parte del historial.
- **Legibilidad:** Los formatos de archivo utilizados deben garantizar la legibilidad de los documentos durante todo el período de retención. Si un formato tecnológico queda obsoleto, los documentos deben ser migrados a un formato actual sin alteración del contenido.
- **Trazabilidad:** Cada versión del paquete de validación debe estar vinculada de manera inequívoca a la versión de FamSPI que valida, incluyendo la identificación de la versión en el nombre del archivo, en el encabezado del documento y en el registro de versiones del repositorio.
- **Control de acceso:** El acceso de escritura a los documentos de validación debe estar restringido al Responsable de Custodia y al personal expresamente autorizado. El acceso de lectura puede extenderse al personal de dirección, calidad y auditoría interna.

---

## 6. Período Adicional Post-Retiro

Cuando FamSPI sea formalmente retirado de producción y reemplazado por un sistema sucesor o dado de baja definitiva, se iniciará el período de retención adicional post-retiro definido en la Sección 3. Durante este período:

- La documentación de validación continuará siendo custodiada por el Responsable de TI o por el área que asuma dicha función en la estructura organizacional vigente al momento del retiro.
- Los documentos se conservarán en formato de solo lectura, sin posibilidad de modificación.
- El período de retención adicional se contará desde la fecha de baja formal del sistema en el registro de sistemas de FamProject, no desde la fecha del último uso del sistema.
- Al vencimiento del período adicional de retención, los documentos podrán ser eliminados de manera controlada, previa autorización de la Gerencia General, dejando constancia del acto de eliminación en el registro histórico de la organización.

---

## 7. Control Posterior de Cambios

Todo cambio en FamSPI posterior a la liberación formal de la versión v1.0.0 debe ser evaluado mediante el proceso de control de cambios antes de ser implementado en el entorno de producción. El proceso de control de cambios incluye las siguientes etapas:

1. **Identificación y registro del cambio:** El cambio propuesto se documenta con descripción, justificación, alcance estimado e impacto potencial en el estado validado.
2. **Evaluación de impacto:** El Responsable de TI evalúa el impacto del cambio en los módulos validados, los requisitos URS cubiertos y los controles de seguridad e integridad del sistema.
3. **Determinación del nivel de revalidación:** Conforme a la tabla de tipos de cambio y nivel de revalidación requerido (ver a continuación), se determina qué protocolos deben ser ejecutados nuevamente.
4. **Ejecución de la revalidación proporcional:** Se ejecutan los protocolos de prueba correspondientes, se registran los resultados y se actualiza la documentación de validación.
5. **Aprobación del cambio:** El cambio es aprobado por el Responsable Técnico y, si aplica, por el Responsable Funcional y la Gerencia General.
6. **Actualización del paquete de validación:** Se incorporan los nuevos documentos de revalidación al paquete histórico y se actualiza la tabla de trazabilidad de versiones.
7. **Implementación en producción:** El cambio se despliega en producción únicamente tras la aprobación formal del proceso de revalidación.

### Tabla de Tipos de Cambio y Nivel de Revalidación Requerido

| Tipo de cambio | Descripción | Nivel de revalidación requerido |
|---|---|---|
| Corrección de bug menor | Corrección de un error que no altera la lógica de negocio ni la interfaz de usuario de manera significativa, y cuyo impacto está aislado a una funcionalidad específica ya validada | Revisión OQ parcial: re-ejecución de los casos de prueba OQ directamente afectados por la corrección, más verificación de regresión básica en funcionalidades adyacentes |
| Nueva funcionalidad | Adición de un nuevo módulo, función o flujo de trabajo no cubierto por el alcance del URS v1.0.0, independientemente de si reutiliza infraestructura existente | Nueva ronda completa IQ + OQ + PQ/UAT para el módulo nuevo, con generación de URS suplementario, RTM actualizada y protocolos de prueba específicos |
| Cambio de infraestructura | Modificación del entorno de ejecución, incluyendo cambio de servidor, proveedor de nube, sistema operativo, motor de base de datos o configuración de red significativa | Nueva IQ completa del entorno modificado + OQ de regresión sobre los módulos críticos para verificar que el comportamiento funcional no ha sido afectado por el cambio de infraestructura |
| Actualización de dependencias mayores | Actualización de versiones mayores de librerías, frameworks o servicios de terceros integrados (por ejemplo: actualización de Node.js de versión principal, actualización de React de versión principal, cambio de versión mayor de Google APIs) | Evaluación de riesgo documentada del impacto de la actualización + OQ selectivo sobre los módulos y funcionalidades que utilizan las dependencias actualizadas |
| Cambio de versión mayor del sistema | Liberación de una nueva versión mayor de FamSPI (v2.0.0 o superior) que implica cambios arquitectónicos, rediseño de módulos existentes o reescritura de componentes críticos | Revalidación completa proporcional al alcance del cambio: nuevo paquete de validación con URS actualizado, análisis de riesgo revisado, DQ actualizado, y ejecución completa de IQ + OQ + PQ/UAT para los módulos afectados o reescritos |
| Modificación de configuración de seguridad | Cambio en la configuración de autenticación, gestión de sesiones, permisos de roles o cualquier control de acceso que afecte la capa de gobierno del sistema | Revisión OQ de los casos de prueba relacionados con control de acceso y roles + verificación de impacto en PQ/UAT si el cambio afecta flujos de usuario |
| Corrección de vulnerabilidad de seguridad | Aplicación de un parche de seguridad o corrección de una vulnerabilidad identificada, independientemente de la magnitud del cambio de código | Evaluación de riesgo específica + OQ de regresión sobre los módulos afectados + confirmación de que los controles de seguridad establecidos en la validación original siguen operativos |

---

## 8. Revalidación Proporcional

El principio rector del control posterior de cambios en FamSPI es la **proporcionalidad**: no todo cambio requiere una revalidación completa del sistema, y no toda revalidación parcial es suficiente para cambios de alto impacto.

La proporcionalidad en la revalidación se determina considerando los siguientes factores:

- **Alcance del cambio:** ¿Cuántos módulos o funcionalidades se ven afectados directa o indirectamente por el cambio?
- **Riesgo del cambio:** ¿El cambio afecta funcionalidades críticas para la integridad de datos, la seguridad del sistema o la trazabilidad de auditoría?
- **Reversibilidad:** ¿El cambio puede revertirse fácilmente si se detecta un problema tras la implementación?
- **Evidencia preexistente:** ¿Existe evidencia objetiva de ejecución previa de los protocolos afectados que pueda ser referenciada como base de comparación?

La determinación del nivel de revalidación es responsabilidad del Responsable de TI, con apoyo del equipo de desarrollo, y debe quedar documentada en el registro de control de cambios antes de proceder a la ejecución. Cuando la determinación sea dudosa, se aplicará el principio de precaución: se optará por el nivel de revalidación más exigente entre las opciones aplicables.

---

## 9. Mantenimiento del Estado Validado

El estado validado de FamSPI se considera vigente mientras se cumplan las siguientes condiciones:

- El sistema opera en el entorno de instalación verificado durante la IQ, sin cambios de infraestructura no evaluados.
- No se han introducido cambios en el código, la configuración o las dependencias sin pasar por el proceso de control de cambios.
- La documentación de validación está actualizada y refleja el estado real del sistema en producción.
- No existen desviaciones críticas o mayores abiertas sin acción correctiva documentada.

**Revisión anual del estado validado:** Con independencia de si se han producido cambios, el Responsable de TI realizará una revisión anual del estado validado del sistema, verificando que el entorno de producción coincide con el entorno documentado en la IQ, que no se han introducido cambios no registrados, y que la documentación de validación está completa y accesible. El resultado de esta revisión quedará registrado en un acta de revisión anual firmada por el Responsable de TI y la Gerencia General.

**Criterios que invalidan el estado validado:**

- Detección de un cambio en el sistema no documentado ni evaluado mediante el proceso de control de cambios.
- Identificación de una desviación crítica que comprometa la integridad, seguridad o trazabilidad del sistema.
- Pérdida o corrupción de la documentación de validación sin posibilidad de recuperación.
- Cambio de entorno de producción no evaluado mediante una nueva IQ.

Cuando el estado validado sea invalidado, el Responsable de TI deberá notificar a la Gerencia General de manera inmediata e iniciar el proceso de revalidación proporcional correspondiente antes de continuar operando el sistema en producción.

---

## 10. Archivo Histórico

Las versiones anteriores del paquete de validación de FamSPI se conservan en el archivo histórico del proyecto, garantizando la trazabilidad completa del ciclo de vida validado del sistema desde su primera línea base.

**Estructura del archivo histórico:**

- El repositorio Git del proyecto conserva el historial completo de cambios en los documentos de validación, permitiendo la recuperación de cualquier versión anterior de cualquier documento.
- Los paquetes DOCX generados para cada versión validada se conservan en el almacenamiento en la nube corporativo, organizados por versión del sistema y fecha de emisión.
- Los protocolos de prueba ejecutados, con sus resultados y firmas, se conservan en formato impreso o digitalizado de manera separada de las fuentes Markdown, dado que constituyen evidencia objetiva primaria.

**Inmutabilidad de la evidencia:** Las evidencias de ejecución de pruebas (capturas de pantalla, logs, declaraciones firmadas) se tratan como documentos inmutables. No pueden ser modificadas después de su emisión. Cualquier corrección o aclaración se documenta como un addendum separado, con referencia al documento original, fecha y responsable de la aclaración.

---

## 11. Trazabilidad de Versiones

La siguiente tabla registra el historial de versiones validadas de FamSPI y el estado de su paquete de validación asociado. Esta tabla se actualizará con cada nueva versión validada del sistema.

| Versión FamSPI | Paquete de validación | Fecha de emisión | Estado de validación | Notas |
|---|---|---|---|---|
| v1.0.0 | Paquete GEON v1.0 — 8 documentos | 2026-05-13 | PENDIENTE DE EJECUCIÓN — protocolos diseñados, no ejecutados | Primera línea base. Módulos cubiertos: Gobierno y Seguridad (transversal), Permisos y Vacaciones |
| v1.x.x (futuras) | A generar conforme a control de cambios | A determinar | — | Revalidación proporcional según tipo de cambio |
| v2.0.0 (futura) | Nuevo paquete completo o extendido | A determinar | — | Revalidación completa proporcional al alcance del cambio de versión mayor |

---

## 12. Retiro y Archivo Final

Cuando FamSPI sea formalmente retirado de producción, ya sea por reemplazo por un sistema sucesor, por baja definitiva o por cambio de plataforma tecnológica, se ejecutará el siguiente procedimiento de archivo final:

1. **Declaración formal de retiro:** La Gerencia General emitirá una declaración formal de retiro del sistema, con fecha efectiva de baja y motivo del retiro.
2. **Congelamiento del paquete de validación:** El paquete de validación en su estado final se congela como documento histórico. No se realizarán modificaciones posteriores.
3. **Generación del acta de archivo final:** El Responsable de TI generará un acta de archivo final que incluye: la versión final del sistema retirada, la fecha de retiro, el inventario completo de la documentación archivada, la ubicación de archivo y el período de retención adicional aplicable.
4. **Transferencia de custodia:** Si el Responsable de TI que gestionó el sistema durante su vida útil ya no está en la organización al momento del retiro, la custodia se transfiere formalmente al sucesor en el cargo o a la función que designe la Gerencia General.
5. **Inicio del período de retención adicional:** El período de retención adicional post-retiro comienza en la fecha de la declaración formal de retiro, conforme a los plazos establecidos en la Sección 3.
6. **Eliminación controlada al vencimiento:** Al vencimiento de todos los períodos de retención aplicables, el Responsable de Custodia ejecuta la eliminación controlada de la documentación, previa autorización de la Gerencia General, dejando constancia del acto en el registro histórico de la organización.

---

## 13. Firmas de Aceptación del Procedimiento

El presente documento establece el marco de archivo, retención y control posterior de cambios para FamSPI v1.0.0. Su aceptación formal por parte de los responsables indicados confirma el compromiso de la organización con el mantenimiento del estado validado del sistema y con la gestión controlada de su ciclo de vida documental.

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable de Tecnología de la Información (Custodia y Control de Cambios) | Pendiente | Pendiente | Pendiente |
| Responsable de Calidad / Función equivalente (Supervisión documental) | Pendiente | Pendiente | Pendiente |
| Gerencia General (Autorización y aprobación) | Pendiente | Pendiente | Pendiente |

---

*Documento emitido conforme al marco GEON/OMCL Annex 2 adoptado como buena práctica interna. FamProject no es un OMCL ni declara cumplimiento de GMP o ISO/IEC 17025. Este documento es de uso interno y no está destinado a presentación ante autoridades regulatorias de medicamentos.*

*Versión 1.0 — Emitido: 2026-05-13 — Estado: Vigente*
