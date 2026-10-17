# Guía de uso — Inventario

> **Para quién es esta guía:** Comercial, servicio técnico, logística, operaciones y gerencia que registra, asigna y da seguimiento a equipos físicos instalados o disponibles.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona las **unidades físicas de equipos** en la empresa: no el catálogo conceptual, sino cada equipo individual con su serial, estado y ubicación real.

Sirve para:
- Dar de alta unidades desde un modelo base.
- Capturar el número de serie físico.
- Asignar equipos a clientes o sucursales.
- Cambiar el estado del equipo (disponible, instalado, en reparación, etc.).
- Registrar movimientos (entrada, salida, traslado).

Está diferenciado de:
- `equipment-purchases`: gestión del proceso de compra.
- `equipment-management`: gestión administrativa del parque.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial` | Lectura y creación |
| `servicio_tecnico`, `tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico` | Mutación |
| `operaciones`, `jefe_operaciones`, `logistica`, `jefe_logistica` | Mutación |
| `finanzas`, `jefe_finanzas`, `gerencia` | Mutación |
| `ti`, `admin_ti`, `admin` | Acceso completo |

> La lectura de inventario no requiere rol específico más allá de estar autenticado. La creación y mutación están restringidas.

---

## Pantalla principal

El inventario no parece contar con un workspace frontend dedicado propio. Su consumo se da principalmente a través de:
- **Servicio Técnico**: al registrar mantenimientos o instalar equipos.
- **Compras**: al dar de alta unidades nuevas.
- Posibles integraciones en otros workspaces.

---

## Flujo principal — Crear una unidad de inventario

### Paso 1 — Acceder al endpoint de creación

### Paso 2 — Indicar el modelo base

Selecciona el **modelo** del cual se crea la unidad física.

### Paso 3 — Registrar datos del equipo

Completa información específica de la unidad:
- Número de serie (puede capturarse en un paso posterior).
- Estado inicial.
- Ubicación o bodega.

### Paso 4 — Guardar

Queda registrada la unidad en el inventario.

---

## Flujo principal — Capturar el serial físico

### Paso 1 — Seleccionar la unidad

Localiza la unidad recién creada o pendiente de serial.

### Paso 2 — Ingresar el número de serie

Escanea o escribe el serial del equipo.

### Paso 3 — Confirmar

Queda registrado el serial único de la unidad.

---

## Flujo principal — Asignar equipo a cliente o sucursal

### Paso 1 — Seleccionar la unidad

### Paso 2 — Definir la asignación

- Cliente destino.
- Sucursal o ubicación.
- Fecha de asignación.

### Paso 3 — Confirmar

El estado del equipo cambia a "asignado" o "instalado".

---

## Flujo principal — Cambiar estado de un equipo

### Paso 1 — Seleccionar la unidad

### Paso 2 — Elegir el nuevo estado

Estados posibles (según el dominio):
- Disponible.
- Asignado / instalado.
- En mantenimiento.
- Dado de baja.
- Otros.

### Paso 3 — Confirmar

Queda registrado el cambio con fecha y responsable.

---

## Flujo principal — Registrar movimientos

### Paso 1 — Acceder a movimientos

### Paso 2 — Completar el registro

- Unidad afectada.
- Tipo de movimiento: entrada o salida.
- Cantidad.
- Motivo.

### Paso 3 — Guardar

Queda trazado el movimiento en el historial de la unidad.

---

## Flujo principal — Consultar equipos disponibles

### Paso 1 — Acceder al listado de disponibles

### Paso 2 — Revisar la lista

Muestra los equipos que están en stock y pueden asignarse.

---

## Flujo principal — Consultar equipos por cliente

### Paso 1 — Acceder por cliente

### Paso 2 — Revisar la lista

Muestra todos los equipos instalados o asignados a un cliente específico.

---

## Preguntas frecuentes

**[No encuentro el equipo en el inventario]**

Verifica que haya sido creado como unidad y no solo como modelo. Si es un equipo nuevo, primero debes crear la unidad desde el modelo correspondiente.

**[El serial del equipo ya fue registrado]**

El sistema permite capturar el serial solo una vez por unidad. Si hay un error, contacta a servicio técnico o al área administrativa.

**[Puedo eliminar una unidad de inventario]**

No está documentado un endpoint de eliminación en el CONTEXT.md. Si necesitas dar de baja un equipo, usa el cambio de estado correspondiente.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Dar de alta un equipo físico | Crea una unidad desde un modelo |
| Registrar el serial | Captura el serial en la unidad |
| Asignar equipo a cliente/sucursal | Asigna la unidad con cliente y ubicación |
| Cambiar el estado | Actualiza el estado de la unidad |
| Registrar entrada/salida | Crea un movimiento de inventario |
| Ver stock disponible | Consulta equipos disponibles |
