[CmdletBinding()]
param(
  [string]$GeneralPath = 'docs/validation/general',
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
$logger = New-ValidationLogger -Operation 'generate_general_package' -LogsDir $LogPath -Config $config
$progressId = 44

try {
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status 'Inicializando' -PercentComplete 5

  $generalFullPath = Resolve-ValidationPath -PathValue $GeneralPath -BasePath (Get-Location).Path
  if (-not (Test-Path $generalFullPath)) {
    throw "No existe la ruta general: $generalFullPath"
  }

  if (-not $config.generalValidation) {
    throw 'No existe la seccion generalValidation en scripts/validation-doc.config.json'
  }

  $gv = $config.generalValidation
  $docTitle = if ($gv.title) { [string]$gv.title } else { 'Paquete de Validacion General Inicial de FamSPI v1.0.0' }
  $docArea = if ($gv.area) { [string]$gv.area } else { 'FamSPI v1.0.0 - Validacion Global, Gobierno y Seguridad, Permisos y Vacaciones' }
  $docCode = if ($gv.code) { [string]$gv.code } else { 'VAL-FAMSPI-GENERAL-BASELINE' }

  if ([string]::IsNullOrWhiteSpace($OutputDocx)) {
    $outputName = if ($gv.outputName) { [string]$gv.outputName } else { 'PAQUETE_VALIDACION_GENERAL_FAMSPI_V1_0_0.docx' }
    $OutputDocx = Join-Path $generalFullPath $outputName
  }

  $order = @()
  if ($gv.documentOrder) {
    foreach ($name in $gv.documentOrder) {
      if ([string]::IsNullOrWhiteSpace($name)) { continue }
      if ($name -like '00_*') { continue }
      $candidate = Join-Path $generalFullPath $name
      if (Test-Path $candidate) { $order += $candidate }
    }
  }

  if ($order.Count -eq 0) {
    $order = Get-ChildItem $generalFullPath -File -Filter '*.md' |
      Where-Object { $_.Name -notlike '00_*' } |
      Sort-Object Name |
      ForEach-Object { $_.FullName }
  }

  if ($order.Count -eq 0) {
    throw "No se encontraron archivos markdown consolidables en $generalFullPath"
  }

  Write-ValidationLog -Logger $logger -Level INFO -Message 'Consolidando paquete general' -Data @{ files = $order.Count; mode = $Mode }
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status 'Consolidando markdown' -PercentComplete 25

  $builder = New-Object System.Text.StringBuilder
  $docFilesMap = @{}

  for ($i = 0; $i -lt $order.Count; $i++) {
    $file = $order[$i]
    $fileName = [IO.Path]::GetFileName($file)
    $percent = 25 + [int](($i / [Math]::Max(1, $order.Count)) * 35)
    Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status ("Consolidando {0}/{1}: {2}" -f ($i + 1), $order.Count, $fileName) -PercentComplete $percent

    $content = Get-Content $file -Raw -Encoding UTF8
    $content = Repair-ValidationDocumentText -Text $content
    $docFilesMap[$fileName.ToLowerInvariant()] = $content
    [void]$builder.AppendLine($content.Trim())
    [void]$builder.AppendLine()
    [void]$builder.AppendLine()
  }

  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status 'Generando Anexos WHO App5 (A-H)' -PercentComplete 62
  $annexMarkdown = Build-WhoAnnexMarkdown `
    -DocumentFiles $docFilesMap `
    -AreaLabel $docArea `
    -Code $docCode `
    -IncludeAnnexes @('A','B','C','D','E','F','G','H')
  [void]$builder.AppendLine((Repair-ValidationDocumentText -Text $annexMarkdown))
  [void]$builder.AppendLine()

  $tempMd = Join-Path $env:TEMP ('validation_general_' + [guid]::NewGuid().ToString('N') + '.md')
  Set-Content -Path $tempMd -Value (Repair-ValidationDocumentText -Text $builder.ToString()) -Encoding UTF8

  try {
    Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status 'Generando DOCX' -PercentComplete 70
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

  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status 'Completado' -PercentComplete 100 -Completed
  Complete-ValidationLogger -Logger $logger -Result OK
}
catch {
  Show-ValidationProgress -Id $progressId -Activity 'Generando paquete general FamSPI' -Status 'Fallo' -Completed
  Write-ValidationLog -Logger $logger -Level ERROR -Message 'Fallo en paquete general' -Data @{ error = $_.Exception.Message }
  Complete-ValidationLogger -Logger $logger -Result FAILED
  throw
}
