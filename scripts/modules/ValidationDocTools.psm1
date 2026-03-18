$script:ConfigCache = $null
$script:ProgressState = @{}

function Resolve-ValidationPath {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$PathValue,
    [string]$BasePath = (Get-Location).Path
  )

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $BasePath $PathValue))
}

function Import-ValidationConfig {
  [CmdletBinding()]
  param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\validation-doc.config.json'),
    [switch]$ForceReload
  )

  if (-not $ForceReload -and $script:ConfigCache) {
    return $script:ConfigCache
  }

  $fullPath = Resolve-ValidationPath -PathValue $ConfigPath -BasePath (Get-Location).Path
  if (-not (Test-Path $fullPath)) {
    throw "No existe el archivo de configuracion: $fullPath"
  }

  $config = Get-Content $fullPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $script:ConfigCache = $config
  return $config
}

function New-ValidationLogger {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Operation,
    [string]$LogsDir,
    [object]$Config
  )

  if (-not $Config) {
    $Config = Import-ValidationConfig
  }

  if (-not $LogsDir) {
    $LogsDir = Resolve-ValidationPath -PathValue $Config.paths.logsDir -BasePath (Get-Location).Path
  }

  New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
  $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $logPath = Join-Path $LogsDir ("{0}_{1}.log" -f $Operation, $timestamp)
  $logger = [pscustomobject]@{
    Operation = $Operation
    Path = $logPath
    Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  }
  "[$(Get-Date -Format s)] [INFO] Inicio: $Operation" | Set-Content -Path $logPath -Encoding UTF8
  return $logger
}

function Write-ValidationLog {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Logger,
    [Parameter(Mandatory = $true)]
    [ValidateSet('INFO','WARN','ERROR','DEBUG')]
    [string]$Level,
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [hashtable]$Data
  )

  $suffix = ''
  if ($Data) {
    $pairs = $Data.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }
    if ($pairs) {
      $suffix = ' | ' + ($pairs -join '; ')
    }
  }
  $line = "[{0}] [{1}] +{2}ms {3}{4}" -f (Get-Date -Format s), $Level, $Logger.Stopwatch.ElapsedMilliseconds, $Message, $suffix
  Add-Content -Path $Logger.Path -Value $line -Encoding UTF8
}

function Show-ValidationProgress {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [int]$Id,
    [Parameter(Mandatory = $true)]
    [string]$Activity,
    [string]$Status = '',
    [int]$PercentComplete = -1,
    [int]$ParentId = -1,
    [switch]$Completed
  )

  $params = @{
    Id = $Id
    Activity = $Activity
  }
  if ($Status) { $params.Status = $Status }
  if ($PercentComplete -ge 0) { $params.PercentComplete = $PercentComplete }
  if ($ParentId -ge 0) { $params.ParentId = $ParentId }
  if ($Completed) { $params.Completed = $true }
  Write-Progress @params

  $shouldWriteHost = $false
  if ($Completed) {
    $shouldWriteHost = $true
  } elseif (-not $script:ProgressState.ContainsKey($Id)) {
    $shouldWriteHost = $true
  } elseif ($PercentComplete -ge 0 -and [Math]::Abs($PercentComplete - $script:ProgressState[$Id]) -ge 5) {
    $shouldWriteHost = $true
  }

  if ($shouldWriteHost) {
    if ($Completed) {
      Write-Host ("[{0}] {1} - {2}" -f (Get-Date -Format 'HH:mm:ss'), $Activity, $Status)
    } else {
      $percentLabel = if ($PercentComplete -ge 0) { "$PercentComplete%" } else { '--' }
      Write-Host ("[{0}] {1} - {2} ({3})" -f (Get-Date -Format 'HH:mm:ss'), $Activity, $Status, $percentLabel)
    }
    if ($PercentComplete -ge 0) {
      $script:ProgressState[$Id] = $PercentComplete
    }
  }
}

function Complete-ValidationLogger {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Logger,
    [ValidateSet('OK','FAILED','ABORTED')]
    [string]$Result = 'OK'
  )

  $Logger.Stopwatch.Stop()
  Add-Content -Path $Logger.Path -Value ("[{0}] [INFO] Fin={1} TotalMs={2}" -f (Get-Date -Format s), $Result, $Logger.Stopwatch.ElapsedMilliseconds) -Encoding UTF8
}

function Invoke-ValidationRetry {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action,
    [int]$MaxAttempts = 3,
    [int]$DelayMilliseconds = 400,
    $Logger,
    [string]$Description = 'Operacion'
  )

  $attempt = 0
  while ($true) {
    try {
      $attempt++
      return & $Action
    } catch {
      if ($attempt -ge $MaxAttempts) {
        if ($Logger) { Write-ValidationLog -Logger $Logger -Level ERROR -Message "$Description fallo definitivamente" -Data @{ attempts = $attempt; error = $_.Exception.Message } }
        throw
      }
      if ($Logger) { Write-ValidationLog -Logger $Logger -Level WARN -Message "$Description fallo y se reintentara" -Data @{ attempt = $attempt; error = $_.Exception.Message } }
      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }
}

function Clear-ComObjectReference {
  [CmdletBinding()]
  param($ComObject)

  if ($null -eq $ComObject) { return }
  try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ComObject) } catch {}
}

function Start-WordApplication {
  [CmdletBinding()]
  param($Logger)

  return Invoke-ValidationRetry -Description 'Inicializacion de Word' -Logger $Logger -Action {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    return $word
  }
}

function Close-WordApplication {
  [CmdletBinding()]
  param(
    $Word,
    [object[]]$Documents = @()
  )

  foreach ($doc in $Documents) {
    if ($doc) {
      try { $doc.Close([ref]$false) | Out-Null } catch {}
      Clear-ComObjectReference $doc
    }
  }

  if ($Word) {
    try { $Word.Quit() | Out-Null } catch {}
    Clear-ComObjectReference $Word
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

function Test-ValidationPrerequisites {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$TemplatePath,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    $Logger
  )

  $template = Resolve-ValidationPath -PathValue $TemplatePath -BasePath (Get-Location).Path
  $output = Resolve-ValidationPath -PathValue $OutputPath -BasePath (Get-Location).Path

  if (-not (Test-Path $template)) {
    throw "No existe la plantilla: $template"
  }

  $outputDir = [System.IO.Path]::GetDirectoryName($output)
  if ([string]::IsNullOrWhiteSpace($outputDir)) {
    throw "Ruta de salida invalida: $output"
  }

  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

  $word = $null
  try {
    $word = Start-WordApplication -Logger $Logger
  } finally {
    Close-WordApplication -Word $word
  }

  if ($Logger) {
    Write-ValidationLog -Logger $Logger -Level INFO -Message 'Prerequisitos validados' -Data @{ template = $template; output = $output }
  }

  return [pscustomobject]@{
    Template = $template
    Output = $output
    OutputDir = $outputDir
  }
}

function Get-ValidationTemplatePath {
  [CmdletBinding()]
  param(
    [string]$DocumentKind = 'package',
    [switch]$SourceTemplate,
    [object]$Config
  )

  if (-not $Config) {
    $Config = Import-ValidationConfig
  }

  $templateDir = Resolve-ValidationPath -PathValue $Config.paths.templateDir -BasePath (Get-Location).Path
  if ($SourceTemplate) {
    $preferred = Join-Path $templateDir $Config.templates.sourcePreferred
    $fallback = Join-Path $templateDir $Config.templates.sourceFallback
    if (Test-Path $preferred) { return $preferred }
    return $fallback
  }

  $kindMap = $Config.templates.byDocumentKind.PSObject.Properties.Name
  $templateName = if ($kindMap -contains $DocumentKind) { $Config.templates.byDocumentKind.$DocumentKind } else { $Config.templates.automatable }
  return Join-Path $templateDir $templateName
}

function Get-AreaConfig {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$AreaSlug,
    [object]$Config
  )

  if (-not $Config) {
    $Config = Import-ValidationConfig
  }

  if ($Config.areas.PSObject.Properties.Name -contains $AreaSlug) {
    return $Config.areas.$AreaSlug
  }
  return $null
}

function Set-WordStyle {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Selection,
    [Parameter(Mandatory = $true)]
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    try {
      $Selection.Style = $candidate
      return
    } catch {
      continue
    }
  }
}

function Get-ControlByTag {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Document,
    [Parameter(Mandatory = $true)]
    [string]$Tag
  )

  foreach ($control in $Document.ContentControls) {
    if ($control.Tag -eq $Tag) {
      return $control
    }
  }
  throw "No se encontro el content control con tag '$Tag'."
}

function Convert-InlineMarkdownText {
  [CmdletBinding()]
  param([string]$Text)

  $result = $Text
  $result = $result -replace '\*\*(.+?)\*\*', '$1'
  $result = $result -replace '\*(.+?)\*', '$1'
  $result = $result -replace '`([^`]+)`', '$1'
  return $result
}

function Convert-ValidationTextToHtml {
  [CmdletBinding()]
  param([string]$Text)

  $plain = Convert-InlineMarkdownText $Text
  return [System.Net.WebUtility]::HtmlEncode($plain)
}

function Get-ValidationDocumentReferenceMap {
  [CmdletBinding()]
  param()

  return [ordered]@{
    '01_URS_requerimientos_usuario.md'       = 'Especificacion de Requerimientos de Usuario (URS)'
    '02_FRS_requerimientos_funcionales.md'   = 'Especificacion de Requerimientos Funcionales (FRS)'
    '03_DDS_diseno_tecnico.md'               = 'Diseno Tecnico del Sistema (DDS)'
    '03A_DD_diccionario_datos.md'            = 'Diccionario de Datos'
    '04_IQ_validacion_instalacion.md'        = 'Calificacion de Instalacion (IQ)'
    '05_OQ_validacion_funcionamiento.md'     = 'Calificacion Operacional (OQ)'
    '06_PQ_validacion_operacion_real.md'     = 'Calificacion de Desempeno (PQ)'
    '08_revision_hallazgos_produccion.md'    = 'Revision Historica de Hallazgos en Produccion'
    '09_informe_hallazgos_area_01.md'        = 'Informe de Hallazgos del Area 01'
    '10_IQ_protocolo_ejecucion.md'           = 'Protocolo de Ejecucion IQ'
    '11_OQ_protocolo_ejecucion.md'           = 'Protocolo de Ejecucion OQ'
    '12_PQ_protocolo_ejecucion.md'           = 'Protocolo de Ejecucion PQ'
    '13_registro_evidencias_desviaciones.md' = 'Registro de Evidencias y Desviaciones'
  }
}

function Repair-ValidationDocumentText {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $result = [string]$Text

  $literalReplacements = @(
    @('PÃ¡gina', 'Página'),
    @('realizÃ³', 'realizó'),
    @('MÃ³dulo', 'Módulo'),
    @('acciÃ³n', 'acción'),
    @('DescripciÃ³n', 'Descripción'),
    @('despuÃ©s', 'después'),
    @('InspecciÃ³n', 'Inspección'),
    @('estÃ¡', 'está'),
    @('documentaciÃ³n', 'documentación'),
    @('validaciÃ³n', 'validación'),
    @('informaciÃ³n', 'información'),
    @('InformaciÃ³n', 'Información'),
    @('gestiÃ³n', 'gestión'),
    @('tÃ©cnico', 'técnico'),
    @('TÃ©cnico', 'Técnico'),
    @('diseÃ±o', 'diseño'),
    @('DiseÃ±o', 'Diseño'),
    @('aÃ±o', 'año'),
    @('AÃ±o', 'Año'),
    @('contraseÃ±a', 'contraseña'),
    @('seÃ±al', 'señal'),
    @('revisiÃ³n', 'revisión'),
    @('RepÃºblica', 'República'),
    @('repÃºblica', 'república'),
    @('Integraciónes', 'Integraciones'),
    @('integraciónes', 'integraciones'),
    @('OrgÃ¡nica', 'Orgánica'),
    @('orgÃ¡nica', 'orgánica'),
    @('ProtecciÃ³n', 'Protección'),
    @('protecciÃ³n', 'protección'),
    @('autenticacion', 'autenticación'),
    @('Autenticacion', 'Autenticación'),
    @('configuracion', 'configuración'),
    @('Configuracion', 'Configuración')
  )
  foreach ($pair in $literalReplacements) {
    $result = $result.Replace($pair[0], $pair[1])
  }

  $regexReplacements = @(
    @{ Pattern = '\bIntroduccion\b'; Replacement = 'Introducción' },
    @{ Pattern = '\bintroduccion\b'; Replacement = 'introducción' },
    @{ Pattern = '\bArea\b'; Replacement = 'Área' },
    @{ Pattern = '\barea\b'; Replacement = 'área' },
    @{ Pattern = '\bCalificacion\b'; Replacement = 'Calificación' },
    @{ Pattern = '\bcalificacion\b'; Replacement = 'calificación' },
    @{ Pattern = '\bOperacion\b'; Replacement = 'Operación' },
    @{ Pattern = '\boperacion\b'; Replacement = 'operación' },
    @{ Pattern = '\bDesempeno\b'; Replacement = 'Desempeño' },
    @{ Pattern = '\bdesempeno\b'; Replacement = 'desempeño' },
    @{ Pattern = '\btecnico\b'; Replacement = 'técnico' },
    @{ Pattern = '\btecnica\b'; Replacement = 'técnica' },
    @{ Pattern = '\btecnicos\b'; Replacement = 'técnicos' },
    @{ Pattern = '\bTecnico\b'; Replacement = 'Técnico' },
    @{ Pattern = '\bTecnica\b'; Replacement = 'Técnica' },
    @{ Pattern = '\bgestion\b'; Replacement = 'gestión' },
    @{ Pattern = '\bGestion\b'; Replacement = 'Gestión' },
    @{ Pattern = '\bejecucion\b'; Replacement = 'ejecución' },
    @{ Pattern = '\bEjecucion\b'; Replacement = 'Ejecución' },
    @{ Pattern = '\bseccion\b'; Replacement = 'sección' },
    @{ Pattern = '\bSeccion\b'; Replacement = 'Sección' },
    @{ Pattern = '\bmodulo\b'; Replacement = 'módulo' },
    @{ Pattern = '\bModulo\b'; Replacement = 'Módulo' },
    @{ Pattern = '\bmodulos\b'; Replacement = 'módulos' },
    @{ Pattern = '\bModulos\b'; Replacement = 'Módulos' },
    @{ Pattern = '\banalisis\b'; Replacement = 'análisis' },
    @{ Pattern = '\bAnalisis\b'; Replacement = 'Análisis' },
    @{ Pattern = '\\bDescripcion\\b'; Replacement = 'Descripción' },
      @{ Pattern = '\\bRepublica\\b'; Replacement = 'República' },
      @{ Pattern = '\\brepublica\\b'; Replacement = 'república' },
      @{ Pattern = '\\bOrganica\\b'; Replacement = 'Orgánica' },
      @{ Pattern = '\\borganica\\b'; Replacement = 'orgánica' },
      @{ Pattern = '\\bProteccion\\b'; Replacement = 'Protección' },
      @{ Pattern = '\\bproteccion\\b'; Replacement = 'protección' },
      @{ Pattern = '\\bpublicacion\\b'; Replacement = 'publicación' },
      @{ Pattern = '\\bPublicacion\\b'; Replacement = 'Publicación' },
    @{ Pattern = '\\bDescripcion\\b'; Replacement = 'Descripción' },
      @{ Pattern = '\\bRepublica\\b'; Replacement = 'República' },
      @{ Pattern = '\\brepublica\\b'; Replacement = 'república' },
      @{ Pattern = '\\bOrganica\\b'; Replacement = 'Orgánica' },
      @{ Pattern = '\\borganica\\b'; Replacement = 'orgánica' },
      @{ Pattern = '\\bProteccion\\b'; Replacement = 'Protección' },
      @{ Pattern = '\\bproteccion\\b'; Replacement = 'protección' },
      @{ Pattern = '\\bpublicacion\\b'; Replacement = 'publicación' },
      @{ Pattern = '\\bPublicacion\\b'; Replacement = 'Publicación' },
    @{ Pattern = '\bintegraciones\b'; Replacement = 'integraciones' },
    @{ Pattern = '\bIntegraciones\b'; Replacement = 'Integraciones' },
    @{ Pattern = '\bcodigo\b'; Replacement = 'código' },
    @{ Pattern = '\bCodigo\b'; Replacement = 'Código' },
    @{ Pattern = '\bemision\b'; Replacement = 'emisión' },
    @{ Pattern = '\bEmision\b'; Replacement = 'Emisión' },
    @{ Pattern = '\bsesion\b'; Replacement = 'sesión' },
    @{ Pattern = '\bSesion\b'; Replacement = 'Sesión' },
    @{ Pattern = '\bautorizacion\b'; Replacement = 'autorización' },
    @{ Pattern = '\bAutorizacion\b'; Replacement = 'Autorización' },
    @{ Pattern = '\bversion\b'; Replacement = 'versión' },
    @{ Pattern = '\bVersion\b'; Replacement = 'Versión' },
    @{ Pattern = '\bhistorica\b'; Replacement = 'histórica' },
    @{ Pattern = '\bhistorico\b'; Replacement = 'histórico' },
    @{ Pattern = '\bgrafico\b'; Replacement = 'gráfico' },
    @{ Pattern = '\bgraficos\b'; Replacement = 'gráficos' },
    @{ Pattern = '\bdocumentacion\b'; Replacement = 'documentación' },
    @{ Pattern = '\bDocumentacion\b'; Replacement = 'Documentación' },
    @{ Pattern = '\bvalidacion\b'; Replacement = 'validación' },
    @{ Pattern = '\bValidacion\b'; Replacement = 'Validación' },
    @{ Pattern = '\binstalacion\b'; Replacement = 'instalación' },
    @{ Pattern = '\bInstalacion\b'; Replacement = 'Instalación' },
    @{ Pattern = '\bdiseno\b'; Replacement = 'diseño' },
    @{ Pattern = '\bDiseno\b'; Replacement = 'Diseño' },
    @{ Pattern = '\bmaximo\b'; Replacement = 'máximo' },
    @{ Pattern = '\bMaximo\b'; Replacement = 'Máximo' },
    @{ Pattern = '\bminimo\b'; Replacement = 'mínimo' },
    @{ Pattern = '\bMinimo\b'; Replacement = 'Mínimo' }
  )
  foreach ($item in $regexReplacements) {
    $result = [regex]::Replace($result, $item.Pattern, $item.Replacement)
  }

  $docMap = Get-ValidationDocumentReferenceMap
  foreach ($docName in $docMap.Keys) {
    $displayName = $docMap[$docName]
    $result = $result.Replace(('`' + $docName + '`'), $displayName)
    $result = $result.Replace($docName, $displayName)
  }

  return $result
}

function Split-MarkdownTableRow {
  [CmdletBinding()]
  param([string]$Line)

  $trimmed = $Line.Trim().Trim('|')
  return ($trimmed -split '\|') | ForEach-Object { Convert-InlineMarkdownText $_.Trim() }
}

function Test-MarkdownTableSeparator {
  [CmdletBinding()]
  param([string]$Line)

  $trimmed = $Line.Trim()
  return $trimmed -match '^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$'
}

function Get-ValidationFlowNodeLabel {
  [CmdletBinding()]
  param([string]$NodeText)

  if ([string]::IsNullOrWhiteSpace($NodeText)) { return '' }

  $label = $NodeText.Trim()
  if ($label -match '^[A-Za-z0-9_]+\s*\[(.*?)\]$') {
    $label = $matches[1]
  } elseif ($label -match '^[A-Za-z0-9_]+\s*\((.*?)\)$') {
    $label = $matches[1]
  } elseif ($label -match '^[A-Za-z0-9_]+\s*\{(.*?)\}$') {
    $label = $matches[1]
  } elseif ($label -match '\[(.*?)\]') {
    $label = $matches[1]
  } elseif ($label -match '\((.*?)\)') {
    $label = $matches[1]
  } elseif ($label -match '\{(.*?)\}') {
    $label = $matches[1]
  }

  $label = $label.Trim().Trim('[',']','(',')','{','}','"','''')
  return (Convert-InlineMarkdownText $label)
}

function Test-ValidationFlowBlock {
  [CmdletBinding()]
  param(
    [string]$FenceInfo = '',
    [string[]]$CodeLines = @()
  )

  if (-not $CodeLines -or $CodeLines.Count -eq 0) { return $false }
  $joined = (($CodeLines | ForEach-Object { $_.Trim() }) -join ' ') -replace '\s+', ' '
  if ([string]::IsNullOrWhiteSpace($joined)) { return $false }

  $looksLikeFlowFence = $FenceInfo -match '^(text|flow|workflow|diagram|mermaid)?$' -or $FenceInfo -match '^(graph|flowchart)\b'
  $hasArrows = $joined -match '->|-->'
  $hasEnoughSteps = ([regex]::Matches($joined, '->|-->').Count -ge 1)
  $hasNodes = $joined -match '\[.+?\]|\(.+?\)|\{.+?\}'

  return (($looksLikeFlowFence -and $hasArrows -and $hasEnoughSteps) -or ($hasArrows -and $hasNodes))
}

function Convert-ValidationFlowBlockToHtml {
  [CmdletBinding()]
  param([string[]]$CodeLines)

  $normalized = (($CodeLines | ForEach-Object { $_.Trim() }) -join ' ') -replace '\s+', ' '
  $normalized = $normalized -replace '^(flowchart|graph)\s+[A-Za-z]{1,3}\s+', ''
  $parts = [regex]::Split($normalized, '\s*(?:-->|->)\s*') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  if ($parts.Count -lt 2) { return '' }

  $steps = foreach ($part in $parts) {
    $label = Get-ValidationFlowNodeLabel -NodeText $part
    if (-not [string]::IsNullOrWhiteSpace($label)) { $label }
  }
  if ($steps.Count -lt 2) { return '' }

  $builder = New-Object System.Text.StringBuilder
  $null = $builder.AppendLine('<table class="flowchart">')
  $null = $builder.AppendLine('<tr><th style="width:12%;">Paso</th><th>Actividad</th></tr>')
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $stepNumber = $i + 1
    $stepText = Convert-ValidationTextToHtml $steps[$i]
    $null = $builder.AppendLine("<tr><td class='flow-index'>$stepNumber</td><td class='flow-step'>$stepText</td></tr>")
    if ($i -lt ($steps.Count - 1)) {
      $null = $builder.AppendLine("<tr><td colspan='2' class='flow-arrow'>Siguiente paso</td></tr>")
    }
  }
  $null = $builder.AppendLine('</table>')
  return $builder.ToString()
}

function Set-CoverFormatting {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Document,
    [Parameter(Mandatory = $true)]
    [object]$Config
  )

  $nonEmptyParagraphs = New-Object System.Collections.Generic.List[object]
  foreach ($paragraph in $Document.Paragraphs) {
    $text = [string]$paragraph.Range.Text
    $text = $text -replace "`r", ''
    $text = $text -replace "`a", ''
    $text = $text -replace "`n", ''
    $text = $text.Trim()
    if ($text) { $nonEmptyParagraphs.Add($paragraph) }
    if ($text -eq 'ÍNDICE' -or $text -eq 'INDICE') { break }
  }

  if ($nonEmptyParagraphs.Count -gt 0) {
    try { $nonEmptyParagraphs[0].Range.Style = $Config.styleMap.title[0] } catch {}
    $nonEmptyParagraphs[0].Range.Font.Bold = $true
    $nonEmptyParagraphs[0].Range.Font.Size = 22
    try { $nonEmptyParagraphs[0].Range.Font.Color = 8606770 } catch {}
    $nonEmptyParagraphs[0].Range.ParagraphFormat.Alignment = 1
    $nonEmptyParagraphs[0].Range.ParagraphFormat.SpaceAfter = 12
    try { $nonEmptyParagraphs[0].Range.ParagraphFormat.OutlineLevel = 10 } catch {}
  }

  if ($nonEmptyParagraphs.Count -gt 1) {
    try { $nonEmptyParagraphs[1].Range.Style = $Config.styleMap.subtitle[0] } catch {}
    $nonEmptyParagraphs[1].Range.Font.Italic = $true
    $nonEmptyParagraphs[1].Range.Font.Size = 11
    try { $nonEmptyParagraphs[1].Range.Font.Color = 9200781 } catch {}
    $nonEmptyParagraphs[1].Range.ParagraphFormat.Alignment = 1
    $nonEmptyParagraphs[1].Range.ParagraphFormat.SpaceAfter = 18
    try { $nonEmptyParagraphs[1].Range.ParagraphFormat.OutlineLevel = 10 } catch {}
  }

  for ($i = 2; $i -lt $nonEmptyParagraphs.Count; $i++) {
    try { $nonEmptyParagraphs[$i].Range.Style = $Config.styleMap.normal[0] } catch {}
    $nonEmptyParagraphs[$i].Range.Font.Size = 10
    $nonEmptyParagraphs[$i].Range.ParagraphFormat.SpaceAfter = 4
    try { $nonEmptyParagraphs[$i].Range.ParagraphFormat.OutlineLevel = 10 } catch {}
  }
}

function Add-WordTable {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Document,
    [Parameter(Mandatory = $true)]
    $Selection,
    [Parameter(Mandatory = $true)]
    [object[]]$Rows,
    [Parameter(Mandatory = $true)]
    [object]$Config
  )

  if ($Rows.Count -eq 0) { return }

  $columnCount = $Rows[0].Count
  $table = $Document.Tables.Add($Selection.Range, $Rows.Count, $columnCount)
  try { $table.Style = $Config.styleMap.table[0] } catch { try { $table.Style = $Config.styleMap.table[1] } catch {} }
  $table.ApplyStyleHeadingRows = $true
  $table.Borders.Enable = 1

  for ($r = 0; $r -lt $Rows.Count; $r++) {
    for ($c = 0; $c -lt $columnCount; $c++) {
      $cellRange = $table.Cell($r + 1, $c + 1).Range
      $cellRange.Text = $Rows[$r][$c]
      $cellRange.Font.Size = 9
      if ($r -eq 0) { $cellRange.Font.Bold = $true }
    }
  }

  $Selection.SetRange($table.Range.End, $table.Range.End)
  $Selection.TypeParagraph()
}

function Add-WordImage {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Selection,
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [string]$Caption = ''
  )

  if (-not (Test-Path $ImagePath)) { return }
  $Selection.InlineShapes.AddPicture($ImagePath) | Out-Null
  $Selection.TypeParagraph()
  if ($Caption) {
    $Selection.TypeText($Caption)
    $Selection.TypeParagraph()
  }
}

function Set-DocumentHeaderFooter {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Document,
    [string]$HeaderText,
    [string]$FooterLeft = ''
  )

  foreach ($section in $Document.Sections) {
    try {
      $section.Headers.Item(1).Range.Text = $HeaderText
      $section.Headers.Item(1).Range.Font.Size = 8
    } catch {}

    try {
      $footerRange = $section.Footers.Item(1).Range
      $footerRange.Text = $FooterLeft + ' | Página '
      $footerRange.Collapse(0)
      $footerRange.Fields.Add($footerRange, -1) | Out-Null
      $footerRange.Font.Size = 8
    } catch {}
  }
}

function Set-DocumentPageLayout {
  [CmdletBinding()]
  param($Document)

  try {
    $Document.PageSetup.TopMargin = 56.7
    $Document.PageSetup.BottomMargin = 56.7
    $Document.PageSetup.LeftMargin = 56.7
    $Document.PageSetup.RightMargin = 56.7
  } catch {}
}

function Format-WordDocumentVisuals {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Document,
    [Parameter(Mandatory = $true)]
    $ContentRange,
    [Parameter(Mandatory = $true)]
    [object]$Config,
    $Logger = $null
  )

  if ($Logger) {
    Write-ValidationLog -Logger $Logger -Level INFO -Message 'Aplicando acabado visual al documento'
  }

  try {
    $ContentRange.Font.Size = 10
    $ContentRange.ParagraphFormat.SpaceAfter = 4
    $ContentRange.ParagraphFormat.LineSpacingRule = 0
    $ContentRange.ParagraphFormat.LineSpacing = 12
    $ContentRange.ParagraphFormat.Alignment = 3
  } catch {}

  foreach ($paragraph in $ContentRange.Paragraphs) {
    $text = [string]$paragraph.Range.Text
    $text = $text -replace "`r", ''
    $text = $text -replace "`a", ''
    $text = $text -replace "`n", ''
    $text = $text.Trim()
    if (-not $text) { continue }

    $styleName = ''
    try { $styleName = [string]$paragraph.Range.Style.NameLocal } catch {}

    if ($Config.styleMap.heading1 -contains $styleName) {
      $paragraph.Range.Font.Bold = $true
      $paragraph.Range.Font.Size = 16
      try { $paragraph.Range.Font.Color = 8606770 } catch {}
      $paragraph.Range.ParagraphFormat.SpaceBefore = 10
      $paragraph.Range.ParagraphFormat.SpaceAfter = 10
      $paragraph.Range.ParagraphFormat.KeepWithNext = -1
      try { $paragraph.Range.Shading.BackgroundPatternColor = 15132390 } catch {}
      continue
    }

    if ($Config.styleMap.heading2 -contains $styleName) {
      $paragraph.Range.Font.Bold = $true
      $paragraph.Range.Font.Size = 13
      try { $paragraph.Range.Font.Color = 8606770 } catch {}
      $paragraph.Range.ParagraphFormat.SpaceBefore = 8
      $paragraph.Range.ParagraphFormat.SpaceAfter = 6
      $paragraph.Range.ParagraphFormat.KeepWithNext = -1
      continue
    }

    if ($Config.styleMap.heading3 -contains $styleName) {
      $paragraph.Range.Font.Bold = $true
      $paragraph.Range.Font.Size = 11
      try { $paragraph.Range.Font.Color = 9200781 } catch {}
      $paragraph.Range.ParagraphFormat.SpaceBefore = 6
      $paragraph.Range.ParagraphFormat.SpaceAfter = 4
      $paragraph.Range.ParagraphFormat.KeepWithNext = -1
      continue
    }
  }

  foreach ($table in $ContentRange.Tables) {
    try { $table.Style = $Config.styleMap.table[0] } catch { try { $table.Style = $Config.styleMap.table[1] } catch {} }
    try { $table.AutoFitBehavior(2) | Out-Null } catch {}
    $table.Borders.Enable = 1
    $table.Rows.AllowBreakAcrossPages = 0
    try { $table.Rows.HeadingFormat = -1 } catch {}

    if ($table.Rows.Count -ge 1) {
      $header = $table.Rows.Item(1).Range
      $header.Font.Bold = $true
      $header.Font.Color = 16777215
      try { $header.Shading.BackgroundPatternColor = 8606770 } catch {}
    }

    for ($r = 2; $r -le $table.Rows.Count; $r++) {
      $rowRange = $table.Rows.Item($r).Range
      $rowRange.Font.Size = 9
      try {
        if (($r % 2) -eq 0) {
          $rowRange.Shading.BackgroundPatternColor = 15987699
        } else {
          $rowRange.Shading.BackgroundPatternColor = 16777215
        }
      } catch {}
    }
  }
}

function Convert-MarkdownToHtmlDocument {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$MarkdownText,
    [Parameter(Mandatory = $true)]
    [object]$Config,
    [ValidateSet('Preview','Final')]
    [string]$Mode = 'Final',
    [string]$AssetsBasePath = '',
    [int]$ProgressId = -1,
    [int]$ParentProgressId = -1,
    $Logger = $null
  )

  $lines = $MarkdownText -split "`r?`n"
  $index = 0
  $seenLevelOne = $false
  $builder = New-Object System.Text.StringBuilder
  $currentList = ''

  $null = $builder.AppendLine('<!DOCTYPE html>')
  $null = $builder.AppendLine('<html><head><meta charset="utf-8" />')
  $null = $builder.AppendLine('<style>')
  $null = $builder.AppendLine('body { font-family: Aptos, Calibri, Arial, sans-serif; font-size: 10pt; color: #1f2937; }')
  $null = $builder.AppendLine('h1 { font-size: 16pt; font-weight: bold; color: #0f3d63; background: #eef3f8; border-left: 6px solid #0f3d63; padding: 8px 10px; margin: 18px 0 8px 0; }')
  $null = $builder.AppendLine('h2 { font-size: 13pt; font-weight: bold; color: #0f3d63; margin: 14px 0 6px 0; border-bottom: 1px solid #d7e1ea; padding-bottom: 2px; }')
  $null = $builder.AppendLine('h3 { font-size: 11pt; font-weight: bold; color: #334155; margin: 10px 0 4px 0; }')
  $null = $builder.AppendLine('p { font-size: 10pt; margin: 0 0 5px 0; text-align: justify; }')
  $null = $builder.AppendLine('li { font-size: 10pt; margin: 0 0 3px 0; }')
  $null = $builder.AppendLine('ul, ol { margin-top: 2px; margin-bottom: 6px; }')
  $null = $builder.AppendLine('pre { font-family: Consolas, Courier New, monospace; font-size: 9pt; background: #f8fafc; border: 1px solid #d6dee8; padding: 8px; white-space: pre-wrap; }')
  $null = $builder.AppendLine('table { border-collapse: collapse; width: 100%; margin: 10px 0; }')
  $null = $builder.AppendLine('th, td { border: 1px solid #b9c4d1; padding: 4px 6px; font-size: 9pt; vertical-align: top; }')
  $null = $builder.AppendLine('th { background: #0f3d63; color: #ffffff; font-weight: bold; }')
  $null = $builder.AppendLine('img { max-width: 100%; }')
  $null = $builder.AppendLine('.flowchart { border-collapse: separate; border-spacing: 0; width: 100%; margin: 12px 0 16px 0; }')
  $null = $builder.AppendLine('.flowchart td, .flowchart th { border: 1px solid #aebccc; padding: 6px 8px; }')
  $null = $builder.AppendLine('.flow-index { background: #eef3f8; text-align: center; font-weight: bold; color: #0f3d63; }')
  $null = $builder.AppendLine('.flow-step { background: #f8fbfd; font-weight: 600; }')
  $null = $builder.AppendLine('.flow-arrow { border: none !important; text-align: center; font-size: 14pt; font-weight: bold; color: #0f3d63; padding: 2px 0 6px 0; }')
  $null = $builder.AppendLine('.page-break { page-break-before: always; }')
  $null = $builder.AppendLine('</style></head><body>')

  while ($index -lt $lines.Count) {
    $line = $lines[$index]
    $trimmed = $line.Trim()

    if ($ProgressId -ge 0 -and (($index % 25) -eq 0 -or $index -eq ($lines.Count - 1))) {
      $percent = if ($lines.Count -gt 0) { [Math]::Min(80, [int](35 + (($index / [double]$lines.Count) * 45))) } else { 35 }
      Show-ValidationProgress -Id $ProgressId -ParentId $ParentProgressId -Activity 'Generando documento Word' -Status ("Renderizando contenido ({0}/{1})" -f ($index + 1), $lines.Count) -PercentComplete $percent
    }
    if ($Logger -and (($index % 100) -eq 0 -or $index -eq ($lines.Count - 1))) {
      Write-ValidationLog -Logger $Logger -Level INFO -Message 'Heartbeat de render' -Data @{ line = ($index + 1); total = $lines.Count; mode = $Mode }
    }

    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      if ($currentList) {
        $null = $builder.AppendLine("</$currentList>")
        $currentList = ''
      }
      $index++
      continue
    }

    if ($trimmed -match '^!\[(.*?)\]\((.+?)\)$') {
      if ($currentList) {
        $null = $builder.AppendLine("</$currentList>")
        $currentList = ''
      }
      $caption = Convert-ValidationTextToHtml $matches[1]
      $imgPath = $matches[2]
      if ($AssetsBasePath -and -not [System.IO.Path]::IsPathRooted($imgPath)) {
        $imgPath = Resolve-ValidationPath -PathValue $imgPath -BasePath $AssetsBasePath
      }
      if (Test-Path $imgPath) {
        $imgUri = ([System.Uri](Resolve-ValidationPath -PathValue $imgPath -BasePath (Get-Location).Path)).AbsoluteUri
        $null = $builder.AppendLine("<p><img src='$imgUri' alt='$caption' /></p>")
        if ($caption) {
          $null = $builder.AppendLine("<p>$caption</p>")
        }
      }
      $index++
      continue
    }

    if ($trimmed -match '^```') {
      if ($currentList) {
        $null = $builder.AppendLine("</$currentList>")
        $currentList = ''
      }
      $fenceInfo = ($trimmed -replace '^```', '').Trim().ToLowerInvariant()
      $codeLines = New-Object System.Collections.Generic.List[string]
      $index++
      while ($index -lt $lines.Count -and ($lines[$index].Trim() -notmatch '^```')) {
        $codeLines.Add($lines[$index])
        $index++
      }
      if (Test-ValidationFlowBlock -FenceInfo $fenceInfo -CodeLines $codeLines) {
        $flowHtml = Convert-ValidationFlowBlockToHtml -CodeLines $codeLines
        if ($flowHtml) {
          $null = $builder.AppendLine($flowHtml)
        }
      } else {
        $codeText = [System.Net.WebUtility]::HtmlEncode(($codeLines -join [Environment]::NewLine))
        $null = $builder.AppendLine("<pre><code>$codeText</code></pre>")
      }
      if ($index -lt $lines.Count) { $index++ }
      continue
    }

    if ($trimmed.StartsWith('|')) {
      if ($currentList) {
        $null = $builder.AppendLine("</$currentList>")
        $currentList = ''
      }
      $tableLines = New-Object System.Collections.Generic.List[string]
      while ($index -lt $lines.Count -and $lines[$index].Trim().StartsWith('|')) {
        $tableLines.Add($lines[$index])
        $index++
      }
      $rows = New-Object System.Collections.Generic.List[object]
      for ($t = 0; $t -lt $tableLines.Count; $t++) {
        if ($t -eq 1 -and (Test-MarkdownTableSeparator $tableLines[$t])) { continue }
        $rows.Add((Split-MarkdownTableRow $tableLines[$t]))
      }
      if ($rows.Count -gt 0) {
        $null = $builder.AppendLine('<table>')
        for ($r = 0; $r -lt $rows.Count; $r++) {
          $null = $builder.AppendLine('<tr>')
          foreach ($cell in $rows[$r]) {
            $tag = if ($r -eq 0) { 'th' } else { 'td' }
            $cellText = Convert-ValidationTextToHtml $cell
            $null = $builder.AppendLine("<$tag>$cellText</$tag>")
          }
          $null = $builder.AppendLine('</tr>')
        }
        $null = $builder.AppendLine('</table>')
      }
      continue
    }

    if ($trimmed -match '^(#{1,3})\s+(.+)$') {
      if ($currentList) {
        $null = $builder.AppendLine("</$currentList>")
        $currentList = ''
      }
      $level = $matches[1].Length
      $text = Convert-ValidationTextToHtml $matches[2]
      if ($level -eq 1 -and $seenLevelOne -and $Mode -eq 'Final') {
        $null = $builder.AppendLine('<div class="page-break"></div>')
      }
      $null = $builder.AppendLine("<h$level>$text</h$level>")
      if ($level -eq 1) { $seenLevelOne = $true }
      $index++
      continue
    }

    if ($trimmed -match '^\d+\.\s+(.+)$') {
      if ($currentList -ne 'ol') {
        if ($currentList) { $null = $builder.AppendLine("</$currentList>") }
        $null = $builder.AppendLine('<ol>')
        $currentList = 'ol'
      }
      $itemText = Convert-ValidationTextToHtml $matches[1]
      $null = $builder.AppendLine("<li>$itemText</li>")
      $index++
      continue
    }

    if ($trimmed -match '^-+\s+(.+)$') {
      if ($currentList -ne 'ul') {
        if ($currentList) { $null = $builder.AppendLine("</$currentList>") }
        $null = $builder.AppendLine('<ul>')
        $currentList = 'ul'
      }
      $itemText = Convert-ValidationTextToHtml $matches[1]
      $null = $builder.AppendLine("<li>$itemText</li>")
      $index++
      continue
    }

    if ($currentList) {
      $null = $builder.AppendLine("</$currentList>")
      $currentList = ''
    }
    $paragraphText = Convert-ValidationTextToHtml $trimmed
    $null = $builder.AppendLine("<p>$paragraphText</p>")
    $index++
  }

  if ($currentList) {
    $null = $builder.AppendLine("</$currentList>")
  }
  $null = $builder.AppendLine('</body></html>')
  return $builder.ToString()
}

function Import-HtmlIntoWord {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Selection,
    [Parameter(Mandatory = $true)]
    [string]$HtmlContent,
    $Logger = $null
  )

  $tempHtml = Join-Path ([System.IO.Path]::GetTempPath()) ("validation_render_{0}.html" -f ([guid]::NewGuid().ToString('N')))
  try {
    Set-Content -Path $tempHtml -Value $HtmlContent -Encoding UTF8
    if ($Logger) {
      Write-ValidationLog -Logger $Logger -Level INFO -Message 'Insertando HTML temporal en Word' -Data @{ temp = $tempHtml }
    }
    $Selection.InsertFile($tempHtml)
  } finally {
    if (Test-Path $tempHtml) {
      Remove-Item $tempHtml -Force -ErrorAction SilentlyContinue
    }
  }
}

function Convert-MarkdownToWord {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    $Document,
    [Parameter(Mandatory = $true)]
    $Selection,
    [Parameter(Mandatory = $true)]
    [string]$MarkdownText,
    [Parameter(Mandatory = $true)]
    [object]$Config,
    [ValidateSet('Preview','Final')]
    [string]$Mode = 'Final',
    [string]$AssetsBasePath = '',
    [int]$ProgressId = -1,
    [int]$ParentProgressId = -1,
    $Logger = $null
  )

  if ($ProgressId -ge 0) {
    Show-ValidationProgress -Id $ProgressId -ParentId $ParentProgressId -Activity 'Generando documento Word' -Status 'Convirtiendo markdown a HTML' -PercentComplete 35
  }
  if ($Logger) {
    Write-ValidationLog -Logger $Logger -Level INFO -Message 'Convirtiendo markdown a HTML'
  }
  $htmlContent = Convert-MarkdownToHtmlDocument -MarkdownText $MarkdownText -Config $Config -Mode $Mode -AssetsBasePath $AssetsBasePath -ProgressId $ProgressId -ParentProgressId $ParentProgressId -Logger $Logger

  if ($ProgressId -ge 0) {
    Show-ValidationProgress -Id $ProgressId -ParentId $ParentProgressId -Activity 'Generando documento Word' -Status 'Importando HTML en Word' -PercentComplete 82
  }
  if ($Logger) {
    Write-ValidationLog -Logger $Logger -Level INFO -Message 'Importando HTML en Word'
  }
  $contentStart = $Selection.Range.Start
  Import-HtmlIntoWord -Selection $Selection -HtmlContent $htmlContent -Logger $Logger
  $contentEnd = $Selection.Range.End
  $contentRange = $Document.Range($contentStart, $contentEnd)
  Format-WordDocumentVisuals -Document $Document -ContentRange $contentRange -Config $Config -Logger $Logger
}

Export-ModuleMember -Function *-*



