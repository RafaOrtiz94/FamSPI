# CONTEXT.md — auditoria

## 1. Descripción
Módulo de auditoría del sistema. Permite a TI y Gerencia listar, consultar en detalle y exportar logs de auditoría de todas las acciones realizadas en la plataforma. Solo roles privilegiados tienen acceso.

## 2. Endpoints

Prefijo: `/api/v1/auditoria`

- **GET /api/v1/auditoria/export/csv** — `exportCsv` — requireRole(`ti`, `gerencia`)
- **GET /api/v1/auditoria/** — `listAudits` — requireRole(`ti`, `gerencia`, `talento_humano`)
- **GET /api/v1/auditoria/:id** — `getDetail` — requireRole(`ti`, `gerencia`, `talento_humano`)

## 3. Flujo principal

1. Sistema registra automáticamente acciones en tabla de auditoría
2. TI/Gerencia lista eventos filtrados
3. Se puede obtener detalle individual de un evento
4. Se puede exportar en CSV para análisis externo

## 4. Validaciones
- Sin `verifyToken` explícito en el router (depende del middleware global)
- TH puede leer logs pero no exportar (solo TI y Gerencia pueden exportar)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- Todos los módulos del sistema escriben en auditoría como efecto secundario
- `auditoria.service.js` (5KB): lógica de consulta de logs

## 7. Frontend asociado
- `/dashboard/auditoria` → `Auditoria`
- Roles: `gerencia`, `gerencia_general`, `gerente_general`, `ti`

## 8. Riesgos detectados
- Sin `verifyToken` explícito en el router
- TH tiene acceso de lectura pero no está en `AppRoutes.jsx` como ruta visible

## 9. Notas técnicas
- Módulo de solo lectura — no expone endpoints de escritura
