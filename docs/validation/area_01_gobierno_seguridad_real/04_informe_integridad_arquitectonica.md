# INFORME DE INTEGRIDAD ARQUITECTONICA

## 1. Patron esperado
El area fue evaluada contra el patron objetivo:
- Routing: definicion clara de endpoints y middleware por modulo.
- Controller: adaptacion HTTP, validacion de entrada y delegacion.
- Service: logica de negocio y coordinacion transaccional.
- Repository: acceso a datos desacoplado del controller.
- Middleware: autenticacion y autorizacion centralizadas.

## 2. Hallazgos transversales
- La implementacion es monolitica modular, pero el grado de separacion varia fuertemente por modulo.
- Existen dos variantes incompatibles de `requireRole`: `backend/src/middlewares/auth.js` y `backend/src/middlewares/roles.js`.
- La capa repository solo es verificable de forma explicita en `auth/session.repository.js`.
- Hay modulos con logica de negocio y SQL mezclados en controller (`management`, `signature`).
- Hay discrepancias de limites de modulo: `auth` escribe asistencia; `signature` asume estructura de usuario distinta a la emitida por `auth`.

## 3. Evaluacion por modulo

### 3.1 Modulo `auth`
- Integridad arquitectonica: Parcial.
- Estructura observada:
  - Rutas claras en `backend/src/modules/auth/auth.routes.js`.
  - Controlador unico con gran concentracion de responsabilidades en `backend/src/modules/auth/auth.controller.js`.
  - Repositorio separado solo para sesiones en `backend/src/modules/auth/session.repository.js`.
- Violaciones detectadas:
  - El controller mezcla OAuth, gestion de usuarios, sesiones, auditoria, geolocalizacion, notificaciones y aceptacion LOPDP.
  - `GET /auth/me` invade el dominio de asistencia mediante escritura en `user_attendance_records`.
  - La seguridad de refresh no esta encapsulada como politica reusable.
- Conclusiones:
  - El modulo funciona, pero tiene acoplamiento alto y responsabilidades cruzadas.
  - El boundary con asistencia y seguridad de sesiones requiere refactorizacion.

### 3.2 Modulo `security`
- Integridad arquitectonica: Comprometida.
- Estructura observada:
  - Rutas y controller existen en `backend/src/modules/security/*`.
  - Helpers tecnicos adicionales: `security.privacy.js`, `security.siem.js`, `security.whitelist.js`.
- Violaciones detectadas:
  - El modulo no esta montado en `backend/src/app.js`.
  - El routing referencia un handler inexistente (`emitOffHoursTest`).
  - Los helpers dependen de tablas no verificadas en el esquema (`security_offhours_whitelist`, `security_jobs_log`).
  - El middleware RBAC usado es la variante defectuosa de `middlewares/auth.js`.
- Conclusiones:
  - El modulo no puede considerarse parte operativa de la arquitectura real.
  - Su diseño esta incompleto y con deuda de integracion.

### 3.3 Modulo `auditoria`
- Integridad arquitectonica: Aceptable.
- Estructura observada:
  - Rutas, controller y service estan bien delimitados.
  - El acceso a datos esta contenido en `auditoria.service.js`.
  - La autorizacion se resuelve con `middlewares/roles.js`, que es la variante mas consistente del proyecto.
- Violaciones detectadas:
  - No existe capa repository separada.
  - La seguridad depende del montaje global de `verifyToken` en `app.js`, no del propio router.
- Conclusiones:
  - Es el modulo mas cercano al patron esperado dentro del area.
  - Requiere solo endurecimiento menor y pruebas de regresion.

### 3.4 Modulo `audit-prep`
- Integridad arquitectonica: Parcial.
- Estructura observada:
  - Existe separacion entre rutas, controller y service.
  - La logica documental y de acceso temporal esta centralizada en el service.
- Violaciones detectadas:
  - Usa `requireRole` de `middlewares/auth.js`, heredando el bypass de RBAC.
  - Hay dependencia directa de nombres de columnas no alineados con el esquema (`u.nombre_completo`).
  - Parte de las reglas de negocio criticas no estan externalizadas ni centralizadas como politicas reutilizables.
- Conclusiones:
  - El diseño es razonable, pero la seguridad y la consistencia del modelo de datos no son confiables.

### 3.5 Modulo `approvals`
- Integridad arquitectonica: Parcial.
- Estructura observada:
  - Rutas claras y `verifyToken` + `requireRole` desde `middlewares/roles.js`.
  - Controller delgado y service con logica de workflow.
- Violaciones detectadas:
  - El service mezcla workflow, persistencia, notificaciones y auditoria.
  - No existe abstraccion repository para solicitudes/aprobaciones.
  - La auditoria se invoca con contrato incorrecto.
  - El rol de quien consulta pendientes no condiciona la cola real.
- Conclusiones:
  - La arquitectura es utilizable, pero el workflow no esta completamente modelado y su trazabilidad es defectuosa.

### 3.6 Modulo `management`
- Integridad arquitectonica: Comprometida.
- Estructura observada:
  - Rutas protegidas con middleware consistente (`verifyToken` + `middlewares/roles.js`).
  - Existe `management.service.js`, pero `management.controller.js` inserta SQL crudo para `listAllRequests`.
- Violaciones detectadas:
  - Ruptura de separacion controller/service por consulta directa a BD en controller.
  - Uso de objetos de datos inexistentes (`audit_logs`, `attachments`).
  - Modelo funcional poco claro: no existe consumidor frontend verificable.
- Conclusiones:
  - El modulo no mantiene integridad arquitectonica suficiente para considerarse estable.
  - Debe definirse si es backend-only o parte de un dashboard real antes de refactorizarlo.

### 3.7 Modulo `signature`
- Integridad arquitectonica: Comprometida.
- Estructura observada:
  - Rutas concentradas en un controller con transaccion manual, calculo de hash, sello, QR y dashboard.
  - No hay capa service ni repository para la operacion principal.
- Violaciones detectadas:
  - La mayor parte de la logica de negocio vive dentro del controller.
  - El modulo asume campos de usuario (`req.user.name`, `req.user.roles`) distintos a los emitidos por `auth`.
  - El contrato frontend/backend no coincide y el esquema SQL tampoco.
  - La documentacion del router indica `/api/signature/*`, pero el montaje real es `/api/*`.
- Conclusiones:
  - La integridad arquitectonica del modulo es baja.
  - Antes de validar funcionalmente, hay que resolver el contrato tecnico extremo a extremo.

## 4. Validacion de componentes comunes
| Componente comun | Evaluacion | Comentario |
|---|---|---|
| `verifyToken` | Parcial | Centraliza autenticacion JWT y propaga `req.user`, pero no cubre validez de sesion persistida. |
| `requireRole` de `middlewares/auth.js` | No conforme | Permite bypass por roles no mapeados. |
| `requireRole` de `middlewares/roles.js` | Conforme con reservas | Es mas robusto, expande grupos y roles equivalentes, pero convive con otra implementacion incompatible. |
| `utils/audit.js` | Parcial | Provee helper reutilizable, pero no hay contrato fuerte y algunos modulos lo consumen mal. |
| Esquema SQL verificable | Parcial | Existe `backend/src/actualsindatos.sql`, pero no hay carpeta `backend/src/migrations` para sostener trazabilidad de cambios. |

## 5. Juicio de integridad del area
- Estado del area: Parcialmente conforme.
- Modulos con integridad aceptable: `auditoria`.
- Modulos operativos pero con deuda importante: `auth`, `audit-prep`, `approvals`.
- Modulos comprometidos: `security`, `management`, `signature`.

## 6. Recomendaciones tecnicas
1. Unificar autenticacion/autorizacion en un solo stack de middleware y eliminar la variante defectuosa de RBAC.
2. Extraer logica de negocio de `auth.controller.js`, `management.controller.js` y `signature.controller.js` hacia servicios dedicados.
3. Introducir una capa de acceso a datos consistente para `approvals`, `management` y `signature`.
4. Definir contratos API versionados y alineados con consumidores frontend antes de seguir documentando FRS/DDS de esos modulos.
5. Restablecer trazabilidad de base de datos con migraciones reales o documentar formalmente que `actualsindatos.sql` es la unica fuente de verdad disponible.
