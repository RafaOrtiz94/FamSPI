# Fase 2 - Hu?rfanos por FK (91 tablas)

- Generado: `2026-03-31T21:49:49`
- Conexion: `SYSTEM/***@XE`
- FK evaluadas: **177**
- FK con hu?rfanos: **1**
- Filas hu?rfanas totales: **4**

## Top 30 FK con hu?rfanos
| CHILD_TABLE | FK_NAME | PARENT_TABLE | FK_COLUMNS | ORPHAN_COUNT |
| --- | --- | --- | ---: | ---: |
| SRI_DETALOGF | ERDO_LGFA_FK | SRI_LOGFACTU | 1 | 4 |

## Archivos
- `phase2_orphan_checks_91.sql` (paquete SQL principal)
- `phase2_orphan_counts.csv` (resultado de conteos)
- `phase2_orphan_samples.sql` (muestras de hu?rfanos por FK con hallazgo)
- `phase2_orphan_skipped_rows.csv` (filas omitidas por validacion de identificadores)

## Advertencias de sesion
- `ERROR:`

## Detalle de hu?rfanos
- Archivo: `phase2_orphan_detail.csv`
- FK afectada: `SRI_DETALOGF.ERDO_LGFA_FK -> SRI_LOGFACTU`
- Valores hu?rfanos detectados (`LGFA_LGFA_ID`): `18977`, `18993` (2 filas), `18999`.
