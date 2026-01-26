---
name: ps-safe-exec
description: ejecución segura en PowerShell sin &&, validación de rutas, comandos repetibles, navegación y logs consistentes
---

# SKILL: ps-safe-exec

## Propósito
Ejecución segura de comandos PowerShell evitando "&&", con validación de rutas y navegación consistente.

## GATE: ¿Aplicar este skill?
**SI** → Siempre usar para cualquier comando que dependa de ubicación/rutas
**NO** → Para comandos simples sin dependencias de directorio

## Flujo Corto (5 min)

### 1. Validar y navegar
```powershell
pwd
Set-Location "{{directorio_target}}"
pwd
```

### 2. Verificar dependencias críticas
```powershell
if (!(Test-Path "{{ruta_critica}}")) {
    Write-Host "[ERROR] {{ruta_critica}} no encontrada"
    exit 1
}
```

### 3. Ejecutar comandos por pasos
```powershell
# Comando 1
{{comando_1}}

# Comando 2 (dependiente del anterior)
{{comando_2}}
```

### 4. Volver a raíz
```powershell
Set-Location "{{ruta_raiz}}"
pwd
```

## Plantillas Parametrizables

### Navegación Segura
```powershell
# Template: cambiar directorio con validación
Set-Location "{{directorio}}"
if ($?) { pwd } else { Write-Host "[ERROR] Falló navegación"; exit 1 }
```

### Validación de Rutas
```powershell
# Template: verificar archivo/directorio antes de usar
$path = "{{ruta}}"
if (!(Test-Path $path)) {
    Write-Host "[ERROR] $path no existe"
    exit 1
}
```

### Scripts Repetibles
```powershell
# Template: crear script para comandos repetidos (>2 veces)
@"
{{comando_completo}}
"@ | Out-File "{{script_name}}.ps1" -Encoding UTF8

# Ejecutar script creado
.\{{script_name}}.ps1
```

## Evidencia Mínima Obligatoria
- ✅ `pwd` mostrado antes de cada cambio de directorio
- ✅ Código de salida verificado para comandos críticos
- ✅ Mensaje de error si ruta no existe
- ✅ Confirmación de vuelta a directorio raíz

## Límites de Alcance
- NO ejecuta comandos automáticamente (solo guía plantillas)
- NO reemplaza lógica de negocio
- NO maneja errores de red/conexión
- NO valida contenido de archivos (solo existencia de rutas)
