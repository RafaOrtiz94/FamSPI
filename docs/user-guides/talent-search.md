# Guía de uso — Búsqueda de Talento (Talent Search)

> **Para quién es esta guía:** Talento Humano, jefes de Talento Humano, gerencia y equipos de selección que gestiona procesos de búsqueda y captación de candidatos.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona la **búsqueda activa de talento** (talent search / hunting). A diferencia del pipeline de selección que trabaja sobre postulantes existentes, este módulo está orientado a la captación proactiva:
- Definir búsquedas de perfiles específicos.
- Registrar canales de reclutamiento.
- Hacer seguimiento de campañas de captación.
- Gestionar pipeline de búsqueda (no solo evaluación sino también acercamiento).

Se integra con:
- `applicants`: postulantes importados desde ATS externos pueden ingresar al funnel.
- `hiring-pipeline`: una vez captado el candidato, se activa el proceso de selección formal.

---

## Estado actual

No se confirmó un CONTEXT.md propio para este módulo en la lectura inicial. La existencia de `backend/src/modules/talent-search/` indica que la lógica existe, pero se recomienda revisar el código backend directo para obtener:
- Rutas exactas.
- Permisos por rol.
- Campos y flujos soportados.

Si necesitas operar urgentemente:
- Abre los archivos dentro de `backend/src/modules/talent-search/`.
- Revisa `registerRoutes.js` para confirmar el prefijo.
- Verifica las vistas frontend en `spi_front/src/modules/talent-search/`.

---

## Pantalla principal

No confirmada. Es probable que se acceda desde el área de Talento Humano o desde un panel de reclutamiento.

---

## Flujos esperados

1. Crear búsqueda de talento (perfil, skills, seniority).
2. Registrar fuentes/canales de reclutamiento.
3. Hacer seguimiento de avance por búsqueda.
4. Convertir candidatos interesados en postulantes formales.
5. Pasar candidatos a `hiring-pipeline`.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una búsqueda de talento | Ingresa al área de Reclutamiento / Talent Search |
| Captar candidatos | Registra postulantes y canales |
| Pasar a selección formal | Vincula con `personnel-requests` / `hiring-pipeline` |
