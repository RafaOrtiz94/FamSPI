# Contratos SPI <-> Odoo

## Archivo vigente

- `spi-odoo-messages-v1.openapi.yaml`
- Version de contrato: `v1`
- `schemaVersion` en payload: `"1.0"`

## Regla de versionado

1. Cambios no compatibles (breaking) requieren nuevo archivo/version mayor:
   - Ejemplo: `spi-odoo-messages-v2.openapi.yaml`
2. Cambios compatibles (campos opcionales nuevos, ejemplos, descripciones) se pueden hacer en la misma version mayor manteniendo `schemaVersion: "1.0"` si no rompen consumidor.
3. Todo payload saliente debe incluir `correlationId` para trazabilidad.

## Politica de deprecacion

1. Cuando exista `v2`, `v1` se marca como `deprecated` en `info.description` y en cada schema aplicable.
2. El periodo de convivencia recomendado es de 1 ciclo de release acordado por TI/negocio.
3. Finalizada la convivencia, el emisor deja de publicar `v1` y se elimina su validacion activa en CI.

## Validacion de contrato

Comando manual recomendado:

```bash
npx -y swagger-cli validate docs/informes_y_documentacion_procesos/contracts/spi-odoo-messages-v1.openapi.yaml
```
