[CmdletBinding()]
param(
  [string]$SourcePath = '',
  [string]$OutputPath = '',
  [string]$ConfigPath = '',
  [ValidateSet('Preview','Final')]
  [string]$Mode = 'Final',
  [string]$LogPath = ''
)

$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'modules\ValidationDocTools.psm1') -Force

$config = if ($ConfigPath) { Import-ValidationConfig -ConfigPath $ConfigPath -ForceReload } else { Import-ValidationConfig }
$logger = New-ValidationLogger -Operation 'prepare_template' -LogsDir $LogPath -Config $config
$progressId = 41

function Get-ParagraphByContains($Document, [string]$Token) {
  foreach ($paragraph in $Document.Paragraphs) {
    $value = ($paragraph.Range.Text -replace "`r", '' -replace "`a", '' -replace "`n", '').Trim()
    if ($value -like "*$Token*") { return $paragraph }
  }
  throw "No se encontro el parrafo que contiene: $Token"
}

function Find-ParagraphByContains($Document, [string]$Token) {
  foreach ($paragraph in $Document.Paragraphs) {
    $value = ($paragraph.Range.Text -replace "`r", '' -replace "`a", '' -replace "`n", '').Trim()
    if ($value -like "*$Token*") { return $paragraph }
  }
  return $null
}

function Set-ControlText($Document, [string]$ParagraphToken, [string]$Label, [string]$Tag, [string]$Title, [string]$DefaultValue) {
  $paragraph = Get-ParagraphByContains $Document $ParagraphToken
  $lineRange = $Document.Range($paragraph.Range.Start, $paragraph.Range.End - 1)
  $lineRange.Text = $Label
  $insertRange = $Document.Range($lineRange.End, $lineRange.End)
  $control = $Document.ContentControls.Add(1, $insertRange)
  $control.Title = $Title
  $control.Tag = $Tag
  $control.Range.Text = $DefaultValue
}

function Add-LabeledControlAfterParagraph($Document, [string]$AfterParagraphToken, [string]$Label, [string]$Tag, [string]$Title, [string]$DefaultValue) {
  $paragraph = Get-ParagraphByContains $Document $AfterParagraphToken
  $insertRange = $Document.Range($paragraph.Range.End, $paragraph.Range.End)
  $insertRange.InsertAfter("$Label`r")
  $newParagraph = Get-ParagraphByContains $Document $Label.Trim()
  $labelRange = $Document.Range($newParagraph.Range.Start, $newParagraph.Range.End - 1)
  $labelRange.Text = $Label
  $controlRange = $Document.Range($labelRange.End, $labelRange.End)
  $control = $Document.ContentControls.Add(1, $controlRange)
  $control.Title = $Title
  $control.Tag = $Tag
  $control.Range.Text = $DefaultValue
}

function Add-BodyContentControl($Document) {
  $anchorRange = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
  $anchorRange.InsertAfter("`r")
  $anchorRange = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
  $control = $Document.ContentControls.Add(0, $anchorRange)
  $control.Title = 'Cuerpo del documento'
  $control.Tag = 'body_content'
  $control.Range.Text = 'El generador insertara aqui el contenido formateado del documento.'
}

function Add-MetadataFrontBlock($Document) {
  $Document.Range(0, 0).InsertAfter("PLANTILLA INSTITUCIONAL DE VALIDACION DE SISTEMAS`rFamProject Cia. Ltda.`rDocumento: `rArea: `rSistema: `rCodigo: `rVersion: `rFecha: `rEstado: `r`r")
  Add-LabeledControlAfterParagraph -Document $Document -AfterParagraphToken 'FamProject' -Label 'Documento: ' -Tag 'doc_title' -Title 'Titulo del documento' -DefaultValue '__________________________'
  Add-LabeledControlAfterParagraph -Document $Document -AfterParagraphToken 'Documento:' -Label 'Area: ' -Tag 'doc_area' -Title 'Area' -DefaultValue '__________________________'
  Set-ControlText -Document $Document -ParagraphToken 'Sistema:' -Label 'Sistema: ' -Tag 'meta_system' -Title 'Sistema' -DefaultValue 'SPI'
  Set-ControlText -Document $Document -ParagraphToken 'Codigo:' -Label 'Codigo: ' -Tag 'meta_code' -Title 'Codigo' -DefaultValue 'VAL-SPI-XXX'
  Set-ControlText -Document $Document -ParagraphToken 'Version:' -Label 'Version: ' -Tag 'meta_version' -Title 'Version' -DefaultValue '1.0'
  Set-ControlText -Document $Document -ParagraphToken 'Fecha:' -Label 'Fecha: ' -Tag 'meta_date' -Title 'Fecha' -DefaultValue '__________________'
  Set-ControlText -Document $Document -ParagraphToken 'Estado:' -Label 'Estado: ' -Tag 'meta_status' -Title 'Estado' -DefaultValue 'BORRADOR'
}

try {
  Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Inicializando configuracion' -PercentComplete 5
  $source = if ($SourcePath) { Resolve-ValidationPath -PathValue $SourcePath -BasePath (Get-Location).Path } else { Get-ValidationTemplatePath -SourceTemplate -Config $config }
  if (-not $OutputPath) {
    $OutputPath = Resolve-ValidationPath -PathValue (Join-Path $config.paths.templateDir $config.templates.automatable) -BasePath (Get-Location).Path
  } else {
    $OutputPath = Resolve-ValidationPath -PathValue $OutputPath -BasePath (Get-Location).Path
  }

  Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Validando prerequisitos' -PercentComplete 15
  $null = Test-ValidationPrerequisites -TemplatePath $source -OutputPath $OutputPath -Logger $logger

  $word = $null
  $sourceDoc = $null
  $targetDoc = $null

  try {
    Write-ValidationLog -Logger $logger -Level INFO -Message 'Abriendo Word y plantilla fuente' -Data @{ source = $source; mode = $Mode }
    Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Abriendo Word y plantilla base' -PercentComplete 30
    $word = Start-WordApplication -Logger $logger
    $sourceDoc = Invoke-ValidationRetry -Logger $logger -Description 'Apertura de plantilla fuente' -Action { $word.Documents.Open($source, $false, $true) }
    $targetDoc = $word.Documents.Add()

    Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Construyendo portada y controles' -PercentComplete 55
    $bodyStart = Get-ParagraphByContains $sourceDoc '1. INTRODU'
    $frontRange = $sourceDoc.Range($sourceDoc.Content.Start, $bodyStart.Range.Start)
    $targetDoc.Range(0, 0).FormattedText = $frontRange.FormattedText

    if (Find-ParagraphByContains $targetDoc 'FamProject') {
      Add-LabeledControlAfterParagraph -Document $targetDoc -AfterParagraphToken 'FamProject' -Label 'Documento: ' -Tag 'doc_title' -Title 'Titulo del documento' -DefaultValue '__________________________'
      Add-LabeledControlAfterParagraph -Document $targetDoc -AfterParagraphToken 'Documento:' -Label 'Area: ' -Tag 'doc_area' -Title 'Area' -DefaultValue '__________________________'
      Set-ControlText -Document $targetDoc -ParagraphToken 'Sistema:' -Label 'Sistema: ' -Tag 'meta_system' -Title 'Sistema' -DefaultValue 'SPI'
      Set-ControlText -Document $targetDoc -ParagraphToken 'VAL-SPI-XXX' -Label 'Codigo: ' -Tag 'meta_code' -Title 'Codigo' -DefaultValue 'VAL-SPI-XXX'
      Set-ControlText -Document $targetDoc -ParagraphToken '1.0' -Label 'Version: ' -Tag 'meta_version' -Title 'Version' -DefaultValue '1.0'
      Set-ControlText -Document $targetDoc -ParagraphToken 'Fecha:' -Label 'Fecha: ' -Tag 'meta_date' -Title 'Fecha' -DefaultValue '__________________'
      Set-ControlText -Document $targetDoc -ParagraphToken 'Estado:' -Label 'Estado: ' -Tag 'meta_status' -Title 'Estado' -DefaultValue 'BORRADOR'
    } else {
      Add-MetadataFrontBlock -Document $targetDoc
    }

    Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Insertando TOC y cuerpo dinamico' -PercentComplete 75
    $tocParagraph = Get-ParagraphByContains $targetDoc 'Actualizar en Word'
    $tocRange = $targetDoc.Range($tocParagraph.Range.Start, $tocParagraph.Range.End - 1)
    $tocRange.Text = ''
    $targetDoc.TablesOfContents.Add($targetDoc.Range($tocParagraph.Range.Start, $tocParagraph.Range.Start), $true, 1, 3) | Out-Null

    Add-BodyContentControl -Document $targetDoc
    Set-CoverFormatting -Document $targetDoc -Config $config

    if ($Mode -eq 'Final') {
      Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Actualizando tabla de contenido' -PercentComplete 88
      $targetDoc.TablesOfContents | ForEach-Object { $_.Update() }
    }

    Write-ValidationLog -Logger $logger -Level INFO -Message 'Guardando plantilla automatizable' -Data @{ output = $OutputPath }
    Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Guardando plantilla final' -PercentComplete 96
    $targetDoc.SaveAs([ref]$OutputPath, [ref]14)
  }
  finally {
    Close-WordApplication -Word $word -Documents @($sourceDoc, $targetDoc)
  }

  Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Completado' -PercentComplete 100 -Completed
  Complete-ValidationLogger -Logger $logger -Result OK
  Write-Output "Plantilla automatizable creada: $OutputPath"
}
catch {
  Show-ValidationProgress -Id $progressId -Activity 'Preparando plantilla automatizable' -Status 'Fallo' -Completed
  Write-ValidationLog -Logger $logger -Level ERROR -Message 'Fallo en preparacion de plantilla' -Data @{ error = $_.Exception.Message }
  Complete-ValidationLogger -Logger $logger -Result FAILED
  throw
}
