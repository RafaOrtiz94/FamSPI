# Guía de ejecución y captura de evidencia — Validación FamSPI

Esta guía indica, **de una en una**, cómo ejecutar cada verificación y qué capturar para pegarlo en el recuadro "Evidencia visual de la ejecución" del documento correspondiente (DQ, IQ, OQ o PQ).

> **Regla de captura (WHO TRS 1019, §19 y §34):** cada captura debe mostrar de forma visible el **ambiente, la versión/commit, el usuario y la fecha/hora**. No recortar información. Anota esos cuatro datos en la leyenda del recuadro. Una captura sin origen no es evidencia válida.

## Regla de reemplazo backend → frontend

Todos los ítems y casos de prueba de esta guía tienen, por defecto, una forma de verificarse desde el **backend** (código fuente, `curl`, consola de Neon). **Cuando el módulo tiene una pantalla real en el frontend, la captura de esa pantalla reemplaza a la evidencia de backend** (no se agregan las dos, se sustituye una por otra):

- Si existe pantalla → ejecuta el flujo en `https://fam-spi-front.web.app` y pega **esa** captura. No hace falta `curl` ni código.
- Si **no** existe pantalla (helper interno, worker en segundo plano, motor sin UI propia) → mantén la evidencia de backend tal como está documentada.

La **sección 5** de esta guía es la referencia módulo por módulo para saber cuál aplica en cada caso (incluye los ~54 módulos con prueba de verificación real, que es donde vive la mayoría de los recuadros de captura del documento OQ).

---

## 0. Entorno de ejecución (sistema desplegado, NO localhost)

FamSPI corre en la nube. **La evidencia se captura contra el entorno productivo desplegado**, no contra un servidor local (así lo exige la validación: se valida el sistema real en uso).

| Componente | Dónde corre | URL / referencia |
|---|---|---|
| Frontend | Firebase Hosting | `https://fam-spi-front.web.app` |
| Backend (API) | Google Cloud Run (región `us-central1`) | `https://spi-backend-983537733948.us-central1.run.app` (base API: `/api/v1`) |
| Base de datos | Neon (PostgreSQL serverless) | host `ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech` |
| Secretos | gcloud Secret Manager | proyecto `famspi-sbox` (`DB_PASSWORD`) |

**Verificar que el backend responde (Cloud Run):**

```bash
curl https://spi-backend-983537733948.us-central1.run.app/health
# Esperado: {"ok":true}
```

**Consultar la base de datos (Neon):** usar el **SQL Editor de la consola de Neon** (recomendado para las capturas) o `psql` con la cadena de conexión cuya contraseña se obtiene de Secret Manager. Nunca pegar la contraseña en la captura.

**Línea base de la corrida — anótala una vez y repítela en cada leyenda:**

```bash
# Versión/commit del código desplegado
git rev-parse --short HEAD                                   # commit evaluado
# Revisión activa en Cloud Run (versión realmente desplegada)
gcloud run services describe spi-backend --region us-central1 \
  --format="value(status.latestReadyRevisionName,status.url)"
```

**Datos de la corrida:** Ambiente = `Cloud Run (prod) / Neon` · Versión = `1.0.0` · Commit = `_______` · Revisión Cloud Run = `_______` · Ejecutor = `_______` · Fecha/hora = `_______`

**Usuarios de prueba:** usa una cuenta real por rol (técnico, jefe de área, gerencia, TICS/admin) según lo que pida cada ítem. Anota en la leyenda de cada captura con qué usuario/rol se ejecutó.

---

## 1. DQ — Calificación de diseño (revisión documental)

La evidencia es la **revisión** del artefacto fuente: abre el archivo indicado en el editor y captura la pantalla mostrando el contenido citado. Son revisiones documentales, no tienen equivalente de pantalla de usuario final.

| Ítem | Cómo ejecutar | Qué capturar |
|---|---|---|
| DQ-01 | Abrir `backend/src/routes/registerRoutes.js` en `mountPrivateRoutes`. Alterno: `ls backend/src/modules` | Editor con el inventario de rutas / listado de módulos |
| DQ-02 | Abrir `spi_front/src/routes/AppRoutes.jsx` (bloques `ProtectedRoute`). No usar una sola vista de la app: hay demasiadas variantes por rol para representar el inventario completo en una captura | Editor con las rutas protegidas |
| DQ-03 | Abrir `backend/src/middlewares/roles.js` (`ROLE_GROUPS`) | Editor con la matriz de roles/grupos |
| DQ-04 | `ls -d backend/src/modules/*/` (Git Bash) o `dir backend\src\modules /AD` (CMD): debe listar **61** directorios | Terminal con el listado de directorios de módulos |
| DQ-05 | Abrir `docs/validation/URS/URS_modulo_autenticacion_sesiones.md` | Documento URS abierto |
| DQ-06 | Abrir `docs/validation/FRS/FRS_modulo_autenticacion_sesiones.md` | Documento FRS abierto |
| DQ-07 | Abrir `docs/validation/DS/DS_modulo_autenticacion_sesiones.md` | Documento DS abierto |
| DQ-08 | Abrir `docs/validation/RTM/RTM_sistema_spi.md` | Matriz de trazabilidad abierta |
| DQ-09 | Abrir `DESIGN.md` **o** la app mostrando la navegación real | Patrón de diseño / pantalla de navegación |
| DQ-10 | Abrir `docs/validation/README.md` (sección "Alcance funcional vigente") | Sección de alcance abierta |

---

## 2. IQ — Calificación de instalación (terminal / configuración)

La mayoría de estos ítems son de infraestructura (Cloud Run, Neon, Secret Manager) y no tienen pantalla de usuario — son intrínsecamente de backend/consola.

| Ítem | Cómo ejecutar | Qué capturar |
|---|---|---|
| IQ-01 | `gcloud run services describe spi-backend --region us-central1 --format="value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)"` + `git rev-parse --short HEAD` | Revisión/imagen desplegada en Cloud Run + commit |
| IQ-02 | Consola de Firebase Hosting → dominio `fam-spi-front.web.app` → historial de versiones (release activo) | Release activo del frontend en Firebase Hosting |
| IQ-03 | `curl -i https://spi-backend-983537733948.us-central1.run.app/health` | Respuesta HTTP 200 `{"ok":true}` desde Cloud Run |
| IQ-04 | **(Reemplaza a backend)** Abrir `https://fam-spi-front.web.app` **sin** sesión iniciada | Redirección a login al intentar entrar a una ruta protegida |
| IQ-05 | Consola de Neon → SQL Editor → `SELECT version();` (o `SELECT now();`) | Neon conectado + resultado de la consulta |
| IQ-06 | `gcloud run services describe spi-backend --region us-central1 --format="value(spec.template.spec.containers[0].env[].name)"` y `gcloud secrets list --project famspi-sbox` | **Nombres** de variables y secretos (sin valores) |
| IQ-07 | **(Reemplaza a backend)** Iniciar sesión con Google en `https://fam-spi-front.web.app` (consentimiento OAuth) | Pantalla de consentimiento / login OAuth real |
| IQ-08 | **(Reemplaza a backend)** En la app, panel de administración de usuarios/roles (`/dashboard/talento-humano/usuarios`) | Matriz de roles/usuarios visible en la app |
| IQ-09 | Hacer una escritura en la app desplegada; luego en Neon SQL Editor: `SELECT * FROM auditoria.logs ORDER BY created_at DESC LIMIT 5;` | La operación en la app + la fila de auditoría en Neon |
| IQ-10 | Repo: `ls -d backend/migrations/*.sql | wc -l` (o `dir backend\migrations\*.sql`) y abrir `backend/run_migrations.ps1` | Conteo de migraciones + procedimiento de aplicación a Neon |

> **Ruta privada sin token (apoya IQ-03):** `curl -i https://spi-backend-983537733948.us-central1.run.app/api/v1/users` sin cabecera `Authorization` → debe responder **401**.
>
> Nota: el comando de servicio Cloud Run asume nombre `spi-backend` y región `us-central1`. Ajusta si tu despliegue difiere (`gcloud run services list`).

---

## 3. OQ — Casos críticos de operación (funcional: UI cuando existe, API si no)

Ejecuta cada caso sobre el sistema **desplegado**. Casi todos estos 10 casos son transversales y **sí tienen pantalla** — captúralos en la app, no por API, salvo que se indique lo contrario.

| Ítem | Cómo ejecutar | Qué capturar |
|---|---|---|
| OQ-001 | **(Frontend)** En `https://fam-spi-front.web.app`: login válido (éxito) y luego login con credencial inválida | Dashboard tras login OK **y** mensaje de error del login inválido |
| OQ-002 | Solo backend (no hay forma de "quitar el token" desde la UI): `curl -i https://spi-backend-983537733948.us-central1.run.app/api/v1/users` **sin** `Authorization` | Respuesta HTTP **401** |
| OQ-003 | **(Frontend)** Iniciar sesión con un rol limitado e intentar una acción/pantalla no permitida | Mensaje "no autorizado" / bloqueo visible en la UI |
| OQ-004 | **(Frontend + Neon)** Cambiar un estado en la app desplegada; luego en Neon SQL Editor: `SELECT * FROM auditoria.logs ORDER BY created_at DESC LIMIT 5;` | El cambio en la app + su registro en `auditoria.logs` (Neon) |
| OQ-005 | **(Frontend)** Crear una solicitud y aprobarla (ver módulo `approvals` en la sección 5 para la pantalla exacta) | Flujo solicitud → aprobación y estado final en la app |
| OQ-006 | **(Frontend)** `/dashboard/business-case` — ejecutar un business case (cálculo/cambio de estado) | Resultado del cálculo/estado aplicado en la app |
| OQ-007 | **(Frontend)** `/dashboard/mi-perfil` — editar y guardar la ficha; recargar la página | El dato persistido tras recargar |
| OQ-008 | **(Frontend)** `/dashboard/signatures/inbox` — ejecutar un flujo de firma; luego abrir `/verificar/:token` | Firma aplicada + verificación pública válida |
| OQ-009 | **(Frontend)** `/documents` — abrir un documento del expediente | Visualización correcta del documento |
| OQ-010 | **(Frontend)** Enviar un formulario crítico (p. ej. `/dashboard/talento-humano/permisos`) con datos inválidos | Mensaje de validación/rechazo en la UI |

---

## 4. PQ — Escenarios de desempeño por dominio (end-to-end con usuarios reales)

Para cada dominio, ejecuta el **flujo completo de punta a punta** en la app desplegada con un usuario operativo y un aprobador reales. Todos estos escenarios **son de frontend por definición** (son flujos de negocio de punta a punta). Captura: pantalla inicial, pasos clave y **resultado final persistido**. Nombra al ejecutor y al aprobador en la leyenda.

| Ítem | Flujo a ejecutar | Pantalla | Qué capturar |
|---|---|---|---|
| PQ-TH  | Talento humano: solicitud → revisión → aprobación → consulta | `/dashboard/talento-humano/permisos` | Secuencia del flujo y estado final |
| PQ-COM | Comercial: registrar cliente/oportunidad → seguimiento | `/dashboard/comercial/clientes`, `/dashboard/comercial/famsheets` | Registro creado y seguimiento |
| PQ-BC  | Business Case: creación → análisis → aprobación → trazabilidad | `/dashboard/business-case` | Caso aprobado y su trazabilidad |
| PQ-ST  | Servicio técnico: solicitud → planificación → ejecución → cierre | `/dashboard/servicio-tecnico/solicitudes`, `/dashboard/servicio-tecnico/cronograma` | Cierre de la operación |
| PQ-CMP | Compras: solicitud → revisión → aprobación → expediente | `/dashboard/purchases/workspace` | Expediente de compra completo |
| PQ-TI  | Inventario/TI: alta/asignación/entrega o ticket completo | `/dashboard/ti/workspace`, `/dashboard/ti/activos` | Activo/ticket con estado final |
| PQ-FIN | Finanzas: viático con revisión y resultado final | `/dashboard/finanzas/viaticos` | Viático resuelto |
| PQ-FIR | Firma y documentos: firma completa + verificación posterior | `/dashboard/signatures/inbox`, `/verificar/:token` | Documento firmado y verificado |

---

## 5. Evidencia por módulo (detalle de los casos de verificación — DQ/IQ/OQ/PQ)

Cada módulo listado en la sección 11.1 del documento DQ (§ Análisis de riesgo) tiene casos de prueba con su propio recuadro "Evidencia visual de la ejecución" dentro del documento **OQ** (uno por caso). Esta tabla dice, módulo por módulo, **si existe pantalla en el frontend** para reemplazar el fragmento de código por la captura real de esa pantalla. Ejecuta el flujo equivalente al comportamiento que describe el caso (el nombre del caso, visible junto al recuadro, indica qué se está verificando) y pega la captura en el recuadro correspondiente a cada caso de ese módulo.

Si la columna "Pantalla" dice **"Sin pantalla"**, no hay UI equivalente: mantén el fragmento de código/backend ya incrustado como evidencia (no se reemplaza).

### 5.1 Módulos de alto riesgo

| Módulo | ¿Pantalla? | Ruta / cómo llegar | Qué capturar |
|---|---|---|---|
| `auth` | Sí | `/login` | Login exitoso y fallido (igual que OQ-001) |
| `security` | Sin pantalla | — (motor interno de control de horario/whitelist) | Mantener evidencia de backend |
| `module-access` | Sí | `/dashboard/ti/modulos` | Panel de módulos habilitados/deshabilitados por usuario |
| `signature` | Sí | `/dashboard/signatures/:documentId/sign`, `/verificar/:token` | Firma de un documento + verificación pública |
| `signature-workflows` | Sí | `/dashboard/signatures/inbox`, `/verificar/famsign/:token` | Workflow de firma multi-firmante + verificación |
| `permisos` | Sí | `/dashboard/talento-humano/permisos` | Solicitud de permiso, límites por tipo, aprobación |
| `vacaciones` | Sí | `/dashboard/talento-humano/permisos` (misma pantalla, "Permisos y Vacaciones") | Saldo de vacaciones y solicitud |
| `finanzas` | Sin pantalla | — (funciones de inventario legacy sin UI moderna) | Mantener evidencia de backend |
| `viaticos` | Sí | `/dashboard/finanzas/viaticos` | Viático: acceso por rol y flujo de aprobación |
| `auditoria` | Sí | `/dashboard/auditoria` | Consulta de la pista de auditoría con filtros |
| `documents` | Sí | `/documents` | Listado y apertura de un documento |

### 5.2 Módulos de riesgo medio-bajo (ya cerrados con evidencia)

| Módulo | ¿Pantalla? | Ruta / cómo llegar | Qué capturar |
|---|---|---|---|
| `users` | Sí | `/dashboard/talento-humano/usuarios` | Alta/edición de usuario y su rol |
| `support-tickets` | Sí | `/dashboard/ti/workspace` | Ticket con prioridad calculada (impacto/urgencia) |
| `work-management` | Sí | `/dashboard/work-management` | Tablero/proyecto e ítems |
| `applicants` | Sí | `/dashboard/talento-humano/command-center` (vista "Postulantes") | Ficha de un aspirante |
| `shared` (profileSync) | Sin pantalla | — (helper interno de sincronización de perfil) | Mantener evidencia de backend |
| `clients` | Sí | `/dashboard/comercial/clientes` u `/dashboard/operaciones/clientes` | Cliente y su ubicación/contacto |
| `collab-deliveries` | Sí | `/dashboard/collab/entregas`, `/dashboard/collab/resumen` | Acta de entrega a colaborador |
| `collaborators` | Sí | `/dashboard/talento-humano/colaboradores` | Perfil de colaborador y completitud |
| `hiring-pipeline` | Sí | `/dashboard/talento-humano/command-center` (vista "Pipeline") | Etapa del proceso de contratación |
| `personnel-requests` | Sí | `/dashboard/talento-humano/solicitudes` | Solicitud de personal y comentarios |
| `trainings` | Sí | `/dashboard/capacitaciones` | Capacitación creada y asistentes |
| `audit-prep` | Sí | `/dashboard/auditoria/preparacion` | Documento de preparación de auditoría |
| `calidad` | Sí (**en desarrollo — validación provisional**) | `/dashboard/calidad/riesgos` (CA0110) y demás `/dashboard/calidad/*` | Workspace de calidad (indicar en la leyenda que el módulo está en desarrollo) |
| `dashboard` | Sí | `/dashboard/gerencia` | Gráficos/KPIs con datos reales |
| `delivery-ceilings` | Sí | `/dashboard/comercial/delivery-ceilings` | Techo de entrega y sus líneas |
| `departments` | Sí | `/dashboard/talento-humano/departamentos` | Alta/edición de departamento |
| `equipment-management` | Sí | `/dashboard/equipos`, `/dashboard/equipos/activos` | Activo de equipo y su estado |
| `equipment-purchases` | Sí | `/dashboard/purchases/workspace` (pestaña pública) | Visibilidad de pestañas/acciones por rol y estado |
| `gmail` | Sin pantalla | — (servicio de envío usado internamente) | Mantener evidencia de backend |
| `inventario` | Sí | Paneles dentro de `/dashboard/servicio-tecnico` (Consumibles, Controles, Determinaciones, Equipos) | Movimiento de inventario |
| `mantenimientos` | Sí | `/dashboard/servicio-tecnico/mantenimientos` | Orden de trabajo (correctivo/preventivo) |
| `notifications` | Sí | `/dashboard/notificaciones` | Notificación recibida y su estado |
| `offboarding` | Sí | `/dashboard/talento-humano/command-center/offboarding` | Expediente de desvinculación y su avance |
| `opportunities` | Sí | `/dashboard/comercial/famsheets` | Oportunidad y su seguimiento |
| `private-purchases` | Sí | `/dashboard/purchases/workspace` (pestaña privada) | Solicitud de compra privada por rol |
| `schedules` | Sí | `/dashboard/comercial/planificacion`, `/dashboard/servicio-tecnico/cronograma` | Visita agendada y su enlace de mapa |
| `servicio` (casos externos) | Sí | `/dashboard/servicio-tecnico/casos-externos` | Caso externo con su código |
| `talento_humano` (legacy) | Parcial | Equivalente funcional actual: `/dashboard/talento-humano/colaboradores` | Alta de colaborador (el CRUD legacy fue reemplazado por esta pantalla) |
| `technical-applications` | Sí | `/dashboard/servicio-tecnico/aplicaciones` | Aplicación técnica disponible/asignada |
| `ti-assets` | Sí | `/dashboard/ti/activos`, `/dashboard/ti/actas` | Activo TI y su acta de entrega |
| `user-certifications` | Sí | `/dashboard/talento-humano/reporte-documentacion` | Certificación profesional del colaborador |
| `user-profile` | Sí | `/dashboard/mi-perfil` | Perfil propio (igual que OQ-007) |
| `consumable-files` | Sí | `/dashboard/purchases/workspace` → expediente → pestaña de archivos consumibles | Archivo consumible y su resumen |
| `files` | Sin pantalla propia | Adjuntos embebidos dentro de `/requests` y otras solicitudes | Mantener evidencia de backend, o capturar el adjunto dentro de la solicitud donde aparece |
| `calendar` | Sin pantalla | — (integración interna con Google Calendar al crear eventos) | Mantener evidencia de backend |
| `integrations` | Sin pantalla | — (worker interno de sincronización con CRM) | Mantener evidencia de backend |
| `management` | Sí | `/requests` (filtros de gestión) | Filtro de solicitudes por estado/área |
| `requests` | Sí | `/requests`, `/dashboard/backoffice/client-requests` | Solicitud y su token de consentimiento |
| `attendance` | Sí | `/asistencia/marcar/:action`, `/dashboard/talento-humano/asistencia-reportes` | Marcación y su reporte |
| `approvals` | Sí | Embebido en flujos (ej. `/dashboard/comercial/aprobaciones-planificacion`, revisión de solicitudes en backoffice) | Aprobación con visibilidad restringida por aprobador |
| `business-case` | Sí | `/dashboard/business-case` | Igual que OQ-006 |
| `crm-fam` | Sí | `/dashboard/crm-fam` y subpáginas (cuentas, contactos, oportunidades) | Registro CRM y su cálculo |
| `delivery-requests` | Sí | `/dashboard/comercial/delivery-ceilings`, pestaña de control de suministro en `/dashboard/purchases/workspace` | Confirmación de entrega y saldo actualizado |
| `crm-fam` (calculadoras) | Sí | `/dashboard/crm-fam/opportunities/:id/blue-sheet` | Blue Sheet con cálculo aplicado |

> Si al ejecutar encuentras que una ruta cambió o no corresponde exactamente, usa la pantalla equivalente dentro del mismo módulo y anota la diferencia — esta tabla es una guía de navegación, no un candado; lo que importa es que la captura demuestre el comportamiento real del caso.

---

## 6. Cómo pegar la captura en el documento

1. Abre el `.docx` de la fase (DQ/IQ/OQ/PQ) en Word.
2. Ubica el ítem o caso (p. ej. **IQ-05** o el caso de prueba de `permisos`) y su recuadro "Evidencia visual de la ejecución".
3. Si el módulo tiene pantalla (sección 5): ejecuta el flujo en `https://fam-spi-front.web.app` y pega **esa** captura — no dejes también la de backend, una reemplaza a la otra.
4. Si no tiene pantalla: deja/usa la evidencia de backend ya prevista.
5. Pega la imagen dentro del recuadro (clic en el recuadro → Insertar → Imagen, o Ctrl+V).
6. Completa la leyenda: **Ambiente / Versión-commit / Usuario / Fecha-hora**.
7. Si regeneras los documentos con el script, **las capturas se pierden** (se re-crea el recuadro vacío): pega las capturas **después** de la última regeneración, o guarda copias `_FIRMADO`.

> Nota: no se deben fabricar capturas. Cada imagen debe provenir de una ejecución real sobre la versión declarada.
