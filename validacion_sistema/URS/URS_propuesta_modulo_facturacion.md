# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Facturacion y Control Financiero Operativo

## 1. Introduccion
Este documento define la propuesta de requerimientos del modulo financiero/facturacion del Sistema de Procesos Internos SPI, construida a partir de analisis del codigo de `finanzas` y `viaticos`.

## 2. Objetivo del modulo
Gestionar control financiero operativo interno: movimientos de inventario financiero, conciliacion con sistema externo y administracion de viaticos asociados a visitas operativas.

## 3. Alcance funcional
- Consulta y movimientos de inventario financiero.
- Emision de reporte CSV de movimientos.
- Conciliacion de inventario con API externa (Silver).
- Gestion de viaticos por visita/prospecto/manual.
- Aprobacion financiera y pago de viaticos.
- Registro documental de soporte de gastos.
- Generacion de reporte de cotejo (asistencia, geolocalizacion y recomendacion de monto).

## 4. Actores del sistema
- Finanzas.
- Jefatura financiera.
- Gerencia (como actor financiero superior).
- Comercial / Backoffice / Tecnico (solicitantes de viaticos).
- Sistema externo Silver (integracion de inventario).

## 5. Descripcion general del modulo
El modulo combina dos capacidades: control financiero de inventario (`finanzas.controller`) y gestion de viaticos (`viaticos.service`). El flujo de viaticos cruza visitas comerciales, asistencia del colaborador, geolocalizacion y documentos de soporte para sugerir montos y facilitar aprobacion de Finanzas.

Nota de contexto: este sistema no opera como ERP contable/fiscal completo; la funcionalidad detectada corresponde a control interno de procesos.

## 6. Funcionalidades identificadas
- Listado de inventario financiero (`GET /api/v1/finanzas/api/v1/inventory`).
- Movimiento de inventario (`POST /api/v1/finanzas/api/v1/inventory/move`).
- Reporte CSV de movimientos (`GET /api/v1/finanzas/api/v1/inventory/report`).
- Conciliacion con API Silver (`POST /api/v1/finanzas/api/v1/inventory/sync`).
- Listado de candidatos de viaticos por visitas (`GET /api/v1/viaticos/candidates`).
- Listado de viaticos (`GET /api/v1/viaticos`).
- Creacion/actualizacion de viatico (`POST /api/v1/viaticos`).
- Cambio de estado financiero de viatico (`PATCH /api/v1/viaticos/:id/status`).
- Gestion documental de viatico (`GET/POST /api/v1/viaticos/:id/documents`).
- Reporte de cotejo de viatico (`GET /api/v1/viaticos/:id/report`).
- [Funcionalidad detectada en el sistema] Creacion/ajuste automatico de estructura SQL de viaticos al invocar servicios.
- [Funcionalidad detectada en el sistema] El prefijo de rutas de inventario financiero se encuentra duplicado en `finanzas.routes.js`.

## 7. Requerimientos funcionales de alto nivel
- REQ-FAC-001: El sistema debe permitir al area financiera consultar inventario para control de disponibilidad y saldos.
- REQ-FAC-002: El sistema debe permitir registrar movimientos de inventario de tipo entrada/salida con razon y usuario responsable.
- REQ-FAC-003: El sistema debe impedir movimientos de salida que dejen stock negativo.
- REQ-FAC-004: El sistema debe permitir generar reporte CSV de movimientos de inventario para control y auditoria.
- REQ-FAC-005: El sistema debe permitir comparar inventario local contra sistema externo Silver y devolver discrepancias.
- REQ-FAC-006: El sistema debe permitir listar candidatos a viaticos desde visitas efectivamente realizadas.
- REQ-FAC-007: El sistema debe permitir crear o actualizar viaticos para viajes manuales y visitas referenciadas.
- REQ-FAC-008: El sistema debe permitir a Finanzas aprobar, pagar o rechazar viaticos y registrar montos aprobados.
- REQ-FAC-009: El sistema debe permitir cargar documentos de soporte (`invoice`, `liquidation`, `support`) vinculados a un viatico.
- REQ-FAC-010: El sistema debe calcular reporte de cotejo con validacion de asistencia y proximidad geografica de la visita.
- REQ-FAC-011: El sistema debe sugerir monto tecnico de viatico considerando distancia, combustible, liquidacion y facturas.
- REQ-FAC-012: [Funcionalidad detectada en el sistema] El sistema debe inicializar estructuras de viaticos y restricciones al primer uso en ambientes sin migracion aplicada.
- REQ-FAC-013: [Funcionalidad detectada en el sistema] El sistema debe exponer claramente ruta efectiva de finanzas-inventario para evitar ambiguedad de consumo frontend.

## 8. Requerimientos no funcionales
- RNF-FAC-001: El modulo debe aplicar control de acceso por rol financiero para operaciones de aprobacion y pago.
- RNF-FAC-002: Los movimientos de inventario deben ejecutarse en transaccion con rollback ante fallo de persistencia.
- RNF-FAC-003: La integracion con Silver debe tolerar fallos de red sin perder movimiento local, dejando rastro para reconciliacion.
- RNF-FAC-004: Los viaticos deben aplicar restricciones de integridad (estados, tipos de fuente, documentos y unicidad por visita).
- RNF-FAC-005: La carga documental de viaticos debe validar tipo de documento y limite de tamano permitido.
- RNF-FAC-006: El reporte de cotejo debe usar metrica reproducible de distancia (haversine) y reglas de clasificacion de riesgo.
- RNF-FAC-007: El modulo debe registrar auditoria de operaciones financieras y viaticos para trazabilidad.
- RNF-FAC-008: La capa API debe exponer contratos estables para consumo del workspace financiero del frontend.

## 9. Reglas de negocio
- RN-FAC-001: En inventario financiero, `type` solo puede ser `in` o `out` y `quantity` debe ser mayor a cero.
- RN-FAC-002: En inventario financiero, no se permiten salidas con stock insuficiente.
- RN-FAC-003: En viaticos, estados permitidos son `pending`, `approved`, `paid`, `rejected`.
- RN-FAC-004: En viaticos, `source_type` permitido: `client_visit`, `prospect_visit`, `manual_trip`.
- RN-FAC-005: Para viaticos de visita, la referencia (`source_id`) debe existir y estar en estado visitado.
- RN-FAC-006: Para usuarios no financieros, solo se permiten viaticos fuera del area de labores.
- RN-FAC-007: El rubro de gasolina solo aplica cuando la distancia declarada supera 1000 km.
- RN-FAC-008: El estado `paid` debe registrar fecha de pago.
- RN-FAC-009: La clasificacion de cotejo por asistencia/geolocalizacion distingue `matched`, `review`, `mismatch`, `no_attendance`, `insufficient_geo`.

## 10. Dependencias con otros modulos
- Modulo Inventario (`inventory`, `inventory_movements`).
- Modulo Clientes/Comercial (`client_visit_logs`, `prospect_visits`).
- Modulo Usuarios y Asistencia (`users`, `user_attendance_records`).
- Modulo Autenticacion/Autorizacion.
- Integracion externa Silver API (conciliacion de inventario).
- Integracion externa Google Drive (documentos de viaticos).
