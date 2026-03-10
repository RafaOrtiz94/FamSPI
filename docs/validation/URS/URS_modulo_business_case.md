# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Business Case

## Descripcion general del modulo
Gestiona la evaluacion tecnico-economica de oportunidades comerciales, con secciones colaborativas por rol, calculos de rentabilidad, control de workflow por estados y exportacion de resultados para decision gerencial.

## Objetivo del modulo
Soportar decisiones de factibilidad y priorizacion comercial basadas en datos estructurados, calculos y evidencia trazable.

## Actores del sistema
- Comercial.
- ACP / Backoffice Comercial.
- Jefe Comercial.
- Jefe Tecnico / Jefe Operaciones.
- Gerencia / Gerencia General.
- Administrador (catalogos y configuracion).

## Alcance funcional
- Alta, consulta, edicion y cierre de business cases.
- Seleccion de equipamiento y determinaciones.
- Calculos economicos, ROI y decision de factibilidad.
- Gestion de inversiones, consumo y plan de despacho.
- Control de ownership por seccion y bloqueo/desbloqueo.
- Integracion con catalogos de equipos/determinaciones/plantillas.
- Observabilidad del workspace y feature flags de autosave.
- Cola de generacion de hojas BC y seguimiento de jobs.

## Listado de requerimientos del usuario
### REQ-BC-001
- Actor: Comercial autenticado.
- Requerimiento: El sistema debe permitir crear y editar business cases.
- Resultado esperado: El caso queda persistido con identificador y estado inicial.

### REQ-BC-002
- Actor: Roles de negocio/tecnicos autorizados.
- Requerimiento: El sistema debe permitir completar secciones del BC segun permisos.
- Resultado esperado: La informacion seccionada queda guardada y trazable.

### REQ-BC-003
- Actor: Jefatura/Gerencia.
- Requerimiento: El sistema debe permitir calcular rentabilidad y registrar decision de factibilidad.
- Resultado esperado: Se actualiza el estado de evaluacion del caso.

### REQ-BC-004
- Actor: Roles de ownership.
- Requerimiento: El sistema debe permitir bloquear/desbloquear secciones para control colaborativo.
- Resultado esperado: Se evita edicion no autorizada y queda registro de ownership.

### REQ-BC-005
- Actor: Sistema/usuario autorizado.
- Requerimiento: El sistema debe permitir generar hojas BC y consultar estado del job.
- Resultado esperado: El resultado de generacion queda disponible y auditable.

## Listado de requerimientos no funcionales
### RNF-BC-001 Seguridad
El acceso a endpoints BC debe exigir JWT y rol habilitado.

### RNF-BC-002 Control de acceso granular
El sistema debe aplicar permisos por seccion y por etapa de workflow.

### RNF-BC-003 Integridad de datos
Actualizaciones de secciones y transiciones deben mantener consistencia entre tablas canonicas.

### RNF-BC-004 Trazabilidad
Debe registrarse historial de ownership, transiciones y jobs.

### RNF-BC-005 Rendimiento
Calculos y exportes deben ejecutarse en tiempos operativos razonables.

### RNF-BC-006 Resiliencia asincrona
La cola de hojas BC debe soportar reproceso y estados de fallo controlados.

## Reglas de negocio identificadas
- La edicion de secciones depende del rol y estado del BC.
- La factibilidad requiere validaciones previas de datos tecnicos/economicos.
- El bloqueo de seccion limita edicion a roles autorizados.
- La generacion de hojas se procesa de forma asincrona con estado de job.
- Existen validaciones de compatibilidad entre equipos y determinaciones.

## Dependencias con otros modulos
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.
- Servicio Tecnico y Mantenimientos.
