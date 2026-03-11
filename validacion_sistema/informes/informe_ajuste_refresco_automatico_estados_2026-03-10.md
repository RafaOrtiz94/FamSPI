## Ajuste de refresco automatico por cambio de estado

Fecha: 2026-03-10

### Contexto
- Varias vistas de aprobacion o seguimiento actualizaban su propio estado local despues de una accion, pero otras vistas del mismo dominio quedaban desfasadas hasta recargar manualmente la pagina.
- El comportamiento esperado, alineado con el workspace de compras, es que los cambios de estado se propaguen automaticamente a widgets, listas y paneles relacionados.

### Hallazgos verificados
- `spi_front/src/core/api/index.js`
  - existia un `eventEmitter` y un hook de actualizacion automatica, pero no habia segmentacion por dominio funcional ni emision consistente para permisos, vacaciones, personal, solicitudes de cliente, cronogramas y viaticos.
- `spi_front/src/modules/shared/solicitudes/*`
  - permisos, vacaciones, resumenes y vistas ejecutivas no se enteraban automaticamente de cambios de estado realizados desde otro widget o vista del mismo dominio.
- `spi_front/src/core/ui/widgets/PersonnelRequestWidget.jsx`
  - el resumen de solicitudes propias de personal no se refrescaba automaticamente cuando gerencia aprobaba o rechazaba.
- `spi_front/src/modules/backoffice/components/ClientApprovalsWidget.jsx`
  - el panel de aprobacion de clientes no se sincronizaba automaticamente con otras vistas de solicitudes de cliente.
- `spi_front/src/modules/comercial/hooks/useScheduleApproval.js` y `spi_front/src/modules/comercial/hooks/useSchedules.js`
  - cronogramas dependian de recargas manuales o de la navegacion para reflejar cambios recientes.
- `spi_front/src/modules/finanzas/pages/ViaticosWorkspace.jsx`
  - los cambios de estado y soportes no tenian un mecanismo comun de refresco automatico.

### Cambios aplicados
- `spi_front/src/core/api/index.js`
  - se definieron scopes de actualizacion por dominio:
    - `permisos`
    - `vacaciones`
    - `personnel-requests`
    - `client-requests`
    - `schedules`
    - `viaticos`
  - se agregó emision automatica de eventos `data-updated` desde respuestas exitosas `POST`, `PUT`, `PATCH` y `DELETE` del cliente API central.
  - se añadió `useScopedAutoUpdate` para suscribir vistas a refrescos solo del dominio que les corresponde.
- Talento Humano:
  - `PermisosStatusWidget.jsx`
  - `AprobacionPermisosView.jsx`
  - `PermisosPage.jsx`
  - `PermisosGlobalRequestsWidget.jsx`
  - `PermisosColaboradoresWidget.jsx`
  - `PermisosColaboradoresAlbum.jsx`
  - `VacationRequestsWidget.jsx`
  - `HRPersonnelRequestsWidget.jsx`
  - `PersonnelRequestWidget.jsx`
  - ahora se refrescan automaticamente cuando cambia el estado de permisos, vacaciones, matriculas o solicitudes de personal.
- Comercial:
  - `ClientApprovalsWidget.jsx`
  - `ClientRequestManagement.jsx`
  - `ClientRequests.jsx`
  - `ClientRequestReview.jsx`
  - `useScheduleApproval.js`
  - `useSchedules.js`
  - ahora se refrescan automaticamente al cambiar solicitudes de cliente o cronogramas.
- Finanzas:
  - `ViaticosWorkspace.jsx`
  - ahora se refresca automaticamente cuando cambia el estado o la evidencia documental de un viatico.

### Validacion ejecutada
- `npm --prefix spi_front run build`: correcto con warnings historicos preexistentes del repositorio.

### Resultado esperado
- Un cambio de estado ya no depende de F5 para verse reflejado en el resto de vistas del mismo dominio.
- El refresco ocurre automaticamente y en segundo plano, manteniendo la interfaz consistente entre widgets, bandejas y paginas relacionadas.
