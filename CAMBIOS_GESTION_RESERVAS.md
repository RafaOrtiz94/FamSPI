# Implementación de Gestión de Reservas y Cancelaciones

## Resumen de Cambios

Se ha implementado un sistema completo para gestionar el ciclo de vida de las reservas de equipos, incluyendo recordatorios, renovación y cancelación automática.

### 1. ✅ Gestión de Reservas
- **Expiración**: Las reservas ahora tienen una validez de **60 días**.
- **Recordatorio**: Se crea automáticamente un evento en Google Calendar para **55 días** después de la reserva (5 días antes de vencer).
- **Contenido del Evento**: Incluye fecha de vencimiento y acciones requeridas.

### 2. ✅ Renovación de Reservas
- **Funcionalidad**: Permite extender la reserva por otros **60 días**.
- **Acción**: Botón "Renovar reserva" disponible en el estado "Esperando proforma firmada".
- **Efecto**:
  - Actualiza la fecha de expiración.
  - Incrementa el contador de renovaciones.
  - Crea un nuevo evento de recordatorio en Calendar.

### 3. ✅ Cancelación de Órdenes
- **Manual**: Botón "Cancelar orden" disponible para el usuario.
  - Requiere ingresar un motivo.
  - Cambia el estado a "Cancelado".
- **Automática**: Job diario que verifica reservas vencidas (60 días).
  - Cancela automáticamente las órdenes expiradas.
  - Registra "Cancelación automática por expiración" como motivo.

### 4. ✅ Cambios Técnicos

#### Base de Datos
Nuevas columnas en `equipment_purchase_requests`:
- `reservation_expires_at`: Fecha de vencimiento.
- `reservation_renewed_at`: Fecha de última renovación.
- `reservation_renewal_count`: Contador de renovaciones.
- `cancelled_at`: Fecha de cancelación.
- `cancellation_reason`: Motivo de la cancelación.

#### Backend
- **Servicio**: Nuevas funciones `renewReservation` y `cancelOrder`.
- **Job**: `checkExpiredReservations.js` (ejecución diaria a las 00:00).
- **API**: Nuevos endpoints `/renew-reservation` y `/cancel-order`.

#### Frontend
- **Interfaz**: 
  - Cambio de diseño de tabla a **Tarjetas (Cards)** para mejor visualización.
  - **Diseño Premium con Glow**: Las tarjetas tienen un efecto de "luz LED" con gradientes y sombras de color según su estado.
  - **Carga de Archivos Mejorada**: Nuevo componente visual para subir archivos (drag & drop style) en lugar de inputs nativos.
  - Implementación de **Contador Regresivo** para la expiración de reservas.
  - **Pantallas de Carga (Overlays)** con mensajes descriptivos para todas las acciones asíncronas.
- **Lógica**: Manejo de confirmaciones y llamadas a la API.

## Flujo de Usuario Actualizado

1. **Reserva**: Usuario envía reserva -> Se agenda recordatorio (Día 55) -> Expira (Día 60).
2. **Renovación**: Antes del día 60, usuario puede renovar -> Nueva expiración (+60 días) -> Nuevo recordatorio.
3. **Cancelación**:
   - Usuario decide cancelar -> Ingresa motivo -> Orden cancelada.
   - Usuario olvida renovar -> Pasan 60 días -> Sistema cancela automáticamente.

## Archivos Modificados/Creados

- `backend/migrations/add_reservation_renewal_fields.sql` (Nuevo)
- `backend/src/modules/equipment-purchases/equipmentPurchases.service.js` (Modificado)
- `backend/src/modules/equipment-purchases/equipmentPurchases.controller.js` (Modificado)
- `backend/src/modules/equipment-purchases/equipmentPurchases.routes.js` (Modificado)
- `backend/src/jobs/checkExpiredReservations.js` (Nuevo)
- `backend/src/server.js` (Modificado)
- `spi_front/src/core/api/equipmentPurchasesApi.js` (Modificado)
- `spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx` (Modificado)
