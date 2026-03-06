# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Pedidos

## 1. Introduccion
Este documento define la propuesta de requerimientos del modulo de Pedidos del Sistema de Procesos Internos SPI, derivado de ingenieria inversa de los submodulos `requests`, `equipment-purchases` y `private-purchases`.

## 2. Objetivo del modulo
Orquestar el ciclo completo de solicitudes operativas y pedidos internos (publicos y privados), desde su creacion hasta cierre, incluyendo validaciones, aprobaciones, documentos, inspecciones y entrega final.

## 3. Alcance funcional
- Solicitudes generales (`requests`) y solicitudes de nuevo cliente.
- Pedidos de compra de equipos (`equipment_purchase_requests`).
- Pedidos de compra privada (`private_purchase_requests`) con maquina de estados.
- Gestion de documentos de flujo (oferta, proforma, contrato, actas, guias, consentimientos).
- Coordinacion interareas: Comercial, ACP, Backoffice, Calidad, Tecnico, Operaciones, Logistica, Gerencia.
- Eventos en tiempo real para actualizaciones de estado.

## 4. Actores del sistema
- Comercial.
- ACP Comercial.
- Backoffice Comercial.
- Calidad / Jefe Calidad.
- Tecnico / Jefe Tecnico / Jefe Servicio Tecnico.
- Operaciones / Logistica.
- Gerencia.
- Cliente externo (solo para consentimiento LOPDP por enlace publico).

## 5. Descripcion general del modulo
El modulo concentra la gestion documental y transaccional de solicitudes de negocio internas. Usa validacion AJV, reglas por rol y estado, control de concurrencia por `expected_updated_at`, checklist de requisitos por accion, y transiciones formales en compras privadas mediante `private_purchase_state_transitions`. Incluye integraciones con Drive, Docs, correo corporativo, notificaciones y calendario tecnico.

## 6. Funcionalidades identificadas
- Crear/listar/ver/cancelar/reenviar solicitudes generales (`/api/v1/requests`).
- Flujo de nuevo cliente: token de consentimiento, verificacion, carga documental, revision de calidad, aprobacion/rechazo (`/api/v1/requests/new-client/*`).
- Registro publico de consentimiento LOPDP por enlace (`/api/v1/requests/public/consent/:token`).
- Pedidos publicos: disponibilidad proveedor, proforma, reserva, inspeccion, contrato, fechas de entrega, despacho y cierre (`/api/v1/equipment-purchases/*`).
- Pedidos privados: flujo completo por estados canonicos, registro cliente, inspeccion, contrato, entrega y actas (`/api/v1/private-purchases/*`).
- SSE de actualizacion de pedidos (`/equipment-purchases/events`, `/private-purchases/events`).
- [Funcionalidad detectada en el sistema] Modo de convivencia legacy/V2 para pedidos (`purchaseRequestsFacade`) con mapeo entre tablas antiguas y `requests`.
- [Funcionalidad detectada en el sistema] Inicializacion automatica de tablas auxiliares de calidad y transiciones de estado.

## 7. Requerimientos funcionales de alto nivel
- REQ-PED-001: El sistema debe permitir crear solicitudes generales con validacion estructural del payload y adjuntos.
- REQ-PED-002: El sistema debe permitir listar y consultar solicitudes por filtros de estado, tipo y texto de busqueda.
- REQ-PED-003: El sistema debe permitir cancelar o reenviar solicitudes segun reglas de estado y rol.
- REQ-PED-004: El sistema debe permitir crear solicitudes de nuevo cliente con evidencia documental y trazabilidad de consentimiento LOPDP.
- REQ-PED-005: El sistema debe permitir validar codigo de consentimiento por correo y vincularlo al proceso de alta de cliente.
- REQ-PED-006: El sistema debe permitir a Backoffice aprobar/rechazar solicitudes de cliente y emitir oficio de aprobacion cuando aplique.
- REQ-PED-007: El sistema debe permitir a Calidad gestionar checklist tecnico para clientes sub-distribuidor previo a aprobacion final.
- REQ-PED-008: El sistema debe permitir crear pedidos publicos de equipos y asignarlos al responsable ACP.
- REQ-PED-009: El sistema debe permitir registrar respuesta de proveedor, gestionar proforma y avanzar el flujo por hitos de negocio.
- REQ-PED-010: El sistema debe permitir solicitar y registrar ventana/fecha de inspeccion tecnica con validacion de capacidad diaria.
- REQ-PED-011: El sistema debe permitir subir contrato y controlar estados hasta disponibilidad para entrega.
- REQ-PED-012: El sistema debe permitir registrar fechas de entrega, llegada de equipo, despacho y cierre de pedido.
- REQ-PED-013: El sistema debe permitir crear pedidos privados y gobernar su ciclo de vida por maquina de estados.
- REQ-PED-014: El sistema debe impedir transiciones de estado no validas y exigir motivo en rechazos de contrato.
- REQ-PED-015: El sistema debe validar documentos obligatorios antes de enviar un pedido privado a aprobacion de gerencia.
- REQ-PED-016: El sistema debe permitir gestionar registro/aprobacion de cliente dentro de pedido privado y sincronizar su estado.
- REQ-PED-017: El sistema debe permitir generar, asignar y finalizar actas de entrega en flujo de logistica/tecnico.
- REQ-PED-018: El sistema debe emitir eventos de actualizacion en tiempo real para que las interfaces mantengan estado sincronizado.
- REQ-PED-019: [Funcionalidad detectada en el sistema] El sistema debe soportar estrategia de migracion gradual legacy/V2 en pedidos sin duplicar operaciones criticas.

## 8. Requerimientos no funcionales
- RNF-PED-001: El modulo debe aplicar autenticacion y autorizacion por rol en cada endpoint segun etapa del flujo.
- RNF-PED-002: El modulo debe validar datos de entrada mediante esquemas AJV y responder con detalle de errores.
- RNF-PED-003: Las escrituras de workflow deben controlar concurrencia optimista (`expected_updated_at`) para evitar sobreescrituras.
- RNF-PED-004: El sistema debe registrar trazabilidad completa de estado, actor, razon y metadatos por transicion.
- RNF-PED-005: El modulo debe implementar mecanismos de idempotencia para evitar carga duplicada de documentos criticos.
- RNF-PED-006: El modulo debe integrarse con servicios externos (Drive, Docs, mail, calendario) tolerando fallos controlados.
- RNF-PED-007: El modulo debe mantener codigos de error funcionales para guiar el manejo en frontend (`CHECKLIST_INCOMPLETE`, `FORBIDDEN_ROLE_ACTION`, etc.).
- RNF-PED-008: Los endpoints de eventos en tiempo real deben ser compatibles con autenticacion por token y consumo web.

## 9. Reglas de negocio
- RN-PED-001: Una solicitud de nuevo cliente no puede aprobarse sin consentimiento LOPDP otorgado.
- RN-PED-002: Para cliente `sub_distribuidor`, Calidad debe cerrar checklist obligatorio sin inconsistencias antes de aprobacion.
- RN-PED-003: El pedido publico debe cumplir secuencia de estados permitidos por accion (ej. no se puede reservar sin proforma recibida).
- RN-PED-004: La solicitud de proforma tiene ventana de bloqueo temporal (cooldown) para evitar reenvios inmediatos.
- RN-PED-005: La coordinacion de inspeccion debe respetar capacidad tecnica diaria y rango de fechas autorizado.
- RN-PED-006: En compra privada, solo se permiten transiciones definidas por `PRIVATE_PURCHASE_TRANSITIONS`.
- RN-PED-007: En compra privada, rechazo de contrato exige motivo obligatorio.
- RN-PED-008: En compra privada, no se permite envio a gerencia si faltan documentos mandatorios del expediente.
- RN-PED-009: En compra privada, un comercial no debe crear mas de 3 solicitudes similares en 24 horas para el mismo cliente.
- RN-PED-010: [Funcionalidad detectada en el sistema] El flujo de comodato crea y vincula Business Case de forma automatica cuando corresponde.

## 10. Dependencias con otros modulos
- Modulo Clientes (`client_requests`, asignaciones y validacion de aprobacion).
- Modulo Inventario (sincronizacion de equipos y eventos de unidad).
- Modulo Business Case (especialmente flujo comodato).
- Modulo Notificaciones y Auditoria.
- Modulo Calendario tecnico y programaciones de servicio.
- Modulo Autenticacion/Usuarios.
- Integraciones externas Google Drive/Docs, correo corporativo y servicios de mensajeria.
