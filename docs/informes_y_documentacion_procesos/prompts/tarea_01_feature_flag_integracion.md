# Tarea 01 — Feature flag integración Odoo (cierre verificable)

---INICIO PROMPT TAREA 01---

## Rol

Desarrollador full stack senior en el repo **FamSPI**. Lee primero `docs/informes_y_documentacion_procesos/prompts/prompt_desarrollador_fullstack_integraciones_erp.md`.

## Requisitos que DEBEN quedar cumplidos al cerrar esta tarea

- **Principio feature flags** del documento `requerimientos_spi_nuevas_funcionalidades.md` (punto 1): integración desactivable sin cambiar comportamiento para usuarios.
- **INT-ODOO-007** — Modo degradado: con integración desactivada o Odoo caído, el núcleo SPI no debe depender de llamadas externas en rutas existentes.

## Tarea concreta

1. Introducir configuración centralizada de integración Odoo (por ejemplo variables de entorno `ODOO_INTEGRATION_ENABLED`, `ODOO_BASE_URL`, etc.) leídas en el **backend** en un solo módulo (p. ej. `config/odooIntegration.js` o equivalente existente).
2. Exportar una función `isOdooIntegrationEnabled()` usada por el código nuevo de integración.
3. Documentar en **un** archivo Markdown bajo `docs/informes_y_documentacion_procesos/` (puede ser `runbook_feature_flag_odoo.md` o sección nueva en README de prompts) el significado de cada variable y el valor por defecto en desarrollo (**off**).
4. **No** modificar la lógica de negocio de endpoints públicos existentes salvo envolver **solo** código nuevo de integración tras el flag.

## No hacer

- No llamar a Odoo desde rutas que hoy no lo hacen.
- No commitear secretos reales.

## Entregables obligatorios

- Código backend con flag funcional.
- Documento `.md` con tabla de variables y comportamiento flag on/off.
- Lista de archivos tocados.

## Checklist de verificación (Definition of Done)

Marca cada ítem solo si es **cierto** tras revisión:

- [ ] Con `ODOO_INTEGRATION_ENABLED=false` (o equivalente), **ningún** test existente del backend falla por ausencia de Odoo (ejecutar la suite o `npm test` / comando que use el proyecto en CI local).
- [ ] No hay `fetch`/`axios`/cliente Odoo ejecutándose en el arranque del servidor cuando el flag está off.
- [ ] Existe documentación localizada con ruta exacta al archivo `.md` creado o actualizado.
- [ ] En el resumen final de la IA consta la frase: **"REQ cumplidos: principio feature flags + INT-ODOO-007 para rutas existentes."**

---FIN PROMPT TAREA 01---
