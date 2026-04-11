# Descubrimiento de Esquema de Negocio

- Generado: `2026-03-31T21:33:54`
- ROOT: `SYSTEM/***@XE`
- PDB: `SYSTEM/***@//localhost:1521/XEPDB1`

## Contexto
- ROOT -> DB `XE`, CON `CDB$ROOT`, SERVICE `xe`
- PDB -> DB `XEPDB1`, CON `XEPDB1`, SERVICE `xepdb1`

## Resultado
- Esquemas no Oracle en XEPDB1: **1**
- `PDBADMIN` (OPEN)
- Esquemas no Oracle activos en XEPDB1: **0**
- No hay esquema de negocio activo en XEPDB1 con el criterio oracle_maintained=N.

## Evidencia
- Tablas SYSTEM solo en ROOT: **618**
- Tablas SYSTEM solo en XEPDB1: **0**
- Tablas por keywords negocio en ROOT: **105**
- Tablas por keywords negocio en XEPDB1: **66**
- Tablas SYSTEM-only-root con apariencia negocio: **91**

## Hallazgo clave
- Existe `SYSTEM.TRGSALE` en ROOT con referencia a `PRD.SEG_SESIONES`.
- Usuario PRD en ROOT: **NO**
- Usuario PRD en XEPDB1: **NO**
- Indicio: el modelo ERP esperado no esta cargado en XEPDB1 o fue montado en otro origen.

## Archivos
- `01_root_context.csv`
- `02_pdb_context.csv`
- `03_root_non_oracle_users.csv`
- `04_pdb_non_oracle_users.csv`
- `05_pdb_user_object_counts.csv`
- `06_pdb_business_keyword_tables.csv`
- `07_root_business_keyword_tables.csv`
- `08_root_system_tables.csv`
- `09_pdb_system_tables.csv`
- `10_system_tables_only_in_root.csv`
- `11_system_tables_only_in_pdb.csv`
- `12_root_only_prefix3_counts.csv`
- `13_system_root_only_business_like_tables.csv`
- `14_root_system_source_referenced_owners.csv`
- `15_root_prd_user_check.csv`
- `16_pdb_prd_user_check.csv`
- `17_root_trgsale_metadata.csv`
- `18_root_trgsale_source.csv`

## Advertencias
- ROOT:
- `ERROR:`
- `ORA-01031: privilegios insuficientes`
- `ORA-04045: errores durante la recompilaci�n/revalidaci�n de SYSTEM.TRGSALE`