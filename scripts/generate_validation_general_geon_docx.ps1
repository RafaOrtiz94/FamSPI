[CmdletBinding()]
param(
  [string]$GeonPath = 'docs/validation/general_GEON',
  [string]$TemplatePath = '',
  [string]$ConfigPath = '',
  [string]$Version = '1.0.0',
  [ValidateSet('BORRADOR','APROBADO','VIGENTE')]
  [string]$Status = 'BORRADOR',
  [ValidateSet('Preview','Final')]
  [string]$Mode = 'Final',
  [string]$LogPath = '',
  [string]$OutputDocx = ''
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules\ValidationDocTools.psm1') -Force

$config = if ($ConfigPath) { Import-ValidationConfig -ConfigPath $ConfigPath -ForceReload } else { Import-ValidationConfig }
$logger = New-ValidationLogger -Operation 'generate_geon_package' -LogsDir $LogPath -Config $config
$progressId = 45

try {
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status 'Inicializando' -PercentComplete 5

  $geonFullPath = Resolve-ValidationPath -PathValue $GeonPath -BasePath (Get-Location).Path
  if (-not (Test-Path $geonFullPath)) {
    throw "No existe la ruta GEON: $geonFullPath"
  }

  if (-not $config.generalValidationGeon) {
    throw 'No existe la seccion generalValidationGeon en validation-doc.config.json'
  }

  $gv = $config.generalValidationGeon
  $docTitle   = if ($gv.title)      { [string]$gv.title }      else { 'Paquete de Validacion General Inicial de FamSPI v1.0.0 - GEON/OMCL Annex 2' }
  $docArea    = if ($gv.area)       { [string]$gv.area }       else { 'FamSPI v1.0.0 - Validacion de Sistema Computarizado Complejo' }
  $docCode    = if ($gv.code)       { [string]$gv.code }       else { 'VAL-FAMSPI-GEON-V1-0-0' }

  if ([string]::IsNullOrWhiteSpace($OutputDocx)) {
    $outputName = if ($gv.outputName) { [string]$gv.outputName } else { 'PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0_GEON_ANNEX2.docx' }
    $OutputDocx = Join-Path $geonFullPath $outputName
  }

  # Patrones a omitir del DOCX (README y comparativo son solo internos)
  $omitPatterns = @('00_*', '09_comparativo*')
  if ($gv.omitPatterns) {
    $omitPatterns = @($gv.omitPatterns)
  }

  # Construir lista ordenada de archivos
  $order = @()
  if ($gv.documentOrder) {
    foreach ($name in $gv.documentOrder) {
      if ([string]::IsNullOrWhiteSpace($name)) { continue }
      $omit = $false
      foreach ($pat in $omitPatterns) {
        if ($name -like $pat) { $omit = $true; break }
      }
      if ($omit) { continue }
      $candidate = Join-Path $geonFullPath $name
      if (Test-Path $candidate) { $order += $candidate }
    }
  }

  # Fallback: todos los .md del directorio, respetando omitPatterns
  if ($order.Count -eq 0) {
    $order = Get-ChildItem $geonFullPath -File -Filter '*.md' |
      Where-Object {
        $f = $_.Name
        $skip = $false
        foreach ($pat in $omitPatterns) { if ($f -like $pat) { $skip = $true; break } }
        -not $skip
      } |
      Sort-Object Name |
      ForEach-Object { $_.FullName }
  }

  if ($order.Count -eq 0) {
    throw "No se encontraron archivos GEON consolidables en $geonFullPath"
  }

  Write-ValidationLog -Logger $logger -Level INFO -Message 'Consolidando paquete GEON' -Data @{ files = $order.Count; mode = $Mode }
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status 'Consolidando markdown GEON' -PercentComplete 20

  $builder   = New-Object System.Text.StringBuilder
  $docFilesMap = @{}

  for ($i = 0; $i -lt $order.Count; $i++) {
    $file     = $order[$i]
    $fileName = [IO.Path]::GetFileName($file)
    $percent  = 20 + [int](($i / [Math]::Max(1, $order.Count)) * 38)
    Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status ("Consolidando {0}/{1}: {2}" -f ($i + 1), $order.Count, $fileName) -PercentComplete $percent

    $content = Get-Content $file -Raw -Encoding UTF8
    $content = Repair-ValidationDocumentText -Text $content
    $docFilesMap[$fileName.ToLowerInvariant()] = $content
    [void]$builder.AppendLine($content.Trim())
    [void]$builder.AppendLine()
    [void]$builder.AppendLine()
  }

  # Anexos WHO App5 adaptados a GEON (A-H)
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status 'Generando Anexos GEON (A-H)' -PercentComplete 60
  $annexMarkdown = Build-WhoAnnexMarkdown `
    -DocumentFiles $docFilesMap `
    -AreaLabel $docArea `
    -Code $docCode `
    -IncludeAnnexes @('C','E','F','G','H')   # URS y FRS ya estan embebidos en 03_urs; IQ/OQ/PQ en 04-06
  [void]$builder.AppendLine((Repair-ValidationDocumentText -Text $annexMarkdown))
  [void]$builder.AppendLine()

  $tempMd = Join-Path $env:TEMP ('validation_geon_' + [guid]::NewGuid().ToString('N') + '.md')
  Set-Content -Path $tempMd -Value (Repair-ValidationDocumentText -Text $builder.ToString()) -Encoding UTF8

  try {
    Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status 'Generando DOCX' -PercentComplete 70
    & (Join-Path $PSScriptRoot 'generate_validation_docx_from_template.ps1') `
      -SourceMarkdown $tempMd `
      -OutputDocx $OutputDocx `
      -TemplatePath $TemplatePath `
      -ConfigPath $ConfigPath `
      -DocumentKind package `
      -Area $docArea `
      -Code $docCode `
      -Version $Version `
      -Status $Status `
      -Mode $Mode `
      -LogPath $LogPath `
      -DocumentTitle $docTitle
  }
  finally {
    if (Test-Path $tempMd) { Remove-Item $tempMd -Force }
  }

  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status 'Completado' -PercentComplete 100 -Completed
  Complete-ValidationLogger -Logger $logger -Result OK
  Write-Output "Paquete GEON generado: $OutputDocx"
}
catch {
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete GEON FamSPI' -Status 'Fallo' -Completed
  Write-ValidationLog -Logger $logger -Level ERROR -Message 'Fallo en paquete GEON' -Data @{ error = $_.Exception.Message }
  Complete-ValidationLogger -Logger $logger -Result FAILED
  throw
}
