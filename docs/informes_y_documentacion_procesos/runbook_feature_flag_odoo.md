# Runbook: feature flag de integracion Odoo en SPI

- Ultima revision: 2026-04-11
- Alcance: backend SPI (`backend/src`) para habilitar/deshabilitar integracion Odoo sin afectar rutas existentes.

---

## 1. Modulo central de configuracion

- Archivo: `backend/src/config/odooIntegration.js`
- Funcion principal:
  - `getOdooIntegrationConfig()`
  - `isOdooIntegrationEnabled()`

La politica por defecto en desarrollo/local es **OFF** (`ODOO_INTEGRATION_ENABLED=false`).

---

## 2. Variables de entorno

| Variable | Default | Requerida cuando flag ON | Descripcion |
|---|---|---|---|
| `ODOO_INTEGRATION_ENABLED` | `false` | Si | Enciende o apaga toda logica nueva de integracion Odoo. |
| `ODOO_URL` (`ODOO_BASE_URL`) | vacio (`null`) | Si | URL base de API Odoo (ej. `https://odoo.midominio.com`). |
| `ODOO_DB` (`ODOO_DATABASE`) | vacio (`null`) | Si | Base objetivo de Odoo. |
| `ODOO_USER` (`ODOO_USERNAME`) | vacio (`null`) | Si | Usuario tecnico de servicio para autenticacion API. |
| `ODOO_API_KEY` o `ODOO_PASSWORD` (`ODOO_PASS`) | vacio (`null`) | Si | Credencial de servicio (token o password segun despliegue). No commitear valores reales. |
| `ODOO_TIMEOUT_MS` | `10000` | No | Timeout HTTP planificado para llamadas Odoo; minimo efectivo `1000`. |
| `ODOO_ALLOW_INSECURE_TLS` | `false` | No | Solo para laboratorio controlado; en productivo debe mantenerse `false`. |
| `ODOO_OUTBOX_TOPIC` | `odoo.sync.v1` | No | Nombre logico para eventos/outbox de integracion. |

---

## 3. Comportamiento ON/OFF

### Flag OFF (`ODOO_INTEGRATION_ENABLED=false`)

- SPI mantiene comportamiento actual en rutas existentes.
- El codigo nuevo de integracion Odoo debe responder en modo `disabled/skipped`.
- No se deben disparar llamadas HTTP a Odoo ni en arranque ni en rutas legacy.

### Flag ON (`ODOO_INTEGRATION_ENABLED=true`)

- Se habilita solo el codigo de integracion Odoo que use el gate `isOdooIntegrationEnabled()`.
- Si falta `ODOO_URL`, `ODOO_DB`, `ODOO_USER` o credencial (`ODOO_API_KEY`/`ODOO_PASSWORD`), el estado es `degraded_config` para proteger operacion.
- El resto del core SPI debe seguir operando aunque Odoo no este disponible (modo degradado).

---

## 4. Verificacion rapida

1. Exportar `ODOO_INTEGRATION_ENABLED=false`.
2. Levantar backend y ejecutar pruebas (`npm test` en `backend/`).
3. Confirmar que no hay dependencia obligatoria a Odoo en rutas actuales.
