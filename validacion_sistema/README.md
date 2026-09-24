# VALIDACION DEL SISTEMA (LEGADO)

> **Este arbol quedo marcado como legado.** La generacion de documentos de validacion (URS/FRS/DS/RTM, DQ/IQ/OQ/PQ) vigente y con evidencia real esta en [`docs/validation/`](../docs/validation/README.md), no aqui. `URS/`, `FRS/` y `DDS/` en esta carpeta no se regeneran ni se usan como fuente para nueva documentacion — quedan solo como archivo historico. Los `informes/*.md` de incidentes/ajustes conservan valor como bitacora de cambios y se mantienen sin modificar.

Base documental para revision, trazabilidad y validacion del SPI.

## Estructura
- `URS`: requerimientos del usuario y alcance por modulo o area.
- `FRS`: especificacion funcional del sistema.
- `DDS`: diseno tecnico detallado.
- `informes`: revisiones, hallazgos, validaciones, incidentes y cierres.

## Documentos clave
- Guia operativa: `validacion_sistema/GUIA_GESTION_CAMBIOS_Y_VALIDACION.md`
- Verificacion general actual: `validacion_sistema/verificacion_modulos_actual.md`
- Mapa de modulos: `validacion_sistema/modulos_detectados.md`
- Revision integral y roadmap: `validacion_sistema/informes/informe_revision_integral_modulos_y_plan_mejoras.md`
- Paquete de permisos inicial: `validacion_sistema/informes/paso_02_paquete_accesos_criticos.md`
- Ejecucion del paquete inicial: `validacion_sistema/informes/informe_ejecucion_paso_03_accesos_criticos.md`
- Ajuste de cancelacion permisos/vacaciones: `validacion_sistema/informes/informe_ajuste_cancelacion_permisos_vacaciones_2026-03-10.md`
- Ajuste del widget de aprobacion permisos/vacaciones: `validacion_sistema/informes/informe_ajuste_widget_aprobacion_permisos_vacaciones_2026-03-10.md`
- Ajuste de multiples matriculas activas: `validacion_sistema/informes/informe_ajuste_multiples_matriculas_activas_2026-03-10.md`
- Ajuste de cancelacion documental y QR legal: `validacion_sistema/informes/informe_ajuste_cancelacion_documental_qr_2026-03-10.md`
- Ajuste de validacion de matriculas pendientes: `validacion_sistema/informes/informe_ajuste_validacion_matriculas_pendientes_2026-03-10.md`
- Ajuste de loaders en aprobaciones y rechazos: `validacion_sistema/informes/informe_ajuste_loaders_aprobaciones_2026-03-10.md`
- Ajuste de refresco automatico por cambio de estado: `validacion_sistema/informes/informe_ajuste_refresco_automatico_estados_2026-03-10.md`

## Regla de trabajo
Antes de implementar un cambio:
1. revisar el estado actual
2. documentar el caso
3. actualizar `URS/FRS/DDS` si cambia alcance o diseno
4. implementar
5. validar y registrar evidencia en `informes`

## Caso documentado reciente
- `validacion_sistema/informes/informe_modulo_respaldo_bd.md`
- `validacion_sistema/informes/informe_revision_integral_modulos_y_plan_mejoras.md`
- `validacion_sistema/informes/paso_02_paquete_accesos_criticos.md`
- `validacion_sistema/informes/informe_ejecucion_paso_03_accesos_criticos.md`
- `validacion_sistema/informes/informe_ajuste_cancelacion_permisos_vacaciones_2026-03-10.md`
- `validacion_sistema/informes/informe_ajuste_widget_aprobacion_permisos_vacaciones_2026-03-10.md`
- `validacion_sistema/informes/informe_ajuste_multiples_matriculas_activas_2026-03-10.md`
- `validacion_sistema/informes/informe_ajuste_cancelacion_documental_qr_2026-03-10.md`
- `validacion_sistema/informes/informe_ajuste_validacion_matriculas_pendientes_2026-03-10.md`
- `validacion_sistema/informes/informe_ajuste_loaders_aprobaciones_2026-03-10.md`
- `validacion_sistema/informes/informe_ajuste_refresco_automatico_estados_2026-03-10.md`
