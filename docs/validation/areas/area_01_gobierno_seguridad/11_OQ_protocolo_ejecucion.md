# PROTOCOLO DE EJECUCION OQ
## Area 01: Gobierno, Seguridad, Cumplimiento y Gestion Documental

## 1. Objetivo
Definir los pasos operativos para validar el comportamiento funcional del Area 01 bajo condiciones normales y de error controlado.

## 2. Casos de ejecucion
| ID | Modulo | Escenario | Resultado esperado |
|---|---|---|---|
| OQP-GD-001 | auth | Login y callback | Usuario autenticado y sesion creada |
| OQP-GD-002 | security | Revision de evento off-hours | Confirmacion de revision y `notifications.read_at` actualizado |
| OQP-GD-003 | audit-prep | Carga documental valida | Confirmacion y metadata del documento |
| OQP-GD-004 | approvals | Aprobacion valida | Solicitud aprobada y decision registrada |
| OQP-GD-005 | management | Consulta de documentos y versiones | Adjuntos y versiones visibles |
| OQP-GD-006 | documents | Creacion desde plantilla | Documento creado |
| OQP-GD-007 | documents | Exportacion PDF | PDF generado |
| OQP-GD-008 | files | Carga y descarga de adjuntos | Carga y descarga exitosas |
| OQP-GD-009 | notifications | Creacion y lectura de notificacion | Notificacion visible y luego leida |
| OQP-GD-010 | dashboard | Consulta de resumen comercial | Resumen devuelto |
| OQP-GD-011 | gmail | Autorizacion y estado | Estado autorizado |
| OQP-GD-012 | gmail | Envio de correo | Correo enviado |
| OQP-GD-013 | signature | Firma documental completa | Firma exitosa y documento bloqueado |
