# Especificacion de Requerimientos - URS

| ID | Categoria | Descripcion | Criticidad | Alcance relacionado | Criterio de aceptacion | Prueba relacionada | Evidencia esperada | Estado |
|---|---|---|---|---|---|---|---|---|
| URS-F-001 | Funcional | FamSPI debe permitir registrar solicitud de permiso valida | Alta | Permisos y Vacaciones | Solicitud creada con estado inicial | OQ-007, PQ-001 | Registro de solicitud | Abierto |
| URS-F-002 | Funcional | FamSPI debe permitir registrar solicitud de vacaciones valida | Alta | Permisos y Vacaciones | Solicitud creada con estado inicial | OQ-008, PQ-002 | Registro de solicitud | Abierto |
| URS-S-001 | Seguridad | FamSPI debe exigir autenticacion para rutas privadas | Alta | Gobierno y Seguridad | Acceso denegado sin sesion | OQ-003 | Evidencia de bloqueo | Parcial |
| URS-S-002 | Seguridad | FamSPI debe restringir acciones por rol o permiso | Alta | Gobierno y Seguridad | Accion no autorizada bloqueada | OQ-004, OQ-005 | Evidencia de denegacion | Abierto |
| URS-T-001 | Trazabilidad | FamSPI debe conservar trazabilidad de acciones criticas | Alta | Gobierno y Seguridad | Trail auditable coherente | OQ-014 | Registro de auditoria | Parcial |
| URS-E-001 | Evidencia | FamSPI debe generar evidencia objetiva de pruebas criticas | Alta | Global | Evidencia por caso critico | OQ/PQ-UAT | Inventario EV | Abierto |
| URS-NF-001 | No funcional | FamSPI debe operar en entorno identificado y controlado | Alta | Global | Entorno documentado y estable | IQ | Evidencia de ambiente | Abierto |
| URS-CC-001 | Control de cambios | FamSPI debe exigir control formal de cambios | Alta | Global | Cambio registrado con impacto y validacion | Informe/Acta | Registro de cambio | Parcial |
