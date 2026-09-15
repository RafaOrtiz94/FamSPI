# Guía de uso — Departamentos

> **Para quién es esta guía:** Personal de Talento Humano, gerencia y TI que administra la estructura organizacional de la empresa.

---

## ¿Para qué sirve este módulo?

Este módulo organiza la empresa por áreas y equipos. Cada departamento representa una unidad del negocio (como Comercial, Servicio Técnico, Finanzas, etc.) y sirve para clasificar a las personas dentro del sistema. Gracias a esto, el sistema sabe a qué área pertenece cada colaborador y puede mostrar información filtrada por departamento.

Además, los departamentos alimentan otros módulos: los reportes de asistencia, las solicitudes de personal y los permisos usan esta clasificación.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Talento Humano / jefe de TH | Ver, crear, editar, activar y desactivar departamentos |
| Gerencia | Ver y crear departamentos |
| TI / jefe de TI | Ver, crear, editar y eliminar departamentos |
| Admin / administrador | Acceso completo |
| Finanzas, comercial y otros roles | Solo ver la lista de departamentos |

---

## Pantalla principal

La pantalla se encuentra en la sección **"Usuarios y Departamentos"** dentro del área de **Talento Humano**.

Verás una tabla con todos los departamentos registrados, cada uno con su **nombre** y **código**. Cada fila tiene un indicador de color que muestra si está disponible o no:

- **Verde + "Activo"**: El departamento está disponible para asignar colaboradores.
- **Gris + "Inactivo"**: El departamento no acepta nuevas asignaciones.

### ¿Qué significa cada estado?

| Lo que ves | Qué significa |
|---|---|
| Activo | Puedes asignar personas a este departamento sin problema |
| Inactivo | El departamento sigue existiendo para conservar su historial, pero no se lo puede asignar a nadie nuevo |

---

## Flujo principal — Crear un nuevo departamento

### Paso 1 — Tocar el botón "Nuevo departamento"

Busca el botón con el signo **"+"** o el texto **"Nuevo"** en la parte superior de la lista.

### Paso 2 — Completar los datos

Se abrirá un formulario con tres campos:

1. **Nombre del departamento**: escribe cómo se llamará (ejemplo: "Calidad").
2. **Código**: escribe una abreviatura (ejemplo: "CAL"). Sirve para identificar el área rápido en reportes.
3. **Descripción**: escribe brevemente qué hace ese área (opcional pero recomendado).

### Paso 3 — Guardar

Toca **"Guardar"** o **"Crear"**. El sistema agrega el departamento a la tabla y queda activo automáticamente para asignaciones.

---

## Flujo principal — Editar un departamento

### Paso 1 — Seleccionar el departamento

Busca el departamento en la tabla y toca el ícono de **editar** (generalmente un lápiz).

### Paso 2 — Modificar los datos

Cambia el nombre, código o descripción. No puedes modificar el código de un departamento si ya tiene personas asignadas y registros históricos asociados.

### Paso 3 — Guardar cambios

Toca **"Guardar"**. Los cambios se aplican de inmediato.

---

## Flujo principal — Desactivar un departamento

Si un área se fusiona o deja de operar, no la elimines de inmediato: desactívala.

### Paso 1 — Tocar la opción "Desactivar"

Busca el ícono de **desactivar** (generalmente un círculo con equis o "X") en la fila del departamento.

### Paso 2 — Confirmar

El sistema te mostrará un mensaje de confirmación: *"El departamento dejará de estar disponible para nuevas asignaciones, pero conservará trazabilidad histórica"*. Si estás seguro, toca **"Desactivar departamento"**.

### Resultado

El departamento pasa a estado **Inactivo** y no se podrá asignar a nuevas personas.

---

## Flujo principal — Reactivar un departamento

Si reactivas el área:

### Paso 1 — Tocar la opción "Reactivar"

Busca el departamento inactivo y toca el ícono correspondiente.

### Paso 2 — Confirmar

Verás el mensaje: *"El departamento volverá a quedar disponible para asignaciones internas"*. Toca **"Reactivar departamento"**.

---

## Flujo principal — Buscar y filtrar departamentos

En la parte superior de la tabla encontrarás:

- Un **campo de búsqueda**: escribe el nombre o código del departamento y la lista se filtra automáticamente.
- Un **filtro de estado**: elige entre **"Todos"**, **"Activo"** o **"Inactivo"** para ver solo los que necesites.

---

## Flujo principal — Eliminar un departamento

Solo los roles con permiso de eliminación pueden hacerlo.

### Consideración importante

No puedes eliminar un departamento que tiene personas asignadas o registros históricos. Primero debes:

1. Reasignar esos colaboradores a otro departamento.
2. Esperar a que ya no dependan de este área.
3. Luego eliminar.

Si el sistema lo bloquea, desactívalo en su lugar.

---

## Preguntas frecuentes

**[Creé un departamento con nombre repetido]**

El sistema no muestra un mensaje de error específico, pero genera un registro duplicado. Revisa la lista antes de crear y usa el buscador para confirmar.

**[Desactivé un departamento por error]**

Puedes reactivarlo cuando quieras; el historial se conserva intacto.

**[No veo la opción de editar]**

Solo pueden editar departamentos las personas con rol de Talento Humano, TI o gerencia. Si crees que deberías tener acceso, solicita a TI que revisen tu rol.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Agregar una nueva área | Toca "+" y completa nombre, código y descripción |
| Cambiar el nombre de un área | Toca el lápiz junto al departamento |
| Suspender un área | Toca "Desactivar" y confirma |
| Reabrir un área | Toca "Reactivar" y confirma |
| Buscar un área | Escribe en el campo de búsqueda superior |
| Eliminar un área permanentemente | Primero desasigna todas las personas, luego elimina |
