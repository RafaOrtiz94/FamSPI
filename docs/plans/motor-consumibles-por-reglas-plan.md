# Motor de consumibles por reglas — plan de 2 fases y documento de relevo

> **Para quien continúe este trabajo (persona u otra IA):** este archivo es la única fuente de
> verdad del plan. Léelo completo antes de tocar código. Todo lo que aparece en la sección 2 fue
> verificado en el código y en producción el **2026-10-13**; todo lo que aparece en la sección 5
> **no se sabe todavía** y no debe suponerse. Cuando termines una tarea, actualiza la sección 9
> (bitácora) en el mismo cambio.

- **Estado del plan:** en ejecución. La infraestructura transversal y la vista comparativa beta están implementadas; las fórmulas siguen pendientes de evidencia.
- **Fase 1 = Senior Pro:** motor transversal para todas las familias y equipos, en modo sombra y visible solo para TI.
- **Fase 2 = Senior Ultra:** validación, simulación en el tiempo y conexión controlada a la oferta.
- **Planes para dejarlo usable (2026-10-15):** `docs/plans/motor-prediccion-consumibles-planes-senior.md` (Senior, Senior Pro, Senior Ultra).
- **Orden obligatorio:** la Fase 2 no empieza hasta cumplir la puerta de salida de la Fase 1 (sección 6.4).

---

## 1. Qué problema resuelve

El Business Case necesita saber cuántos **calibradores, controles, materiales y electrolitos (ISE)**
entregar a un cliente durante un proceso. Hoy esa cantidad la escribe el aplicacionista en una
hoja de cálculo. El sistema tiene un "modelo predictivo" que intenta sugerirla, pero no sirve como
fuente de cantidades (ver 2.3).

**Dirección fijada por el usuario el 2026-09-29, vigente y no negociable:**

1. Las cantidades salen de **fórmulas por reglas**, no de un modelo histórico ni de ML.
2. El cálculo es para la **duración del proceso** (`bc_requirements.projected_deadline_months`), **no anual**.
3. Las reglas usan: la ficha del producto (presentación, volumen, estabilidad abierto y a bordo), la
   estadística del Business Case (determinaciones, días y turnos del laboratorio), el desperdicio y
   el tiempo abierto frente a la estabilidad.
4. Los cambios de producto (presentación, estabilidad…) se **versionan**; el cálculo usa la versión vigente.
5. La meta es **99,9 % de exactitud contra "lo que debería ser"** (casos validados por un experto),
   **no** contra lo que el aplicacionista registró en la hoja. `planned_qty` no es la verdad.
6. El modelo histórico queda **solo como comparación**.
7. Deben poder agregarse variables después (por ejemplo, experiencia del aplicacionista).

---

## 2. Estado real verificado (2026-10-13)

### 2.1 Piezas que existen

| Pieza | Archivo | Qué hace | Estado |
|---|---|---|---|
| Laboratorio de precios | `backend/src/modules/business-case/businessCasePricingLab.service.js` (+ `.controller.js`) | Orquesta todo y arma la respuesta. `buildPreview` llama al modelo histórico en la línea ~783. | Activo, **solo lectura** |
| Fórmulas auditadas de matrices | `matrixCalculationEngine.service.js`, `matrixCalculationPackages.registry.js`, `calculationPackages/hematology*.js` | Paquetes curados atados al SHA-256 del libro de cálculo. | Hematología: 13 alcances activos, 14 en cuarentena |
| Fórmula auditada de cantidades cobas | `calculationPackages/immunoChemistryCobasQuantities.package.js` (+ `.data.json`) | Reactivo: `ROUNDUP(max(demanda / DET_KIT, 360 / estabilidad))`. Resto: mínimo por estabilidad si el producto está en uso. | Solo configuración `COBAS PRO c503 e801`. **ISE queda fuera.** Sigue siendo **anual (360 días)**. |
| Modelo histórico | `businessCasePredictiveLab.service.js` (versión `hybrid-pro-ultra-0.6.0`) | Vecino más cercano por perfil de reactivos. | Activo como sugerencia; ver 2.3 |
| Evidencia de fabricante | `businessCaseManufacturerKnowledge.catalog.js` | Hechos de Roche/Sysmex, locales y de solo lectura. | Activo |
| Fichas técnicas versionadas | tabla `catalog_consumable_specs` (migraciones 305 y 306) | Una fila por versión de ficha (`valid_from`/`valid_to`). | Cargadas; ver 2.2 |
| Extractor de fichas | `backend/scripts/consumable-specs/run.js`, `consumableSpecsExtractor.js`, `elabdoc.js`, `curatedCobasPure303.json` | Genera SQL desde Roche eLabDoc (`--mode=seed` / `--mode=update`). No escribe en la base. Requiere `pdftotext`. | Funciona |
| Ajustes del laboratorio por producto | `bcLabProductParameters.service.js`, tabla `bc_lab_product_parameters` (migración 307), UI `spi_front/src/modules/comercial/components/workspace/sections/LabProductParametersCard.jsx` | El laboratorio ajusta intervalos y estabilidades. Expone `effective = ajuste ?? fabricante`. | Existe; **0 ajustes guardados en producción** |
| UI del laboratorio | `spi_front/src/modules/comercial/components/workspace/sections/PricingLabSection.jsx` | Muestra sugerida, registrada y coincidencia. | Visible solo para `jefe_ti` / `jefe_de_ti` |

Rutas: `GET` y `POST /:id/pricing-lab/preview` en `businessCase.routes.js`, protegidas por
`requirePricingLabTi`. Ajustes: `GET/PUT /:id/lab-environment/product-parameters`.

Documentación previa del módulo: `backend/src/modules/business-case/CONTEXT.md` §12 y
`MATRIX_CALCULATION_SENIOR_PRO.md`.

### 2.2 Datos medidos en producción

- Business Cases: 24 en `DATOS_BASE_COMPLETOS`, 14 en `DRAFT_INICIAL`.
- `bc_requirements.projected_deadline_months`: presente en los 25 registros, entre 3 y 63 meses.
- `bc_lab_environment`: 25 filas. Columnas: `work_days_per_week`, `shifts_per_day`, `hours_per_shift`,
  `quality_controls_per_shift`, `control_levels`, `routine_qc_frequency`, `special_tests`, `special_qc_frequency`.
- `bc_dispatch_items`: 4.107 filas en 24 Business Cases; **ninguna** con `ops_dispatched_qty > 0`.
  No existe la columna `dispatch_status` (el servicio histórico la consulta y siempre recibe `undefined`).
- `catalog_consumable_specs` (684 fichas vigentes): `extracted` 458, `partial` 131, `pending` 63,
  `verified` 27, `requires_review` 5.
  - Las 27 `verified` son **12 calibradores, 10 controles y 5 materiales**. **Ningún reactivo está verificado.**
  - `consumption_basis`: `per_test` 378, `calibration_event` 106, `unknown` 96, `qc_event` 79, `onboard_time` 22, `maintenance` 2.
  - Columnas: `supplier_code`, `item_type`, `product_name`, `valid_from`, `valid_to`, `containers_per_pack`,
    `container_volume_ml`, `levels_per_pack`, `tests_per_pack`, `stability_open_days`, `stability_onboard_days`,
    `single_use`, `replacement_interval_days`, `consumption_basis`, `compatible_systems`, `system_specs` (JSONB),
    `parameters` (JSONB), `source_*`, `verification_status`, `notes`.
  - `system_specs` guarda por analizador: estabilidad a bordo, eventos de calibración, intervalos
    (`interval_days`, `onboard_pack_interval_days`, `same_lot_interval_days`, `onboard_kit_interval_days`),
    réplicas e intervalo de control. La clave `todos` aplica a todos los analizadores del documento.
  - `parameters.linked_products`: calibradores, controles y materiales que lista el documento de cada reactivo.
- `bc_consumption_items`: reactivos 1.992 filas, calibradores 829, controles 679, materiales 623.

### 2.3 Por qué el modelo histórico no sirve como fuente

Ejecutado con sus propias funciones (`__testables.backtest`) sobre producción:

- Exactitud de cantidad en conjunto: **22,4 %**; por equipo entre 0 % y 42,9 %. Cantidad exacta en 9,2 % de las filas.
- Se compara contra `planned_qty` (la hoja del aplicacionista), que no es la verdad.
- 23 muestras (Business Case × equipo) en 11 equipos: solo 2 equipos tienen 5 casos; 6 tienen un único caso.
- 0 muestras con despacho completo: la validación "operacional" que exige el propio modelo no se puede calcular.

**Consecuencia:** no se debe invertir en mejorar el modelo histórico. Queda como comparación.

---

## 3. Reglas que no se pueden romper

1. **No escribir en la oferta.** `offerWriteEnabled=false` y `publishable=false` se mantienen durante toda
   la Fase 1. Solo la Fase 2, tarea U6, puede cambiarlo, y solo con su puerta de control.
2. **No usar `planned_qty` ni `ops_dispatched_qty` como verdad** para medir exactitud.
3. **No inventar parámetros de producto.** Si una ficha no trae un dato, el producto queda como
   "sin regla" con el motivo; nunca se rellena con un valor por defecto silencioso.
4. **No usar fichas no verificadas para un resultado "validado".** Una ficha `extracted`, `partial`,
   `pending` o `requires_review` puede producir un cálculo, pero marcado como **no verificado**.
5. **No hay sustitución entre equipos ni modalidades** (regla ya vigente en el motor de matrices).
6. **Antes de usar una columna en SQL, comprobar que existe** en el entorno (`information_schema`).
   Este repositorio aplica migraciones a mano y ya tuvo incidentes por columnas ausentes en producción.
7. **Todo cambio se prueba primero en el staging local** (`scripts/staging_local.ps1`) y solo se despliega
   a producción con instrucción explícita del usuario.
8. **Las contraseñas salen de Secret Manager** (`DB_PASSWORD`, proyecto `famspi-sbox`); nunca de un `.env`
   local ni impresas en pantalla.
9. **No hacer commit** salvo que el usuario lo pida.
10. **Reglas puras separadas de la base de datos**, con pruebas unitarias (patrón ya usado en el módulo:
    un archivo `*.rules.js` sin SQL y un `*.service.js` que lee y llama a las reglas).

---

## 4. Decisiones del usuario

No avanzar más allá de lo indicado cuando una decisión siga abierta:

| # | Decisión | Bloquea |
|---|---|---|
| D1 | ¿Quién en Aplicaciones valida las cantidades "que deberían ser" y cuántos Business Cases puede revisar? | Tarea P5 y la puerta de salida de la Fase 1 |
| D2 | **Resuelta 2026-10-13:** el motor debe cubrir todas las familias y equipos. La beta se mantiene como vista exclusiva de `jefe_ti`/`jefe_de_ti`. | Define P0–P4; no autoriza escritura en oferta ni apertura de roles. |
| D3 | ¿Cuántos casos validados se exigirán por familia/equipo para la puerta de exactitud? | P5, P6 y puerta de salida. No asumir que cinco casos globales cubren todas las familias. |

---

## 5. Lo que NO se sabe (no suponer)

1. **Volumen de calibrador y de control consumido por evento/prueba y frecuencia completa por reactivo,
   para cada familia/equipo.** Debe salir de documentación del fabricante. El extractor actual no obtiene
   el consumo por evento. Sin esto no se pueden calcular calibradores ni controles por reglas.
2. **Resuelto 2026-10-13:** `bc_equipment_selection.equipment_id` referencia el catálogo real
   `servicio.equipos.id_equipo`. El alcance operativo debe unir además con el Business Case actual; existen
   22 selecciones huérfanas que no deben contarse.
3. **La regla de electrolitos (ISE).** El libro solo trae el mínimo por estabilidad, que no representa lo
   entregado. Depende del volumen de muestras. Hallazgo abierto: el ISE Reference Electrolyte 2 × 2000 mL
   (8392013190) es para cobas ISE neo/pro ISE, no para c 303 (le corresponde 10820652216, 1 × 500 mL); los
   electrodos 10825441001, 10825468001, 3246353001 y 3149501001 no tienen ficha para c 303.
4. **Cómo modelar el desperdicio.** El usuario lo pide como variable; no hay dato ni fórmula definida.
5. **Si el redondeo final es por envase, por caja o por presentación comercial.** Las fórmulas auditadas
   usan `ROUNDUP`; confirmar la unidad con Aplicaciones para cada tipo.
6. **Resuelto 2026-10-13 para el alcance global:** hay 25 Business Cases actuales con equipo seleccionado,
   repartidos en 11 equipos y 6 categorías almacenadas. Hay 19 equipos del catálogo sin un BC actual.

7. **Convenciones del primer adaptador, sin confirmar por Aplicaciones** (por eso sale `verified: false`):
   - mes de 30 días (el libro auditado usa año de 360 días);
   - `bc_consumption_items.annual_qty` de reactivos ("DET/AÑO/PROCESO") es demanda **anual**, y se
     escala por `meses/12`. Si en realidad ya es la demanda de todo el proceso, la regla sobrestima;
   - la unidad es la misma del libro ("producto a entregar"), sin convertir a envases o cajas.
8. **Por qué la hoja no coincide con la regla.** En el único Business Case con ese equipo (15 meses),
   la regla coincide con `planned_qty` en 9 de 165 productos. No se sabe si la hoja está en base
   anual, si el aplicacionista ajusta a mano, o si la regla está mal. Es justo lo que P5 debe resolver.

Cada punto debe resolverse con evidencia (documento del fabricante, consulta a la base o respuesta del
usuario) y anotarse en la bitácora antes de usarlo.

---

## 6. FASE 1 — Senior Pro: motor transversal en beta

**Objetivo:** calcular por reglas, para la duración del proceso, las cantidades de calibradores,
controles y materiales de todas las familias/equipos, con explicación por producto, en modo sombra.

**Fuera de alcance de la Fase 1:** electrolitos (ISE), simulación día a día, escritura en la oferta
y abrir la pantalla a más roles. Un producto sin regla o evidencia suficiente debe aparecer como `no_rule`.

### 6.1 Diseño acordado

Archivos nuevos propuestos (nombres a respetar para no duplicar):

- `backend/src/modules/business-case/consumableRules.rules.js` — reglas puras, sin SQL.
- `backend/src/modules/business-case/consumableRules.service.js` — lee Business Case, fichas vigentes y
  ajustes efectivos; llama a las reglas.
- `backend/src/modules/business-case/__tests__/consumableRules.rules.test.js`.

Entradas de cada cálculo (todas con su origen registrado en la respuesta):

- Duración: `bc_requirements.projected_deadline_months`.
- Laboratorio: `bc_lab_environment` (días por semana, turnos, controles por turno, niveles de control).
- Demanda: `bc_consumption_items.annual_qty` de los reactivos del equipo.
- Ficha vigente: `catalog_consumable_specs` con `valid_to IS NULL`, bloque de `system_specs` resuelto con
  la misma lógica de `bcLabProductParameters.service.js` (`resolveSystemSpec`: específico → `todos` → `cobas c systems`).
- Valor efectivo: `effectiveValues` de `bcLabProductParameters.service.js` (ajuste del laboratorio, o fabricante).
- Vínculos: `parameters.linked_products` del reactivo.

Forma general de la regla (a confirmar por tipo en P1; no es una fórmula cerrada):

```
eventos           = función de (duración, intervalo efectivo, días y turnos, cambios de lote)
consumo_por_uso   = cantidad consumida en cada evento
necesidad_por_uso = eventos × consumo_por_uso
necesidad_por_vencimiento = duración_en_días ÷ estabilidad_efectiva   (envases que caducan abiertos)
cantidad          = ROUNDUP( max(necesidad_por_uso, necesidad_por_vencimiento) ÷ contenido_del_envase )
```

Salida por producto: `quantity`, `unit`, `formula` (texto), `inputs` (valor y origen de cada uno),
`specVersion` (id y `valid_from` de la ficha), `verified` (true solo si la ficha es `verified` y no hubo
dato faltante) y, si no se pudo calcular, `status: "no_rule"` con `reason`.

### 6.2 Tareas

Marcar `[x]` al terminar y anotar en la bitácora.

- [x] **P0 — Preparación.** Identificar desde Neon las categorías, equipos y Business Cases actuales.
      Entregable: inventario documentado en la bitácora, excluyendo selecciones huérfanas.
- [ ] **P1 — Reglas puras por tipo.** Implementar en `consumableRules.rules.js` las reglas de calibrador,
      control y material con pruebas unitarias que cubran: duración corta y larga, vencimiento que domina
      sobre el uso, envase de uso único, dato faltante (`no_rule`).
      *Criterio:* pruebas en verde; ningún valor por defecto silencioso.
      *Avance 2026-10-13:* existe el registro exacto sin fallback y la salida segura `no_rule`; faltan
      adaptadores con fórmulas respaldadas, por lo que P1 continúa abierta.
      *Avance 2026-10-13 (2):* **primer adaptador real** en `consumableRuleAdapters.js`, solo para
      `cobas Pro <503+801> ISE` (código `FAM-COBASPRO503801ISE`, familia `configuracion`). Aplica a la
      duración del proceso la fórmula anual ya auditada del libro (`immunoChemistryCobasQuantities`):
      reactivo `ROUNDUP(MAX(DET_AÑO × meses/12 ÷ DET_KIT, meses×30 ÷ estabilidad))`; resto
      `ROUNDUP(meses×30 ÷ estabilidad)` si el producto está en uso. Con 12 meses reproduce exactamente
      la fórmula anual (probado contra todas las filas del libro). Sale siempre `verified: false` y
      `validation.status = "pending_expert"`. **No** cubre consumo por evento, desperdicio ni ISE, así
      que P1 sigue abierta para: las demás familias/equipos y la parte de uso por evento (punto 5.1).
- [ ] **P2 — Lado del reactivo en todas las familias/equipos.** Completar frecuencia de calibración y volumen de
      calibrador y control por prueba (punto 5.1) desde los Method Sheets, usando el extractor existente.
      Las fichas nuevas entran como `extracted` y pasan a `verified` solo tras revisión humana.
      *Criterio:* cada reactivo con demanda en los Business Cases de P0 tiene esos datos o figura como pendiente.
- [ ] **P3 — Servicio y duración del proceso.** `consumableRules.service.js` calcula para la duración del
      proceso y devuelve la salida de 6.1. Integrarlo en `buildPreview` como **tercera fuente**, sin quitar
      las fórmulas auditadas ni el histórico.
      *Criterio:* el `GET` del laboratorio devuelve, por producto, regla, hoja e histórico.
      *Avance 2026-10-13:* servicio e integración en modo sombra terminados con trazabilidad y `no_rule`;
      P3 sigue abierta hasta que existan cantidades calculadas por adaptadores validados.
      *Avance 2026-10-13 (2):* el servicio recibe el resultado anual auditado del laboratorio
      (`deterministicEquipmentResults`) y pasa a cada regla sus filas del libro y si el producto está en
      uso. Ya devuelve cantidades para la duración del proceso en el equipo con adaptador. Sigue
      abierta porque esas cantidades no están validadas por experto.
- [ ] **P4 — Interfaz de comparación.** En `PricingLabSection.jsx`: tres columnas (regla, hoja, histórico),
      diferencia resaltada y un detalle por producto con fórmula, entradas y documento de origen.
      Respetar `DESIGN.md` (tokens semánticos, sin colores fijos, sin `alert`/`confirm`).
      *Criterio:* captura en staging local sin errores de consola.
      *Avance 2026-10-13:* comparación, filtros y agrupación familia/equipo implementados; falta la captura
      y verificación manual en staging local para cerrar P4.
      *Avance 2026-10-13 (2):* verificada en staging local como `prueba.jefe_ti` en el Business Case con
      `cobas Pro <503+801> ISE`: carga sin errores de consola ni desborde, muestra "410 producto(s) ·
      369 calculado(s) · 41 sin regla" y el detalle con fórmula, fuente de la regla y el aviso
      "Pendiente de validación por Aplicaciones". **Pendiente para cerrar P4:** la pantalla usa clases
      de color fijas además de variables; no cumple del todo "tokens semánticos" de `DESIGN.md`.
- [ ] **P5 — Casos validados por experto.** Tabla nueva para guardar, por Business Case y producto, la
      cantidad correcta firmada por Aplicaciones (quién y cuándo). Pantalla mínima para cargarla.
      **Bloqueada por D1.** Requiere migración numerada nueva y su aplicación manual.
- [ ] **P6 — Medición.** Exactitud de la regla contra los casos de P5, con la misma definición ya usada:
      `max(0, 100 × (1 − WAPE))` sobre cantidades positivas. Mostrarla en el laboratorio junto al número de casos.
- [ ] **P7 — Histórico como alerta.** El histórico deja de ser "sugerencia" y pasa a marcar incoherencias
      (regla muy distinta del vecino). No cambia su cálculo.
- [ ] **P8 — Documentación.** Actualizar `CONTEXT.md` §12 y este archivo.

### 6.3 Cómo verificar la Fase 1

```bash
# Pruebas del módulo
cd backend && npx jest src/modules/business-case

# Lint (comprobar el código de salida, no solo la salida filtrada)
cd backend && npx eslint src/modules/business-case; echo "exit $?"
cd spi_front && npx eslint src/modules/comercial; echo "exit $?"

# Staging local: backend 8090, frontend 3101, base 5544
.\scripts\staging_local.ps1 -Action backend
```

Volver a medir el estado de datos con el guion de solo lectura usado en este análisis (consulta de 2.2):
cuenta fichas por `verification_status`, despachos con cantidad y Business Cases por estado.

### 6.4 Puerta de salida de la Fase 1

La Fase 2 solo empieza cuando se cumplen **todas**:

1. P1–P4 y P6–P8 terminadas y verificadas en staging local.
2. Cobertura mínima de Business Cases por familia/equipo definida en D1/D3 y validada por experto (P5).
3. Exactitud de la regla contra esos casos **≥ 99,9 %**, o una lista explícita de los productos que fallan y por qué.
4. El usuario aprueba pasar a la Fase 2.

Si el punto 3 no se alcanza, **no** se relaja la meta: se corrigen reglas o fichas y se vuelve a medir.

---

## 7. FASE 2 — Senior Ultra: escalamiento

Cada tarea presupone la Fase 1 cerrada.

- [ ] **U1 — Revisión de fichas a escala.** Pantalla de revisión de fichas por producto para llevar las 458
      `extracted` a `verified`, y resolver las 131 `partial`, 63 `pending` y 5 `requires_review`.
      Completar adaptadores por familia/equipo y sacar de cuarentena solo los paquetes aprobados.
- [ ] **U2 — Electrolitos (ISE).** Regla propia basada en volumen de muestras (resolver 5.3 primero).
- [ ] **U3 — Simulación en el tiempo.** Calendario del proceso día a día: aperturas, vencimientos por
      estabilidad, calibraciones por cambio de lote y desperdicio. Entrega cantidad y fechas de necesidad.
- [ ] **U4 — Versionado en uso.** Cuando una ficha cambia de versión (`--mode=update` del extractor), marcar
      los Business Cases afectados y permitir recalcular con la versión vigente.
- [ ] **U5 — Ciclo con la realidad.** Capturar lo realmente despachado y consumido (hoy en cero) y
      compararlo con lo calculado. Requiere acordar con Operaciones cómo se registra.
- [ ] **U6 — Conexión a la oferta con puerta de control.** Escribir la cantidad calculada en la oferta
      **solo** para familias con ≥ 99,9 % contra casos validados, con aprobación de Aplicaciones y registro de
      quién aprobó. Es la única tarea que puede activar `offerWriteEnabled`.
- [ ] **U7 — Variables adicionales** (por ejemplo, experiencia del aplicacionista) como factores explícitos,
      con nombre, valor y origen visibles en la explicación.
- [ ] **U8 — Tablero de calidad del modelo:** exactitud por familia y producto, productos sin ficha,
      diferencias contra la hoja.
- [ ] **U9 — Apertura a más roles** con solo lectura para Comercial (hoy solo Jefe de TI).

Dependencias externas de la Fase 2 que no se resuelven con código: disponibilidad de Aplicaciones para
revisar fichas y validar casos (U1, U6) y registro real de despachos por Operaciones (U5).

---

## 8. Protocolo de relevo

Para continuar sin desviarse:

1. Leer este archivo completo y `backend/src/modules/business-case/CONTEXT.md` §12.
2. Revisar la bitácora (sección 9): la última entrada dice qué se hizo y qué sigue.
3. Ejecutar `git status` y `git diff --stat` para ver qué hay sin confirmar. **El repositorio tiene muchos
   cambios sin commit de otros trabajos** (módulo CRM y otros): no revertirlos ni mezclarlos con este plan.
4. Tomar **la primera tarea sin marcar** de la fase en curso. No saltar tareas ni adelantar la Fase 2.
5. Antes de escribir código para una tarea, comprobar en el código real lo que la tarea da por hecho
   (los nombres de archivo y columnas de la sección 2 son del 2026-10-13 y pueden haber cambiado).
6. Si la tarea depende de un punto de la sección 5 o de una decisión de la sección 4, **detenerse y
   preguntar al usuario**; no rellenar con suposiciones.
7. Al terminar: marcar la casilla, agregar la entrada a la bitácora y decir con claridad qué se verificó
   y qué no.

Cómo se trabaja con el usuario en este proyecto:

- Responde en español, en lenguaje simple y directo.
- Quiere ver primero el análisis del código real, luego la propuesta y luego la implementación.
- Despliega a producción solo cuando él lo pide de forma explícita.
- Hace los commits él mismo.

---

## 9. Bitácora

Agregar siempre al final: fecha, quién, qué se hizo, qué se verificó, qué sigue.

| Fecha | Quién | Qué se hizo | Verificado | Sigue |
|---|---|---|---|---|
| 2026-10-13 | Claude (Opus 5.5) | Auditoría del modelo predictivo en código y producción (solo lectura). Redacción de este plan. **Sin cambios de código ni de base de datos.** | Cifras de la sección 2 medidas en producción ese día. | Esperar respuesta a D1 y D2; luego empezar por P0. |
| 2026-10-13 | Codex | D2 resuelta: alcance ampliado a todas las familias/equipos, beta solo TI. P0 global ejecutada en Neon. Se implementó la infraestructura transversal `consumableRules` con selector exacto, trazabilidad y `no_rule`; se integró como tercera fuente y se construyó la comparación multi-familia en frontend. **Sin cambios en DB, rutas, RBAC ni oferta.** | Neon: 25 BC actuales, 11 equipos, 6 categorías; 159/185 productos demandados con ficha y solo 2 verificados. `buildPreview` real pasó para c303 (170 productos) y XP300 (4), todos `no_rule`. Backend business-case: 41 suites/311 tests en verde (2 skipped). Frontend: 4 tests, lint y build en verde; build conserva warnings globales preexistentes. | Obtener fórmulas/evidencia por familia (P1/P2), verificar P4 en staging y resolver D1/D3 antes de P5/P6. |
| 2026-10-13 | Claude (Opus 5.5) | Revisión del trabajo de Codex (confirmado: armazón correcto, registro vacío). **Hallazgo:** en la misma carpeta hay un cambio sin commit en `businessCaseOffer.service.js` (`resolveOfferContractObjectType`) que afecta a la oferta oficial; el laboratorio depende de él. No es parte de este plan y debe confirmarlo el usuario antes de desplegar. Luego: primer adaptador real (`consumableRuleAdapters.js`) para `cobas Pro <503+801> ISE`, cableado en `consumableRules.rules.js` (`requiresSpec:false`, `no_rule` devuelto por el adaptador) y `consumableRules.service.js` (contexto del libro auditado, productos del libro como objetivos). Detalle de validación pendiente en `PricingLabSection.jsx`. **Sin cambios en DB, rutas, RBAC ni oferta. Nada desplegado.** | Backend business-case: 42 suites / 325 tests en verde; lint limpio. Prueba clave: con 12 meses la regla da lo mismo que la fórmula anual en todas las filas del libro. Corrida real (BD local, 24 BC): 369 productos calculados (166 con cantidad) en 1 BC de 15 meses; 2.985 siguen `no_rule`; 0 verificados; banderas de modo sombra intactas. Frontend: 4 tests y lint en verde; pantalla revisada en staging local. | 1) Usuario: confirmar las convenciones del punto 5.7 y responder D1/D3. 2) P2: extraer de los Method Sheets el volumen por prueba para calcular uso por evento. 3) Adaptadores para hematología (sus fórmulas auditadas ya existen en `calculationPackages/hematology*`). |
| 2026-10-13 | Claude (Opus 5.5) | **Cambio de estructura pedido por el usuario: dos fuentes por producto.** `evaluateConsumableSources` (`consumableRules.rules.js`) calcula cada producto con (1) `audited_formula`: la formula validada, adaptador exacto como antes; y (2) `official_document`: la ficha vigente del fabricante, en el archivo nuevo `consumableDocumentRule.js`, para cualquier equipo. Reactivo `ROUNDUP(MAX(demanda_proceso / tests_per_pack, dias / estabilidad a bordo))`; calibrador/control/material `ROUNDUP((dias / estabilidad abierto o a bordo) / containers_per_pack)` solo si hay evidencia de uso (vinculado por un reactivo con demanda, o en uso segun el libro auditado). Sin dato no se inventa: `TESTS_PER_PACK_MISSING`, `STABILITY_MISSING`, `USAGE_NOT_DETERMINED`, `USAGE_PER_EVENT_REQUIRED` (un solo uso). Cantidad principal = formula validada si existe; si no, documento. Salida nueva por producto: `sources`, `primarySource`, `agreement` (match / differs / single_source / none). **Recetas:** `buildRecipes` en `consumableRules.service.js` arma por reactivo sus calibradores, controles y materiales desde `parameters.linked_products` de la ficha vigente; no se guardan, se regeneran en cada lectura (cambian solas al versionar la ficha). `verified` sigue en `false` para ambas fuentes hasta validacion de experto; la ficha revisada se expone aparte como `documentVerified`. Pantalla: columnas "Formula validada" y "Documento oficial", detalle con las dos fuentes y panel "Recetas por reactivo". Sigue en modo sombra, sin escritura en oferta. | Backend business-case 43 suites / 335 tests en verde, lint limpio; frontend 4 tests y lint en verde. Corrida real (BD local, 24 BC): 3.354 productos, **2.637 calculados** (antes 369), 717 sin regla; documento calcula 2.592 (612 con cantidad > 0), formula 369; con ambas fuentes 324: **268 coinciden, 56 difieren**; 0 verificados. Recetas: 419 reactivos con demanda, 257 completas, 59 sin vinculos en ficha. Sin regla: 361 uso no determinado, 162 sin ficha, 102 sin pruebas por kit, 40 sin estabilidad, 33 sin codigo. | 1) Revisar con Aplicaciones los 56 que difieren (ej. Cfas Proteins: formula 17 / documento 4): ahi esta la primera evidencia de cual fuente acierta. 2) Limite conocido de la fuente documento: calibradores/controles solo por vencimiento, sin consumo por evento (falta volumen por evento en fichas, P2). 3) Cargar fichas de los 162 productos sin ficha y completar `tests_per_pack` en 102. |
| 2026-10-13 | Claude (Opus 5.5) | **Receta por evento desde el documento oficial** (pedido del usuario: la presentacion no sirve, hay que predecir cuantos calibradores, controles y materiales se usan). `consumableDocumentRule.js`: nueva `reagentEvents` saca de la ficha del reactivo las calibraciones (`ROUNDUP(dias / intervalo)`; 1 si solo exige cambio de lote) y las corridas de control (`dias de trabajo × corridas por dia` + tras calibracion + por kit; dias y horas de trabajo de `bc_lab_environment`). `consumableRules.service.js` (`buildDocumentEvents`) reparte esos usos a los productos vinculados: calibrador = suma de calibraciones de sus reactivos; control = mayor numero de corridas. Envases = `MIN(usos, ROUNDUP(dias / estabilidad))`; un solo uso = usos; material = solo vencimiento. La salida del documento trae `uses`, `containers`, `basis` (`per_event`, `per_event_single_use`, `stability_capped`, `stability_only`); la receta trae `events` por reactivo y `usesFromReagent`, `uses`, `containers` por componente. Pantalla: la columna Documento oficial muestra envases y usos, ya no la presentacion. Modo sombra intacto. **No desplegado** (el despliegue fue bloqueado por permisos; lo ejecuta el usuario). | Backend business-case 43 suites en verde, lint limpio; frontend 4 tests y lint en verde; staging local revisado como `prueba.jefe_ti`. Corrida real (24 BC): 2.647 calculados de 3.354; documento 2.610; con ambas fuentes 332: 266 coinciden, 66 difieren. Recetas: 419 reactivos con demanda, 359 con calibraciones declaradas, 255 con corridas de control declaradas. | Limites a resolver con Aplicaciones antes de confiar en la cantidad: (1) sin volumen por uso en las fichas no hay agotamiento por volumen; (2) sumar calibraciones de reactivos que comparten calibrador sobrestima si se calibran el mismo dia; (3) no se cuentan cambios de lote; (4) 164 reactivos sin intervalo de control en ficha; (5) el vencimiento asume el envase abierto, sin alicuotar ni congelar. |
| 2026-10-13 | Claude (Opus 5.5) | **Ocho mejoras de prediccion, todas en modo sombra y solo en local.** (7) Convenciones configurables (`resolveConventions` en `consumableDocumentRule.js`; se envian en `?conventions=` o en el cuerpo del preview y se eligen en pantalla): `demandBasis`, `reagentStability`, `reagentQcTests`, `qcBasis`, `conservation`, `reagentLotsPerYear`. **Evidencia contra la hoja (24 BC):** con `demandBasis=process` la formula validada pasa de 6 % a 49 % de coincidencia exacta (91 % con ±1, error 22 % -> 5 %): DET/AÑO/PROCESO es demanda de TODO el proceso (resuelve el punto 5.7). Con `reagentStability=ignored` el documento pasa de 13 % a 52 % exacto en reactivos (error 279 % -> 24 %). Ambos quedan por defecto. `qcBasis` no cambia el resultado de forma concluyente. (1) Volumen por uso: `parseSampleVolumeUl` + `scripts/consumable-specs/sampleVolume.js` generan `migrations/325_consumable_specs_sample_volume.sql` (226 de 375 reactivos); envases nunca menores que los que agota el volumen. (2) Conservacion: si la ficha declara estabilidad congelado, el envase dura eso (`conservation=document_best`). (3) Calendario compartido: `calibrationCalendar` + `containersForCalendar`; las calibraciones que caen dentro de la estabilidad del envase lo comparten. (4) Cambios de lote: una calibracion por lote si se indica `reagentLotsPerYear` (por defecto no se cuentan). (6) `buildDataGaps` lista los datos faltantes en fichas por impacto; un producto que la hoja pide y ninguna ficha vincula cuenta como en uso (`listed_with_quantity_in_business_case`). (8) Validacion: `migrations/326_bc_consumable_rule_validations.sql`, `consumableRuleValidations.service.js`, `PUT/DELETE /business-case/:id/pricing-lab/rule-validations` (solo Jefe TI) y exactitud por fuente en `ruleEngine.accuracy`. (5) Aprendizaje: factor real/predicho por equipo y producto con casos de OTROS Business Case, aplicable desde 3 casos (`item.learned`); `scripts/learn_consumable_rules_from_dispatch.js` carga despachos completos como casos. Nota tecnica: no usar la clave `primary` en respuestas, `apiNormalization` la renombra. | Backend business-case 45 suites / 352 tests en verde, lint limpio; frontend 4 tests y lint en verde; staging local revisado como `prueba.jefe_ti` (convenciones, validar y quitar, exactitud, fichas incompletas). Migraciones 325 y 326 aplicadas SOLO en la base local. Corrida real: 2.697 calculados de 3.354; C.f.a.s. baja de 845 a 65 envases y PreciControl ClinChem de 280 a 65 en un proceso de 60 meses. | 1) **No hay ningun despacho registrado** (`ops_dispatched_qty` vacio en los 22 BC): el aprendizaje y la exactitud dependen de que Aplicaciones valide casos en pantalla. 2) Calibradores, controles y materiales siguen lejos de la hoja, pero la hoja no es fiable para ellos (patrones de 1 por mes o valor 1 en procesos de 60 meses): solo la validacion de experto dira cual acierta. 3) 149 reactivos sin volumen de muestra en el documento; 149 materiales sin estabilidad. 4) Aplicar 325 y 326 en produccion antes o junto con el despliegue (sin 326 el laboratorio funciona, sin validaciones). 5) La validacion hoy solo la puede hacer Jefe TI: decidir que rol de Aplicaciones entra. |
| 2026-10-14 | Claude (Opus 5.5) | **Simulacion de escenarios (Monte Carlo).** `consumableSimulation.js` (puro, generador con semilla): minimo 5000 y maximo 20000 escenarios; por escenario sortea 16 variables (`SCENARIO_VARIABLES`: error de la estadistica, crecimiento, estacionalidad, ruido mensual, repeticiones, volumen muerto, si la demanda trae pruebas de QC, kit a bordo, dias de trabajo, corridas de QC por dia, controles fuera de rango, recalibracion por fallo, calibrar antes del intervalo, lotes por año, alicuotar y congelar, entrega cada 1/2/3 meses) y simula mes a mes reactivos, calibradores (calendario compartido), controles y materiales con entregas redondeadas a presentaciones. Resultado por producto: media, P10, P50, P90 (recomendado), P95 y entregas por trimestre. Modelo armado por `buildSimulationModel` en `consumableRules.service.js` (no viaja a la pantalla). `consumableSimulation.service.js` + `migrations/327_bc_consumable_simulations.sql` guardan la ultima simulacion por BC y equipo con el perfil del cliente (demanda mensual, meses, reactivos, dias, turnos, niveles); `profileDistance` encuentra los 5 clientes mas parecidos del mismo equipo y muestra su P50/P90 y lo validado. Cobertura contra validaciones: cuantos caen entre P10 y P90 y exactitud de P50 y P90. Rutas `GET/POST /business-case/:id/pricing-lab/simulations` (solo Jefe TI). Panel "Simulacion de escenarios" en el laboratorio. | Backend business-case 47 suites / 364 tests; frontend 5 tests; lint limpio. 5000 escenarios tardan 0,1 a 6,5 s por equipo con datos reales. Simulados los 12 equipos con modelo de los 24 BC locales (migracion 327 SOLO en local). Verificado en staging local desde la pantalla. | 1) Los rangos de las 16 variables son supuestos explicitos, no medidos: hay que afinarlos con casos validados (la cobertura P10-P90 es la medida). 2) Algunas distribuciones son bimodales (alicuotar o no; kit a bordo o no): el P90 puede quedar muy por encima del P50; confirmar con Aplicaciones esas practicas reduce el rango. 3) Aplicar 325, 326 y 327 en produccion junto con el despliegue. |
| 2026-10-14 | Claude (Opus 5.5) | **Simulacion automatica e historica.** `consumableSimulation.service.js`: huella SQL de las estadisticas del cliente (consumo, plazo, entorno, equipos, ajustes por producto, version del catalogo de fichas y `ENGINE_VERSION`); un BC con reactivos con demanda, plazo y equipo se simula solo (5000 escenarios, semilla derivada de la huella) cuando la huella cambia. Disparadores: job `bc_consumable_simulations` (`src/jobs/businessCaseConsumableSimulationScheduler.js`, cada 15 min, registrado en `server.js`) y `POST /internal/jobs/business-case/consumable-simulations` para el scheduler externo; ademas la lectura del laboratorio simula si esta desactualizado. `migrations/327_bc_consumable_simulations.sql` pasa a ser HISTORICO (una fila por corrida, `trigger` auto/manual, `input_fingerprint`, `engine_version`; `equipment_id = 0` marca BC sin modelo simulable para no reintentar). Prediccion automatica por producto (`predictFromHistory`): P90 de la simulacion, o calibrada con real/P50 de clientes parecidos (ultima corrida automatica de cada uno) ponderado por cercania cuando tienen cantidad validada o despachada. Pantalla: columna Prediccion, estado automatico, historial de corridas; el boton queda como recalculo opcional. | Backend business-case 47 suites / 368 tests; frontend 6 tests; lint limpio. Local: 21 BC con estadisticas -> 21 simulados solos (9 sin modelo simulable) en 120 s; segunda pasada 0 pendientes; cambiar una demanda dispara solo ese BC y revertirla vuelve al mismo resultado (misma semilla). Pantalla verificada en staging local sin hacer clic. | 1) En produccion la primera pasada simulara todos los BC con estadisticas por tandas de 10 cada 15 min. 2) Mientras no haya cantidades validadas ni despachos, la prediccion es el P90 (sin calibrar). 3) Subir `ENGINE_VERSION` cuando cambie el motor para re-simular todo. |
| 2026-10-14 | Claude (Opus 5.5) | **Estadistica del cliente estructurada (entrada del motor).** Situacion encontrada: el comercial sube el documento estadistico (`POST /business-case/:id/determinations/stat-document`) en cualquier formato (en local: PDF, Excel e imagen); solo se guarda en Drive. La demanda se transcribe a mano en DET/AÑO/PROCESO del Sheet y vuelve a `bc_consumption_items.annual_qty` con la sincronizacion. Existe `POST /determinations/parse-quantities-file` pero ninguna pantalla lo usa. Nuevo: `clientStatisticsTemplate.service.js` genera un Excel con una pestaña por equipo (ID, producto, y `Promedio mensual` en privado o `Cantidad del proceso` en publico; hoja oculta `_famspi` con el BC y los equipos) en `GET /business-case/:id/determinations/statistics-template`. Si el documento estadistico subido es ese formato: se guarda en `bc_client_statistics` (migracion 328) y DET/AÑO/PROCESO se carga solo (privado: promedio mensual x meses proyectados; publico: la cantidad), salvo reactivos cerrados o sin plazo; la respuesta trae `meta.statistics`. Otro formato sigue como respaldo. Pantalla de Determinaciones: boton `Descargar formato (Excel)` y resumen de lo cargado. | Backend 48 suites / 374 tests; frontend 3 tests nuevos; lint limpio. Local: formato descargado desde la pantalla como `prueba.jefe_comercial`; ida y vuelta real (3 reactivos x 60 meses) aplicada y restaurada. La subida por HTTP como comercial no se probo de punta a punta (requiere ventana y secciones previas). | 1) El formato lista todos los reactivos del catalogo del equipo (87 en cobas Pure 303), puede ser mas que las filas del Sheet. 2) Aplicar 328 en produccion. 3) Decidir si se exige el formato (hoy es opcional). |
| 2026-10-14 | Claude (Opus 5.5) | **Definicion del usuario: en compra privada DET/AÑO/PROCESO = promedio mensual × 12 (anual); en publica = cantidad del proceso.** Formato de estadistica: privado ahora multiplica por 12 (ya no por los meses del proceso ni depende del plazo). Motor: `defaultConventionsFor(bc_purchase_type)` fija `demandBasis` (privado `annual`, publico `process`); lo elegido en pantalla lo reemplaza; `loadPricingContext` trae `bc_purchase_type`. `ENGINE_VERSION` 2026-10-14.2 para re-simular. Usuario pidio NO desplegar: solo staging local. | Backend 48 suites / 375 tests; frontend 9 tests; lint limpio. Ida y vuelta local: 450/mes -> 5400. **Hallazgo:** contra la hoja, en privado el documento con base anual queda 5 veces arriba en procesos de 60 meses (0 % exacto) y con base proceso coincide 55 %: la hoja privada ("producto a entregar") parece ANUAL, mientras el motor predice para todo el proceso. En publico 48 % exacto (77 % ±1). | Confirmar con el usuario si "producto a entregar" en privado es anual; si si, comparar la prediccion del proceso dividida por años. |
| 2026-10-14 | Claude (Opus 5.5) | **Objetivo aclarado por el usuario: los reactivos NO se predicen; salen de la estadistica real del cliente (formato). El motor predice calibradores, controles y materiales.** `consumableRules.service.js`: `loadClientStatistics` + `applyClientStatistics`: si un equipo tiene `bc_client_statistics`, la demanda de sus reactivos sale solo de ahi (lo que no esta en la estadistica = el cliente no lo usa); sin estadistica se usa DET/AÑO/PROCESO del BC. Items marcan `demandSource` (`client_statistics`/`business_case`); el resumen trae `reagentDemandSource` y `reagentsFromStatisticsCount`. Simulacion: con dato real no se sortea el error de la estadistica; la huella incluye la estadistica (re-simula al subirla); `ENGINE_VERSION` 2026-10-14.3. Pantalla: "Reactivos: estadistica real del cliente (N en uso) · se predicen calibradores, controles y materiales". | Backend 48 suites / 377 tests; frontend 6 tests; lint limpio. Local: BC privado 54762e41 con estadistica de prueba (promedio = DET/12, hash `prueba-local`): 46 reactivos en uso, 46 recetas activas, simulacion automatica rehecha sola; verificado en pantalla. | Datos de prueba locales quedan cargados en ese BC (borrar con `DELETE FROM bc_client_statistics WHERE source_document_hash='prueba-local'`). |
| 2026-10-15 | Claude (Opus 5.5) | **Analisis de un caso real (Hospital General Latacunga, cobas Pro <503+801>, 15 meses) contra lo planificado en el Sheet y tres reglas.** 1) `consumableSpecsExtractor.parseStability` reconoce tambien "(freeze only once)" (fichas Elecsys); `scripts/consumable-specs/frozenStability.js` genero `migrations/329_consumable_specs_frozen_stability.sql` (81 fichas: 19 controles, 53 calibradores, 9 reactivos) desde el texto que ya guarda cada ficha. 2) Prediccion por tipo cuando no hay casos reales de clientes parecidos: controles y materiales = formula validada; calibradores = simulacion P90 (evidencia por tipo: calibradores P90 42 % vs formula 72 %; controles formula 68 % vs P90 266 %; materiales formula 57 % vs P90 83 %). Productos con formula pero sin datos para simular entran igual (prediccion = formula, sin rango). 3) `reagentLotsPerYear` = 3 por defecto (campo vacio = no contar). `ENGINE_VERSION` 2026-10-15.3. | Error total contra lo planificado 125 % -> 79 % (controles 244 % -> 90 %, calibradores 51 % -> 49 %, materiales 98 % -> 81 %). Backend 49 suites / 387 tests; frontend en verde. Migracion 329 SOLO en local. | Causas pendientes (necesitan datos): consumibles del equipo sin regla (ISE: estandares, electrolito, electrodos, diluyente; lampara) ~400 unidades; codigos de producto que no coinciden con los vinculados por la ficha (HbA1c, AFP, Progesterona, PSA); envases por presentacion faltantes en fichas Elecsys; confirmar el patron "1 por mes por nivel" en controles. Ojo: un solo caso; reglas por tipo a revalidar con mas casos. |
| 2026-10-15 | Claude (Opus 5.5) | Re-prediccion de los 22 BC locales con las reglas nuevas. Regla adicional: en la simulacion, un CONTROL que dura menos de 7 dias abierto y cuya ficha permite congelar se alicuota siempre (`MUST_ALIQUOT_BELOW_DAYS`); evitaba P90 absurdos (PreciControl Anti-CCP en MOVILAB: P90 928 con P50 15). Probada tambien en calibradores: empeoraba (49 % -> 58 %), por eso solo controles. `ENGINE_VERSION` 2026-10-15.5. | Latacunga: error 79 % (controles 90 %, calibradores 49 %, materiales 81 %). Controles bajan en todos los BC (ej. MOVILAB 2.613 -> 568, Hospiesaj 733 -> 103); calibradores casi sin cambio; materiales suben solo en los cobas Pro (206 -> 911) porque ahora entran los productos con formula validada sin datos para simular (ControlSet Vials 450 vs 360 real; HBQ Sample Set 90 vs 1 real). | Revisar con Aplicaciones HBQ Sample Set y SCCS (la formula sobreestima). |
| 2026-10-15 | Claude (Opus 5.5) | **Reglas de equipo desde el manual (ISE, lampara, electrodos).** Nuevo `consumableEquipmentManual.js` (puro), fuente: cobas pro User Guide 4.4 y Method Sheets Roche (eLabDoc). Lampara c 503 = ROUNDUP(MAX(horas de encendido / 750, dias / 180)); electrodos Na/K/Cl = ROUNDUP(MAX(dias / 60, pruebas ISE / 9000)) (sin pruebas ISE solo por tiempo, marcado `incomplete: ise_tests`); ISE Standard Low/High = una ampolla por calibracion diaria (validez 24 h) / 10 por caja. Sin intervalo publicado, `no_rule` con motivo: electrodo de referencia (Roche solo publica CoA) y Reference Electrolyte (estable hasta vencimiento, depende del volumen ISE). `evaluateOfficialDocument` aplica la regla antes de la ficha (`basis: equipment_manual`); la simulacion la deja fija (`manualQuantity`) y `predictFromHistory` la toma primero. `ENGINE_VERSION` 2026-10-15.6. Latacunga: lampara 0→15 (Sheet 18), electrodos 0→8 (9), estandares 0→45 (50/55); error materiales 81 %→68 %, total 79 %→70 %. Pendiente: pruebas ISE (Na/K/Cl) por año como dato del BC, para el limite de 9000 pruebas y el consumo de Diluent / Internal Standard / Reference Electrolyte (Sheet 75/75/50 contra 6/6/0). |
| 2026-10-15 | Claude (Opus 5.5) | **Pedido de los usuarios: sin formato de estadistica; los reactivos vuelven a leerse del Sheet. Nuevas "Estadisticas del laboratorio" que llena jefe_servicio.** Eliminado: `clientStatisticsTemplate.service.js` (+ test), `GET /determinations/statistics-template`, la lectura del formato al subir el documento estadistico (el documento sigue como respaldo y habilita el gate), el boton y el resumen en Determinaciones, `applyClientStatistics`/`loadClientStatistics` y la tabla `bc_client_statistics` (la migracion 328 local se reemplazo por `328_bc_lab_statistics.sql`, que la borra; nunca fue a produccion). Reactivos: DET/AÑO/PROCESO del Sheet = demanda real (`demandSource: "sheet"`, `fromSheet`, base `sheet_demand`), sin error de estadistica en la simulacion. Nuevo `labStatistics.service.js` + `GET/PUT /determinations/lab-statistics` (PUT: jefe_servicio, jefe_ti): muestras ISE por año (solo si hay equipo ISE), % de repeticiones y % de controles fuera de rango. Obligatorios hasta tener 3 procesos del mismo equipo con el dato; desde ahi el motor usa el promedio ponderado por parecido (muestras ISE escaladas por demanda mensual). Sin los obligatorios, validar la prediccion devuelve 409 `LAB_STATISTICS_REQUIRED`. Uso en el motor: electrodos (9000 pruebas) y ISE Diluent por volumen (450 µL por muestra); la simulacion sortea repeticiones y controles fuera de rango ±20 % alrededor del dato. `ENGINE_VERSION` 2026-10-15.7. Latacunga sin cambio en la medicion (70 %), porque aun no tiene estas estadisticas. |
| 2026-10-15 | Claude (Opus 5.5) | **Simulacion calibrada contra lo real (descarte por distancia) y justificacion obligatoria de diferencias con el Sheet.** `consumableCalibration.js` (puro): por cada BC con cantidades reales corre 200 000 escenarios, mide la distancia a lo real (error absoluto relativo) y conserva solo los 500 mas cercanos; explora tambien lo que llena jefe_servicio (repeticiones, controles fuera de rango, muestras ISE: `iseSamplesRatio`) y, nuevo, la fraccion de lo calculado que realmente se planifica por tipo (`planningShare`, solo al calibrar). `consumableCalibration.service.js` + migracion 330 `bc_scenario_calibrations`; real = validado por jefe_servicio o PRODUCTO A ENTREGAR, descartando Sheets con la mitad o mas de cantidades en 1 (relleno: 6 de 11 BC locales). Prediccion: se sortea solo entre los aceptados de OTROS BC (pesados por parecido), base `calibrated_scenarios` = mediana; sin calibracion, `simulation_p50`. Evidencia dejando uno fuera (5 BC reales): error total 125 % (regla anterior) -> 77-89 % segun la corrida (controles 199 -> 104-112 %, calibradores 179 -> 77-82 %, materiales 101 -> 69-86 %). Mas escenarios (50 000 vs 200 000) y nivel de descarte (0,25 % a 5 %) no cambian el resultado (89 % en todos): el limite son las 5 referencias reales y diferencias por producto. Determinaciones: si PRODUCTO A ENTREGAR difiere de la prediccion, jefe_servicio debe justificar con "Calculo" o "Criterio" (minimo 20 caracteres; queda como validacion y entra a la calibracion); sin eso no se puede bloquear controles/calibradores/materiales (UI y backend 409 `SHEET_DIFFERENCE_UNJUSTIFIED`). `ENGINE_VERSION` 2026-10-15.8. |
| 2026-10-15 | Claude (Opus 5.5) | **Verdad = entregas reales, no PRODUCTO A ENTREGAR (decision del usuario).** El usuario entrego el control de consumibles entregados del proceso anterior de Latacunga (`docs/IESS LATACUNGA- INMUNOQUIMICA 2024.xlsx`, 107 productos, sep-2024 a feb-2026). Contra lo entregado: contrato anterior 51 % de error (38/94 dentro de ±15 %), especialista (PRODUCTO A ENTREGAR) 52 % (34/87), motor 79 % (11/83); el motor se quedaba muy corto (calibradores 31 contra 216 entregados) porque la calibracion habia aprendido de los planes de otros BC. Cambios: migracion 332 `bc_delivery_history` + `deliveryHistory.service.js` (lee el formato: unidades a cajas, secciones, entregas por fecha, stock, periodo cubierto ignorando fechas mal tipeadas) + `GET/POST /determinations/delivery-history` (POST: jefe_servicio, TI) + panel en Determinaciones. La calibracion usa solo entregas reales (llevadas a la duracion del proceso) y validaciones de jefe_servicio; borra calibraciones sin verdad (las 4 hechas contra PRODUCTO A ENTREGAR). Prediccion: si el cliente tiene historial, base `client_history` = entregado × meses del proceso / meses cubiertos (prioridad maxima). `planningShare` ahora 5 %–600 % (Latacunga consume 3,1× la formula en calibradores, 1,6× en controles). `ENGINE_VERSION` 2026-10-15.9. Medicion en Latacunga contra lo entregado: prediccion final 95/117 dentro de ±15 % (44 % de error; por construccion, 91 productos salen del propio historial: no es prueba de generalizacion). La simulacion sola, aun calibrada con lo entregado del mismo BC, queda en 23/117 (116 %), igual que sin calibrar (24/117): el modelo por tipo no reproduce el consumo real por producto. Busqueda de estadisticas contra lo entregado: 24 -> 26 coincidencias (no se guardo). Siguiente paso necesario: historiales de entregas de otros clientes para aprender tasas de consumo por producto transferibles a clientes nuevos. |
| 2026-10-15 | Claude (Opus 5.5) | **Verificacion automatica contra procesos reales.** Nuevo `referenceConsumption.js` (puro): lee el registro de consumibles con entregas y lecturas de stock (formato HJMVI Tena; consumo = stock inicial + entregado - stock final) y el libro del BC con las hojas del especialista (DET, estabilidad, PRODUCTO A ENTREGAR; detecta columnas por seccion y el tipo por nombre en secciones mixtas), predice como cliente nuevo con el consumo real de OTROS procesos (manual del equipo > mismo codigo > mismo nombre > mediana de la familia, sin escalar por pruebas) y marca solo las unidades dudosas (real 5 veces o mas lejos del motor y del especialista). `scripts/consumable-prediction/verifyCases.js` (`npm run consumables:verify -- --db`): casos de `docs/Motor predictivo BC` (una subcarpeta por caso) y de `bc_delivery_history`; dejar uno fuera; Excel por caso en `Verificacion/`, releido y comparado celda por celda. Hallazgos: el especialista no tiene formula para calibradores/controles/materiales (solo "minimo por estabilidad" 360/dias y cantidad a mano); el consumo de un laboratorio predice su propia segunda mitad con 43 % de error por producto (techo practico). Resultado: Tena (con Latacunga) motor 9/50 dentro de ±15 %, error 51 %, total +19 % (especialista 10/50, 56 %, +26 %); Latacunga (con Tena) motor 13/82, 61 %, total -3 % (especialista 24/82, 59 %, +12 %). Aun no conectado a la prediccion de la aplicacion. |
| 2026-10-15 | Claude (Opus 5.5) | **Consumo real de referencia conectado a la prediccion de Determinaciones.** Migracion 333 `bc_reference_consumption` (procesos fuera del sistema, cargados con `verifyCases.js --load`, sin productos con unidad dudosa) + `referenceConsumption.service.js` (esas referencias + `bc_delivery_history` de OTROS BC). Orden de `predictFromHistory`: historial del cliente > manual del equipo > referencia (`reference_same_code`, `reference_same_name`, `reference_family_median`, con detalle visible en la UI) > simulacion. Solo productos en uso; la mediana de la familia exige uso confirmado (sin eso Latacunga recibia 112 productos no usados, controles 783). "CS" suelto = CalSet de inmuno. `ENGINE_VERSION` 2026-10-15.12. Verificacion automatica final: Tena (con Latacunga) 9/50, error 51 %, total +19 %; Latacunga (con Tena) 16/82, error 60 %, total -7 % (calibradores -44 % por medianas de familia de inmuno, que son la estimacion mas debil). En la app: IA prueba 98 productos por referencia (77 mismo codigo); Latacunga 91 por su historial + 27 por referencia. |
| 2026-10-15 | Claude (Opus 5.5) | **Consumo esperado y producto a entregar.** Medido: el redondeo por entregas casi no explica el plan del aplicacionista (mueve 2-10 puntos la distancia plan-consumo en Latacunga y Tena), salvo el minimo de 1 por entrega en calibradores. El motor predice el **consumo esperado**; el **producto a entregar** = entregas × ROUNDUP(consumo / entregas) (`determinationPredictions.toDeliver`), y es lo que se compara con PRODUCTO A ENTREGAR del Sheet y lo que valida jefe_servicio. Migracion 334: `bc_deliveries.partial_deliveries` (solo con "Parcial - Tiempo"), campo en Requerimientos. La UI muestra "Consumo esperado X · N entregas". La calibracion ya no toma las validaciones de jefe_servicio como verdad (son un plan, como el Sheet): verdad = solo entregas reales (`CALIBRATION_VERSION` 2026-10-15.4). Latacunga (4 entregas, cargadas en local desde sus observaciones): calibradores consumo 215 -> a entregar 260 (Sheet 205), controles 363 -> 408 (357), materiales 1898 -> 1960 (997). |
| 2026-10-16 | Claude (Opus 5.5) | **Justificacion estructurada (matriz de conocimiento) y HGP Puyo como tercer cliente.** (1) La justificacion de una diferencia con PRODUCTO A ENTREGAR es UN motivo + UN dato que debe reproducir la cantidad del Sheet (max(1, 10 %)): consumo por mes (transferible: entra como referencia `reference_expert`, despues del consumo real del mismo codigo), analizadores (transferible: multiplica el consumo en el mismo equipo), extra por entrega (transferible), stock del cliente (no transferible), decision comercial (solo nota, no se usa). `knowledgeMatrix.js`, migracion 335 `bc_knowledge_matrix`; la huella de la simulacion incluye la matriz. Probado de punta a punta: una justificacion en Latacunga cambio la prediccion de IA prueba (y se limpio). (2) Estadisticas del laboratorio OPCIONALES (no bloquean validar ni justificar). (3) Modalidad "determinacion efectiva": el excedente pasa a la siguiente entrega, sin redondeo por entrega. (4) Lectores: registro con codigo en columna B/C, tipo por nombre sin secciones, stock ordenado por fecha, etiquetas de stock en la fila superior (hoja TICS), `parseEffectiveDeterminations`; `casos.json` por carpeta (procesos del mismo cliente, hojas por proceso, `enCurso`, `historialDe`); verdad con >= 3 meses medidos. Puyo 2025: demanda real de reactivos 54 % del DET del BC. Verificacion con 3 clientes: Tena 15/51, error 33 %, total -2 % (antes 51 % / +19 %); Latacunga 17/82, 66 %, -6 %; Puyo 2025 28/73, 63 %, +29 %. Puyo 2026 en curso: prediccion con su historial 2025 para verificar al cierre. |
