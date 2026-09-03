# Guía de uso — Correo Gmail Integral

> **Para quién es esta guía:** Colaboradores que necesitan enviar correos desde el sistema usando su propia cuenta de Gmail.

---

## ¿Para qué sirve este módulo?

Este módulo integra tu cuenta de Gmail personal con el sistema. Gracias a esto, el sistema puede enviar correos en tu nombre cuando lo necesite (por ejemplo, notificaciones, recordatorios, compartir documentos), sin que tengas que abrir tu correo manualmente.

La integración es por **cuenta individual**: cada usuario autoriza su propio Gmail y puede revocar el acceso cuando quiera.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Cualquier usuario autenticado | Autorizar su Gmail, enviar correos desde el sistema, revocar acceso |

> No hay restricciones de rol: cualquier persona con cuenta en el sistema puede vincular su Gmail.

---

## Pantalla principal

La mayoría de los usuarios no interactúan con este módulo directamente a través de una pantalla. El sistema muestra la integración activa generalmente en:

- Configuración de perfil o preferencias.
- En el momento de enviar un correo desde otro módulo.
- En las notificaciones que requieren envío por correo.

Si necesitas autorizar, modificar o revocar el acceso, debes seguir el flujo de autorización.

---

## Flujo principal — Autorizar tu cuenta de Gmail

### Paso 1 — Iniciar la autorización

Cuando el sistema te lo solicite (por ejemplo, para enviar un correo automáticamente), busca el botón **"Autorizar Gmail"** o **"Conectar con Google"**.

### Paso 2 — Aceptar en Google

El sistema te redirige a la página de Google. Allí:

1. Selecciona la cuenta de Gmail que quieres vincular.
2. Revisa los permisos que solicita el sistema.
3. Toca **"Permitir"** o **"Allow"**.

### Paso 3 — Confirmación

Google te devuelve al sistema con un código de confirmación. El sistema almacena tus token de acceso de forma segura.

### Resultado

A partir de ahora, el sistema puede enviar correos usando tu dirección de Gmail, con tu nombre y tu foto de perfil como remitente.

---

## Flujo principal — Revisar el estado de la conexión

### Paso 1 — Consultar el estado

Si el sistema muestra el estado de la integración, puedes ver si tu Gmail está:

- **Conectado**: la autorización está activa.
- **Pendiente**: necesitas completar la autorización.
- **Expirada**: los token vencieron y debes volver a autorizar.

### Paso 2 — Reautorizar si es necesario

Si el estado es "Expirado", repite el flujo de autorización desde el principio.

---

## Flujo principal — Revocar el acceso

Si ya no quieres que el sistema use tu Gmail:

### Paso 1 — Buscar la opción de revocar

En la configuración de integración o Gmail, toca **"Revocar acceso"**, **"Desconectar"** o **"Quitar acceso"**.

### Paso 2 — Confirmar

Confirma la acción. El sistema elimina tus token almacenados.

### Resultado

El sistema ya no podrá enviar correos desde tu cuenta. Los correos que se enviaron antes siguen en tu historial de Gmail normalmente.

---

## Flujo principal — Enviar un correo desde el sistema (uso interno)

Muchas veces no envías correos manualmente; el sistema lo hace por ti cuando:

- Se aprueba una solicitud y debe notificar al interesado.
- Se genera un documento para firma y debe notificar al firmante.
- Se completa un flujo y debe avisar al jefe.

En esos casos, el sistema usa tu Gmail autorizado (o el de la persona configurada) para enviar el correo sin que tengas que hacer nada adicional.

---

## Preguntas frecuentes

**[El sistema dice que no tengo Gmail autorizado]**

Inicia el flujo de autorización nuevamente. Asegúrate de elegir la cuenta correcta y permitir todos los permisos que Google solicite.

**[Autorizé pero el correo no se envió]**

Puede tardar unos segundos en sincronizar. Si el problema persiste, intenta revocar y volver a autorizar. Si sigue fallando, avisa a TI.

**[Quiero usar una cuenta de Gmail diferente]**

Primero revoca el acceso de la cuenta actual, luego autoriza la nueva. El sistema no permite tener dos cuentas vinculadas a la vez.

**[No quiero que el sistema envíe correos por mí]**

Puedes revocar el acceso en cualquier momento. Ten en cuenta que algunos flujos del sistema dependen del envío de correos para funcionar; sin Gmail autorizado, es posible que no recibas notificaciones por correo.

**[Google me muestra una advertencia de seguridad]**

Es normal: el sistema solicita permisos para enviar correos en tu nombre. Si ves la app de FamSPI solicitando acceso, es el funcionamiento esperado.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Conectar tu Gmail al sistema | Busca "Autorizar Gmail" y sigue los pasos de Google |
| Ver si está conectado | Consulta el estado de la integración en tu perfil |
| Cambiar de cuenta | Revoca la actual y autoriza la nueva |
| Desconectar tu Gmail | Toca "Revocar acceso" y confirma |
