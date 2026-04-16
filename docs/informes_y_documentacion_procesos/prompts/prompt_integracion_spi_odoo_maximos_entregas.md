# Prompt específico: integración SPI ↔ Odoo (máximos y entregas parciales)

Úsese con el rol base en `prompt_desarrollador_fullstack_integraciones_erp.md` cuando la tarea sea **backend/frontend SPI** y **API Odoo**.

---INICIO PROMPT---

## Tarea

Implementar o diseñar la integración entre **SPI** y **Odoo** para:

- **Tabla de máximos** derivada del resultado del **business case** (vigencia contractual).
- **Solicitudes de entrega parcial** por el asesor comercial, validadas contra saldos.
- **Compras privadas**: entregas a necesidad del cliente sin exceder máximos.
- **Compras públicas**: **plan de entregas** definido por analista; solicitudes solo dentro del tramo aprobado.
- Control explícito de **determinaciones, calibradores, controles, inversiones adicionales** y equipos según modelo de datos acordado.

## Restricciones

1. **Feature flag** global de integración: con flag `off`, el comportamiento observable del SPI para usuarios actuales no cambia.
2. Integración **asíncrona** (cola/outbox); timeouts y reintentos documentados.
3. **Idempotencia** en creación/actualización en Odoo; campos `x_spi_*` o equivalente para trazabilidad.
4. Validación de negocio en **servidor SPI**, no solo en UI.
5. Coherencia: si Odoo no confirma movimiento, **no** reducir saldo en SPI (salvo que negocio defina modelo inverso por escrito — entonces documenta la excepción).

## Salida esperada

- Modelo de datos (tablas/columnas o esquema JSON) antes del código si la tarea es de diseño.
- Si es implementación: rutas API, servicios, migraciones SQL, y puntos de enganche en `private-purchases` / `equipment-purchases` / business case.
- Casos de prueba: mínimo **privado** (excede máximo, OK parcial) y **público** (sin plan, con plan, fuera de ventana).

## Referencia obligatoria

- `docs/informes_y_documentacion_procesos/requerimientos_spi_nuevas_funcionalidades.md`
- `docs/informes_y_documentacion_procesos/requerimientos_integracion_odoo.md`
- `docs/informes_y_documentacion_procesos/informe_de_analisis.md`

---FIN PROMPT---
