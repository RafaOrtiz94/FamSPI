# Data Dictionary - Business Only (XEPDB1)

- Generated: `2026-03-31T21:22:51`
- Connection: `SYSTEM/***@//localhost:1521/XEPDB1`
- DB_NAME: `XEPDB1`
- CON_NAME: `XEPDB1`
- SERVICE_NAME: `xepdb1`

## Business schema criteria
- `oracle_maintained = N` in `DBA_USERS`.
- Schema considered active business when it has tables/views/sequences/triggers > 0.

## Schemas found (oracle_maintained = N)
| SCHEMA_NAME | ACCOUNT_STATUS | TABLE_COUNT | VIEW_COUNT | SEQUENCE_COUNT | TRIGGER_COUNT |
| --- | --- | --- | --- | --- | --- |
| PDBADMIN | OPEN | 0 | 0 | 0 | 0 |

## Active business schemas
- None. No business schema has objects in this database/service.
- With current connection, there is no functional business model to document.

## Generated files
- `01_business_schemas.csv`

## Notes
- If your ERP objects should exist, verify app schema creation in `XEPDB1`.
- If objects are in another service/PDB, rerun against that service.