# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Area: Finanzas

## 1. Introduccion
Este documento establece la propuesta URS del area financiera del SPI, elaborada desde funcionalidades existentes para control economico y gestion de viaticos.

## 2. Objetivo del area
Definir requerimientos de alto nivel para registrar, controlar y auditar impactos economicos de los procesos internos.

## 3. Alcance funcional
- Gestion de transacciones y registros financieros internos.
- Consolidacion de informacion economica para control.
- Gestion de viaticos vinculados a operaciones.
- Integracion con aprobaciones y trazabilidad de cumplimiento.

## 4. Actores del sistema
- Analista financiero.
- Responsable de aprobacion presupuestaria.
- Colaborador solicitante de viaticos.
- Gerencia para control y seguimiento.

## 5. Descripcion general del area
El area financiera consolida eventos economicos provenientes de comercial y operaciones, ejecuta controles de validacion y mantiene trazabilidad para control interno y auditoria.

## 6. Funcionalidades identificadas
- Registro de eventos y movimientos financieros.
- Consulta de historial economico por proceso/periodo.
- Gestion de solicitudes y liquidaciones de viaticos.
- Seguimiento de estados de aprobacion financiera.
- Asociacion de gastos a solicitudes u operaciones de origen.
- [Funcionalidad detectada en el sistema] Integracion con evidencias documentales y auditoria de cambios.

## 7. Requerimientos funcionales de alto nivel
- REQ-FIN-001: El sistema debe permitir registrar transacciones financieras vinculadas a procesos internos.
- REQ-FIN-002: El sistema debe permitir consultar estados y resumenes financieros por periodo y responsable.
- REQ-FIN-003: El sistema debe gestionar solicitudes de viaticos con flujo de aprobacion y control.
- REQ-FIN-004: El sistema debe permitir asociar egresos con solicitudes/operaciones que les dan origen.
- REQ-FIN-005: El sistema debe mantener trazabilidad de cambios y aprobaciones sobre registros financieros.
- REQ-FIN-006: El sistema debe validar datos obligatorios antes de confirmar transacciones economicas.
- REQ-FIN-007: El sistema debe exponer informacion financiera autorizada para reporte gerencial.
- REQ-FIN-008: El sistema debe impedir registros duplicados o inconsistentes en escenarios de concurrencia.

## 8. Requerimientos no funcionales
- RNF-FIN-001: Debe garantizarse integridad y consistencia de datos financieros.
- RNF-FIN-002: Debe aplicarse control de acceso estricto por sensibilidad economica.
- RNF-FIN-003: Debe existir trazabilidad completa para auditoria interna/externa.
- RNF-FIN-004: Debe mantenerse confidencialidad de la informacion financiera.
- RNF-FIN-005: Debe manejar errores de validacion y negocio sin comprometer consistencia contable.
- RNF-FIN-006: Debe sostener rendimiento en consultas consolidadas y cierres periodicos.

## 9. Reglas de negocio
- RN-FIN-001: Todo egreso debe tener referencia a proceso, responsable y evidencia.
- RN-FIN-002: Ningun viatico debe aprobarse sin validacion de datos y responsable autorizado.
- RN-FIN-003: Los cambios sobre registros financieros deben quedar auditados.
- RN-FIN-004: No se deben confirmar transacciones con estado incompleto o datos obligatorios faltantes.

## 10. Dependencias con otras areas
- Comercial y Gestion de Demanda: genera eventos economicos por solicitudes y compras.
- Operaciones, Servicio y Logistica: genera costos operativos y viaticos asociados.
- Talento Humano: provee datos de colaboradores y aprobadores.
- Gobierno, Seguridad y Cumplimiento: asegura autorizacion, aprobacion y auditoria.
- Plataforma TI e Integraciones: soporte documental, notificaciones y reportabilidad.

## 11. Modulos y URS fuente de la propuesta
- [URS_propuesta_modulo_finanzas.md](../URS_propuesta_modulo_finanzas.md)
- [URS_propuesta_modulo_viaticos.md](../URS_propuesta_modulo_viaticos.md)

## 12. Prioridad de validacion del area
- Criticidad: CRITICO
- Prioridad sugerida: 3
