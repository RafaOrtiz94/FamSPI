# URS — MÓDULO DE VIÁTICOS

**Sistema:** FamSPI  
**Versión:** 2.0  
**Fecha:** 2026-06-18  
**Estado:** En revisión  
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento define los requerimientos de usuario del módulo de Viáticos del sistema SPI. Su finalidad es establecer, desde la perspectiva del negocio y de los actores que usan el sistema, qué capacidades deben existir, por qué son necesarias, cómo deben manifestarse en la operación diaria y cuándo deben activarse dentro del ciclo real del sistema.

El módulo cubre el ciclo completo de viáticos corporativos: desde la creación del viático vinculado a una salida operacional, pasando por la carga documental (facturas electrónicas SRI mediante archivo TXT, notas de venta manuales, compras sin factura), hasta la revisión multinivel, aprobación y pago. Incluye un workspace agrupado por período que permite al colaborador procesar sus viáticos de forma individual o en lote mediante un asistente guiado de cuatro pasos.

Estos requerimientos son consistentes con el marco de control financiero interno de la organización y con los principios de trazabilidad y evidencia documental que exige el entorno regulado en que opera FamSPI.

---

## 2. Objetivo

Definir los requerimientos de usuario de alto nivel para el módulo `viaticos` del sistema SPI, estableciendo su justificación funcional, su forma esperada de operación y el contexto en que deben intervenir, de modo que sirvan como base verificable para la especificación funcional (FRS), el diseño técnico (DS) y la calificación operacional (OQ/PQ).

---

## 3. Alcance

**Incluye:**
- Backend Express con lógica de servicio en `viaticos.service.js` y rutas en `viaticos.routes.js`
- Frontend React con `ViaticosWorkspace.jsx` (vista de workspace agrupada) y `ViaticosWizard.jsx` (asistente de cuatro pasos)
- Persistencia PostgreSQL en las tablas del dominio: `travel_allowances`, `travel_allowance_invoices`, `travel_allowance_documents`, `travel_allowance_purchases_no_invoice` y tablas de configuración
- Integración con Google Drive para adjuntos documentales
- Ciclo de aprobación multinivel: solicitante → jefe de área → financiero → pago

**Excluye:**
- Módulo de inventario financiero (`finanzas`) y conciliación con sistema externo Silver
- Generación de facturación tributaria de la empresa hacia terceros
- Módulo de compras corporativas (private purchases)
- Infraestructura de base de datos y mecanismos de respaldo

---

## 4. Actores

| Actor | Rol en el sistema | Acciones principales |
|---|---|---|
| Solicitante | Colaborador con salidas operacionales (comercial, técnico, backoffice, talento humano) | Crea viático, carga soportes, envía a revisión |
| Jefe de área | `jefe_comercial`, `jefe_tecnico`, `jefe_operaciones`, `jefe_talento_humano` | Aprueba o rechaza en primer nivel |
| Revisión financiera | `finanzas`, `financiero`, `jefe_financiero`, `jefe_finanzas` | Aprueba, rechaza, categoriza facturas y registra pago |
| Gerencia general | `gerencia_general` | Consulta resúmenes y reportes consolidados |
| Administrador | `admin`, `administrador` | Configura zonas, perfiles fijos y política del módulo |
| Sistema | Proceso automatizado | Aplica validaciones de reglas de negocio y trazabilidad |

---

## 5. Justificación del módulo

El módulo de Viáticos existe porque la organización necesita controlar y documentar los gastos de desplazamiento de sus colaboradores de forma trazable, verificable y auditable. Sin este módulo, los gastos de viáticos no tienen respaldo documental estructurado, no hay flujo de aprobación formal y no es posible cruzar los gastos contra la asistencia operacional del colaborador.

La integración con el SRI mediante carga de archivos TXT permite automatizar la ingesta de facturas electrónicas con todos sus campos tributarios, eliminando la transcripción manual. El workspace agrupado por período responde a la necesidad operativa de procesar múltiples viáticos del mismo mes o semana en una sola sesión. El asistente de cuatro pasos reduce errores al guiar al colaborador a través de todos los tipos de soporte antes de enviar a revisión.

---

## 6. Requerimientos funcionales del usuario

### REQ-VT-001 — Workspace de viáticos agrupado por período
**Actor:** Solicitante  
**Enunciado:** El sistema debe mostrar los viáticos del usuario autenticado agrupados por período (mes o semana), con indicador de avance documental por viático.  
**Resultado esperado:** Vista de workspace con grupos etiquetados por período, mostrando para cada viático su estado del flujo de trabajo y su nivel de completitud documental (sin documentos, en progreso, enviado, aprobado, etc.).  
**Criticidad:** Alta

### REQ-VT-002 — Selección múltiple y procesamiento en lote
**Actor:** Solicitante  
**Enunciado:** El sistema debe permitir seleccionar uno o varios viáticos del mismo período para procesarlos en conjunto mediante el asistente guiado.  
**Resultado esperado:** Checkbox por viático y por grupo de período, con botón que abre el asistente para el lote seleccionado. El asistente avanza de viático en viático hasta completar todos los seleccionados.  
**Criticidad:** Alta

### REQ-VT-003 — Carga de archivo TXT del SRI con previsualización
**Actor:** Solicitante  
**Enunciado:** El sistema debe permitir cargar un archivo TXT generado por el portal del SRI, mostrar una previsualización con todos los campos del comprobante y permitir eliminar filas que no correspondan al viático antes de confirmar la carga.  
**Resultado esperado:** Tabla de previsualización con las 14 columnas del TXT: RUC del emisor, razón social del emisor, tipo de comprobante, número de establecimiento, punto de emisión, número secuencial, clave de acceso, número de autorización, fecha de autorización, fecha de emisión, identificación del receptor, subtotal sin impuestos, IVA e importe total. Las filas cuya fecha de emisión está fuera del rango de fechas del viático se identifican visualmente y no pueden ser categorizadas por el solicitante.  
**Criticidad:** Alta

### REQ-VT-004 — Categorización de facturas durante la carga del TXT
**Actor:** Solicitante  
**Enunciado:** El sistema debe permitir asignar una categoría de gasto a cada factura del TXT en el momento de la carga y adjuntar un documento soporte por factura.  
**Resultado esperado:** Selector de categoría por fila con las opciones válidas del catálogo (`combustible`, `alimentacion`, `hospedaje`, `transporte`, `movilidad`, `materiales`) y campo de adjunto de archivo por fila. Las categorías asignadas se guardan junto con cada factura al confirmar la carga; las facturas sin categoría quedan con estado `pendiente_clasificacion`.  
**Criticidad:** Alta

### REQ-VT-005 — Registro de notas de venta manuales
**Actor:** Solicitante  
**Enunciado:** El sistema debe permitir registrar notas de venta manuales con los campos: RUC del proveedor, nombre del proveedor, fecha de emisión, punto de emisión, número secuencial, subtotal gravado al 12%, subtotal gravado al 0%, IVA, total, descripción del gasto y estado del documento.  
**Resultado esperado:** Formulario de creación con listado de las notas ya registradas para el viático y opción de editar o eliminar cada una. Se admiten múltiples notas por viático.  
**Criticidad:** Media

### REQ-VT-006 — Registro de compras sin factura
**Actor:** Solicitante  
**Enunciado:** El sistema debe permitir registrar compras sin comprobante tributario con los campos: descripción, monto total, categoría de gasto y justificación.  
**Resultado esperado:** Formulario de creación con listado de los registros existentes para el viático. Se admiten múltiples registros por viático. Las compras sin factura requieren aprobación posterior por roles financieros o de talento humano.  
**Criticidad:** Media

### REQ-VT-007 — Resumen consolidado previo al envío a revisión
**Actor:** Solicitante  
**Enunciado:** El sistema debe mostrar un resumen consolidado de todos los soportes del viático con totales por tipo de documento y por categoría de gasto antes de enviar a revisión.  
**Resultado esperado:** Paso final del asistente con conteo de facturas TXT, notas manuales y compras sin factura; totales monetarios por categoría; y botón de envío a revisión activo únicamente cuando el viático está en estado `borrador`.  
**Criticidad:** Alta

### REQ-VT-008 — Envío a revisión por el solicitante
**Actor:** Solicitante  
**Enunciado:** El sistema debe permitir al solicitante enviar su propio viático a revisión cuando esté en estado `borrador`; la acción debe ser bloqueada si el viático ya fue enviado o se encuentra en un estado posterior.  
**Resultado esperado:** Cambio de estado a `pendiente_revision` con registro del actor y timestamp. Endpoint dedicado al solicitante independiente del endpoint de flujo de trabajo de jefes.  
**Criticidad:** Alta

### REQ-VT-009 — Aprobación de primer nivel por jefe de área
**Actor:** Jefe de área  
**Enunciado:** El sistema debe permitir a los jefes de área aprobar o rechazar viáticos en estado `pendiente_revision` indicando motivo cuando corresponda.  
**Resultado esperado:** Cambio de estado a `aprobado_jefe` o `rechazado_jefe` con registro del revisor, timestamp y notas de rechazo si aplica.  
**Criticidad:** Alta

### REQ-VT-010 — Revisión y aprobación financiera
**Actor:** Revisión financiera  
**Enunciado:** El sistema debe permitir a roles financieros aprobar, rechazar o marcar como listo para pago un viático que haya sido aprobado por el jefe de área.  
**Resultado esperado:** Transiciones de estado desde `pendiente_financiero` hacia `aprobado_financiero`, `rechazado_financiero` o `listo_pago` con registro del responsable financiero.  
**Criticidad:** Alta

### REQ-VT-011 — Registro de pago
**Actor:** Revisión financiera  
**Enunciado:** El sistema debe permitir registrar el pago de un viático marcado como listo para pago y actualizarlo al estado `pagado`.  
**Resultado esperado:** Cambio de estado a `pagado` con fecha y responsable del pago persistidos en el registro del viático.  
**Criticidad:** Alta

### REQ-VT-012 — Categorización de facturas por roles financieros
**Actor:** Revisión financiera  
**Enunciado:** El sistema debe permitir a roles financieros categorizar o recategorizar facturas ya guardadas de un viático, incluyendo las que el solicitante no categorizó.  
**Resultado esperado:** PATCH sobre la factura actualiza la categoría, registra la fuente de categorización como `finance` y cambia el estado de la factura a `clasificada`. Operación restringida a `FINANCE_REVIEWER_ROLES`.  
**Criticidad:** Media

### REQ-VT-013 — Control de visibilidad por rol y propietario
**Actor:** Sistema  
**Enunciado:** El sistema debe limitar la visibilidad de viáticos según rol y propietario; los usuarios sin rol financiero o de gerencia solo deben visualizar sus propios viáticos.  
**Resultado esperado:** Consultas de listado filtradas por `created_by` para solicitantes; acceso sin restricción de propietario para roles financieros, gerencia y administración.  
**Criticidad:** Alta

### REQ-VT-014 — Reporte de cotejo del viático
**Actor:** Revisión financiera  
**Enunciado:** El sistema debe generar un reporte de cotejo que cruce los gastos declarados del viático contra la asistencia operacional y los documentos soporte registrados.  
**Resultado esperado:** Reporte con recomendación de monto, estado técnico de validación y detalle de discrepancias encontradas.  
**Criticidad:** Media

### REQ-VT-015 — Configuración de zonas, perfiles fijos y política
**Actor:** Admin / Revisión financiera  
**Enunciado:** El sistema debe permitir a roles autorizados configurar las zonas de viáticos, los perfiles de viáticos fijos por colaborador y la política general del módulo.  
**Resultado esperado:** Endpoints de configuración que persisten parámetros operativos y los aplican en los cálculos del módulo.  
**Criticidad:** Media

### REQ-VT-016 — Reporte resumen y ATS XML
**Actor:** Revisión financiera  
**Enunciado:** El sistema debe generar un reporte resumen de viáticos por período y un archivo ATS en formato XML conforme al esquema SRI.  
**Resultado esperado:** Endpoint de reporte resumen con filas filtradas por período, y endpoint de ATS que retorna el XML con la estructura requerida por el SRI para la declaración del anexo transaccional.  
**Criticidad:** Media

---

## 7. Requerimientos no funcionales

**RNF-VT-001 — Seguridad de acceso:** Todas las rutas del módulo exigen autenticación JWT válida mediante `verifyToken`.

**RNF-VT-002 — Control de autorización:** Las operaciones de cambio de estado financiero, categorización de facturas, configuración y reportes se limitan a roles definidos en `FINANCE_REVIEWER_ROLES` (`finanzas`, `financiero`, `jefe_financiero`, `jefe_finanzas`).

**RNF-VT-003 — Trazabilidad:** Cada cambio de estado persiste el actor, el timestamp y el motivo en la tabla `travel_allowances`. Los registros documentales almacenan `created_by_user_id` y `created_at`.

**RNF-VT-004 — Validación documental:** El sistema valida tipo MIME y tamaño máximo de 15 MB para adjuntos cargados al módulo de documentos del viático.

**RNF-VT-005 — Integridad del flujo:** El sistema bloquea transiciones de estado ilegales. El intento de enviar a `pendiente_revision` un viático que ya se encuentra en ese estado o en uno posterior es rechazado con error descriptivo.

**RNF-VT-006 — Rendimiento:** Las consultas de listado de viáticos con filtros por período y las consultas de totales consolidados deben responder en tiempo operativo para uso recurrente diario.

**RNF-VT-007 — Consistencia del esquema:** Las tablas del módulo se crean mediante `ensureSchema` al iniciar el servicio; este mecanismo usa `CREATE TABLE IF NOT EXISTS` y no altera tablas ya existentes en producción.

---

## 8. Reglas de negocio

- **Ciclo de vida del estado:** `borrador → pendiente_revision → aprobado_jefe | rechazado_jefe → pendiente_financiero → aprobado_financiero | rechazado_financiero → listo_pago → pagado → cerrado`
- Solo el propietario del viático o un rol privilegiado puede enviarlo a revisión mediante `POST /:id/submit-review`.
- Las facturas TXT sin categoría asignada por el solicitante quedan en estado `pendiente_clasificacion`; las categorizadas quedan en `clasificada`.
- Las categorías válidas de gasto son: `combustible`, `alimentacion`, `hospedaje`, `transporte`, `movilidad`, `materiales`.
- Solo roles financieros (`FINANCE_REVIEWER_ROLES`) pueden categorizar o recategorizar facturas ya persistidas en base de datos mediante `PATCH /invoices/:invoiceId`.
- Los comprobantes del TXT cuya fecha de emisión está fuera del rango de fechas del viático se marcan con `in_trip_date_range = false` y no pueden ser categorizados por el solicitante.
- Las notas de venta manual se almacenan en `travel_allowance_invoices` con `document_type = 'nota_venta_manual'`.
- Los tipos de origen del viático permitidos son: `client_visit`, `prospect_visit`, `manual_trip`, `operational_exit`.
- El solicitante no puede acceder a `PATCH /:id/workflow` (reservado para jefes); usa `POST /:id/submit-review` para iniciar el flujo de revisión.

---

## 9. Dependencias con otros módulos

- **Salidas operacionales / Oportunidades:** Los viáticos se originan en salidas operacionales registradas en el módulo de oportunidades o en viajes manuales con `source_type = 'manual_trip'`.
- **Usuarios / Autenticación:** Roles, propietario del viático y trazabilidad por usuario autenticado.
- **Asistencia:** Validación geoespacial y de marcaciones en el reporte de cotejo.
- **Documentos / Google Drive:** Almacenamiento de adjuntos de viáticos a través del módulo de integración con Drive.
- **Notificaciones:** Eventos de cambio de estado relevantes para solicitante y revisores.

---

## 10. Conclusión

Los requerimientos del módulo de Viáticos se justifican por la necesidad institucional de controlar, documentar y auditar los gastos de desplazamiento con respaldo documental estructurado, flujo de aprobación multinivel trazable, integración tributaria SRI automatizada y un workspace operativo eficiente para el colaborador. La versión 2.0 incorpora el workspace agrupado por período, el asistente de cuatro pasos con categorización en carga TXT, registro de notas manuales, compras sin factura y el endpoint dedicado de envío a revisión por el solicitante.
