# AuditERP - GUI de Auditoria Oracle (SQL*Plus)

Aplicacion Python (`tkinter`) para auditoria de Oracle usando `sqlplus` sin bloquear la UI (hilo en segundo plano).

## Requisitos

- Windows con `sqlplus` en `PATH`.
- Python 3.10+.
- Usuario con permisos de diccionario (`DBA_*`) para auditoria completa.

## Ejecutar

```powershell
cd C:\AuditERP
python .\audit_gui.py
```

## Modo precargado (91 tablas negocio)

El sistema ahora incluye `business_tables_91.txt` y un modo preconfigurado para auditar esas 91 tablas:

- Conexion por defecto: `SYSTEM/FamDb@XE`
- Esquema por defecto: `SYSTEM`
- Patron por defecto: `%`
- Checkbox: `Usar tablas negocio precargadas (91)`

Con ese modo activo, la corrida usa filtro explicito por tabla y genera `03_target_tables.csv`.

## Configuracion en la UI

- `Cadena SQL*Plus`: ejemplo `SYSTEM/FamDb@XE`
- `Ejecutable`: `sqlplus` (o ruta completa)
- `Esquemas (coma)`: por defecto `SYSTEM`
- `Patrones tablas`: por defecto `%`
- `Salida`: carpeta base donde se crea `audit_YYYYMMDD_HHMMSS`
- `Incluir COUNT(*) tablas objetivo`: conteo por tabla (mas lento)

## Consultas de registros (ultimos pedidos)

La GUI ahora incluye el bloque `Consultas negocio (registros)`:

- `Esquema`: por defecto `SYSTEM`
- `Tabla`: combo cargado con `business_tables_91.txt`
- `Limite`: numero de filas a devolver
- `Filtro WHERE (opcional)`: condicion simple sin `;` ni sentencias DML/DDL

Botones:

- `Ultimos registros`: trae columnas clave y ordena por fecha/numero detectado
- `Ultimos numeros pedidos`: prioriza columnas de numero/fecha para ver ultimos documentos
- `Vista natural`: intenta reemplazar FK/codigos por datos descriptivos de tablas relacionadas
- `Exportar resultado`: guarda el resultado actual en CSV

## Archivos generados por corrida

- `01_db_context.csv`
- `02_non_oracle_users.csv`
- `03_target_schemas.csv`
- `03_target_tables.csv` (si hay filtro explicito)
- `04_tables.csv`
- `05_columns.csv`
- `06_pk_columns.csv`
- `07_fk_map.csv`
- `08_invalid_objects.csv`
- `09_dba_errors.csv`
- `10_target_pattern_tables.csv` o `10_factura_pedido_tables.csv`
- `11_target_pattern_fk.csv` o `11_factura_pedido_fk.csv`
- `12_target_table_row_counts.csv` o `12_factura_pedido_row_counts.csv` (si aplica)
- `audit_summary.json`
- `audit_report.md`

## Plan de auditoria 91 tablas

Se genero un plan operativo en:

- `PLAN_AUDITORIA_91_TABLAS.md`

Incluye priorizacion por volumen, fases de integridad/calidad y entregables.
