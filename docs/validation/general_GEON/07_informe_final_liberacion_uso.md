# Informe Final de Validación y Liberación para Uso

**Sistema:** FamSPI v1.0.0
**Variante de validación:** GEON/OMCL Annex 2 — adoptado como buena práctica
**Versión del documento:** 1.0
**Fecha de emisión:** 2026-05-13
**Estado del documento:** EMITIDO — pendiente de cierre de protocolos de prueba
**Clasificación:** Documento de validación interno — no destinado a presentación regulatoria ante autoridades de medicamentos

---

## 1. Resumen Ejecutivo de la Validación

Este informe constituye el documento de cierre del paquete de validación de FamSPI v1.0.0 conforme a la variante GEON/OMCL Annex 2, adoptada por FamProject como marco de buena práctica para la validación de sistemas computarizados internos. El presente informe consolida el estado de todos los elementos del paquete de validación, declara las condiciones de liberación formal para uso productivo y registra la recomendación técnica basada en la evidencia disponible al momento de su emisión.

FamSPI v1.0.0 es el sistema de gestión de proyectos, permisos, recursos y operaciones corporativas de FamProject. Su primera línea base establece la plataforma tecnológica central sobre la cual se construyen y gestionan todos los procesos internos de la organización. La validación se ha estructurado en tres fases formales: Calificación de Instalación (IQ), Calificación de Operación (OQ) y Calificación de Desempeño / Prueba de Aceptación de Usuario (PQ/UAT), precedidas por la Calificación de Diseño (DQ) en su equivalente funcional de especificación de requisitos.

Al momento de emisión de este informe, los protocolos de prueba IQ, OQ y PQ/UAT han sido diseñados, estructurados y documentados, pero **no han sido ejecutados**. Por tanto, la validación formal de FamSPI v1.0.0 se encuentra en estado **PENDIENTE DE EJECUCIÓN**. Este informe no constituye liberación efectiva del sistema; establece el marco, las condiciones y los criterios que deben cumplirse para que dicha liberación sea otorgada.

---

## 2. Alcance Final Cubierto

La validación de FamSPI v1.0.0 cubre tres capas de alcance distintas y complementarias:

**Capa 1 — Primera línea base del sistema FamSPI global:** Se valida FamSPI v1.0.0 como la primera versión estable y controlada del sistema, estableciendo la infraestructura tecnológica, la arquitectura de datos, los mecanismos de autenticación, la lógica de negocio central y la interfaz de usuario como conjunto funcional integrado. Esta capa garantiza que el sistema en su totalidad cumple los requisitos de instalación, operación y desempeño definidos en el URS.

**Capa 2 — Gobierno y Seguridad como dimensión transversal:** El módulo de gobierno, gestión de permisos de acceso y control de roles se valida como dimensión transversal que afecta a todos los módulos funcionales del sistema. La correcta configuración y operación de esta capa es condición necesaria para que cualquier otro módulo pueda considerarse validado en su contexto de uso real.

**Capa 3 — Permisos y Vacaciones como módulo funcional activo:** El módulo de gestión de permisos laborales y vacaciones se valida como el primer módulo funcional de negocio activo en producción, representando el flujo completo de solicitud, aprobación, rechazo y registro de ausencias del personal.

**Frase obligatoria de alcance:** La validación de FamSPI v1.0.0 cubre el sistema en su primera línea base estable, incluyendo la capa de gobierno y seguridad como dimensión transversal de control, y el módulo de Permisos y Vacaciones como primer módulo funcional de negocio en producción, constituyendo el punto de partida del ciclo de vida validado del sistema bajo el marco GEON/OMCL Annex 2 adoptado como buena práctica por FamProject.

---

## 3. Resumen de Requisitos de Usuario (URS)

El documento URS de FamSPI v1.0.0 define los requisitos funcionales y no funcionales que el sistema debe satisfacer para ser considerado apto para uso. La siguiente tabla resume el estado de cobertura de requisitos al momento de emisión de este informe.

| Concepto | Cantidad | Observación |
|---|---|---|
| Total de requisitos URS definidos | 52 | Requisitos documentados en el URS formal de FamSPI v1.0.0 |
| Requisitos cubiertos en diseño (DQ/FRS) | 52 | Todos los requisitos tienen trazabilidad en el documento de diseño y en la RTM |
| Requisitos verificados mediante IQ | 0 | PENDIENTE DE EJECUCIÓN — protocolo IQ diseñado, no ejecutado |
| Requisitos verificados mediante OQ | 0 | PENDIENTE DE EJECUCIÓN — 16 casos de prueba diseñados, no ejecutados |
| Requisitos verificados mediante PQ/UAT | 0 | PENDIENTE DE EJECUCIÓN — 6 escenarios diseñados, no ejecutados |
| Requisitos con verificación completa | 0 | Ninguno verificado hasta ejecución de protocolos |
| Requisitos con desviaciones abiertas | 0 | Sin desviaciones registradas al momento de emisión |

La trazabilidad completa entre requisitos URS, casos de diseño y casos de prueba está documentada en la Matriz de Trazabilidad de Requisitos (RTM) — documento 03 del paquete de validación GEON.

---

## 4. Resultado IQ — Calificación de Instalación

**Estado: PENDIENTE DE EJECUCIÓN**

La Calificación de Instalación (IQ) verifica que el sistema FamSPI v1.0.0 ha sido instalado conforme a sus especificaciones técnicas y que el entorno de ejecución cumple los requisitos necesarios para la operación controlada del sistema.

El protocolo IQ cubre los siguientes aspectos:

- Verificación de la versión del sistema instalada en el entorno de producción (FamSPI v1.0.0).
- Confirmación de la configuración del servidor backend (Node.js, Express, versiones de dependencias principales).
- Verificación del motor de base de datos (PostgreSQL) y de la configuración de conexión segura.
- Comprobación de la disponibilidad y correcta configuración del entorno frontend (React, rutas, build de producción).
- Verificación de la configuración de variables de entorno críticas (credenciales, claves de sesión, endpoints de servicios externos).
- Confirmación de la integración con servicios de terceros activos (Google Sheets API, Google Cloud Run, notificaciones).
- Verificación de la configuración de copias de seguridad y procedimientos de recuperación básicos.
- Documentación del entorno de instalación como línea base formal de la versión v1.0.0.

El protocolo IQ no ha sido ejecutado. Su ejecución es condición necesaria para proceder a la OQ y posteriormente a la PQ/UAT. La aprobación de la IQ constituye evidencia objetiva de que el sistema está correctamente instalado y listo para verificación funcional.

---

## 5. Resultado OQ — Calificación de Operación

**Estado: PENDIENTE DE EJECUCIÓN**

La Calificación de Operación (OQ) verifica que el sistema FamSPI v1.0.0 opera conforme a sus especificaciones funcionales bajo condiciones controladas. Los casos de prueba OQ evalúan el comportamiento del sistema ante entradas válidas, entradas inválidas y condiciones de frontera, verificando que el sistema responde de manera correcta y consistente.

El protocolo OQ comprende **16 casos de prueba** que cubren las siguientes áreas funcionales:

- Autenticación y control de acceso por roles (casos OQ-001 a OQ-004): inicio de sesión válido, credenciales incorrectas, bloqueo por intentos fallidos, restricción de acceso por rol.
- Gestión de permisos laborales — flujo de solicitud y aprobación (casos OQ-005 a OQ-008): creación de solicitud, aprobación por supervisor, rechazo con motivo, visualización de estado.
- Gestión de vacaciones — cálculo y registro (casos OQ-009 a OQ-011): solicitud de vacaciones, cálculo de días disponibles, registro de período aprobado.
- Gobierno del sistema — administración de roles y permisos (casos OQ-012 a OQ-014): creación de rol, asignación de permisos, propagación de restricciones.
- Integridad de datos y trazabilidad de auditoría (casos OQ-015 a OQ-016): registro de eventos de auditoría, integridad de datos tras operaciones críticas.

Cada caso de prueba incluye: identificador, objetivo, precondiciones, pasos de ejecución, resultado esperado, resultado real (a completar durante ejecución), estado (Aprobado / Fallido / Bloqueado) y referencia al requisito URS correspondiente.

---

## 6. Resultado PQ/UAT — Calificación de Desempeño / Prueba de Aceptación de Usuario

**Estado: PENDIENTE DE EJECUCIÓN**

La Calificación de Desempeño / Prueba de Aceptación de Usuario (PQ/UAT) verifica que el sistema FamSPI v1.0.0 opera de manera satisfactoria en condiciones de uso real, ejecutado por usuarios representativos de los roles operacionales definidos. Esta fase confirma que el sistema cumple los requisitos de negocio tal como fueron definidos en el URS y que los usuarios pueden operar el sistema de manera efectiva y consistente.

El protocolo PQ/UAT comprende **6 escenarios de aceptación** que cubren:

- **Escenario UAT-001 — Ciclo completo de solicitud de permiso:** Un empleado crea una solicitud de permiso laboral, el supervisor la revisa y aprueba, y el sistema registra el resultado con trazabilidad completa.
- **Escenario UAT-002 — Ciclo de rechazo con notificación:** Un supervisor rechaza una solicitud de permiso con motivo registrado y el sistema notifica al solicitante.
- **Escenario UAT-003 — Gestión de vacaciones por el responsable de RRHH:** El responsable de recursos humanos registra y consulta períodos de vacaciones de múltiples empleados de manera simultánea.
- **Escenario UAT-004 — Control de acceso diferenciado por rol:** Usuarios con distintos roles intentan acceder a funcionalidades restringidas, verificando que el sistema aplica correctamente las restricciones de acceso.
- **Escenario UAT-005 — Administración de usuarios y roles por el administrador del sistema:** El administrador del sistema crea un nuevo usuario, le asigna un rol y verifica que el acceso se aplica correctamente.
- **Escenario UAT-006 — Consulta de historial y trazabilidad:** Un usuario con permisos de auditoría consulta el historial de solicitudes y eventos de auditoría del sistema.

Cada escenario incluye: identificador, objetivo de negocio, usuario representativo ejecutor, pasos del escenario, criterio de aceptación, resultado observado (a completar) y declaración de aceptación del usuario.

---

## 7. Desviaciones y Hallazgos

La siguiente tabla registra las desviaciones y hallazgos identificados durante el proceso de validación. Al momento de emisión de este informe, no se han ejecutado los protocolos de prueba, por lo que no se han identificado desviaciones derivadas de la ejecución.

| ID | Fase | Descripción | Clasificación | Estado |
|---|---|---|---|---|
| — | — | Sin desviaciones registradas al momento de emisión del informe | — | — |

Una vez ejecutados los protocolos IQ, OQ y PQ/UAT, cualquier desviación identificada deberá registrarse en esta tabla con su clasificación (Crítica / Mayor / Menor / Observación), la acción correctiva asociada y el estado de cierre. Este informe deberá actualizarse con la versión final de la tabla de desviaciones antes de otorgar la liberación formal.

---

## 8. Acciones Correctivas

La siguiente tabla se completará durante y después de la ejecución de los protocolos de prueba, registrando las acciones correctivas asociadas a cada desviación identificada.

| ID Desviación | Descripción de la Acción Correctiva | Responsable | Fecha Límite | Estado | Evidencia de Cierre |
|---|---|---|---|---|---|
| — | Tabla a completar tras ejecución de protocolos | — | — | — | — |

Toda acción correctiva clasificada como respuesta a una desviación Crítica o Mayor debe ser cerrada y verificada antes de otorgar la liberación formal del sistema. Las acciones correctivas asociadas a desviaciones Menores u Observaciones pueden cerrarse durante el período inicial de operación supervisada, siempre que no comprometan la integridad, seguridad o trazabilidad del sistema.

---

## 9. Riesgos Residuales

La evaluación de riesgos de FamSPI v1.0.0, documentada en el documento 02 del paquete de validación GEON (Análisis de Riesgo y Plan de Validación), identificó los riesgos inherentes al sistema y definió los controles de mitigación correspondientes. Tras la aplicación de controles de diseño, configuración y proceso, el perfil de riesgo residual del sistema es el siguiente:

- **Perfil general de riesgo residual:** BAJO. Los riesgos de mayor impacto potencial (pérdida de datos, acceso no autorizado, corrupción de registros de auditoría) han sido mitigados mediante controles de diseño específicos, incluyendo control de roles granular, registro de auditoría inmutable, copias de seguridad programadas y validación de entradas en frontend y backend.

- **Riesgos residuales aceptados con monitoreo activo:**
  - Dependencia de disponibilidad de servicios externos (Google Cloud Run, Google Sheets API): mitigado mediante manejo de errores y notificaciones de fallo, riesgo residual bajo.
  - Gestión de sesiones y tokens de autenticación: mitigado mediante expiración configurable de sesiones y renovación controlada de tokens, riesgo residual bajo.
  - Integridad de datos en operaciones concurrentes: mitigado mediante transacciones de base de datos y manejo de conflictos en capa de servicio, riesgo residual bajo.
  - Formación insuficiente de usuarios finales: mitigado mediante guías de usuario y período de operación supervisada, riesgo residual bajo condicionado a ejecutar plan de capacitación.

- **Riesgos que se confirmarán tras ejecución de protocolos:** Cualquier riesgo no anticipado identificado durante la ejecución de IQ, OQ o PQ/UAT será documentado, clasificado y gestionado mediante el proceso de control de cambios y desviaciones antes de la liberación formal.

---

## 10. Evidencias Revisadas

Para la emisión de la liberación formal de FamSPI v1.0.0, deberán estar disponibles y revisadas las siguientes categorías de evidencia objetiva:

- Documento URS firmado con todos los requisitos definidos y aprobados.
- Documento de Diseño Funcional / FRS con trazabilidad completa a URS.
- Matriz de Trazabilidad de Requisitos (RTM) actualizada con referencias a casos de prueba.
- Análisis de Riesgo y Plan de Validación aprobado.
- Protocolo IQ ejecutado con registro de resultados por ítem verificado.
- Protocolo OQ ejecutado con registro de resultados de los 16 casos de prueba (resultado real, estado y firma del ejecutor).
- Protocolo PQ/UAT ejecutado con registro de resultados de los 6 escenarios y declaraciones de aceptación firmadas por usuarios representativos.
- Registro de desviaciones completo con estado de cierre o aceptación formal de cada desviación identificada.
- Registro de acciones correctivas con evidencia de implementación y verificación.
- Capturas de pantalla o registros de log que sustenten los resultados de prueba declarados.
- Declaraciones de capacitación de usuarios, cuando aplique.
- Aprobaciones formales de liberación por parte de los roles responsables (técnico, funcional y Gerencia General).

---

## 11. Conclusión

El proceso de validación de FamSPI v1.0.0 bajo el marco GEON/OMCL Annex 2, adoptado como buena práctica por FamProject, ha completado la fase de planificación y diseño de protocolos. El paquete de validación incluye la especificación de requisitos (URS), el análisis de riesgo y plan de validación, los informes de diseño técnico y funcional, la matriz de trazabilidad de requisitos, y los protocolos de prueba IQ, OQ y PQ/UAT completamente diseñados.

**El resultado final de validación de FamSPI v1.0.0 queda sujeto a la ejecución y aprobación de IQ, OQ y PQ/UAT, al cierre o aceptación formal de desviaciones y a la disponibilidad de evidencia objetiva suficiente.**

No se emite declaración de conformidad, aprobación ni liberación efectiva del sistema en este momento. Este informe establece el marco de referencia, las condiciones de liberación y la estructura de gobernanza que deberán cumplirse para que FamSPI v1.0.0 sea declarado formalmente liberado para uso productivo.

---

## 12. Condiciones de Liberación

FamSPI v1.0.0 podrá ser declarado formalmente liberado para uso productivo únicamente cuando se cumplan de manera simultánea todas las condiciones siguientes:

1. Todos los requisitos URS definidos tienen trazabilidad verificada en diseño, casos de prueba y evidencia de ejecución.
2. El protocolo IQ ha sido ejecutado en su totalidad y aprobado sin desviaciones críticas abiertas.
3. El protocolo OQ ha sido ejecutado en su totalidad, todos los 16 casos de prueba tienen resultado registrado, y el porcentaje de aprobación cumple el umbral definido en el plan de validación.
4. El protocolo PQ/UAT ha sido ejecutado en su totalidad, los 6 escenarios han sido aceptados por los usuarios representativos designados y las declaraciones de aceptación han sido firmadas.
5. No existen desviaciones clasificadas como Críticas con estado Abierto al momento de la liberación.
6. Toda desviación clasificada como Mayor ha sido cerrada con acción correctiva verificada o ha sido formalmente aceptada con justificación documentada.
7. Existe evidencia objetiva suficiente (capturas, logs, registros firmados) que sustenta los resultados declarados en los protocolos de prueba.
8. El Responsable Técnico del proyecto ha revisado el paquete completo de evidencia y ha emitido su aprobación técnica documentada.
9. El Responsable Funcional (usuario líder o representante de negocio) ha revisado los resultados de PQ/UAT y ha emitido su aprobación funcional documentada.
10. La Gerencia General ha revisado el informe final de validación y ha emitido su aprobación de liberación documentada.

---

## 13. Recomendación de Liberación

**Estado actual de la recomendación: PENDIENTE**

No es posible emitir una recomendación positiva de liberación en este momento, dado que los protocolos de prueba IQ, OQ y PQ/UAT no han sido ejecutados y no existe evidencia objetiva de los resultados del sistema bajo condiciones de prueba controladas.

La recomendación de liberación quedará condicionada a la ejecución completa de los protocolos de prueba, al cierre o aceptación formal de todas las desviaciones identificadas durante la ejecución, y a la disponibilidad y revisión de evidencia objetiva suficiente por parte de los responsables técnico, funcional y de Gerencia General.

Una vez ejecutados los protocolos y completada la revisión de evidencia, el Responsable de Validación emitirá la recomendación definitiva (positiva, condicional o negativa) y actualizará este informe con la sección de Acta de Liberación Formal completada.

---

## 14. Acta de Liberación Formal

El acta de liberación formal de FamSPI v1.0.0 se emitirá en este documento una vez que todas las condiciones de liberación establecidas en la Sección 12 hayan sido satisfechas. Al momento de la emisión de este informe, todos los campos del acta se encuentran en estado Pendiente.

| Campo | Valor |
|---|---|
| Sistema | FamSPI |
| Versión liberada | v1.0.0 |
| Fecha de liberación formal | Pendiente |
| Entorno de liberación | Pendiente de confirmación en IQ |
| Marco de validación aplicado | GEON/OMCL Annex 2 — adoptado como buena práctica |
| Resultado IQ | Pendiente de ejecución |
| Resultado OQ | Pendiente de ejecución |
| Resultado PQ/UAT | Pendiente de ejecución |
| Desviaciones críticas abiertas | Pendiente de ejecución de protocolos |
| Desviaciones mayores abiertas | Pendiente de ejecución de protocolos |
| Evidencia objetiva disponible | Pendiente de ejecución de protocolos |
| Declaración de uso dentro del alcance | El sistema FamSPI v1.0.0 se libera para uso dentro del alcance definido en el URS y en el presente informe. Cualquier uso fuera de dicho alcance requiere una nueva evaluación de validación. — Pendiente de firma |
| Aprobación técnica (Responsable de TI / Validación) | Pendiente — firma y fecha a registrar tras ejecución |
| Aprobación funcional (Responsable de negocio / usuario líder) | Pendiente — firma y fecha a registrar tras ejecución |
| Aprobación Gerencia General | Pendiente — firma y fecha a registrar tras ejecución |
| Número de versión del informe final aprobado | Pendiente — a asignar en versión final |
| Notas adicionales | — |

---

## 15. Declaración de Sistema en Evolución Controlada

FamSPI no se considera un sistema estático, sino un sistema computarizado en evolución controlada, validado por versión, alcance, riesgo, evidencia objetiva y control de cambios.

Cada nueva versión, módulo o cambio significativo en la infraestructura de FamSPI deberá ser evaluado mediante el proceso de control de cambios definido en el documento 08 del paquete de validación GEON (Archivo, Retención y Control Posterior), determinando el nivel de revalidación proporcional requerido. La liberación de versiones posteriores no invalida la validación de la versión v1.0.0, sino que extiende el ciclo de vida validado del sistema de manera controlada y trazable.

---

*Documento emitido conforme al marco GEON/OMCL Annex 2 adoptado como buena práctica interna. FamProject no es un OMCL ni declara cumplimiento de GMP o ISO/IEC 17025. Este documento es de uso interno y no está destinado a presentación ante autoridades regulatorias de medicamentos.*

*Versión 1.0 — Emitido: 2026-05-13 — Estado: Pendiente de ejecución de protocolos*
