# Validacion FamSPI 2026

Estado vigente de la validacion documental del sistema FamSPI al `20 de julio de 2026`.

## Objetivo

Esta carpeta ahora se interpreta con una estructura separada por fase para evitar que la validacion general siga usando documentos mezclados o desactualizados.

Los documentos vigentes de uso general son 5, cada uno mapeado a secciones especificas del Apendice 5 (no existe una fase "primeros pasos" en WHO; ese contenido se integro al plan maestro/DQ):

1. [01_primeros_pasos_y_dq.md](./01_primeros_pasos_y_dq.md) → **Plan Maestro y DQ**
2. [02_implementacion_iq.md](./02_implementacion_iq.md) → **IQ**
3. [03_operacion_oq.md](./03_operacion_oq.md) → **OQ**
4. [04_desempeno_pq.md](./04_desempeno_pq.md) → **PQ / UAT**
5. `generar_documentos_validacion_2026.py::build_annexes` → **Anexos retrospectivos**

## Regla de uso (mapeo a WHO TRS 1019 Annex 3, Appendix 5)

- **Plan Maestro y DQ** (`01_primeros_pasos_y_dq.md`): Introduccion y alcance (§1), protocolo y reporte de validacion (§3), gestion de proveedores (§4), fuentes de verdad e inventario funcional, desarrollo del sistema (§8), calificacion de diseno (§7) y analisis de riesgo/brechas de automatizacion (§12.6-12.10).
- **IQ** (`02_implementacion_iq.md`): instalacion, configuracion, despliegue y evidencia tecnica (§9).
- **OQ** (`03_operacion_oq.md`): ejecucion funcional controlada por modulo, flujo y rol (§10), mas SOPs y entrenamiento previos a PQ (§11).
- **PQ / UAT** (`04_desempeno_pq.md`): uso real, aceptacion por usuarios, estabilidad operativa y cierre de liberacion (§12).
- **Anexos retrospectivos**: gestion de proveedores complementaria, control de cambios con ticket TI, operacion y mantenimiento — seguridad, respaldo, migracion de datos, revision periodica (§13) — y retiro del sistema (§14).

## Fuente de verdad usada para esta reorganizacion

- Backend: [backend/src/routes/registerRoutes.js](../../backend/src/routes/registerRoutes.js)
- Frontend: [spi_front/src/routes/AppRoutes.jsx](../../spi_front/src/routes/AppRoutes.jsx)
- Diseno visual vigente: [DESIGN.md](../../DESIGN.md)

## Alcance funcional vigente 2026

El sistema ya no se limita a los modulos historicos de autenticacion, talento humano y comercial. El alcance actual incluye al menos:

- Gobierno, seguridad, autenticacion, usuarios, perfiles y acceso por modulos
- Talento humano, colaboradores, permisos, vacaciones, offboarding, asistencia y reportes
- Comercial, clientes, planificacion, delivery ceilings, opportunities, business case y CRM-FAM
- Servicio tecnico, solicitudes, cronograma, mantenimientos, aplicaciones, disponibilidad, capacitaciones y casos externos
- Compras, private purchases, equipment workspace, inventario, soporte TI, activos TI y entregas a colaboradores
- Finanzas y viaticos
- Calidad
- Documentos, firma, workflows de firma y verificacion publica
- Notificaciones, dashboard, work management, kickoff y portales publicos puntuales

## Estado de la documentacion historica

Los contenidos en `general/`, `general_GEON/`, `areas/`, `URS/`, `FRS/`, `DS/` se mantienen como referencia historica y base de evidencia, pero no deben asumirse como protocolo maestro vigente sin reconciliacion contra los cinco documentos vigentes. La excepcion es `RTM/RTM_sistema_spi.md`, que ya no es historico: se regenera con evidencia real (ver flujo abajo).

El arbol paralelo `validacion_sistema/` (fuera de `docs/validation/`) queda marcado como legado — ver su propio README — y no se usa para generar documentos nuevos.

## Flujo de generacion con evidencia real (WHO TRS 1019 Annex 3, Appendix 5)

Los documentos DQ/IQ/OQ/PQ y anexos ya no se generan solo a partir de prosa estatica. La trazabilidad requisito -> test y la evidencia de ejecucion (OQ/PQ, RTM, matriz de trazabilidad y registro de brechas en los anexos) se generan desde el codigo y desde una corrida real de la suite de tests. Nada de esto se redacta a mano.

Pasos, en orden, desde la raiz del repo:

```bash
# 1. Corre la suite real de Jest y guarda el resultado real (pass/fail, duracion, timestamp)
cd backend && npm run test:validation

# 2. Regenera la trazabilidad real requisito -> test -> commit (usa el resultado del paso 1 solo indirectamente; esto lee el codigo)
cd ../docs/validation && node build_traceability_map.js

# 3. Regenera la seccion 11 (analisis de riesgo y brechas) dentro de 01_primeros_pasos_y_dq.md
node build_gap_analysis.js

# 4. Regenera la RTM real (requisito -> archivo de test o referencia a brecha)
node build_rtm.js

# 5. Genera los .docx (DQ, IQ, OQ, PQ, anexos) cruzando traceability_map.json con evidence/jest-results.json
python generar_documentos_validacion_2026.py
```

Si falta `evidence/jest-results.json` o `traceability_map.json`, el paso 5 falla con un mensaje explicito indicando que corrida falta — no genera evidencia inventada como sustituto.

Los modulos backend sin `__tests__/` (57 de 65 al `20 de julio de 2026`) no bloquean la generacion: quedan documentados como brecha de riesgo declarado (alto/medio-bajo) con evidencia real de mantenimiento (ultimo commit, commits en 12 meses) en la seccion 11 del DQ, la RTM y los anexos, conforme a WHO §12.6-12.10 (validacion retrospectiva de sistemas legacy). Los modulos de riesgo alto sin cobertura (`auth`, `security`, `module-access`, `signature`, `signature-workflows`, `permisos`, `vacaciones`, `finanzas`, `viaticos`, `auditoria`, `documents`) deben priorizarse para cobertura futura.

## Accion recomendada

Cada vez que exista un cambio material de alcance, flujo, roles, tablas, rutas o experiencia operativa:

1. abrir o asociar un ticket real en el sistema de tickets TI (`support-tickets`),
2. actualizar URS/FRS/DS y RTM afectados,
3. ajustar IQ/OQ/PQ del area impactada,
4. revisar los cinco documentos vigentes de esta carpeta,
5. verificar eventos y cierre del ticket TI antes de declarar conformidad.

El control de cambios no debe considerarse cerrado si no existe codigo de ticket TI, estado verificable y evidencia de ciclo en `support_ticket_events`.
