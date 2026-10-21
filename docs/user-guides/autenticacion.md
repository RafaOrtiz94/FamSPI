# Guía de uso — Autenticación

> **Para quién es esta guía:** Todos los colaboradores de la empresa que necesitan ingresar al sistema, y personal de TI o gerencia que revisa sesiones activas.

---

## ¿Para qué sirve este módulo?

Este módulo controla quién puede entrar al sistema y cuándo. Funciona con la cuenta de Google de la empresa: no necesitas crear una contraseña nueva. Cuando entras, el sistema te entrega dos llaves digitales (tokens) que te permiten navegar por las distintas áreas sin tener que volver a identificarte.

Además, este módulo registra cada vez que entras, cuándo se vencen tus llaves y te permite cerrar tu sesión cuando te desconectas del todo.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Cualquier colaborador con cuenta Google de la empresa | Iniciar sesión, ver sus propios datos, cerrar sesión, aceptar aviso de privacidad |
| TI / jefe de TI | Ver todas las sesiones activas del sistema |
| Gerencia general | Ver todas las sesiones activas del sistema |

---

## Pantalla principal

Al ingresar a la URL del sistema sin estar registrado, verás la pantalla de **"Portal Corporativo"**:

- Un campo grande con el logo de FamProject en el centro.
- El título **"Portal Corporativo"** y el subtítulo **"Sistema Interno — Departamento de TI"**.
- Un botón para ingresar con tu cuenta de Google.
- Un formulario alternativo (solo para pruebas) donde puedes escribir correo y clave.

### ¿Qué significa cada estado?

| Lo que ves | Qué significa |
|---|---|
| Pantalla de login normal | Todo está bien, puedes ingresar |
| Mensaje "Acceso denegado. Utiliza una cuenta corporativa FamProject" | Estás usando un correo externo; solo se aceptan cuentas de la empresa |
| Mensaje "Error: no se recibieron credenciales" | Falló la comunicación con Google; reintenta |
| Mensaje "Tu sesión no tiene habilitada la renovación automática" | Tu token de refresco expiró; debes volver a entrar desde cero |
| Icono giratorio (loading) | El sistema está validando tu identidad |

---

## Flujo principal — Ingresar al sistema

### Paso 1 — Abrir la página de ingreso

Abre el sistema en tu navegador. Si no tienes sesión activa, automáticamente verás la pantalla de login.

### Paso 2 — Tocar el botón de Google

Busca el botón que dice algo como **"Ingresar con Google"** y tócalo.

El sistema te llevará a la página de Google para que elijas la cuenta de tu empresa.

### Paso 3 — Confirmar tu identidad

Cuando Google te muestra tu correo, confirma que es correcto. Si usas cuentas múltiples, asegúrate de seleccionar la de `@fam-project.com`.

### Paso 4 — Esperar la redirección automática

Google te devuelve automáticamente al sistema. Verás una pantalla de carga breve. El sistema guarda tus llaves digitales en tu navegador y te envía a tu panel principal según tu rol.

Si tu rol no ha sido asignado aún, verás una pantalla que dice **"Registro en proceso"**.

---

## Flujo principal — Salir del sistema

### Paso 1 — Cerrar sesión

Desde cualquier pantalla del sistema, busca la opción **"Cerrar sesión"** o **"Salir"** (generalmente en el menú de tu perfil).

### Paso 2 — Confirmar

El sistema cierra tu sesión registrada en la base de datos. A partir de ese momento, tus llaves digitales ya no sirven y debes volver a identificarte para ingresar.

---

## Flujo principal — Aceptar el aviso de privacidad (LOPDP)

La primera vez que ingresas, o cuando se renueva el consentimiento, verás un aviso sobre protección de datos personales.

1. Lee el texto del aviso.
2. Toca **"Aceptar"** o **"Acepto"**.
3. El sistema registra tu aceptación y actualiza tu perfil.

---

## Preguntas frecuentes

**[Me equivoqué de cuenta y entré con otra]**

No te preocupes. Simplemente cierra sesión y vuelve a entrar eligiendo la cuenta correcta de Google.

**[No veo el panel de mi área después de entrar]**

Significa que tu rol todavía no ha sido configurado. Contacta a Talento Humano para que asignen tu rol en el sistema.

**[El sistema se cuelga en la pantalla de carga de Google]**

Actualiza la página o intenta abrir el sistema en otra pestaña. Si el problema persiste, avisa a TI.

**[Olvidé cerrar sesión en el equipo de otra persona]**

No hay problema. Cualquier sesión abierta expira automáticamente después de un tiempo sin actividad. Si necesitas cerrar todas tus sesiones activas de inmediato, contacta a TI.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ingresar por primera vez | Abre el sistema y toca el botón de Google |
| Entrar desde un equipo prestado | Usa tu cuenta Google de la empresa |
| Ver quién tiene sesión abierta | Pide a TI que consulte las sesiones activas |
| Cerrar tu sesión | Toca "Salir" o "Cerrar sesión" |
| Aceptar privacidad de datos | Toca "Aceptar" en el aviso LOPDP cuando aparezca |
