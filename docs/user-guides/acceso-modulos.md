# Guía de uso — Acceso a Módulos

> **Para quién es esta guía:** Jefes de TI y administradores de TI que gestionan qué módulos están disponibles para cada usuario o de forma global.

---

## ¿Para qué sirve este módulo?

Este módulo permite controlar qué áreas del sistema puede ver y usar cada colaborador. Aunque el rol define los permisos generales, este módulo añade una capa adicional de control: puedes habilitar, deshabilitar o restringir el acceso a módulos específicos por usuario o de forma global.

También sirve para activar o desactivar módulos completos en el sistema (por ejemplo, si una funcionalidad está en desarrollo o en mantenimiento, puedes ocultarla para todos hasta que esté lista).

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Jefe de TI | Ver catálogo de módulos, gestionar acceso de usuarios, modificar estado global de módulos |
| Admin TI | Ver catálogo de módulos, gestionar acceso de usuarios, modificar estado global de módulos |

> Solo roles de TI tienen acceso a este módulo. Otros perfiles no pueden modificarlo.

---

## Pantalla principal

La pantalla principal muestra dos vistas principales:

1. **Catálogo de módulos**: lista todos los módulos disponibles en el sistema y su estado actual (activo, inactivo, en desarrollo, etc.).
2. **Acceso por usuario**: para un usuario específico, muestra qué módulos puede ver y cuáles están bloqueados.

---

## Flujo principal — Consultar el catálogo de módulos

### Paso 1 — Ingresar al módulo

Ve al área de **TI** del sistema y busca la sección **"Acceso a módulos"** o **"Módulos"**.

### Paso 2 — Revisar el listado

Verás todos los módulos registrados en el sistema:

- Nombre del módulo.
- Estado actual (activo, inactivo, en prueba, etc.).
- Si tiene restricciones de correo electrónico (whitelist).

### Paso 3 — Filtrar o buscar

Usa el buscador para encontrar un módulo específico por nombre.

---

## Flujo principal — Cambiar el estado de un módulo globalmente

### Paso 1 — Seleccionar el módulo

Busca el módulo que quieres modificar en el catálogo.

### Paso 2 — Editar el estado

Toca el ícono de editar o el botón **"Configurar"** junto al módulo. Podrás cambiar:

- **Etapa o estado**: activo, inactivo, en desarrollo, etc.
- **Correos permitidos (whitelist)**: si el módulo solo debe estar disponible para ciertos dominios o correos específicos.

### Paso 3 — Guardar cambios

Toca **"Guardar"** o **"Actualizar"**. El cambio aplica de inmediato para todos los usuarios.

> **Precaución:** Si desactivas un módulo globalmente, ningún usuario podrá acceder a él hasta que lo vuelvas a activar.

---

## Flujo principal — Gestionar acceso de un usuario específico

### Paso 1 — Buscar al usuario

En la sección de acceso por usuario, escribe el nombre o ID del colaborador.

### Paso 2 — Revisar sus módulos disponibles

El sistema muestra una lista de todos los módulos con su estado para ese usuario:

- Módulos que sí puede ver.
- Módulos bloqueados o restringidos.

### Paso 3 — Modificar el acceso

Para habilitar o deshabilitar un módulo para ese usuario:

1. Toca el ícono de editar junto al módulo.
2. Cambia el estado:
   - **Habilitado**: el usuario puede acceder.
   - **Deshabilitado**: el usuario no lo ve en el menú.
3. Guarda los cambios.

### Resultado

El usuario verá u ocultará el módulo en su menú la próxima vez que inicie sesión.

---

## Flujo principal — Asignar módulos a un usuario nuevo

Cuando creas un usuario nuevo, puedes asegurarte de que tenga acceso inmediato a los módulos de su rol:

### Paso 1 — Crear o buscar el usuario

En la sección de acceso por usuario, busca la cuenta recién creada.

### Paso 2 — Verificar módulos por defecto

El sistema asigna automáticamente los módulos según el rol del usuario. Revisa que estén todos los necesarios.

### Paso 3 — Agregar módulos extra si aplica

Si el usuario necesita acceso a un área fuera de su rol estándar (por ejemplo, un comercial que debe revisar también tickets de soporte), habilita el módulo adicional manualmente.

---

## Preguntas frecuentes

**[Un usuario no ve un módulo que debería ver]**

Verifica dos cosas:
1. Que su rol tenga acceso a ese módulo (consulta el catálogo de roles).
2. Que no esté bloqueado individualmente en la configuración de acceso del usuario.

Si ambas están bien, contacta a TI para revisar la caché o la sesión del usuario.

**[Desactivé un módulo por error]**

Actívalo de nuevo desde la sección de estado global. El acceso se restaura de inmediato para todos los usuarios.

**[Puedo ocultar un módulo solo para una persona]**

Sí. Usa la gestión de acceso por usuario para deshabilitar el módulo específicamente para esa persona, sin afectar a los demás.

**[Hay módulos que no aparecen en el catálogo]**

Si un módulo no está registrado en el sistema, no aparecerá en esta lista. En ese caso, contacta a desarrollo para que lo agregue al catálogo.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver todos los módulos disponibles | Ve a "Acceso a módulos" → catálogo |
| Activar o desactivar un módulo para todos | Selecciona el módulo → editar estado global |
| Quitar un módulo a un usuario específico | Busca el usuario → deshabilita el módulo |
| Dar acceso extra a un usuario | Busca el usuario → habilita el módulo adicional |
