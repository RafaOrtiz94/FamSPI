# Automatizacion de la plantilla institucional

## Objetivo
Preparar una plantilla institucional reutilizable para generar documentos de validacion del SPI en formato Word sin depender de `pandoc` ni de conversiones que alteren el estilo corporativo.

## Archivos
- `Plantilla_Validacion_SPI.docx`: plantilla original cargada manualmente.
- `Plantilla_Validacion_SPI_2.docx`: plantilla institucional vigente.
- `Plantilla_Validacion_SPI_AUTOMATIZABLE.dotx`: plantilla derivada y preparada para autollenado con Word.
- `scripts/validation-doc.config.json`: configuracion central de plantillas, estilos, orden documental y areas.
- `scripts/modules/ValidationDocTools.psm1`: modulo comun con logging, manejo COM, retry, render Markdown y postformato.
- `scripts/prepare_validation_template.ps1`: crea la plantilla automatizable desde la plantilla original.
- `scripts/generate_validation_docx_from_template.ps1`: genera un `.docx` a partir de un `.md`.
- `scripts/generate_validation_area_single_docx.ps1`: consolida el paquete documental del area en un solo `.docx`.
- `scripts/generate_validation_area_docx.ps1`: alias operativo que ahora genera un unico documento consolidado por area.

## Tags de content controls
- `doc_title`
- `doc_area`
- `meta_system`
- `meta_code`
- `meta_version`
- `meta_date`
- `meta_status`
- `body_content`

## Flujo recomendado
1. Ejecutar `scripts/prepare_validation_template.ps1` una sola vez o cuando cambie la plantilla base.
2. Generar un documento individual desde Markdown o un paquete consolidado por area.
3. Elegir `-Mode Preview` para salida rapida o `-Mode Final` para TOC, paginacion, cabeceras y postformato completo.
4. Revisar visualmente en Word el resultado final y, si aplica, ajustar metadatos.

El script de preparacion usa por defecto `Plantilla_Validacion_SPI_2.docx` si existe. Si no existe, cae a `Plantilla_Validacion_SPI.docx`.

## Capacidades implementadas
- Configuracion central por archivo JSON.
- Mapeo de plantilla por tipo documental.
- Logging tecnico por ejecucion.
- Barra de progreso visible durante preparacion, consolidacion y render.
- Validacion de prerequisitos antes de abrir Word.
- Reintentos ante fallos transitorios de COM.
- Liberacion explicita de objetos Word COM.
- Modo `Preview` y modo `Final`.
- Consolidacion de area en un solo documento.
- Soporte opcional de anexos graficos desde carpeta `assets`.
- Cabecera, pie de pagina, TOC y maquetacion institucional reforzada.

## Ejemplo
```powershell
.\scripts\prepare_validation_template.ps1

.\scripts\generate_validation_docx_from_template.ps1 `
  -SourceMarkdown docs\validation\areas\area_01_gobierno_seguridad\01_URS_requerimientos_usuario.md `
  -OutputDocx docs\validation\areas\area_01_gobierno_seguridad\DOCX_FORMATO_UNICO\01_URS_requerimientos_usuario.docx `
  -Area "Area 01: Gobierno, Seguridad y Cumplimiento" `
  -Code "VAL-SPI-GSC-URS-001" `
  -Version "1.0" `
  -Status "BORRADOR" `
  -DocumentKind urs `
  -Mode Final

.\scripts\generate_validation_area_single_docx.ps1 `
  -AreaPath docs\validation\areas\area_01_gobierno_seguridad `
  -AreaLabel "Area 01: Gobierno, Seguridad y Cumplimiento" `
  -Code "VAL-SPI-GSC-PAQUETE" `
  -Version "1.0" `
  -Status "BORRADOR" `
  -Mode Final `
  -AssetsPath docs\validation\areas\area_01_gobierno_seguridad\assets

.\scripts\generate_validation_area_docx.ps1 `
  -AreaPath docs\validation\areas\area_01_gobierno_seguridad `
  -AreaLabel "Area 01: Gobierno, Seguridad y Cumplimiento" `
  -CodePrefix "VAL-SPI-GSC" `
  -Version "1.0" `
  -Status "BORRADOR" `
  -Mode Final
```

## Limitaciones actuales
- El generador interpreta Markdown estructural comun:
  - titulos `#`, `##`, `###`
  - listas con `-`
  - listas numeradas `1.`
  - tablas Markdown con `|`
  - imagenes `![titulo](ruta)`
  - parrafos normales
- El consolidado agrega una seccion `Definiciones` antes de los capitulos documentales.
- No aplica formato rico a Markdown avanzado complejo.
- La revision final en Word sigue siendo recomendable para documentos regulados.
