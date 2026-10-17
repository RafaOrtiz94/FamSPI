# Motor de predicción de consumibles — planes Senior, Senior Pro y Senior Ultra

> **Para quien ejecute estos planes (persona u otra IA):** léelo completo antes de tocar código, junto con
> `docs/plans/motor-consumibles-por-reglas-plan.md` (plan base y bitácora). Lo de la sección 1 fue verificado
> en el **staging local** el **2026-10-15**; nada de esto está en producción ni tiene commit. Los tres planes
> son **acumulativos**: Senior Pro empieza cuando Senior pasó su puerta, y Senior Ultra cuando Senior Pro pasó la suya.

| | **Senior** | **Senior Pro** | **Senior Ultra** |
|---|---|---|---|
| Objetivo | Usable en producción como **ayuda** a jefe_servicio | **Precisión**: cerrar las causas de error conocidas | **Fuente oficial**: el motor alimenta la oferta |
| Quién lo usa | jefe_servicio en Determinaciones; TI en el laboratorio | + Aplicaciones revisa fichas y casos | + Comercial (lectura) y la oferta |
| Escribe en la oferta | No | No | Sí, por familia y con puerta de control |
| Meta de exactitud (dejando uno fuera) | No empeorar: error total ≤ 90 % (hoy 77–89 %) | Error total ≤ 40 % y ≥ 60 % de productos dentro de ±15 % | ≥ 99,9 % por familia habilitada (meta del plan base) |
| Depende de terceros | No | Aplicaciones y Roche (datos de fichas) | Operaciones (despachos reales) y Aplicaciones |
| Tamaño relativo | Pequeño | Mediano | Grande |

---

## 1. Punto de partida verificado (2026-10-15, staging local)

### 1.1 Cómo calcula hoy

- **Reactivos:** no se predicen. Salen de DET/AÑO/PROCESO del Sheet del BC (`demandSource: "sheet"`). Privado = promedio mensual × 12; público = cantidad del proceso.
- **Calibradores, controles y materiales**, en este orden (`consumableSimulation.service.js#predictFromHistory`):
  1. **Manual del equipo** (`consumableEquipmentManual.js`): lámpara c 503 (750 h o 6 meses), electrodos Na/K/Cl (2 meses o 9000 pruebas), ISE Standard Low/High (1 ampolla por calibración diaria) e ISE Diluent (6 semanas o 450 µL por muestra). Fuente: User Guide cobas pro 4.4 y Method Sheets Roche.
  2. **Escenarios calibrados** (`consumableCalibration.js`, `consumableCalibration.service.js`): por cada BC con cantidades reales se corren 200 000 escenarios y se guardan los 500 más cercanos. La predicción de un BC sortea 20 000 escenarios **solo entre los aceptados de otros BC** y toma la mediana (`calibrated_scenarios`).
  3. Sin calibración: mediana de la simulación (`simulation_p50`); sin simulación: fórmula validada (TABLA BASE BC.xlsx, adaptador cobas Pro).
- **Receta por reactivo** (`consumableDocumentRule.js`): calendario de calibraciones, corridas de control, estabilidad abierta, alícuotas congeladas y agotamiento por volumen, según la ficha oficial.
- **Variables de cada escenario** (`consumableSimulation.js#sampleScenario`): crecimiento, estacionalidad, repeticiones, fallas de control, recalibración, lotes por año, alícuotas, entregas, muestras ISE y fracción planificada por tipo (`planningShare`, que solo se explora al calibrar).
- **Estadísticas del laboratorio** (`labStatistics.service.js`): muestras ISE por año, % de repeticiones y % de controles fuera de rango.
  - Jefe_servicio las llena en Determinaciones; son obligatorias hasta que 3 procesos del mismo equipo tengan el dato.
  - En curso: un ajuste por simulación (`labStatisticsSearch.js`, `labStatisticsFit.service.js`) busca los valores con más coincidencias contra lo real y descarta para siempre los candidatos lejanos.

### 1.2 Qué ve y hace jefe_servicio (Determinaciones)

- **Columna "Predicción del motor":** acepta la predicción tal cual, o la cambia con un motivo de mínimo 5 caracteres.
- **Diferencia con el Sheet:** si PRODUCTO A ENTREGAR difiere de la predicción, debe justificarla. Elige "Cálculo" o "Criterio" y explica (mínimo 20 caracteres).
- **Bloqueo:** sin esa justificación no puede cerrar controles, calibradores ni materiales. La UI deshabilita el botón y el backend responde `409 SHEET_DIFFERENCE_UNJUSTIFIED`.
- **Aprendizaje:** cada validación y justificación queda en `bc_consumable_rule_validations` y entra a la calibración como dato real.

### 1.3 Exactitud medida (dejando uno fuera, contra PRODUCTO A ENTREGAR)

| | Regla anterior | Motor actual |
|---|---|---|
| Controles | 199 % | 104–112 % |
| Calibradores | 179 % | 77–82 % |
| Materiales | 101 % | 69–86 % |
| **Total** | **125 %** | **77–89 %** |

- Error = Σ|predicción − real| / Σ real.
- El rango es la variación entre corridas.
- Más escenarios (50 000 contra 200 000) o un descarte más estricto (0,25 % a 5 %) **no cambian** el resultado.

### 1.4 Causas de error que siguen abiertas (verificadas)

| # | Causa | Ejemplo real |
|---|---|---|
| C1 | **Solo 5 BC con cantidades reales.** Otros 6 tienen "1" de relleno en PRODUCTO A ENTREGAR (la mitad o más de sus productos) y se descartan | Histolab, Munoz, San Juan ×2, Dr Boris Cabrera, Prov. Luis G. |
| C2 | Fichas Elecsys **sin envases por presentación**: se predicen envases contra presentaciones reales | PreciControl Universal 60 contra 8; Multimarker 59 contra 3 |
| C3 | **Materiales por estabilidad** muy por encima de lo planificado | SCCS 258 contra 12; ECO-D 65 contra 24; A1CD 65 contra 12 |
| C4 | **Patrón de planificación de controles** distinto de la ficha | PreciControl Growth 150 contra 3 (Movilab) |
| C5 | **Equivalencias de código**: el producto del Sheet y el de la ficha tienen códigos distintos | HbA1c, AFP, Progesterona, PSA |
| C6 | Datos **ISE sin publicar**: el fabricante no da consumo por muestra ni intervalo de cambio | Internal Standard y Reference Electrolyte (consumo); electrodo de referencia (intervalo) |
| C7 | Fórmula que **sobreestima** | HBQ Sample Set, SCCS |

### 1.5 Pendiente de producción

- **Migraciones solo locales:** `325_consumable_specs_sample_volume`, `326_bc_consumable_rule_validations`, `327_bc_consumable_simulations`, `328_bc_lab_statistics`, `329_consumable_specs_frozen_stability`, `330_bc_scenario_calibrations` y `331_bc_lab_statistics_simulation_fit`.
- **Código:** backend y frontend sin commit.
- **Job:** `businessCaseConsumableSimulationScheduler.js` (también calibra) sin activar en producción.

---

## 2. Decisiones que el usuario debe tomar (no suponer)

| # | Decisión | Bloquea |
|---|---|---|
| D4 | El plan base (regla 2) prohíbe usar `planned_qty` como verdad; en esta etapa el usuario pidió calibrar y medir contra PRODUCTO A ENTREGAR. **¿Se reemplaza la regla 2** por "PRODUCTO A ENTREGAR justificado por jefe_servicio es verdad; sin justificar es solo referencia"? | Senior S1, todo Senior Pro |
| D5 | **Tolerancia** para exigir justificación: hoy cualquier diferencia, aunque sea de 1 unidad, la exige (en Latacunga, 106 de 107 productos). ¿±1 unidad, ±10 % o cero? | Senior S3 |
| D6 | **Qué hacer con los 6 BC con "1" de relleno**: corregirlos en el Sheet o dejarlos fuera | Senior Pro P1 |
| D7 | **Quién en Aplicaciones** revisa fichas y casos, y cuántos BC por familia exige la puerta de Senior Ultra (equivale a D1/D3 del plan base) | Senior Pro P2–P4, Senior Ultra |
| D8 | ¿El ajuste por simulación de las estadísticas del laboratorio **cuenta como dato llenado** (quita la obligación) o solo como sugerencia que jefe_servicio confirma? | Senior S2 |

---

## 3. Plan Senior — usable en producción como ayuda

**Objetivo:** que jefe_servicio use la predicción en producción para decidir PRODUCTO A ENTREGAR, con justificación de diferencias, sin tocar la oferta.

- [ ] **S1 — Congelar y revisar lo hecho.**
  - Pasar la suite completa: `npm test` en backend y `npm test` en `spi_front`.
  - Correr el lint de cada archivo tocado.
  - Revisar el diff de los archivos del motor por separado del resto de cambios sin commit (CRM y otros, ver relevo del plan base).
  - Actualizar `backend/src/modules/business-case/CONTEXT.md` §12 con lo de la sección 1.
- [ ] **S2 — Cerrar el ajuste de estadísticas por simulación.**
  - Terminar la medición en Latacunga.
  - Aplicar la decisión D8.
  - Exponer `POST /business-case/:id/determinations/lab-statistics/fit` (solo jefe_servicio y TI) y correrlo también desde el job para los BC con datos reales.
  - Pruebas en `__tests__/labStatisticsSearch.test.js` (ya existen) y una de servicio.
- [ ] **S3 — Tolerancia de justificación (D5).** Aplicarla en `determinationPredictions.service.js` (`needsJustification`) y reflejarla en el mensaje de la UI.
- [ ] **S4 — Aviso de Sheet con relleno.**
  - Si la mitad o más de PRODUCTO A ENTREGAR vale 1, mostrar un aviso en Determinaciones ("este Sheet no sirve de referencia hasta corregirlo").
  - El criterio ya existe en `consumableCalibration.service.js#REAL_SQL`.
- [ ] **S5 — Despliegue controlado a producción** (solo con instrucción explícita del usuario):
  1. Respaldo de Neon y migraciones 325→331 en orden, comprobando columnas con `information_schema` antes y después.
  2. Backend (`scripts/deploy_backend_cloudrun.ps1`) y frontend (`spi_front/clean_deploy.ps1`).
  3. Job de simulación y calibración solo en la instancia de jobs (`ENABLE_JOBS=true`, `JOBS_RUNNER_INSTANCE=true`).
  4. Ejecutar una vez `POST /internal/jobs/business-case/consumable-simulations` y revisar los logs `[BC][CALIBRATION]` y `[BC][SIMULATION]`.
- [ ] **S6 — Medición en producción.**
  - Script de medición dejando uno fuera, en `backend/scripts/` y no en el scratchpad.
  - Correrlo en producción y registrar el resultado en la bitácora del plan base.

**Puerta de salida de Senior:**
- Error total ≤ 90 % dejando uno fuera en producción.
- Sin errores del job durante 1 semana.
- Jefe_servicio cerró al menos 3 BC usando la justificación.
- Aprobación del usuario.

**No incluye:** escribir en la oferta, abrir a Comercial, corregir fichas.

---

## 4. Plan Senior Pro — precisión

**Objetivo:** atacar las causas C1–C7 con datos y reglas, y medir cada cambio con la misma validación cruzada.

- [ ] **P1 — Más casos reales (C1).**
  - Aplicar D6: corregir o descartar los 6 Sheets con relleno.
  - Cada BC nuevo que jefe_servicio cierre con justificaciones se vuelve referencia sola, porque la calibración ya la toma.
  - Meta mínima: 10 BC reales por equipo para las familias que se quieran habilitar en Ultra.
- [ ] **P2 — Envases por presentación (C2).**
  - Completar `containers_per_pack` en las fichas Elecsys con más error.
  - El ranking por impacto ya lo da `buildDataGaps` en el laboratorio.
  - Generar el SQL con un script en `backend/scripts/consumable-specs/`, como `frozenStability.js`.
  - Requiere revisión de Aplicaciones (D7).
- [ ] **P3 — Equivalencias de código (C5).** Tabla de equivalencias Sheet ↔ ficha con su origen y quién la aprobó, aplicada en `consumableRules.service.js#consumptionCode`, empezando por HbA1c, AFP, Progesterona y PSA.
- [ ] **P4 — Reglas de planificación aprendidas por familia (C3, C4, C7).**
  - Hoy `planningShare` es uno solo por tipo de producto. Pasarlo a familia (control de química, inmuno y material de lavado), solo cuando existan al menos 5 BC reales con esa familia.
  - Si Aplicaciones confirma un patrón explícito (por ejemplo, "1 control por mes por nivel"), escribirlo como regla con fuente, no aprenderlo.
- [ ] **P5 — ISE completo (C6).**
  - Pedir a Roche o Aplicaciones el consumo por muestra de Internal Standard y Reference Electrolyte, y el intervalo del electrodo de referencia.
  - Agregarlo a `consumableEquipmentManual.js` con su fuente. Sin fuente, sigue como `no_rule` con motivo.
- [ ] **P6 — Medición como prueba automática.**
  - La validación cruzada (script de S6) corre en CI o antes de cada despliegue del motor.
  - Falla si el error total empeora más de 5 puntos contra la última medición registrada.
- [ ] **P7 — Tablero de calidad** (U8 del plan base): error y coincidencias por familia, producto y BC; productos sin ficha; Sheets con relleno; diferencias justificadas y sus criterios más frecuentes. Solo TI.
- [ ] **P8 — Criterios de jefe_servicio como variables.**
  - Revisar los textos de "Criterio" guardados y convertir los repetidos en variables explícitas del escenario, con nombre, rango y origen visibles. Por ejemplo, "stock existente del laboratorio".

**Puerta de salida de Senior Pro:**
- Error total ≤ 40 % y ≥ 60 % de productos dentro de ±15 %, dejando uno fuera.
- Medido con al menos 10 BC reales por familia habilitada.
- Aplicaciones revisó las fichas de los productos con más impacto.
- Aprobación del usuario.

---

## 5. Plan Senior Ultra — el motor como fuente de la oferta

**Objetivo:** que la cantidad del motor llegue a la oferta y a la logística en las familias que lo justifican, con un ciclo cerrado contra lo real.

- [ ] **U1 — Ciclo con la realidad (U5 del plan base).**
  - Capturar lo realmente despachado y consumido por BC; hoy `ops_dispatched_qty` está en cero.
  - Acordar con Operaciones cómo se registra.
  - Lo despachado pasa a ser la verdad de la calibración, por encima de PRODUCTO A ENTREGAR.
- [ ] **U2 — Conexión a la oferta con puerta (U6 del plan base).**
  - Por familia: solo con ≥ 99,9 % contra casos validados (o la meta que fije D7), aprobación de Aplicaciones y registro de quién aprobó.
  - Es la única tarea que activa `offerWriteEnabled`.
  - Jefe_servicio sigue pudiendo cambiar con justificación.
- [ ] **U3 — Entregas en el tiempo.**
  - Usar el perfil de entregas por trimestre que ya calcula la simulación (`deliveriesByQuarter`) para proponer el calendario de entregas parciales del contrato.
  - Ejemplo: Latacunga tiene 4 entregas parciales.
- [ ] **U4 — Recalibración y deriva.**
  - Recalibrar automáticamente cuando cambian los datos reales (ya lo hace la huella).
  - Alertar cuando la exactitud de una familia cae entre mediciones.
  - Versionar fichas y reglas (U4 del plan base).
- [ ] **U5 — Más equipos y familias.** Adaptadores y reglas de manual para los equipos fuera de cobas Pro/Pure/c111/e411, cada uno con su fuente oficial descargada (API eLabDoc).
- [ ] **U6 — Apertura a más roles** (U9 del plan base): Comercial con solo lectura de la predicción y su explicación.

**Puerta de salida de Senior Ultra (por familia):**
- Exactitud ≥ meta D7 contra lo despachado.
- 3 meses sin deriva.
- Aprobación de Aplicaciones y del usuario.

---

## 6. Reglas para los tres planes

1. Todo se prueba primero en el staging local (`scripts/staging_local.ps1`). A producción solo con instrucción explícita del usuario.
2. Las contraseñas salen de Secret Manager (`DB_PASSWORD`, proyecto `famspi-sbox`); nunca de un `.env` local ni impresas.
3. Sin commits salvo pedido del usuario.
4. Ninguna cifra de fabricante sin fuente. Lo que no se sabe queda como `no_rule` con motivo.
5. Toda mejora de exactitud se reporta **dejando uno fuera**: la predicción de un BC nunca usa sus propios datos reales.
6. Al terminar cada tarea: marcar la casilla y escribir la entrada en la bitácora de `motor-consumibles-por-reglas-plan.md` (qué se hizo, qué se midió, qué no se verificó).
