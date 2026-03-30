# 🚀 Prompts de Ingeniería Senior: Área Comercial y Business Case (Production-Ready)

Este documento contiene los prompts de ingeniería de software diseñados para una implementación de nivel corporativo, utilizando tecnologías modernas y garantizando la escalabilidad y robustez del sistema SPI.

---

## � PROMPT 1: Motor de Inteligencia de Negocio (Win-Probability & BI)

**Objetivo:** Implementar un motor de scoring predictivo que ayude a la gerencia a priorizar Business Cases con mayor probabilidad de éxito.

> **Instrucciones de Implementación:**
> Eres un **Senior Backend Engineer con experiencia en Fintech y BI**. Tu tarea es implementar el servicio `businessCaseScoring.service.js` en `backend/src/modules/business-case/`.
> 
> **1. Lógica del Algoritmo (Weighted Scoring Model):**
> Implementa una función `calculateWinProbability(bcId)` que calcule un score de 0 a 100 basado en los siguientes pesos:
> - **Rentabilidad (40%)**: Extrae el `roi_percentage` de `bc_calculations`. Si ROI > 40% = 40 pts, entre 20-40% = 25 pts, < 20% = 10 pts.
> - **Fidelidad del Cliente (30%)**: Consulta en `v_business_cases` el historial del cliente. Si tiene > 3 casos 'factibles' en el último año = 30 pts. Si es cliente nuevo = 15 pts.
> - **Eficiencia Operativa (30%)**: Calcula el tiempo transcurrido desde la creación hasta el estado actual. Si es < 72h = 30 pts, > 7 días = 5 pts (penalización por estancamiento).
> 
> **2. Requerimientos Técnicos:**
> - Usa **Common Table Expressions (CTE)** en PostgreSQL para realizar las consultas de historial de forma eficiente.
> - El resultado debe persistirse en la tabla `bc_calculations` en las columnas `win_probability` (DECIMAL) y `scoring_metadata` (JSONB) para auditoría de los factores.
> - Implementa un sistema de **Caching con Redis** (si está disponible) o un mapa de memoria local con TTL de 1 hora para evitar re-cálculos innecesarios en dashboards de alta concurrencia.
> - Manejo de Errores: Si faltan datos críticos, la función debe retornar un `null` controlado y registrar un `logger.warn` con el ID del BC y los campos faltantes.
> 
> **3. Salida Esperada:** Código limpio, modular, con JSDoc completo y tipos definidos. Asegura que el servicio sea exportado como un Singleton.

---

## � PROMPT 2: Optimización Logística y Ruteo Inteligente (Geospatial & Maps)

**Objetivo:** Reducir los costos operativos de la fuerza de ventas mediante la optimización de rutas basada en geolocalización real.

> **Instrucciones de Implementación:**
> Eres un **Senior Full Stack Developer experto en integraciones GIS**. Debes optimizar el módulo de cronogramas en `backend/src/modules/schedules/`.
> 
> **1. Backend (PostGIS & Google Maps API):**
> - Crea el endpoint `POST /api/v1/schedules/optimize-route`. Debe recibir un array de `schedule_ids`.
> - Obtén las coordenadas `latitude` y `longitude` de los clientes asociados desde `catalog_clients`.
> - Implementa una integración con **Google Maps Directions API (Waypoints Optimization)**. Debes enviar el parámetro `optimizeWaypoints: true`.
> - La respuesta debe devolver el array de visitas ordenado de forma óptima, incluyendo `estimated_travel_time` y `estimated_distance` entre cada punto.
> 
> **2. Frontend (React & Advanced UX):**
> - En `PlanificacionMensual.jsx`, utiliza **@react-google-maps/api** para renderizar un mapa interactivo.
> - Implementa un **Polylines Overlay** que dibuje la ruta optimizada con flechas de dirección.
> - Añade un "Floating Action Button" (FAB) con efecto de carga (`Framer Motion`) que al presionar ejecute la optimización y reordene la lista de tarjetas de visitas con una animación de reordenamiento suave.
> 
> **3. Estándares de Producción:**
> - Maneja el **API Key de Google** estrictamente desde variables de entorno (`process.env`).
> - Implementa **Debouncing** en el mapa para evitar llamadas excesivas a la API de Geocoding.
> - Asegura que el diseño sea **Mobile-First**, permitiendo que el asesor abra la ruta directamente en Google Maps o Waze mediante un deep link.

---

## 💎 PROMPT 3: Automatización de Contratos y Firma Digital (Legal-Tech)

**Objetivo:** Eliminar el cuello de botella manual en la formalización de negocios mediante la generación dinámica de documentos legales.

> **Instrucciones de Implementación:**
> Eres un **Lead Developer con experiencia en sistemas de automatización documental**. Debes implementar el generador de contratos en `backend/src/modules/business-case/services/contractGenerator.js`.
> 
> **1. Generación de Documentos (Docx-Templating):**
> - Utiliza la librería **docx** para construir el documento desde cero con estilos corporativos (headers, footers, tablas de precios).
> - **Lógica Dinámica**: Si el BC es de tipo 'Comodato Privado', inserta automáticamente la cláusula de 'Permanencia Mínima' y 'Seguro de Equipos'. Si es 'Venta', inserta los términos de 'Garantía Técnica'.
> - Inyecta dinámicamente: Datos del Representante Legal del Cliente, Detalle de Equipos (Seriales reservados), Precios Unitarios y Totales.
> 
> **2. Integración con Cloud Storage:**
> - Una vez generado el Buffer del documento, utiliza `drive.js` para subirlo a la carpeta específica del cliente: `Clientes/{Nombre_Cliente}/Contratos/`.
> - Retorna el `webViewLink` y guarda la referencia en una nueva tabla `bc_contracts`.
> 
> **3. Interfaz de Usuario (Frontend):**
> - En el `BusinessCaseWorkspace.jsx`, añade un `Stepper` de cierre. El último paso debe ser "Generación de Contrato".
> - Muestra una **Previsualización en PDF** embebida (usando `react-pdf-viewer`) antes de la confirmación final.
> - El botón de "Generar" debe disparar un `toast.promise` de Sonner para informar al usuario del progreso de la subida a la nube.
> 
> **4. Seguridad:** Verifica que solo usuarios con el rol `jefe_comercial` o `legal` puedan ejecutar la generación final del contrato.

---

**Nota para el desarrollador:** Todos los servicios deben seguir el patrón de diseño de la aplicación, utilizar `async/await` con bloques `try/catch` robustos y registrar trazas de auditoría para cada acción significativa.
