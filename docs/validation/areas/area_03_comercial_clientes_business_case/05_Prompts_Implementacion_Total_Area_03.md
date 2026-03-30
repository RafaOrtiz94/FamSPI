# 💎 Prompts de Ingeniería Senior para Implementación Total (Área 03)

Este documento contiene los prompts de ingeniería de software necesarios para cerrar el 100% de las brechas identificadas en el Área Comercial, Clientes y Business Case. Cada prompt está diseñado para una implementación de nivel corporativo, utilizando tecnologías modernas y garantizando la escalabilidad.

---

## 🏗️ SPRINT 1: CRM & Client Intelligence (Cierre de Gaps CRM-01 a CRM-10)

### **Prompt 1.1: Refactorización Multisede y Geolocalización Avanzada**
> **Contexto:** Eres un Senior Full Stack Engineer. El sistema SPI actualmente maneja una dirección única por cliente en `client_requests`, lo cual limita la operatividad con grandes redes hospitalarias.
> 
> **Tarea:** Implementar soporte para múltiples sedes (1:N) y geocoding automático.
> 1.  **Backend (DB & Service):**
>     - Crea la tabla `client_locations` vinculada a `client_requests`. Campos: `id`, `client_id`, `name`, `address`, `city`, `province`, `lat`, `lng`, `is_main`.
>     - En `clients.service.js`, añade `addLocation`, `updateLocation` y `removeLocation`.
>     - Integra un hook que al guardar una dirección, use la **Google Maps Geocoding API** para obtener automáticamente `lat` y `lng` si no se proporcionan manualmente.
> 2.  **Frontend (React):**
>     - Crea un componente `LocationManager.jsx` que permita al usuario comercial añadir sedes con un mapa embebido para ajustar el PIN de ubicación.
>     - Refactoriza el selector de clientes en el `Business Case` para que el usuario elija primero el Cliente y luego la Sede de instalación.
> 
> **Restricciones:** Uso de transacciones ACID, manejo de errores con `logger` y API keys en `process.env`.

### **Prompt 1.2: Motor de Alertas de Inactividad y Retención (CronJobs)**
> **Contexto:** Necesitamos un sistema proactivo que evite la fuga de clientes por falta de seguimiento comercial.
> 
> **Tarea:** Implementar un servicio de monitoreo de actividad comercial.
> 1.  **Backend (Worker):**
>     - Utiliza `node-cron` para crear un Job que se ejecute cada 24h.
>     - Lógica: Identificar clientes cuya última interacción en `client_interactions` o `client_visit_logs` sea superior a 30 días.
>     - Clasifica el riesgo: 30-45 días (Bajo), 45-60 días (Medio), > 60 días (Crítico).
> 2.  **Notificaciones:**
>     - Dispara una notificación vía `notificationManager` al Asesor Comercial asignado y al Jefe Comercial.
>     - Incluye en el dashboard comercial un widget de "Clientes en Riesgo" con acceso directo a registrar una interacción.
> 
> **Salida:** Código modular, testeable y con trazas de auditoría.

---

## 🏗️ SPRINT 2: Logística y Planificación de Campo (Cierre de Gaps PLAN-01 a PLAN-10)

### **Prompt 2.1: Ruteo Inteligente y Optimización de Distancias**
> **Contexto:** Los asesores pierden tiempo y recursos en rutas ineficientes. Debemos optimizar sus cronogramas diarios.
> 
> **Tarea:** Implementar el motor de optimización de rutas.
> 1.  **Backend (GIS):**
>     - Endpoint `POST /api/v1/schedules/optimize-route`. Recibe `user_email` y `date`.
>     - Utiliza la **Google Maps Distance Matrix API** para obtener la matriz de distancias/tiempos entre todas las visitas planificadas para ese día.
>     - Implementa un algoritmo de **Nearest Neighbor** o integración con el parámetro `optimizeWaypoints` de la API de Directions para devolver el orden de visitas que minimice el tiempo total de viaje.
> 2.  **Frontend (UX):**
>     - En el componente de calendario, añade un botón "Sugerir Ruta Óptima".
>     - Al confirmar, reordena las tarjetas de visita visualmente y muestra el ahorro estimado en KM y minutos.
> 
> **Estándares:** Manejo de cuotas de API, caching de distancias comunes y Mobile-First UI.

### **Prompt 2.2: Validación de Conflictos y Suscripción WebCal (ICS Live)**
> **Contexto:** El sistema permite solapamientos de horario y la sincronización con Outlook/Google es estática.
> 
> **Tarea:**
> 1.  **Validación:** En el service de `schedules`, añadir una función `validateScheduleConflicts` que bloquee el guardado si el usuario ya tiene una visita en el mismo bloque horario (+/- 1 hora) en una ubicación distinta.
> 2.  **WebCal Feed:** Implementar un endpoint `GET /api/v1/schedules/feed/:token.ics` que devuelva el calendario en tiempo real sin necesidad de descarga manual, permitiendo que el usuario se "suscriba" desde su iPhone/Android/Outlook.
> 
> **Seguridad:** El token de la URL debe ser un hash único por usuario con expiración anual.

---

## 🏗️ SPRINT 3: Inteligencia y Workflow de Business Case (Cierre de Gaps BC-01 a BC-70)

### **Prompt 3.1: Simulador de Sensibilidad Económica (What-if Analysis)**
> **Contexto:** Gerencia necesita ver cómo afecta un descuento o un aumento en el costo de reactivos a la rentabilidad antes de aprobar.
> 
> **Tarea:** Implementar el simulador de escenarios en el Business Case.
> 1.  **Frontend (React & State):**
>     - En la `RentabilitySection.jsx`, añade un modo "Simulación".
>     - Permite al usuario mover sliders de: `% Descuento en Equipos`, `% Variación Costo Reactivo`, `% Margen Objetivo`.
>     - Actualiza en tiempo real los indicadores de **ROI** y **Payback** usando una versión "shadow" del motor de cálculo sin persistir en BD hasta que el usuario presione "Aplicar Escenario".
> 2.  **Visualización:** Usa `recharts` para mostrar una comparativa de barras entre el "Escenario Base" y el "Escenario Simulado".

### **Prompt 3.2: Win-Probability Scoring (Machine Learning Lite)**
> **Contexto:** Debemos predecir la probabilidad de cierre de un negocio basado en datos históricos.
> 
> **Tarea:** Crear el servicio `businessCaseScoring.service.js`.
> 1.  **Lógica (Heurística Avanzada):**
>     - El score se calcula sumando:
>         - ROI > 35% (+30 pts)
>         - Cliente recurrente con BCs ganados (+20 pts)
>         - Tiempo en pipeline < 5 días (+20 pts)
>         - Solicitud con checklist de Backoffice validado al 100% (+30 pts)
>     - Penalizaciones: Por cada rechazo de Backoffice (-10 pts).
> 2.  **Visualización:** Mostrar el % de probabilidad en la grilla principal de BCs con un código de colores (Rojo < 40%, Amarillo 40-70%, Verde > 70%).

---

## 🏗️ SPRINT 4: Automatización Legal y Auditoría (Cierre de Gaps OBS-01 a OBS-10)

### **Prompt 4.1: Legal-Tech: Auto-Drafting de Contratos**
> **Contexto:** El cierre de ventas se retrasa por la redacción manual de contratos.
> 
> **Tarea:** Generador automático de contratos legales.
> 1.  **Backend:**
>     - Servicio `contractGenerator.js` que utilice la librería `docx`.
>     - Toma el BC aprobado, extrae: Representante Legal, RUC, Equipos (Seriales), Determinaciones, Precios y Duración.
>     - Inyecta estos datos en una plantilla corporativa predefinida.
>     - Sube el archivo `.docx` a Google Drive y genera una versión `.pdf` para previsualización.
> 2.  **Workflow:** Añadir un botón "Generar Contrato" solo visible en estado 'Aprobado'.
> 
> **Integridad:** El documento debe llevar un código QR de validación interna generado en el momento.

### **Prompt 4.2: Post-Implementation Review (PIR) - Auditoría de Rentabilidad Real**
> **Contexto:** Debemos verificar si la promesa comercial se cumplió en la realidad operativa.
> 
> **Tarea:** Módulo de Auditoría PIR.
> 1.  **Lógica:** Crear una vista de "Auditoría de Caso" que aparezca 6 meses después de la fecha de instalación.
> 2.  **Consolidación:** Consultar el consumo real facturado al cliente (desde el módulo de inventario/ventas) y compararlo con el consumo proyectado en el BC original.
> 3.  **Métrica:** Calcular el `Deviation_Index`. Si la desviación es > 25%, disparar una alerta de "Caso no rentable / Revisión de precios requerida".
> 
> **Reporte:** Generar un PDF comparativo para la reunión trimestral de gerencia.

---

**Instrucciones Generales:** Todos los prompts deben ser ejecutados asegurando que no se rompan las dependencias existentes y manteniendo el estilo de código (ES6+, async/await, clean code) del proyecto FamSPI.
