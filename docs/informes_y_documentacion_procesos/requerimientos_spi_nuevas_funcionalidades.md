# Requerimientos SPI: nuevas funcionalidades (post Oracle, con Odoo)

- **Última revisión:** 2026-04-11  
- **Contexto:** Oracle deja de ser fuente de datos. Odoo concentra maestros ERP. El SPI debe soportar procesos internos y **control de entregas** alineado a contratos y business case **sin depender de Oracle**.

---

## 1. Principios

1. **Feature flags**: toda integración o lógica nueva que pueda afectar flujos actuales debe poder desactivarse (comportamiento idéntico al actual con flag off).  
2. **Fuente maestra de producto comercial estándar**: tras el corte, el SPI debe consumir catálogo/IDs desde **Odoo** (o tabla de sincronización derivada), no desde Oracle.  
3. **Trazabilidad**: correlación de eventos, auditoría de cambios en máximos y entregas.

---

## 2. Modelo de datos y dominio

### REQ-SPI-001 — Libro de correspondencia producto

Crear y mantener correspondencia: código legado / SKU SPI / `product_id` Odoo / categoría de negocio (equipo, reactivo, determinación, calibrador, control, inversión adicional, servicio).

### REQ-SPI-002 — Tabla de máximos por business case

Entidad (nombre técnico a definir) vinculada a `business_case_id`, vigencia contractual, tipo de compra (privada / pública), estado (`draft`, `approved`, `active`, `closed`).

### REQ-SPI-003 — Líneas de máximo

Por cada ítem controlado: cantidad máxima, unidad, tipo de ítem, referencia al catálogo canónico y opcionalmente producto Odoo.

### REQ-SPI-004 — Generación desde business case

Al aprobarse un BC, generar **propuesta** de líneas de máximo (manual v1, reglas automáticas v2); permitir ajuste y segunda aprobación.

### REQ-SPI-005 — Solicitudes de entrega parcial (`delivery_request`)

Registro de lo solicitado por el asesor comercial; validación servidor: `cantidad <= saldo` según máximos y reglas de compra privada.

### REQ-SPI-006 — Plan de entregas (compras públicas)

Entidad gestionada por analista de compras públicas: tramos, fechas o ventanas, cantidades por línea; bloqueo de solicitudes fuera de plan.

### REQ-SPI-007 — Acumulados

`delivered_qty`, `remaining` por línea de máximo; actualización transaccional y coherente con confirmaciones externas (Odoo) cuando la integración esté activa.

### REQ-SPI-008 — Coherencia con jobs existentes

Revisar interacción con jobs de business case (p. ej. determinaciones / expiraciones) para una sola fuente de verdad de “ventanas” y límites.

---

## 3. Backend (API y servicios)

### REQ-SPI-010 — API interna de consulta de máximos

Endpoints o servicios detrás de autenticación; respuestas estables versionadas (`v1`).

### REQ-SPI-011 — API de creación de solicitud de entrega

Validaciones de negocio en servidor; códigos de error explícitos (exceso de máximo, ítem no permitido, plan público no aprobado).

### REQ-SPI-012 — Eventos de dominio

Emitir eventos (cola o outbox) en creación/aprobación de máximos y en solicitudes aprobadas, sin bloquear la respuesta HTTP del usuario.

### REQ-SPI-013 — Hooks en compras existentes

Integración con `private-purchases` y `equipment-purchases` para enlazar `business_case_id` y planes públicos sin romper respuestas actuales cuando el flag esté apagado.

---

## 4. Frontend / UX

### REQ-SPI-020 — Vista de máximos y saldos (mínimo viable)

Visualización por contrato/BC para roles autorizados (asesor, backoffice, logística).

### REQ-SPI-021 — Formulario de solicitud parcial

Flujo guiado con resumen de saldos y mensajes de rechazo entendibles.

### REQ-SPI-022 — Bandeja analista compras públicas

CRUD de plan de entregas y estados de aprobación.

### REQ-SPI-023 — Notificaciones

Aviso al asesor cuando una solicitud sea rechazada o aprobada (canal acordado: in-app / correo).

---

## 5. Seguridad y permisos

### REQ-SPI-030 — Roles nuevos o extensiones

Matriz: asesor, analista compras públicas, backoffice aprobador, administrador integración.

### REQ-SPI-031 — Auditoría

Registro de actor, timestamp, motivo de cambio en máximos y en solicitudes.

---

## 6. Calidad y despliegue

### REQ-SPI-040 — Migraciones SQL

Scripts idempotentes donde sea posible; ventanas de mantenimiento documentadas.

### REQ-SPI-041 — Pruebas automatizadas

Regresión con integración desactivada; pruebas E2E con integración en sandbox.

### REQ-SPI-042 — Documentación de runbook

Fallo de integración externa no debe impedir operación normal del SPI con flags off.

---

## 7. Dependencias externas

- Odoo disponible y catálogo alineado tras migración Oracle (ver `guia_ejecucion_migracion_oracle_odoo.md`).  
- Definición legal/contractual de entregas parciales y topes (fuera de alcance de código; referencia para reglas).

---

## 8. Trazabilidad a piloto previo

Los requerimientos anteriores son compatibles con el marco **REQ-PILOTO-*** definido en conversaciones de diseño (flags, sombra, cola, máximos, entregas). Puede asignarse tabla de correspondencia REQ-SPI ↔ REQ-PILOTO en la herramienta de gestión del proyecto.
