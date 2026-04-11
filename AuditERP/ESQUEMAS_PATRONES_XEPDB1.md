# Inventario de Esquemas y Patrones - XEPDB1

- Generado: `2026-03-31T21:12:57`
- Conexion analizada: `SYSTEM/***@//localhost:1521/XEPDB1`
- DB_NAME: `XEPDB1`
- CON_NAME: `XEPDB1`
- SERVICE_NAME: `xepdb1`

## Esquemas con tablas (XEPDB1)
- Total esquemas con tablas: **18**
| SCHEMA_NAME | TABLE_COUNT |
| --- | --- |
| SYS | 1696 |
| MDSYS | 148 |
| SYSTEM | 134 |
| ORDDATA | 90 |
| CTXSYS | 54 |
| DVSYS | 44 |
| GSMADMIN_INTERNAL | 43 |
| WMSYS | 38 |
| XDB | 35 |
| LBACSYS | 22 |
| DBSNMP | 20 |
| OJVMSYS | 6 |
| APPQOSSYS | 5 |
| ORDSYS | 4 |
| DBSFWUSER | 3 |
| OUTLN | 3 |
| OLAPSYS | 2 |
| AUDSYS | 1 |

## Esquemas no Oracle-maintained (XEPDB1)
| SCHEMA_NAME | ACCOUNT_STATUS | TABLE_COUNT |
| --- | --- | --- |
| PDBADMIN | OPEN | 0 |

## Patrones de tablas por esquema
Patron: prefijo alfanumerico inicial + `%` (top 12 por esquema, min 3 tablas).

### SYS
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

### MDSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| SDO% | 85 |
| EXT% | 18 |
| WFS% | 16 |
| OLS% | 6 |
| OPENLS% | 4 |
| NDM% | 3 |

### SYSTEM
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| LOGMNR% | 58 |
| MVIEW% | 21 |
| LOGMNRC% | 14 |
| LOGSTDBY% | 12 |
| ROLLING% | 8 |
| AQ% | 6 |
| OL% | 3 |

### ORDDATA
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| ORDDCM% | 90 |

### CTXSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| DR% | 52 |

### DVSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| RULE% | 8 |
| FACTOR% | 7 |
| POLICY% | 6 |
| REALM% | 6 |
| CODE% | 3 |

### GSMADMIN_INTERNAL
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| AQ% | 6 |
| DATABASE% | 3 |
| SHARD% | 3 |

### WMSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WM% | 31 |
| AQ% | 6 |

### XDB
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| XDB% | 26 |
| JSON% | 4 |
| X% | 3 |

### LBACSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OLS% | 22 |

### DBSNMP
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| MGMT% | 15 |
| BSLN% | 5 |

### OJVMSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OJDS% | 6 |

### APPQOSSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| WLM% | 5 |

### ORDSYS
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| SI% | 3 |

### OUTLN
| TABLE_PATTERN | TABLE_COUNT |
| --- | --- |
| OL% | 3 |

## Hallazgos para la GUI
- Para auditoria completa por patron: usar `PATTERNS = %`.
- No se detectaron tablas con `FACTUR` o `PEDID` en XEPDB1.

## Advertencias de sesion
- Sin advertencias.