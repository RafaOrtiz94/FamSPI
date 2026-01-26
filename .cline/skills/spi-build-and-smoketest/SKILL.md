---
name: spi-build-and-smoketest
description: build obligatorio después de cambios, pruebas web mínimas con logs, no avanzar sin evidencia de funcionamiento
---

# SKILL: spi-build-and-smoketest

## Propósito
Asegurar que cambios funcionen mediante build obligatorio y pruebas web mínimas.

## GATE: ¿Aplicar este skill?
**SI** → Después de cualquier cambio en frontend (componentes, APIs, estilos)
**NO** → Para cambios solo en documentación o configuración

## Flujo Corto (3 min)

### 1. Build obligatorio
```powershell
Set-Location "spi_front"
pwd
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build falló - corregir antes de continuar"
    exit 1
}
```

### 2. Prueba mínima en navegador
```powershell
npm start
# Verificar: http://localhost:3000/{{pagina_prueba}}
```

### 3. Validar funcionamiento básico
- ✅ Página carga sin errores de consola
- ✅ Elementos principales visibles
- ✅ Sin errores 404/500

## Plantillas Parametrizables

### Build con validación
```powershell
# Template: build con verificación de errores
Set-Location "{{frontend_dir}}"
pwd
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BUILD-ERROR] Código: $LASTEXITCODE"
    exit 1
}
Write-Host "[BUILD-SUCCESS] Completado"
```

### Prueba específica
```powershell
# Template: probar página/componente específico
npm start
Start-Process "http://localhost:3000/{{ruta_test}}"
# Verificar manualmente: {{que_verificar}}
```

### Reporte de prueba
```powershell
# Template: evidencia de funcionamiento
Write-Host "[TEST] Página: {{pagina}}"
Write-Host "[TEST] Estado: {{estado}} - {{detalles}}"
Write-Host "[TEST] Logs: {{logs_observados}}"
```

## Evidencia Mínima Obligatoria
- ✅ Build exitoso (sin errores TypeScript/linting)
- ✅ Servidor inicia correctamente (puerto 3000)
- ✅ Página test carga (sin errores 404)
- ✅ Console logs limpios (sin errores inesperados)

## Límites de Alcance
- NO ejecuta tests automatizados completos
- NO valida lógica de negocio compleja
- NO verifica performance/métricas avanzadas
- NO reemplaza QA formal (solo smoke test básico)
