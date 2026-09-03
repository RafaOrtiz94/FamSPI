# Guía de uso — Finanzas

> **Para quién es esta guía:** Personal de Finanzas y Gerencia que consulta y administra el inventario financiero del sistema.

---

## ¿Para qué sirve este módulo?

Este módulo expone la gestión financiera del **inventario**. Permite consultar el stock actual, registrar movimientos de entrada y salida, generar reportes y sincronizar la información con el sistema Silver externo.

> **Nota importante:** este módulo presenta un **bug de rutas** documentado en el código: las rutas incluyen `/api/v1/` dentro del path relativo, lo que genera direcciones duplicadas como `/api/v1/finanzas/api/v1/inventory`. Si experimentas errores de acceso, contacta a TI.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Finanzas | Acceso completo |
| Gerencia | Acceso completo |

---

## Pantalla principal

Accede desde **"Finanzas"** en el menú principal (`/dashboard/finanzas`).

---

## Flujo principal — Consultar inventario

### Paso 1 — Ingresar al dashboard de Finanzas

Ve a **"Finanzas"** en el menú.

### Paso 2 — Revisar el listado de inventario

El sistema muestra los ítems registrados en la tabla `inventory` con su cantidad disponible.

---

## Flujo principal — Registrar movimiento de inventario

### Paso 1 — Acceder a "Mover inventario"

### Paso 2 — Completar el formulario

Debes indicar:

- **ID del item (inventory_id)**.
- **Tipo de movimiento**:
  - `in`: ingreso de stock.
  - `out`: salida de stock.
- **Cantidad**: número de unidades.
- **Motivo (reason)**: explicación del movimiento.

### Paso 3 — Enviar

El sistema valida:
- Que el tipo sea `in` o `out`.
- Que la cantidad sea mayor a cero.
- Que haya stock suficiente si es una salida.
- Que el item exista.

Si todo es válido, registra el movimiento, actualiza la cantidad y sincroniza con Silver (si el servicio externo responde).

---

## Flujo principal — Generar reporte

### Paso 1 — Acceder a "Reporte"

### Paso 2 — Descargar el CSV

El sistema genera un archivo CSV con todas las filas de `inventory_movements`, incluyendo referencia al movimiento en Silver (`silver_tx_id`).

---

## Flujo principal — Sincronizar con Silver

### Paso 1 — Acceder a "Sincronizar"

### Paso 2 — Ejecutar la sincronización

El sistema:
- Consulta el inventario local.
- Consulta el inventario remoto en Silver.
- Compara ambos y muestra las **discrepancias** encontradas (ítems con cantidades diferentes o inexistentes en un lado).

No modifica datos automáticamente: solo informa las diferencias para que Finanzas las resuelva.

---

## Preguntas frecuentes

**[No puedo acceder a las rutas de inventario]**

Verifica que el sistema esté accediendo por la ruta correcta. Existe un bug de doble prefijo documentado (`/api/v1/finanzas/api/v1/inventory`). Si persiste, contacta a TI.

**[La sincronización con Silver falló]**

El movimiento se registra igual en la base local. La sincronización con Silver se reintentará más tarde o deberá ser ejecutada manualmente. Consulta el log de la aplicación para ver el error exacto.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver el inventario actual | Ingresa a Finanzas |
| Registrar entrada/salida | Mueve inventario: tipo, cantidad, motivo |
| Obtener reporte de movimientos | Descarga el CSV de reporte |
| Comparar con sistema externo | Ejecuta sincronización con Silver |
