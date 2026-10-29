# Modelo común de precios

## Regla fundamental

El PVP base se captura como valor literal. El libro no contiene una regla fiable
para inventar el PVP de un producto nuevo. Sí contiene reglas repetidas para
convertir ese PVP en cantidades, costos por prueba y totales comerciales.

## Variables

- `D`: demanda anual de la prueba o analito.
- `K`: determinaciones o pruebas por kit.
- `P`: PVP base literal.
- `S`: estabilidad del producto en días.
- `E`: número de equipos instalados.
- `A`: costos adicionales aplicables.
- `I`: inversiones aplicables.
- `T`: plazo contractual cuando la modalidad lo utiliza.
- `m`: margen comercial; en los libros revisados es `0.15`.

## Cadena de cálculo repetida

```text
cantidad_teorica = D / K
minimo_estabilidad = (360 / S) * E
cantidad_entregable = MAX(cantidad_teorica, minimo_estabilidad)
cantidad_redondeada = ROUNDUP o ROUNDDOWN según el bloque fuente
total_producto = P * cantidad_redondeada
costo_reactivo_unitario = P / K
adicionales_unitarios = A / demanda_total
inversion_unitaria = I / demanda_total
precio_unitario_base = costo_reactivo_unitario + adicionales_unitarios + inversion_unitaria
precio_comercial = precio_unitario_base * (1 + m)
total_inicial = precio_comercial * D
total_final = precio_unitario_base * D
```

En Hematología, el `precio_unitario_base` suele expresarse como la suma de los
totales de productos dividida para la demanda anual, más equipo o mantenimiento
por determinación. Conserva la composición exacta del bloque fuente.

## Todo comprado

```text
factor_asignacion = costos_asignables / total_base_de_productos
```

Algunos bloques multiplican este factor por plazo u otra cantidad contractual.
No apliques esa multiplicación si el bloque equivalente no la demuestra.

```text
pvp_ajustado = P * (1 + factor_asignacion)
total_ajustado = pvp_ajustado * cantidad_redondeada
```

El PVP ajustado es una vista de distribución de costos; no reemplaza el PVP base
literal ni necesariamente el precio comercial por prueba.

## Controles obligatorios

1. `K`, `S` y los denominadores deben ser mayores que cero.
2. Si la demanda total es cero, adicionales e inversión por prueba son **no
   calculables**. No devuelvas cero como precio completo.
3. Confirma si la modalidad efectiva incrementa la demanda de abastecimiento en
   20 % y si los totales comerciales continúan usando la demanda original.
4. Determina el redondeo desde el bloque fuente: no hay una única regla global.
5. Verifica que referencias absolutas permanezcan absolutas al copiar fórmulas.
6. No confíes en resultados cacheados si no coinciden con la fórmula recalculada.

## Evidencia mínima para reconstruir una celda

- coordenada y fórmula dañada;
- dos fórmulas equivalentes funcionales, cuando existan;
- valores de todos los precedentes;
- cálculo independiente;
- diferencia contra el valor cacheado;
- nivel de certeza y cualquier decisión de negocio pendiente.
