# Add-on Gmail de FamSPI

Este proyecto Apps Script implementa la captura contextual del correo abierto.
No se despliega con credenciales embebidas.

## Configuración requerida antes de instalar

1. Crear un proyecto Apps Script y copiar estos dos archivos.
2. Configurar la propiedad de script `SPI_GMAIL_CONTEXT_API_ORIGIN` con el
   origen HTTPS de SPI, sin ruta ni `/api/v1`.
3. Instalar una prueba del Add-on desde el proyecto Apps Script.
4. Obtener el `aud` emitido por `ScriptApp.getIdentityToken()`.
5. Configurar ese valor en Cloud Run como `GMAIL_CONTEXT_ADDON_AUDIENCE`.
6. Desplegar el backend que contiene `/api/v1/gmail-context/addon`.

El backend rechaza cualquier solicitud mientras no exista el audience exacto.
El Add-on solicita únicamente lectura del mensaje actualmente abierto; no pide
permiso para navegar o leer toda la bandeja de entrada.
