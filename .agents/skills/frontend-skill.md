# skill: frontend

## Proposito
Cambios de UI/API client en `spi_front` para un solo workspace por tarea.

## Alcance exacto
- `spi_front/src/modules/<area>/pages/*`
- `spi_front/src/modules/<area>/components/*`
- `spi_front/src/modules/<area>/api/*`
- `spi_front/src/core/api/*`

## Activar cuando
- Pantalla rota, formulario, tabla o consumo API de una sola area.

## No usar cuando
- Se requiere cambiar roles/rutas protegidas globales (usar `routing-rbac-skill.md`).
- Error real viene de backend 4xx/5xx.

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd spi_front && npm run lint
```

## Stop condition
- Si requiere tocar 2+ workspaces frontend, dividir por area.

## Handoff
- Rutas protegidas -> `.agents/skills/routing-rbac-skill.md`
- Backend modulo -> agente de backend correspondiente
