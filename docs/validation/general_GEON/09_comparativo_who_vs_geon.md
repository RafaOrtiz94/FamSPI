# Análisis Comparativo: Variante WHO vs. Variante GEON/OMCL Annex 2

**Sistema:** FamSPI v1.0.0
**Versión del documento:** 1.0
**Fecha de emisión:** 2026-05-13
**Clasificación:** Documento de uso interno

> **Nota:** Este documento es de uso interno. No se incluye en el paquete DOCX principal de ninguna de las variantes. Sirve como soporte de decisión para la organización sobre cuál variante adoptar formalmente.

---

## 1. Descripción de las Variantes

### Variante WHO

La variante WHO de FamSPI v1.0.0 está estructurada sobre la base metodológica de **WHO TRS 1019 Annex 3 Appendix 5**, el marco de la Organización Mundial de la Salud para la validación de sistemas computarizados en el contexto de las buenas prácticas de fabricación y de laboratorio. Esta variante genera un paquete documental de **16 documentos**, organizados en áreas temáticas que cubren exhaustivamente cada dimensión del ciclo de validación: desde la justificación del sistema y la especificación de requisitos hasta los informes de prueba por área funcional, los informes de defectos técnicos, las matrices de trazabilidad por área y los informes de integridad arquitectónica.

La variante WHO es más granular en su estructura: desagrega el análisis por módulo o área funcional, genera informes separados de IQ, OQ y PQ por área, y exige una cobertura documental más amplia en cada fase. Es el marco de referencia reconocido internacionalmente para sistemas computarizados en entornos regulados por autoridades de medicamentos o laboratorios de control oficial, aunque su adopción no está limitada exclusivamente a esos contextos.

### Variante GEON/OMCL Annex 2

La variante GEON de FamSPI v1.0.0 está estructurada sobre la base metodológica de **GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2**, el marco de los laboratorios oficiales de control de medicamentos europeos adoptado por la red OMCL. Esta variante genera un paquete documental de **8 documentos**, diseñados para cubrir el ciclo completo de validación de manera directa y operativa: especificación de requisitos, análisis de riesgo y plan de validación, diseño técnico y funcional, trazabilidad, protocolos de prueba integrados e informe final de liberación.

La variante GEON concentra en menos documentos toda la información necesaria para la validación, privilegiando la claridad operativa, la facilidad de ejecución y el mantenimiento posterior. Es especialmente adecuada para sistemas computarizados complejos con múltiples módulos que necesitan un marco riguroso pero ejecutable sin una estructura organizacional de calidad de gran escala.

---

## 2. Matriz Comparativa

| Criterio | Variante WHO | Variante GEON/OMCL Annex 2 | Ventaja | Riesgo | Recomendación |
|---|---|---|---|---|---|
| **1. Alineación metodológica** | Basada en WHO TRS 1019 Annex 3 Appendix 5, reconocida internacionalmente en entornos regulados por autoridades de medicamentos. Alta alineación con marcos GMP y de laboratorio oficial. | Basada en GEON/OMCL Annex 2, reconocida en la red europea de laboratorios oficiales de control de medicamentos. Alta alineación con sistemas computarizados de laboratorio y gestión. | WHO para exposición internacional; GEON para contextos prácticos de laboratorio y gestión interna | WHO puede generar expectativa implícita de cumplimiento GMP que FamProject no declara; GEON puede ser menos reconocida por auditores externos ajenos al contexto OMCL | Para FamProject, GEON es metodológicamente más honesto dado que la organización no declara cumplimiento GMP ni opera como OMCL |
| **2. Complejidad documental** | 16 documentos estructurados en áreas temáticas. Cada área funcional tiene su propia secuencia de informes IQ/OQ/PQ, matrices y análisis de defectos. Alto volumen documental por diseño. | 8 documentos que cubren el ciclo completo. Los protocolos de prueba integran IQ, OQ y PQ en documentos consolidados por fase. Volumen documental manejable para un equipo de TI pequeño. | GEON — menor carga documental sin sacrificar rigor en los puntos críticos | GEON puede percibirse como insuficiente ante auditores que esperan la granularidad de WHO; WHO puede volverse inmanejable para un equipo pequeño | GEON para equipos con recursos limitados; WHO para organizaciones con función de calidad dedicada |
| **3. Facilidad de ejecución de protocolos** | Los protocolos de prueba están desagregados por área funcional, lo que facilita la asignación de responsables por módulo pero multiplica el número de documentos a gestionar durante la ejecución. | Los protocolos de prueba están integrados en documentos únicos por fase (IQ, OQ, PQ), con todos los casos de prueba en un solo lugar. La ejecución es más lineal y menos fragmentada. | GEON — ejecución más sencilla y menos susceptible a errores de coordinación documental | En sistemas muy grandes, la integración en pocos documentos puede hacer los protocolos largos y difíciles de gestionar si no se estructuran cuidadosamente | GEON para sistemas de hasta 20-30 módulos; WHO para sistemas muy grandes con equipos especializados por área |
| **4. Defensa en auditoría externa** | Más reconocible para auditores externos familiarizados con marcos WHO o ICH. La granularidad documental facilita demostrar cobertura exhaustiva módulo por módulo. | Menos conocida fuera del contexto OMCL europeo, pero estructuralmente sólida y trazable. Un auditor externo competente puede seguir la lógica del paquete sin dificultad si se explica el marco adoptado. | WHO en auditorías externas ante autoridades de medicamentos o inspecciones internacionales | Adoptar WHO sin la infraestructura organizacional para mantenerlo puede generar un paquete incompleto que sea peor que un GEON bien ejecutado | Para auditorías externas ante reguladores, WHO; para validación interna rigurosa sin exposición regulatoria inmediata, GEON |
| **5. Claridad para Gerencia General** | La estructura de 16 documentos puede resultar difícil de interpretar para directivos sin formación técnica en validación. El volumen puede oscurecer los puntos de decisión clave. | La estructura de 8 documentos es más directa. El informe final (documento 07) consolida el estado de la validación de manera clara y accesible para la toma de decisiones por parte de la Gerencia. | GEON — más claro para directivos y para comunicación interna de resultados | GEON puede dar la impresión de menor rigor si no se comunica adecuadamente la solidez del marco adoptado | GEON para organizaciones donde la Gerencia General necesita entender y aprobar el proceso de validación sin intermediarios técnicos |
| **6. Carga de mantenimiento posterior** | Alta. Cada cambio en el sistema puede requerir actualización de múltiples documentos en varias áreas. La propagación de cambios en la documentación es más compleja y costosa. | Moderada. Los cambios se documentan en menos lugares. El proceso de control de cambios (documento 08) es más sencillo de ejecutar y mantener actualizado. | GEON — menor carga de mantenimiento, lo que aumenta la probabilidad de que el estado validado se mantenga activo y al día | Una carga de mantenimiento baja puede llevar a subestimar la importancia de documentar cambios. La disciplina de control de cambios es igualmente crítica en ambas variantes. | GEON para organizaciones que necesitan un sistema de gestión de cambios sostenible a largo plazo |
| **7. Nivel de detalle técnico** | Muy alto. Los informes de diseño técnico, los informes de defectos y los análisis de integridad arquitectónica generan un nivel de documentación técnica que cubre exhaustivamente la arquitectura del sistema. | Alto, pero concentrado. El informe de diseño técnico (documento 04) cubre con profundidad los aspectos críticos de la arquitectura sin multiplicar los documentos de análisis técnico. | WHO para trazabilidad técnica extremadamente granular; GEON para documentación técnica completa y manejable | En GEON, la profundidad del análisis técnico depende del cuidado con que se redacte el documento de diseño. Un documento de diseño superficial compromete toda la variante. | GEON con un documento de diseño técnico riguroso es equivalente en sustancia a la variante WHO |
| **8. Compatibilidad con ciclo DQ/IQ/OQ/PQ** | Totalmente compatible. El ciclo DQ/IQ/OQ/PQ está explícitamente estructurado en la organización documental, con informes dedicados por fase y por área. | Totalmente compatible. El ciclo DQ/IQ/OQ/PQ está cubierto íntegramente: DQ en los documentos 01, 04 y 05; IQ, OQ y PQ en los protocolos del documento 06 e informe del 07. | Equivalente — ambas variantes cubren el ciclo completo | En GEON, la integración de fases en menos documentos puede hacer menos visible la separación formal entre DQ, IQ, OQ y PQ para un auditor que busca documentos individuales por fase | Aclarar la correspondencia DQ/IQ/OQ/PQ al presentar el paquete GEON a auditores externos |
| **9. Facilidad para generar evidencia** | La estructura desagregada facilita la asignación de responsables de evidencia por área, pero también multiplica los puntos donde la evidencia debe ser capturada, organizada y referenciada. | Los protocolos integrados centralizan la evidencia por fase, lo que simplifica la organización de capturas de pantalla, logs y registros. La trazabilidad de evidencia es directa y fácil de auditar. | GEON — menor fragmentación de la evidencia, mayor claridad en la organización | La centralización puede hacer los protocolos más largos y requerir mayor disciplina en la ejecución para no omitir evidencia de casos específicos | GEON favorece la generación de evidencia completa si los protocolos están bien estructurados desde el diseño |
| **10. Riesgo de sobre-documentación** | Alto. La estructura de 16 documentos puede generar redundancia documental significativa, especialmente en áreas con pocos requisitos específicos o módulos simples. El riesgo de producir documentos extensos con contenido escaso es real. | Bajo a moderado. La integración documental reduce la redundancia. El riesgo principal es documentar con insuficiente profundidad en algún punto crítico, no el de sobre-documentar. | GEON — menor riesgo de generar documentación sin valor agregado | Un paquete GEON que intente replicar la granularidad de WHO en 8 documentos puede volverse tan extenso como WHO sin la ventaja de la estructura desagregada | Definir claramente el nivel de detalle objetivo para cada documento GEON antes de redactarlo |
| **11. Riesgo de quedarse corto en evidencia** | Bajo. La estructura desagregada y la exigencia de informes por área hacen difícil omitir cobertura de un módulo completo. | Moderado. La integración en pocos documentos exige mayor disciplina del autor para garantizar que todos los módulos y requisitos estén cubiertos. Una RTM mal construida puede ocultar huecos de cobertura. | WHO — la estructura desagregada actúa como red de seguridad contra omisiones | En GEON, la RTM (documento 03) es el mecanismo crítico de control de cobertura. Una RTM incompleta expone el paquete completo. | En GEON, invertir el tiempo necesario en construir una RTM completa y precisa es no negociable |
| **12. Mejor uso recomendado por tipo de escenario** | Organizaciones con función de calidad dedicada, exposición a auditorías externas regulatorias, sistemas en entornos GMP o de laboratorio oficial, o proyectos con recursos suficientes para sostener 16 documentos actualizados. | Organizaciones con equipos de TI ágiles, sistemas computarizados complejos de gestión interna, prioridad de ejecución práctica, o contextos donde la validación debe ser rigurosa pero manejable sin una función de calidad de gran escala. | Depende del contexto organizacional — no hay una variante universalmente superior | Elegir la variante equivocada respecto al contexto real de la organización genera un paquete que no puede sostenerse en el tiempo | Evaluar el contexto regulatorio real, los recursos disponibles y los objetivos de la validación antes de decidir |

---

## 3. Fortalezas y Debilidades por Variante

### Variante WHO — Fortalezas

- Reconocimiento internacional amplio: el marco WHO TRS 1019 es conocido por auditores regulatorios en todo el mundo.
- Cobertura documental exhaustiva: la desagregación por área funcional reduce el riesgo de omitir cobertura en módulos específicos.
- Separación clara de fases: cada fase del ciclo DQ/IQ/OQ/PQ tiene documentos propios, lo que facilita la trazabilidad formal de la secuencia de validación.
- Red de seguridad documental: la multiplicidad de documentos actúa como red de seguridad ante omisiones, porque cada área exige sus propios informes.
- Adecuada para entornos regulados formales: si FamProject en el futuro necesita presentar su validación ante un auditor externo de salud o calidad, el paquete WHO tiene mayor reconocimiento inmediato.

### Variante WHO — Debilidades

- Alta carga de generación y mantenimiento: producir y actualizar 16 documentos requiere más tiempo, coordinación y recursos que 8.
- Riesgo de redundancia: en un sistema con módulos pequeños o de baja complejidad, algunos documentos pueden resultar artificialmente extensos o repetitivos.
- Menor agilidad de ejecución: la fragmentación documental complica la coordinación de la ejecución de pruebas y la recolección de evidencia.
- Posible desalineación con la realidad organizacional: si la organización no tiene una función de calidad dedicada, mantener 16 documentos actualizados puede volverse inviable a mediano plazo.

### Variante GEON/OMCL Annex 2 — Fortalezas

- Eficiencia documental: 8 documentos que cubren el ciclo completo con menos redundancia y mayor claridad operativa.
- Mayor facilidad de ejecución: protocolos integrados por fase facilitan la coordinación de la ejecución y la organización de evidencia.
- Menor carga de mantenimiento: el control de cambios y la actualización de documentación es más sencillo con un paquete más compacto.
- Claridad para la Gerencia General: el informe final consolidado es más accesible para directivos sin formación técnica específica en validación.
- Adecuada para sistemas de gestión internos complejos: el marco GEON está diseñado para sistemas computarizados con múltiples módulos funcionales, lo que se alinea bien con la arquitectura de FamSPI.

### Variante GEON/OMCL Annex 2 — Debilidades

- Menor reconocimiento fuera del contexto OMCL europeo: auditores externos no familiarizados con la red OMCL pueden no reconocer el marco inmediatamente.
- Mayor dependencia de la calidad de la RTM: la trazabilidad de cobertura depende crítica y casi exclusivamente de que la RTM esté completa y precisa.
- Riesgo de infra-documentación si no se ejecuta con disciplina: la integración en pocos documentos exige mayor cuidado del autor para garantizar profundidad en cada sección.
- Separación de fases menos visible: la integración de IQ, OQ y PQ en documentos consolidados puede dificultar la verificación formal de la secuencia de fases ante un auditor que busca documentos individuales.

---

## 4. Compatibilidad entre Variantes

Las variantes WHO y GEON no son excluyentes. Ambas cubren el mismo sistema (FamSPI v1.0.0), el mismo alcance (primera línea base, Gobierno y Seguridad como dimensión transversal, Permisos y Vacaciones como módulo funcional activo) y la misma infraestructura tecnológica (backend Node.js/Express, base de datos PostgreSQL, frontend React, servicios en Google Cloud).

Las dos variantes comparten:

- El mismo conjunto de requisitos URS como base de la validación.
- El mismo ciclo de vida DQ/IQ/OQ/PQ aplicado al mismo sistema.
- La misma arquitectura técnica documentada en el diseño.
- Los mismos módulos funcionales bajo validación.
- Los mismos tipos de evidencia objetiva requerida para la liberación.

Esto significa que las dos variantes son **complementarias**: el paquete GEON puede utilizarse como variante principal de trabajo operativo, y el paquete WHO puede conservarse como referencia marco o versión extendida de respaldo. No es necesario elegir una y descartar la otra; pueden coexistir como capas de documentación del mismo sistema validado, siempre que se mantenga la coherencia entre ambas en cuanto a requisitos, alcance y resultados de prueba.

---

## 5. Conclusión Comparativa

Ninguna de las dos variantes debe ser adoptada automáticamente como definitiva. La decisión debe basarse en el contexto organizacional real de FamProject, los recursos disponibles para sostener el paquete en el tiempo y los objetivos específicos de la validación.

**Variante WHO:** Es el marco más completo como referencia normativa general. Su adopción es especialmente recomendable si la organización necesita mayor cobertura regulatoria formal, planea presentar el paquete de validación ante auditores externos especializados en marcos WHO o GMP, o tiene una función de calidad con recursos suficientes para generar y mantener 16 documentos actualizados de manera continua. Si la prioridad es la exhaustividad documental y la defensa regulatoria formal, WHO es la variante más robusta.

**Variante GEON/OMCL Annex 2:** Es el marco más directo y práctico para sistemas computarizados complejos de gestión interna. Su adopción es especialmente recomendable si la prioridad es la velocidad de ejecución de los protocolos de prueba, la claridad operativa para el equipo de TI, el mantenimiento ágil del estado validado a lo largo del ciclo de vida del sistema, y la comunicación efectiva de los resultados a la Gerencia General. Si el objetivo es completar la validación de manera rigurosa y sostenible con un equipo reducido, GEON es la variante más ejecutable.

**Para FamSPI v1.0.0 en el contexto actual de FamProject:** La variante GEON puede ser más fácil de ejecutar y mantener como variante principal de trabajo. Su estructura de 8 documentos cubre el ciclo completo de validación con un nivel de rigor apropiado para un sistema computarizado interno de gestión corporativa, sin exigir una infraestructura organizacional de calidad que FamProject no declara tener. La variante WHO puede mantenerse como referencia marco o versión extendida de respaldo, disponible si la organización decide en el futuro ampliar su exposición regulatoria o presentar la validación ante auditores externos especializados.

La decisión final sobre cuál variante adoptar formalmente como paquete de validación principal de FamSPI v1.0.0 corresponde a la organización, en conjunto con la Gerencia General y el equipo de TI, considerando el contexto regulatorio actual y futuro, los recursos disponibles para la ejecución y el mantenimiento, y los objetivos estratégicos de la validación.

---

## 6. Recomendación Preliminar

Con base en el análisis comparativo presentado en este documento, y sin imponer una decisión ni presumir cumplimiento regulatorio de ningún tipo, se formula la siguiente recomendación preliminar de soporte a la decisión:

- **Adoptar GEON/OMCL Annex 2 como variante principal de trabajo** para la ejecución, mantenimiento y control de cambios de la validación de FamSPI v1.0.0. Esta variante es ejecutable con el equipo y los recursos actuales de FamProject, produce un paquete coherente y trazable, y establece una base sólida para el ciclo de vida validado del sistema.

- **Conservar la variante WHO como referencia marco y versión extendida de respaldo**, disponible para consulta, para comunicación con partes externas que soliciten una validación más granular, o para servir de guía si la organización decide en el futuro ampliar la cobertura documental de algún módulo específico.

- **Ejecutar los protocolos de prueba de la variante GEON en primer lugar**, dado que su estructura integrada facilita la coordinación y la recolección de evidencia. Los resultados de ejecución de GEON pueden servir como base para completar o actualizar la variante WHO si se decide hacerlo posteriormente.

Esta recomendación no constituye una decisión vinculante. La organización, la Gerencia General y el equipo de TI deben revisar este análisis y tomar la decisión que mejor se alinee con sus objetivos y recursos.

---

*Documento de uso interno. No se incluye en el paquete DOCX principal de ninguna de las variantes de validación. FamProject no es un OMCL ni declara cumplimiento de GMP o ISO/IEC 17025.*

*Versión 1.0 — Emitido: 2026-05-13*
