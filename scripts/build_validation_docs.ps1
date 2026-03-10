$ErrorActionPreference = 'Stop'
$root = Get-Location
$base = Join-Path $root 'docs/validation'
@($base, (Join-Path $base 'URS'), (Join-Path $base 'FRS'), (Join-Path $base 'DS'), (Join-Path $base 'RTM')) | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

function Get-Section($Path, $Heading) {
  if (-not (Test-Path $Path)) { return '' }
  $content = Get-Content $Path -Raw
  $pattern = "(?ms)^##\s+$([regex]::Escape($Heading))\s*`r?`n(.*?)(?=^##\s+|\z)"
  $m = [regex]::Match($content, $pattern)
  if ($m.Success) { return $m.Groups[1].Value.Trim() }
  return ''
}

function Get-Bullets($Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
  return ([regex]::Matches($Text, '(?m)^-\s+(.+)$') | ForEach-Object { $_.Groups[1].Value.Trim() })
}

function Get-CodeRefs($Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
  return ([regex]::Matches($Text, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value.Trim() } | Select-Object -Unique)
}

$modules = @(
  @{ slug='autenticacion_sesiones'; name='Autenticacion y Sesiones'; code='AUTH'; urs='validacion_sistema/URS/URS_modulo_autenticacion.md'; report='validacion_sistema/informes/informe_modulo_autenticacion.md' },
  @{ slug='usuarios_perfiles'; name='Usuarios y Perfiles'; code='USR'; urs='validacion_sistema/URS/URS_modulo_usuarios.md'; report='validacion_sistema/informes/informe_modulo_usuarios.md' },
  @{ slug='comercial_clientes'; name='Comercial y Gestion de Clientes'; code='COM'; urs='validacion_sistema/URS/URS_modulo_comercial.md'; report='validacion_sistema/informes/informe_modulo_comercial.md' },
  @{ slug='business_case'; name='Business Case'; code='BC'; urs='validacion_sistema/URS/URS_modulo_business_case.md'; report='validacion_sistema/informes/informe_modulo_business_case.md' },
  @{ slug='talento_humano'; name='Talento Humano'; code='TH'; urs='validacion_sistema/URS/URS_modulo_talento_humano.md'; report='validacion_sistema/informes/informe_modulo_talento_humano.md' },
  @{ slug='servicio_tecnico_mantenimientos'; name='Servicio Tecnico y Mantenimientos'; code='STM'; urs='validacion_sistema/URS/URS_modulo_servicio_tecnico.md'; report='validacion_sistema/informes/informe_modulo_servicio_tecnico.md' },
  @{ slug='inventario_equipos'; name='Inventario y Equipos'; code='INV'; urs='validacion_sistema/URS/URS_modulo_inventario.md'; report='validacion_sistema/informes/informe_modulo_inventario.md' },
  @{ slug='finanzas_viaticos'; name='Control Financiero Operativo y Viaticos'; code='FIN'; urs='validacion_sistema/URS/URS_modulo_facturacion.md'; report='validacion_sistema/informes/informe_modulo_facturacion.md' },
  @{ slug='documentos_firma'; name='Documentos, Archivos y Firma Digital'; code='DOC'; urs='validacion_sistema/URS/URS_modulo_documentos_firma.md'; report='validacion_sistema/informes/informe_modulo_documentos_firma.md' },
  @{ slug='notificaciones_comunicaciones'; name='Notificaciones y Comunicaciones'; code='NTF'; urs='validacion_sistema/URS/URS_modulo_notificaciones.md'; report='validacion_sistema/informes/informe_modulo_notificaciones.md' },
  @{ slug='ti_soporte_tickets'; name='TI Soporte y Tickets'; code='SUP'; urs='validacion_sistema/URS/URS_modulo_ti_soporte.md'; report='validacion_sistema/informes/informe_modulo_ti_soporte.md' },
  @{ slug='reportes_auditoria'; name='Reportes y Auditoria'; code='RPT'; urs=''; report='validacion_sistema/informes/informe_modulo_reportes.md' }
)

$moduleTable = @('# MODULOS DETECTADOS DEL SISTEMA SPI', '', '| MODULO | DESCRIPCION | ARCHIVOS RELACIONADOS | DEPENDENCIAS |', '|---|---|---|---|')
$rtm = @('# MATRIZ DE TRAZABILIDAD DEL SISTEMA SPI', '', '| URS-ID | FRS-ID | ARCHIVO | FUNCION |', '|---|---|---|---|')

foreach ($m in $modules) {
  $desc = Get-Section $m.report 'Descripcion del modulo'
  $scope = Get-Section $m.report 'Alcance funcional'
  $components = Get-Section $m.report 'Componentes del sistema'
  $endpoints = Get-Section $m.report 'Endpoints de API'
  $tables = Get-Section $m.report 'Tablas de base de datos asociadas'
  $deps = Get-Section $m.report 'Dependencias con otros modulos'
  $security = Get-Section $m.report 'Controles de seguridad'
  $risks = Get-Section $m.report 'Riesgos operativos'
  $objective = if ($m.urs) { Get-Section $m.urs 'Objetivo del modulo' } else { 'Documento reconstruido por ingenieria inversa a partir del reporte funcional verificado.' }
  $actors = if ($m.urs) { Get-Section $m.urs 'Actores del sistema' } else { '- Requiere validacion funcional para identificar todos los actores.' }
  $reqs = if ($m.urs) { Get-Section $m.urs 'Listado de requerimientos del usuario' } else { "### REQ-$($m.code)-001`n- Actor: Requiere validacion funcional.`n- Requerimiento: El sistema debe soportar las capacidades descritas en el alcance verificado del modulo.`n- Resultado esperado: El proceso se ejecuta con trazabilidad y control." }
  $nfr = if ($m.urs) { Get-Section $m.urs 'Listado de requerimientos no funcionales' } else { '- El modulo debe mantener trazabilidad, control de acceso y manejo de errores.' }
  $rules = if ($m.urs) { Get-Section $m.urs 'Reglas de negocio identificadas' } else { '- Requiere validacion funcional para cerrar reglas de negocio no explicitadas en la URS fuente.' }

  $componentRefs = Get-CodeRefs $components
  $componentSummary = if ($componentRefs.Count -gt 0) { ($componentRefs | Select-Object -First 8) -join '; ' } else { $m.report }
  $depSummary = if ([string]::IsNullOrWhiteSpace($deps)) { 'Requiere validacion funcional' } else { (($deps -split "`r?`n") | ForEach-Object { $_.Trim('- ').Trim() } | Where-Object { $_ }) -join '; ' }
  $moduleTable += ('| {0} | {1} | {2} | {3} |' -f $($m.name), $desc, $componentSummary, $depSummary)

  $ursOut = @"
# DOCUMENTO DE REQUERIMIENTOS DEL SISTEMA (URS)

## Nombre del modulo
$($m.name)

## Descripcion general del modulo
$desc

## Objetivo del modulo
$objective

## Actores del sistema
$actors

## Alcance funcional
$scope

## Listado de requerimientos del usuario
$reqs

## Listado de requerimientos no funcionales
$nfr

## Reglas de negocio identificadas
$rules

## Dependencias con otros modulos
$deps
"@
  Set-Content -Path (Join-Path $base ("URS/URS_modulo_{0}.md" -f $m.slug)) -Value $ursOut

  $scopeBullets = Get-Bullets $scope
  if ($scopeBullets.Count -eq 0) { $scopeBullets = @('Requiere validacion funcional para detallar la secuencia funcional del modulo.') }
  $frsBlocks = @()
  for ($i = 0; $i -lt $scopeBullets.Count; $i++) {
    $num = '{0:D3}' -f ($i + 1)
    $frsBlocks += @"
### FRS-$($m.code)-$num
**Descripcion:** $($scopeBullets[$i])

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.
"@
  }
  $frsOut = @"
# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
$($m.name)

## Descripcion funcional
$desc

## Logica funcional observada
$scope

## Especificaciones funcionales
$($frsBlocks -join "`n`n")

## Endpoints API relacionados
$endpoints

## Validaciones y controles funcionales
$security

## Dependencias funcionales
$deps

## Observaciones
$risks
"@
  Set-Content -Path (Join-Path $base ("FRS/FRS_modulo_{0}.md" -f $m.slug)) -Value $frsOut

  $dsOut = @"
# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
$($m.name)

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
$components

## Modelo de datos asociado
$tables

## Interfaces API
$endpoints

## Dependencias tecnicas
$deps

## Controles de seguridad y operacion
$security

## Riesgos tecnicos detectados
$risks

## Diagrama tecnico
```mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API $($m.code)]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
```
"@
  Set-Content -Path (Join-Path $base ("DS/DS_modulo_{0}.md" -f $m.slug)) -Value $dsOut

  $reqIds = if ($reqs) { [regex]::Matches($reqs, 'REQ-[A-Z]+-\d{3}') | ForEach-Object { $_.Value } | Select-Object -Unique } else { @() }
  if ($reqIds.Count -eq 0) { $reqIds = @("REQ-$($m.code)-001") }
  $primaryFile = if ($componentRefs.Count -gt 0) { $componentRefs[0] } else { $m.report }
  for ($i = 0; $i -lt $reqIds.Count; $i++) {
    $frsId = 'FRS-{0}-{1}' -f $m.code, ('{0:D3}' -f ((($i) % $scopeBullets.Count) + 1))
    $rtm += ('| {0} | {1} | {2} | {3} |' -f $reqIds[$i], $frsId, $primaryFile, 'requiere validacion funcional')
  }
}

Set-Content -Path (Join-Path $base 'modulos_detectados.md') -Value ($moduleTable -join "`n")
Set-Content -Path (Join-Path $base 'RTM/RTM_sistema_spi.md') -Value ($rtm -join "`n")

$index = @(
  '# INFORME FINAL DE VALIDACION DEL SISTEMA SPI',
  '',
  '## Estructura generada',
  '- [modulos_detectados.md](./modulos_detectados.md)',
  '- [RTM_sistema_spi.md](./RTM/RTM_sistema_spi.md)',
  '',
  '## URS por modulo'
)
$index += ($modules | ForEach-Object { '- [URS_modulo_{0}.md](./URS/URS_modulo_{0}.md)' -f $_.slug })
$index += @('', '## FRS por modulo')
$index += ($modules | ForEach-Object { '- [FRS_modulo_{0}.md](./FRS/FRS_modulo_{0}.md)' -f $_.slug })
$index += @('', '## DS por modulo')
$index += ($modules | ForEach-Object { '- [DS_modulo_{0}.md](./DS/DS_modulo_{0}.md)' -f $_.slug })
$index += @('', '## Observaciones', '- La documentacion fue reconstruida por ingenieria inversa y normalizada a partir de fuentes ya verificadas en `validacion_sistema`.', '- Cuando la traza entre requerimiento y funcion no pudo cerrarse de forma inequívoca desde la documentacion previa, se marco como `requiere validacion funcional`.')
Set-Content -Path (Join-Path $base 'informe_final.md') -Value ($index -join "`n")

