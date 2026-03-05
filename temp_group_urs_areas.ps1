$ErrorActionPreference = 'Stop'
$base = 'validacion_sistema/URS'
$areasDir = Join-Path $base 'areas'
if (-not (Test-Path $areasDir)) { New-Item -ItemType Directory -Path $areasDir | Out-Null }

$areas = @(
  @{
    Id='A1'; Nombre='Gobierno, Seguridad y Cumplimiento';
    Modulos=@('auth','security','auditoria','audit_prep','approvals','management','signature')
  },
  @{
    Id='A2'; Nombre='Talento Humano y Gestion Organizacional';
    Modulos=@('talento_humano','users','user_profile','user_certifications','collaborators','attendance','vacaciones','permisos','personnel_requests','applicants','departments')
  },
  @{
    Id='A3'; Nombre='Comercial y Relacion con Clientes';
    Modulos=@('comercial','clients','requests','equipment_purchases','private_purchases','business_case','schedules','calendar')
  },
  @{
    Id='A4'; Nombre='Operaciones, Servicio Tecnico y Logistica';
    Modulos=@('operaciones','servicio','tecnico','technical_applications','mantenimientos','inventario','logistica')
  },
  @{
    Id='A5'; Nombre='Finanzas y Control Operativo';
    Modulos=@('finanzas','viaticos')
  },
  @{
    Id='A6'; Nombre='Plataforma, Documentos, Soporte e Integraciones';
    Modulos=@('dashboard','documents','files','notifications','support_tickets','gmail','integrations')
  }
)

$display = @{
  'auth'='Autenticacion'; 'security'='Seguridad'; 'auditoria'='Auditoria'; 'audit_prep'='Preparacion de Auditoria';
  'approvals'='Aprobaciones'; 'management'='Gestion Administrativa'; 'signature'='Firma Documental';
  'talento_humano'='Talento Humano'; 'users'='Usuarios'; 'user_profile'='Perfil de Usuario';
  'user_certifications'='Certificaciones de Usuario'; 'collaborators'='Colaboradores'; 'attendance'='Asistencia';
  'vacaciones'='Vacaciones'; 'permisos'='Permisos'; 'personnel_requests'='Solicitudes de Personal';
  'applicants'='Postulantes'; 'departments'='Departamentos';
  'comercial'='Comercial'; 'clients'='Clientes'; 'requests'='Solicitudes';
  'equipment_purchases'='Pedidos de Compra Publica'; 'private_purchases'='Pedidos de Compra Privada';
  'business_case'='Caso de Negocio'; 'schedules'='Cronogramas'; 'calendar'='Calendario';
  'operaciones'='Operaciones'; 'servicio'='Servicio Tecnico'; 'tecnico'='Gestion Tecnica';
  'technical_applications'='Aplicaciones Tecnicas'; 'mantenimientos'='Mantenimientos'; 'inventario'='Inventario';
  'logistica'='Logistica'; 'finanzas'='Finanzas'; 'viaticos'='Viaticos';
  'dashboard'='Dashboard'; 'documents'='Documentos'; 'files'='Gestion de Archivos';
  'notifications'='Notificaciones'; 'support_tickets'='Tickets de Soporte'; 'gmail'='Integracion Gmail';
  'integrations'='Integraciones'
}

$master = New-Object System.Text.StringBuilder
$null = $master.AppendLine('# CONJUNTOS DE URS PROPUESTA POR AREA')
$null = $master.AppendLine()
$null = $master.AppendLine('Este documento organiza los modulos del Sistema de Procesos Internos SPI por areas funcionales para revisiones y validacion por dominio.')
$null = $master.AppendLine()
$null = $master.AppendLine('## Equivalencias con documentos macro existentes')
$null = $master.AppendLine('- `URS_propuesta_modulo_auth.md` corresponde al macro `URS_propuesta_modulo_autenticacion.md`.')
$null = $master.AppendLine('- `URS_propuesta_modulo_users.md` + `user_profile` + `user_certifications` corresponden al macro `URS_propuesta_modulo_usuarios.md`.')
$null = $master.AppendLine('- `URS_propuesta_modulo_clients.md` corresponde al macro `URS_propuesta_modulo_clientes.md`.')
$null = $master.AppendLine('- `URS_propuesta_modulo_requests.md` + `equipment_purchases` + `private_purchases` corresponden al macro `URS_propuesta_modulo_pedidos.md`.')
$null = $master.AppendLine('- `URS_propuesta_modulo_finanzas.md` + `URS_propuesta_modulo_viaticos.md` corresponden al macro `URS_propuesta_modulo_facturacion.md`.')
$null = $master.AppendLine()

foreach ($area in $areas) {
  $fileName = "conjunto_$($area.Id.ToLower())_" + (($area.Nombre -replace '[^a-zA-Z0-9 ]','' -replace '\s+','_').ToLower()) + '.md'
  $areaPath = Join-Path $areasDir $fileName

  $sb = New-Object System.Text.StringBuilder
  $null = $sb.AppendLine("# CONJUNTO $($area.Id): $($area.Nombre)")
  $null = $sb.AppendLine()
  $null = $sb.AppendLine('## Modulos incluidos')

  foreach ($m in $area.Modulos) {
    $doc = "URS_propuesta_modulo_$m.md"
    $docPath = Join-Path $base $doc
    $nombre = if ($display.ContainsKey($m)) { $display[$m] } else { $m }
    if (Test-Path $docPath) {
      $null = $sb.AppendLine("- $nombre: `$doc`")
    } else {
      $null = $sb.AppendLine("- $nombre: `$doc` (pendiente/no encontrado)")
    }
  }

  $null = $sb.AppendLine()
  $null = $sb.AppendLine('## Criterio de agrupacion')
  $null = $sb.AppendLine('Agrupacion realizada por dominio de negocio y responsabilidad operativa primaria del proceso.')

  Set-Content -Path $areaPath -Value $sb.ToString() -Encoding UTF8

  $null = $master.AppendLine("## $($area.Id). $($area.Nombre)")
  $null = $master.AppendLine("- Archivo del conjunto: `validacion_sistema/URS/areas/$fileName`")
  foreach ($m in $area.Modulos) {
    $doc = "URS_propuesta_modulo_$m.md"
    $nombre = if ($display.ContainsKey($m)) { $display[$m] } else { $m }
    $null = $master.AppendLine("- $nombre -> `validacion_sistema/URS/$doc`")
  }
  $null = $master.AppendLine()
}

$masterPath = Join-Path $base 'URS_propuesta_conjuntos_por_area.md'
Set-Content -Path $masterPath -Value $master.ToString() -Encoding UTF8

Write-Output "MASTER=$masterPath"
Write-Output "AREAS=$(Get-ChildItem -File $areasDir | Measure-Object | Select-Object -ExpandProperty Count)"
