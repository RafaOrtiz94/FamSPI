[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path $_ })]
  [string]$AreaPath,
  [string]$AreaLabel = '',
  [string]$TemplatePath = '',
  [string]$ConfigPath = '',
  [string]$Version = '1.0',
  [ValidateSet('BORRADOR','APROBADO','VIGENTE')]
  [string]$Status = 'BORRADOR',
  [string]$Code = 'VAL-SPI-AREA',
  [string]$OutputDocx = '',
  [ValidateSet('Preview','Final')]
  [string]$Mode = 'Final',
  [string]$AssetsPath = '',
  [string]$LogPath = ''
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules\ValidationDocTools.psm1') -Force

$config = if ($ConfigPath) { Import-ValidationConfig -ConfigPath $ConfigPath -ForceReload } else { Import-ValidationConfig }
$logger = New-ValidationLogger -Operation 'generate_area_package' -LogsDir $LogPath -Config $config
$progressId = 43

try {
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Inicializando area' -PercentComplete 5
  $fullAreaPath = Resolve-ValidationPath -PathValue $AreaPath -BasePath (Get-Location).Path
  $areaSlug = Split-Path $fullAreaPath -Leaf
  $areaConfig = Get-AreaConfig -AreaSlug $areaSlug -Config $config

  if ([string]::IsNullOrWhiteSpace($AreaLabel)) {
    $AreaLabel = if ($areaConfig) { $areaConfig.label } else { $areaSlug }
  }

  if ([string]::IsNullOrWhiteSpace($OutputDocx)) {
    $OutputDocx = Join-Path $fullAreaPath ("PAQUETE_VALIDACION_{0}.docx" -f $areaSlug.ToUpperInvariant())
  }

  if ([string]::IsNullOrWhiteSpace($AssetsPath)) {
    $defaultAssets = Join-Path $fullAreaPath 'assets'
    if (Test-Path $defaultAssets) {
      $AssetsPath = $defaultAssets
    }
  }

  $orderedFiles = @()
  foreach ($name in $config.documentOrder) {
    if ($name -like '00_*') { continue }
    $path = Join-Path $fullAreaPath $name
    if (Test-Path $path) {
      $orderedFiles += $path
      continue
    }
    if ($name -like '09_informe_hallazgos_*') {
      $fallbackFinding = Get-ChildItem $fullAreaPath -Filter '09_informe_hallazgos_area_*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 1
      if ($fallbackFinding) {
        $orderedFiles += $fallbackFinding.FullName
      }
    }
  }
  if ($orderedFiles.Count -eq 0) {
    throw "No se encontraron documentos formales en $fullAreaPath"
  }

  Write-ValidationLog -Logger $logger -Level INFO -Message 'Consolidando area' -Data @{ area = $AreaLabel; files = $orderedFiles.Count; mode = $Mode }
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Preparando resumen y definiciones' -PercentComplete 15

  $definitions = if ($areaConfig) { $areaConfig.definitions } else { @(@{ term = 'IQ'; definition = 'Calificacion de instalacion.' }, @{ term = 'OQ'; definition = 'Calificacion de operacion.' }, @{ term = 'PQ'; definition = 'Calificacion de desempeno.' }) }
  $modules = if ($areaConfig) { $areaConfig.modules } else { @() }
  $supportDocuments = if ($areaConfig -and $areaConfig.supportDocuments) { $areaConfig.supportDocuments } else { @() }
  $moduleNames = @($modules | ForEach-Object { $_.module })
  $moduleListText = switch ($moduleNames.Count) {
    0 { 'los módulos definidos para el área' }
    1 { $moduleNames[0] }
    2 { "$($moduleNames[0]) y $($moduleNames[1])" }
    default { (($moduleNames[0..($moduleNames.Count - 2)] -join ', ') + ' y ' + $moduleNames[-1]) }
  }
  $traceabilityRows = @(
    @{ Stage = 'URS'; Purpose = 'Define requerimientos de usuario y expectativas operativas del area' },
    @{ Stage = 'FRS'; Purpose = 'Describe comportamiento funcional verificable y reglas de negocio observadas' },
    @{ Stage = 'DDS'; Purpose = 'Documenta arquitectura, dependencias tecnicas y diseno del dominio' },
    @{ Stage = 'DD'; Purpose = 'Relaciona las entidades y estructuras de datos utilizadas por el area' },
    @{ Stage = 'IQ'; Purpose = 'Verifica instalacion, despliegue y disponibilidad de componentes' },
    @{ Stage = 'OQ'; Purpose = 'Valida operacion funcional bajo condiciones normales y de error' },
    @{ Stage = 'PQ'; Purpose = 'Evalua estabilidad y consistencia del area en uso representativo' },
    @{ Stage = 'Hallazgos'; Purpose = 'Registra no conformidades, correcciones y riesgos residuales' },
    @{ Stage = 'Evidencias'; Purpose = 'Consolida soporte objetivo de ejecucion, desviaciones y cierre' }
  )
  $sectionIntroductions = @{
    '01_URS_requerimientos_usuario.md'       = 'La presente seccion establece los requerimientos de usuario del area evaluada, describiendo las necesidades funcionales, los actores que interactuan con el sistema y las condiciones de operacion esperadas desde la perspectiva del negocio y de los usuarios autorizados.'
    '02_FRS_requerimientos_funcionales.md'   = 'Esta seccion desarrolla la especificacion funcional del area, detallando el comportamiento esperado de cada modulo, las reglas de negocio observadas y los criterios que permiten validar que la implementacion responde a lo requerido.'
    '03_DDS_diseno_tecnico.md'               = 'En esta seccion se describe el diseno tecnico del area, incluyendo arquitectura aplicativa, responsabilidades por modulo, contratos relevantes, dependencias transversales y consideraciones de integracion necesarias para la validacion tecnica.'
    '03A_DD_diccionario_datos.md'            = 'Esta seccion documenta las entidades de datos, campos, relaciones e indices que soportan el funcionamiento real del area, tomando como fuente la estructura vigente de base de datos y su correspondencia con el codigo en operacion.'
    '04_IQ_validacion_instalacion.md'        = 'La calificacion de instalacion resume la verificacion de componentes, rutas, dependencias y prerrequisitos tecnicos necesarios para ejecutar correctamente el area dentro del entorno objetivo.'
    '05_OQ_validacion_funcionamiento.md'     = 'La calificacion operacional consolida la comprobacion funcional del area bajo condiciones normales y de error controlado, verificando que las funciones implementadas respondan de forma coherente a la especificacion vigente.'
    '06_PQ_validacion_operacion_real.md'     = 'La calificacion de desempeno documenta la respuesta del area en condiciones de uso real o representativo, considerando estabilidad, consistencia, trazabilidad y comportamiento repetitivo de los flujos principales.'
    '09_informe_hallazgos_area_01.md'        = 'En esta seccion se registran los hallazgos tecnicos vigentes del area, distinguiendo entre hallazgos corregidos, riesgos residuales y observaciones que requieren seguimiento para no comprometer la integridad funcional ni documental.'
    '10_IQ_protocolo_ejecucion.md'           = 'Este protocolo define las actividades, evidencias esperadas, criterios de aceptacion y campos de registro requeridos para ejecutar formalmente la calificacion de instalacion del area.'
    '11_OQ_protocolo_ejecucion.md'           = 'Este protocolo establece los casos de prueba operacionales que deben ejecutarse para verificar la respuesta funcional del area, la gestion de errores y la persistencia asociada a los flujos evaluados.'
    '12_PQ_protocolo_ejecucion.md'           = 'Este protocolo describe los escenarios de desempeno y uso repetitivo necesarios para demostrar que el area mantiene estabilidad operativa, consistencia de datos y trazabilidad suficiente en contexto de uso real.'
    '13_registro_evidencias_desviaciones.md' = 'La presente seccion constituye la bitacora formal para documentar evidencias, desviaciones, defectos y decisiones de cierre derivadas de la ejecucion de IQ, OQ y PQ.'
  }

  $builder = New-Object System.Text.StringBuilder
  [void]$builder.AppendLine("# VALIDACION DEL AREA")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("## $AreaLabel")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("## Control documental")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("| Campo | Valor |")
  [void]$builder.AppendLine("|---|---|")
  [void]$builder.AppendLine("| Sistema | SPI |")
  [void]$builder.AppendLine("| Documento | Validacion consolidada del area |")
  [void]$builder.AppendLine("| Area | $AreaLabel |")
  [void]$builder.AppendLine("| Codigo documental | $Code |")
  [void]$builder.AppendLine("| Version | $Version |")
  [void]$builder.AppendLine("| Estado | $Status |")
  [void]$builder.AppendLine("| Fecha de emision | $(Get-Date -Format 'yyyy-MM-dd') |")
  [void]$builder.AppendLine("| Elaborado por | Ingenieria de Software |")
  [void]$builder.AppendLine("| Revisado por | __________________ |")
  [void]$builder.AppendLine("| Aprobado por | __________________ |")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("## Firmas y sumillas")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("| Rol documental | Nombre y cargo | Firma | Sumilla | Fecha |")
  [void]$builder.AppendLine("|---|---|---|---|---|")
  [void]$builder.AppendLine("| Elaborado por | Ingenieria de Software | __________________ | ______ | __________________ |")
  [void]$builder.AppendLine("| Revisado por | __________________ | __________________ | ______ | __________________ |")
  [void]$builder.AppendLine("| Aprobado por | __________________ | __________________ | ______ | __________________ |")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("## Introduccion")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("El presente documento consolida la documentacion de validacion del $AreaLabel del sistema SPI. Su contenido se elaboro a partir de una revision integral del codigo vigente, del comportamiento observable de los modulos incluidos en el alcance, de la estructura de datos asociada y de los controles funcionales y tecnicos que sostienen $moduleListText dentro de la operacion real del sistema.")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("La intencion de este consolidado es presentar una version formal, continua y coherente de la documentacion del area, con criterio de ingenieria de software, de forma que el lector disponga en un unico documento de los requerimientos, la especificacion funcional, el diseno tecnico, el soporte de datos, las calificaciones, los protocolos de prueba y el estado actualizado de hallazgos, sin depender de referencias a artefactos internos de trabajo.")
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Objetivo")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("Establecer de forma integral los criterios de validacion del area $AreaLabel, documentando los requerimientos, el comportamiento funcional esperado, el diseno tecnico de soporte, las estructuras de datos, las calificaciones IQ/OQ/PQ, los protocolos de ejecucion y el registro de hallazgos, evidencias y desviaciones con un nivel de detalle suficiente para su revision tecnica, funcional y documental.")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("De manera complementaria, el documento busca servir como referencia controlada para la ejecucion de validaciones formales del area, reduciendo ambiguedades, alineando el contenido con la implementacion vigente y dejando trazabilidad sobre los puntos corregidos y los riesgos residuales que aun requieren seguimiento.")
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Alcance")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("La validacion cubre los modulos $moduleListText, incluyendo sus rutas, servicios, middlewares, persistencia, dependencias SQL, integraciones externas y reglas de negocio asociadas al area.")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("Tambien forman parte del alcance las calificaciones de instalacion, operacion y desempeno, junto con sus protocolos de ejecucion, criterios de aceptacion, mecanismos de captura de evidencia y registro de desviaciones. Quedan fuera de este documento los dominios funcionales no pertenecientes al area y los desarrollos auxiliares que no formen parte del flujo core validado.")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("De manera expresa, el mecanismo de respaldo de base de datos hacia Drive no se incorpora al alcance funcional del Area 01, aun cuando exista en el mismo repositorio y comparta infraestructura tecnica. Su naturaleza corresponde a continuidad operativa, resguardo de informacion y administracion de plataforma, por lo que debe evaluarse en un dominio de infraestructura, operaciones TI o continuidad del servicio, no dentro del expediente funcional de Gobierno, Seguridad y Cumplimiento.")
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Base de evaluacion")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("- Revision del codigo vigente del repositorio y de los modulos incluidos en el area.")
  [void]$builder.AppendLine("- Verificacion de contratos entre backend y frontend, incluyendo rutas, payloads y respuestas observables.")
  [void]$builder.AppendLine("- Contraste con estructuras de datos y dependencias SQL reales utilizadas por el area.")
  [void]$builder.AppendLine("- Analisis de riesgos, hallazgos corregidos, hallazgos residuales y criterios de impacto.")
  [void]$builder.AppendLine("- Preparacion de protocolos formales de ejecucion, criterios de aceptacion y captura de evidencia.")
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Marco normativo y de referencia")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("- Politicas internas de control documental y trazabilidad del sistema SPI.")
  [void]$builder.AppendLine("- Marco de proteccion de datos personales aplicable a flujos de consentimiento, sesion e informacion del usuario (Asamblea Nacional del Ecuador, 2021; Presidencia de la República del Ecuador, 2023).")
  [void]$builder.AppendLine("- Criterios de seguridad de la informacion usados como referencia para autenticacion, control de acceso y trazabilidad de eventos (International Organization for Standardization [ISO] & International Electrotechnical Commission [IEC], 2022).")
  [void]$builder.AppendLine("- Requerimientos funcionales y tecnicos vigentes derivados de la implementacion validada.")
  [void]$builder.AppendLine("- Protocolos formales de ejecucion de IQ, OQ y PQ preparados para evidencia objetiva.")
  [void]$builder.AppendLine()

  if ($supportDocuments.Count -gt 0) {
    [void]$builder.AppendLine("## Documentos de soporte")
    [void]$builder.AppendLine()
    [void]$builder.AppendLine("| Titulo del documento | Año de publicacion |")
    [void]$builder.AppendLine("|---|---|")
    foreach ($doc in $supportDocuments) {
      [void]$builder.AppendLine("| $($doc.title) | $($doc.year) |")
    }
    [void]$builder.AppendLine()
  }

  [void]$builder.AppendLine("## Modulos evaluados")
  [void]$builder.AppendLine()
  if ($modules.Count -gt 0) {
    [void]$builder.AppendLine("| Modulo | Alcance funcional evaluado |")
    [void]$builder.AppendLine("|---|---|")
    foreach ($module in $modules) {
      [void]$builder.AppendLine("| $($module.module) | $($module.focus) |")
    }
  } else {
    [void]$builder.AppendLine("- Requiere definicion explicita de modulos para esta area.")
  }
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Metodologia de validacion")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("La documentacion consolidada se construye con criterio de ingenieria de software sobre cuatro capas complementarias:")
  [void]$builder.AppendLine("- requerimientos de usuario y funcionales")
  [void]$builder.AppendLine("- diseno tecnico y diccionario de datos")
  [void]$builder.AppendLine("- calificacion de instalacion, operacion y desempeno")
  [void]$builder.AppendLine("- hallazgos vigentes y registro de evidencias/desviaciones")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("Cada seccion del presente documento representa una parte formal del proceso de validacion del area y se presenta como un cuerpo tecnico continuo, redactado para su lectura documental y no como una simple enumeracion de artefactos de trabajo.")
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Definiciones")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("| Termino | Definicion |")
  [void]$builder.AppendLine("|---|---|")
  foreach ($item in $definitions) {
    [void]$builder.AppendLine("| $($item.term) | $($item.definition) |")
  }
  [void]$builder.AppendLine()

  [void]$builder.AppendLine("## Matriz de trazabilidad resumida")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("| Capa documental | Proposito dentro de la validacion |")
  [void]$builder.AppendLine("|---|---|")
  foreach ($row in $traceabilityRows) {
    [void]$builder.AppendLine("| $($row.Stage) | $($row.Purpose) |")
  }
  [void]$builder.AppendLine()

  for ($fileIndex = 0; $fileIndex -lt $orderedFiles.Count; $fileIndex++) {
    $path = $orderedFiles[$fileIndex]
    $percent = 20 + [int](($fileIndex / [Math]::Max(1, $orderedFiles.Count)) * 35)
    Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status ("Consolidando {0}/{1}: {2}" -f ($fileIndex + 1), $orderedFiles.Count, [System.IO.Path]::GetFileName($path)) -PercentComplete $percent
    $content = Get-Content $path -Raw -Encoding UTF8
    $content = Repair-ValidationDocumentText -Text $content
    $heading = [regex]::Match($content, '(?m)^#\s+(.+)$')
    $sectionTitle = if ($heading.Success) { $heading.Groups[1].Value.Trim() } else { [System.IO.Path]::GetFileNameWithoutExtension($path) }
    $sectionTitle = Repair-ValidationDocumentText -Text $sectionTitle
    [void]$builder.AppendLine("# $sectionTitle")
    [void]$builder.AppendLine()
    $fileName = [System.IO.Path]::GetFileName($path)
    $sectionIntro = $null
    if ($sectionIntroductions.ContainsKey($fileName)) {
      $sectionIntro = $sectionIntroductions[$fileName]
    } elseif ($fileName -like '09_informe_hallazgos_area_*.md') {
      $sectionIntro = 'En esta seccion se registran los hallazgos tecnicos vigentes del area, distinguiendo entre hallazgos corregidos, riesgos residuales y observaciones que requieren seguimiento para no comprometer la integridad funcional, operativa ni documental del dominio evaluado.'
    }
    if ($sectionIntro) {
      [void]$builder.AppendLine((Repair-ValidationDocumentText -Text $sectionIntro))
      [void]$builder.AppendLine()
    }
    $contentWithoutFirstHeading = [regex]::Replace($content, '^(#\s+.+?\r?\n+)', '', 1)
    $contentWithoutFirstHeading = Repair-ValidationDocumentText -Text $contentWithoutFirstHeading.Trim()
    [void]$builder.AppendLine($contentWithoutFirstHeading)
    [void]$builder.AppendLine()
    [void]$builder.AppendLine()
  }

  if ($AssetsPath -and (Test-Path $AssetsPath)) {
    $images = Get-ChildItem $AssetsPath -File | Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|bmp)$' } | Sort-Object Name
    if ($images.Count -gt 0) {
      Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Anexando recursos graficos' -PercentComplete 60
      [void]$builder.AppendLine("# Anexos graficos")
      [void]$builder.AppendLine()
      foreach ($image in $images) {
        [void]$builder.AppendLine("## $($image.BaseName)")
        [void]$builder.AppendLine()
        [void]$builder.AppendLine("![$($image.BaseName)]($($image.FullName))")
        [void]$builder.AppendLine()
      }
    }
  }

  [void]$builder.AppendLine("# Conclusion ejecutiva")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("La documentacion consolidada del $AreaLabel integra los requerimientos, la especificacion funcional, el diseno tecnico, el soporte de datos, las calificaciones y los protocolos de prueba necesarios para una validacion formal del dominio. El contenido se encuentra alineado con la implementacion vigente revisada y presenta, de forma controlada, el estado de los hallazgos corregidos y de los riesgos residuales aun abiertos.")
  [void]$builder.AppendLine()
  [void]$builder.AppendLine("Con base en la documentacion incluida, el area dispone de un expediente tecnico suficiente para ejecutar IQ, OQ y PQ, registrar evidencia objetiva y sostener una conclusion de validacion con criterio de ingenieria de software. Cualquier cierre definitivo del proceso debe apoyarse en la ejecucion real de protocolos y en la resolucion o aceptacion formal de hallazgos residuales.")
  [void]$builder.AppendLine()

  if ($supportDocuments.Count -gt 0) {
    [void]$builder.AppendLine("# Referencias")
    [void]$builder.AppendLine()
    foreach ($doc in $supportDocuments) {
      [void]$builder.AppendLine("- $($doc.reference)")
    }
    [void]$builder.AppendLine()
  }

  $tempMd = Join-Path $env:TEMP ("validation_area_" + [guid]::NewGuid().ToString('N') + '.md')
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Generando markdown temporal consolidado' -PercentComplete 65
  Set-Content -Path $tempMd -Value (Repair-ValidationDocumentText -Text $builder.ToString()) -Encoding UTF8

  try {
    Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Ejecutando generador DOCX' -PercentComplete 70
    & (Join-Path $PSScriptRoot 'generate_validation_docx_from_template.ps1') `
      -SourceMarkdown $tempMd `
      -OutputDocx $OutputDocx `
      -TemplatePath $TemplatePath `
      -ConfigPath $ConfigPath `
      -DocumentKind package `
      -Area $AreaLabel `
      -Code $Code `
      -Version $Version `
      -Status $Status `
      -Mode $Mode `
      -AssetsPath $AssetsPath `
      -LogPath $LogPath `
      -DocumentTitle "VALIDACION DEL AREA - $AreaLabel"
  }
  finally {
    if (Test-Path $tempMd) { Remove-Item $tempMd -Force }
  }

  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Completado' -PercentComplete 100 -Completed
  Complete-ValidationLogger -Logger $logger -Result OK
}
catch {
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete consolidado' -Status 'Fallo' -Completed
  Write-ValidationLog -Logger $logger -Level ERROR -Message 'Fallo en consolidacion de area' -Data @{ error = $_.Exception.Message }
  Complete-ValidationLogger -Logger $logger -Result FAILED
  throw
}


