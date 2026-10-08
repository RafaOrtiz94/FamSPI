# CONTEXT.md - suggestion-box

## Purpose
General suggestion and complaint inbox for external visitors and authenticated internal users.

## API
- Public: `/api/v1/suggestion-box/public/submissions`
- Internal submit: `POST /api/v1/suggestion-box/submissions`
- Management: `GET /api/v1/suggestion-box/submissions`, `GET /:id`, `POST /:id/status`

## Access
- Public submission is unauthenticated, rate limited, and must include reporter identity data. Anonymous submissions are not allowed.
- Any authenticated user can submit internally.
- Management roles: calidad, jefe_calidad, gerencia, gerencia_general, ti, jefe_ti, admin_ti.

## Database
- `public.suggestion_box_submissions`
- `public.suggestion_box_events`

## Contracts
All responses retain `{ ok: true|false }`.
