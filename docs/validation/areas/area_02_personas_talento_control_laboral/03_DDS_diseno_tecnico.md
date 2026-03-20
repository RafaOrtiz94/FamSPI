# DDS - AREA 02 PERSONAS, TALENTO Y CONTROL LABORAL

## 1. Introduccion
El presente documento describe el diseno tecnico real del Area 02 del sistema SPI. Su funcion no es solo enumerar archivos o rutas, sino explicar por que cada componente tecnico existe dentro del dominio de personas, como se integra con el resto del sistema y cuando interviene dentro de los procesos de talento, asistencia, permisos y vacaciones.

## 2. Objetivo
Documentar la arquitectura, componentes, dependencias, integraciones y consideraciones tecnicas que soportan el area.

## 3. Arquitectura del area
### 3.1 Capas
- Frontend React para talento, perfil y solicitudes compartidas.
- API Express con modulos montados bajo `/api/v1`.
- Servicios de negocio y controladores por modulo.
- Persistencia PostgreSQL.
- Integraciones de soporte con Drive, documentos PDF, correo y auditoria.
- Jobs programados para overtime y vencimiento de coordinacion de recuperacion.
- Utilidad compartida para sincronizar claves de perfil entre `user-profile` y `collaborators`.

### 3.2 Ruteo principal del area
- `/api/v1/talento-humano`
- `/api/v1/personnel-requests`
- `/api/v1/users`
- `/api/v1/collaborators`
- `/api/v1/departments`
- `/api/v1/users/me/profile`
- `/api/v1/users/*/certifications`
- `/api/v1/attendance`
- `/api/v1/permisos`
- `/api/v1/vacaciones`

### 3.3 Frontend consumidor principal
- `spi_front/src/modules/talento/Dashboard.jsx`
- `spi_front/src/modules/talento/pages/PersonnelWorkspace.jsx`
- `spi_front/src/modules/talento/pages/CollaboratorWorkspace.jsx`
- `spi_front/src/modules/talento/pages/Usuarios.jsx`
- `spi_front/src/modules/talento/pages/Departamentos.jsx`
- `spi_front/src/modules/talento/pages/AsistenciaReportes.jsx`
- `spi_front/src/modules/profile/MyProfilePage.jsx`
- `spi_front/src/modules/shared/solicitudes/pages/PermisosPage.jsx`
- `spi_front/src/core/ui/widgets/AttendanceWidget.jsx`

## 4. Diseno por modulo
### `talento_humano`
Submodulo HR legacy con capacidades acotadas de empleados y documentos. Tecnica y funcionalmente sirve como remanente de una gestion mas simple que hoy convive con `collaborators` y `personnel-requests`.

### `personnel-requests`
Nucleo del proceso de requerimiento de personal. Persiste solicitudes, historial, comentarios, perfiles, documentos y soporta contratacion final mediante vinculacion con postulantes o colaboradores.

El servicio formaliza una maquina de estados interna que permite calcular progreso, etapa actual, responsable actual, accion siguiente, tiempos por etapa y estancamiento. La informacion se arma desde `personnel_requests`, `personnel_request_history` y la vinculacion con `users` o colaboradores asociados.

El backend normaliza el contrato de perfil para aceptar payload directo o anidado, devuelve la coleccion documental actualizada despues de cada carga y restringe la edicion del expediente a etapas operativas abiertas. La contratacion, la reasignacion y la vinculacion de postulantes dejan rastro tecnico en `personnel_request_history` para sostener la linea de tiempo operativa.

El workspace frontend complementa ese modelo con componentes especificos para:
- visualizar el avance operativo y el plazo de la solicitud;
- registrar comentarios trazables con visibilidad interna o externa;
- mostrar checklist y avance documental antes de habilitar la contratacion;
- reasignar el responsable operativo cuando un rol autorizado lo requiere;
- sostener navegacion movil mediante selector visible cuando el sidebar no esta presente;
- respetar la vista inicial requerida por el ruteo del hub de talento.

### `users`
Administra usuarios internos y su relacion con departamentos. Aunque es transversal, en este dominio se usa como base de identidad administrativa y de asignacion laboral. El controlador distingue entre directorio visible para ciertos roles y vista administrativa completa, y la baja operativa se resuelve con desactivacion logica.

En UI, `users` ya no se presenta como acceso aislado, sino como parte de un hub administrativo unico junto a `departments`. Esto reduce ambiguedad de navegacion y concentra el mantenimiento de estructura y acceso en una sola vista.

### `collaborators`
Consolida el workspace del colaborador activo. Mezcla informacion de `users`, `departments`, `collaborator_profiles`, `user_profile`, certificaciones y documentos. El servicio calcula completitud del expediente, revision anual pendiente y alertas por vigencia de certificaciones.

### `departments`
CRUD administrativo de la estructura organizacional consumida por talento y otras areas. El modelo ya contempla estado activo/inactivo para preservar historico sin eliminar referencias previas.

Su consumo principal en frontend comparte entrada y contenedor con `users`, lo que simplifica el acceso y evita duplicidad de accesos administrativos en dashboards y barra de navegacion.

### `user-profile`
Gestiona el perfil propio del usuario: metadata, preferencias y avatar. Tambien sincroniza partes del perfil con `collaborator_profiles` cuando corresponde usando una utilidad compartida para no duplicar reglas de mapeo.

La capa frontend agrega una validacion operativa para la revision anual y la capa backend la refuerza al persistir `profile_last_reviewed_at`: el cierre de la revision solo se permite cuando los campos criticos de contacto, domicilio y emergencia estan completos. Ademas, la pantalla oculta preferencias sin efecto real para evitar configuraciones engañosas.

### `user-certifications`
Gestiona certificaciones individuales y exportacion PDF consolidada. Guarda soporte documental y estados activos.

La vista del colaborador expone acciones tactiles permanentes de consulta y eliminacion, evita overlays dependientes de hover como unico mecanismo de accion, adapta la captura de fechas a una distribucion responsive y habilita el PDF consolidado dentro de la experiencia propia del usuario autenticado.

### `attendance`
Gestiona la jornada diaria, excepciones fuera del flujo normal, overtime y reportes PDF oficiales. Usa fecha de negocio, soporta sincronizacion posterior de ubicacion y expone estados derivados para separar la consulta administrativa del reporte RH-09. El acceso a consultas de terceros se apoya en un helper de autorizacion especifico del modulo.

### `permisos`
Gestiona solicitudes de permisos, firma legal, matriculas de estudio, justificantes, coordinacion de recuperacion y cierre por vencimiento.

### `vacaciones`
Gestiona solicitudes de vacaciones, calculo de saldo, aprobacion, cancelacion y resumen consolidado por colaborador.

## 5. Integraciones y soporte tecnico
| Componente | Por que existe | Como interviene | Cuando aplica |
|---|---|---|---|
| Drive | Custodia archivos de perfil, certificaciones y documentos de solicitudes. | Carga binarios y guarda referencias. | Durante upload de documentos, perfiles o soportes. |
| PDF | Formaliza reportes de asistencia y consolidado de certificaciones. | Genera salidas descargables desde datos persistidos. | Cuando talento o roles autorizados piden reporte oficial. |
| Estado derivado | Distingue jornadas sin entrada, abiertas, en almuerzo o cerradas. | Calcula el estado a partir de marcas persistidas sin migrar el modelo. | Cuando la consulta requiere lectura administrativa o filtrado operativo. |
| Mailer | Notifica acciones puntuales del flujo de talento legacy o de permisos. | Envia correos desde utilitarios existentes. | Durante eventos de aprobacion o avisos internos. |
| Auditoria | Deja trazabilidad de operaciones criticas. | Inserta log tecnico o reutiliza utilitarios de audit. | Durante creacion, actualizacion o acciones sensibles. |
| Jobs internos | Automatizan overtime y vencimientos. | Procesan registros pendientes por scheduler. | En la operacion periodica del sistema. |
| Sincronizacion de perfil compartida | Mantiene las mismas claves de perfil entre `user-profile` y `collaborators`. | Reutiliza una fuente unica para leer y escribir campos sincronizados. | Durante carga, edicion o consolidacion de perfil. |

## 6. Jobs del area
### `attendanceOvertimeScheduler.js`
- Revisa registros de asistencia abiertos o incompletos.
- Calcula o consolida overtime sobre `user_attendance_records`.
- Existe para evitar rezagos operativos en horas extra.

### `permisosRecoveryCoordinationExpiryScheduler.js`
- Procesa coordinaciones de recuperacion vencidas.
- Cierra coordinaciones sin acuerdo y carga proporcionalmente a vacaciones.
- Existe para garantizar cierre de permisos recuperables en plazo definido.

## 7. Modelo tecnico y relaciones
### Entidades principales
- `users`
- `departments`
- `employees`
- `collaborator_profiles`
- `collaborator_documents`
- `user_profile`
- `user_certifications`
- `personnel_requests`
- `personnel_request_history`
- `personnel_request_comments`
- `personnel_request_profiles`
- `personnel_request_documents`
- `collaborator_user_id` como nexo operativo en `personnel_requests`
- `user_attendance_records`
- `attendance_exceptions`
- `attendance_overtime`
- `permisos_vacaciones`
- `permisos_vacaciones_firmas`
- `permisos_estudios_matriculas`
- `vacaciones_solicitudes`
- `vacaciones_saldos_historicos`

### Dependencias externas relevantes
- `applicants`
- `applicant_documents`

Estas entidades no son el centro del area, pero participan en el flujo de contratacion desde `personnel-requests`.

## 8. Consideraciones tecnicas relevantes
### 8.1 Contrato actual del submodulo HR legacy
`hr.routes.js` expone rutas relativas alineadas con su montaje en `registerRoutes.js` bajo `/api/v1/talento-humano`. El contrato tecnico vigente del modulo es el prefijo montado del area y no el alias historico `/api/v1/hr/...`.

### 8.2 Dualidad de datos de tiempo libre
`vacaciones.service.js` y `permisos.service.js` leen tanto `vacaciones_solicitudes` como `permisos_vacaciones` para preservar compatibilidad con registros historicos y con el flujo vigente de permisos que descuentan vacaciones. La consistencia visible del dominio fue mitigada en calculos y resumenes, pero la coexistencia estructural de ambos origenes sigue requiriendo una estrategia de convergencia.

### 8.3 Dependencia cruzada con autenticacion
La autoentrada de asistencia durante login se dispara desde `auth.controller.js` mediante `ensureDailyClockIn`. El control diario pertenece a esta area, pero la activacion inicial depende de un flujo transversal.

### 8.4 Acceso seguro a listados y reportes
`users.controller.js` y `attendance.controller.js` distinguen entre lectura propia y lectura de terceros autorizados. En asistencia, ademas, la consulta administrativa por rango y estado se separa del PDF oficial RH-09 para evitar mezclar una vista operativa con una salida documental formal.

### 8.5 Consistencia entre perfil propio y expediente laboral
`profileSync.js` concentra las claves compartidas entre `user-profile` y `collaborators`. Esta decision evita drift entre ambos modulos y documenta de forma explicita que `user_profile` y `collaborator_profiles` no son fuentes aisladas, sino vistas complementarias del mismo expediente.

### 8.6 Usabilidad y respuesta responsive del dominio
La interfaz del area incorpora ajustes tecnicos especificos para mantener operacion real en dispositivos tactiles y pantallas pequenas. Entre ellos se incluyen selector movil en `PersonnelWorkspace`, acciones permanentes en `CertificationsBoard`, cabeceras con flex-wrap en perfil propio, separacion de botones de accion dentro de `CollaboratorWorkspace` y un hub administrativo unico para usuarios y departamentos visible solo para Talento Humano y TI mediante restricciones estrictas de ruta.

### 8.7 Trazabilidad consistente del dominio
`audit.js` acepta tanto el contrato historico (`usuario_id`, `modulo`, `accion`) como variantes legacy (`user_id`, `module`, `action`, `details`) usadas por servicios del dominio. Esta compatibilidad evita que los nuevos registros de `personnel-requests`, `users` y `departments` degraden a `anon/core/desconocida`. En frontend, `Auditoria.jsx` y `AuditoriaPreview.jsx` formatean los registros historicos no normalizados de manera explicita para no exponer placeholders internos como si fueran valores de negocio. A su vez, `PersonnelRequestProgress` consume la trazabilidad de etapa y muestra actor cuando el historial operativo ya lo provee.

## 9. Flujos tecnicos relevantes
### Flujo tecnico A - Workspace de solicitud de personal
```text
[Crear personnel_request]
-> [Persistir historial inicial]
-> [Editar profile de la solicitud]
-> [Subir documents]
-> [Agregar comments]
-> [Vincular applicant o collaborator]
-> [Ejecutar hire]
```

### Flujo tecnico B - Perfil de colaborador
```text
[Leer users + departments]
-> [Leer collaborator_profiles]
-> [Leer user_profile]
-> [Leer collaborator_documents]
-> [Construir workspace consolidado]
```

### Flujo tecnico C - Asistencia y reporte
```text
[Clock-in]
-> [Actualizar user_attendance_records]
-> [Sincronizar ubicacion si llega despues]
-> [Derivar estado de jornada]
-> [Filtrar por rango o estado si talento consulta]
-> [Clock-out]
-> [Calcular overtime]
-> [Generar PDF RH-09]
```

### Flujo tecnico D - Permiso recuperable
```text
[Insertar permisos_vacaciones]
-> [Registrar firmas si aplica]
-> [Aprobar parcial o final]
-> [Guardar justificantes]
-> [Coordinar recovery_plan]
-> [Scheduler procesa vencimiento]
```

## 10. Conclusion
El diseno tecnico del Area 02 muestra un dominio con varias capas y coexistencia de modulos modernos y legacy. Aun asi, el area es trazable: los componentes principales de talento, perfil, asistencia, permisos y vacaciones estan montados, tienen consumidores frontend identificables y usan un conjunto de entidades suficientemente verificable para documentacion formal.
