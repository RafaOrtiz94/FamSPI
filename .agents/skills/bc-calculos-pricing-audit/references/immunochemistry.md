# Inmuno-Química

Línea base revisada: `TABLA MATRIZ COSTOS PARA COMERCIAL 2024-12-06
INMUNO-QUIMICA.xlsx`, versión local observada el 24 de septiembre de 2026.

## Familias y ubicación del PVP

La revisión cubrió 364 analitos por modalidad: c111 (29), c311 (65), e411 (94),
c303/c503 (73) y e402/e801 (103).

- c111, c311 y e402/e801: PVP base en `L`; costo unitario `L / DET_KIT`.
- e411 y c303/c503: PVP base en `M`; costo unitario `M / DET_KIT`.

Estas columnas son una línea base y deben revalidarse por encabezado, no solo por
letra. El PVP sigue siendo literal.

## Composición confirmada

```text
precio_unitario = PVP / DET_KIT
                + total_extras / total_determinaciones_anuales
                + BC!F125 / total_determinaciones_anuales

precio_comercial = precio_unitario * 1.15
total_inicial = precio_comercial * demanda_del_analito
total_final = precio_unitario * demanda_del_analito
```

En prueba efectiva, la compra suele calcularse con demanda aumentada 20 %, pero
los totales de precio usan la demanda original. Demuéstralo en el bloque actual
antes de aplicarlo.

En todo comprado, las columnas de PVP y total ajustados distribuyen alquiler o
equipo sobre materiales. Son una vista distinta de la composición comercial por
prueba.

## Defectos estructurales conocidos

### Referencias de estabilidad desplazadas

El patrón funcional fija la proyección contractual como `BC!$B$47`. Se
observaron referencias relativas que se desplazan al copiar:

- c111 todo comprado: 28 fórmulas (`B47:B74`).
- c311 determinación: 64 fórmulas (`B47:B111`).
- e402/e801 prueba efectiva: 102 fórmulas (`B47:B149`).

Las 194 desviaciones producen tanto errores visibles como valores silenciosos
incorrectos. Revisa todas, no solo las que muestran `#VALUE!`.

### Referencias `BCBxx`

Se observaron 25 fórmulas sin separador de hoja:

- c111, tres modalidades: referencias `BCB48` en `G/H52`, `G/H53` y alquiler.
- c311, determinación y efectiva: alquiler `BCB47`; todo comprado usa `BC!B47`.
- e411, determinación y efectiva: alquiler `BCB47`; todo comprado usa `BC!B47`.
- c303/c503, tres modalidades: alquiler `BCB46`; la estructura sugiere
  `BC!B46`.
- e402/e801: determinación y efectiva usan `BCB50`, todo comprado usa `BCB47`.

La ausencia de `!` es demostrable. En e402/e801, escoger entre las filas 50 y 47
es una decisión ambigua que requiere validar el significado de ambas celdas.

### e411 todo comprado

- Se observaron 310 referencias externas `[1]BC`; los equivalentes locales usan
  `BC!`. Revalida que no exista un libro externo legítimo antes de localizarlas.
- `R9:R102` suma `$N$232`, celda vacía. Determinación usa `N231`, donde
  `N231 = N230 / G103`, el agregado de extras por prueba. Es una inferencia
  fuerte de desplazamiento de una fila.

### c311 prueba efectiva

`O137 = F74` no distribuye extras. Las otras familias usan el agregado dividido
para la demanda; la reconstrucción fuerte es `O136 / F74`.

### e402/e801 prueba efectiva

`P9:P111` suma `$O$261`, que corresponde a un producto individual. El agregado
de extras por prueba está en `N265 = N264 / F112`; los demás bloques consumen el
agregado, por lo que `N265` es la referencia fuerte candidata.

### c303/c503

Existen seis fórmulas con `#REF!` literal en `A20` y `A23` de las tres
modalidades. La posición de `A23` sugiere una contribución perdida de las filas
43/44; `A20` también perdió una o más referencias anteriores a la fila 51. No
hay evidencia para reconstruir los tokens exactos. Clasifica ambos como
**ambiguos** y no inventes rangos.

## Divisiones por cero

La línea base mostró miles de `#DIV/0!` porque las hojas de entrada tenían
demanda total cero o vacía. Pueden leerse PVP y rendimiento, pero no un precio
completo que distribuya extras e inversión. Reporta “no calculable: demanda
anual total igual a cero” y enumera las entradas necesarias.
