# IQ — Calificación de Instalación

**Sistema:** FamSPI v1.0.0
**Protocolo:** IQ-FAMSPI-001
**Versión del protocolo:** 1.0
**Marco normativo:** GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2
**Estado:** PENDIENTE DE EJECUCIÓN
**Fecha de emisión:** 2026-05-13

---

## 1. Objetivo IQ

Verificar que FamSPI v1.0.0 está correctamente instalado, configurado e identificado en su ambiente de ejecución objetivo, antes de proceder con la ejecución de pruebas funcionales. La Calificación de Instalación (IQ) establece que todos los componentes del sistema han sido desplegados según las especificaciones definidas, que las dependencias están presentes y accesibles, y que el ambiente de ejecución cumple con los requisitos de infraestructura definidos para la validación.

La aprobación de la IQ es condición necesaria para iniciar la Calificación Operacional (OQ).

---

## 2. Alcance IQ

La IQ cubre los siguientes componentes y aspectos del sistema FamSPI v1.0.0:

- Plataforma de ejecución y despliegue (Google Cloud Run / GCP)
- Servicio backend (Node.js/Express) y su disponibilidad
- Servicio frontend (React SPA) y su accesibilidad
- Base de datos relacional (PostgreSQL) y su esquema migrado
- Configuración de autenticación Google OAuth2 y generación de JWT
- Cifrado de comunicaciones (HTTPS/TLS)
- Variables de entorno y secretos de configuración (verificación lógica, sin exposición de valores)
- Roles y permisos base en base de datos
- Sistema de logs y auditoría
- Política de respaldo (backup) de base de datos

**Módulos en alcance del sistema validado:**

| Área | Módulos |
|---|---|
| Gobierno y Seguridad | auth, security, auditoria, approvals, signature, notifications, dashboard |
| Permisos y Vacaciones | permisos, vacaciones, attendance |

---

## 3. Ambiente Validado

| Componente | Descripción |
|---|---|
| Plataforma de ejecución | Google Cloud Run (GCP) — servicio de contenedores administrado, escalado automático |
| Frontend | React SPA servida desde CDN / hosting estático |
| Backend | Node.js/Express ejecutado sobre contenedor Docker en Cloud Run |
| Base de datos | PostgreSQL — instancia Cloud SQL o equivalente gestionada por proveedor de nube |
| Autenticación | Google OAuth2 (cliente OAuth registrado en Google Cloud Console) + JWT generado por el backend |
| Comunicación | HTTPS/TLS en todos los endpoints públicos y privados |
| Variables de entorno | Gestionadas mediante Secrets Manager (GCP) o variables de entorno del contenedor — sin exposición de valores en configuraciones versionadas |
| Redes y acceso | Endpoints del backend expuestos únicamente a través de HTTPS con dominio verificado |
| Contenedor | Imagen Docker construida a partir del repositorio oficial del sistema, referenciada por tag/digest |

---

## 4. Versión e Identificación de Línea Base

| Elemento | Valor |
|---|---|
| Sistema validado | FamSPI v1.0.0 |
| Referencia de release | Tag / commit / release SHA a completar al momento de la ejecución |
| Ambiente | Producción / [Identificar si el ambiente objetivo es staging o producción antes de ejecutar] |
| Imagen de contenedor backend | Nombre de imagen + tag/digest a completar al ejecutar |
| Fecha de instalación verificada | A completar al momento de la ejecución |
| Ejecutor responsable | A completar al momento de la ejecución |

> **Nota:** La referencia de release debe quedar registrada con suficiente precisión (tag de git, SHA de commit o digest de imagen Docker) para garantizar la trazabilidad e identificación inequívoca de la versión instalada. Este dato es obligatorio para dar por aprobada la IQ.

---

## 5. Variables de Entorno (Lógicas — Sin Secretos)

Las siguientes variables de entorno deben estar definidas y no nulas en el ambiente de ejecución del contenedor backend. Se listan únicamente los nombres lógicos; los valores no deben registrarse en este protocolo ni en ningún documento de validación.

| Variable | Propósito |
|---|---|
| `PORT` | Puerto de escucha del servicio backend |
| `DATABASE_URL` | Cadena de conexión a la base de datos PostgreSQL (estructura: `postgresql://usuario:password@host:puerto/dbname`) |
| `JWT_SECRET` | Clave secreta para firma y verificación de tokens JWT — debe estar definida con valor de longitud y entropía adecuadas |
| `GOOGLE_CLIENT_ID` | Identificador del cliente OAuth2 registrado en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth2 — gestionado mediante Secrets Manager, no exponer |
| `NODE_ENV` | Modo de ejecución del proceso Node.js (valor esperado en producción: `production`) |
| `FRONTEND_URL` | URL base del frontend, usada para configuración de CORS y redirecciones OAuth2 |
| `ALLOWED_ORIGINS` | Orígenes permitidos para política CORS del backend |
| `LOG_LEVEL` | Nivel de detalle del sistema de logs (p. ej. `info`, `warn`, `error`) |
| `BACKUP_ENABLED` | Indicador de habilitación de backups automáticos (variable de configuración o parámetro de Cloud SQL) |

> La verificación de estas variables debe realizarse comprobando su presencia y que no sean nulas o vacías, sin registrar sus valores. El ejecutor debe confirmar que cada variable está definida en la plataforma de despliegue antes de marcar el item correspondiente como PASS.

---

## 6. Usuarios y Accesos Iniciales

Los siguientes roles base deben existir en la base de datos al momento de ejecutar la IQ. La correcta definición de roles es prerrequisito para las pruebas de control de acceso en OQ.

| Rol | Descripción |
|---|---|
| `admin` | Administrador del sistema — acceso completo a todos los módulos y configuraciones |
| `usuario` | Usuario estándar — acceso a módulos funcionales según permisos asignados |
| `responsable` | Supervisor o responsable de área — aprueba/rechaza solicitudes de permisos y vacaciones |
| `sistema` | Rol de servicio para operaciones automatizadas e integraciones internas |

> Se debe verificar que al menos estos cuatro roles están definidos en la tabla de roles de la base de datos. Se puede verificar mediante consulta directa a la BD o mediante la interfaz de administración del sistema.

---

## 7. Integración de Componentes

Los siguientes puntos de integración deben ser verificados durante la IQ para confirmar que todos los componentes del sistema se comunican correctamente entre sí.

| Punto de integración | Descripción | Criterio de verificación |
|---|---|---|
| Backend → Base de datos | El servicio backend establece conexión exitosa con PostgreSQL al iniciar | Logs de inicio sin errores de conexión; endpoint de health check confirma conexión a BD |
| Frontend → Backend | La SPA de React puede realizar solicitudes HTTP al backend y recibir respuestas | Llamada a endpoint público desde el navegador devuelve respuesta HTTP esperada |
| OAuth2 → Backend | El proveedor Google OAuth2 redirige correctamente al callback del backend | Redirect URI configurado en Google Cloud Console coincide con el del backend |
| Backend → Generación JWT | El backend genera tokens JWT correctamente al completar el flujo de autenticación | Token JWT recibido en respuesta al login contiene claims esperados (sub, rol, exp) |
| HTTPS/TLS → Endpoints | Todos los endpoints son accesibles exclusivamente por HTTPS | Certificado SSL válido, sin advertencias de navegador ni errores de handshake |

---

## 8. Logs y Auditoría

El sistema debe contar con un mecanismo de registro de eventos activo desde el inicio de la instalación. Se verificará que:

- El sistema registra eventos de inicio de sesión (login exitoso y fallido).
- El sistema registra acciones de los usuarios sobre entidades de negocio (creación, modificación, aprobación de solicitudes).
- Los logs incluyen: usuario que ejecuta la acción, tipo de acción, módulo, timestamp (UTC) y resultado.
- Los logs son accesibles para revisión por el equipo de administración.
- El nivel de log configurado es adecuado para el ambiente de producción (no debe registrarse información sensible en texto plano).

---

## 9. Respaldo y Recuperación

Se verificará que existe una política de backup de base de datos configurada y activa. Mínimamente se debe confirmar:

- Backups automáticos habilitados para la instancia de Cloud SQL (o equivalente).
- Frecuencia de backup definida (mínimo diario para ambiente de producción).
- Retención de backups definida (mínimo 7 días).
- Procedimiento de restauración documentado o registrado en la plataforma de GCP.

> No se ejecutará una restauración completa como parte de la IQ. La verificación es de configuración, no de ejecución del proceso de recuperación (la prueba de recuperación corresponde a PQ o a pruebas de continuidad operativa).

---

## 10. Checklist IQ

Los resultados deben completarse durante la ejecución del protocolo. Los campos "Resultado observado", "Estado" y "Fecha" se dejan en blanco hasta la ejecución formal.

| ID | Elemento verificado | Criterio de aceptación | Resultado observado | Estado | Observaciones | Responsable | Fecha |
|---|---|---|---|---|---|---|---|
| IQ-001 | Servicio backend activo y respondiendo | HTTP 200 en endpoint de health check (`/health` o equivalente definido) | — | Pendiente | | | |
| IQ-002 | Variables de entorno de producción definidas | Todas las variables lógicas requeridas (sección 5) presentes y con valor no nulo en el contenedor | — | Pendiente | | | |
| IQ-003 | Conexión a base de datos establecida | Backend conecta a PostgreSQL sin errores al iniciar; log de inicio no reporta fallo de conexión | — | Pendiente | | | |
| IQ-004 | Esquema de BD migrado correctamente | Todas las migraciones de base de datos han sido aplicadas sin errores; tablas del sistema existentes y con estructura correcta | — | Pendiente | | | |
| IQ-005 | Certificado SSL/TLS válido | Dominio objetivo accesible por HTTPS sin advertencias de certificado en navegador ni errores de handshake TLS | — | Pendiente | | | |
| IQ-006 | OAuth2 configurado y accesible | Redirect URI del sistema registrado correctamente en Google Cloud Console; flujo OAuth2 redirige sin error de configuración | — | Pendiente | | | |
| IQ-007 | JWT — generación funcional | Token JWT generado correctamente al autenticar usuario de prueba; token contiene claims mínimos (sub, rol, exp) | — | Pendiente | | | |
| IQ-008 | Frontend accesible desde navegador | SPA de React carga completamente en navegador objetivo sin errores críticos en consola del navegador | — | Pendiente | | | |
| IQ-009 | Roles y permisos base existentes en BD | Al menos los 4 roles definidos en sección 6 (`admin`, `usuario`, `responsable`, `sistema`) existen en la tabla de roles de la BD | — | Pendiente | | | |
| IQ-010 | Módulo auth respondiendo | Endpoint de autenticación (`/api/auth` o equivalente) devuelve respuesta esperada (no 500 ni 404 inesperado) | — | Pendiente | | | |
| IQ-011 | Módulo permisos respondiendo | Endpoint del módulo de permisos (`/api/permisos` o equivalente) accesible con token de autenticación válido; responde HTTP 200 | — | Pendiente | | | |
| IQ-012 | Módulo vacaciones respondiendo | Endpoint del módulo de vacaciones (`/api/vacaciones` o equivalente) accesible con token de autenticación válido; responde HTTP 200 | — | Pendiente | | | |
| IQ-013 | Sistema de logs activo | Eventos de inicio de sesión son registrados en la bitácora del sistema con usuario, timestamp y resultado | — | Pendiente | | | |
| IQ-014 | Política de backup configurada | Existe backup automático de BD configurado y activo en la plataforma; frecuencia y retención definidas | — | Pendiente | | | |
| IQ-015 | Acceso RBAC — restricción funcional | Usuario autenticado con rol `usuario` recibe HTTP 403 al intentar ejecutar acción restringida a rol `admin` | — | Pendiente | | | |
| IQ-016 | Imagen de contenedor identificada | La imagen Docker del backend desplegada corresponde al tag/digest asociado a FamSPI v1.0.0 y está registrada | — | Pendiente | | | |
| IQ-017 | Comunicaciones solo por HTTPS | No existen endpoints del backend accesibles por HTTP plano en el ambiente objetivo | — | Pendiente | | | |

---

## 11. Desviaciones IQ

Las desviaciones identificadas durante la ejecución se registran en la siguiente tabla. Al momento de la emisión del protocolo no existen desviaciones registradas.

| ID Desviación | Item IQ afectado | Descripción de la desviación | Impacto | Acción correctiva propuesta | Estado | Responsable | Fecha de cierre |
|---|---|---|---|---|---|---|---|
| — | — | Sin desviaciones registradas al momento de emisión | — | — | — | — | — |

---

## 12. Conclusión IQ

**Estado actual: PENDIENTE DE EJECUCIÓN**

La presente Calificación de Instalación (IQ) se considera aprobada cuando se cumplen todas las condiciones siguientes:

1. Todos los items del Checklist IQ (sección 10) presentan estado **PASS** o **N/A** con justificación escrita.
2. No existen desviaciones críticas abiertas (sin resolver) en la tabla de desviaciones (sección 11).
3. La referencia de release (tag/commit/digest) ha sido registrada de forma inequívoca.
4. Las firmas de ejecutor, revisor técnico y aprobador han sido completadas (sección 13).

Un item con estado **FAIL** implica la apertura obligatoria de una desviación, la implementación de una acción correctiva y la re-ejecución del item afectado antes de poder declarar la IQ aprobada.

La aprobación de la IQ es condición necesaria y no negociable para iniciar la ejecución de la Calificación Operacional (OQ — protocolo `05_oq_calificacion_operacional.md`).

---

## 13. Firmas IQ

La firma en este documento certifica que el protocolo fue ejecutado, revisado y aprobado de acuerdo con los procedimientos de validación aplicables bajo el marco GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2.

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Ejecutor (Responsable de ejecución) | | ___________________ | |
| Revisor Técnico | | ___________________ | |
| Aprobador (Responsable de validación) | | ___________________ | |

---

*Documento generado conforme al plan de validación de FamSPI v1.0.0. Ref. normativa: GEON / OMCL PA/PH/OMCL (08) 88 R5 Annex 2.*
