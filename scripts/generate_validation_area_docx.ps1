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
  [string]$CodePrefix = 'VAL-SPI',
  [ValidateSet('Preview','Final')]
  [string]$Mode = 'Final',
  [string]$AssetsPath = '',
  [string]$LogPath = ''
)

$ErrorActionPreference = 'Stop'

$generator = Join-Path $PSScriptRoot 'generate_validation_area_single_docx.ps1'
& $generator `
  -AreaPath $AreaPath `
  -AreaLabel $AreaLabel `
  -TemplatePath $TemplatePath `
  -ConfigPath $ConfigPath `
  -Version $Version `
  -Status $Status `
  -Mode $Mode `
  -AssetsPath $AssetsPath `
  -LogPath $LogPath `
  -Code ($CodePrefix + '-PAQUETE')
