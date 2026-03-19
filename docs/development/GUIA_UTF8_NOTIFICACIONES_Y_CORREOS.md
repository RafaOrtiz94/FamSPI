# Guia UTF-8 para Notificaciones y Correos

## Objetivo
Evitar que textos visibles al usuario lleguen con caracteres corruptos como `aprobaci?n`, `revisi?n`, `PAGINA` rota o variantes similares en:

- notificaciones internas
- correos del sistema
- scripts de mantenimiento
- jobs internos
- cargas de datos manuales

## Regla base
Todo texto visible al usuario debe tratarse como UTF-8 de extremo a extremo.

Esto incluye:

- archivos fuente `.js`, `.jsx`, `.md`, `.json`
- cadenas persistidas en base de datos
- subjects y headers de correo
- cuerpos HTML de correo
- scripts ejecutados por consola

## Reglas obligatorias

### 1. Guardar archivos en UTF-8
- Guardar siempre los archivos fuente en `UTF-8`.
- No usar ANSI ni codificaciones locales del editor.
- Si el editor permite elegir, usar `UTF-8` o `UTF-8 without BOM`.

### 2. No confiar en la consola para caracteres acentuados
Los scripts ejecutados desde PowerShell o CMD pueden introducir mojibake al copiar texto con tildes.
Tambien pueden mostrar bien un archivo roto o mostrar roto un archivo correcto por problemas de codepage.

Cuando un script:

- inserte notificaciones
- actualice textos en BD
- genere correos de prueba
- haga backfills

usar preferentemente escapes Unicode explicitos:

```js
const title = "Solicitud pendiente de aprobaci\u00F3n";
const message = "Requiere revisi\u00F3n y decisi\u00F3n.";
```

### 2.1 Verificar por contenido real, no por salida de terminal
Cuando haya dudas, validar el archivo leyendo codepoints reales desde disco.

Senales tipicas de mojibake:

- `U+00C3`
- `U+00C2`
- `U+0192`
- `U+FFFD`

Ejemplo de verificacion en PowerShell:

```powershell
$bad = @([char]0x00C3, [char]0x00C2, [char]0x0192, [char]0xFFFD)
$lines = [IO.File]::ReadAllLines("ruta\\archivo.jsx")
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($bad | Where-Object { $lines[$i].Contains($_) }) {
    "{0}:{1}" -f ($i + 1), $lines[$i]
  }
}
```

Si el archivo no contiene esos codepoints y las tildes aparecen correctas al inspeccionar los valores reales, no usar la salida de consola como unica fuente de verdad.

### 3. No concatenar encabezados de correo sin codificacion
Los headers con texto visible deben ir codificados en UTF-8.

Aplicar siempre:

- codificacion MIME para `Subject`
- codificacion MIME para nombres visibles en `From` y `Reply-To`

Esto ya se maneja en:

- `backend/src/utils/mailer.js`

No duplicar implementaciones paralelas.

### 4. El cuerpo HTML del correo debe declarar charset
Todo HTML de correo debe incluir:

```html
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
```

Esto ya se maneja en:

- `backend/src/modules/notifications/notificationManager.js`

### 5. Normalizar texto antes de persistir o enviar
Para titulos, mensajes y subjects usar normalizacion de texto humano:

- `normalizeHumanText(...)`

Ubicacion:

- `backend/src/utils/textEncoding.js`

Uso obligatorio en:

- notificaciones
- correos
- subjects
- titulos visibles

### 6. No insertar mojibake manualmente en SQL o scripts
Queda prohibido insertar textos visibles con secuencias como:

- `Ã¡`
- `Ã©`
- `Ã±`
- `Â¿`
- `â€™`

Si una cadena ya viene danada, normalizarla antes de guardar o enviar.

## Implementacion actual

La correccion actual ya quedo aplicada en:

- `backend/src/utils/textEncoding.js`
- `backend/src/utils/mailer.js`
- `backend/src/modules/notifications/notificationManager.js`

## Checklist para futuras implementaciones

Antes de subir cualquier cambio que envie texto por correo o notificaciones:

1. Confirmar que el archivo esta en UTF-8.
2. Si el texto se ejecutara desde script o consola, usar escapes Unicode.
3. Pasar titulos y mensajes por `normalizeHumanText(...)`.
4. No construir manualmente headers de correo fuera de `mailer.js`.
5. Si se genera HTML, incluir `meta charset="utf-8"`.
6. Validar visualmente al menos una tilde y una `n` con virgulilla.
7. Si la consola muestra texto roto, confirmar primero por codepoints antes de modificar el archivo.

## Ejemplo correcto

```js
const title = "Solicitud de vacaciones pendiente de aprobaci\u00F3n";
const message =
  "Alexandra Molina tiene una solicitud pendiente que requiere tu revisi\u00F3n y aprobaci\u00F3n.";
```

## Ejemplo incorrecto

```js
const title = "Solicitud de vacaciones pendiente de aprobacion";
const message = "Alexandra Molina requiere tu revisi?n y aprobaci?n.";
```

## Decision de ingenieria
Para mensajes visibles del sistema:

- preferir `Unicode escapes` en scripts operativos
- preferir `UTF-8` normal en codigo fuente estable
- mantener una capa de normalizacion defensiva en backend

Esto reduce regresiones por consola, editores y despliegues heterogeneos.
