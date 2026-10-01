# Guía de uso — Gestión de Equipos

> **Para quién es esta guía:** Servicio técnico, jefe técnico, comercial y operaciones que administran equipos físicos como activos de la empresa.

---

## ¿Para qué sirve este módulo?

Este módulo es el registro central de todos los **equipos físicos** de la empresa. Separa el concepto de **modelo** (el tipo de equipo, sus especificaciones y procedimientos de mantenimiento) del **activo individual** (cada unidad física con su número de serie, estado y ubicación).

Sirve para:

- Tener un inventario actualizado de cada equipo instalado o disponible.
- Asignar equipos a clientes o proyectos.
- Programar mantenimientos automáticos según el modelo.
- Gestionar el catálogo de piezas y repuestos por modelo.
- Ver el historial completo de cada activo (eventos, reservas, instalaciones).

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Servicio técnico / técnico | Ver activos, consultar modelos, modificar estados |
| Jefe de servicio técnico | Acceso completo a modelos y activos |
| Comercial | Consultar modelos y disponibilidad para propuestas |
| Jefe comercial | Gestionar reservas de equipos para compras |
| Gerencia | Ver estado general del parque de equipos |
| Admin | Acceso completo |

---

## Pantalla principal

Las pantallas principales son:

- **Workspace de Equipos** (`/dashboard/equipos` y `/dashboard/equipos/activos`).
- **Workspace de Equipos en Servicio Técnico** (`/dashboard/servicio-tecnico/equipos`).

### ¿Qué muestra cada pantalla?

| Pantalla | Contenido principal |
|---|---|
| **Modelos** | Catálogo de tipos de equipo, con especificaciones, procedimientos de mantenimiento y piezas asociadas. |
| **Activos** | Lista de cada unidad física con su número de serie, estado y ubicación actual. |
| **Cronograma** | Calendario de mantenimientos preventivos generados automáticamente según el modelo. |
| **Historial** | Timeline de cada activo: reservas, instalaciones, cambios de estado, eventos. |

---

## ¿Qué significa cada estado de un activo?

| Estado | Qué significa |
|---|---|
| **Disponible** | El equipo está libre para asignar a un cliente o proyecto |
| **Reservado** | Está apartado para una compra pública, privada o business case |
| **Instalado** | Está operando en la ubicación de un cliente |
| **En mantenimiento** | Está en taller para revisión o reparación |
| **Dado de baja** | Ya no opera en la empresa |

---

## Flujo principal — Consultar el catálogo de modelos

### Paso 1 — Ingresar a "Modelos"

En el workspace de equipos, selecciona la sección **"Modelos"**.

### Paso 2 — Buscar un modelo

Usa el buscador para encontrar un tipo de equipo por nombre o código.

### Paso 3 — Ver el detalle del modelo

En la página del modelo verás:

- Especificaciones técnicas.
- Procedimientos de mantenimiento asociados.
- Lista de piezas y materiales que necesita.
- Cantidad de activos fabricados bajo ese modelo.
- Inventario disponible.

---

## Flujo principal — Consultar el inventario de activos

### Paso 1 — Ingresar a "Activos"

En el workspace de equipos, selecciona la sección **"Activos"**.

### Paso 2 — Filtrar por estado

Puedes filtrar activos por:

- **Disponibles**: para saber qué unidades puedes asignar.
- **Instalados**: para ver qué equipos están operando actualmente.
- **En mantenimiento**: para dar seguimiento a reparaciones.
- **Por ubicación**: filtrar por cliente, ciudad o área.

### Paso 3 — Abrir un activo específico

Toca el activo para ver su detalle:

- Número de serie.
- Estado actual.
- Ubicación y cliente asignado.
- Historial de eventos.

---

## Flujo principal — Reservar un activo

Cuando necesitas apartar un equipo para una compra pública, privada o un business case:

### Paso 1 — Seleccionar el activo

En la lista de activos disponibles, toca el equipo que necesitas.

### Paso 2 — Tocar "Reservar"

Indica el motivo de la reserva (tipo de compra, proyecto, cliente).

### Paso 3 — Confirmar

El estado del activo cambia a **"Reservado"** y queda apartado para ese destino.

---

## Flujo principal — Instalar un activo en cliente

Cuando un equipo está listo para operar en la sede de un cliente:

### Paso 1 — Seleccionar el activo

Toca el equipo que instalarás.

### Paso 2 — Tocar "Instalar"

Completa los datos:

- Cliente donde se instalará.
- Dirección o ubicación exacta.
- Fecha de instalación.
- Observaciones de la puesta en marcha.

### Paso 3 — Confirmar

El activo pasa a estado **"Instalado"**. El sistema genera automáticamente el cronograma de mantenimiento preventivo según el modelo del equipo.

---

## Flujo principal — Consultar el historial de un activo

### Paso 1 — Abrir el activo

Toca el equipo en la lista.

### Paso 2 — Ir a "Historial" o "Timeline"

Verás una línea de tiempo con cada evento:

- Fecha de creación del activo (cuando se registró en el sistema).
- Fechas de reserva.
- Fechas de instalación y cliente asignado.
- Cambios de estado.
- Mantenimientos realizados.
- Traslados o retiros.

---

## Flujo principal — Gestionar piezas y repuestos por modelo

### Paso 1 — Abrir el modelo del equipo

Ve al catálogo de modelos y toca el equipo que te interesa.

### Paso 2 — Ir a "Piezas" o "Insumos"

Verás el listado de piezas necesarias para su mantenimiento:

- Nombre de la pieza.
- Cantidad recomendada.
- Procedimiento en el que se usa.
- Material asociado.

### Paso 3 — Agregar o editar piezas

Puedes agregar nuevas piezas si el modelo requiere insumos adicionales.

---

## Preguntas frecuentes

**[No encuentro un modelo de equipo]**

Verifica que esté cargado en el catálogo. Si no existe, solicita a Servicio Técnico o TI que lo registre como nuevo modelo.

**[Un activo no aparece como disponible]**

Puede estar reservado, instalado o en mantenimiento. Usa los filtros para ver su estado actual.

**[Instalé un equipo pero no veo el cronograma de mantenimiento]**

El cronograma se genera automáticamente cuando el equipo pasa a estado "Instalado". Si no aparece, recarga la página o contacta a TI.

**[Reservé un equipo por error]**

Contacta a Servicio Técnico para cancelar la reserva y volver el equipo a estado "Disponible".

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver catálogo de modelos de equipo | Ve a "Modelos" en el workspace |
| Consultar inventario de activos | Ve a "Activos" |
| Reservar un equipo disponible | Toca el activo → "Reservar" |
| Instalar un equipo en cliente | Toca el activo → "Instalar" |
| Ver historial de un equipo | Abre el activo → "Historial" |
| Gestionar piezas de un modelo | Abre el modelo → "Piezas" |
