# MAPA DE MODULOS POR AREA - SISTEMA DE PROCESOS INTERNOS

## 1. Objetivo
Definir conjuntos de modulos por area de negocio para revisar, validar y priorizar la documentacion URS propuesta del sistema actual.

## 2. Cobertura de modulos
- Total de modulos backend detectados: 42
- Total de modulos agrupados por area: 42
- Cobertura: 100%

## 3. Areas funcionales del sistema
- Area 01: Gobierno, Seguridad y Cumplimiento
- Area 02: Talento Humano
- Area 03: Comercial y Gestion de Demanda
- Area 04: Operaciones, Servicio y Logistica
- Area 05: Finanzas
- Area 06: Plataforma TI e Integraciones

## 4. Mapa de asignacion modulo -> area
### Area 01 - Gobierno, Seguridad y Cumplimiento (7)
- auth
- security
- auditoria
- audit-prep
- approvals
- management
- signature

### Area 02 - Talento Humano (11)
- talento_humano
- users
- user-profile
- user-certifications
- collaborators
- attendance
- vacaciones
- permisos
- personnel-requests
- applicants
- departments

### Area 03 - Comercial y Gestion de Demanda (6)
- comercial
- clients
- requests
- business-case
- equipment-purchases
- private-purchases

### Area 04 - Operaciones, Servicio y Logistica (7)
- operaciones
- inventario
- logistica
- servicio
- tecnico
- technical-applications
- mantenimientos

### Area 05 - Finanzas (2)
- finanzas
- viaticos

### Area 06 - Plataforma TI e Integraciones (9)
- dashboard
- files
- documents
- notifications
- gmail
- integrations
- schedules
- calendar
- support-tickets

## 5. Dependencias principales entre areas
- Gobierno, Seguridad y Cumplimiento -> transversal a todas las areas por autenticacion, autorizacion, auditoria y aprobaciones.
- Talento Humano -> depende de Gobierno/Seguridad para acceso y de Plataforma TI para notificaciones y archivos.
- Comercial y Gestion de Demanda -> depende de Talento Humano (responsables), Operaciones (ejecucion), Finanzas (control economico) y Plataforma TI.
- Operaciones, Servicio y Logistica -> depende de Comercial (origen de demanda), Talento Humano (asignacion de personal), Finanzas (viaticos y costos) y Plataforma TI.
- Finanzas -> depende de Comercial y Operaciones para eventos economicos y de Gobierno/Seguridad para trazabilidad.
- Plataforma TI e Integraciones -> provee servicios transversales a todas las areas.

## 6. Equivalencias con nombres macro usados en informes previos
- autenticacion -> auth
- usuarios -> users + user-profile + user-certifications
- clientes -> clients
- pedidos -> requests
- facturacion -> finanzas + equipment-purchases + private-purchases
- inventario -> inventario
- notificaciones -> notifications
- servicio_tecnico -> servicio + tecnico + technical-applications + mantenimientos
- ti_soporte -> support-tickets + integrations + gmail + files + documents
- comercial -> comercial + clients + requests + business-case
- talento_humano -> talento_humano + attendance + permisos + vacaciones + personnel-requests + applicants + collaborators + departments

## 7. Documentacion por area
- [area_01_gobierno_seguridad.md](./area_01_gobierno_seguridad.md)
- [area_02_talento_humano.md](./area_02_talento_humano.md)
- [area_03_comercial_demanda.md](./area_03_comercial_demanda.md)
- [area_04_operaciones_servicio_logistica.md](./area_04_operaciones_servicio_logistica.md)
- [area_05_finanzas.md](./area_05_finanzas.md)
- [area_06_plataforma_ti_integraciones.md](./area_06_plataforma_ti_integraciones.md)
