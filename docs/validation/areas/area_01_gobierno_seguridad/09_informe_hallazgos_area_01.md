# INFORME DE HALLAZGOS - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Alcance revisado
Modulos verificados contra el codigo vigente:
- `auth`
- `security`
- `auditoria`
- `audit-prep`
- `approvals`
- `management`
- `signature`

## 2. Hallazgos corregidos en la actualizacion reciente
### HC-A01 - Inconsistencia de ruteo versionado en `signature`
- Estado: Corregido
- Evidencia de correccion:
  - se incorporo `backend/src/modules/signature/signature.v1.routes.js`.
  - `backend/src/routes/registerRoutes.js` monta `signature` tanto en `/api/v1/signature` como en `/api`.
- Impacto resuelto:
  - la firma ya no depende de un unico prefijo historico y el paquete documental puede usar una ruta versionada para pruebas autenticadas.

### HC-A02 - Dependencia implicita a credencial versionada de Google
- Estado: Corregido
- Evidencia de correccion:
  - `backend/src/utils/googleCredentials.js` ya no hace fallback a `dashboard-spi-3d9bca86a1bb.json`.
  - `backend/src/config/google.js` solo intenta credenciales inline o `GSA_KEY_PATH`.
  - el archivo real versionado fue neutralizado y se dejo `backend/src/data/service-account.example.json` como plantilla inocua.
- Impacto resuelto:
  - se reduce el riesgo de despliegue accidental con credenciales locales versionadas y mejora la trazabilidad de secretos del entorno.

## 3. Hallazgos vigentes
### H-A01 - `approvals` no segmenta la cola por aprobador real
- Severidad: Alta
- Modulo: `approvals`
- Evidencia:
  - `approvals.controller.js` entrega `req.user.role` al servicio.
  - `approvals.service.js:listPending()` ignora el rol recibido y lista todas las solicitudes no finalizadas.
- Impacto:
  - usuarios con acceso al endpoint pueden ver una cola mas amplia que la estrictamente asignada.
  - la documentacion previa del area sobredimensionaba este modulo como motor general de aprobaciones; en realidad sigue siendo un flujo tecnico con visibilidad amplia.
- Propuesta:
  - filtrar `requests` por reglas de aprobador real o por tipo/rol soportado.
  - actualizar FRS especificando el alcance real mientras no se corrija.

### H-A02 - `management/requests` no devuelve total global confiable
- Severidad: Media
- Modulo: `management`
- Evidencia:
  - `management.service.js:listRequests()` retorna `total: data.rowCount`.
  - `rowCount` representa solo el lote de la consulta paginada.
- Impacto:
  - paginacion y metricas de UI pueden mostrar totales parciales.
- Propuesta:
  - agregar `COUNT(*)` separado con los mismos filtros y devolverlo como total real.

### H-A03 - `management/trace` mantiene riesgo de cast invalido sobre JSON
- Severidad: Media
- Modulo: `management`
- Evidencia:
  - `management.service.js:getTrace()` usa `(datos_nuevos->>'request_id')::INT = $1` y `(datos_anteriores->>'request_id')::INT = $1`.
- Impacto:
  - si algun log guarda `request_id` no numerico en JSON, la consulta puede fallar con error SQL.
- Propuesta:
  - proteger el cast con validacion regex o `NULLIF` antes de convertir a entero.

### H-A04 - `auth` sigue acoplado transversalmente a `attendance`
- Severidad: Media
- Modulo: `auth`
- Evidencia:
  - `auth.controller.js:googleCallback` ejecuta `ensureDailyClockIn()`.
  - `/auth/me` ya no tiene ese efecto, pero el callback si.
- Impacto:
  - el login del area 01 modifica estado operativo de otro dominio.
  - complica validacion modular y trazabilidad documental.
- Propuesta:
  - documentar formalmente este side effect o moverlo a un punto explicito del modulo `attendance`.

### H-A05 - Artefactos auxiliares de `security` no alineados al esquema core
- Severidad: Baja
- Modulo: `security`
- Evidencia:
  - existen `security.whitelist.js` y `security.siem.js`.
  - su soporte tabular no forma parte del flujo core verificado del modulo ni del paquete de datos actual.
- Impacto:
  - aumenta ruido de instalacion y puede inducir a documentar capacidades no operativas.
- Propuesta:
  - marcar ambos servicios como auxiliares/no activos o completar su diseno con migraciones y rutas si se quieren usar.

### H-A06 - `signature` depende de funciones y vistas SQL sin fallback
- Severidad: Media
- Modulo: `signature`
- Evidencia:
  - `signature.controller.js` usa `create_document_seal_and_qr()` y `track_qr_access()`.
  - la verificacion depende de `document_verification_info`.
- Impacto:
  - el modulo puede degradarse completamente si el entorno no tiene esos objetos.
- Propuesta:
  - incorporar verificacion de prerequisitos en IQ/OQ operativo y documentar dependencia dura del esquema.

## 4. Modulos sin hallazgo estructural nuevo relevante
- `security` core: montado y alineado con `auditoria.logs` / `notifications`.
- `auditoria`: sin hallazgo estructural nuevo relevante en la revision actual.
- `audit-prep`: sin hallazgo estructural nuevo relevante en la revision actual.

## 5. Impacto documental
Documentos actualizados en el paquete del area:
- `01_URS_requerimientos_usuario.md`
- `02_FRS_requerimientos_funcionales.md`
- `03_DDS_diseno_tecnico.md`
- `04_IQ_validacion_instalacion.md`
- `05_OQ_validacion_funcionamiento.md`
- `06_PQ_validacion_operacion_real.md`
- `00_indice_paquete_validacion.md`

## 6. Conclusion
El paquete documental del area 01 quedo realineado con el codigo actual. Los hallazgos residuales ya no son los mismos del diagnostico anterior: ya quedaron corregidos el ruteo versionado de `signature` y la dependencia implicita a una credencial versionada de Google. Los riesgos principales restantes se concentran en segmentacion funcional de `approvals`, totalizacion/trazabilidad robusta en `management`, acoplamiento transversal de `auth` y dependencia SQL fuerte de `signature`.
