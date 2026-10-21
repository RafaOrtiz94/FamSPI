# Guía de uso — Aplicaciones Técnicas

> **Para quién es esta guía:** Técnicos, jefes de servicio técnico y gerencia que consulta el catálogo de aplicaciones técnicas disponibles.

---

## ¿Para qué sirve este submódulo?

Este módulo expone un **catálogo de solo lectura** de aplicaciones de servicio técnico. Permite consultar qué aplicaciones están disponibles para asignación de trabajos, equipos o procedimientos.

Actualmente el módulo está en **estado inicial o de desarrollo limitado**.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso |
|---|---|
| `servicio_tecnico`, `tecnico`, `jefe_servicio_tecnico` | Consultar catálogo |
| `gerencia`, `administrador` | Consultar catálogo |

---

## Pantalla y endpoints

No se ha verificado integración frontend propia ni montaje confirmado en `registerRoutes.js`. El único endpoint documentado es:
- `GET /available` → listado de aplicaciones técnicas disponibles.

---

## Flujo principal — Consultar aplicaciones disponibles

### Paso 1 — Acceder al endpoint

Dependiendo de cómo esté montado, la URL puede variar.

### Paso 2 — Revisar el listado

El sistema devuelve las aplicaciones disponibles para asignación.

---

## Estado actual

> **Importante:** Este módulo puede no estar montado en el router principal del sistema. Si no ves acceso desde el menú, contacta a TI.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Ver aplicaciones técnicas disponibles | Consulta el catálogo (endpoint GET /available) |
| Asignar una aplicación a un trabajo | Gestiona la asignación desde el módulo de Servicio Técnico |
