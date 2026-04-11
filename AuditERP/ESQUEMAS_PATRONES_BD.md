# Inventario de Esquemas y Patrones de Tablas (Oracle XE)

- Generado: `2026-03-31T21:07:58`
- Conexion analizada: `SYSTEM/***@XE`
- DB_NAME: `XE`
- CON_NAME actual: `CDB$ROOT`
- SERVICE_NAME actual: `xe`

## Contenedores detectados
| CON_ID | NAME | OPEN_MODE |
| --- | --- | --- |
| 1 | CDB$ROOT | READ WRITE |
| 2 | PDB$SEED | READ ONLY |
| 3 | XEPDB1 | READ WRITE |

## Esquemas con tablas (todos los contenedores)
- Total esquemas con tablas: **36**
| CONTAINER_NAME | SCHEMA_NAME | TABLE_COUNT |
| --- | --- | --- |
| CDB$ROOT | SYS | 1697 |
| CDB$ROOT | SYSTEM | 752 |
| CDB$ROOT | MDSYS | 148 |
| CDB$ROOT | ORDDATA | 90 |
| CDB$ROOT | CTXSYS | 54 |
| CDB$ROOT | DVSYS | 44 |
| CDB$ROOT | GSMADMIN_INTERNAL | 43 |
| CDB$ROOT | WMSYS | 38 |
| CDB$ROOT | XDB | 35 |
| CDB$ROOT | LBACSYS | 22 |
| CDB$ROOT | DBSNMP | 20 |
| CDB$ROOT | OJVMSYS | 6 |
| CDB$ROOT | APPQOSSYS | 5 |
| CDB$ROOT | ORDSYS | 4 |
| CDB$ROOT | DBSFWUSER | 3 |
| CDB$ROOT | OUTLN | 3 |
| CDB$ROOT | OLAPSYS | 2 |
| CDB$ROOT | AUDSYS | 1 |
| XEPDB1 | SYS | 1696 |
| XEPDB1 | MDSYS | 148 |
| XEPDB1 | SYSTEM | 134 |
| XEPDB1 | ORDDATA | 90 |
| XEPDB1 | CTXSYS | 54 |
| XEPDB1 | DVSYS | 44 |
| XEPDB1 | GSMADMIN_INTERNAL | 43 |
| XEPDB1 | WMSYS | 38 |
| XEPDB1 | XDB | 35 |
| XEPDB1 | LBACSYS | 22 |
| XEPDB1 | DBSNMP | 20 |
| XEPDB1 | OJVMSYS | 6 |
| XEPDB1 | APPQOSSYS | 5 |
| XEPDB1 | ORDSYS | 4 |
| XEPDB1 | DBSFWUSER | 3 |
| XEPDB1 | OUTLN | 3 |
| XEPDB1 | OLAPSYS | 2 |
| XEPDB1 | AUDSYS | 1 |

## Esquemas no Oracle-maintained
| CONTAINER_NAME | SCHEMA_NAME | ACCOUNT_STATUS | TABLE_COUNT |
| --- | --- | --- | --- |
| XEPDB1 | PDBADMIN | OPEN | 0 |

## Patrones de tablas por esquema
Patron calculado como prefijo alfanumerico inicial del nombre de tabla + `%`.
Se listan hasta 12 patrones por esquema con al menos 3 tablas.

### CDB$ROOT
#### SYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WRH% | 250 |
| WRI% | 112 |
| AQ% | 76 |
| WRR% | 58 |
| SCHEDULER% | 42 |
| STREAMS% | 41 |
| ROPP% | 38 |
| LOGMNRG% | 37 |
| SYS% | 37 |
| HCS% | 34 |
| RPP% | 34 |
| XS% | 32 |

#### SYSTEM
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| CLI% | 75 |
| GEN% | 71 |
| RHH% | 60 |
| VEN% | 60 |
| LOGMNR% | 58 |
| ALM% | 53 |
| PRT% | 40 |
| SEG% | 30 |
| CNT% | 28 |
| IMP% | 24 |
| MVIEW% | 21 |
| SRV% | 20 |

#### MDSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| SDO% | 85 |
| EXT% | 18 |
| WFS% | 16 |
| OLS% | 6 |
| OPENLS% | 4 |
| NDM% | 3 |

#### ORDDATA
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| ORDDCM% | 90 |

#### CTXSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| DR% | 52 |

#### DVSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| RULE% | 8 |
| FACTOR% | 7 |
| POLICY% | 6 |
| REALM% | 6 |
| CODE% | 3 |

#### GSMADMIN_INTERNAL
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| AQ% | 6 |
| DATABASE% | 3 |
| SHARD% | 3 |

#### WMSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WM% | 31 |
| AQ% | 6 |

#### XDB
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| XDB% | 26 |
| JSON% | 4 |
| X% | 3 |

#### LBACSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OLS% | 22 |

#### DBSNMP
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| MGMT% | 15 |
| BSLN% | 5 |

#### OJVMSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OJDS% | 6 |

#### APPQOSSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WLM% | 5 |

#### ORDSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| SI% | 3 |

#### OUTLN
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OL% | 3 |

### XEPDB1
#### SYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WRH% | 250 |
| WRI% | 112 |
| AQ% | 76 |
| WRR% | 58 |
| SCHEDULER% | 42 |
| STREAMS% | 41 |
| ROPP% | 38 |
| LOGMNRG% | 37 |
| SYS% | 37 |
| HCS% | 34 |
| RPP% | 34 |
| XS% | 32 |

#### MDSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| SDO% | 85 |
| EXT% | 18 |
| WFS% | 16 |
| OLS% | 6 |
| OPENLS% | 4 |
| NDM% | 3 |

#### SYSTEM
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| LOGMNR% | 58 |
| MVIEW% | 21 |
| LOGMNRC% | 14 |
| LOGSTDBY% | 12 |
| ROLLING% | 8 |
| AQ% | 6 |
| OL% | 3 |

#### ORDDATA
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| ORDDCM% | 90 |

#### CTXSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| DR% | 52 |

#### DVSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| RULE% | 8 |
| FACTOR% | 7 |
| POLICY% | 6 |
| REALM% | 6 |
| CODE% | 3 |

#### GSMADMIN_INTERNAL
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| AQ% | 6 |
| DATABASE% | 3 |
| SHARD% | 3 |

#### WMSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WM% | 31 |
| AQ% | 6 |

#### XDB
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| XDB% | 26 |
| JSON% | 4 |
| X% | 3 |

#### LBACSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OLS% | 22 |

#### DBSNMP
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| MGMT% | 15 |
| BSLN% | 5 |

#### OJVMSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OJDS% | 6 |

#### APPQOSSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WLM% | 5 |

#### ORDSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| SI% | 3 |

#### OUTLN
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OL% | 3 |

## Hallazgos para uso en la GUI
- Para auditoria completa de todas las tablas candidatas por patron, usa `PATTERNS = %`.
- No se detectaron tablas con `FACTUR` o `PEDID` en ningun contenedor con esta conexion.

## Advertencias de sesion
- `ERROR:`
- `ORA-01031: privilegios insuficientes`
- `ORA-04045: errores durante la recompilaci�n/revalidaci�n de SYSTEM.TRGSALE`