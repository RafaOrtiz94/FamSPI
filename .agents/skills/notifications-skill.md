# skill: notifications

## Proposito
Gestionar envio de notificaciones y plantillas sin tocar logica del modulo origen.

## Alcance exacto
- `backend/src/modules/notifications/notificationManager.js`
- `backend/src/modules/notifications/notifications.service.js`
- `backend/src/modules/notifications/notificationRecipientsConfig.service.js`
- `backend/src/jobs/processNotificationDispatchQueue.js`

## Activar cuando
- No se envia notificacion o plantilla incorrecta.
- Ajuste de destinatarios por tipo de evento.

## No usar cuando
- El error esta en cambio de estado del modulo origen.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/notifications/
```

## Stop condition
- Si requiere editar modulo origen + manager + cola en una sola tarea, dividir.

## Handoff
- Modulo que genera el evento -> agente de ese modulo
