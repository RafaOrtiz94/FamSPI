# skill: frontend

## Propósito
Mejorar, corregir o construir interfaces en `spi_front` con calidad profesional, consistencia visual, buena experiencia de usuario y consumo correcto de APIs.

Este skill no debe limitarse a “hacer que funcione”.  
Debe entregar una pantalla clara, usable, consistente, responsive y alineada con el flujo real del sistema.

Objetivo:
Elevar la calidad del frontend de FamSPI evitando pantallas pobres, formularios básicos, tablas incompletas, mala gestión de estados y consumo API improvisado.

---

## Principio central

Frontend correcto = funcionalidad + experiencia + claridad + consistencia.

Una implementación frontend se considera incompleta si no contempla:

- estado de carga
- estado vacío
- estado de error
- validaciones visibles
- permisos/roles
- responsive básico
- mensajes claros al usuario
- integración real con backend
- consistencia con el diseño existente
- accesibilidad mínima

---

## Activar cuando

Usar este skill cuando el requerimiento involucre:

- Pantallas
- Formularios
- Tablas
- Modales
- Dashboards
- Filtros
- Búsqueda
- Consumo API
- Estados visuales
- Validaciones frontend
- Mejora UX/UI
- Corrección de pantallas pobres
- Integración de frontend con backend existente
- Vista de detalle, edición, creación o aprobación

---

## No usar cuando

No usar si:

- El problema real viene de backend 4xx/5xx.
- Se requiere cambiar roles/rutas protegidas globales.
- Se requiere modificar `AppRoutes.jsx` sin análisis RBAC.
- Se requiere crear permisos nuevos.
- Se requiere modificar contratos API.
- Se requiere cambiar auth/JWT.
- Se requiere tocar múltiples workspaces sin orquestador.

Handoff:

- Rutas protegidas / RBAC:
  `.agents/skills/routing-rbac-skill.md`

- Backend:
  agente del módulo correspondiente

- Cambios multi-módulo:
  `.agents/skills/orchestrator-skill.md`

---

## Alcance permitido

Área principal:

- `spi_front/src/modules/<area>/pages/*`
- `spi_front/src/modules/<area>/components/*`
- `spi_front/src/modules/<area>/api/*`
- `spi_front/src/modules/<area>/hooks/*`
- `spi_front/src/modules/<area>/utils/*`

Core compartido solo si existe evidencia:

- `spi_front/src/core/api/*`
- `spi_front/src/core/components/*`
- `spi_front/src/core/hooks/*`
- `spi_front/src/core/utils/*`

Prohibido tocar core compartido si el cambio puede resolverse dentro del módulo.

---

## Fuentes obligatorias

Antes de editar, consultar en este orden:

1. `backend/src/modules/<modulo>/CONTEXT.md`
2. Frontend existente del área
3. Servicio API usado por el área
4. Componentes similares en otros módulos
5. Backend solo si el contrato no está claro
6. `spi_front/src/routes/AppRoutes.jsx` solo si aplica a rutas protegidas

Si falta contexto, escribir:

```txt
Falta evidencia frontend para continuar.