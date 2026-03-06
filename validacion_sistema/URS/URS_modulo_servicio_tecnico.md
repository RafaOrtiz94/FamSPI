# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Servicio Tecnico y Mantenimientos

## Descripcion general del modulo
El modulo coordina la operacion tecnica interna: cronogramas, disponibilidad, mantenimientos, evidencias, aprobaciones y documentos de procedimientos.

## Objetivo del modulo
Asegurar continuidad operativa del servicio tecnico con trazabilidad de mantenimientos, documentos y aprobaciones.

## Actores del sistema
- Tecnico.
- Jefe Tecnico / Jefe Servicio Tecnico.
- Gerencia.
- Operaciones / Logistica (consulta de workflow documental).

## Alcance funcional
- Administrar capacitaciones y actividades tecnicas.
- Gestionar disponibilidad del equipo tecnico.
- Gestionar cronograma de mantenimientos.
- Registrar mantenimientos con firmas y evidencias.
- Generar documentos PDF operativos.
- Gestionar pendientes de aprobacion tecnica.
- Consultar aplicaciones tecnicas disponibles.

## Listado de requerimientos del usuario
### REQ-SER-001
- Actor: Tecnico.
- Requerimiento: El sistema debe permitir gestionar su disponibilidad y actividades tecnicas.
- Resultado esperado: El cronograma tecnico queda actualizado y visible por roles permitidos.

### REQ-SER-002
- Actor: Tecnico / Gerencia.
- Requerimiento: El sistema debe permitir crear y firmar mantenimientos con evidencia.
- Resultado esperado: El mantenimiento queda registrado y trazable.

### REQ-SER-003
- Actor: Jefatura tecnica.
- Requerimiento: El sistema debe permitir aprobar o rechazar pendientes tecnicos.
- Resultado esperado: El estado del proceso se actualiza segun decision autorizada.

### REQ-SER-004
- Actor: Tecnico.
- Requerimiento: El sistema debe permitir generar formatos PDF de desinfeccion, entrenamiento y verificacion.
- Resultado esperado: Se obtiene documento operativo con datos y firmas.

### REQ-SER-005
- Actor: Usuario tecnico autorizado.
- Requerimiento: El sistema debe permitir consultar aplicaciones tecnicas activas.
- Resultado esperado: El catalogo disponible se presenta sin registros archivados.

## Listado de requerimientos no funcionales
### RNF-SER-001 Seguridad
Todos los endpoints del modulo deben exigir autenticacion JWT.

### RNF-SER-002 Control de acceso
El sistema debe aplicar `requireRole` por accion tecnica y nivel de aprobacion.

### RNF-SER-003 Integridad documental
Evidencias y firmas deben asociarse de forma consistente con el mantenimiento.

### RNF-SER-004 Trazabilidad
El sistema debe conservar historial de cambios y estados de mantenimiento.

### RNF-SER-005 Manejo de errores
Errores de carga, firma o exportacion deben responder de forma controlada.

### RNF-SER-006 Rendimiento
Consultas de cronogramas y pendientes deben responder en tiempos aptos para operacion diaria.

## Reglas de negocio identificadas
- La aprobacion de mantenimiento es exclusiva de rol gerencia.
- Firmas pueden ejecutarse en etapas separadas del flujo.
- Documentos de workflow solo son visibles para roles definidos.
- Aplicaciones tecnicas archivadas no deben mostrarse en listados activos.

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Documentos/Archivos/Firma.
- Notificaciones y Comunicaciones.
