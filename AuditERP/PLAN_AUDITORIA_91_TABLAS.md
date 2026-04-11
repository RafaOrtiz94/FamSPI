# Plan de Auditoria - 91 Tablas de Negocio (SYSTEM@XE)

- Fecha: `2026-03-31T21:43:29`
- Conexion objetivo: `SYSTEM/FamDb@XE` (CDB$ROOT).
- Fuente base de alcance: `business_tables_91.txt` (91 tablas).

## Objetivo
- Ejecutar auditoria funcional y de integridad sobre las 91 tablas de negocio detectadas en `SYSTEM` (ROOT), con evidencia reproducible en CSV/MD.

## Configuracion en la GUI
- Cadena SQL*Plus: `SYSTEM/FamDb@XE`
- Esquemas: `SYSTEM`
- Patrones: `%`
- Activar: `Usar tablas negocio precargadas (91)`
- Activar `COUNT(*) tablas objetivo` cuando quieras estimar volumen real por corrida.

## Fase 1 - Linea base tecnica (siempre)
1. Ejecutar auditoria completa con tablas precargadas (sin COUNT si buscas velocidad).
2. Revisar archivos clave: `04_tables.csv`, `05_columns.csv`, `06_pk_columns.csv`, `07_fk_map.csv`, `08_invalid_objects.csv`, `09_dba_errors.csv`.
3. Criterio de salida: 91 tablas presentes y metadatos consistentes.

## Fase 2 - Integridad referencial
1. Priorizar tablas con FK y alto volumen para detectar huerfanos.
2. Para cada FK de `07_fk_map.csv`, ejecutar conteo de filas huerfanas (`left join parent ... where parent.pk is null`).
3. Criterio de salida: 0 huerfanos en relaciones criticas (ventas, cobros, inventario, contabilidad).

## Fase 3 - Calidad de datos
1. Identificar columnas clave nulas no esperadas (`id`, `cod`, `fecha`, `total`, `estado`).
2. Verificar duplicidad en llaves de negocio cuando no hay PK fisica.
3. Criterio de salida: lista de hallazgos por tabla con severidad alta/media/baja.

## Fase 4 - Conciliacion funcional
1. Ventas: `VEN_DETAFACT`, `VEN_DETAPROD`, `VEN_VENTAS`, `VEN_PLANPAGO`, `SRI_LOGFACTU`.
2. Cobranza/Pagos: `COB_DETACOBRO`, `COB_DETACHEQ`, `PAG_DETAPAGO`.
3. Inventario/Almacen: `ALM_DETAMOVI`, `ALM_DETALOTE`, `AUX_INVENTARIO`, `AUX_INVENTARIO_OB`.
4. Contabilidad: `CNT_DETASIENTO`, `PRT_DETASIENTO`.
5. Criterio de salida: totales reconciliados entre tablas detalle-cabecera y log fiscal.

## Fase 5 - Riesgo y remediacion
1. Clasificar hallazgos por impacto: financiero, fiscal, operativo.
2. Emitir acciones: correccion de datos, constraint faltante, indice faltante, ajuste de proceso.
3. Re-ejecutar auditoria para evidencia de cierre.

## Priorizacion por volumen (Top 20)
| Tabla | NumRows (stats) | PK | FK |
| --- | ---: | --- | --- |
| SRI_DETALOGF | 231700 | Y | Y |
| CNT_DETASIENTO | 155399 | Y | Y |
| ALM_DETAMOVI | 77963 | Y | Y |
| ALM_DETALOTE | 55535 | Y | Y |
| SRI_LOGFACTU | 47408 | Y | Y |
| VEN_DETAPROF | 36051 | Y | Y |
| AUX_VENTASFAMP | 33465 | N | N |
| BAK_AUX_VENTASFAMP | 32188 | N | N |
| ALM_TMPDETAMOVI | 31121 | Y | Y |
| DWH_VENTAS | 27115 | Y | N |
| BAK_ALM_DETAMOVI_2182023_951AM | 20365 | N | N |
| BAK_ALM_DETALOTE_2182023_951AM | 19022 | N | N |
| BAK_ALM_DETALOTEJUL2023 | 17347 | N | N |
| DWH_VENTAS_081124 | 15109 | N | N |
| ALM_TMPDETALOTE | 12392 | Y | Y |
| COB_DETACOBRO | 12058 | Y | Y |
| COM_PLANPAGO | 10249 | Y | Y |
| PAG_DETAPAGO | 9994 | Y | Y |
| COM_TMPCOMPRAS | 9895 | Y | Y |
| VEN_VENTAS | 7851 | Y | Y |

## Tablas con datos sin PK (riesgo alto)
| Tabla | NumRows (stats) |
| --- | ---: |
| AUX_VENTASFAMP | 33465 |
| BAK_AUX_VENTASFAMP | 32188 |
| BAK_ALM_DETAMOVI_2182023_951AM | 20365 |
| BAK_ALM_DETALOTE_2182023_951AM | 19022 |
| BAK_ALM_DETALOTEJUL2023 | 17347 |
| DWH_VENTAS_081124 | 15109 |
| ALM_DETAMOVI_BK | 6615 |
| BAK_ALM_DETAMOVI_16112022 | 4733 |
| BAK_ALM_TMPDETALOTE21082023 | 4396 |
| CLIENTE_AUX | 1961 |
| AUX_CLIENTE | 1358 |
| AUX_INVENTARIO | 957 |
| AUX_SALDO_CLIENTE | 620 |
| AUX_INVENTARIO_OB | 130 |

## Tablas con datos sin FK (revisar modelo)
| Tabla | NumRows (stats) |
| --- | ---: |
| AUX_VENTASFAMP | 33465 |
| BAK_AUX_VENTASFAMP | 32188 |
| DWH_VENTAS | 27115 |
| BAK_ALM_DETAMOVI_2182023_951AM | 20365 |
| BAK_ALM_DETALOTE_2182023_951AM | 19022 |
| BAK_ALM_DETALOTEJUL2023 | 17347 |
| DWH_VENTAS_081124 | 15109 |
| ALM_DETAMOVI_BK | 6615 |
| BAK_ALM_DETAMOVI_16112022 | 4733 |
| BAK_ALM_TMPDETALOTE21082023 | 4396 |
| CLIENTE_AUX | 1961 |
| AUX_CLIENTE | 1358 |
| AUX_INVENTARIO | 957 |
| AUX_SALDO_CLIENTE | 620 |
| AUX_INVENTARIO_OB | 130 |
| GEN_FORMPAGO | 36 |
| GEN_PRODUCTOS | 24 |
| CLI_DETAINGEGR | 10 |
| CLI_PROPICLIEN | 4 |
| GEN_TIPOPAGO | 2 |

## Modulos por prefijo (cantidad de tablas)
| Prefijo | Tablas |
| --- | ---: |
| ALM | 13 |
| VEN | 10 |
| AUX | 6 |
| BAK | 6 |
| CLI | 6 |
| CST | 6 |
| COM | 5 |
| GEN | 4 |
| PRT | 4 |
| RHH | 4 |
| TLL | 4 |
| COB | 3 |
| AFJ | 2 |
| CNT | 2 |
| DWH | 2 |
| IMP | 2 |
| SEG | 2 |
| SRI | 2 |
| SRV | 2 |
| ADM | 1 |
| ECL | 1 |
| ECT | 1 |
| INF | 1 |
| PAG | 1 |
| TMP | 1 |

## Entregables por corrida
1. `audit_summary.json`
2. `audit_report.md`
3. CSV de estructura (`04`, `05`, `06`, `07`)
4. Evidencia de hallazgos de calidad/integridad por SQL adicional