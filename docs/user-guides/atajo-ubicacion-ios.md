# Atajo de iPhone: enviar ubicación durante una salida operacional

Esta guía es para TI. Explica cómo dejar configurado en un iPhone el Atajo que envía la ubicación al SPI, y la automatización que lo ejecuta sola.

## Qué hace y qué no

- Envía la ubicación del iPhone al SPI a las horas que se configuren.
- El SPI **solo la guarda si la persona tiene una salida operacional activa**. Fuera de una salida, la descarta sin guardarla.
- Talento Humano y Gerencia General ven el último punto en **Asistencia Reportes > Mapa en vivo**. Nadie más tiene acceso.
- No rastrea de forma continua: hay un punto por cada vez que corre el Atajo.

## Antes de empezar

1. iPhone con iOS 16 o superior y la app **Atajos**.
2. En **Ajustes > Privacidad y seguridad > Localización > Atajos**: permitir **"Al usar la app"** y activar **Ubicación exacta**.
3. El **token de Atajos** de la persona. Lo genera TI en el SPI, en la página de tokens de Atajos. Dura 180 días y se puede revocar. Es el mismo token de los atajos de Siri de asistencia: si la persona ya tiene uno, sirve.

El token identifica a la persona. No se comparte ni se copia de un teléfono a otro.

## Parte 1: crear el Atajo (5 minutos)

En la app **Atajos**, pestaña **Atajos**, tocar **+** y agregar estas tres acciones en orden.

### Acción 1: Obtener ubicación actual

Buscar **"Obtener ubicación actual"** y agregarla. Tocar la flecha de la acción y dejar **Precisión: Óptima**.

### Acción 2: Obtener contenido de URL

Buscar **"Obtener contenido de URL"** y agregarla. Tocar la flecha para ver todas las opciones.

| Campo | Valor |
|---|---|
| URL | `https://spi-backend-983537733948.us-central1.run.app/api/v1/attendance/shortcut/location` |
| Método | `POST` |
| Encabezados | `Authorization` = `Bearer EL_TOKEN_DE_LA_PERSONA` |
| Cuerpo de la solicitud | `JSON` |

En el cuerpo, agregar dos campos de tipo **Texto**. La clave es solo la palabra indicada, en minúsculas y sin nada más:

| Clave (escribir exactamente esto) | Valor |
|---|---|
| `lat` | Variable **Ubicación actual**, y en ella elegir **Latitud** |
| `lng` | Variable **Ubicación actual**, y en ella elegir **Longitud** |

Si la clave lleva otra palabra (por ejemplo "campo lat"), el servidor responde `invalid_location`.

Para elegir Latitud: tocar el campo de valor, elegir la variable **Ubicación actual**, tocar la variable ya insertada y seleccionar **Latitud**. Igual con Longitud.

En el encabezado, entre `Bearer` y el token va un solo espacio.

### Acción 3: nombre

Tocar el nombre arriba y llamarlo **Enviar ubicación SPI**. No hace falta ninguna acción más.

## Parte 2: probar el Atajo

1. Pedir a la persona que tenga una **salida operacional activa**.
2. Tocar el Atajo. La primera vez iOS pregunta si permite usar la ubicación y conectarse al servidor: elegir **Permitir siempre**.
3. En **Asistencia Reportes > Mapa en vivo**, el punto de la persona debe mostrar **"Ubicación enviada por el Atajo"** con la hora actual.

Para ver qué respondió el servidor, agregar temporalmente la acción **"Mostrar resultado"** al final:

| Respuesta | Significado |
|---|---|
| `"tracking": true, "stored": true` | Guardado. |
| `"tracking": false, "reason": "no_active_exit"` | No hay salida operacional activa. Es lo normal fuera de una salida. Una salida recién iniciada tarda hasta 30 segundos en reconocerse. |
| `"stored": false, "reason": "too_soon"` | Ya se guardó un punto hace menos de 4 minutos. |
| `"reason": "invalid_location"` | No llegaron latitud y longitud. Revisar los campos del cuerpo. |
| `"code": "TOKEN_REVOKED"` o error 401/403 | Token revocado, vencido o mal copiado. Generar uno nuevo. |

Quitar "Mostrar resultado" al terminar; si no, aparecerá cada vez que corra.

## Parte 3: automatización para que corra solo

Los Atajos solo se disparan a horas fijas: **cada automatización es una hora**. No existe "cada 10 minutos". Se recomienda una por hora en horario laboral.

En **Atajos > Automatización > +**:

1. Elegir **Hora del día**.
2. Poner la hora (por ejemplo 08:00) y **Repetir: Diariamente**. Si el iPhone lo permite, elegir los días de lunes a sábado.
3. Elegir **Ejecutar inmediatamente** y desactivar **Notificar al ejecutar**.
4. En la acción, elegir **Ejecutar atajo** y seleccionar **Enviar ubicación SPI**.
5. Guardar.

Repetir para cada hora: 08:00, 09:00, 10:00 … 18:00 son 11 automatizaciones. Para cada 30 minutos son 21.

No programar horas de noche ni domingo: no hay salidas y cada envío es una llamada inútil al servidor.

## Límites que hay que conocer

- **Teléfono bloqueado.** No está confirmado que la automatización lea la ubicación con el iPhone bloqueado. **Probarlo en un teléfono real antes de configurar los demás**: dejar el iPhone bloqueado durante una hora programada y ver si el punto llega al mapa. Si no llega, el Atajo solo sirve con el teléfono desbloqueado o tocándolo a mano.
- **No se instala por MDM.** Las automatizaciones se crean a mano en cada iPhone. El Atajo sí se puede compartir por enlace, pero cada persona debe poner su propio token.
- **La persona puede desactivarlo.** Puede borrar la automatización o quitar el permiso de ubicación.
- **Frecuencia.** Un punto por hora o media hora. Para seguimiento más fino, ver la integración con ManageEngine en `docs/plans/ubicacion-salidas-operacionales-plan.md`.

## Alternativa sin automatización

La persona puede ejecutar el Atajo a mano o decir **"Oye Siri, Enviar ubicación SPI"** cuando llegue a un sitio. Es más fiable que la automatización, pero depende de que se acuerde.

## Privacidad

- El SPI solo guarda puntos durante una salida operacional activa.
- Los puntos se borran solos a los 30 días.
- Cada consulta del mapa queda registrada con el usuario que la hizo.
- Informar a cada persona, antes de configurar su teléfono, qué se envía y quién lo ve.

## Si un teléfono se pierde o la persona sale de la empresa

Revocar su token en la página de tokens de Atajos. Deja de funcionar de inmediato en la mayoría de los casos y en un máximo de 5 minutos en el resto.
