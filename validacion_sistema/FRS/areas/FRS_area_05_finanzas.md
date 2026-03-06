# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)
## Area: Finanzas

## 1. Introduccion
Este documento establece la especificacion funcional del area de Finanzas del SPI para control economico, viaticos y trazabilidad financiera.

## 2. Referencias
- URS base: `validacion_sistema/URS/areas/area_05_finanzas.md`
- Modulos fuente: `finanzas`, `viaticos`

## 3. Objetivo funcional
Detallar funciones para registrar, validar y auditar operaciones financieras derivadas de procesos internos.

## 4. Alcance funcional detallado
- Registro de transacciones financieras.
- Consulta y consolidacion por periodo.
- Gestion de viaticos y liquidaciones.
- Trazabilidad de aprobaciones y cambios.

## 5. Actores y perfiles
- Analista financiero.
- Aprobador presupuestario.
- Colaborador solicitante de viatico.
- Gerencia de control.

## 6. Componentes funcionales involucrados
- Backend: modulos financieros y viaticos.
- Frontend: vistas de transacciones, aprobaciones y reportes.
- Datos: eventos economicos, viaticos, evidencias y estados.

## 7. Especificaciones funcionales
### FR-FIN-001 Registro de transacciones
- Descripcion: Registrar movimientos financieros asociados a procesos.
- Entradas: tipo de movimiento, monto, referencia de proceso.
- Salidas: transaccion persistida y trazable.
- Reglas: datos obligatorios y formato monetario valido.

### FR-FIN-002 Consulta de estados y resumenes
- Descripcion: Consultar situacion financiera por periodo/responsable.
- Entradas: filtros de fecha, proceso, estado.
- Salidas: resumen financiero consolidado.
- Reglas: acceso por rol y consistencia de periodos.

### FR-FIN-003 Gestion de viaticos
- Descripcion: Registrar solicitudes de viaticos y su ciclo de aprobacion.
- Entradas: solicitante, motivo, monto, evidencias.
- Salidas: solicitud con estado actualizado.
- Reglas: validacion de politicas y aprobador habilitado.

### FR-FIN-004 Asociacion de egresos
- Descripcion: Vincular egresos con solicitud u operacion origen.
- Entradas: egreso, referencia operativa/comercial.
- Salidas: egreso relacionado y auditable.
- Reglas: no se permite egreso sin referencia valida.

### FR-FIN-005 Trazabilidad de cambios y aprobaciones
- Descripcion: Registrar historial de decisiones financieras.
- Entradas: accion financiera, actor, decision.
- Salidas: bitacora de cambios disponible para auditoria.
- Reglas: registro obligatorio en eventos criticos.

### FR-FIN-006 Validacion previa a confirmacion
- Descripcion: Validar integridad de datos antes de confirmar transaccion.
- Entradas: datos de transaccion/viatico.
- Salidas: confirmacion o rechazo con causa.
- Reglas: controles de duplicidad y consistencia de estado.

### FR-FIN-007 Exposicion de informacion autorizada
- Descripcion: Entregar reportes e informacion financiera segun permisos.
- Entradas: consulta autorizada.
- Salidas: reporte financiero controlado.
- Reglas: confidencialidad y minima exposicion de datos.

### FR-FIN-008 Prevencion de inconsistencias
- Descripcion: Evitar registros duplicados o conflictivos en concurrencia.
- Entradas: operaciones simultaneas sobre entidad financiera.
- Salidas: bloqueo o control transaccional.
- Reglas: integridad ACID/logica de negocio equivalente.

## 8. Validaciones de negocio y datos
- Todo movimiento requiere referencia de proceso y responsable.
- Viatico requiere soporte documental y flujo de aprobacion.
- No se permite confirmacion con campos obligatorios faltantes.
- Estado financiero debe ser coherente con el flujo de aprobacion.

## 9. Seguridad y control
- Acceso restringido a informacion economica por rol.
- Auditoria obligatoria de cambios y aprobaciones.
- Proteccion de datos financieros sensibles.

## 10. Manejo de errores y excepciones
- `400/422`: datos financieros invalidos.
- `401`: acceso sin autenticacion.
- `403`: operacion no autorizada por perfil.
- `404`: referencia de proceso inexistente.
- `409`: conflicto por duplicidad o estado inconsistente.

## 11. Interfaces e integraciones
- Integracion con Comercial y Operaciones para referencia de eventos.
- Integracion con Talento Humano para datos de solicitantes/aprobadores.
- Integracion con Gobierno/Seguridad para controles y auditoria.
- Integracion con documentos/notificaciones para evidencia y alertas.

## 12. Matriz de trazabilidad URS -> FRS -> Prueba
| URS | FRS | Caso de prueba funcional |
|---|---|---|
| REQ-FIN-001 | FR-FIN-001 | Registrar transaccion con referencia valida |
| REQ-FIN-002 | FR-FIN-002 | Consultar resumen por periodo y responsable |
| REQ-FIN-003 | FR-FIN-003 | Crear y aprobar solicitud de viatico |
| REQ-FIN-004 | FR-FIN-004 | Asociar egreso a solicitud/operacion origen |
| REQ-FIN-005 | FR-FIN-005 | Verificar bitacora tras aprobacion financiera |
| REQ-FIN-006 | FR-FIN-006 | Intentar confirmacion con datos incompletos |
| REQ-FIN-007 | FR-FIN-007 | Generar reporte segun permisos habilitados |
| REQ-FIN-008 | FR-FIN-008 | Simular concurrencia y validar no duplicidad |

## 13. Criterios de aceptacion del area
- Transacciones financieras con referencia y trazabilidad completas.
- Flujos de viaticos con validacion y aprobacion consistentes.
- Informacion financiera protegida por control de acceso.
- Sin duplicidades ni inconsistencias de estado en pruebas clave.
