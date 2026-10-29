[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path $_ })]
  [string]$SourceMarkdown,
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$OutputDocx,
  [string]$TemplatePath = '',
  [string]$ConfigPath = '',
  [ValidateSet('package','urs','frs','dds','dd','iq','oq','pq','findings','evidence')]
  [string]$DocumentKind = 'package',
  [string]$DocumentTitle,
  [string]$Area = '',
  [string]$SystemName = 'SPI',
  [string]$Code = '',
  [string]$Version = '1.0',
  [ValidateSet('BORRADOR','APROBADO','VIGENTE')]
  [string]$Status = 'BORRADOR',
  [string]$DocumentDate = '',
  [ValidateSet('Preview','Final')]
  [string]$Mode = 'Final',
  [string]$AssetsPath = '',
  [string]$LogPath = ''
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules\ValidationDocTools.psm1') -Force

$config = if ($ConfigPath) { Import-ValidationConfig -ConfigPath $ConfigPath -ForceReload } else { Import-ValidationConfig }
$logger = New-ValidationLogger -Operation 'generate_docx' -LogsDir $LogPath -Config $config
$progressId = 42

try {
  Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Inicializando' -PercentComplete 5
  $source = Resolve-ValidationPath -PathValue $SourceMarkdown -BasePath (Get-Location).Path
  $template = if ($TemplatePath) { Resolve-ValidationPath -PathValue $TemplatePath -BasePath (Get-Location).Path } else { Get-ValidationTemplatePath -DocumentKind $DocumentKind -Config $config }
  $output = Resolve-ValidationPath -PathValue $OutputDocx -BasePath (Get-Location).Path
  Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Validando prerequisitos' -PercentComplete 10
  $null = Test-ValidationPrerequisites -TemplatePath $template -OutputPath $output -Logger $logger

  Write-ValidationLog -Logger $logger -Level INFO -Message 'Cargando markdown origen' -Data @{ source = $source }
  Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Cargando markdown' -PercentComplete 15
  $markdown = Get-Content $source -Raw -Encoding UTF8
  if (-not $DocumentTitle) {
    $firstHeading = [regex]::Match($markdown, '(?m)^#\s+(.+)$')
    $DocumentTitle = if ($firstHeading.Success) { $firstHeading.Groups[1].Value.Trim() } else { [System.IO.Path]::GetFileNameWithoutExtension($source) }
  }
  if (-not $Code) {
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($source).ToUpperInvariant() -replace '[^A-Z0-9]+', '-'
    $Code = "VAL-SPI-$stem"
  }
  if (-not $DocumentDate) {
    $DocumentDate = (Get-Date).ToString('yyyy-MM-dd')
  }

  $word = $null
  $doc = $null
  try {
    Write-ValidationLog -Logger $logger -Level INFO -Message 'Abriendo Word y plantilla' -Data @{ template = $template; mode = $Mode; kind = $DocumentKind }
    Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Abriendo Word y plantilla' -PercentComplete 25
    $word = Start-WordApplication -Logger $logger
    $doc = Invoke-ValidationRetry -Logger $logger -Description 'Creacion de documento desde plantilla' -Action { $word.Documents.Add($template) }

    Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Poblando metadatos' -PercentComplete 30

    $requiredTags = @('doc_title','doc_area','meta_system','meta_code','meta_version','meta_date','meta_status','body_content')
    $missingTags = @()
    foreach ($tag in $requiredTags) {
      $found = $false
      foreach ($ctrl in $doc.ContentControls) { if ($ctrl.Tag -eq $tag) { $found = $true; break } }
      if (-not $found) { $missingTags += $tag }
    }
    if ($missingTags.Count -gt 0) {
      throw "La plantilla '$template' no contiene los content controls requeridos: $($missingTags -join ', '). Verifique que la plantilla .dotx tenga controles con los tags correctos."
    }

    (Get-ControlByTag -Document $doc -Tag 'doc_title').Range.Text = $DocumentTitle
    (Get-ControlByTag -Document $doc -Tag 'doc_area').Range.Text = $Area
    (Get-ControlByTag -Document $doc -Tag 'meta_system').Range.Text = $SystemName
    (Get-ControlByTag -Document $doc -Tag 'meta_code').Range.Text = $Code
    (Get-ControlByTag -Document $doc -Tag 'meta_version').Range.Text = $Version
    (Get-ControlByTag -Document $doc -Tag 'meta_date').Range.Text = $DocumentDate
    (Get-ControlByTag -Document $doc -Tag 'meta_status').Range.Text = $Status

    Set-CoverFormatting -Document $doc -Config $config
    Set-DocumentPageLayout -Document $doc
    Set-DocumentHeaderFooter -Document $doc -HeaderText "$Code | $Area | $Status" -FooterLeft "$SystemName $Version"

    $body = Get-ControlByTag -Document $doc -Tag 'body_content'
    $body.Range.Text = ''
    $selection = $word.Selection
    $selection.SetRange($body.Range.Start, $body.Range.Start)

    Write-ValidationLog -Logger $logger -Level INFO -Message 'Renderizando markdown a Word' -Data @{ assets = $AssetsPath }
    Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Renderizando contenido' -PercentComplete 35
    Convert-MarkdownToWord -Document $doc -Selection $selection -MarkdownText $markdown -Config $config -Mode $Mode -AssetsBasePath $AssetsPath -ProgressId $progressId -Logger $logger

    if ($Mode -eq 'Final') {
      Write-ValidationLog -Logger $logger -Level INFO -Message 'Actualizando tabla de contenido'
      Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Actualizando TOC y tablas' -PercentComplete 88
      foreach ($toc in $doc.TablesOfContents) {
        Invoke-ValidationRetry -Logger $logger -Description 'Actualizacion de TOC' -Action { $toc.Update() | Out-Null }
      }
      try {
        $word.ActiveWindow.View.ShowFieldCodes = $false
      } catch {}
      foreach ($table in $doc.Tables) {
        try { $table.AutoFitBehavior(1) | Out-Null } catch {}
      }
    }

    Write-ValidationLog -Logger $logger -Level INFO -Message 'Guardando documento final' -Data @{ output = $output }
    Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Guardando documento final' -PercentComplete 96
    Invoke-ValidationRetry -Logger $logger -Description 'Guardado de documento' -Action { $doc.SaveAs([ref]$output, [ref]16) }
  }
  finally {
    Close-WordApplication -Word $word -Documents @($doc)
  }

  Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Completado' -PercentComplete 100 -Completed
  Complete-ValidationLogger -Logger $logger -Result OK
  Write-Output "Documento generado: $output"
}
catch {
  Show-ValidationProgress -Id $progressId -Activity 'Generando documento Word' -Status 'Fallo' -Completed
  Write-ValidationLog -Logger $logger -Level ERROR -Message 'Fallo en generacion DOCX' -Data @{ error = $_.Exception.Message }
  Complete-ValidationLogger -Logger $logger -Result FAILED
  throw
}
