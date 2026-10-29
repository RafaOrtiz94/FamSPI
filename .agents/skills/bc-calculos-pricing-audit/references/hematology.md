# Hematología

Línea base revisada: `TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06
HEMATOLOGIA.xlsx`, versión local observada el 24 de septiembre de 2026.

## Patrón confirmado

La demanda anual general está en `B2` en los bloques auditados. Las modalidades
por determinación y prueba efectiva calculan el precio unitario en `O`, aplican
el 15 % en `P` y generan totales en `Q:R`:

```text
Q = P * demanda_anual
R = O * demanda_anual
```

### Totales faltantes recuperables

Siete bloques de `DETERMINACION XN` referencian por desplazamiento celdas de
encabezado vacías (`B21`, `B40`, `B59`, `B78`, `B97`, `B116`, `B137`) en vez de
`B2`. Seis bloques de `PRUEBA EFECTIVA XN` presentan el mismo defecto desde
`B40` hasta `B137`. Los precios unitarios `O:P` permanecen utilizables salvo las
excepciones indicadas abajo.

Al revalidar, identifica los bloques por su etiqueta de equipo; no corrijas por
número de fila sin confirmar que la plantilla conserva la misma estructura.

## Excepciones que deben preservarse

- Algunos bloques por determinación usan `M:N`; la mayoría usa solo `M`.
- XNL-550 SIN por determinación agrega `BC!F109 / F3`.
- XNL-550 CON básica descuenta demanda de reticulocitos.
- XNL-550 SIN todo comprado distribuye únicamente mantenimiento.
- XNL-350 CON por prueba efectiva incluye adicionales y mantenimiento dentro del
  numerador completo; los bloques comparables normalmente no los incluyen.

No conviertas estas diferencias en una fórmula universal.

## XNL-350 CON por prueba efectiva

La fórmula completa observada suma `M22:M34`, incluyendo adicionales y
mantenimiento. La salida básica está vacía. El patrón mayoritario sugiere para
la básica `SUM(M22:M28) / B2 + M35`, pero replicar la excepción completa también
es plausible. Clasifica este caso como **ambiguo** hasta que negocio determine si
los costos adicionales forman parte de ambos precios.

## XN-1000 CON todo comprado

El factor propio observado en `L182` es `14.392636325600854`. Las filas `O167` y
`O168` referencian el factor anterior `L156` (`13.416784468607938`), mientras las
demás filas del bloque usan `L182`. Esto es una inferencia fuerte de referencia
desplazada; vuelve a comprobar coordenadas y etiquetas antes de proponer cambio.

Con la versión de línea base, el recálculo independiente produjo:

| Resultado | Valor |
|---|---:|
| Total completo ajustado | 470177.620000 |
| Total básico ajustado | 353501.436652 |
| Precio completo por prueba | 41.384722951 |
| Precio básico por prueba | 31.821101365 |

Los valores cacheados de `Q162` y `Q164` no concuerdan con sus propias fórmulas;
trátalos como obsoletos, no como evidencia contradictoria.

## Validación de resultados

Para cada equipo, compara completa y básica entre las tres modalidades. Verifica
que el margen sea exactamente 15 %, que los totales utilicen la demanda correcta
y que cualquier costo de equipo por determinación aparezca una sola vez.
