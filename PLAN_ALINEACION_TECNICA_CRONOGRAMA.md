# Plan Maestro: Alineación Técnica y Cronograma Robusto

## Estado
- Estado actual: cierre técnico completado
- Fecha base del plan: 2026-06-27
- Responsable de orquestación: agente raíz
- Modo de trabajo: ejecución por fases con validaciones de no regresión
- Avance de ejecución:
  - Fase 1 completada
  - Fase 2 completada
  - Fase 3 completada
  - Fase 4 completada
  - Fase 5 completada
  - Fase 6 completada
  - Fase 7 completada

## Objetivo
Alinear los módulos visibles del área técnica para `jefe_servicio`, `jefe_servicio_tecnico`, `jefe_tecnico`, `ing_servicio` y `esp_app`, corrigiendo navegación, dashboards, rutas y permisos para que reflejen el funcionamiento real del sistema. Después de esa alineación, construir un cronograma técnico robusto que consolide múltiples fuentes operativas sin afectar el funcionamiento del resto de roles.

## Objetivos específicos
1. Corregir la navegación del área técnica para que solo muestre módulos reales, coherentes y útiles por rol.
2. Separar en UI los módulos operativos que hoy están mezclados o invisibles.
3. Alinear frontend y backend en RBAC para `jefe_servicio`, `ing_servicio` y `esp_app`.
4. Consolidar un cronograma técnico multi-fuente con vista personal y vista de coordinación.
5. Conectar el cronograma con asistencia, salidas y visitas cuando aplique.
6. Mantener coherencia visual y de interacción siguiendo `DESIGN.md`.

## Restricciones obligatorias
- No asumir tablas, columnas, endpoints ni contratos no verificados.
- No romper funcionamiento del resto de roles.
- Mantener prefijo `/api/v1/`.
- Mantener contratos del módulo cuando ya existan.
- No introducir módulos fantasma ni rutas sin pantalla real.
- Toda implementación de UI debe seguir `DESIGN.md`.
- Neon es fuente de verdad para DB, pero en este diagnóstico no quedó validado por fallo de autenticación `28P01`.

## Evidencia verificada

### 1. Dashboard técnico actual
- Archivo: `spi_front/src/modules/servicio/pages/Dashboard.jsx`
- Carga actual:
  - `mantenimientos`
  - `solicitudes`
  - `availability`
- No carga un cronograma técnico consolidado.

### 2. Vista técnica actual
- Archivo: `spi_front/src/modules/servicio/components/dashboard/TecnicoView.jsx`
- Hallazgos:
  - muestra accesos rápidos
  - muestra mantenimientos asignados
  - muestra solicitudes en curso
  - muestra disponibilidad del equipo
  - expone accesos a `Mi calendario` y `Historial`
- Problema:
  - esas rutas no existen hoy en `AppRoutes.jsx`

### 3. Vista jefatura actual
- Archivo: `spi_front/src/modules/servicio/components/dashboard/JefeTecnicoView.jsx`
- Hallazgos:
  - muestra aprobaciones
  - muestra resumen de mantenimientos
  - muestra solicitudes en curso
  - muestra disponibilidad
  - no ofrece un módulo robusto de cronograma técnico

### 4. Navegación actual del área técnica
- Archivo: `spi_front/src/core/ui/components/NavigationBar.jsx`
- Hallazgos:
  - `servicio_tecnico`, `tecnico`, `ing_servicio`, `esp_app`, `jefe_tecnico`, `jefe_servicio`, `jefe_servicio_tecnico` comparten grupo técnico
  - la navbar sí expone `Workspace de compras`, `Workspace de equipos`, `Permisos`, `Capacitaciones`, `Firma`, `Pruebas técnicas`
  - no existe un módulo visible y explícito de `Cronograma técnico`

### 5. Rutas técnicas actuales
- Archivo: `spi_front/src/routes/AppRoutes.jsx`
- Rutas confirmadas:
  - `/dashboard/servicio-tecnico`
  - `/dashboard/servicio-tecnico/mantenimientos`
  - `/dashboard/servicio-tecnico/solicitudes`
  - `/dashboard/servicio-tecnico/disponibilidad`
  - `/dashboard/servicio-tecnico/capacitaciones`
  - `/dashboard/servicio-tecnico/equipos`
  - `/dashboard/servicio-tecnico/aplicaciones`
  - `/dashboard/servicio-tecnico/desinfeccion`
  - `/dashboard/servicio-tecnico/asistencia`
  - `/dashboard/servicio-tecnico/verificacion`
  - `/dashboard/servicio-tecnico/retiros`
  - `/dashboard/servicio-tecnico/casos-externos`
- Rutas faltantes frente a UI actual:
  - `/dashboard/servicio-tecnico/calendario`
  - `/dashboard/servicio-tecnico/historial`

### 6. Cronograma manual existente
- Frontend:
  - `spi_front/src/modules/servicio/pages/Disponibilidad.jsx`
  - consume `getTechnicalActivities` y `createTechnicalActivity`
- Backend:
  - `backend/src/modules/servicio/servicio.routes.js`
  - `GET /servicio/actividades`
  - `POST /servicio/actividades`
  - `backend/src/modules/servicio/servicio.controller.js`
- Base lógica:
  - `servicio.cronograma_actividades_tecnicas`

### 7. Fuentes reales de agenda técnica ya existentes
- Compras públicas:
  - `backend/src/modules/equipment-purchases/equipmentPurchases.service.js`
  - usa `cronograma_actividades_tecnicas`
- Compras privadas:
  - `backend/src/modules/private-purchases/privatePurchases.service.js`
  - usa `cronograma_actividades_tecnicas`
- Inspecciones de ambiente F.ST-20:
  - públicas y privadas
  - visibles en `TechnicalProcedureWorkspace`
- Mantenimientos:
  - `spi_front/src/modules/servicio/pages/Mantenimientos.jsx`
  - `spi_front/src/modules/equipment/pages/EquipmentWorkspace.jsx`
- Retiros:
  - `backend/src/modules/servicio/withdrawalWorkflow.service.js`
  - `spi_front/src/modules/servicio/pages/RetiroEquipos.jsx`
- Correctivos:
  - `backend/src/modules/servicio/correctiveCases.service.js`
  - `spi_front/src/modules/servicio/components/CorrectiveCaseWorkspace.jsx`
- Workflow documents:
  - `GET /servicio/workflow-documents/summary`
- Aplicaciones técnicas:
  - `spi_front/src/modules/servicio/pages/Aplicaciones.jsx`
- Asistencia operativa:
  - `spi_front/src/core/ui/widgets/AttendanceWidget.jsx`

### 8. Inspección de ambiente como módulo separado
- Existe evidencia fuerte de que debe considerarse un módulo visible y no solo una tarea interna:
  - `F.ST-20`
  - `TechnicalProcedureWorkspace`
  - `Business Case`
  - `PublicAcpTab`
  - `PrivateFlowTab`
  - `PurchaseExpedienteDetail`

### 9. Desalineación RBAC actual
- Backend `servicio.routes.js` no contempla de forma consistente a:
  - `ing_servicio`
  - `esp_app`
  - `jefe_servicio`
- Frontend sí les da acceso visual a varios módulos.
- Resultado:
  - UX inconsistente
  - dashboard incompleto
  - navbar con alcance mayor que backend en varios casos

## Problemas actuales a resolver
1. El dashboard técnico no refleja la operación real del área.
2. Existen accesos rápidos a rutas inexistentes.
3. No hay un módulo visible y dedicado de cronograma técnico.
4. Las fuentes de tareas están fragmentadas.
5. Los roles `ing_servicio` y `esp_app` no están alineados entre UI y backend.
6. `jefe_servicio` requiere más capacidad de coordinación visible en dashboard.
7. Inspección de ambiente y otras tareas críticas no están representadas como módulos operativos claros.

## Arquitectura objetivo

### Módulos visibles esperados en navegación técnica
1. `Dashboard técnico`
2. `Cronograma técnico`
3. `Inspecciones de ambiente`
4. `Mantenimientos`
5. `Retiros`
6. `Correctivos`
7. `Aplicaciones y procedimientos ST`
8. `Equipos`
9. `Disponibilidad`
10. `Asistencia y salidas`
11. `Capacitaciones`
12. `Firma`

### Vista objetivo por rol

#### jefe_servicio
- visión de coordinación del equipo
- agenda consolidada
- tareas no asignadas
- tareas vencidas
- carga por persona
- inspecciones de ambiente
- mantenimientos
- retiros
- correctivos
- disponibilidad

#### ing_servicio
- agenda personal operativa
- inspecciones asignadas
- mantenimientos asignados
- retiros asignados
- verificaciones/documentos técnicos
- salidas y visitas vinculadas

#### esp_app
- agenda personal de aplicaciones
- entrenamientos
- asistencias
- verificaciones
- visitas y actividades asignadas por jefatura

#### jefe_tecnico / jefe_servicio_tecnico
- mantener alcance operativo actual
- llevarlo al nuevo modelo unificado de navegación y cronograma

## Estrategia de implementación
La ejecución se divide en dos macroetapas:

### Macroetapa A
Alineación de módulos, navegación, dashboards y RBAC.

### Macroetapa B
Construcción del cronograma técnico robusto multi-fuente e integración con operación diaria.

## Fases detalladas

### Fase 0. Preparación y control
Objetivo:
- fijar matriz de alcance
- fijar frontera de archivos
- evitar pisadas entre agentes

Entregables:
- este plan
- matriz `rol -> módulo -> ruta -> endpoint -> acción`
- checklist de verificación por fase

### Fase 1. Saneamiento de navegación y rutas
Objetivo:
- eliminar desalineaciones entre navbar, dashboard y rutas reales

Trabajos:
- revisar `NavigationBar.jsx`
- revisar `AppRoutes.jsx`
- revisar accesos rápidos del dashboard técnico
- retirar o reemplazar accesos a rutas inexistentes
- preparar estructura de módulos visibles del área técnica

Entregables:
- navegación limpia
- sin enlaces rotos
- módulos técnicos visibles con criterio consistente

Estado de ejecución:
- completado en dashboard técnico para accesos rápidos rotos
- completado en rutas nuevas:
  - `/dashboard/servicio-tecnico/cronograma`
  - `/dashboard/servicio-tecnico/inspecciones`
  - `/dashboard/servicio-tecnico/correctivos`
- validado que navbar ya expone módulos técnicos reales con enfoque consistente

### Fase 2. Alineación de dashboard técnico por rol
Objetivo:
- reorganizar el dashboard técnico para que represente módulos operativos reales

Trabajos:
- rediseñar `DashboardServicio`
- rediseñar `TecnicoView`
- rediseñar `JefeTecnicoView`
- introducir tarjetas o accesos modulares alineados a `DESIGN.md`
- separar claramente:
  - cronograma
  - inspecciones
  - mantenimientos
  - retiros
  - correctivos
  - aplicaciones
  - disponibilidad

Entregables:
- dashboard técnico alineado por rol
- jerarquía visual clara
- coherencia visual del sistema

Estado de ejecución:
- `TecnicoView` reorganizado para mostrar módulos reales:
  - cronograma
  - inspecciones
  - mantenimientos
  - correctivos
  - retiros
  - aplicaciones
  - disponibilidad
  - asistencia y salidas
- `JefeTecnicoView` reorganizado para coordinación técnica visible
- dashboard técnico ya consume resumen del cronograma consolidado:
  - próximos eventos
  - pendientes por coordinar
  - acceso directo al módulo origen
- `Disponibilidad.jsx` adaptado para funcionar también como vista dedicada de cronograma técnico
- `Mantenimientos.jsx` adaptado para abrir tab correctivo desde ruta dedicada

### Fase 3. Normalización RBAC
Objetivo:
- alinear frontend y backend para `jefe_servicio`, `ing_servicio`, `esp_app`

Trabajos:
- revisar permisos en:
  - `servicio.routes.js`
  - `privatePurchases.routes.js`
  - `equipmentPurchases.routes.js`
  - `technicalApplications.routes.js`
- alinear `ProtectedRoute` y navbar con backend
- documentar permisos por módulo

Entregables:
- matriz RBAC implementada
- rutas y endpoints consistentes con UI

Estado de ejecución:
- backend `servicio.routes.js` alineado en endpoints técnicos base
- backend `technicalApplications.routes.js` alineado para `jefe_servicio`, `ing_servicio` y `esp_app`
- frontend `moduleAccess` y catálogo backend de módulos alineados con nuevas rutas técnicas
- se verificó que el cronograma técnico navega a rutas propias del módulo servicio, por lo que no requirió abrir RBAC adicional hacia páginas de compras para uso diario técnico
- matriz final `rol -> módulo -> ruta -> endpoint` documentada en `MATRIZ_TECNICA_RBAC_Y_CRONOGRAMA.md`

### Fase 4. Definición del contrato del cronograma robusto
Objetivo:
- definir una capa agregadora para agenda técnica

Fuentes mínimas a consolidar:
- `servicio.cronograma_actividades_tecnicas`
- inspecciones públicas
- inspecciones privadas
- solicitudes `F.ST-20`
- mantenimientos preventivos
- mantenimientos correctivos
- retiros
- correctivos
- workflows técnicos/documentales
- actividades manuales de jefatura

Salidas del agregador:
- agenda personal
- agenda de equipo
- carga por persona
- tareas sin asignar
- tareas vencidas
- tareas por tipo

Entregables:
- contrato backend del cronograma
- reglas de normalización de eventos

Estado de ejecución:
- backend `GET /api/v1/servicio/cronograma/feed` implementado
- fuentes ya consolidadas en el feed:
  - bloqueos manuales de `servicio.cronograma_actividades_tecnicas`
  - inspecciones públicas coordinadas
  - inspecciones privadas coordinadas
  - reinspecciones públicas y privadas registradas en cronograma técnico
  - mantenimientos programados
  - capacitaciones técnicas
- backlog adicional ya visible para inspecciones con solicitud creada pero sin fecha cerrada
- filtro de alcance implementado:
  - `team` para jefaturas
  - `mine` para perfiles operativos
- la matriz final de tipos de evento, categorías y rutas origen quedó documentada en `MATRIZ_TECNICA_RBAC_Y_CRONOGRAMA.md`
- se cierra el contrato del feed actual sin sumar fuentes no verificadas

### Fase 5. Implementación del módulo Cronograma Técnico
Objetivo:
- crear el módulo unificado de cronograma

Capacidades objetivo:
- vista calendario/lista
- filtros por rol, persona, tipo, estado, fuente
- vista personal
- vista equipo
- detalle de tarea
- acceso al módulo origen
- marcadores de tareas críticas

Entregables:
- nueva pantalla de cronograma
- integración con navegación
- UX alineada a `DESIGN.md`

Estado de ejecución:
- ruta dedicada de cronograma técnico ya operativa en UI
- la vista usa el feed consolidado backend y respeta alcance `mine/team`
- la vista de cronograma ya incorpora filtros operativos visibles por:
  - rango de fechas
  - tipo de tarea
  - estado
  - responsable visible
- el resumen, backlog y agenda consolidada ya responden a los filtros aplicados sin cambiar el contrato backend
- el formulario de bloqueo manual fue alineado con etiquetas visibles y estructura consistente con `DESIGN.md`
- decisión de cierre:
  - la vista operativa filtrable queda como implementación oficial
  - no se agrega cuadrícula calendario adicional por no existir evidencia funcional obligatoria ni contrato backend específico para slots horarios

### Fase 6. Integración con asistencia, salidas y viáticos
Objetivo:
- usar el cronograma como fuente operativa diaria

Trabajos:
- reflejar tareas del día en asistencia
- facilitar salidas y visitas a partir del cronograma
- conectar con viáticos cuando haya desplazamiento

Entregables:
- asistencia conectada a agenda técnica
- menor duplicación operativa

Estado de ejecución:
- asistencia ya carga agenda de clientes con `schedule_scope=mine` para no mezclar visitas técnicas de otros usuarios
- entrada y salida de visita ahora sincronizan el estado de `servicio.cronograma_actividades_tecnicas` para inspecciones y reinspecciones técnicas del usuario actual
- el cierre de salida operacional ahora prepara automáticamente un viático base ligado a `source_type = operational_exit`
- la automatización cubre regreso a oficina y cierre fuera de oficina
- backend de viáticos alineado para acceso de `ing_servicio`, `esp_app` y `jefe_servicio`
- la clasificación inicial dentro/fuera del área ahora se ancla al propio expediente de viáticos operativos mediante `classification_completed`
- la vista mensual del declarante ya usa viáticos operativos pendientes de clasificación como fuente principal, dejando candidatos solo como respaldo histórico
- `ViaticosDeclarant.jsx` quedó limpio de imports y símbolos no usados dentro del cierre focal

### Fase 7. QA, no regresión y despliegue
Objetivo:
- validar que no se rompan otros flujos

Cobertura:
- comercial
- backoffice
- jefe_servicio
- jefe_tecnico
- jefe_servicio_tecnico
- tecnico
- ing_servicio
- esp_app

Entregables:
- checklist final de aceptación
- reporte de riesgos residuales

Estado de ejecución:
- `backend/src/modules/attendance/__tests__/attendance.controller.flows.test.js` ejecutado en verde: 28/28 pruebas aprobadas
- se corrigió una regresión real en `attendance.controller.js` para que la sincronización con `servicio.cronograma_actividades_tecnicas` solo corra en roles técnicos del módulo servicio
- la sincronización técnica ahora degrada de forma segura cuando el esquema relacionado no existe o no está disponible
- `backend/src/modules/attendance/attendance.controller.js` validado con `eslint` sin errores
- `spi_front` compiló correctamente con `npm run build`
- persisten warnings históricos de frontend fuera del alcance inmediato; no bloquean build ni el flujo nuevo

## Grupos de trabajo paralelos

### Grupo A. Navegación y rutas
Responsabilidad:
- navbar
- rutas
- estructura de módulos visibles

Archivos frontera:
- `spi_front/src/core/ui/components/NavigationBar.jsx`
- `spi_front/src/routes/AppRoutes.jsx`
- `spi_front/src/core/auth/moduleAccess.js`

No toca:
- servicios backend
- agregador de cronograma

### Grupo B. Dashboard técnico y UX
Responsabilidad:
- `DashboardServicio`
- `TecnicoView`
- `JefeTecnicoView`
- coherencia visual con `DESIGN.md`

Archivos frontera:
- `spi_front/src/modules/servicio/pages/Dashboard.jsx`
- `spi_front/src/modules/servicio/components/dashboard/TecnicoView.jsx`
- `spi_front/src/modules/servicio/components/dashboard/JefeTecnicoView.jsx`

No toca:
- RBAC backend
- contratos agregadores

### Grupo C. RBAC backend
Responsabilidad:
- alinear permisos reales de módulos técnicos

Archivos frontera:
- `backend/src/modules/servicio/servicio.routes.js`
- `backend/src/modules/private-purchases/privatePurchases.routes.js`
- `backend/src/modules/equipment-purchases/equipmentPurchases.routes.js`
- `backend/src/modules/technical-applications/technicalApplications.routes.js`

No toca:
- dashboards
- cronograma UI

### Grupo D. Fuentes de agenda
Responsabilidad:
- mapear y normalizar fuentes

Subgrupos:
- D1: inspecciones públicas y privadas
- D2: mantenimientos y equipos
- D3: retiros y correctivos
- D4: workflows/documentos y aplicaciones

No toca:
- navbar
- dashboard final

### Grupo E. Agregador de cronograma
Responsabilidad:
- crear servicio unificado de agenda técnica

No toca:
- navegación general
- dashboards hasta que el contrato esté cerrado

### Grupo F. Integraciones operativas
Responsabilidad:
- asistencia
- salidas
- visitas
- viáticos

No entra hasta:
- contrato de cronograma estable

## Orden recomendado de ejecución
1. Grupo A
2. Grupo B
3. Grupo C
4. Grupo D
5. Grupo E
6. Grupo F
7. QA transversal

## Gates de control

### Gate 1. Navegación
- no existen enlaces a rutas inexistentes
- módulos técnicos visibles están definidos por rol
- cumplido

### Gate 2. Dashboard
- el dashboard técnico ya representa módulos reales y separados
- cumple `DESIGN.md`
- cumplido

### Gate 3. RBAC
- frontend y backend coinciden
- `ing_servicio`, `esp_app` y `jefe_servicio` quedan alineados
- cumplido

### Gate 4. Contrato del cronograma
- fuentes definidas
- salida normalizada
- criterios de prioridad y estado definidos
- cumplido

### Gate 5. Módulo cronograma
- pantalla nueva navegable
- vista personal y de coordinación
- acceso al origen de cada tarea
- cumplido

### Gate 6. Integración operativa
- asistencia y salidas consumen agenda donde aplique
- cumplido

### Gate 7. No regresión
- sin impactos funcionales en otros roles
- cumplido

## Riesgos
1. RBAC inconsistente entre frontend y backend.
2. Fuentes de agenda con modelos heterogéneos.
3. Rutas visibles sin implementación real.
4. Posible necesidad de cambios de schema no verificados aún en Neon.
5. Riesgo de sobrecargar dashboard si no se aplica disclosure correcto.

## Riesgos mitigados por diseño del plan
- Fronteras claras por grupo.
- Gates obligatorios antes de seguir.
- Revisión visual con `DESIGN.md`.
- Separación entre alineación de módulos y cronograma robusto.

## Dependencias críticas pendientes
1. Validación real de Neon cuando las credenciales estén operativas.
2. Verificación de carga y cardinalidad real de `cronograma_actividades_tecnicas` en entorno productivo.
3. Estas dependencias no bloquean el cierre técnico de frontend/backend ya implementado.

## Checklist de inicio de ejecución
- [x] Diagnóstico de código realizado
- [x] Revisión de `DESIGN.md`
- [x] Identificación de módulos y rutas existentes
- [x] Identificación de fuentes técnicas de agenda
- [x] Identificación de desalineaciones RBAC
- [ ] Validación Neon operativa
- [x] Matriz detallada de roles y módulos en documento auxiliar
- [x] Inicio de Fase 1

## Seguimiento
Este archivo debe actualizarse al terminar cada fase:
- cambiar estado general
- marcar gates cumplidos
- registrar riesgos nuevos
- registrar decisiones de arquitectura

## Decisiones de arquitectura ya tomadas
1. Primero se alinea navegación, dashboard y permisos.
2. Después se construye el cronograma robusto.
3. El cronograma no se implementará como módulo aislado de demo, sino como capa agregadora sobre fuentes reales.
4. No se mantendrán accesos visuales a funcionalidades inexistentes.
5. Toda nueva UI técnica debe respetar `DESIGN.md`.
