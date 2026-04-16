# Tarea 03 — Modelo de datos: máximos por business case y líneas

---INICIO PROMPT TAREA 03---

## Rol

Desarrollador full stack senior en **FamSPI**. Rol base: `prompt_desarrollador_fullstack_integraciones_erp.md`.

## Requisitos que DEBEN quedar cumplidos

- **REQ-SPI-002** — Cabecera de máximos vinculada a `business_case_id`, vigencia, tipo compra (`private`/`public`), estados `draft|approved|active|closed`.
- **REQ-SPI-003** — Líneas: cantidad máxima, unidad, tipo ítem, referencia a catálogo (p. ej. `equipment_model_id` nullable + `integration_product_map_id` nullable con regla “al menos uno”), `odoo_product_id` opcional.
- **REQ-SPI-031** — Tabla de auditoría o columnas de auditoría en transiciones de estado (actor, timestamp, motivo opcional).
- **REQ-SPI-040** — Migración SQL idempotente en la medida de lo posible.

## Tarea concreta

1. Diseñar dos tablas: `delivery_ceiling` (cabecera) y `delivery_ceiling_line` (líneas) con FK a `business_case` según el esquema real del proyecto (localizar nombre exacto de tabla/columna de business case en migraciones existentes).
2. Incluir `valid_from`, `valid_to` (nullable con semántica documentada), `purchase_type`, `status`.
3. Implementar máquina de estados **en servicio** (no solo en UI): transiciones válidas `draft→approved→active→closed`; rechazar transiciones ilegales con error 400 y código estable.
4. Registrar auditoría: mínimo tabla `delivery_ceiling_audit` **o** triggers; preferir servicio explícito que inserte fila en cada cambio de `status` con `user_id`, `at`, `from_status`, `to_status`, `reason`.

## No hacer

- No implementar aún llamadas a Odoo.
- No modificar el orquestador del business case salvo FK read-only.

## Entregables

- Migración(es) SQL.
- Servicio `deliveryCeiling.service.js` (o nombre alineado al repo) con funciones: `createDraft`, `addLine`, `transitionStatus`.
- Tests unitarios mínimos de transiciones inválidas/válidas **o** script de prueba manual documentado si el repo no tiene cultura de tests en ese módulo (justificar en resumen).

## Checklist de verificación (Definition of Done)

- [ ] Insertar cabecera + línea en DB vía servicio o SQL documentado funciona.
- [ ] Transición `draft→approved` y `approved→active` permitidas; `active→draft` rechazada.
- [ ] Cada cambio de estado deja rastro auditable consultable por SQL.
- [ ] Resumen final: **"REQ cumplidos: REQ-SPI-002, REQ-SPI-003, REQ-SPI-031, REQ-SPI-040."**

---FIN PROMPT TAREA 03---
