# Atajo de iPhone: enviar ubicación durante una salida operacional

Esta guía es para TI. Explica cómo crear el Atajo que envía la ubicación al SPI y cómo dejarlo corriendo solo, únicamente mientras la persona tiene una salida operacional activa.

## Qué hace y qué no

- Envía la ubicación del iPhone al SPI.
- El SPI **solo la guarda si la persona tiene una salida operacional activa**. Fuera de una salida la descarta.
- Durante una salida, el Atajo se vuelve a ejecutar solo cada 10 minutos. Al cerrar la salida, se detiene solo.
- Talento Humano y Gerencia General ven el último punto en **Asistencia Reportes > Mapa en vivo**. Nadie más tiene acceso.

## Cómo se repite solo

iOS no tiene una automatización "cada 10 minutos". Se consigue con un modo de concentración usado como temporizador:

1. El Atajo envía la ubicación y el servidor responde cuántos minutos faltan para el siguiente envío (`next_ping_minutes`): 10 si hay salida activa, 0 si no.
2. Si es mayor que 0, el Atajo activa el modo de concentración **SPI Ubicación** hasta dentro de esos minutos.
3. Cuando el modo se apaga solo, una automatización vuelve a ejecutar el Atajo.
4. Si el servidor responde 0 (no hay salida, o se cerró), el Atajo no activa el modo y el ciclo termina.

El ícono del modo de concentración en la barra superior sirve además de aviso visible de que la ubicación se está compartiendo.

## Antes de empezar

1. iPhone con iOS 16 o superior y la app **Atajos**.
2. En **Ajustes > Privacidad y seguridad > Localización > Atajos**: permitir **"Al usar la app"** y activar **Ubicación exacta**.
3. El **token de Atajos** de la persona, generado en el SPI. Dura 180 días y se puede revocar. **El token identifica a la persona**: con el token de otro, el servidor busca la salida de ese otro.
4. El backend desplegado con la versión que devuelve `next_ping_minutes`. Sin eso el Atajo envía la ubicación, pero no se repite solo.

## Parte 1: crear el modo de concentración

En **Ajustes > Concentración > + > Personalizado**:

1. Nombre: **SPI Ubicación**.
2. En **Personas** y **Apps**, elegir **Permitir notificaciones de: Todos / Todas**. Este modo no debe silenciar nada; solo se usa como temporizador.
3. No configurar pantallas, filtros ni horarios.
4. En **Ajustes > Concentración**, desactivar **Compartir entre dispositivos**, para que no se encienda en el iPad o Mac de la persona.

## Parte 2: crear el Atajo

En **Atajos**, tocar **+** y agregar las acciones en este orden.

**1. Texto**
Pegar el token de la persona.

**2. Obtener ubicación actual**
Precisión: **Óptima**.

**3. Obtener contenido de URL**

| Campo | Valor |
|---|---|
| URL | `https://spi-backend-983537733948.us-central1.run.app/api/v1/attendance/shortcut/location` |
| Método | `POST` |
| Encabezado `Authorization` | escribir `Bearer ` (con un espacio al final) e insertar la variable **Texto** |
| Cuerpo de la solicitud | `JSON` |

En el cuerpo, dos campos de tipo **Texto**. La clave es solo la palabra indicada, en minúsculas y sin nada más:

| Clave (escribir exactamente esto) | Valor |
|---|---|
| `lat` | variable **Ubicación actual** → **Latitud** |
| `lng` | variable **Ubicación actual** → **Longitud** |

Si la clave lleva otra palabra (por ejemplo "campo lat"), el servidor responde `invalid_location`.

**4. Obtener valor del diccionario**
Obtener **Valor** para la clave `next_ping_minutes` en **Contenido de URL**.

**5. Si**
Condición: **Valor del diccionario** **es mayor que** `0`.

Dentro del **Si** (antes de "De lo contrario"):

- **Ajustar fecha**: **Sumar** → variable **Valor del diccionario** → **minutos** a **Fecha actual**.
- **Establecer modo de concentración**: **Activar** **SPI Ubicación** **hasta** **Hora** → variable **Fecha ajustada**.

Dejar vacío "De lo contrario".

**6. Nombre**
Llamarlo **Enviar ubicación SPI**.

## Parte 3: automatizaciones

En **Atajos > Automatización > +**. En todas: elegir **Ejecutar inmediatamente** y desactivar **Notificar al ejecutar**.

**A. La que repite el ciclo (obligatoria)**

1. Disparador: **Concentración** → **SPI Ubicación** → **Al desactivar**.
2. Acción: **Ejecutar atajo** → **Enviar ubicación SPI**.

**B. Las que inician el ciclo**

El ciclo empieza cuando el Atajo corre una vez con una salida activa. Para que arranque sin que la persona haga nada, crear automatizaciones de **Hora del día** que ejecuten el mismo Atajo. Con una cada hora en horario laboral (08:00 a 18:00) la ubicación empieza a enviarse como mucho una hora después de iniciar la salida.

Si la persona quiere que empiece de inmediato, puede tocar el Atajo o decir **"Oye Siri, Enviar ubicación SPI"** justo después de marcar la salida.

No programar horas de noche ni domingo.

## Parte 4: probar

1. Iniciar una salida operacional y esperar 30 segundos.
2. Ejecutar el Atajo. Debe encenderse el modo **SPI Ubicación** (ícono en la barra superior).
3. Esperar 10 minutos sin tocar el teléfono. El modo se apaga y se vuelve a encender solo; en el mapa del SPI la hora del punto se actualiza.
4. Cerrar la salida. En el siguiente ciclo el modo se apaga y ya no vuelve a encenderse.
5. **Repetir el paso 3 con el iPhone bloqueado.** No está confirmado que iOS lea la ubicación con el teléfono bloqueado; si el punto no se actualiza, el ciclo solo funciona con el teléfono en uso.

Para ver la respuesta del servidor, agregar temporalmente **Mostrar resultado** después de la acción 3:

| Respuesta | Significado |
|---|---|
| `"tracking": true, "stored": true` | Guardado. |
| `"tracking": true, "reason": "too_soon"` | La salida está reconocida, pero ya hay un punto de hace menos de 4 minutos. Normal al probar varias veces seguidas. |
| `"tracking": false, "reason": "no_active_exit"` | No hay salida operacional activa. Una salida recién iniciada tarda hasta 30 segundos en reconocerse. |
| `"reason": "invalid_location"` | No llegaron latitud y longitud. Revisar las claves `lat` y `lng`. |
| Error 401 o `TOKEN_REVOKED` | Token revocado, vencido o mal copiado. |

Quitar "Mostrar resultado" al terminar.

## Compartir el Atajo a otras personas

1. En el Atajo: **Configuración > Preguntas de importación** → agregar una pregunta sobre la acción **Texto**: "Pega tu token del SPI".
2. **Compartir > Copiar enlace de iCloud** y enviar el enlace.

Cada persona toca **Añadir atajo** y pega su propio token. El modo de concentración (parte 1) y las automatizaciones (parte 3) no viajan con el enlace: se crean en cada iPhone.

## Límites que hay que conocer

- **Teléfono bloqueado.** Sin confirmar; ver el paso 5 de la prueba.
- **Si un envío falla** (sin señal, por ejemplo), el ciclo se corta. Lo reinicia la siguiente automatización de hora, o la persona tocando el Atajo.
- **No se instala por MDM.** El modo de concentración y las automatizaciones se crean a mano en cada iPhone.
- **La persona puede desactivarlo.** Puede apagar el modo, borrar la automatización o quitar el permiso de ubicación.
- **La frecuencia la decide el servidor** (10 minutos por defecto). Se cambia en el backend, no en cada teléfono.

## Privacidad

- El SPI solo guarda puntos durante una salida operacional activa y como máximo uno cada 4 minutos por persona.
- Los puntos se borran solos a los 30 días.
- Cada consulta del mapa queda registrada con el usuario que la hizo.
- Informar a cada persona, antes de configurar su teléfono, qué se envía y quién lo ve.

## Si un teléfono se pierde o la persona sale de la empresa

Revocar su token en la página de tokens de Atajos. Deja de funcionar de inmediato en la mayoría de los casos y en un máximo de 5 minutos en el resto.
