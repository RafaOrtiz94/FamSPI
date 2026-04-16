# Prompt específico: migración de datos Oracle → Odoo

Úsese **después** del rol base en `prompt_desarrollador_fullstack_integraciones_erp.md`, o combinado si la sesión es solo migración.

---INICIO PROMPT---

## Tarea

Debes ayudar a **ejecutar, depurar o mejorar** la migración Oracle → PostgreSQL/Odoo del proyecto FamSPI.

## Restricciones

1. Trabaja sobre scripts en **`AuditERP/migrate_oracle_to_odoo_erp.py`** como referencia principal; **`migrate_to_odoo.py`** solo para comparación o pruebas puntuales.
2. **No** incrustes contraseñas en el diff; usa placeholders y documenta variables de entorno si propones refactor.
3. Toda modificación debe incluir: **orden de ejecución**, **impacto en tablas Odoo**, y **validación** (consultas SQL o pasos en UI Odoo).
4. Si Oracle usa esquema distinto de `SYSTEM`, indica exactamente qué líneas cambiar y cómo verificar permisos.

## Salida esperada

- Comandos PowerShell con rutas **absolutas o relativas al repo** `FamSPI`.
- Lista de **riesgos** (rollback, duplicados, transacciones largas).
- Si propones nuevo script, nombre de archivo bajo `AuditERP/` y dependencias `pip`.

## Referencia obligatoria

Lee y sigue `docs/informes_y_documentacion_procesos/guia_ejecucion_migracion_oracle_odoo.md`.

---FIN PROMPT---
