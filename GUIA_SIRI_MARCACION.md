# Guía: Marcación por voz con Siri (iPhone Shortcuts)

Permite decir **"Oye Siri, marcar asistencia"** o **"Oye Siri, salida operacional"** y que FamSPI resuelva la marcación correcta según el estado real del día.

## 1. Obtener el token de shortcut (una sola vez)

**Opción A — TI genera el token por ti (recomendado):**

1. Un usuario con rol `ti` o `jefe_ti` entra a **FamSPI → Dashboard TI → Token Shortcut Siri** (`/dashboard/ti/shortcut-token`).
2. Busca y selecciona el colaborador en el listado.
3. Pulsa **Generar token** y copia el valor mostrado.
4. Entrega ese token al colaborador para pegarlo en el shortcut (paso 2 más abajo).

**Opción B — autoservicio (el propio usuario):**

1. Inicia sesión en FamSPI web.
2. Con la sesión activa, llama a:
   ```
   POST https://<backend>/api/v1/attendance/shortcut/token
   Authorization: Bearer <access token actual>
   ```
3. Guarda el `token` de la respuesta.

En ambos casos el token dura 6 meses (`SHORTCUT_TOKEN_EXPIRES_IN`, default `180d`). Al expirar, repetir el paso.

**Revocar un token puntual:** en la misma página **Token Shortcut Siri**, al seleccionar un usuario se listan todos sus tokens emitidos (activo/expirado/revocado) con botón **Revocar**. Revocar invalida solo ese token de inmediato — no afecta la sesión web normal del usuario ni otros tokens que tenga.

## 2. Crear el shortcut "Marcar asistencia"

En la app **Atajos** del iPhone:

1. **Obtener ubicación actual** (acción "Get Current Location").
2. **Obtener contenido de URL** ("Get Contents of URL"):
   - URL: `https://<backend>/api/v1/attendance/shortcut/run-smart-mark`
   - Método: `POST`
   - Headers: `Authorization: Bearer <token del paso 1>`
   - Cuerpo (JSON):
     ```json
     {
       "intent": "smart_attendance",
       "location": "<Latitud>,<Longitud>"
     }
     ```
     (usa las variables de la acción de ubicación para lat/lng)
3. **Obtener valor del diccionario** → `spoken_message`.
4. **Leer texto en voz alta** ("Speak Text") con ese valor.
5. **Si** `requires_follow_up` es `true`:
   - **Dictar texto** ("Dictate Text") para capturar la respuesta hablada.
   - Repetir la llamada del paso 2 agregando al JSON:
     ```json
     { "spoken_input": "<dictado>", "continuation_token": "<continuation_token de la respuesta anterior>" }
     ```
   - Volver a leer `spoken_message`. (Repetir mientras `requires_follow_up` sea `true`.)
6. **Si** `requires_ui` es `true`: **Abrir URL** con el valor de `open_url` (abre FamSPI en el paso exacto: foto de kilometraje, selección de cronograma, etc.).
7. Nómbralo **"Marcar asistencia"** → Siri lo activa por ese nombre.

## 3. Crear el shortcut "Salida operacional"

Duplica el anterior y cambia solo el body inicial:

```json
{ "intent": "operational_exit", "location": "<Latitud>,<Longitud>" }
```

Siri preguntará categoría (cliente, reunión, banco, proveedor, otra gestión), tipo de visita (cronograma, prospecto, emergencia), nombre del prospecto y vehículo personal, según haga falta.

## 4. Qué resuelve por voz y qué abre la app

| Caso | Resultado |
|------|-----------|
| Entrada, almuerzo (salida/retorno), salida final | Directo por voz |
| Permiso (inicio/fin) | Directo por voz |
| Llegada a destino, cierre operacional sin vehículo | Directo por voz |
| Salida operacional simple (banco, reunión, etc.) | Conversación corta por voz |
| Prospecto con nombre dictado | Conversación corta por voz |
| Cronograma, emergencia, vehículo personal (km + foto), visita a cliente abierta | Siri avisa y abre FamSPI en el paso exacto |

## 5. Notas

- La conversación expira a los 10 minutos; si expira, Siri pide empezar de nuevo.
- El endpoint responde siempre HTTP 200 con `spoken_message` hablable; solo la autenticación inválida devuelve 401 (agrega un "Si" sobre el código de estado si quieres un mensaje de error hablado también en ese caso).
- Sin GPS el backend rechaza la marcación y Siri lo dice ("No pude obtener tu ubicación...").
- Doble invocación rápida: protegida por rate limit (10/min por usuario) y por los guards existentes de doble marcación.
