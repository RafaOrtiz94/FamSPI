# CA-01-15 Closure - Auditorías Internas/Externas

## Epic: CA-01-15 - Auditorías Internas/Externas

### Status: COMPLETO
**Date:** 2026-04-15

## Completed Files
- `backend/migrations/144_ca0115_audits.sql` - 5 tablas
- `backend/src/modules/calidad/ca0115.repository.js`
- `backend/src/modules/calidad/ca0115StateMachine.service.js`
- `backend/src/modules/calidad/ca0115.service.js`
- `backend/src/modules/calidad/ca0115.controller.js`
- `backend/src/modules/calidad/ca0115.routes.js`
- `backend/src/routes/registerRoutes.js` - Added `/api/v1/calidad/auditorias`
- `spi_front/src/modules/calidad/pages/CA0115Workspace.jsx`
- `spi_front/src/modules/calidad/components/CA0115Stepper.jsx`
- `spi_front/src/modules/calidad/components/CA0115AuthModal.jsx`
- `spi_front/src/modules/calidad/hooks/useCa0115Queries.js`
- `spi_front/src/modules/calidad/utils/ca0115PdfGenerator.js`

## Workflow
- Audit: planned → in_progress → completed → closed
- Finding: open → in_progress → closed → verified

## API Endpoints
- POST/GET /audits, /findings, /evidences, /checklists
- PUT /workflows/transition
- GET /metrics