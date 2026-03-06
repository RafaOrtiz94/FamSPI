# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)
## Area: Comercial y Gestion de Demanda

## 1. Introduccion
Este documento describe la especificacion funcional detallada del area Comercial y Gestion de Demanda del SPI.

## 2. Referencias
- URS base: `validacion_sistema/URS/areas/area_03_comercial_demanda.md`
- Modulos fuente: `comercial`, `clients`, `requests`, `business-case`, `equipment-purchases`, `private-purchases`

## 3. Objetivo funcional
Detallar funciones para administrar clientes, solicitudes, casos de negocio y compras asociadas a la demanda.

## 4. Alcance funcional detallado
- Gestion de clientes.
- Gestion de solicitudes y estados.
- Gestion de casos de negocio.
- Gestion de compras vinculadas a demanda.
- Trazabilidad comercial-operativa-financiera.

## 5. Actores y perfiles
- Ejecutivo comercial.
- Jefatura comercial.
- Coordinador de operaciones.
- Analista financiero.

## 6. Componentes funcionales involucrados
- Backend: modulos comerciales y de demanda.
- Frontend: vistas de clientes, solicitudes, casos de negocio y compras.
- Datos: clientes, requerimientos, estados, decisiones y costos.

## 7. Especificaciones funcionales
### FR-COM-001 Gestion de clientes
- Descripcion: Registrar, actualizar y consultar informacion de clientes.
- Entradas: datos de cliente, clasificacion, estado.
- Salidas: cliente persistido y disponible para relacion comercial.
- Reglas: validaciones obligatorias e identificador unico.

### FR-COM-002 Gestion de solicitudes
- Descripcion: Crear solicitudes y gestionar su ciclo de vida.
- Entradas: solicitud, prioridad, responsable, fecha objetivo.
- Salidas: solicitud con estado vigente.
- Reglas: flujo de estados definido y trazabilidad de cambios.

### FR-COM-003 Vinculacion con casos y compras
- Descripcion: Relacionar solicitudes con casos de negocio y compras.
- Entradas: identificador de solicitud, caso y compra.
- Salidas: relacion persistida y auditable.
- Reglas: no debe existir compra sin requerimiento asociado.

### FR-COM-004 Consulta de trazabilidad comercial
- Descripcion: Consultar historial de decisiones y cambios por solicitud.
- Entradas: filtros por cliente, estado, periodo, responsable.
- Salidas: bitacora comercial consolidada.
- Reglas: visibilidad por rol.

### FR-COM-005 Asignacion de responsables
- Descripcion: Asignar responsables y fechas objetivo de ejecucion.
- Entradas: solicitud, responsable, compromiso.
- Salidas: plan operativo/comercial asociado.
- Reglas: responsable activo y perfil habilitado.

### FR-COM-006 Integracion con aprobaciones
- Descripcion: Enviar decisiones comerciales a flujo de aprobacion.
- Entradas: solicitud/caso, decision propuesta, aprobador.
- Salidas: estado aprobado/rechazado y registro de decision.
- Reglas: cumplimiento de jerarquia de aprobacion.

### FR-COM-007 Entrega de demanda a otras areas
- Descripcion: Exponer informacion de demanda a Operaciones y Finanzas.
- Entradas: consulta de modulo consumidor autorizado.
- Salidas: dataset operativo/financiero del requerimiento.
- Reglas: control de acceso y consistencia de datos.

### FR-COM-008 Cierre controlado de solicitudes
- Descripcion: Cerrar solicitudes solo con evidencia minima completa.
- Entradas: solicitud en estado final, soporte/evidencia.
- Salidas: solicitud cerrada y trazable.
- Reglas: prohibido cierre sin estado final y datos obligatorios.

## 8. Validaciones de negocio y datos
- Cliente debe estar activo para nuevas solicitudes.
- Solicitud requiere responsable y prioridad.
- Compras deben mantener relacion con solicitud/caso.
- Cierre requiere evidencia operativa/administrativa.

## 9. Seguridad y control
- Permisos diferenciados para crear, aprobar y cerrar.
- Trazabilidad de cada cambio de estado.
- Restriccion de visibilidad por rol y area.

## 10. Manejo de errores y excepciones
- `400/422`: datos incompletos o no validos.
- `401`: sesion no valida.
- `403`: operacion no permitida.
- `404`: cliente/solicitud/caso inexistente.
- `409`: conflicto de estado o duplicidad de relacion.

## 11. Interfaces e integraciones
- Integracion con aprobaciones y auditoria.
- Integracion con Operaciones para ejecucion de demanda.
- Integracion con Finanzas para control economico.
- Integracion con notificaciones y gestion documental.

## 12. Matriz de trazabilidad URS -> FRS -> Prueba
| URS | FRS | Caso de prueba funcional |
|---|---|---|
| REQ-COM-001 | FR-COM-001 | Crear y editar cliente con datos obligatorios |
| REQ-COM-002 | FR-COM-002 | Crear solicitud y mover estados autorizados |
| REQ-COM-003 | FR-COM-003 | Asociar solicitud con caso y compra |
| REQ-COM-004 | FR-COM-004 | Consultar historial por filtros comerciales |
| REQ-COM-005 | FR-COM-005 | Asignar responsable y fecha objetivo |
| REQ-COM-006 | FR-COM-006 | Aprobar/rechazar decision comercial |
| REQ-COM-007 | FR-COM-007 | Consumir demanda desde Operaciones/Finanzas |
| REQ-COM-008 | FR-COM-008 | Intentar cierre sin evidencia y validar bloqueo |

## 13. Criterios de aceptacion del area
- Solicitudes comerciales con flujo controlado de estados.
- Integracion operativa/financiera consistente.
- Cierres comerciales con evidencia verificable.
- Control de acceso y auditoria habilitados.
