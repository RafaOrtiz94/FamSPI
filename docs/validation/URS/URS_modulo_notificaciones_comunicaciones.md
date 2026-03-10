# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
Notificaciones y Comunicaciones

## Descripcion general del modulo
Gestiona la comunicacion operativa interna del sistema mediante notificaciones in-app, correo y Google Chat, incluyendo despacho asincrono por cola y configuracion de destinatarios por evento.

## Objetivo del modulo
Asegurar que los eventos de negocio se comuniquen oportunamente a los actores correctos con trazabilidad de entrega.

## Actores del sistema
- Usuario autenticado receptor de notificaciones.
- Sistemas productores de eventos (comercial, talento, servicio, TI, etc.).
- Administrador de jobs internos.

## Alcance funcional
- Bandeja de notificaciones por usuario (listar, crear, marcar, eliminar).
- Conteo de no leidas y marcado masivo.
- Envio de notificaciones por plantillas y mensajes custom.
- Cola de despacho asincrono con reintentos por canal (email/chat).
- Configuracion de destinatarios por evento/fuente.
- Notificaciones de seguridad (login fuera de horario) a usuarios TI.

## Listado de requerimientos del usuario
### REQ-NOT-001
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir consultar su bandeja de notificaciones.
- Resultado esperado: Se retorna listado ordenado y conteo de no leidas.

### REQ-NOT-002
- Actor: Usuario autenticado.
- Requerimiento: El sistema debe permitir marcar notificaciones como leidas.
- Resultado esperado: El estado de lectura queda persistido.

### REQ-NOT-003
- Actor: Sistema.
- Requerimiento: El sistema debe permitir generar notificaciones por eventos de procesos internos.
- Resultado esperado: La notificacion queda registrada con metadatos de origen.

### REQ-NOT-004
- Actor: Sistema/Job.
- Requerimiento: El sistema debe despachar notificaciones por email/chat de forma asincrona con reintentos.
- Resultado esperado: Cada intento queda trazado con estado final.

### REQ-NOT-005
- Actor: Administrador funcional.
- Requerimiento: El sistema debe permitir definir destinatarios por tipo de evento.
- Resultado esperado: Los receptores se resuelven por rol o usuario segun configuracion.

## Listado de requerimientos no funcionales
### RNF-NOT-001 Seguridad
Los endpoints de usuario deben exigir JWT y operar por ownership.

### RNF-NOT-002 Confiabilidad
La cola de despacho debe soportar reintentos y recuperacion ante fallos temporales.

### RNF-NOT-003 Integridad de proceso
Debe preservarse `process_key` para ordenar notificaciones de un mismo flujo.

### RNF-NOT-004 Trazabilidad
Cada notificacion debe guardar canal, estado, prioridad y error ultimo.

### RNF-NOT-005 Rendimiento
El procesamiento por lotes debe controlar concurrencia y evitar bloqueos.

### RNF-NOT-006 Resiliencia
Si falla un canal externo, la notificacion in-app no debe perderse.

## Reglas de negocio identificadas
- Las notificaciones se asocian al `user_id` destinatario.
- La cola maneja estados `pending`, `processing`, `sent`, `failed`.
- El orden por proceso se controla mediante `process_key`.
- Destinatarios pueden ser directos (`user_id`) o por rol.

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Usuarios y Perfiles.
- Comercial, Talento Humano, Servicio Tecnico, TI Soporte (eventos de negocio).
- Integraciones Gmail/Chat para envio multicanal.
