# Guia de usuario - Mapeador de Sheets

## 1) Requisitos
- Windows + PowerShell.
- Python 3.14 instalado (o ajustar la ruta en `run_mapper.ps1`).
- Archivo Excel `.xlsx` a mapear.

## 2) Archivos principales
- `excel_mapper.py`: motor del mapeador.
- `mapper_gui.py`: interfaz grafica (desktop).
- `requirements.txt`: dependencias Python.
- `run_mapper.ps1`: script de ejecucion rapida.
- `tests/test_excel_mapper.py`: pruebas automaticas.

## 3) Uso rapido (recomendado)
Desde la carpeta `Mapeador_Sheets`:

```powershell
.\run_mapper.ps1 -InstallDeps
```

Esto instala dependencias y ejecuta el mapeador con parametros por defecto.

## 4) Comandos comunes
Abrir interfaz grafica:

```powershell
.\run_mapper.ps1 -Gui
```

Alternativa directa:

```powershell
python .\mapper_gui.py
```

Ejecutar con archivo especifico y salida en la misma carpeta:

```powershell
.\run_mapper.ps1 -InputFile "FORMATO BC - 15-01-2026 (2).xlsx" -OutDir "."
```

Generar solo JSON:

```powershell
.\run_mapper.ps1 -Format json
```

Generar solo Markdown:

```powershell
.\run_mapper.ps1 -Format md
```

Incluir celdas vacias:

```powershell
.\run_mapper.ps1 -IncludeEmpty
```

Ejecutar pruebas:

```powershell
.\run_mapper.ps1 -RunTests
```

Instalar dependencias y luego ejecutar pruebas:

```powershell
.\run_mapper.ps1 -InstallDeps -RunTests
```

## 5) Salidas generadas
- `mapping_auto.json`
- `mapping_auto.md`

Se crean en la ruta indicada con `-OutDir`.

### Reporte explicito de celdas por rellenar
El mapeador ahora incluye una seccion especifica:
- `Celdas Vacias por Rellenar (Columnas Objetivo)` en `mapping_auto.md`.
- `Celdas Vacias por Rellenar (General - Informe Completo)` en `mapping_auto.md`.
- `Celdas Vacias por Rellenar (Consolidado)` en `mapping_auto.md`.
- `empty_fill_targets` por hoja en `mapping_auto.json`.

Regla actual de deteccion:
- Prioriza columnas objetivo detectadas por encabezado en cada hoja.
- Ejemplos de encabezados objetivo:
  - `DET/AÑO PROCESO` (incluye variantes como `DET/AÑO/PROCESO`, `DET AÑO/PROCESO`, `CANTIDAD PROCESO/AÑO`)
  - `PRODUCTO A ENTREGAR`
- Solo marca como rellenables las celdas vacias debajo de esas columnas cuando la fila tiene contexto de producto/insumo.
- Adicionalmente mantiene deteccion general para conservar el informe completo anterior.

Cada celda reportada incluye:
- Celda (ejemplo: `C1`)
- Fila (ejemplo: `1`)
- Columna en letra e indice (ejemplo: `C/3`)
- Columna objetivo detectada (encabezado del formulario)
- Motivo de deteccion (`target_column`)
- Contexto de fila detectado (si existe)
- Descripcion clara de donde rellenar (`fill_description`)

## 6) Parametros disponibles en run_mapper.ps1
- `-PythonExe`: ruta del ejecutable Python.
- `-InputFile`: archivo `.xlsx` de entrada (alias: `-Input`).
- `-OutDir`: carpeta de salida.
- `-Format`: `json`, `md` o `both`.
- `-IncludeEmpty`: incluye celdas vacias.
  - Nota: aunque no uses `-IncludeEmpty`, el reporte de `empty_fill_targets` siempre se genera.
- `-Gui`: abre la interfaz grafica.
- `-InstallDeps`: instala dependencias desde `requirements.txt`.
- `-RunTests`: ejecuta pruebas unitarias.

## 7) Errores comunes y solucion
- `Python no encontrado`:
  - Ajusta `-PythonExe` con la ruta correcta.
- `No se encontro el archivo`:
  - Verifica nombre/ruta en `-Input`.
- `Archivo Excel invalido`:
  - Asegura extension `.xlsx`.
- `Sin permisos para leer/escribir`:
  - Ejecuta PowerShell con permisos adecuados o cambia `-OutDir`.

## 8) Uso de la GUI
1. Abre `.\run_mapper.ps1 -Gui`.
2. Selecciona el archivo Excel con `Buscar...`.
3. Selecciona la carpeta de salida.
4. Elige formato (`json`, `md`, `both`).
5. Presiona `Generar Mapping`.
6. Revisa la tabla `Busqueda de celdas por rellenar`:
   - Muestra hoja, celda, fila, columna, fuente, columna objetivo, motivo, contexto y descripcion clara.
7. Usa `Vista` para cambiar entre:
   - `Objetivo`: solo columnas objetivo detectadas.
   - `General`: deteccion completa del informe anterior.
   - `Ambas`: consolidado sin duplicados.
8. Usa filtros:
   - `Hoja`
   - `Columna objetivo`
   - `Buscar` (texto libre por celda, descripcion, producto, etc.).
9. Exporta lo que necesites desde la vista actual:
   - Selecciona formato de exportacion (`csv`, `json`, `xlsx`).
   - Presiona `Exportar vista`.
   - Se exporta exactamente el resultado filtrado visible en GUI.
