# FASE 1 - ANÁLISIS CORREGIDO ACP_COMERCIAL DASHBOARD UNIFICACIÓN

## OBJETIVO
Analizar la unificación de UI para el rol ACP_COMERCIAL en dashboard:
- Unificar "Compras de Equipos" (ACPEquipmentPurchasesPage)
- Unificar "Workspace de Compras" (PurchasesWorkspace)
- Mantener especificaciones por rol

## ESPECIFICACIONES POR ROL
- **COMERCIAL**: Ver y responder flujos compras públicas/privadas
- **ACP_COMERCIAL**: Realiza proceso compras públicas (sin visualización BACKOFFICE)
- **BACKOFFICE_COMERCIAL**: Maneja compras privadas (ACP_COMERCIAL forma parte del flujo)

## ESTADO ACTUAL - ANÁLISIS COMPLETO Y CORREGIDO

### 1. ESTRUCTURA DE DASHBOARD ACP_COMERCIAL
**Archivo**: `ACPComercialView.jsx`
- Dashboard simple con 4 cards de navegación:
  - Clientes → `/dashboard/comercial/clientes`
  - **Procesos de compra** → `/dashboard/comercial/equipment-purchases` ⚠️ **PROBLEMA**
  - Solicitudes → `/dashboard/comercial/solicitudes`
  - Prospectos → `/dashboard/comercial/prospectos`

### 2. COMPONENTES A UNIFICAR IDENTIFICADOS

#### "Compras de Equipos" - ACPEquipmentPurchasesPage
**Archivo**: `spi_front/src/modules/comercial/pages/ACPEquipmentPurchases.jsx`
Contiene las 3 secciones requeridas:
- **Vista General (overview)**: KPIs, métricas, actividad reciente
- **Solicitudes (requests)**: Lista usando `EquipmentPurchaseWidget`
- **Análisis (analytics)**: Métricas detalladas
**Ruta**: `/dashboard/comercial/acp-compras`

#### "Workspace de Compras" - PurchasesWorkspace
**Archivo**: `spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx`
- Componente con tabs para "Compras Públicas" y "Compras Privadas"
- Tab "Compras Públicas": Usa `PublicPurchasesTab` → muestra `ACPEquipmentPurchasesPage` para ACP
- Tab "Compras Privadas": Usa `PrivatePurchasesTab` → compras privadas
- **Ruta**: No identificado aún en AppRoutes.jsx

### 3. RUTAS IDENTIFICADAS
- `/dashboard/comercial/equipment-purchases` → `EquipmentPurchasesPage` (general)
- `/dashboard/comercial/acp-compras` → `ACPEquipmentPurchasesPage` (solo ACP_COMERCIAL)
- `/dashboard/purchases/workspace` → `PurchasesWorkspace` (workspace con tabs públicas/privadas)

### 4. API ENDPOINTS
- `/api/v1/equipment-purchases/` - Compras públicas ACP
- `/api/v1/private-purchases/` - Compras privadas

## ROOT CAUSE IDENTIFICADO Y CORREGIDO ✅
1. **Mal entendimiento inicial**: ❌ Confundí "workspace de compras" con BusinessCaseWorkspace (flujo business case)
2. **Separación real identificada**: ✅ ACP_COMERCIAL accede a DOS componentes separados:
   - `ACPEquipmentPurchasesPage` (ruta específica ACP con las 3 secciones)
   - `PurchasesWorkspace` (workspace con tabs públicas/privadas)
3. **Navegación inconsistente**: ✅ Dashboard apuntaba a ruta general en lugar de ruta específica ACP
4. **Duplicación confirmada**: ✅ PurchasesWorkspace incluye funcionalidad de ACPEquipmentPurchasesPage

## PLAN DE SOLUCIÓN PROPUESTO - DEFINITIVO
1. **Fix inmediato aplicado**: ✅ Cambiar navegación dashboard a ruta ACP específica
2. **Unificación completa**: Crear componente unificado que integre las 3 secciones de ACPEquipmentPurchasesPage EN PurchasesWorkspace
3. **Eliminar duplicación**: Remover ruta `/dashboard/comercial/acp-compras` redundante
4. **Mantener especificaciones**: BACKOFFICE solo ve tab de compras privadas

## FIX SEGURO INMEDIATO APLICADO ✅
**Problema**: Dashboard ACP_COMERCIAL navegaba a `/dashboard/comercial/equipment-purchases` (ruta general)
**Solución**: Cambiar a `/dashboard/comercial/acp-compras` (ruta específica ACP)
**Estado**: ✅ Aplicado, build exitoso, servidor funcionando

## RESULTADO FASE 1: ANÁLISIS COMPLETADO ✅
**ACP_COMERCIAL ahora accede directamente a su vista específica con las 3 secciones requeridas**

---

## 🚀 FASE 2 - UNIFICACIÓN VISUAL EMPRESARIAL

### OBJETIVO FASE 2
Unificar ACPEquipmentPurchasesPage dentro de PurchasesWorkspace con diseño empresarial moderno y atractivo.

### PLAN DE UNIFICACIÓN VISUAL
1. **Integrar secciones ACP en tab "Compras Públicas"**: Las 3 secciones (Vista General, Solicitudes, Análisis) se mostrarán como sub-tabs dentro del tab público
2. **Diseño empresarial moderno**: Layout limpio, gradientes corporativos, cards elegantes, iconografía consistente
3. **UX mejorada**: Navegación intuitiva, estados visuales claros, responsive design
4. **Mantener especificaciones**: BACKOFFICE solo ve tab privado, ACP_COMERCIAL ve ambas tabs

### COMPONENTES A MODIFICAR
- `PurchasesWorkspace.jsx` - Sistema de tabs principal
- `PublicPurchasesTab.jsx` - Nuevo diseño con sub-tabs para las 3 secciones ACP
- `ACPComercialView.jsx` - Actualizar navegación para apuntar al workspace unificado

### DISEÑO PROPUESTO
```
┌─ WORKSPACE DE COMPRAS ──────────────────────────┐
│ ┌─ TABS PRINCIPALES ──────────────────────────┐ │
│ │ 🏢 Compras Públicas │ 🏭 Compras Privadas   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ SUB-TABS ACP (solo en Públicas) ──────────┐ │
│ │ 📊 Vista General │ 📋 Solicitudes │ 📈 Análisis │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Contenido de la sección seleccionada]          │
└─────────────────────────────────────────────────┘
```
