# CONTEXT.md — contracts / talent-search / checklist / comercial

## Módulos sin implementación backend verificada

Los siguientes directorios de módulo están vacíos o contienen solo componentes frontend:

---

## contracts

- **Directorio backend**: `backend/src/modules/contracts/` → **vacío**
- **Frontend**: No verificado
- **Estado**: Sin implementación backend. Posiblemente planificado.

---

## talent-search

- **Directorio backend**: `backend/src/modules/talent-search/` → **vacío**
- **Frontend**: No verificado
- **Estado**: Sin implementación backend. Posiblemente planificado para búsqueda de talentos.

---

## checklist

- **Directorio backend**: `backend/src/modules/checklist/` → **vacío**
- **Frontend**: No verificado
- **Estado**: Sin implementación backend. Funcionalidad de checklist implementada inline en otros módulos (business-case, requests, mantenimientos).

---

## comercial (frontend only)

- **Directorio backend**: No existe como módulo backend independiente
- **Directorio frontend**: `spi_front/src/modules/comercial/` → contiene `components/` y `pages/`
- **Backend**: Funcionalidad cubierta por `clients`, `requests`, `schedules`, `business-case`, `dashboard`
- **Estado**: Solo frontend, sin módulo backend propio.

---

## logistica (frontend only)

- **Directorio backend**: No existe como módulo backend independiente
- **Frontend**: `/dashboard/logistica/` → rutas de logística en AppRoutes.jsx
- **Backend**: Funcionalidad cubierta por `delivery-requests`, `delivery-ceilings`, `equipment-purchases`, `private-purchases`
- **Estado**: Solo frontend, sin módulo backend propio.

---

## Notas
- Los módulos vacíos no deben importarse ni referenciarse hasta tener implementación real
- `contracts` puede estar siendo planificado para gestión de contratos laborales (actualmente en `collaborators`)
- `talent-search` puede ser una extensión futura de `applicants` + `personnel-requests`
