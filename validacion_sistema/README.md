# VALIDACION DEL SISTEMA

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
