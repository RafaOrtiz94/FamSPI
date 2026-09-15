# Guía de uso — Integraciones

> **Para quién es esta guía:** Personal de TI, jefes técnicos, servicio técnico, gerencia y administradores que monitorea y gestiona la sincronización entre FamSPI y sistemas externos (principalmente Odoo).

---

## ¿Para qué sirve este módulo?

Este módulo gestiona la **integración bidireccional** entre FamSPI y sistemas externos, principalmente **Odoo (ERP)**. Su función es mantener ambos sistemas alineados sin que los usuarios deban duplicar información manualmente.

Flujos principales:
- Sincronización de **casos externos** (por ejemplo, casos correctivos generados desde Odoo).
- Sincronización de **clientes** entre FamSPI y Odoo.
- Mantenimiento del **mapa de productos** para alinear catálogos entre ambos sistemas.
- Revisión de **salud** de la integración.

El módulo usa un patrón **outbox** para procesar mensajes de sincronización de forma confiable, con un worker que procesa la cola en segundo plano.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `ti`, `jefe_ti`, `admin_ti` | Acceso completo a configuración, mapas y health |
| `tecnico`, `servicio_tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico` | Lectura de health y participación en procesos sincronizados |
| `gerencia`, `gerencia_general` | Visibilidad del estado de integración |
| `admin`, `administrador` | Acceso de escritura |

> Solo roles autorizados pueden modificar el mapa de productos o forzar procesamiento de la cola.

---

## Pantalla principal

Este módulo es **principalmente interno/admin**. No tiene un workspace frontend propio confirmado. Las acciones se ejecutan desde:
- Endpoints REST.
- Posibles paneles internos de TI.
- Workers automáticos en backend.

---

## Flujo principal — Verificar salud de la integración

### Paso 1 — Consultar health

TI o jefes técnicos pueden consultar el estado de la conexión con Odoo.

### Paso 2 — Interpretar el resultado

El endpoint devuelve el estado de la integración:
- Conectado y sincronizado.
- Errores de conexión.
- Cola de mensajes pendientes.

---

## Flujo principal — Procesar la cola de sincronización

### Paso 1 — Forzar procesamiento (si aplica)

Generalmente un worker en segundo plano procesa la cola automáticamente. TI puede forzar un procesamiento manual.

### Paso 2 — Revisar el outbox

El sistema registra mensajes pendientes y fallidos. TI revisa la cola para asegurarse de que todos los eventos se enviaron a Odoo.

---

## Flujo principal — Gestionar el mapa de productos

### Paso 1 — Listar productos mapeados

Consulta la tabla de correspondencia entre productos de FamSPI y productos de Odoo.

### Paso 2 — Crear o actualizar mapeo

Agrega o edita la relación entre:
- Producto FamSPI.
- Producto Odoo.
- SKU o identificador cruzado.

### Paso 3 — Generar reporte de cobertura

Consulta qué productos están mapeados y cuáles faltan por sincronizar.

---

## Flujos internos automáticos

- **Clientes**: cuando un cliente se crea o actualiza en FamSPI, el sistema puede sincronizarlo con Odoo automáticamente.
- **Casos externos**: los casos generados desde Odoo se traen a FamSPI a través de la cola de sincronización.

---

## Preguntas frecuentes

**[Un caso externo no aparece en FamSPI]**

Verifica que la sincronización esté activa y que el worker haya procesado la cola. Si el mensaje está en el outbox pendiente, puedes forzar el reprocesamiento.

**[Los productos no coinciden entre FamSPI y Odoo]**

Revisa el mapa de productos. Faltan mapeos o hay datos desactualizados en uno de los dos sistemas.

**[La integración está caída]**

Consulta el endpoint de health para ver el detalle del error. Revisa credenciales y conectividad de red con Odoo.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver el estado de la conexión | Consulta health (TI) |
| Forzar sincronización | Ejecuta procesamiento de cola |
| Mapear productos | Edita el mapa de productos |
| Ver clientes sincronizados | Revisa registros de sincronización |
