# Control de Cambios en Estado Validado

## Proposito

Establecer el procedimiento formal para gestionar cambios en el sistema FamSPI v1.0.0 una vez que ha sido liberado en estado validado, garantizando que cualquier modificacion sea evaluada, aprobada y documentada antes de su implementacion, y que el impacto sobre la validacion sea determinado formalmente.

Todo cambio debe estar trazado contra un ticket real del sistema de tickets de TI (`support-tickets`). El registro documental de control de cambios no reemplaza al ticket; lo referencia y verifica que el ciclo operativo del ticket exista en sistema.

## Alcance

Este procedimiento aplica a todos los cambios en:
- Codigo fuente del backend o frontend de FamSPI.
- Infraestructura de despliegue (Cloud Run, base de datos, variables de entorno).
- Configuracion del sistema (parametros operativos, roles, permisos).
- Integraciones con servicios externos (Google OAuth, Gmail, Drive).
- Documentacion de validacion controlada.

## Clasificacion de Cambios

| Tipo | Descripcion | Nivel de Evaluacion | Revalidacion Requerida |
|---|---|---|---|
| Menor | Correccion de errores tipograficos, ajustes de UI sin impacto funcional | Revision TI | No - solo actualizacion documental |
| Moderado | Correccion de bugs funcionales y ajustes de logica operativa o de rendimiento sin cambio de arquitectura | Revision TI + Funcional | OQ parcial sobre modulos afectados |
| Mayor | Nuevas funcionalidades, cambios de arquitectura, migracion de plataforma, actualizaciones mayores | Revision TI + Funcional + Gerencia | Revalidacion completa del area afectada |
| Emergencia | Correccion critica de seguridad o falla que afecta integridad de datos | Aprobacion verbal + documentacion posterior en 24h | OQ de regresion post-implementacion |

## Proceso de Gestion de Cambios

```
Ticket TI --> Solicitud de cambio --> Evaluacion de impacto --> Clasificacion --> Aprobacion --> Implementacion --> Pruebas --> Documentacion --> Verificacion del ticket --> Cierre
```

### Paso 1: Solicitud de Cambio
- Todo cambio debe iniciarse mediante una Solicitud de Cambio (SC) documentada y un ticket TI asociado.
- El ticket TI debe existir en `support_tickets` con codigo unico (`code`) y trazabilidad de ciclo en `support_ticket_events`.
- La SC debe incluir: codigo del ticket TI, descripcion del cambio, justificacion, modulos/areas afectadas, impacto estimado en la validacion y solicitante.
- Si el cambio nace por una incidencia, requerimiento o problema ya reportado por usuario, se debe usar ese mismo ticket como referencia primaria.
- Si el cambio nace por decision interna de TI, TI debe crear el ticket correspondiente antes de iniciar implementacion.

### Paso 2: Evaluacion de Impacto
- El Responsable TI evalua el impacto tecnico.
- El Responsable Funcional evalua el impacto operativo y sobre los requerimientos URS/FRS.
- Se determina la clasificacion del cambio.

### Paso 3: Aprobacion
- Cambios Menores: aprobados por Responsable TI.
- Cambios Moderados: aprobados por Responsable TI y Responsable Funcional.
- Cambios Mayores: aprobados por Gerencia General.

### Paso 4: Implementacion y Pruebas
- Los cambios se implementan en ambiente de desarrollo/staging antes de produccion.
- Se ejecutan las pruebas requeridas segun la clasificacion.
- Los resultados se documentan en el Registro de Cambios.
- El ticket TI debe contener comentario o evidencia del resultado de pruebas, despliegue o decision de no despliegue.

### Paso 5: Verificacion contra tickets TI
- Antes de cerrar un cambio, el responsable TI debe verificar en el workspace de tickets que:
  - el codigo del ticket TI corresponde al cambio documentado,
  - el solicitante, modulo afectado y descripcion son consistentes con la SC,
  - existen eventos en `support_ticket_events` que soportan asignacion, cambio de estado, comentarios y cierre o resolucion,
  - el estado del ticket es `resuelto` o `cerrado`, salvo cambios cancelados con justificacion documentada,
  - los comentarios internos o publicos contienen referencia a pruebas, despliegue, rollback o decision tomada,
  - no existe reapertura pendiente relacionada con el mismo cambio.
- La verificacion debe registrarse en el Registro de Control de Cambios con el estado del ticket y la fecha de verificacion.

### Paso 6: Documentacion y Cierre
- Se actualizan los documentos de validacion afectados (URS, FRS, DDS, protocolos).
- Se actualiza la version del documento y el historial de revisiones.
- Se registra el cambio en el Registro de Control de Cambios.
- No se permite cerrar un cambio como implementado si el ticket TI asociado no esta verificado.

## Evidencia minima del ticket TI

| Evidencia | Fuente real | Criterio |
|---|---|---|
| Codigo de ticket | `support_tickets.code` | Debe constar en el Registro de Control de Cambios |
| Solicitante | `support_tickets.requester_id` | Debe corresponder al solicitante o al responsable TI que inicio el cambio |
| Estado | `support_tickets.status` | `resuelto` o `cerrado` para cambios implementados; estado justificado para cambios cancelados |
| Eventos | `support_ticket_events` | Debe existir secuencia suficiente de creacion, asignacion, cambio de estado, comentarios y cierre/resolucion |
| Comentarios | `support_ticket_comments` | Deben explicar analisis, pruebas, despliegue, rollback o decision de no ejecutar |
| Workspace TI | `/api/v1/support-tickets/workspace/list` | Debe permitir verificar el ticket por equipo TI |

## Registro de Control de Cambios

| ID Cambio | Ticket TI | Estado ticket | Fecha verificacion ticket | Fecha Solicitud | Descripcion | Tipo | Modulos Afectados | Solicitante | Aprobado por | Fecha Implementacion | Estado cambio | Revalidacion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CC-001 | __________ | __________ | __________ | __________ | (Sin cambios registrados al momento de emision inicial) | - | - | - | - | - | - | - |
| CC-002 | Pendiente de reconciliacion | Pendiente | Pendiente | 2026-06-22 | Ajuste de logica del correo general de no disponibilidad para permisos de emergencia o urgentes; se mantiene el envio cuando la aprobacion final ocurre dentro de una ventana operativa util y se omite cuando la aprobacion tardia ya no aporta coordinacion real. | Moderado | permisos | Operacion / usuario solicitante | Responsable TI + Responsable Funcional | 2026-06-22 | Implementado pendiente de verificacion TI | OQ parcial del modulo permisos |

## Criterios de Revalidacion

Un cambio requiere revalidacion formal (ejecucion de nuevos protocolos) cuando:
- Afecta funcionalidades cubiertas por los protocolos IQ, OQ o PQ existentes.
- Modifica la logica de negocio validada en el URS o FRS.
- Cambia la infraestructura de despliegue o configuracion de entorno.
- Introduce nuevas integraciones con sistemas externos.
- Modifica el esquema de base de datos en tablas criticas para la validacion.

## Firmas de Aprobacion del Procedimiento

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Elaborado por | __________________ | __________________ | __________ |
| Revisado por | __________________ | __________________ | __________ |
| Aprobado por | __________________ | __________________ | __________ |
