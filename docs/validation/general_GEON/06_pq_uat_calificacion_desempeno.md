# PQ/UAT — Calificación de Desempeño y Aceptación Funcional

**Sistema:** FamSPI v1.0.0
**Documento:** PQ/UAT — Calificación de Desempeño y Aceptación Funcional
**Versión del documento:** 1.0
**Fecha de emisión:** 2026-05-13
**Estado:** PENDIENTE DE EJECUCIÓN
**Marco de referencia:** GAMP 5 Ed. 2, GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2
**Prerrequisito:** IQ aprobado + OQ aprobado

---

## 1. Objetivo PQ/UAT

Verificar que FamSPI v1.0.0 opera correctamente en condiciones representativas del uso real previsto por los usuarios finales, cubriendo los flujos completos de extremo a extremo (end-to-end) para los módulos en alcance validado, y obtener la aceptación funcional formal de los responsables del sistema.

La PQ/UAT no evalúa funciones individuales de forma aislada, sino que confirma que el sistema, en su conjunto, satisface el uso previsto declarado en los Requisitos del Usuario (URS) y que los usuarios finales lo consideran apto para operar en condiciones reales.

---

## 2. Diferencia entre OQ y PQ/UAT

| Aspecto | OQ | PQ/UAT |
|---|---|---|
| Objeto de prueba | Funciones individuales en condiciones controladas | Flujos completos end-to-end en condiciones representativas de uso real |
| Ejecutores | Equipo técnico TI | Usuarios representativos con supervisión de TI |
| Criterio de evaluación | Comportamiento técnico esperado por función | Adecuación para el uso previsto desde la perspectiva del usuario |
| Entorno | Ambiente controlado de prueba/staging | Producción o ambiente equivalente a producción |
| Datos utilizados | Datos de prueba técnicos | Datos representativos realistas |
| Resultado | Evidencia técnica de correcto funcionamiento por caso | Aceptación funcional formal suscrita por responsables |
| Naturaleza | Verificación técnica | Validación funcional |

---

## 3. Prerrequisito

La ejecución de la PQ/UAT requiere que los siguientes prerrequisitos hayan sido completados y aprobados formalmente:

| Prerrequisito | Documento de referencia | Estado |
|---|---|---|
| IQ — Calificación de Instalación aprobada | 04_iq_calificacion_instalacion.md | Pendiente de verificación |
| OQ — Calificación Operacional aprobada | 05_oq_calificacion_operacional.md | Pendiente de verificación |
| Personal participante en PQ/UAT entrenado en el uso de FamSPI v1.0.0 | Registro de entrenamiento | Pendiente |
| Entorno PQ/UAT habilitado y confirmado como representativo | Checklist de entorno | Pendiente |

No debe iniciarse la ejecución de la PQ/UAT si alguno de los prerrequisitos anteriores presenta estado abierto o no aprobado.

---

## 4. Entorno PQ/UAT

| Parámetro | Descripción |
|---|---|
| Entorno de ejecución | Producción o ambiente equivalente a producción (Cloud Run GCP) |
| URL del sistema | Definida en el entorno de despliegue correspondiente |
| Base de datos | PostgreSQL — instancia de producción o instancia equivalente |
| Backend | Node.js / Express — versión desplegada en Cloud Run |
| Frontend | React — versión desplegada y accesible por los participantes |
| Datos utilizados | Datos de prueba representativos y realistas; no se utilizan datos reales de producción de carácter crítico o sensible |
| Participantes | Usuarios finales representativos + responsable funcional + supervisor TI |
| Acceso | Acceso mediante credenciales asignadas a los roles correspondientes |
| Monitoreo | Supervisor TI registra resultados, capturas y evidencias durante la ejecución |

---

## 5. Uso Previsto

FamSPI v1.0.0 se utiliza para gestionar solicitudes de permisos y vacaciones del personal institucional, permitir la revisión y aprobación de dichas solicitudes por parte de responsables autorizados, consultar el historial de solicitudes y decisiones, y garantizar la trazabilidad completa de las decisiones sobre el personal.

La PQ/UAT verifica que estos flujos funcionen correctamente en condiciones representativas del uso real previsto, con participación de los usuarios finales, y que el sistema cumpla con su propósito institucional dentro del alcance validado definido:

- **FamSPI global:** sistema computarizado institucional en su primera línea base v1.0.0.
- **Gobierno y Seguridad:** dimensión transversal que garantiza el control de acceso, los roles y la trazabilidad.
- **Permisos y Vacaciones:** módulo funcional activo objeto de validación funcional completa.

---

## 6. Participantes

| Rol | Función en PQ/UAT | Nombre | Firma | Estado |
|---|---|---|---|---|
| Usuario final (empleado) | Ejecuta solicitudes de permiso y vacaciones como usuario normal, consulta estado e historial | Pendiente | Pendiente | Pendiente |
| Responsable funcional (aprobador) | Ejecuta aprobaciones y rechazos de solicitudes, confirma aceptación funcional | Pendiente | Pendiente | Pendiente |
| Supervisor TI | Registra resultados, toma capturas, documenta evidencias y desviaciones | Pendiente | Pendiente | Pendiente |
| Gerencia General | Firma el acta de aceptación funcional final | Pendiente | Pendiente | Pendiente |

---

## 7. Escenarios PQ/UAT

### 7.1 Tabla de Escenarios

| ID | Escenario | Participantes | URS relacionados | Resultado esperado | Resultado observado | Evidencia | Desviación | Estado | Observación |
|---|---|---|---|---|---|---|---|---|---|
| PQ-001 | Flujo completo de permiso end-to-end | Usuario final + Responsable | URS-001, URS-003, URS-004, URS-007 | Solicitud creada → notificación al responsable → aprobación registrada → estado "aprobado" visible para el usuario → entrada en bitácora de auditoría | Pendiente | Captura del formulario completado, captura del estado aprobado, extracto de log de auditoría | — | Pendiente | — |
| PQ-002 | Flujo completo de vacaciones end-to-end | Usuario final + Responsable | URS-002, URS-003, URS-007, URS-012 | Solicitud creada → aprobación registrada → saldo de vacaciones actualizado → historial correcto y coherente | Pendiente | Captura de solicitud, captura del saldo antes y después, captura del estado aprobado | — | Pendiente | — |
| PQ-003 | Aprobación por responsable autorizado | Responsable | URS-003, URS-006 | Cola de solicitudes pendientes visible → aprobación ejecutada correctamente → estado actualizado → solicitante puede ver el resultado | Pendiente | Captura de la cola de solicitudes, captura del resultado de aprobación | — | Pendiente | — |
| PQ-004 | Rechazo por responsable autorizado | Responsable | URS-003, URS-011 | Rechazo registrado con motivo → estado "rechazado" visible para el solicitante → motivo accesible y legible | Pendiente | Captura del formulario de rechazo, captura del estado final, captura visible para el solicitante | — | Pendiente | — |
| PQ-005 | Consulta posterior de evidencia e historial | Usuario final o Supervisor TI | URS-004, URS-007, URS-008 | Historial completo visible con fechas, estados y responsables → bitácora con entradas de las acciones ejecutadas → información coherente entre historial y log | Pendiente | Captura del historial de solicitudes, extracto del log de auditoría correspondiente | — | Pendiente | — |
| PQ-006 | Aceptación funcional formal | Responsable funcional + Gerencia General | Todos los URS cubiertos en PQ | Declaración formal de aceptación funcional firmada por responsable funcional y Gerencia General | Pendiente | Acta de aceptación funcional firmada | — | Pendiente | — |

---

### 7.2 Detalle de Escenarios

#### PQ-001 — Flujo completo de permiso (end-to-end)

**Descripción del escenario:**
El usuario final crea una solicitud de permiso completa a través del módulo correspondiente de FamSPI v1.0.0. El sistema registra la solicitud y notifica al responsable funcional. El responsable revisa la solicitud, verifica la información ingresada y ejecuta la aprobación. El usuario final consulta el estado de su solicitud y verifica que aparece como "aprobado". Se verifica adicionalmente que la bitácora de auditoría contiene una entrada que refleja fielmente las acciones realizadas.

**Pasos de ejecución:**
1. El usuario final accede al sistema con sus credenciales.
2. Navega al módulo de permisos y crea una nueva solicitud completando todos los campos requeridos.
3. Envía la solicitud y verifica que el sistema confirma la recepción.
4. El responsable funcional accede al sistema con sus credenciales de aprobador.
5. Localiza la solicitud en la cola de pendientes.
6. Revisa el detalle y ejecuta la aprobación.
7. El usuario final recarga o consulta el estado de su solicitud.
8. El supervisor TI consulta la bitácora de auditoría para verificar las entradas correspondientes.

**Resultado esperado:** Solicitud creada → notificación al responsable → aprobación registrada → estado "aprobado" visible para el usuario → entrada en bitácora de auditoría con fecha, hora y usuario actuante.

**Evidencia requerida:** Captura del formulario completado, captura del estado "aprobado", extracto del log de auditoría.

---

#### PQ-002 — Flujo completo de vacaciones (end-to-end)

**Descripción del escenario:**
El usuario final crea una solicitud de vacaciones con fechas válidas y saldo de vacaciones suficiente. El sistema registra la solicitud. El responsable funcional revisa la solicitud y ejecuta la aprobación. Se verifica que el saldo de vacaciones del usuario se actualiza correctamente y que el historial refleja la solicitud aprobada con los datos correctos.

**Pasos de ejecución:**
1. El usuario final accede al sistema con sus credenciales.
2. Consulta el saldo disponible de vacaciones.
3. Navega al módulo de vacaciones y crea una nueva solicitud con fechas válidas dentro del saldo disponible.
4. Envía la solicitud y verifica la confirmación del sistema.
5. El responsable funcional accede al sistema y localiza la solicitud.
6. Revisa el detalle y ejecuta la aprobación.
7. El usuario final consulta el saldo actualizado de vacaciones.
8. El supervisor TI verifica el historial de solicitudes y el saldo resultante.

**Resultado esperado:** Solicitud creada → aprobación registrada → saldo de vacaciones actualizado de forma coherente → historial correcto y trazable.

**Evidencia requerida:** Captura de la solicitud, captura del saldo antes y después de la aprobación, captura del estado "aprobado".

---

#### PQ-003 — Aprobación por responsable autorizado

**Descripción del escenario:**
El responsable funcional con rol autorizado en FamSPI v1.0.0 accede al sistema y puede visualizar la cola de solicitudes pendientes de aprobación. Ejecuta la aprobación de una solicitud de permiso previamente creada. Se verifica que el estado de la solicitud se actualiza correctamente y que el solicitante puede ver el resultado.

**Pasos de ejecución:**
1. El responsable funcional accede al sistema con credenciales de aprobador.
2. Navega a la vista de solicitudes pendientes.
3. Verifica que las solicitudes pendientes son visibles y accesibles.
4. Selecciona una solicitud de permiso y accede al detalle.
5. Ejecuta la aprobación.
6. Verifica que el sistema confirma la operación.
7. El usuario solicitante accede y consulta el estado de su solicitud.

**Resultado esperado:** Cola visible con solicitudes pendientes → aprobación ejecutada correctamente → estado de la solicitud actualizado → el solicitante puede ver el resultado de la aprobación.

**Evidencia requerida:** Captura de la cola de solicitudes, captura del resultado de la aprobación.

---

#### PQ-004 — Rechazo por responsable autorizado

**Descripción del escenario:**
El responsable funcional rechaza una solicitud de permiso e ingresa un motivo de rechazo. El sistema registra el rechazo con el motivo indicado. Se verifica que el solicitante puede consultar el estado de su solicitud y visualizar el motivo del rechazo.

**Pasos de ejecución:**
1. El responsable funcional accede al sistema con credenciales de aprobador.
2. Localiza en la cola una solicitud de permiso pendiente de decisión.
3. Selecciona la opción de rechazo e ingresa un motivo descriptivo.
4. Confirma el rechazo.
5. El usuario solicitante accede al sistema y consulta el estado de su solicitud.
6. Se verifica que el estado es "rechazado" y que el motivo es visible y legible.

**Resultado esperado:** Rechazo registrado con motivo → estado "rechazado" visible para el solicitante → motivo accesible y legible en el detalle de la solicitud.

**Evidencia requerida:** Captura del formulario de rechazo con el motivo ingresado, captura del estado final "rechazado", captura de la vista del solicitante mostrando el motivo.

---

#### PQ-005 — Consulta posterior de evidencia e historial

**Descripción del escenario:**
Un usuario final o supervisor TI consulta el historial completo de solicitudes (permisos y vacaciones) y la bitácora de auditoría asociada. Se verifica que las decisiones ejecutadas en los escenarios anteriores han quedado correctamente registradas, que la información es coherente entre el historial de solicitudes y el log de auditoría, y que los datos de fecha, estado y responsable son correctos y trazables.

**Pasos de ejecución:**
1. El usuario o supervisor accede al sistema.
2. Navega al historial de solicitudes.
3. Verifica que las solicitudes aprobadas y rechazadas en los escenarios anteriores aparecen con los estados correctos.
4. Verifica que los datos de fecha, hora y responsable son coherentes.
5. El supervisor TI consulta el log de auditoría del sistema.
6. Identifica las entradas correspondientes a las acciones ejecutadas en los escenarios PQ-001 a PQ-004.
7. Verifica la coherencia entre el historial visible en la interfaz y las entradas del log.

**Resultado esperado:** Historial completo visible con fechas, estados y responsables → bitácora con entradas que reflejan fielmente las acciones ejecutadas → información coherente y trazable entre historial e interfaz y log.

**Evidencia requerida:** Captura del historial de solicitudes, extracto del log de auditoría correspondiente a las acciones del escenario.

---

#### PQ-006 — Aceptación funcional formal

**Descripción del escenario:**
Al completar satisfactoriamente los escenarios PQ-001 a PQ-005, el responsable funcional revisa los resultados de la PQ/UAT y confirma que FamSPI v1.0.0 opera correctamente para el uso previsto dentro del alcance validado. El responsable funcional y la Gerencia General suscriben formalmente la aceptación funcional del sistema.

**Pasos de ejecución:**
1. El supervisor TI presenta el resumen de resultados de los escenarios PQ-001 a PQ-005 al responsable funcional.
2. El responsable funcional revisa los resultados y las evidencias recopiladas.
3. Si todos los escenarios presentan resultado PASS y no hay desviaciones críticas abiertas, el responsable funcional declara la aceptación funcional.
4. El responsable funcional y la Gerencia General suscriben el acta de aceptación funcional.

**Resultado esperado:** Declaración formal de aceptación funcional firmada por el responsable funcional y la Gerencia General.

**Evidencia requerida:** Acta de aceptación funcional firmada (sección 10 de este documento).

---

## 8. Criterios de Aceptación PQ/UAT

La PQ/UAT se considera aprobada cuando se cumplan todas las condiciones siguientes:

| Criterio | Descripción | Condición |
|---|---|---|
| Escenarios PQ-001 a PQ-005 | Todos los escenarios ejecutados con resultado PASS | Sin desviaciones críticas abiertas al momento del cierre |
| PQ-006 — Aceptación funcional | Firmado por responsable funcional y Gerencia General | Firma física o equivalente válido |
| Desviaciones identificadas | Toda desviación ha sido documentada, evaluada e impacto determinado | Cerradas formalmente o aceptadas con justificación |
| Evidencias | Todas las evidencias requeridas recopiladas y archivadas | Trazables y legibles |

En caso de identificarse desviaciones menores sin impacto en el uso previsto, estas podrán ser aceptadas formalmente con justificación documentada. Las desviaciones mayores deberán ser corregidas y re-ejecutado el escenario afectado antes del cierre de la PQ/UAT.

---

## 9. Trazabilidad PQ → URS

| ID PQ | URS cubiertos | Módulo | Fase también cubierta en OQ |
|---|---|---|---|
| PQ-001 | URS-001, URS-003, URS-004, URS-007 | Permisos | OQ-007, OQ-010 |
| PQ-002 | URS-002, URS-003, URS-007, URS-012 | Vacaciones | OQ-008, OQ-010 |
| PQ-003 | URS-003, URS-006 | Permisos / Vacaciones | OQ-010 |
| PQ-004 | URS-003, URS-011 | Permisos / Vacaciones | OQ-011 |
| PQ-005 | URS-004, URS-007, URS-008 | Auditoría / Trazabilidad | OQ-013, OQ-014 |
| PQ-006 | Todos los URS cubiertos en PQ | General | — |

---

## 10. Desviaciones PQ/UAT

| ID Desviación | Escenario afectado | Descripción | Impacto | Acción correctiva | Responsable | Fecha cierre | Estado |
|---|---|---|---|---|---|---|---|
| — | — | Sin registros al momento de emisión | — | — | — | — | — |

Las desviaciones identificadas durante la ejecución deberán registrarse en esta tabla con toda la información requerida. Cada desviación debe ser evaluada en cuanto a su impacto sobre el uso previsto del sistema y resuelta antes del cierre formal de la PQ/UAT, o aceptada formalmente con justificación documentada.

---

## 11. Conclusión PQ/UAT

**Estado actual: PENDIENTE DE EJECUCIÓN**

La presente PQ/UAT se encuentra pendiente de ejecución. La fase se iniciará una vez que la IQ y la OQ hayan sido aprobadas formalmente y el personal participante haya completado el entrenamiento requerido.

La PQ/UAT se considerará aprobada cuando:
- Todos los escenarios PQ-001 a PQ-005 hayan sido ejecutados con resultado PASS.
- No existan desviaciones críticas abiertas.
- El acta de aceptación funcional (PQ-006) haya sido suscrita por el responsable funcional y la Gerencia General.
- Todas las evidencias hayan sido recopiladas, archivadas y trazadas.

Una vez aprobada, se aplicará la siguiente declaración de conclusión:

"Con base en la evidencia revisada, FamSPI v1.0.0 se considera apto para el uso previsto dentro del alcance validado, correspondiente a FamSPI como sistema global en su primera línea base, Gobierno y Seguridad como dimensión transversal y Permisos y Vacaciones como módulo funcional activo."

---

## 12. Acta de Aceptación Funcional

| Campo | Detalle |
|---|---|
| Sistema | FamSPI |
| Versión | v1.0.0 |
| Alcance validado | FamSPI global (primera línea base) + Gobierno y Seguridad (dimensión transversal) + Permisos y Vacaciones (módulo funcional activo) |
| Resultado PQ/UAT | Pendiente |
| Fecha de ejecución | Pendiente |
| Fecha de aceptación | Pendiente |
| Participantes | Pendiente |
| Declaración de aceptación | "Declaro que FamSPI v1.0.0 ha sido evaluado en condiciones representativas de uso real y se considera apto para operar dentro del alcance validado establecido en el Plan Maestro de Validación." — Pendiente de firma |
| Firma — Responsable técnico TI | Pendiente |
| Firma — Responsable funcional | Pendiente |
| Firma — Gerencia General | Pendiente |

---

## 13. Firmas PQ/UAT

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable técnico TI (elaboró) | Pendiente | Pendiente | Pendiente |
| Responsable funcional (revisó y aceptó) | Pendiente | Pendiente | Pendiente |
| Gerencia General (aprobó) | Pendiente | Pendiente | Pendiente |

---

*Documento emitido conforme a GEON/OMCL PA/PH/OMCL (08) 88 R5 Annex 2 y GAMP 5 Ed. 2. Estado al momento de emisión: PENDIENTE DE EJECUCIÓN. Versión del documento: 1.0. Fecha: 2026-05-13.*
