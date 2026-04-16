# Tarea 09 — UI: máximos, saldos y solicitud de entrega (MVP)

---INICIO PROMPT TAREA 09---

## Rol

Desarrollador full stack senior en **FamSPI** (React). Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`. **Dependencias:** tareas 03–04 (APIs estables); tarea 05 si se incluye compra pública en la misma pantalla.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-020** — Vista de máximos y saldos por BC/techo para usuario autorizado.
- **REQ-SPI-021** — Formulario de solicitud parcial con mensajes de error legibles mapeados desde `code` del API.
- **REQ-SPI-030** — Control de acceso mínimo: ruta protegida; solo roles permitidos (reutilizar sistema de roles del front si existe; si no, documentar placeholder con TODO y guard en backend verificado).

## Tarea concreta

1. Añadir ruta en el frontend (mismo patrón que módulos comercial/logística) `/comercial/delivery-ceilings` o ruta acordada al árbol del proyecto.
2. Pantalla 1: buscar por `business_case_id` o selector existente de clientes/BC; mostrar tabla de líneas con `max_qty`, `delivered_qty`, `remaining`.
3. Pantalla 2 (o misma vista): formulario crear solicitud llamando `POST /api/v1/delivery-requests`; mostrar toast o alert con `MAX_EXCEEDED` traducido al español de usuario.
4. Ocultar o deshabilitar entradas del menú si el usuario no tiene permiso (según patrón del repo).

## No hacer

- No rediseñar todo el módulo comercial.
- No llamar a Odoo desde el browser.

## Entregables

- Componentes JSX + servicios API existentes (`api` layer).
- Captura o descripción de flujo en el resumen.

## Checklist de verificación (Definition of Done)

- [ ] Usuario sin permiso recibe 403 del backend y la UI no muestra acciones mutantes (o muestra mensaje claro).
- [ ] Error `MAX_EXCEEDED` se muestra sin stack trace.
- [ ] Flujo feliz crea solicitud y refresca saldos **pendientes** según diseño (si el API devuelve saldos, úsalos; si no, documentar limitación).
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-020, REQ-SPI-021; REQ-SPI-030 mínimo viable con verificación backend."**

---FIN PROMPT TAREA 09---
