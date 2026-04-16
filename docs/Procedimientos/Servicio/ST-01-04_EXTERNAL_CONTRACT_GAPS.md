# ST-01-04 - Contratos Externos Pendientes

Fecha de corte: 2026-04-04

## Alcance

Este documento registra los datos externos faltantes para habilitar integración productiva real con:

- Navify / Online Support
- REXIS
- GoApp

La implementación actual en backend deja:

- interfaz interna y tracking operativo completo
- adapters por proveedor desacoplados
- feature flags por proveedor
- health/status por proveedor
- cola de sincronización con reintentos controlados

Cuando falta contrato externo oficial, el adapter retorna error funcional controlado y **no inventa payload final**.

## Datos Externos Faltantes por Proveedor

### Navify / Online Support

- endpoint oficial de creación/actualización de casos
- esquema oficial de payload para área/laboratorio/serial/alarma/tipo incidencia
- mecanismo oficial de autenticación y renovación de credenciales
- catálogo oficial de estados remotos y transiciones permitidas
- contrato oficial de adjuntos/fotografías (formatos, tamaños, límites)

### REXIS

- endpoint oficial para creación de caso REXIS
- schema oficial para serie/equipo/alarma/tipo de problema
- mecanismo oficial de autenticación y rotación de credenciales
- mapeo oficial de estados REXIS contra estado interno
- contrato oficial de evidencias/fotografías

### GoApp

- endpoint oficial para creación de Work Order en GoApp
- contrato oficial de hitos: accept/start travel/work time/finalize/follow-up
- estructura oficial de registro de tiempos y partes usadas
- contrato de legalización de firmas: cliente + servicio técnico
- mapeo oficial de estados GoApp contra estado interno

## Feature Flags de Activación

Cada proveedor se controla con variables:

- `ST_EXT_<PROVIDER>_ENABLED`
- `ST_EXT_<PROVIDER>_CONTRACT_APPROVED`
- `ST_EXT_<PROVIDER>_BASE_URL`
- `ST_EXT_<PROVIDER>_AUTH_TOKEN` o `ST_EXT_<PROVIDER>_API_KEY`
- `ST_EXT_<PROVIDER>_MOCK_MODE`
- `ST_EXT_<PROVIDER>_AUTO_SYNC`

`<PROVIDER>` válido:

- `NAVIFY`
- `ONLINE_SUPPORT`
- `REXIS`
- `GOAPP`

## Estado de Operación sin Contrato

Sin contrato aprobado, el sistema:

- crea y persiste caso interno
- conserva payload normalizado y payload original
- registra eventos, errores e intentos
- expone estado en workspace y panel de health
- bloquea sync externo con error funcional explicativo
