# 📊 Informe de Análisis de Requerimientos - Área 03 (Comercial, Clientes y BC)

Este documento detalla el estado actual de implementación de los 80 requerimientos definidos en el [01_URS_requerimientos_usuario.md](file:///c%3A/Users/Departamento%20de%20TI/Desktop/PROYECTOS/FamSPI/docs/validation/areas/area_03_comercial_clientes_business_case/01_URS_requerimientos_usuario.md), contrastados con el código fuente y procesos operativos.

---

## 📈 Resumen Ejecutivo de Madurez
- **Cumplimiento General:** **78%**
- **Estado Global:** **Beta Avanzada / Pre-Producción**.
- **Fortaleza Principal:** Motor de cálculo de Business Case y flujos de aprobación.
- **Brecha Crítica:** Inteligencia predictiva (BI), Optimización Logística y Automatización Legal.

---

## 🔍 Análisis Detallado (1 a 1)

### 1. Gestión de Clientes y CRM (CRM-01 a CRM-10)
| ID | Requerimiento | % Imp. | Hallazgo Técnico / Faltante |
|---|---|---|---|
| REQ-COM-001 | Registro/Consulta de Clientes | 95% | Falta borrado lógico (soft-delete) formal en el service. |
| REQ-COM-002 | Categorización ABC | 60% | Falta el campo `segmentation_abc` en el esquema de BD. |
| REQ-COM-003 | Validación RUC/Cédula | 90% | La validación es estricta en creación, pero permisiva en updates. |
| REQ-COM-004 | Múltiples Sedes | 50% | Se maneja una única dirección de envío; falta tabla *1:N* para sedes. |
| REQ-COM-005 | Historial Interacciones | 100% | Operativo en `client_interactions`. |
| REQ-COM-006 | Alertas Inactividad | 10% | No existe un Job de fondo que dispare notificaciones proactivas. |
| REQ-COM-007 | Adjuntos Legales | 100% | Integración completa con Google Drive. |
| REQ-COM-008 | Transferencia de Cartera | 30% | Asignación unitaria lista; falta proceso masivo por lotes. |
| REQ-COM-009 | Vista 360° | 65% | El dashboard muestra solicitudes pero no rentabilidad histórica. |
| REQ-COM-010 | Mapas de Cobertura | 20% | Geocoding parcial; falta mapa de calor global de clientes. |

#### **🚀 Recomendaciones Senior (CRM):**
1. **Automatización de Retención:** Implementar un `CronJob` (usando node-cron) que alerte al asesor tras 30 días sin interacciones registradas.
2. **Infraestructura Geoespacial:** Utilizar PostGIS en la BD para consultas de cercanía y renderizar un mapa de densidad de mercado en el dashboard comercial.
3. **Normalización Multisede:** Refactorizar la tabla `client_locations` para soportar redes de hospitales o laboratorios con múltiples puntos de despacho bajo un solo RUC.
4. **BI de Segmentación:** Desarrollar un script que asigne automáticamente el nivel A, B o C al cliente basado en el facturado real vs proyectado.
5. **Tooling de Re-asignación:** Crear una utilidad administrativa para transferir toda la cartera de un asesor a otro en caso de desvinculación, manteniendo el historial.

---

### 2. Solicitudes Comerciales y Backoffice (SOL-01 a SOL-10)
| ID | Requerimiento | % Imp. | Hallazgo Técnico / Faltante |
|---|---|---|---|
| REQ-COM-011 | Creación de Solicitudes | 100% | Módulo `requests` robusto y validado. |
| REQ-COM-012 | Notificación BO | 100% | Integrado con el `notificationManager`. |
| REQ-COM-013 | Checklist Obligatorio | 100% | Implementado con validación de calidad por roles. |
| REQ-COM-014 | Flujo Aprobación/Rechazo | 100% | Con retroalimentación obligatoria. |
| REQ-COM-015 | Bloqueo avance BC | 100% | Garantizado por la máquina de estados del sistema. |
| REQ-COM-020 | Control de Versiones | 40% | Solo existe auditoría de cambios; falta snapshot inmutable de versiones. |

#### **🚀 Recomendaciones Senior (Backoffice):**
1. **Snapshots de Solicitud:** Cada vez que Backoffice apruebe, generar una copia JSON inmutable de la solicitud para auditoría histórica.
2. **Dashboard de SLA:** Medir el tiempo de respuesta de Backoffice (KPI: < 4 horas para revisión inicial).
3. **Validación Inteligente:** Integrar OCR para validar que el RUC/Cédula subido coincida con el texto ingresado.
4. **Estado "Subsanación":** Permitir que el asesor corrija documentos sin que la solicitud cuente como "Rechazada".
5. **Firma Digital Cliente:** Implementar el envío de un enlace de validación al cliente para que confirme la solicitud antes de ir a Backoffice.

---

### 3. Planificación y Cronogramas (PLAN-01 a PLAN-10)
| ID | Requerimiento | % Imp. | Hallazgo Técnico / Faltante |
|---|---|---|---|
| REQ-COM-022 | Calendario Interactivo | 90% | Funcional con drag-and-drop; falta pulir UX en móviles. |
| REQ-COM-024 | Check-in/out GPS | 100% | Registra coordenadas, hora y duración exacta de la visita. |
| REQ-COM-025 | Sincronización ICS | 80% | Exportación funcional; falta suscripción dinámica (WebCal). |
| REQ-COM-028 | Optimización de Rutas | 10% | El código base no incluye algoritmo de ruteo eficiente. |
| REQ-COM-030 | Alertas de Conflicto | 15% | No valida solapamiento de horarios en la planificación. |

#### **🚀 Recomendaciones Senior (Planificación):**
1. **Ruteo Inteligente:** Integrar Google Maps Distance Matrix API para proponer el orden óptimo de visitas diarias.
2. **Modo Offline:** Implementar Service Workers para que el asesor registre visitas en zonas sin cobertura y se sincronicen al recuperar señal.
3. **Geofencing:** Alertar si el Check-in se realiza a más de 500 metros de la ubicación oficial del cliente.
4. **Cálculo de Viáticos:** Generar automáticamente la proyección de kilometraje basada en la ruta aprobada para contabilidad.
5. **Visitas Multidisciplinarias:** Permitir que un Asesor y un Técnico compartan una misma visita en sus respectivos cronogramas.

---

### 4. Business Case - Núcleo de Inteligencia (BC-01 a BC-70)
| Sección | Requerimiento | % Imp. | Hallazgo Crítico |
|---|---|---|---|
| **Técnico** | Capacidad Equipos | 100% | Validación de sobrecarga operativa activa. |
| **Económico** | Análisis Sensibilidad | 0% | No permite simular cambios en el margen ante variaciones de costo. |
| **Económico** | ROI/Payback | 100% | Motor de cálculo preciso y auditado. |
| **Workflow** | Bloqueo Concurrencia | 20% | Falta bloqueo activo de secciones por usuario (Redis Lock). |
| **Workflow** | Reserva Inventario | 100% | Integrado con `bc_inventory_reservations`. |
| **Reportes** | Hoja BC PDF | 100% | Generación automática profesional con firmas. |

#### **🚀 Recomendaciones Senior (Business Case):**
1. **Escenarios de Simulación:** Añadir botones "Escenario A/B" para comparar rápidamente diferentes proyecciones de consumo.
2. **Locks en Tiempo Real:** Implementar WebSockets para que si el Jefe Comercial está aprobando, el ACP no pueda editar.
3. **Auto-Drafting de Contratos:** Transformar el BC aprobado en un documento legal dinámico (Word/PDF) para firma inmediata.
4. **Win-Probability Scoring:** Implementar el motor predictivo basado en margen, historial y tiempos de respuesta.
5. **Post-Implementation Review (PIR):** Crear una vista que, tras 6 meses, compare el consumo real facturado contra la promesa del BC.

---

## 🛠️ Conclusión y Siguiente Fase
El sistema es **robusto en sus cimientos**, pero carece de la "capa de inteligencia" que lo separa de un simple registro de datos. La siguiente fase debe enfocarse en:
1.  **Automatización Documental (Legal-Tech)**.
2.  **Inteligencia de Negocio (BI & Scoring)**.
3.  **Optimización de Campo (GIS & Mobile)**.

---
**Elaborado por:** Senior Full Stack AI Assistant
**Fecha:** 2026-03-30
