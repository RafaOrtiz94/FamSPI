# Implementación Senior Pro — matrices de cálculo

## Estado

La fase Senior Pro está implementada como un motor declarativo, versionado y de ejecución
determinista. No evalúa texto de Excel ni JavaScript arbitrario y no modifica datos del
Business Case. Cada resultado conserva trazabilidad hasta libro, SHA-256, hoja, celda,
fórmula, regla e identidad del ítem.

## Fuentes auditadas

| Libro | SHA-256 | Hojas |
|---|---|---:|
| `TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 HEMATOLOGIA.xlsx` | `1b8ff28f1b2917e79682c94f12d925490e8fe0b2f5e500b923b284065b76d338` | 8 |
| `TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06 INMUNO-QUIMICA.xlsx` | `dd64eb9a86e17e81eeb57623a3155f575780c10779fa1691e04ce4039964dd7d` | 21 |

Se clasificaron las 29 hojas y 29.377 celdas con fórmula. El detalle por hoja, rango,
errores y estado está en `matrixCalculationCoverage.catalog.js`.

## Cobertura publicable

Versión exacta de los 13 paquetes: `2024-12-06.1`.

- XP-300: determinación, prueba efectiva y todo comprado.
- XNL-350 sin licencias: determinación, prueba efectiva y todo comprado.
- XNL-350 con licencias: prueba efectiva y todo comprado.
- XNL-450 sin licencias: todo comprado.
- XNL-450 con licencias: todo comprado.
- XNL-550 sin licencias: todo comprado.
- XNL-550 con licencias: todo comprado.
- XN-1000 sin licencias: todo comprado.

Los paquetes reproducen los valores cacheados de las celdas fuente con pruebas de paridad.
La validación integral comparó 992 resultados numéricos modelados contra sus celdas del
libro y obtuvo cero diferencias fuera de la tolerancia decimal.

## Cuarentena verificable

Hematología tiene 14 alcances bloqueados:

- Siete alcances de determinación referencian totales vacíos en
  `BIOMETRIA HEMATICA!B21/B40/B59/B78/B97/B116/B137`.
- Seis alcances de prueba efectiva referencian totales vacíos en
  `BIOMETRIA HEMATICA!B40/B59/B78/B97/B116/B137`.
- XN-1000 con licencias, todo comprado, usa en `O167:O168` el factor `L156` de la
  configuración anterior.

Inmuno-Química permanece en cuarentena porque el libro contiene 5.800 celdas con error:
5.395 `#DIV/0!`, 359 `#REF!` y 46 `#VALUE!`. También contiene seis fórmulas con un
`#REF!` literal y 310 fórmulas con referencias a otro libro. Publicarlas requeriría inventar
la semántica de divisor cero o corregir referencias sin una fuente de negocio válida.

## Integración disponible

- `GET /api/v1/business-case/matrix-calculations/catalog`
- `POST /api/v1/business-case/matrix-calculations/preview`

Ambas rutas requieren autenticación y uno de los roles existentes de Business Case. La
vista previa exige el selector exacto y todas las entradas declaradas por el paquete:

```json
{
  "family": "hematologia",
  "equipment": "XP-300",
  "modality": "determinacion",
  "version": "2024-12-06.1",
  "inputs": {
    "annualDemand": 12200,
    "contractMonths": 12,
    "equipmentCount": 1,
    "additionalInvestmentsSubtotal": 1920
  }
}
```

Un alcance en cuarentena responde `422` con código `PACKAGE_QUARANTINED`; un selector sin
paquete responde `404` con `PACKAGE_NOT_FOUND`; entradas inválidas responden `400`.

## Límite deliberado

No se conectó el motor al endpoint productivo `/:id/recalculate` porque la estructura real
del Business Case no almacena la modalidad de la matriz. La vista previa obliga a declararla
de forma explícita y evita que el sistema infiera un cálculo distinto al solicitado. No se
realizaron cambios de esquema ni escrituras en Neon.
