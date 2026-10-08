# OQ — Calificación Operacional

**Sistema:** FamSPI v1.0.0
**Protocolo:** OQ-FAMSPI-001
**Versión del protocolo:** 1.0
**Marco normativo:** GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2
**Estado:** PENDIENTE DE EJECUCIÓN
**Fecha de emisión:** 2026-05-13

---

## 1. Objetivo OQ

Verificar que FamSPI v1.0.0 opera correctamente bajo condiciones definidas, tanto en flujos positivos (camino feliz) como en el manejo controlado de errores y condiciones límite, para todos los módulos incluidos en el alcance validado.

La Calificación Operacional (OQ) demuestra que el sistema se comporta conforme a los requerimientos funcionales documentados en el URS (protocolo `03_urs_requerimientos_usuario.md`), cubriendo: autenticación y sesión, control de acceso por rol (RBAC), operaciones sobre solicitudes de permisos y vacaciones, trazabilidad de auditoría, y manejo de errores.

La aprobación de la OQ es condición necesaria para iniciar la Calificación de Desempeño (PQ), si aplica, o para la liberación al uso productivo del sistema.

---

## 2. Alcance OQ

La OQ cubre los módulos del sistema FamSPI v1.0.0 incluidos en el alcance validado:

| Área | Módulos cubiertos |
|---|---|
| Gobierno y Seguridad | auth, security, auditoria, approvals, signature, notifications, dashboard |
| Permisos y Vacaciones | permisos, vacaciones, attendance |

**Aspectos funcionales verificados en OQ:**

- Flujo de autenticación con Google OAuth2 (login exitoso y fallido)
- Protección de rutas privadas (sin sesión y con rol insuficiente)
- Control de acceso por rol (RBAC) — verificación de restricciones de autorización
- Operaciones CRUD sobre el módulo de permisos
- Operaciones CRUD sobre el módulo de vacaciones
- Aprobación y rechazo de solicitudes por parte del responsable
- Gestión de estados de solicitud (transición correcta de estados)
- Consulta histórica y filtrado de solicitudes
- Trazabilidad: registro de acciones en la bitácora de auditoría
- Restricción de acceso cruzado entre usuarios
- Manejo de errores controlados (respuestas HTTP apropiadas sin exposición de información interna)

---

## 3. Prerrequisito

> **La IQ debe estar formalmente aprobada antes de iniciar la ejecución de la OQ.**

El protocolo IQ (`04_iq_calificacion_instalacion.md`) debe haber sido ejecutado en su totalidad, con todos los items en estado PASS o N/A justificado, sin desviaciones críticas abiertas, y con las firmas de ejecutor, revisor técnico y aprobador completadas.

No se ejecutará ningún caso de prueba de la OQ si la IQ no ha sido aprobada. Cualquier intento de ejecución sin IQ aprobada debe quedar registrado como desviación de proceso.

| Prerrequisito | Referencia | Estado al ejecutar |
|---|---|---|
| IQ aprobada (todos los items PASS o N/A, sin desviaciones críticas abiertas) | `04_iq_calificacion_instalacion.md` | A completar al ejecutar |
| Ambiente de ejecución identificado e inalterado desde la IQ | Referencia de release registrada en IQ | A completar al ejecutar |
| Usuario(s) de prueba disponibles con roles definidos | Roles: admin, usuario, responsable | A completar al ejecutar |

---

## 4. Casos de Prueba OQ

Los resultados deben completarse durante la ejecución del protocolo. Los campos "Resultado observado", "Evidencia", "Desviación" y "Estado" se dejan con valor "Pendiente" o "—" hasta la ejecución formal.

---

### OQ-001 — Login correcto con cuenta Google válida

| Campo | Detalle |
|---|---|
| **ID** | OQ-001 |
| **Objetivo** | Verificar que un usuario con credenciales Google válidas y registradas en el sistema puede autenticarse exitosamente y recibir un JWT activo |
| **Precondición** | Usuario de prueba con cuenta Google registrada en el sistema FamSPI; sistema en estado operativo (IQ aprobada) |
| **Datos de entrada** | Cuenta Google válida y registrada en el sistema |
| **Pasos** | 1. Acceder a la URL de login de FamSPI en el navegador. 2. Seleccionar la opción "Iniciar sesión con Google". 3. Seleccionar la cuenta Google del usuario de prueba. 4. Autorizar el acceso a FamSPI en la pantalla de consentimiento OAuth2. 5. Observar la respuesta del sistema tras completar el flujo. |
| **Resultado esperado** | Redirección al dashboard de la aplicación; token JWT presente en cookie o header de sesión; sesión activa confirmada (usuario visible en interfaz); HTTP 200 en la respuesta del endpoint de callback |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-002 — Login fallido con cuenta Google no registrada

| Campo | Detalle |
|---|---|
| **ID** | OQ-002 |
| **Objetivo** | Verificar que una cuenta Google no registrada en FamSPI es rechazada de forma controlada y no genera sesión |
| **Precondición** | Cuenta Google ajena al sistema (no registrada en la BD de usuarios de FamSPI); sistema en estado operativo |
| **Datos de entrada** | Cuenta Google válida ante Google pero no registrada en FamSPI |
| **Pasos** | 1. Acceder a la URL de login. 2. Seleccionar la opción "Iniciar sesión con Google". 3. Seleccionar cuenta Google no registrada en FamSPI. 4. Autorizar el acceso. 5. Observar la respuesta del sistema. |
| **Resultado esperado** | Mensaje de error controlado visible para el usuario (p. ej. "Usuario no autorizado" o equivalente); no se crea sesión activa; no se emite JWT; redirección a página de error o login con mensaje informativo; no se expone información interna del sistema |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-003 — Acceso a ruta privada sin token (usuario sin sesión)

| Campo | Detalle |
|---|---|
| **ID** | OQ-003 |
| **Objetivo** | Verificar que el acceso a cualquier ruta protegida sin token de autenticación es rechazado con HTTP 401 |
| **Precondición** | Sin token JWT activo en el cliente; sistema en estado operativo |
| **Datos de entrada** | Solicitud HTTP GET a una ruta privada de la API (p. ej. `/api/permisos`) sin header `Authorization` ni cookie de sesión |
| **Pasos** | 1. Desde un cliente HTTP (p. ej. curl, Postman o navegador sin sesión), realizar una solicitud GET a un endpoint privado del backend. 2. No incluir header Authorization ni token de sesión. 3. Observar la respuesta HTTP. |
| **Resultado esperado** | HTTP 401; cuerpo de respuesta con mensaje controlado (p. ej. `{"error": "No autenticado"}` o equivalente); no se devuelven datos protegidos; no se expone stack trace |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-004 — Usuario autenticado sin permiso para acción específica (HTTP 403)

| Campo | Detalle |
|---|---|
| **ID** | OQ-004 |
| **Objetivo** | Verificar que un usuario autenticado con rol insuficiente para una acción específica recibe HTTP 403 |
| **Precondición** | Usuario autenticado con rol `usuario`; endpoint de acción restringida a rol `admin` o `responsable`; JWT válido en el cliente |
| **Datos de entrada** | Token JWT válido con rol `usuario`; solicitud a endpoint restringido (p. ej. endpoint de administración de roles o configuración del sistema) |
| **Pasos** | 1. Autenticar usuario con rol `usuario` y obtener JWT. 2. Realizar solicitud HTTP al endpoint de acción restringida incluyendo el JWT en el header Authorization. 3. Observar la respuesta HTTP. |
| **Resultado esperado** | HTTP 403; cuerpo de respuesta con mensaje controlado (p. ej. `{"error": "Sin autorización"}` o equivalente); no se ejecuta la acción solicitada; no se expone información interna |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-005 — Usuario con rol `usuario` intenta acción de `admin`

| Campo | Detalle |
|---|---|
| **ID** | OQ-005 |
| **Objetivo** | Verificar específicamente que el middleware RBAC bloquea correctamente el escalado de privilegios de `usuario` a `admin` |
| **Precondición** | Token JWT válido con claim de rol `usuario`; endpoint que requiere rol `admin` identificado |
| **Datos de entrada** | JWT con rol `usuario`; solicitud a endpoint de administración (p. ej. gestión de usuarios, configuración de roles, o equivalente en FamSPI) |
| **Pasos** | 1. Obtener JWT de usuario con rol `usuario`. 2. Construir solicitud HTTP (GET o POST) al endpoint de administración reservado para `admin`. 3. Incluir JWT en header Authorization. 4. Enviar solicitud. 5. Observar código HTTP y cuerpo de la respuesta. |
| **Resultado esperado** | HTTP 403; la acción no es ejecutada; el sistema no otorga acceso basado en el claim de rol presente en el token; el mensaje de respuesta no revela detalles sobre la estructura de roles internos |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-006 — Acceso al módulo de permisos con rol correcto

| Campo | Detalle |
|---|---|
| **ID** | OQ-006 |
| **Objetivo** | Verificar que un usuario autenticado con rol autorizado puede acceder al módulo de permisos y recibir su listado de solicitudes |
| **Precondición** | Usuario autenticado con rol `usuario` o superior; al menos una solicitud de permiso existente asociada al usuario de prueba |
| **Datos de entrada** | JWT válido con rol autorizado; solicitud GET a `/api/permisos` (o endpoint equivalente del módulo) |
| **Pasos** | 1. Autenticar usuario con rol `usuario`. 2. Realizar solicitud GET al endpoint del módulo de permisos incluyendo JWT. 3. Observar respuesta HTTP y contenido. |
| **Resultado esperado** | HTTP 200; respuesta con lista de permisos asociados al usuario autenticado (puede ser lista vacía si no hay solicitudes); estructura de datos coherente con el modelo del sistema; no se devuelven datos de otros usuarios |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-007 — Crear solicitud de permiso válida

| Campo | Detalle |
|---|---|
| **ID** | OQ-007 |
| **Objetivo** | Verificar que una solicitud de permiso con todos los campos requeridos se registra correctamente en el sistema |
| **Precondición** | Usuario autenticado con rol `usuario`; JWT válido |
| **Datos de entrada** | POST a `/api/permisos` (o equivalente) con payload completo y válido: tipo de permiso, fecha inicio, fecha fin, motivo (y demás campos requeridos por el sistema) |
| **Pasos** | 1. Autenticar usuario y obtener JWT. 2. Construir payload JSON con todos los campos requeridos para una solicitud de permiso. 3. Realizar solicitud POST al endpoint del módulo de permisos. 4. Observar respuesta HTTP y cuerpo. |
| **Resultado esperado** | HTTP 201; respuesta incluye el objeto de la solicitud creada con: ID único asignado, estado inicial `pendiente`, usuario solicitante correcto, campos de entrada reflejados correctamente, timestamp de creación |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-008 — Crear solicitud de vacaciones válida

| Campo | Detalle |
|---|---|
| **ID** | OQ-008 |
| **Objetivo** | Verificar que una solicitud de vacaciones con todos los campos requeridos se registra correctamente |
| **Precondición** | Usuario autenticado con rol `usuario`; saldo de días de vacaciones disponible para el período solicitado |
| **Datos de entrada** | POST a `/api/vacaciones` (o equivalente) con payload completo y válido: fecha inicio, fecha fin, días solicitados, comentario opcional (y demás campos requeridos) |
| **Pasos** | 1. Autenticar usuario y obtener JWT. 2. Construir payload JSON con todos los campos requeridos para una solicitud de vacaciones. 3. Realizar solicitud POST al endpoint del módulo de vacaciones. 4. Observar respuesta HTTP y cuerpo. |
| **Resultado esperado** | HTTP 201; respuesta incluye objeto de solicitud creada con: ID único, estado inicial `pendiente`, usuario solicitante correcto, rango de fechas reflejado, días solicitados correctos |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-009 — Solicitud incompleta rechazada con error descriptivo

| Campo | Detalle |
|---|---|
| **ID** | OQ-009 |
| **Objetivo** | Verificar que una solicitud de permiso con campos obligatorios faltantes es rechazada con un mensaje de validación claro y específico |
| **Precondición** | Usuario autenticado con rol `usuario`; JWT válido |
| **Datos de entrada** | POST a `/api/permisos` con payload incompleto — omitir al menos un campo obligatorio (p. ej. tipo de permiso o fecha) |
| **Pasos** | 1. Autenticar usuario y obtener JWT. 2. Construir payload JSON omitiendo un campo obligatorio. 3. Realizar solicitud POST al endpoint del módulo de permisos. 4. Observar respuesta HTTP y cuerpo. |
| **Resultado esperado** | HTTP 400; respuesta incluye mensaje de error específico indicando qué campo falta o es inválido (p. ej. `{"error": "El campo 'tipo' es requerido"}` o equivalente); no se crea ningún registro en la BD; no se expone stack trace |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-010 — Aprobar solicitud de permiso

| Campo | Detalle |
|---|---|
| **ID** | OQ-010 |
| **Objetivo** | Verificar que un responsable puede aprobar una solicitud de permiso en estado `pendiente` y que el estado cambia correctamente |
| **Precondición** | Usuario con rol `responsable` autenticado; solicitud de permiso en estado `pendiente` existente en el sistema (puede ser creada en OQ-007) |
| **Datos de entrada** | PUT a `/api/permisos/{id}/aprobar` (o endpoint equivalente de aprobación) con JWT de usuario `responsable` |
| **Pasos** | 1. Autenticar usuario con rol `responsable` y obtener JWT. 2. Identificar ID de una solicitud en estado `pendiente`. 3. Realizar solicitud PUT al endpoint de aprobación con ese ID. 4. Observar respuesta HTTP. 5. Verificar el estado de la solicitud mediante GET posterior. |
| **Resultado esperado** | HTTP 200; el estado de la solicitud cambia a `aprobado`; la respuesta o el GET posterior reflejan el cambio de estado; el responsable aprobador queda registrado en el objeto; timestamp de aprobación registrado |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-011 — Rechazar solicitud de permiso con motivo

| Campo | Detalle |
|---|---|
| **ID** | OQ-011 |
| **Objetivo** | Verificar que un responsable puede rechazar una solicitud de permiso en estado `pendiente` con un motivo registrado |
| **Precondición** | Usuario con rol `responsable` autenticado; solicitud de permiso en estado `pendiente` disponible |
| **Datos de entrada** | PUT a `/api/permisos/{id}/rechazar` con payload que incluye el motivo de rechazo; JWT de usuario `responsable` |
| **Pasos** | 1. Autenticar usuario con rol `responsable`. 2. Identificar ID de solicitud en estado `pendiente`. 3. Realizar solicitud PUT al endpoint de rechazo, incluyendo campo de motivo en el body. 4. Observar respuesta HTTP. 5. Verificar el estado de la solicitud mediante GET posterior. |
| **Resultado esperado** | HTTP 200; el estado cambia a `rechazado`; el motivo de rechazo queda registrado en el objeto de la solicitud; responsable rechazador registrado; timestamp de rechazo registrado |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-012 — Verificación de transición de estado correcta

| Campo | Detalle |
|---|---|
| **ID** | OQ-012 |
| **Objetivo** | Verificar que el estado de una solicitud transiciona correctamente desde `pendiente` a `aprobado` y que los metadatos de resolución quedan registrados |
| **Precondición** | Solicitud en estado `pendiente` existente en el sistema; responsable autenticado |
| **Datos de entrada** | Acción de aprobación sobre solicitud en estado `pendiente`; consulta GET posterior sobre el mismo ID |
| **Pasos** | 1. Registrar el estado actual de la solicitud (`pendiente`) mediante GET. 2. Ejecutar acción de aprobación (puede coincidir con OQ-010 o ser solicitud diferente). 3. Realizar GET sobre la misma solicitud. 4. Comparar estado antes y después. |
| **Resultado esperado** | Estado final es `aprobado`; fecha y hora de resolución registradas en el objeto; el responsable que aprobó queda identificado; no existen campos de resolución vacíos o nulos en un registro aprobado |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-013 — Consulta histórica de solicitudes con filtro por período

| Campo | Detalle |
|---|---|
| **ID** | OQ-013 |
| **Objetivo** | Verificar que un usuario puede consultar su historial de solicitudes filtrado por período de tiempo y que los resultados son correctos |
| **Precondición** | Usuario autenticado con al menos 2 solicitudes de permiso registradas en distintos períodos |
| **Datos de entrada** | GET a `/api/permisos?usuario={id}&desde={fecha_inicio}&hasta={fecha_fin}` (o parámetros equivalentes); JWT válido |
| **Pasos** | 1. Autenticar usuario con solicitudes históricas. 2. Construir solicitud GET con parámetros de filtro (usuario y rango de fechas). 3. Enviar solicitud al endpoint. 4. Verificar que los resultados corresponden únicamente al período especificado. |
| **Resultado esperado** | HTTP 200; lista de solicitudes que corresponde únicamente al período indicado; no se incluyen solicitudes fuera del rango; si el período no tiene solicitudes, la respuesta es una lista vacía (no un error) |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-014 — Trazabilidad: registro de acción en bitácora de auditoría

| Campo | Detalle |
|---|---|
| **ID** | OQ-014 |
| **Objetivo** | Verificar que la acción de crear un permiso queda registrada de forma trazable en la bitácora de auditoría del sistema |
| **Precondición** | Sistema de logs/auditoría activo (verificado en IQ-013); usuario autenticado; permiso de consulta de bitácora disponible |
| **Datos de entrada** | Acción de creación de solicitud de permiso (puede referenciarse a OQ-007); consulta a bitácora de auditoría |
| **Pasos** | 1. Ejecutar acción de crear solicitud de permiso (o referirse a OQ-007 si ya fue ejecutado). 2. Acceder a la bitácora de auditoría del sistema (endpoint de auditoría, logs de Cloud Run, o interfaz de administración). 3. Buscar el registro correspondiente a la acción ejecutada. |
| **Resultado esperado** | Existe entrada en la bitácora con: usuario que ejecutó la acción, tipo de acción (creación de permiso), módulo (permisos), timestamp (UTC) y resultado de la operación; la entrada es inmutable y no fue eliminada tras la operación |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-015 — Restricción de acceso cruzado entre usuarios

| Campo | Detalle |
|---|---|
| **ID** | OQ-015 |
| **Objetivo** | Verificar que un usuario no puede modificar solicitudes que pertenecen a otro usuario |
| **Precondición** | Usuario A autenticado con JWT válido; solicitud de permiso creada por usuario B (distinto al usuario A) disponible en el sistema |
| **Datos de entrada** | JWT de usuario A; solicitud PUT o PATCH a `/api/permisos/{id-de-solicitud-de-B}` |
| **Pasos** | 1. Autenticar como usuario A y obtener JWT. 2. Identificar ID de una solicitud perteneciente a usuario B. 3. Intentar modificar esa solicitud mediante PUT/PATCH al endpoint correspondiente, con el JWT de usuario A. 4. Observar respuesta HTTP. |
| **Resultado esperado** | HTTP 403; el sistema reconoce que la solicitud no pertenece al usuario autenticado; no se realiza ninguna modificación sobre la solicitud de usuario B; mensaje de error controlado sin exposición de datos de usuario B |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

### OQ-016 — Manejo de errores internos: respuesta controlada sin stack trace

| Campo | Detalle |
|---|---|
| **ID** | OQ-016 |
| **Objetivo** | Verificar que ante un error interno inesperado del servidor, el sistema devuelve una respuesta controlada sin exponer información interna (stack trace, rutas de archivo, estructura de BD, etc.) |
| **Precondición** | Identificar o simular una condición que provoque un error interno (p. ej. parámetro que cause una excepción no controlada, o endpoint de prueba de error si existe); ambiente de ejecución con NODE_ENV=production |
| **Datos de entrada** | Solicitud que induce error interno en el backend (método a definir por el ejecutor según el ambiente — puede ser un payload malformado de un tipo específico, o un ID inexistente que provoque excepción no manejada) |
| **Pasos** | 1. Identificar condición que cause error interno controlado. 2. Realizar solicitud HTTP que provoque dicho error. 3. Observar código HTTP y cuerpo de la respuesta. 4. Verificar que no se expone stack trace ni información interna. |
| **Resultado esperado** | HTTP 500; cuerpo de respuesta con mensaje genérico (p. ej. `{"error": "Error interno del servidor"}` o equivalente); sin stack trace en la respuesta; sin rutas de sistema de archivos ni estructura de BD expuestas; el error queda registrado en los logs internos del servidor (no en la respuesta al cliente) |
| **Resultado observado** | Pendiente |
| **Evidencia** | Pendiente |
| **Desviación** | — |
| **Estado** | Pendiente |
| **Responsable** | |

---

## 5. Criterio de Aceptación Global OQ

La OQ se considera aprobada cuando **todos** los casos de prueba de la sección 4 presentan estado **PASS**.

Las siguientes reglas aplican durante la ejecución:

| Situación | Acción requerida |
|---|---|
| Caso con resultado PASS | Continuar con el siguiente caso |
| Caso con resultado FAIL | Detener el protocolo, abrir desviación en sección 7, evaluar impacto antes de continuar |
| Caso no ejecutable por condición de ambiente | Registrar como N/A con justificación escrita; no puede quedar en blanco |
| Caso con FAIL resuelto mediante corrección | Re-ejecutar el caso afectado y los dependientes; registrar en sección de re-ejecución |

Un resultado FAIL en cualquier caso de prueba impide la declaración de aprobación de la OQ hasta que:
1. Se identifica la causa raíz.
2. Se implementa la acción correctiva.
3. El caso (y los dependientes identificados) son re-ejecutados con resultado PASS.
4. La desviación es formalmente cerrada.

---

## 6. Criterio de Re-ejecución

Si durante la ejecución de la OQ se identifica un FAIL y se realiza un cambio correctivo en el sistema, se aplica el siguiente criterio de re-ejecución:

| Tipo de cambio correctivo | Alcance de re-ejecución |
|---|---|
| Corrección de lógica de negocio en un módulo específico | Re-ejecutar todos los casos de prueba del módulo afectado |
| Corrección de middleware de autenticación o autorización | Re-ejecutar OQ-001 a OQ-006 (al menos) |
| Corrección de validación de campos | Re-ejecutar el caso fallido y OQ-009 |
| Cambio en configuración de variables de entorno o infraestructura | Re-ejecutar la IQ completa antes de continuar la OQ |
| Cambio en esquema de base de datos | Re-ejecutar IQ-004 y todos los casos que interactúan con la BD |

Cada re-ejecución debe documentarse indicando: caso re-ejecutado, versión del sistema tras el cambio (debe ser la misma v1.0.0 con corrección de configuración, o debe actualizarse el número de versión y re-abrir validación completa), resultado obtenido y responsable.

---

## 7. Desviaciones OQ

Las desviaciones identificadas durante la ejecución se registran en la siguiente tabla. Al momento de la emisión del protocolo no existen desviaciones registradas.

| ID Desviación | Caso OQ afectado | Descripción de la desviación | Impacto | Acción correctiva propuesta | Estado | Responsable | Fecha de cierre |
|---|---|---|---|---|---|---|---|
| — | — | Sin desviaciones registradas al momento de emisión | — | — | — | — | — |

---

## 8. Conclusión OQ

**Estado actual: PENDIENTE DE EJECUCIÓN**

La presente Calificación Operacional (OQ) se considera aprobada cuando se cumplen todas las condiciones siguientes:

1. La IQ (`04_iq_calificacion_instalacion.md`) ha sido formalmente aprobada con anterioridad.
2. Todos los casos de prueba de la sección 4 (OQ-001 a OQ-016) presentan estado **PASS**.
3. No existen desviaciones abiertas (sin resolver) en la tabla de desviaciones (sección 7).
4. Las firmas de ejecutor, revisor técnico y aprobador han sido completadas (sección 9).

La aprobación de la OQ, junto con la IQ aprobada, constituye la evidencia de validación de FamSPI v1.0.0 conforme al marco GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2 para el alcance declarado (Gobierno y Seguridad + Permisos y Vacaciones), y habilita la transición a la fase de liberación al uso productivo documentada en el informe final (`07_informe_final_liberacion_uso.md`).

---

## 9. Firmas OQ

La firma en este documento certifica que el protocolo fue ejecutado, revisado y aprobado de acuerdo con los procedimientos de validación aplicables bajo el marco GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2.

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Ejecutor (Responsable de ejecución) | | ___________________ | |
| Revisor Técnico | | ___________________ | |
| Aprobador (Responsable de validación) | | ___________________ | |

---

*Documento generado conforme al plan de validación de FamSPI v1.0.0. Ref. normativa: GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2.*
