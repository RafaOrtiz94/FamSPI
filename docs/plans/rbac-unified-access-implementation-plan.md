# Plan de implementacion: acceso, roles, multirroles y permisos unificados

Estado: `plan propuesto / continua el trabajo previo descrito en 3.1 / fases nuevas no iniciadas`

Fecha de corte de evidencia: `2026-10-07`

Este documento reemplaza la numeracion de fases de `docs/plans/rbac-saas-unification-plan.md` (2026-09-03) y es el plan vigente. El plan anterior y sus anexos quedan como registro historico del trabajo ya hecho. Decision aplicada por defecto, pendiente de confirmacion (ver seccion 11).

## 1. Objetivo

Unificar en FamSPI la autorizacion de backend, la visibilidad de frontend y la administracion de roles desde una sola herramienta, sin cambiar el comportamiento vigente de ningun modulo hasta que la equivalencia haya sido probada y aprobada.

El resultado objetivo debe permitir administrar:

- roles y multirroles;
- acceso a modulos;
- permisos de visualizacion;
- permisos de accion;
- alcance sobre registros: propio, asignado, equipo, area o todos, solo cuando el modulo ya tenga ese concepto;
- concesiones individuales temporales;
- vigencia y revocacion;
- trazabilidad completa de cambios.

La UI no sera la autoridad de seguridad. El backend debe tomar la decision final y el frontend debe consumir esa decision para mostrar u ocultar navegacion y acciones.

## 2. Restricciones no negociables

1. No se elimina ni cambia `users.role`, `users.extra_roles` o `user_module_access` durante la transicion.
2. No se modifica el contrato `{ ok: true|false }` ni el prefijo `/api/v1/`.
3. No se activa una regla nueva directamente en produccion.
4. Toda regla nueva inicia en modo sombra y compara su decision contra el comportamiento legacy.
5. La migracion se realiza modulo por modulo, con bandera de activacion y rollback independiente.
6. Una divergencia no explicada bloquea el avance del modulo afectado.
7. Ownership, asignacion, area y estado de workflow permanecen como politicas de recurso; no se convierten en roles.
8. Las migraciones de DB son aditivas, idempotentes y sin `DROP`, eliminacion de columnas ni backfill destructivo.
9. Ningun despliegue a produccion forma parte automatica de una fase. Requiere aprobacion humana y evidencia de aceptacion.
10. Cualquier UI nueva o modificada debe cumplir `DESIGN.md` (sistema de diseno 2.1), incluido su checklist de aceptacion (seccion 14).
11. El modo sombra es a prueba de fallos: un error, una excepcion o una demora del motor nuevo nunca altera la respuesta al usuario. La decision legacy se devuelve siempre, la evaluacion en sombra corre fuera del camino critico con tiempo limite, y existe un interruptor global que la apaga sin desplegar.
12. Tenant y membresias quedan fuera del alcance de este plan. Las tablas `tenants`, `tenant_memberships` y `tenant_modules` estan vacias y hay una sola empresa; no se leen, no se siembran y no participan en ninguna decision. Es viable con el schema actual: `roles.tenant_id` admite nulo (roles globales, migracion 286) y `permissions`, `role_permissions`, `user_roles` y `modules` no dependen de tenant. Decision aplicada por defecto, pendiente de confirmacion (ver seccion 11).
13. Validacion en dos pasos: todo cambio se valida primero en el ambiente local de pruebas (Fase 1A) y solo despues se despliega y se valida en produccion. En produccion no se debe perder nada: ningun cambio llega alli sin haber pasado antes por local.

## 3. Evidencia de partida

Verificada contra el codigo y contra Neon el 2026-10-07. Los `CONTEXT.md` no se usan como fuente: varios estan desactualizados.

- El backend usa `requireRole`, grupos/aliases, `scope`, `extra_roles` y comprobaciones locales.
- El frontend usa `allowedRoles`, `strictRoles`, `scope`, `extra_roles` y condiciones locales de navegacion/pagina.
- El catalogo modular tiene 63 claves y `user_module_access` permite por defecto cuando no existe registro.
- El motor central solo tiene los permisos `module_access.read` y `module_access.manage`.
- En Neon, `roles`, `permissions`, `role_permissions`, `user_roles`, `modules`, `tenants`, `tenant_memberships` y `tenant_modules` existen y tienen 0 filas. `user_module_access` tiene 256 filas.
- `requireModule(moduleKey)` existe, pero no protege rutas productivas.
- `x-app-path` interviene actualmente en la autorizacion modular y no esta ligado al endpoint real.
- Hay 42 usuarios y 19 valores distintos de rol. Tres usuarios tienen rol `pending` y dos el texto `"null"`, todos inactivos. Tres usuarios tienen `extra_roles`.
- No existe CI: no hay carpeta `.github/workflows`.

Neon contradice el CONTEXT.md en cantidades de usuarios y estados globales. Neon es la fuente de verdad para DB.

### 3.1 Relacion con el plan anterior y trabajo heredado

El plan `rbac-saas-unification-plan.md` y sus anexos (`rbac-phase-0-baseline.md`, `rbac-phase-2-schema-design.md`, `rbac-previous-phases-verification.md`) registran trabajo ya ejecutado. Este plan lo hereda; no se rehace:

| Trabajo previo | Estado verificado | Donde se usa en este plan |
|---|---|---|
| Linea base tecnica de backend, frontend y Neon | hecho | insumo de Fase 0 |
| Nucleo `backend/src/security/authorization/` (`hasPermission`, `requirePermission`, `requireModule`, normalizacion de roles) con pruebas unitarias | hecho | base de Fases 2 y 4 |
| Piloto de permisos en `module-access` | hecho | base de Fase 5 |
| Schema RBAC/SaaS aplicado en Neon (migraciones 284-286) | hecho, tablas vacias | base de Fase 3 |
| `/auth/me` publica `module_catalog`, `permissions` y `authorization_manifest_version` de forma aditiva | hecho | base de Fase 4 |
| Matriz endpoint por endpoint, responsables funcionales, politica de `extra_roles` | pendiente | Fase 0 |
| Pruebas de integracion con rutas Express reales, auditoria persistente de decisiones | pendiente | Fases 1B y 8 |

Correspondencia de fases: la Fase 0 del plan anterior equivale a la Fase 0 de este; su Fase 1 (nucleo backend) alimenta la Fase 4; su Fase 2 (modelo de datos) alimenta la Fase 3; su Fase 9 (multi-tenant) queda fuera de alcance.

### 3.2 Dimension real del trabajo

Conteo sobre el codigo al 2026-10-07, para planificar las olas de la Fase 7:

| Elemento | Cantidad |
|---|---|
| Archivos de rutas backend (`*.routes.js`) | 88 |
| Usos de `requireRole(` en rutas | 987 |
| Usos de `allowedRoles` en el frontend | 100 |
| Comparaciones locales de rol en el frontend | 66 |
| Archivos de prueba backend | 125 |
| Archivos de prueba frontend | 15 |

Inventario generado desde los routers reales el 2026-10-07 (`backend/scripts/rbac/generate_access_inventory.js`, salida en `docs/plans/rbac-inventory/`):

| Clasificacion del endpoint | Cantidad |
|---|---|
| Protegido por rol (`requireRole`) | 1.070 |
| Solo autenticado, sin guarda de rol en la ruta | 382 (220 son de escritura) |
| Interno (`/internal/`, llave de jobs) | 36 |
| Publico | 32 |
| Con permiso central (`requirePermission`) | 5 |
| Total | 1.525 en 61 modulos |

Los 382 endpoints "solo autenticado" no son necesariamente huecos: muchos validan rol o propiedad dentro del controlador o del servicio. Clasificar cada uno es trabajo de la Fase 0. El generador tiene modo `--check`, que falla si aparece un endpoint nuevo o cambia una guarda sin regenerar el inventario.

### 3.3 Estado real de las herramientas de prueba

- Jest (backend): operativo. Linea base en verde desde el 2026-10-07: 125 de 125 suites, 872 pruebas, 2 omitidas. La unica suite que fallaba (`consumptionVersionConflict.integration.test.js`) no cargaba porque `uuid` 13 es solo ESM y Jest no lo interpreta; se corrigio simulando `uuid` en la prueba, como ya hacen las demas suites. Sin cambio en codigo productivo.
- React Testing Library (frontend): instalado, con cobertura baja (15 archivos).
- Playwright: solo esta instalada la libreria `playwright`. Faltan `@playwright/test`, la configuracion y la carpeta de pruebas E2E.
- Supertest: no esta instalado.
- No hay ambiente de pruebas operativo separado de produccion; la base de datos de trabajo es Neon de produccion. Crearlo es la Fase 1A.

### 3.4 Infraestructura actual (verificada en GCP el 2026-10-07)

| Pieza | Produccion | Observacion |
|---|---|---|
| Backend | Cloud Run `spi-backend`, proyecto `famspi-sbox`, `us-central1`, `NODE_ENV=production` | se despliega con `scripts/deploy_backend_cloudrun.ps1`, que ya recibe `ProjectId`, `Region` y `ServiceName` como parametros pero fija `NODE_ENV=production` |
| Frontend | Firebase Hosting, proyecto `fam-spi-front` (`https://fam-spi-front.web.app`) | se despliega con `spi_front/clean_deploy.ps1`; un solo sitio, sin targets |
| Base de datos | Neon, proyecto `muddy-sun`, base `FamSPI` | contrasena en Secret Manager (`DB_PASSWORD`). El plan de Neon tiene cuota mensual de computo por proyecto: al agotarse, Neon suspende la base y nadie puede iniciar sesion. Ha ocurrido cuatro veces (2026-07-21, 08-11, 08-20 y 09-28). Hay otros dos proyectos, `wispy-moon` y `lucky-bar`, reservados como relevo; ver `.agents/skills/neon-compute-quota-failover-skill.md` |
| Sandbox previo | Cloud Run `spi-backend-sandbox` en `us-central1` y en `southamerica-east1` | creados el 2026-03-24, sin cambios desde marzo/abril; el de `southamerica-east1` usa `NODE_ENV=sandbox` y `FRONTEND_URL=https://spi-sandbox.famproject.com.ec`. Auditados el 2026-10-07: sin ninguna peticion HTTP en los ultimos 30 dias; ambos leen la base del secreto `SBX_DATABASE_URL` (creado el 2026-01-21), que referencia un cuarto proyecto de Neon (`ep-ancient-mode-a5mhz7jz`, base `neondb`) y tiene un formato invalido de 13 lineas, por lo que es dudoso que conecten. Usan `SBX_JWT_SECRET` y `SBX_JWT_REFRESH_SECRET`, distintos de produccion. Conclusion: abandonados y no reutilizables tal como estan |

## 4. Modelo objetivo de decision

Una solicitud se permite unicamente cuando pasan las condiciones aplicables:

```text
identidad activa
  + modulo habilitado
  + permiso de accion efectivo
  + politica de alcance del recurso
  + regla del estado del workflow
  = decision permitida
```

Unidad canonica propuesta:

```text
<modulo>.<recurso>.<accion>
```

Los nombres definitivos no se inventan en esta etapa. Se obtienen de la matriz verificada de endpoints, pantallas y acciones y necesitan aprobacion del responsable funcional de cada modulo.

## 5. Estrategia de entrega segura

Cada cambio recorrera esta secuencia:

```text
caracterizar comportamiento actual
  -> implementar de forma aditiva
  -> probar localmente
  -> ejecutar modo sombra
  -> comparar decisiones
  -> corregir divergencias
  -> aprobar modulo
  -> activar por bandera
  -> smoke test posterior
  -> observar
```

No se mezclaran en una misma entrega el cambio de modelo, la migracion de varios modulos y la eliminacion del mecanismo legacy.

## 6. Fases

### Fase 0 - Gobierno, alcance y linea base congelada

Objetivo: convertir el inventario tecnico en una fuente de verdad aprobable.

Trabajo:

- Generar la matriz `endpoint -> modulo -> recurso -> accion -> roles actuales -> alcance -> workflow` con un script que lea `registerRoutes.js` y los argumentos reales de cada `requireRole(`. Con 987 guardas no es viable ni fiable escribirla a mano; lo generado desde el codigo no puede inventar permisos.
- Generar igual la matriz `ruta UI -> item de navegacion -> modulo -> visualizacion -> acciones visibles` desde `AppRoutes.jsx` y `NavigationBar.jsx`.
- Completar a mano solo lo que el codigo no expresa: recurso, accion, alcance y regla de workflow.
- Identificar endpoints publicos, autenticados, internos y protegidos por reglas de servicio.
- Registrar aliases, roles obsoletos, valores invalidos y capacidades almacenadas como `extra_roles`.
- Designar responsable funcional y conjunto de usuarios de prueba por modulo.
- Definir politica de acceso por ausencia de configuracion y politica de expiracion de grants.
- Capturar un snapshot anonimizado de roles, asignaciones, accesos modulares y estados para comparar.

Avance al 2026-10-07 (todo generado desde el codigo y desde la copia local de datos; nada escrito a mano):

| Entregable | Archivo en `docs/plans/rbac-inventory/` | Generador |
|---|---|---|
| Matriz de endpoints (1.529) con guardas, roles y clasificacion | `backend-endpoints.json` / `.csv` | `backend/scripts/rbac/generate_access_inventory.js` |
| Matriz de rutas UI (165) con guardas anidadas | `frontend-routes.json` / `.csv` | `spi_front/scripts/rbac/generate_route_inventory.js` |
| Navegacion real por rol (17 roles) | `frontend-navigation-by-role.json` | `spi_front/e2e/rbac-navigation.spec.js` |
| Registro de roles, aliases y capacidades (67 nombres) | `registro-de-roles.md` | `backend/scripts/rbac/build_access_review.js` |
| Matriz por modulo (63 modulos) lista para revision funcional | `matriz-por-modulo.md` | idem |
| Foto anonimizada de datos (solo conteos) | `datos-snapshot.json` | idem, con `STAGING_DATABASE_URL` local |

- Hecho: prueba automatica de inventario. Ambos generadores tienen modo `--check`; el de rutas UI corre en CI y el de endpoints se ejecuta en local antes de cada despliegue (carga la app completa).
- Hecho: clasificacion automatica del 100% de endpoints y rutas en publico, interno, solo autenticado, por rol y permiso central.
- Datos relevantes de la foto: 31 de los usuarios activos no tienen ninguna fila en `user_module_access` (acceden por la regla de permitir por defecto); solo `jefe_ti`, `talento_humano` y los pasantes tienen filas. Dos modulos estan en construccion (`kickoff_2026`, `ti_casos_externos`).
- Pendiente, requiere personas: nombrar responsable por modulo y aprobar `matriz-por-modulo.md`; revisar las 222 escrituras sin guarda de rol en la ruta (listadas por modulo con casilla); decidir los 22 alias sin usuarios y las politicas de la seccion 11. Completar recurso, accion, alcance y regla de workflow por endpoint depende de esas aprobaciones.
- Hecho (2026-10-07): revision de las 222 escrituras sin guarda de rol (175 unicas) en `revision-escrituras-sin-rol.md`: 42 validan rol en el codigo, 20 tienen guarda propia, 101 usan la identidad del usuario, 12 revisadas a mano. Un hallazgo de severidad baja (`POST /signature-workflows/validate-signer-profiles`, sin control) y 3 abiertas por diseno. 73 solo tienen revision automatica.
- Hecho (2026-10-07): verificacion de vistas por rol en `vistas-por-rol.md` (`spi_front/e2e/rbac-views.spec.js`). 199 enlaces de menu de 17 roles: 195 abren, 1 en construccion, 1 redirige y 2 rebotan en "no autorizado" (`jefe_financiero` -> Solicitudes; `jefe_servicio` -> Obs. BC). Sin errores de pagina.
- Defectos encontrados en la verificacion, ajenos al RBAC y sin corregir: las notas de proceso de compras privadas responden 500 (`processNotes.service.js` busca una columna `client_name` que no existe en `private_purchase_requests`); `GET /private-purchases/by-role/jefe_logistica` responde 500 al rol `logistica`; cuatro pantallas abren pero una de sus llamadas responde 403 (`financiero`, `jefe_operaciones`, `jefe_servicio`, `jefe_ti`).

Pruebas y evidencia:

- Prueba automatica que falle si aparece un endpoint o ruta UI sin clasificar.
- Revision cruzada de la matriz contra `registerRoutes.js`, `AppRoutes.jsx`, catalogo modular y Neon.
- Aprobacion funcional por modulo: el responsable revisa la matriz generada de su modulo completa, no fila por fila.

Compuerta de salida:

- 100% de endpoints y rutas UI clasificados.
- Cero permisos inventados o sin propietario funcional.
- Politicas de default y `extra_roles` aprobadas.

### Fase 1A - Ambiente de staging separado de produccion

Decision del 2026-10-07: el ambiente de pruebas es LOCAL, no en la nube. Corre entero en el equipo de TI: PostgreSQL 17 propio (misma version mayor que produccion) en `%LOCALAPPDATA%FamSPI-staging`, puerto 5544; backend en `http://localhost:8090` con `NODE_ENV=staging`; frontend en `http://localhost:3101`. Se arranca con `scripts/staging_local.ps1`. No usa Cloud Run, Firebase, secretos `_STAGING`, carpeta de Drive ni OAuth de Google: se entra con las cuentas `prueba.<rol>`. Ventajas: no comparte cuota de Neon ni proyecto de GCP con produccion, no tiene costo y no requiere despliegues. Limites aceptados: solo se usa desde ese equipo (o su red local), no reproduce Cloud Run y deja fuera las funciones de Google (inicio de sesion con Google, Drive, documentos). El staging en la nube descrito mas abajo queda como opcion futura, no como requisito; `deploy_backend_cloudrun.ps1 -Environment staging` ya lo soporta. El proyecto de Neon `frosty-dawn` se uso como paso intermedio y origen de la copia saneada; la base local se carga desde ahi con `backend/scripts/staging/load_local_staging_db.sh`, sin leer produccion.

Objetivo: tener un ambiente completo (frontend, backend y base de datos) donde probar cada cambio sin posibilidad de afectar datos, correos ni usuarios de produccion. Es requisito de todas las fases siguientes: nada que cambie autorizacion se prueba por primera vez en produccion.

Punto de partida (auditoria hecha, seccion 3.4): los dos servicios `spi-backend-sandbox` estan abandonados, sin trafico y con un secreto de base de datos invalido. Se crea `spi-backend-staging` nuevo. Los sandbox y sus secretos `SBX_*` se eliminan al cerrar la fase, con aprobacion, y antes se confirma en la consola de Neon si el proyecto `ancient-mode` sigue existiendo y se puede reutilizar.

Restriccion critica de la base de staging: no puede ser una rama del proyecto de produccion. Una rama comparte la cuota de computo del proyecto; ejecutar pruebas contra ella consumiria la cuota de produccion y podria suspenderla, que es exactamente la caida que ya ocurrio cuatro veces. Tampoco puede usar `wispy-moon` ni `lucky-bar`: son los relevos de produccion y gastarlos deja al sistema sin respaldo.

Componentes:

| Pieza | Staging | Como se obtiene |
|---|---|---|
| Base de datos | proyecto de Neon propio y exclusivo para staging (cuota independiente), con su usuario y contrasena | se crea en la consola de Neon (o se reutiliza `ancient-mode` si existe y esta libre) y se carga con respaldo y restauracion desde produccion, siguiendo el procedimiento ya probado de la skill de relevo de Neon |
| Backend | Cloud Run `spi-backend-staging` en `famspi-sbox`, `NODE_ENV=staging`, 0 instancias minimas | el mismo `deploy_backend_cloudrun.ps1`, ampliado con un parametro de ambiente que elige nombre de servicio, variables y secretos |
| Frontend | segundo sitio de Firebase Hosting (por ejemplo `fam-spi-front-staging`) apuntando al backend de staging | deploy target en `firebase.json` y parametro de ambiente en `clean_deploy.ps1` |
| Secretos | secretos propios en Secret Manager con sufijo `_STAGING` (base de datos, JWT, llave de cuenta de servicio si se separa) | nunca se reutiliza la contrasena de la base de produccion |
| Archivos | carpeta raiz de Drive propia de staging | variable `DRIVE_ROOT_FOLDER_ID` distinta |

Aislamiento obligatorio (staging no puede producir efectos fuera de si mismo):

- Correo apagado: `EMAIL_NOTIFICATIONS_ENABLED=false` o `DISABLE_MAIL=true`. Se permite una lista blanca de destinatarios de prueba si hace falta validar disenos.
- Sin respaldo a Google Chat: el mailer publica en un webhook de Chat cuando fallan cuenta de servicio y SMTP (comprobado el 2026-10-06). En staging ese webhook no se configura.
- Jobs apagados: `ENABLE_JOBS=false` y ningun Cloud Scheduler apuntando a staging.
- Notificaciones push apagadas.
- Llaves JWT distintas de produccion: un token de produccion no sirve en staging ni al reves.
- OAuth de Google: URI de redireccion propia del dominio de staging.
- Guarda de arranque: con `NODE_ENV=staging` el backend se niega a iniciar si `DB_HOST` es el host de produccion. Es el unico cambio de codigo productivo de esta fase; es aditivo y no altera el arranque en produccion.
- Marca visible: el frontend de staging muestra una franja fija "STAGING" en la navbar, conforme a `DESIGN.md`, para que nadie lo confunda con produccion.

Datos:

- La base de staging contiene datos reales de colaboradores y clientes. Acceso restringido a TI.
- El respaldo de produccion se toma fuera del horario laboral para no competir con los usuarios ni gastar computo en horas pico.
- Al cargar o refrescar la base se ejecuta un script que reemplaza los correos de usuarios por direcciones de prueba y limpia tokens y suscripciones push, para que ningun aviso pueda llegar a una persona real aunque falle el apagado de correo.
- Se crean usuarios de prueba, uno por cada rol vigente, solo en staging. Son los que usan Playwright y las pruebas de integracion.
- La base se refresca desde produccion antes de cada compuerta de fase. Toda migracion se aplica primero en staging.
- Las pruebas automaticas se ejecutan en lotes acotados y el computo de staging se apaga solo al quedar inactivo, para no agotar tampoco la cuota de su propio proyecto.

Trabajo:

1. Auditar `spi-backend-sandbox` (hecho el 2026-10-07; resultado en 3.4).
2. Crear o recuperar el proyecto de Neon de staging, su usuario y sus secretos `_STAGING`.
3. Cargar la base desde un respaldo de produccion y escribir y probar el script de saneamiento de datos.
4. Parametrizar por ambiente `deploy_backend_cloudrun.ps1` y `clean_deploy.ps1`, sin cambiar su comportamiento por defecto (sin parametro despliegan a produccion igual que hoy).
5. Agregar la guarda de arranque y la franja "STAGING".
6. Desplegar backend y frontend de staging.
7. Crear los usuarios de prueba por rol.
8. Documentar en `docs/` como desplegar, refrescar y acceder a staging.

Avance al 2026-10-07:

- Hecho: auditoria del sandbox (paso 1).
- Hecho: base de staging en el proyecto de Neon `frosty-dawn` (PostgreSQL 18.6; produccion es 17.11), cadena de conexion en el secreto `DB_URL_STAGING` (paso 2, falta crear los secretos `_STAGING` de contrasena, JWT y jobs).
- Hecho: carga desde respaldo de produccion (89 MB comprimidos; el respaldo tomo 6 min 26 s de lectura sobre produccion y la restauracion por secciones 15 min) y saneamiento con `backend/scripts/staging/sanitize_staging_db.js`: 53.299 valores de correo reemplazados en 137 columnas; vaciadas sesiones (4.607), tokens de Gmail (2), tokens de atajos (8), suscripciones push (24) y tokens de consentimiento (31); eliminados 414 envios pendientes o fallidos. Se conservan dos correos reales para acceso de TI. Verificado con una segunda pasada: 0 pendientes (paso 3).
- Limite conocido del saneamiento: no reescribe correos dentro de columnas de arreglo o JSON (`bc_notification_legal_audit.email_cc`, `process_notes.email_meta`, `gmail_context_communications.recipient_emails`, `module_global_status.whitelist_emails`) ni dentro de textos libres. Por eso el correo apagado y la guarda de arranque siguen siendo obligatorios.
- Hecho: `deploy_backend_cloudrun.ps1` acepta `-Environment staging` y `-PrintOnly`; sin parametro despliega produccion igual que antes (paso 4, falta `clean_deploy.ps1`).
- Hecho: guarda de arranque `backend/src/config/stagingGuard.js` con pruebas (paso 5, falta la franja "STAGING").
- Hecho: 17 cuentas de prueba, una por rol vigente (`prueba.<rol>`), creadas con `backend/scripts/staging/seed_staging_test_users.js` (paso 7). Entran por el acceso local que ya usan los pasantes (boton "Acceso pasantes" del login, `POST /api/v1/auth/local-login`); no se modifico el codigo de autenticacion porque ese endpoint ya acepta cualquier rol con `auth_provider=local`. Comparten una contrasena generada, guardada en el secreto `STAGING_TEST_USERS_PASSWORD`. Cada cuenta copia departamento y acceso a modulos del usuario activo mas antiguo de su rol.
- Hecho: el saneamiento tambien invalida la contrasena de las cuentas locales reales copiadas de produccion (3), que conservaban su clave.
- Orden de un refresco de staging: restaurar -> `sanitize_staging_db.js --apply` -> `seed_staging_test_users.js`.
- Pendiente: desplegar backend y frontend de staging y documentacion (pasos 6 y 8). Requiere carpeta de Drive de staging, nombre del sitio de Firebase y URI de redireccion OAuth.

Pruebas y evidencia:

- Prueba unitaria de la guarda de arranque: con ambiente staging y host de produccion, falla; con ambiente production, no interviene.
- Lista de verificacion de aislamiento ejecutada y guardada: accion que dispara correo no envia nada; no aparece mensaje en Chat; subida de archivo cae en la carpeta de staging; jobs inactivos; token de produccion rechazado.
- Las credenciales de staging no pueden conectarse a la base de produccion, y al reves.
- Smoke por area en staging: login, `/auth/me`, navbar y un flujo por modulo principal.
- Los scripts de despliegue sin parametro siguen desplegando a produccion: se verifica en modo simulacion antes de usarlos.

Compuerta de salida:

- Staging desplegado, accesible solo para TI y con la lista de aislamiento completa en verde.
- Refresco de la base ensayado al menos una vez de principio a fin.
- Consumo de computo de produccion sin aumento atribuible a staging.
- Ninguna variable ni secreto de produccion fue modificado.

### Fase 1B - Red de seguridad y CI

Objetivo: poder detectar cualquier regresion antes de modificar autorizacion.

Trabajo, en este orden (ver estado real de herramientas en 3.3):

1. Dejar la linea base en verde (hecho el 2026-10-07; detalle en 3.3). Sin esto ninguna compuerta posterior es fiable.
2. Montar las herramientas que faltan, sin tocar codigo productivo: instalar `supertest` (backend, devDependency) para pruebas de rutas Express reales; instalar `@playwright/test` y crear `playwright.config` y la carpeta `e2e/` (frontend).
3. Apuntar las pruebas E2E y de integracion al staging de la Fase 1A, con los usuarios de prueba por rol. Las pruebas automaticas nunca se ejecutan contra produccion ni escriben en su base.
4. Agregar pruebas de caracterizacion para `collectUserRoles`, aliases, superroles, `extra_roles`, `ProtectedRoute`, navegacion y acceso modular.
5. Construir fixtures representativos sin datos personales para cada uno de los 19 roles vigentes y cada tipo de excepcion.
6. Agregar pruebas de contrato para respuestas 401, 403 y respuestas exitosas sin cambiar payloads.
7. Crear recorridos Playwright de navegacion, acceso directo por URL y visibilidad de acciones.
8. Incorporar un pipeline de CI (`.github/workflows`) con lint sin auto-fix, pruebas backend, pruebas frontend y build.
9. Publicar resultados como evidencia; una prueba inestable bloquea la fase hasta estabilizarse.

Avance al 2026-10-07:

- Hecho (paso 1): linea base en verde. Backend 131 suites y 923 pruebas; frontend 17 suites y 122 pruebas. Se corrigieron dos pruebas que ya fallaban antes de este trabajo, sin tocar codigo en uso: `consumptionVersionConflict` (no cargaba por `uuid` ESM) y `dateUtils` (esperaba una raya larga y el codigo devuelve guion desde abril). Tambien un error de lint en `LiveOperationalMap.test.jsx`.
- Hecho (paso 2): `supertest` en backend y `@playwright/test` en frontend, con `spi_front/playwright.config.js` y carpeta `spi_front/e2e/`. La configuracion se niega a correr contra una URL que no sea local.
- Hecho (paso 4): caracterizacion del RBAC legacy del backend en `backend/src/middlewares/__tests__/roles.characterization.test.js` (normalizacion, grupos, superroles, `extra_roles`, atajo de pasante y matriz rol por grupo) y del frontend en `spi_front/src/core/auth/__tests__/ProtectedRoute.characterization.test.jsx`.
- Hecho (paso 5): fixtures sin datos personales en `backend/src/security/authorization/__fixtures__/legacyRoles.fixture.js` (17 roles reales, valores invalidos y combinaciones reales de `extra_roles`).
- Hecho (paso 6): contrato HTTP 401/403/200 de `verifyToken` y `requireRole` en `authContract.characterization.test.js`.
- Hecho (paso 7): 19 pruebas E2E en `spi_front/e2e/rbac-navigation.spec.js`: cada uno de los 17 roles entra a su panel y su navegacion (menus y enlaces) se compara con la linea base `docs/plans/rbac-inventory/frontend-navigation-by-role.json`; mas acceso directo por URL denegado y redireccion al login sin sesion. Dos corridas seguidas dieron el mismo resultado.
- Hecho (paso 8): `.github/workflows/ci.yml` con lint sin auto-fix, pruebas y build. No verificado en GitHub: se activa al subirlo.
- El verificador del inventario (`generate_access_inventory.js --check`) detecto 4 endpoints nuevos de asistencia agregados en paralelo; inventario regenerado a 1.529 endpoints.

Hallazgos de la caracterizacion (comportamiento actual, no deseado):

- Backend y frontend deciden distinto. El backend expande grupos (`requireRole(["comercial"])` deja pasar a `jefe_comercial`); el frontend compara el valor exacto.
- Superroles distintos. En el backend solo `admin` y `administrador` pasan todo, y ningun usuario real tiene esos roles. En el frontend `admin` no tiene pase; lo tienen `gerencia` y `pasante` en rutas no estrictas.
- `gerencia_general`, que es el rol real del usuario de gerencia, no recibe el pase de `gerencia` del frontend salvo que su `scope` sea exactamente `gerencia`.
- `jefe_logistica` y `logistica` no pertenecen a ningun grupo de roles del backend.
- Siete grupos o roles no permiten hoy a ningun rol real: `admin`, `backoffice_comercial` (solo llega por `extra_roles`), `esp_app`, `esp_app_ext`, `jefe_finanzas`, `jefe_servicio_tecnico` y `jefe_talento_humano`.
- El texto `"null"` como rol no se trata como pendiente: cae en no autorizado.

Comandos base, sujetos a la configuracion real de cada entrega:

```bash
cd backend && npx eslint <archivos-modificados>
cd backend && npm test -- --runInBand <pruebas-afectadas>
cd spi_front && npx eslint <archivos-modificados>
cd spi_front && CI=true npm test -- --watchAll=false <pruebas-afectadas>
cd spi_front && npm run build
```

La suite completa se ejecuta en la compuerta de cada fase. No se usara el script backend `npm run lint` para una verificacion de solo lectura porque actualmente incluye `--fix`.

Compuerta de salida:

- La linea base pasa sin cambios funcionales.
- Cada rol representativo puede iniciar sesion, navegar y ejecutar sus flujos actuales en staging.
- CI impide integrar si lint, test o build fallan.

### Fase 2 - Contencion del riesgo de autorizacion modular

Objetivo: retirar gradualmente `x-app-path` como autoridad sin afectar a pasantes ni a otros usuarios.

Trabajo:

- Crear un registro explicito y verificable de `API route -> module_key`.
- Ejecutar `requireModule(moduleKey)` inicialmente en modo sombra.
- Registrar diferencias entre modulo declarado, `x-app-path` y decision legacy, sin guardar datos sensibles.
- Crear pruebas negativas para encabezados ausentes, falsificados o pertenecientes a otro modulo.
- Mantener temporalmente la decision legacy mientras se mide paridad.
- Reemplazar el bypass generico de `pasante` solamente cuando todas sus asignaciones efectivas esten cubiertas por modulo y permiso explicitos.
- Conservar `x-app-path` unicamente para observabilidad una vez completada la migracion.

Avance al 2026-10-08 (validado solo en el ambiente local; nada desplegado):

- Hecho: registro `backend/src/security/authorization/apiModuleRegistry.js` con 34 prefijos de API: 5 transversales y 29 con sus modulos. Sale de las llamadas observadas al recorrer el menu de los 17 roles; una prueba impide declarar modulos que no existan en el catalogo. Es parcial (solo cargas de pagina) y requiere aprobacion funcional.
- Hecho: modo sombra `moduleShadow.js`, llamado desde `moduleAccessGuard`. Apagado salvo `RBAC_MODULE_SHADOW=true` (encendido solo en `staging_local.ps1`). No se espera, descarta sus errores y no guarda identificadores de usuario ni de recurso. Cada diferencia se escribe una vez en el log con `rbacShadow: "module"`.
- Hecho: pruebas negativas (encabezado ausente, falsificado y de otro modulo), de fallo seguro y de respuesta identica con la sombra encendida y apagada.
- Resultado local: de 876 combinaciones sin declarar a 0 decisiones distintas y 2 de modulo distinto, ya incorporadas al registro. No se repitio el recorrido despues de incorporarlas.
- Hallazgo: `GET /api/v1/notifications` (la raiz, sin barra final) no entra en la exencion de `BYPASS_PREFIXES` y si pasa por el control modular, al contrario de lo que dice su comentario.
- Limite: el conteo vive en memoria por instancia; en Cloud Run la evidencia se lee del log.
- Pendiente: declarar los prefijos no observados (acciones de escritura y pantallas fuera del menu), encender la sombra en produccion con aprobacion y cumplir la ventana de observacion, y sustituir el atajo de `pasante`.

Compuerta de salida:

- Cero divergencias no explicadas durante la ventana de observacion acordada.
- Pasantes conservan exactamente los accesos aprobados y no pueden usar una ruta habilitada para abrir otra API.
- Rollback probado mediante bandera sin despliegue adicional.

### Fase 3 - Catalogo central y persistencia RBAC

Objetivo: hacer operativas las tablas centrales ya existentes sin sustituir aun el modelo legacy.

Trabajo:

- Verificar nuevamente el schema real en Neon antes de cada migracion.
- Definir y sembrar catalogos de modulos, permisos y roles desde la matriz aprobada.
- Implementar asignaciones de roles y permisos de forma aditiva.
- Incorporar grants individuales con motivo, asignador, fecha de inicio, expiracion y revocacion.
- Agregar constraints e indices solo despues de probarlos con datos representativos.
- Ejecutar backfill en transaccion, con conteos antes/despues y reporte de filas no convertibles.
- No convertir automaticamente roles invalidos, `pending`, `pendiente` o el texto `"null"`; requieren resolucion explicita.

Pruebas y evidencia:

- Pruebas de migracion desde un schema equivalente a produccion.
- Reejecucion idempotente.
- Integridad referencial. Las tablas de tenant no se tocan (restriccion 12).
- Comparacion de conteos, duplicados, expiraciones y asignaciones efectivas.
- Rollback ensayado en copia/ambiente de prueba.

Compuerta de salida:

- Backfill 100% explicable.
- Ningun usuario pierde o gana permisos por el solo hecho de cargar los catalogos.
- Neon y manifiesto central producen resultados reproducibles.

### Fase 4 - Motor central en modo sombra

Objetivo: calcular permisos centralmente sin cambiar respuestas productivas.

Trabajo:

- Resolver roles, permisos, modulos, grants y expiraciones desde el modelo central.
- Mantener compatibilidad con `users.role`, `scope`, aliases y `extra_roles` durante la transicion.
- Publicar un manifiesto versionado desde `/auth/me` de forma aditiva.
- Registrar `legacy_decision`, `central_decision`, razon, modulo y permiso.
- Aplicar la restriccion 11: la evaluacion central va envuelta en captura de errores y tiempo limite, se ejecuta despues de resolver la decision legacy y su resultado solo se registra. Un interruptor global por variable de entorno la apaga.
- Probar explicitamente el fallo seguro: con el motor central lanzando error, agotando el tiempo o sin conexion a base, la respuesta al usuario debe ser identica a la legacy.
- Invalidar cache al cambiar rol, permiso, modulo o grant.
- Evitar poner el catalogo completo de seguridad en JWT si puede quedar obsoleto; validar la estrategia con pruebas de sesion/refresh.

Compuerta de salida:

- Paridad demostrada para todos los escenarios de la matriz.
- Cero diferencias no aprobadas.
- Rendimiento dentro del presupuesto definido con medicion real.
- Los contratos existentes permanecen compatibles.

### Fase 5 - Piloto de enforcement

Objetivo: validar el modelo completo en un modulo controlado.

Modulo piloto:

- `module-access`, porque ya usa permisos canonicos y no representa por si mismo un workflow comercial o financiero.

Trabajo:

- Activar permiso central por bandera solo para el piloto.
- Mantener ruta de rollback inmediata al evaluador legacy.
- Probar lectura, administracion, denegacion, expiracion y auditoria.
- Observar errores 401/403, latencia y divergencias.

Compuerta de salida:

- Todas las pruebas del piloto pasan.
- No existen regresiones en los demas modulos.
- Rollback ejercitado y documentado.
- Aceptacion funcional y tecnica registrada.

### Fase 6 - UI unificada de administracion

Objetivo: administrar el modelo central sin exponer inconsistencias ni permitir escalamiento accidental.

Punto de partida: la administracion no se construye desde cero. Ya existen `spi_front/src/modules/ti/pages/TIModuleAccessPage.jsx` (ruta `/dashboard/ti/modulos`, acceso por modulo) y la gestion de usuarios de Talento Humano (`PeopleAdminHub`, `/dashboard/talento-humano/usuarios`). La UI unificada extiende `TIModuleAccessPage` como pagina base y enlaza con la gestion de usuarios; no se crea una tercera pantalla paralela. Antes de disenar se ejecuta `analisis-previo-desarrollo` sobre esas dos pantallas para inventariar que se reutiliza.

Estructura funcional:

- Usuarios: estado, roles, grants, vigencia y acceso efectivo.
- Roles: permisos agrupados por modulo, recurso y accion.
- Modulos: catalogo, estado y cobertura de rutas/API.
- Permisos: catalogo canonico y consumidores.
- Excepciones: asignaciones individuales temporales y justificadas.
- Auditoria: actor, cambio, valor anterior/nuevo, fecha y resultado.

Reglas de `DESIGN.md`:

- Pagina dedicada para la matriz; no modal encadenado.
- Navbar superior horizontal existente; no introducir sidebar global.
- Cabecera abierta con una sola accion primaria por zona.
- Tabla/lista continua, filtros claros e inspector contextual cuando conserve el trabajo.
- Tokens semanticos, Geist, radios 6/8/12/16 y color cobalto reservado para accion/seleccion.
- Estados loading, empty, error, success, restricted y partial failure diferenciados.
- Confirmacion que explique objeto y consecuencia para cambios de alto impacto.
- Navegacion por teclado, foco visible, `aria-*`, no depender de color, drag ni hover.
- Tema claro/oscuro, contenido largo y permisos restringidos.
- Responsive en 390, 768 y 1440 px; reflow a 320 px y zoom 200%.
- Objetivos tactiles de al menos 44x44 px.

Pruebas y evidencia:

- Unitarias de hooks, transformaciones y validaciones.
- Componentes con Testing Library para todos los estados.
- Playwright para asignar, retirar, expirar y verificar un permiso.
- Pruebas de teclado, foco, contraste y accesibilidad WCAG 2.2 AA.
- Comparacion visual en los viewports requeridos por `DESIGN.md`.
- Verificacion de que ocultar un boton no sustituye el 403 backend.

Compuerta de salida:

- Ninguna accion administrativa queda disponible sin permiso backend.
- Toda mutacion produce auditoria y actualiza el manifiesto/cache.
- La UI cumple el checklist de `DESIGN.md`.

### Fase 7 - Migracion controlada de modulos

Objetivo: reemplazar reglas locales sin una migracion masiva.

Orden:

1. Modulos de lectura o bajo impacto.
2. CRUD sin aprobaciones ni movimientos de estado sensibles.
3. Modulos con ownership/asignacion.
4. Workflows, aprobaciones, documentos, firmas o impacto financiero.
5. Auth, rutas publicas y componentes globales al final y en tareas separadas.

La pertenencia concreta de cada modulo a una ola se decide con la matriz de Fase 0; no se presume en este plan.

Por cada modulo:

- Cargar la skill del modulo si existe (`modulo-business-case`, `modulo-clientes`, `modulo-compras-comercial`, `modulo-crm-fam`, `modulo-cronogramas`, `modulo-oportunidades`, `modulo-solicitudes`, `modulo-techos-entrega`, `bc-workspace-tabs`) y ejecutar `analisis-previo-desarrollo`: las rutas y roles se leen del codigo real. `CONTEXT.md` y `AGENTS.md` sirven solo como pista de donde mirar.
- Congelar las pruebas de caracterizacion.
- Migrar un maximo manejable de rutas/acciones por entrega.
- Ejecutar decision central en sombra.
- Resolver divergencias y obtener aprobacion funcional.
- Activar la bandera solo para ese modulo.
- Ejecutar regresion del modulo y smoke tests del sistema.
- Observar y cerrar antes de iniciar el siguiente modulo.

Compuerta de salida por modulo:

- Paridad de accesos permitidos y denegados.
- Casos de propietario/asignado/equipo/todos verificados cuando apliquen.
- Navegacion, URL directa y APIs coherentes.
- Flujos de negocio y estados intactos.
- Evidencia adjunta y rollback probado.

### Fase 8 - Auditoria y operacion

Objetivo: volver gobernable el nuevo sistema.

Trabajo:

- Auditar cambios de rol, permiso, modulo, grant y expiracion.
- Registrar denegaciones con razon tecnica util sin exponer secretos.
- Definir procedimiento de acceso de emergencia, revocacion y recuperacion.

Fuera de alcance por ahora: alertas automaticas (grants vencidos, roles sin usuarios, permisos huerfanos) y reportes de cobertura. Con 42 usuarios y 19 roles esa revision cabe en la pantalla de auditoria; se agregan solo si la operacion real lo pide.

Compuerta de salida:

- Toda mutacion administrativa es trazable.
- Se puede responder quien concedio, que concedio, a quien, cuando, por que y hasta cuando.

### Fase 9 - Retiro legacy

Objetivo: retirar duplicaciones solo despues de completar la migracion total.

Trabajo:

- Eliminar comparaciones frontend de roles que ya representen autorizacion central.
- Retirar listas locales de roles solo donde no expresen una regla de negocio.
- Retirar el uso autoritativo de `x-app-path`.
- Convertir o retirar `extra_roles` unicamente cuando no existan consumidores.
- Evaluar la eliminacion de columnas/tablas legacy como un proyecto separado y destructivo.

Compuerta de salida:

- Busqueda estatica sin consumidores legacy no aprobados.
- Suite completa, E2E y smoke tests pasan.
- Periodo de observacion completado.
- Aprobacion explicita antes de cualquier cambio destructivo.

## 7. Matriz de pruebas obligatoria por cambio

Cada PR o unidad de entrega debe incluir, segun el alcance:

| Capa | Prueba minima | Evidencia |
|---|---|---|
| Roles/permisos | allow y deny para rol principal, multirrol, grant vencido y sin permiso | Jest |
| Modulo | habilitado, deshabilitado, sin fila, cache invalidada y encabezado falso | Jest/integracion |
| API | 401, 403, 2xx y contrato de respuesta sin cambios | Supertest/Jest o mecanismo existente verificado |
| Datos | schema, constraints, indices, conteos, idempotencia y rollback | consultas Neon anonimizadas |
| Frontend | loading, empty, error, success, restricted y permisos efectivos | Testing Library |
| Navegacion | enlace visible/oculto, URL directa, refresh y retorno | Playwright |
| Accion | boton visible/oculto y rechazo backend independiente | Testing Library + API/E2E |
| Regresion | flujos criticos del modulo afectado | suite del modulo |
| Sistema | login, `/auth/me`, navbar, notificaciones y un smoke por area | suite E2E |
| UI | 320/390/768/1440, 200% zoom, teclado, foco, claro/oscuro | capturas y checklist |
| Seguridad | privilege escalation, IDOR/ownership, header spoofing y expiracion | pruebas negativas |
| Rendimiento | latencia de autorizacion y volumen de consultas/cache | medicion comparativa |

No se marcara una prueba como aprobada por inspeccion visual cuando pueda automatizarse.

## 8. Definicion de terminado por unidad

Una unidad solo esta terminada cuando:

- existe criterio de aceptacion verificable;
- el cambio es aditivo o tiene rollback probado;
- lint focalizado pasa sin reescribir archivos;
- pruebas nuevas y afectadas pasan;
- suites completas backend/frontend pasan en la compuerta de fase;
- build frontend pasa;
- no hay divergencias de autorizacion sin explicacion;
- contratos API no cambiaron inesperadamente;
- datos y migraciones fueron verificados en Neon cuando aplica;
- UI cumple `DESIGN.md` cuando aplica;
- auditoria existe para mutaciones sensibles;
- evidencia queda registrada;
- el responsable funcional acepta el comportamiento;
- no quedan riesgos abiertos de severidad alta.

## 9. Rollback y despliegue

- Bandera global del nuevo motor y bandera independiente por modulo.
- El rollback cambia la decision al evaluador legacy sin revertir schema aditivo.
- No borrar datos centrales durante rollback.
- Backups/snapshots y conteos previos a backfills.
- Todo cambio se prueba primero en el ambiente local (Fase 1A, restriccion 13); pasa a produccion solo con su compuerta cumplida.
- Produccion requiere aprobacion humana, ventana definida y plan de observacion.
- Tras activar un modulo: smoke inmediato, revision de 401/403/5xx, divergencias y latencia.
- Si aumenta un indicador o aparece una perdida de acceso no explicada, desactivar la bandera del modulo y abrir analisis; no parchear permisos a ciegas.

## 10. Skills y complementos requeridos

Todas las skills de esta tabla existen en el repositorio al 2026-10-07 (verificado). La skill `acceptance-orchestrator` que citaba la version anterior de este plan no existe y se retiro; la aceptacion se rige por la seccion 8.

Flujo obligatorio por unidad de trabajo: (1) cargar las skills que apliquen, (2) auditar el codigo real, (3) proponer el cambio, (4) aplicarlo y probarlo.

| Area | Skill/complemento | Ubicacion | Aplicacion |
|---|---|---|---|
| Analisis previo | `analisis-previo-desarrollo` | `.claude/skills` | obligatoria antes de cualquier desarrollo: auditar codigo real, detectar duplicados y codigo muerto |
| Coordinacion | `orchestrator-skill` | `.agents/skills` | fases, dependencias, stop conditions y handoffs |
| RBAC/rutas | `routing-rbac-skill` | `.agents/skills` | cambios pequenos y verificables en rutas protegidas |
| Auth/JWT | `auth-skill` | `.agents/skills` | solo para manifiesto, claims o refresh; tarea separada |
| DB | `db-migration-skill` | `.agents/skills` | migraciones aditivas e idempotentes |
| Consulta a Neon | `production-neon-query-skill` | `.agents/skills` | verificacion de solo lectura en produccion con credenciales de Secret Manager |
| Auditoria | `audit-security-skill` | `.agents/skills` | trazabilidad de asignaciones y decisiones sensibles |
| Frontend | `frontend-skill` | `.agents/skills` | UI completa y consumo real de permisos |
| Diseno de UI | `impeccable`, `ui-ux-pro-max` | `.claude/skills` | diseno, critica y pulido de la UI de la Fase 6 segun `DESIGN.md` |
| Modulos | `modulo-business-case`, `modulo-clientes`, `modulo-compras-comercial`, `modulo-crm-fam`, `modulo-cronogramas`, `modulo-oportunidades`, `modulo-solicitudes`, `modulo-techos-entrega`, `bc-workspace-tabs` | `.claude/skills` | mapa real de cada modulo antes de migrarlo en la Fase 7 |
| Flujos transversales | `approvals-skill`, `notifications-skill`, `signature-skill`, `files-documents-skill` | `.agents/skills` | modulos de la ola 4 (aprobaciones, firmas, documentos) |
| Revision | revision de codigo y revision de seguridad del asistente | integradas | sobre el diff de cada entrega, antes de pedir aprobacion |
| UI | `DESIGN.md` (sistema 2.1) | raiz del repo | composicion, tokens, responsive y WCAG 2.2 AA; checklist de la seccion 14 |
| Pruebas backend | Jest + Supertest | `backend` | unitarias, contratos e integracion de rutas (Supertest se instala en Fase 1B) |
| Pruebas frontend | Testing Library | `spi_front` | componentes, estados y accesibilidad funcional |
| E2E | Playwright (`@playwright/test`) | `spi_front` | navegacion, acceso directo y acciones efectivas (se monta en Fase 1B, contra staging) |
| Verificacion visual | navegador automatizado del asistente (Playwright MCP) | integrado | capturas en 320/390/768/1440 y recorridos manuales de la UI |
| DB productiva | Neon + GCP Secret Manager | externo | fuente de verdad de datos, sin exponer secretos |

Los limites de cada skill se respetan: cambios amplios se dividen por modulo/ola; auth, RBAC global, frontend y DB no se mezclan en una unica tarea gigante.

## 11. Decisiones humanas necesarias antes de ejecutar

Dos decisiones ya estan aplicadas en este documento por defecto y solo requieren confirmacion; si se revierten, cambian el alcance:

- A. Este plan reemplaza al de `rbac-saas-unification-plan.md` y hereda su trabajo (seccion 3.1).
- B. Tenant y membresias quedan fuera del alcance (restriccion 12).

Decisiones abiertas:

1. Aprobar si el acceso sin configuracion sera permitido o denegado y para que categorias de modulo.
2. Para el staging (Fase 1A): crear un proyecto de Neon exclusivo (o confirmar que `ancient-mode` existe y esta libre) y entregar su cadena de conexion por Secret Manager; dominio o nombre del sitio; quien tiene acceso; y si los datos copiados de produccion requieren mas anonimizacion que el reemplazo de correos.
3. Aprobar la politica de superroles y acceso de emergencia.
4. Resolver usuarios con rol `"null"`, `pending` y diferencias `pending/pendiente`.
5. Definir si `extra_roles` migra a roles adicionales, grants individuales o ambos segun cada valor.
6. Nombrar responsable funcional por modulo para aprobar la matriz.
7. Definir ambiente de aceptacion, usuarios de prueba y ventana de observacion.
8. Aprobar el orden final de las olas de migracion.

Hasta resolver estas decisiones se puede completar inventario y pruebas de caracterizacion, pero no se debe activar enforcement nuevo ni ejecutar backfills productivos.

## 12. Primer paquete ejecutable propuesto

El primer paquete no cambia permisos ni UI productiva:

0. Ambiente de staging completo y aislado (Fase 1A).
1. Linea base en verde (hecho el 2026-10-07).
2. Montaje de herramientas: `supertest`, `@playwright/test`, configuracion y carpeta `e2e/`, apuntando a staging.
3. Generador/verificador de inventario de endpoints, rutas UI y modulos, leido del codigo.
4. Matriz versionada de acceso actual, generada por ese script.
5. Fixtures anonimizados por rol/capacidad.
6. Pruebas de caracterizacion del motor legacy.
7. Pipeline CI de lint sin auto-fix, test y build.
8. Reporte de brechas y decisiones pendientes.

El paquete agrega infraestructura de staging, archivos de prueba, scripts y configuracion. No modifica rutas, middlewares ni pantallas en uso; los unicos cambios en codigo productivo son la guarda de arranque y la franja "STAGING", ambos inactivos en produccion.

Solo despues de aceptar este paquete se inicia la contencion de `x-app-path` y el modo sombra del motor central.
