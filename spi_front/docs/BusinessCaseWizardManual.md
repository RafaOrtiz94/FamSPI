# Manual de uso: Business Case Wizard (Frontoffice)

Este wizard guía a los usuarios comerciales y técnicos a través de la creación y finalización de un Business Case moderno en cinco pasos. La interfaz está disponible directamente desde el menú "Business Case" del dashboard.

## Acceso

1. En la barra lateral, abre **Business Case**.
2. En la parte superior derecha de la página, selecciona **Wizard moderno** (activa la vista del asistente). Si necesitas ver el listado clásico, el botón **Lista y seguimiento** vuelve al widget anterior.

## Flujo paso a paso

1. **Datos Generales**
   - Completa Cliente (autocomplete), Fecha, Tipo y Observaciones.
   - Al enviar se crea el Business Case y se guarda el `businessCaseId` para los siguientes pasos.

2. **Selección de Equipo**
   - Explora el catálogo con filtros y búsqueda.
   - Selecciona el equipo principal; el sistema guarda la elección y limpia determinaciones incompatibles.

3. **Determinaciones**
   - Marca las determinaciones aplicables y ajusta la cantidad mensual.
   - Los cálculos de consumo y costo se actualizan en tiempo real (debounce 500 ms).

4. **Resumen de Cálculos**
   - Consulta totales, utilización del equipo y alertas.
   - Usa los botones **Exportar PDF/Excel** para descargar el caso.

5. **Inversiones y Finalización**
   - Registra inversiones adicionales asociadas al `businessCaseId`.
   - Presiona **Finalizar Business Case** para marcar el caso como completado y salir del flujo.

## Autosave y borradores

- El estado del wizard se guarda automáticamente en `localStorage` cada pocos segundos.
- Los borradores se cargan cuando vuelves a abrir la vista del wizard desde Business Case.

## Recomendaciones

- Completa el Paso 1 antes de continuar: los demás pasos requieren un `businessCaseId` válido.
- Si cambias de equipo en el Paso 2, revisa las determinaciones porque se eliminan las que no son compatibles.
- Usa las exportaciones para validar resultados con el equipo de ACP/Gerencia.
