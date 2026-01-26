Flujo de compras privadas (no tecnico)

Proposito y audiencia
- Este documento explica, en lenguaje simple, como funciona hoy el proceso de compras privadas y que roles lo operan.
- Esta dirigido a actores de negocio que necesitan entender secuencia, responsabilidades y traspasos.

Donde se ve el flujo
- En la seccion "Compras Privadas" del Workspace de Compras.
- El sistema muestra una vista distinta segun el rol del usuario.

Que pagina ve cada rol
- Jefe Operaciones: ve la vista de Operaciones (enfocada en fechas de entrega y seguimiento operativo).
- Jefe Logistica: ve la vista de Logistica (enfocada en despacho y acta de entrega).
- Otros roles (backoffice, comercial, gerencia, ACP): ven la vista de Backoffice.

Roles y responsabilidades (comportamiento actual)
- Asesor Comercial / Comercial
  - Crea la solicitud de compra privada.
  - Da seguimiento en el listado principal.
  - Si el estado es "pending client signature", puede subir la oferta firmada por el cliente.
- Backoffice Comercial
  - Envia el documento de oferta al cliente.
  - Registra al cliente cuando se recibe la oferta firmada.
  - Envia la solicitud hacia ACP / gerencia segun el estado.
  - Si un contrato es rechazado, puede reenviar luego de corregir.
- Gerencia / Jefe Comercial
  - Revisa y aprueba o rechaza cuando la firma de gerencia esta pendiente.
- ACP Comercial
  - Tiene visibilidad en la vista de backoffice y puede dar seguimiento.
- Jefe Operaciones
  - Solicita y establece fechas de entrega cuando la solicitud llega a operaciones.
- Jefe Logistica
  - Marca el despacho como listo y genera el acta de entrega.

Flujo general (lenguaje de negocio)
1) Un usuario comercial crea la solicitud con datos del cliente y equipos.
2) Backoffice revisa la solicitud y prepara la oferta.
3) Se envia la oferta al cliente y luego regresa firmada.
4) Backoffice registra al cliente y prepara el siguiente paso.
5) Gerencia revisa y aprueba/rechaza el contrato cuando aplica.
6) Operaciones coordina fechas de entrega.
7) Logistica prepara el despacho y completa la documentacion de entrega.

Que ve el usuario en la vista Backoffice
- Listado de solicitudes con filtros por estado, busqueda y detalle.
- Las acciones aparecen solo si el estado y el rol lo permiten.
- El detalle muestra cliente, equipos, notas y documentos disponibles.

Notas clave y limitaciones actuales
- Algunas acciones son exclusivas por rol y no aparecen si el usuario no lo tiene.
- El sistema exige documentos completos para aprobar en gerencia (si faltan, bloquea el envio).
- Operaciones y logistica tienen vistas separadas, cada una ve solo su tramo del flujo.
