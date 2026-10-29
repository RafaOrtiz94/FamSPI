# Guía de uso — Logística

> **Para quién es esta guía:** Personal de Logística, Comercial y Operaciones relacionado con envíos, recepciones y movimientos físicos de equipos.

---

## ¿Para qué sirve este módulo?

El módulo de **Logística** administra el movimiento físico de equipos, productos y documentos en la empresa: recepciones, traslados entre bodegas, asignación a clientes y coordinación de entregas.

En el frontend existe una pantalla dedicada en `/dashboard/logistica`, y adicionalmente hay vistas de logística integradas en el módulo de **Compras Privadas** (`LogisticaPrivatePurchases.jsx`).

---

## Estado actual

El backend de este módulo está **muy limitado o no implementado**. Los archivos encontrados indican que:
- `logistica.routes.js` es un wrapper mínimo que delega a `operaciones`.
- No existe un `logistica.controller.js` propio.
- La lógica real de logística se encuentra probablemente en `requests` o en los workspaces frontend que consumen APIs generales.

Si necesitas registrar una entrega o un movimiento logístico, es posible que debas hacerlo desde:
- **Compras Privadas** (si el movimiento está vinculado a una compra).
- **Servicio Técnico** (si el movimiento es para instalación o retiro de un equipo).
- **Operaciones** (si el flujo está vinculado a una solicitud).

---

## Pantalla principal

Accede desde **"Logística"** en el menú (`/dashboard/logistica`).

La vista `Dashboard.jsx` de logística muestra métricas generales del área, aunque sin endpoints propios confirmados en backend.

---

## Flujos esperados (según frontend)

### Flujo A — Logística de compras privadas

El workspace `LogisticaPrivatePurchases` muestra:
- Estado de envíos y entregas vinculadas a compras privadas.
- Datos de la compra: equipo, cliente, dirección, fecha estimada.
- Acciones de seguimiento (transporte, entregado, confirmación).

### Flujo B — Visión general

El dashboard de logística presenta indicadores del área, aunque limitado por la falta de endpoints backend específicos.

---

## Preguntas frecuentes

**[No veo mis envíos en el dashboard de Logística]**

Los envíos pueden estar registrados desde el módulo de **Compras Privadas** o desde **Servicio Técnico**. Revisa esas secciones para rastrear el movimiento.

**[No puedo registrar un nuevo envío]**

Si el backend no está implementado, contacta a TI para definir la ruta de registro manual o la habilitación del endpoint.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver envíos de compras privadas | Ve a Compras Privadas → Logística |
| Consultar dashboard general | Ve a "Logística" en el menú |
| Registrar movimiento físico | Usa el módulo correspondiente (Compras, Servicio Técnico) |
