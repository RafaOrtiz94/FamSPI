# INFORME DE REVISION INTEGRAL DE MODULOS Y PLAN DE MEJORAS

## Objetivo
Consolidar la revision tecnica de los modulos documentados en `validacion_sistema`, identificar errores potenciales y oportunidades de mejora, y definir un plan de correccion por fases que reduzca riesgo de regresion antes de implementar cambios.

## Alcance revisado
- Inventario funcional base tomado de `validacion_sistema/verificacion_modulos_actual.md`.
- Contraste contra rutas, controladores y servicios en `backend/src`.
- Contraste contra informes modulares ya existentes en `validacion_sistema/informes`.

## Nota de normalizacion documental
- El informe `informe_modulo_facturacion.md` corresponde al modulo operativo "Control Financiero Operativo y Viaticos"; no existe un modulo tributario separado en `backend/src`.
- El informe `informe_modulo_pedidos.md` corresponde al dominio "Solicitudes Internas y Flujos de Compra", repartido entre `requests`, `equipment-purchases` y `private-purchases`.
- El modulo de respaldo de base de datos queda como modulo tecnico de plataforma y no sustituye la revision funcional de los 12 modulos principales.

## Resumen ejecutivo
- El sistema tiene buena cobertura funcional y muchos flujos de negocio ya aterrizados en codigo real.
- Los mayores riesgos actuales no estan en funcionalidad faltante sino en autorizacion inconsistente, rutas montadas con prefijos incorrectos, DDL ejecutado en runtime y archivos monoliticos dificiles de validar.
- Hay hallazgos criticos que deben corregirse antes de ampliar alcance: control de acceso en usuarios/departamentos/inventario/asistencia/notificaciones/dashboard, y consolidacion de migraciones fuera de servicios.
- La correccion recomendada no es un refactor total de una sola vez. Debe ejecutarse por fases, con alias de compatibilidad, pruebas de regresion por modulo y actualizacion documental en cada entrega.

## Hallazgos transversales

### 1. Autorizacion inconsistente
- Existen rutas privadas protegidas solo con `verifyToken`, sin `requireRole` explicito o sin control de ownership visible.
- Casos detectados:
  - `backend/src/modules/users/users.routes.js:7-15`
  - `backend/src/modules/departments/departments.routes.js:11-27`
  - `backend/src/modules/inventario/inventario.routes.js:10-29`
  - `backend/src/modules/attendance/attendance.routes.js:25-31`
  - `backend/src/modules/notifications/notifications.routes.js:6-13`
  - `backend/src/modules/signature/signature.routes.js:10-38`
  - `backend/src/modules/dashboard/dashboard.routes.js:19-23`

### 2. DDL ejecutado dentro de servicios/controladores
- Se detecto creacion o alteracion de tablas en runtime, lo que complica despliegues, genera deriva de esquema y vuelve opaca la trazabilidad de base de datos.
- Casos detectados:
  - `backend/src/modules/support-tickets/supportTickets.service.js:46-147`
  - `backend/src/modules/servicio/servicio.controller.js:29-60`
  - `backend/src/modules/business-case/businessCaseSheetGeneration.service.js:114-176`
  - `backend/src/modules/viaticos/viaticos.service.js:70-208`
  - `backend/src/modules/permisos/permisos.service.js`
  - `backend/src/modules/vacaciones/vacaciones.service.js`
  - `backend/src/modules/personnel-requests/personnel-requests.service.js`
  - `backend/src/modules/collaborators/collaborators.service.js`
  - `backend/src/modules/requests/requests.service.js`

### 3. Inconsistencia de rutas y montajes
- Hay modulos montados en `app.js` con un prefijo, pero la ruta interna repite parte del path y termina generando endpoints redundantes o poco intuitivos.
- Casos detectados:
  - `backend/src/app.js:229-230` + `backend/src/modules/finanzas/finanzas.routes.js:6-9`
  - `backend/src/app.js:229-230` + `backend/src/modules/talento_humano/hr.routes.js:9-12`

### 4. Archivos monoliticos y deuda de mantenibilidad
- Hay servicios y controladores muy grandes, con mezcla de validacion, SQL, reglas de negocio, integraciones y DDL.
- Casos destacados:
  - `backend/src/modules/permisos/permisos.service.js` (2820 lineas)
  - `backend/src/modules/support-tickets/supportTickets.service.js` (1186 lineas)
  - `backend/src/modules/attendance/attendance.controller.js` (719 lineas)
  - `backend/src/modules/signature/signature.controller.js` (428 lineas)
  - `backend/src/modules/business-case/businessCase.routes.js` (296 lineas)

### 5. Gaps de integracion y consistencia tecnica
- El modulo `integrations` esta vacio:
  - `backend/src/modules/integrations/integrations.controller.js`
  - `backend/src/modules/integrations/integrations.routes.js`
  - `backend/src/modules/integrations/integrations.service.js`
  - `backend/src/modules/integrations/oracle.service.js`
- Se observaron problemas de encoding en `signature.routes.js` y `signature.controller.js`.
- Hay logica de permisos implementada tanto en `middlewares/auth` como en `middlewares/roles`, lo que incrementa el riesgo de uso inconsistente.

---

## Revision modulo por modulo

### 1. Autenticacion y Sesiones
Estado actual:
- Funcionalmente completo y critico para toda la plataforma.

Errores potenciales y mejoras:
- TTL de tokens hardcodeado en `backend/src/modules/auth/auth.controller.js:109-130`.
- `refresh_token` persistido en texto plano en `backend/src/modules/auth/session.repository.js:7-15`, `31-40` y `71-79`.
- El modulo depende de que secretos y redirecciones de Google esten siempre alineados entre ambientes.

Prioridad:
- P1 critica.

Plan de correccion seguro:
- Mover expiraciones a variables de entorno con valores por defecto compatibles.
- Hashear `refreshToken` antes de persistirlo, con estrategia dual para no romper sesiones activas.
- Agregar pruebas de login, refresh, logout, auditoria y expiracion.

Validacion requerida:
- Login Google exitoso.
- Refresh con sesion previa al cambio y posterior al cambio.
- Logout de una sesion y cierre global.
- Acceso denegado a auditoria para roles no autorizados.

### 2. Gestion de Usuarios
Estado actual:
- Funcionalidad base presente, pero con riesgo alto de acceso excesivo.

Errores potenciales y mejoras:
- CRUD de usuarios protegido solo por JWT en `backend/src/modules/users/users.routes.js:7-15`.
- CRUD de departamentos protegido solo por JWT en `backend/src/modules/departments/departments.routes.js:11-27`.
- El control de permisos no queda visible a nivel de ruta, lo que dificulta auditoria y validacion.

Prioridad:
- P1 critica.

Plan de correccion seguro:
- Aplicar `requireRole` explicito por endpoint para lectura, alta, edicion y baja.
- Mantener por una fase el control actual en controlador/servicio si existiera, pero agregar guardas a nivel de ruta.
- Incorporar pruebas de acceso por roles `admin`, `ti`, `talento_humano`, `gerencia` y usuario comun.

Validacion requerida:
- Usuario no administrador no puede crear, editar ni eliminar usuarios.
- Usuario no autorizado no puede crear ni eliminar departamentos.
- Operaciones permitidas siguen funcionando para roles administrativos.

### 3. Comercial y Gestion de Clientes
Estado actual:
- Modulo muy rico en negocio, con workflows relevantes y riesgo alto de regresion.

Errores potenciales y mejoras:
- En `backend/src/modules/private-purchases/privatePurchases.routes.js` hay muchas rutas con `verifyToken`, pero solo tres usan `requireRole` de forma explicita.
- En `backend/src/modules/clients/clients.routes.js:12-47`, `/:id/visit-status` y `/prospect-visit` no tienen `requireRole` a nivel de ruta.
- `backend/src/modules/requests/requests.service.js` ejecuta DDL en runtime.

Prioridad:
- P1 alta.

Plan de correccion seguro:
- Documentar matriz de roles por endpoint y aplicarla en rutas primero, sin desmontar validaciones internas ya existentes.
- Revisar especialmente ownership sobre visitas, prospectos y compras privadas.
- Extraer DDL de `requests` a migraciones SQL versionadas.
- Agregar suite de pruebas de transiciones por rol para compras privadas y nuevo cliente.

Validacion requerida:
- Comercial solo puede operar sus casos o los permitidos por rol.
- Roles no autorizados no pueden avanzar estados ni registrar visitas ajenas.
- El flujo end to end de compra privada sigue operativo con la nueva matriz.

### 4. Business Case Comercial
Estado actual:
- Dominio complejo y bien avanzado, con deuda tecnica en persistencia y modularidad.

Errores potenciales y mejoras:
- `backend/src/modules/business-case/businessCase.routes.js` concentra demasiadas rutas y variantes.
- `backend/src/modules/business-case/businessCaseSheetGeneration.service.js:114-176` crea cola/tablas en runtime.
- `backend/src/modules/business-case/businessCaseDeterminationsGate.service.js` tambien hace DDL dinamico.

Prioridad:
- P2 alta.

Plan de correccion seguro:
- Extraer la cola de generacion y sus tablas a migraciones.
- Dividir rutas por subdominio: business case, catalogos, determinaciones, templates.
- Agregar contratos de entrada/salida estables para sheet generation y observabilidad.

Validacion requerida:
- Creacion y edicion de business case.
- Lock/unlock por rol y ownership.
- Generacion de hojas BC asincronas con idempotencia y reintentos.

### 5. Talento Humano y Gestion de Personal
Estado actual:
- Cobertura funcional amplia, pero con varios puntos de seguridad y deuda de esquema.

Errores potenciales y mejoras:
- `backend/src/modules/talento_humano/hr.routes.js:9-12` repite `/api/v1/hr/...` aunque el modulo ya se monta en `/api/v1/talento-humano`.
- `backend/src/modules/attendance/attendance.routes.js:25-31` permite consultar rango, usuario y PDF con solo JWT.
- `backend/src/modules/attendance/attendance.controller.js:510-599` consulta datos de asistencia de cualquier `userId` sin ownership visible.
- `backend/src/modules/attendance/attendance.service.js:312-339` genera PDF para cualquier `userId`.
- `backend/src/modules/permisos/permisos.service.js` y `backend/src/modules/vacaciones/vacaciones.service.js` arrastran DDL y mucha logica mezclada.

Prioridad:
- P1 critica.

Plan de correccion seguro:
- Corregir prefijos de HR manteniendo alias legacy temporales.
- Restringir asistencia: self-service para colaborador, vista global solo para RRHH/jefaturas autorizadas.
- Separar gradualmente permisos, vacaciones y asistencia en servicios mas pequenos.
- Extraer cambios de esquema a migraciones antes de tocar flujos de aprobacion.

Validacion requerida:
- Colaborador ve solo su asistencia.
- RRHH y jefaturas autorizadas pueden ver/reportar equipos a su cargo.
- Los flujos de permisos y vacaciones siguen pasando por aprobacion parcial/final y cancelacion.

### 6. Servicio Tecnico y Mantenimientos
Estado actual:
- Alta funcionalidad operativa, con fuerte dependencia de integraciones y deuda en controlador.

Errores potenciales y mejoras:
- `backend/src/modules/servicio/servicio.controller.js:29-60` crea esquema y tablas en runtime.
- El mismo controlador mezcla integracion con Drive/Docs, reglas del flujo y persistencia.
- El modulo depende de Google auth por archivo (`GSA_KEY_PATH`) sin una capa comun reutilizada.

Prioridad:
- P2 alta.

Plan de correccion seguro:
- Extraer DDL a migraciones.
- Mover integracion Google a una capa comun de infraestructura.
- Dividir el controlador por casos de uso: documentos, cronogramas, workflow y consulta.

Validacion requerida:
- Generacion documental en Drive.
- Registro de workflow documents.
- Mantenimientos con firmas y exportacion PDF.

### 7. Inventario
Estado actual:
- El dominio base esta claro, pero la seguridad del modulo es insuficiente para un activo critico.

Errores potenciales y mejoras:
- `backend/src/modules/inventario/inventario.routes.js:10-29` protege solo con JWT.
- `backend/src/modules/inventario/inventario.controller.js:93-191` permite crear unidades, capturar serial, asignar y cambiar estado sin `requireRole` visible.
- Esto abre riesgo de mutaciones por cualquier usuario autenticado.

Prioridad:
- P1 critica.

Plan de correccion seguro:
- Definir matriz de permisos por accion: lectura, alta, serializacion, asignacion, cambio de estado y movimientos.
- Aplicar `requireRole` a nivel de ruta y preservar validaciones de negocio actuales.
- Agregar trazabilidad obligatoria del usuario actor en cada movimiento y cambio de estado.

Validacion requerida:
- Solo roles autorizados pueden crear unidades o cambiar estados.
- Seriales duplicados siguen rechazandose.
- La trazabilidad en historial e `inventory_movements` permanece consistente.

### 8. Control Financiero Operativo y Viaticos
Estado actual:
- Buen alcance funcional, con inconsistencia clara de rutas y deuda de esquema.

Errores potenciales y mejoras:
- `backend/src/app.js:229` monta `/api/v1/finanzas`, pero `backend/src/modules/finanzas/finanzas.routes.js:6-9` vuelve a declarar `/api/v1/inventory`.
- `backend/src/modules/viaticos/viaticos.service.js:70-208` hace `CREATE TABLE`, `ALTER TABLE` y `CREATE INDEX` en runtime.
- `finanzas.service.js` sigue sin implementacion funcional real, lo que sugiere logica dispersa.

Prioridad:
- P1 alta.

Plan de correccion seguro:
- Normalizar rutas de finanzas con alias legacy temporales y documentar el endpoint canonico.
- Extraer DDL de viaticos a migraciones.
- Consolidar la logica financiera en servicio o facade dedicado, no en rutas/controladores dispersos.

Validacion requerida:
- Reporte y movimientos financieros siguen funcionando en el endpoint nuevo y en el alias temporal.
- Estados de viaticos y soportes documentales no se alteran.
- Sincronizacion con Silver queda observable y con manejo de error claro.

### 9. Documentos, Archivos y Firma Digital
Estado actual:
- Alta sensibilidad normativa y documental, con gaps de autorizacion y consistencia tecnica.

Errores potenciales y mejoras:
- `backend/src/modules/signature/signature.routes.js:10-38` solo usa `verifyToken` para audit trail y dashboard.
- `backend/src/modules/signature/signature.controller.js:353-356` valida admin con `req.user.roles?.includes('admin')`, pero el backend suele trabajar con `req.user.role`.
- `backend/src/modules/signature/signature.controller.js:379-421` devuelve metricas globales sin guardia explicita por rol.
- Hay problemas de encoding en rutas y controlador.

Prioridad:
- P1 critica.

Plan de correccion seguro:
- Aplicar `requireRole` explicito para dashboard y auditoria de firmas.
- Homologar verificacion de rol para soportar `role` y `roles` durante una fase de transicion.
- Corregir encoding y normalizar mensajes/logs.
- Agregar pruebas de visibilidad de documentos por firmante, admin y usuario ajeno.

Validacion requerida:
- Firmante autorizado ve su audit trail.
- Admin autorizado ve dashboard global.
- Usuario ajeno recibe `403`.

### 10. Notificaciones y Comunicaciones
Estado actual:
- Funcionalmente util, pero con hueco de autorizacion en creacion.

Errores potenciales y mejoras:
- `backend/src/modules/notifications/notifications.routes.js:6-13` usa solo JWT.
- `backend/src/modules/notifications/notifications.controller.js:19-24` acepta `user_id` del payload.
- `backend/src/modules/notifications/notifications.service.js:49-70` inserta el `user_id` recibido sin restriccion adicional.
- Cualquier usuario autenticado podria crear notificaciones para otro usuario si conoce su id.

Prioridad:
- P1 critica.

Plan de correccion seguro:
- Restringir `POST /notifications` a self-service por defecto.
- Permitir envio a terceros solo para roles o procesos internos autorizados.
- Separar API de uso humano y API interna de dispatch si ambas necesidades existen.

Validacion requerida:
- Usuario comun solo puede crear notificaciones para si mismo.
- Jobs internos o roles autorizados pueden enviar notificaciones de sistema.
- Listado, lectura y limpieza siguen sin regresion.

### 11. TI Soporte y Tickets
Estado actual:
- Buen nivel funcional y mejor control de roles que otros modulos, pero con alta deuda de esquema y tamano de servicio.

Errores potenciales y mejoras:
- `backend/src/modules/support-tickets/supportTickets.service.js:46-147` crea tablas, constraints e indices en runtime.
- El servicio es demasiado grande y concentra reglas de SLA, comentarios, eventos, estados y esquema.

Prioridad:
- P2 alta.

Plan de correccion seguro:
- Mover esquema a migraciones.
- Dividir el servicio en tickets, comentarios, eventos, SLA y reporting.
- Agregar pruebas de transicion de estados y vencimiento de SLA.

Validacion requerida:
- Creacion, asignacion, comentarios, cierre y reapertura.
- Calculo de KPI y vencimientos.
- Restriccion de visibilidad solicitante/TI.

### 12. Reportes y Auditoria
Estado actual:
- Auditoria y audit-prep estan razonablemente separados, pero dashboard tiene un error de autorizacion probable.

Errores potenciales y mejoras:
- `backend/src/modules/dashboard/dashboard.routes.js:19-23` solo aplica `verifyToken`.
- `backend/src/modules/dashboard/dashboard.controller.js:61-69` invoca `requireRole(...)` dentro del controlador.
- Ese patron no garantiza corte de ejecucion despues de responder un `403`, por lo que la ruta puede continuar si no se maneja retorno explicito.
- En `audit-prep` hay endpoints mutables sin guardia explicita por rol: `uploadDocument`, `updateDocumentStatus`.

Prioridad:
- P1 alta.

Plan de correccion seguro:
- Mover autorizacion del dashboard a middleware de ruta.
- Revisar y endurecer permisos de escritura en `audit-prep`.
- Agregar pruebas de acceso por rol para dashboard, export y preparacion documental.

Validacion requerida:
- Solo roles comerciales autorizados obtienen resumen.
- Roles no autorizados reciben `403` sin ejecutar consultas.
- Auditoria y audit-prep mantienen accesos vigentes para TI/gerencia.

---

## Lista priorizada de mejoras

### Criticas de seguridad y acceso
1. Agregar `requireRole` explicito en usuarios, departamentos, inventario, asistencia, firma, notificaciones y dashboard.
2. Corregir el bug de autorizacion en `dashboard.controller.js`.
3. Restringir asistencia y PDF por ownership o rol.
4. Evitar creacion de notificaciones para terceros desde usuarios comunes.
5. Homologar verificacion de admin en firma digital.

### Criticas de arquitectura y despliegue
6. Eliminar DDL runtime y moverlo a migraciones versionadas.
7. Normalizar rutas con prefijos redundantes en HR y Finanzas.
8. Centralizar integraciones Google en una capa comun.
9. Reducir archivos monoliticos en permisos, tickets, asistencia y firma.
10. Definir contrato canonico para endpoints legacy y aliases temporales.

### De calidad y mantenibilidad
11. Unificar uso de `requireRole` entre `middlewares/auth` y `middlewares/roles`.
12. Corregir problemas de encoding y mensajes rotos.
13. Documentar matriz de permisos por modulo y endpoint.
14. Agregar pruebas automatizadas de acceso, ownership y flujos criticos.
15. Formalizar checklist de migraciones y rollback antes de cada despliegue.

---

## Plan de correccion por fases

### Fase 0. Baseline de seguridad y validacion
Objetivo:
- Preparar la correccion sin tocar comportamiento de negocio.

Acciones:
- Inventariar endpoints canonicos y legacy.
- Congelar matriz actual de roles por modulo.
- Crear dataset de regresion y smoke tests por modulo.
- Registrar esta fase en `informes` antes de editar codigo.

Salidas documentales:
- Actualizar `DDS` del area afectada si se confirma cambio tecnico.
- Crear informe de ejecucion de baseline.

### Fase 1. Correcciones criticas de acceso y rutas
Objetivo:
- Cerrar riesgos de autorizacion y pathing con bajo impacto funcional.

Acciones:
- Mover controles de rol a middleware de ruta en dashboard, firma, usuarios, departamentos, inventario, asistencia y notificaciones.
- Corregir rutas de HR y Finanzas, manteniendo alias legacy temporales.
- Restringir `notifications.create` a self-service, con excepciones explicitas para sistema.

Resguardos anti-regresion:
- No eliminar endpoints viejos en la misma entrega.
- Mantener logs de uso para detectar consumidores legacy.
- Agregar pruebas de permiso y de contratos HTTP.

### Fase 2. Extraccion de migraciones y saneamiento de esquema
Objetivo:
- Sacar DDL del runtime y volver trazable la evolucion de DB.

Acciones:
- Crear migraciones para support tickets, viaticos, business case queue, servicio workflow, requests y RRHH.
- Dejar en codigo solo verificaciones de disponibilidad, no `CREATE/ALTER`.
- Versionar rollback y prerequisitos por ambiente.

Resguardos anti-regresion:
- Ejecutar migraciones primero en sandbox.
- Verificar compatibilidad con datos existentes.
- Habilitar ventana de observacion antes de remover el fallback runtime.

### Fase 3. Refactor controlado por dominio
Objetivo:
- Bajar complejidad ciclomtica y aislar responsabilidades.

Acciones:
- Partir `permisos.service.js`, `supportTickets.service.js`, `attendance.controller.js` y `signature.controller.js`.
- Separar integracion, persistencia y reglas de negocio.
- Introducir servicios/facades pequenos y reutilizables.

Resguardos anti-regresion:
- Refactor sin cambiar contrato HTTP.
- Pruebas de snapshot de respuestas criticas.
- Revisiones por modulo, no refactor transversal masivo.

### Fase 4. Endurecimiento final y retiro de compatibilidad legacy
Objetivo:
- Cerrar deuda residual y simplificar soporte.

Acciones:
- Retirar aliases legacy de rutas una vez sin consumo.
- Eliminar soporte a `refresh_token` plano despues de migracion.
- Consolidar documentacion final de permisos, rutas y despliegue.

Resguardos anti-regresion:
- Medicion de uso real antes de retirar compatibilidad.
- Ventana de rollback documentada.

---

## Orden recomendado de ejecucion
1. Dashboard, notificaciones, inventario, usuarios/departamentos y asistencia.
2. Firma digital y normalizacion de rutas HR/Finanzas.
3. Migraciones para viaticos, soporte TI, business case y servicio tecnico.
4. Refactor de RRHH, tickets y firma.
5. Retiro de legacy y limpieza final.

## Reglas para aplicar cambios sin danar funcionalidades
- Ningun cambio de seguridad o ruta debe salir sin prueba de acceso permitido y acceso denegado.
- Si se cambia un endpoint existente, debe mantenerse alias temporal o plan de migracion de front/integraciones.
- Si se extrae DDL a migraciones, primero debe validarse el esquema resultante contra datos reales de sandbox.
- Cada fase debe cerrar con actualizacion documental en `URS`, `FRS`, `DDS` o `informes`, segun cambie alcance, funcionalidad o diseno.

## Documentacion que debe actualizarse en cada fase
- `URS`: si cambia alcance funcional, rol permitido o comportamiento esperado por el usuario.
- `FRS`: si cambia la matriz de permisos, rutas canonicas o reglas funcionales.
- `DDS`: si cambia arquitectura tecnica, integraciones, migraciones o estrategia de autenticacion/autorizacion.
- `informes`: evidencia de revision, ejecucion, resultados de pruebas, incidencias y cierre.

## Siguiente paso recomendado
- Ejecutar la Fase 0 y abrir el primer paquete de correccion sobre seguridad de acceso, porque es donde hoy existe mayor riesgo de exposicion sin necesidad de reescribir modulos completos.
