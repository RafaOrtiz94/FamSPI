# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Servicio Tecnico

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Servicio Tecnico del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Servicio Tecnico para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Servicio Tecnico.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Comercial
- Gerencia
- Gerencia General
- Jefe Comercial
- Jefe Logistica
- Jefe Operaciones
- Jefe Servicio Tecnico
- Jefe Tecnico
- Operaciones

## 5. Descripcion general del modulo
El modulo Servicio Tecnico se implementa principalmente en backend/src/modules/servicio y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /capacitaciones/:id.
- Operacion API detectada: GET /actividades.
- Operacion API detectada: GET /capacitaciones.
- Operacion API detectada: GET /disponibilidad.
- Operacion API detectada: GET /equipos.
- Operacion API detectada: GET /mantenimientos.
- Operacion API detectada: GET /mantenimientos-anuales.
- Operacion API detectada: GET /workflow-documents.
- Operacion API detectada: GET /workflow-documents/summary.
- Operacion API detectada: POST /actividades.
- Operacion API detectada: POST /capacitaciones.
- Operacion API detectada: POST /desinfeccion/pdf.
- Operacion API detectada: POST /disponibilidad.
- Operacion API detectada: POST /entrenamiento/asistencia/pdf.
- Operacion API detectada: POST /entrenamiento/pdf.
- Operacion API detectada: POST /entrenamiento/verificacion/pdf.
- Operacion API detectada: POST /equipos.
- Operacion API detectada: POST /mantenimientos-anuales.
- Operacion API detectada: PUT /capacitaciones/:id.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: documents, drive, google, public.equipment_models, public.users, servicio.cronograma_actividades_tecnicas, servicio.cronograma_capacitacion, servicio.cronograma_mantenimientos, servicio.cronograma_mantenimientos_anuales, servicio.disponibilidad_tecnicos, servicio.workflow_documents, the.

### Endpoints de API detectados
- DELETE /capacitaciones/:id
- GET /actividades
- GET /capacitaciones
- GET /disponibilidad
- GET /equipos
- GET /mantenimientos
- GET /mantenimientos-anuales
- GET /workflow-documents
- GET /workflow-documents/summary
- POST /actividades
- POST /capacitaciones
- POST /desinfeccion/pdf
- POST /disponibilidad
- POST /entrenamiento/asistencia/pdf
- POST /entrenamiento/pdf
- POST /entrenamiento/verificacion/pdf
- POST /equipos
- POST /mantenimientos-anuales
- PUT /capacitaciones/:id

### Componentes del sistema
- backend\src\modules\servicio\asistencia-entrenamiento.service.js
- backend\src\modules\servicio\desinfeccion.service.js
- backend\src\modules\servicio\entrenamiento.service.js
- backend\src\modules\servicio\servicio.controller.js
- backend\src\modules\servicio\servicio.routes.js
- backend\src\modules\servicio\verificacion-equipos.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\servicioApi.js

### Tablas/entidades de datos detectadas
- documents
- drive
- google
- public.equipment_models
- public.users
- servicio.cronograma_actividades_tecnicas
- servicio.cronograma_capacitacion
- servicio.cronograma_mantenimientos
- servicio.cronograma_mantenimientos_anuales
- servicio.disponibilidad_tecnicos
- servicio.workflow_documents
- the

## 7. Requerimientos funcionales de alto nivel
- REQ-SERV-001: El sistema debe permitir consultar y listar informacion operativa del modulo Servicio Tecnico segun los permisos del actor.
- REQ-SERV-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Servicio Tecnico con validaciones de entrada.
- REQ-SERV-003: El sistema debe permitir actualizar datos y estados del modulo Servicio Tecnico preservando trazabilidad.
- REQ-SERV-004: El sistema debe permitir ejecutar eliminaciones controladas del modulo Servicio Tecnico cuando el flujo de negocio lo permita.
- REQ-SERV-005: El sistema debe permitir gestionar evidencia documental asociada al modulo Servicio Tecnico, incluyendo carga y consulta.
- REQ-SERV-006: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Servicio Tecnico.
- REQ-SERV-007: El sistema debe interoperar con integraciones externas del modulo Servicio Tecnico: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-SERV-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-SERV-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-SERV-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-SERV-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-SERV-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-SERV-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-SERV-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-SERV-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-SERV-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial, comercial, gerencia, gerencia_general, jefe_comercial, jefe_logistica, jefe_operaciones, jefe_servicio_tecnico, jefe_tecnico, operaciones, servicio_tecnico, tecnico.
- RN-SERV-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-SERV-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-SERV-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

