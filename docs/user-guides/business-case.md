# Guía de uso — Business Case (Caso de Negocio)

> **Para quién es esta guía:** Comercial, asesor comercial, analista comercial, ACP comercial, backoffice, jefes de comercial y de operaciones, técnicos, gerencia y gerencia general que evalúa propuestas económicas y operacionales de instalación de equipos.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el **caso de negocio (Business Case)** de cada propuesta comercial que evalúa la viabilidad de instalar un equipo en un cliente. Centraliza todo lo necesario para tomar una decisión informada:

- Selección del equipo del catálogo.
- Determinaciones (pruebas de laboratorio que el equipo deberá realizar).
- Cálculo automático de ROI (retorno de inversión).
- Datos operacionales (entorno de laboratorio, integración con LIS, requerimientos).
- Inversiones y consumos asociados.
- Decisión de viabilidad por parte de la gerencia.
- Exportación a PDF y Excel, y generación de hojas en Google Sheets.
- Observabilidad y métricas de uso.

El objetivo es evitar que se envíen propuestas sin análisis previo y asegurar que cada caso cuente con la información económica y técnica requerida antes de pasar a cierre comercial.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso principal |
|---|---|
| `comercial`, `asesor_comercial`, `analista_comercial` | Crear y editar BC |
| `acp_comercial`, `backoffice`, `backoffice_comercial` | Editar y apoyar |
| `jefe_comercial`, `jefe_de_comercial`, `jefe_operaciones`, `jefe_tecnico` | Visión y edición |
| `gerencia`, `gerencia_general` | Acceso completo + decisión de viabilidad |
| `admin` | Acceso para gestión |

---

## Pantalla principal

La pantalla principal del módulo es el **Workspace del Business Case**. Se divide en secciones ordenadas (según el perfil del usuario):

| Sección | Qué contiene |
|---|---|
| **Datos Generales** | Información base del caso: cliente, responsable, fechas. |
| **Entorno Laboratorio** | Características del laboratorio del cliente: espacio, condiciones, etc. |
| **Condiciones del BC** | Requerimientos específicos del caso. |
| **Equipamiento** | Selección de equipo del catálogo, capacidades y detalles. |
| **Integración LIS** | Configuración de conexión con el sistema de información del laboratorio (LIS). |
| **Determinaciones** | Pruebas de laboratorio asociadas al equipo, validadas por compatibilidad y capacidad. |
| **Inversiones** | Costos estimados de adquisición, instalación y puesta en marcha. |
| **Valores Operativos** | Costos operativos mensuales/anuales. |
| **Valores Financieros** | Métricas financieras: ROI, payback, márgenes. |
| **Sincronización** | Estado de sincronización con sistemas externos (consumibles, etc.). |
| **Cantidades Máximas** | Límites operativos del equipo. |
| **Factibilidad** | Registro de la decisión final sobre la viabilidad del proyecto. |

---

## Flujo principal — Crear un Business Case

### Paso 1 — Acceder al workspace

Ve a **"Business Case"** desde el área comercial. Si es la primera vez, es posible que debas seleccionar un cliente o una oportunidad asociada.

### Paso 2 — Completar "Datos Generales"

Ingresa la información base:
- Nombre o código del caso.
- Cliente.
- Fecha de creación.
- Responsable comercial.

### Paso 3 — Definir "Entorno Laboratorio"

Describe el entorno donde se instalará el equipo:
- Tipo de laboratorio.
- Espacio físico disponible.
- Condiciones ambientales.

### Paso 4 — Configurar "Condiciones del BC"

Registra requerimientos específicos del cliente que afectan la viabilidad.

### Paso 5 — Seleccionar el "Equipamiento"

Elige el equipo del catálogo. El sistema valida:
- Que el equipo exista en el catálogo.
- Que la capacidad del equipo alcance para las determinaciones seleccionadas.

### Paso 6 — Agregar "Determinaciones"

Selecciona las pruebas (determinaciones) que deberá realizar el equipo. Cada determinación se valida contra el equipo elegido para confirmar compatibilidad.

### Paso 7 — Revisar "Inversiones" y "Valores Operativos / Financieros"

El sistema calcula automáticamente:
- Costo total de inversión.
- Costos operativos.
- ROI (retorno de inversión).
- Otras métricas financieras.

Puedes ajustar estos valores manualmente. El sistema recalcula al guardar.

### Paso 8 — Registrar una "Decisión de Viabilidad"

Las aprobaciones comerciales (`acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`) pueden registrar la decisión:
- ¿El proyecto es viable?
- ¿Requiere ajustes?
- Observaciones.

---

## Flujo principal — Exportar y compartir

### Paso 1 — Exportar a PDF o Excel

Una vez completado el caso, usa las opciones de exportación:
- **PDF**: presentación ejecutiva del caso.
- **Excel**: hoja de cálculo detallada.

### Paso 2 — Generar hoja en Google Sheets

El sistema puede generar una hoja automáticamente en Google Sheets para colaboración o revisión.

> Algunas hojas se generan en segundo plano. Puedes consultar el estado del job de generación.

---

## Flujo principal — Reabrir una sección cerrada

### Paso 1 — Solicitar reapertura

Si una sección ya estaba confirmada pero necesita cambios, el sistema permite solicitar la reapertura.

### Paso 2 — Justificar el cambio

Agrega la razón por la cual se requiere modificar la sección.

### Paso 3 — Confirmar

El responsable de la sección o un rol autorizado aprueba la reapertura. El caso vuelve a edición solo en las secciones permitidas.

---

## Roles — Secciones visibles

El sistema controla qué secciones ve cada rol. Por ejemplo:
- Un `comercial` puede ver las secciones operativas y económicas.
- Un `analista` puede ver determinaciones y equipamiento.
- Un `gerente` ve todo, incluida la factibilidad.
- Un técnico puede ver el entorno de laboratorio y el equipamiento.

> No todas las secciones están visibles para todos los roles. El menú se adapta automáticamente.

---

## Flujo principal — Cerrar o archivar un Business Case

### Paso 1 — Verificar que todas las secciones estén completas

Asegúrate de que:
- Equipo y determinaciones estén definidos.
- Inversiones y valores financieros estén cargados.
- La decisión de viabilidad esté registrada.

### Paso 2 — Registrar el cierre

Cambia el estado del caso a cerrado si corresponde, o déjalo en borrador hasta tener aprobación final.

---

## Preguntas frecuentes

**[El sistema me advierte que una determinación no es compatible con el equipo]**

Significa que el equipo seleccionado no puede realizar esa determinación (por capacidad, método o tipo). Cambia el equipo o elimina la determinación incompatible.

**[No veo la sección "Inversiones"]**

Algunas secciones solo están visibles para ciertos roles. Si necesitas ver inversiones, verifica que tu rol esté en la lista autorizada.

**[El cálculo de ROI no se actualiza]**

Asegúrate de guardar la sección luego de modificar valores. Si el problema persiste, usa el botón de **recalcular** o solicita apoyo a TI.

**[Puedo eliminar un Business Case ya aprobado]**

Solo roles con permiso (`gerencia` o `admin`) pueden eliminar BC. Un comercial no podrá eliminar casos ya aprobados o en factibilidad.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Iniciar una nueva propuesta | Ve a "Business Case" → completa Datos Generales |
| Definir qué pruebas hará el equipo | Ve a "Determinaciones" → agrega pruebas compatibles |
| Ver la viabilidad económica | Ve a "Valores Financieros" → revisa ROI |
| Tomar una decisión de viabilidad | Ve a "Factibilidad" → registra la decisión (gerencia/ACP) |
| Presentar la propuesta en PDF | Ve a "Exportar" → PDF o Excel |
| Generar hoja colaborativa | Usa la opción de Google Sheets |
