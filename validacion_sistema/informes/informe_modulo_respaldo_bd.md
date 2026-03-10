# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Respaldo automatico de base de datos

## Descripcion del modulo
Gestiona la ejecucion controlada de respaldos de la base de datos PostgreSQL del sistema, su compresion y su carga a Google Drive mediante un endpoint interno protegido y programado desde GCP.

## Alcance funcional
- Generacion de respaldo SQL de la base activa.
- Compresion del respaldo en formato `.sql.gz`.
- Carga del archivo a Google Drive.
- Ejecucion manual o programada via `Cloud Scheduler`.
- Proteccion del endpoint interno con `JOBS_KEY`.
- Registro en logs de resultado, tiempo de ejecucion y estado.

## Componentes del sistema
### Controladores
- No existe controlador dedicado; la exposicion se realiza por ruta interna.

### Servicios
- `backend/src/jobs/databaseBackupToDrive.js`
- `backend/src/middlewares/jobsAuth.js`
- `backend/src/utils/drive.js`
- `backend/src/config/google.js`

### Modelos
- No aplica ORM. El respaldo trabaja contra PostgreSQL via `pg_dump`.

### Rutas
- `backend/src/routes/internalJobs.routes.js`
- Endpoint: `POST /internal/jobs/database/backup`

### Componentes de infraestructura
- Cloud Run: servicio `spi-backend`
- Cloud Scheduler: job `spi-db-backup-daily`
- Secret Manager: secreto `JOBS_KEY`
- Google Drive: carpeta definida por `DRIVE_ROOT_FOLDER_ID` o `DB_BACKUP_DRIVE_ROOT_FOLDER_ID`

## Endpoints de API
- `POST /internal/jobs/database/backup`

## Tablas de base de datos asociadas
- No aplica de forma directa. El proceso extrae un dump de la base completa.

## Dependencias con otros modulos
- Seguridad de jobs internos.
- Integracion Google Drive.
- Configuracion de base de datos PostgreSQL.
- Infraestructura GCP (`Cloud Run`, `Cloud Scheduler`, `Secret Manager`).

## Controles de seguridad
### Control de acceso
- Endpoint interno protegido por `jobsAuth`.
- Requiere header `x-jobs-key` con el valor correcto en produccion.

### Autenticacion
- `JOBS_KEY` consumido desde Secret Manager y expuesto a Cloud Run.

### Autorizacion
- No es un endpoint de usuario final; solo debe ser invocado por automatizacion controlada.

### Registro de auditoria
- Logs HTTP de Cloud Run.
- Logs de aplicacion para ejecucion del job.
- Estado de ejecucion visible desde Cloud Scheduler.

### Proteccion de datos
- Respaldo comprimido y enviado a un destino configurado.
- No debe exponerse por rutas publicas ni ejecutarse sin autenticacion interna.

## Riesgos operativos
- Falta de `JOBS_KEY` deja inoperantes los jobs internos en produccion.
- Header incorrecto en Cloud Scheduler impide la autenticacion del job.
- Credenciales de Google Drive invalidas impiden el almacenamiento del respaldo.
- Fallos de conectividad con PostgreSQL o incompatibilidad de `pg_dump` detienen la ejecucion.

## Posibles escenarios de falla
- `503` por `Internal jobs auth is not configured`.
- `401` por `x-jobs-key` invalido.
- Falla de carga a Drive por credenciales o carpeta no configurada.
- Falla de `pg_dump` por credenciales DB o conectividad.

## Nivel de criticidad
CRITICO

## Prioridad de validacion
MUY ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-BKP-001`: El sistema debe generar respaldos automaticos de la base de datos en infraestructura GCP.
- `URS-BKP-002`: El respaldo debe almacenarse en un destino controlado y verificable.
- `URS-BKP-003`: La ejecucion automatica debe ser segura y no depender de acceso interactivo.
- `URS-BKP-004`: El sistema debe registrar fallas y ejecuciones exitosas para validacion posterior.

## Requerimientos funcionales
- `RF-BKP-001`: Exponer un endpoint interno protegido para ejecucion del respaldo.
- `RF-BKP-002`: Permitir programacion externa por `Cloud Scheduler`.
- `RF-BKP-003`: Requerir `JOBS_KEY` en produccion para jobs internos.
- `RF-BKP-004`: Generar dump, comprimirlo y cargarlo en Drive.
- `RF-BKP-005`: Dejar evidencia de ejecucion en logs y respuesta del endpoint.

## Resumen del diseno tecnico
- `Cloud Scheduler` invoca `POST /internal/jobs/database/backup`.
- `jobsAuth` valida `x-jobs-key`.
- `databaseBackupToDrive.js` ejecuta `pg_dump`, comprime el resultado y lo envia a Drive.
- Cloud Run debe tener configurados secretos y variables de entorno requeridas.

## Revision ejecutada
### Hallazgo principal detectado
- El secreto `JOBS_KEY` existia en Secret Manager.
- El servicio `spi-backend` no tenia `JOBS_KEY` montado en Cloud Run.
- El job `spi-db-backup-daily` existia, pero tenia configurado el header literal `x-jobs-key: TU_JOBS_KEY`.

### Evidencia observada durante la revision
- El endpoint respondia `503` con el mensaje `Internal jobs auth is not configured`.
- Los logs registraban `JOBS_KEY no configurado en produccion - bloqueando endpoint interno`.

### Correccion aplicada en infraestructura
- Se actualizo el servicio `spi-backend` para inyectar `JOBS_KEY=JOBS_KEY:latest`.
- Se actualizo `spi-db-backup-daily` para usar el valor real del secreto en `x-jobs-key`.

## Escenarios de prueba
### Funcionalidad
- Caso: invocacion manual del endpoint con `x-jobs-key` valido.
- Resultado esperado: respuesta `200` y ejecucion del backup.

### Seguridad
- Caso: invocacion sin `JOBS_KEY` configurado en Cloud Run o con header invalido.
- Resultado esperado: bloqueo del endpoint.

### Manejo de errores
- Caso: scheduler con header placeholder.
- Resultado esperado: fallo autenticado y evidencia en logs para correccion.

### Infraestructura
- Caso: ejecucion desde `Cloud Scheduler`.
- Resultado esperado: request `POST` exitoso hacia `/internal/jobs/database/backup`.

## Resultado de validacion actual
- Estado anterior: FALLA OPERATIVA POR CONFIGURACION GCP.
- Estado actual: VALIDADO EN INFRAESTRUCTURA.
- Evidencia confirmada:
  - `spi-backend` ya incluye `JOBS_KEY` en variables de entorno.
  - `spi-db-backup-daily` quedo con `x-jobs-key` correcto.
  - Cloud Run registro solicitudes `POST /internal/jobs/database/backup [200]`.

## Estado documental
- Este informe debe mantenerse actualizado cada vez que cambie:
  - el endpoint de backup
  - el mecanismo de autenticacion interna
  - la programacion en Cloud Scheduler
  - el destino del respaldo

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-BKP-001 Respaldo automatico | `databaseBackupToDrive.runOnce` | Ejecutar job y validar respuesta `200` |
| REQ-BKP-002 Destino verificable | `uploadBackupToDrive` | Confirmar carga en carpeta configurada |
| REQ-BKP-003 Seguridad de jobs | `jobsAuth` | Invocar endpoint con y sin `x-jobs-key` valido |
| REQ-BKP-004 Programacion externa | `spi-db-backup-daily` | Verificar scheduler habilitado y apuntando a URI correcta |
| REQ-BKP-005 Evidencia operativa | Cloud Run logs + Cloud Scheduler | Confirmar request exitosa y trazabilidad de ejecucion |
