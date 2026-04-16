# Plan de Automatización: Requisitos Calidad CA-01-01 a CA-01-17

## Resumen de Gaps Identificados

| Requisito | Módulo CA | Prioridad | Estado Actual |
|-----------|-----------|----------|---------------|
| Mapeo térmico automático | CA-01-01 | Alta | 🔴 Pendiente |
| Integración SITRAD | CA-01-01 | Alta | 🔴 Pendiente |
| Alertas push automáticas | CA-01-01 | Media | 🟡 Parcial |
| Mantenimiento preventivo | CA-01-14 | Media | ⚠️ En desarrollo |
| Tracking calibración | CA-01-14 | Media | ⚠️ En desarrollo |
| Descarga datalogger | CA-01-01 | Alta | 🔴 Pendiente |

---

## Fase 1: Automatización CA-01-01 (Control Temperatura)

### TASK-CAL-01: Integración SITRAD API
- [ ] Crear `calidad/integrations/sitradApi.js` - Cliente API REST para SITRAD
- [ ] Implementar polling de temperaturas ( cada 5 min)
- [ ] Mapear endpoints: `/api/temperatures`, `/api/alarms`, `/api/devices`
- [ ] Crear tabla `ca01xx_sitrad_logs` para histórico

### TASK-CAL-02: Sistema de Mapeo Térmico
- [ ] Crear UI de configuración de puntos de medición (Backend + Frontend)
- [ ] Implementar algoritmo detección puntos críticos
- [ ] Generar reportes de mapeo (PDF con QR)
- [ ] Programar mapeo automático cada 3 años (cron job)

### TASK-CAL-03: Alertas Automáticas
- [ ] Configurar notifier para desviaciones (>2°C o <-8°C)
- [ ] Integrar con `notifications.service.js` existente
- [ ] Notificaciones push (FCM) a responsables
- [ ] Escalamiento automático si no hay ack en 30 min

### TASK-CAL-04: Datalogger Management
- [ ] API para descarga configurada (cada 15 min)
- [ ] Parser de archivos .csv/.dlm
- [ ] Comparación con registro manual
- [ ] Alerta si diferencia >0.5°C

---

## Fase 2: CA-01-14 (Calificación de Áreas - Mantenimiento/Calibración)

### TASK-CAL-05: Sistema de Calibración
- [ ] Crear módulo `ca0114_calibration.schedule.js`
- [ ] Registro de equipos con códigos (F.BO-04)
- [ ] Scheduling automático (anual)
- [ ] Alertas 30 días antes de vencimiento
- [ ] Integración certificados PDF

### TASK-CAL-06: Mantenimiento Preventivo
- [ ] CRUD mantenimiento preventivo
- [ ] Scheduling equipos frío (cámara, refrigerador, congelador)
- [ ] Integración con tickets (TI)
- [ ] Histórico de mantenimientos

---

## Fase 3: Automatización General

### TASK-CAL-07: Dashboard de Cumplimiento
- [ ] Métricas por módulo CA
- [ ] % registros a tiempo
- [ ] Alertas pendientes por área
- [ ] Exportación ejecutiva

### TASK-CAL-08: Integración Registros Físicos
- [ ] OCR para digitalización de registros
- [ ] F.CA-03, F.CA-04, F.BO-04
- [ ] Validación de firmas

---

## Archivos a Crear/Modificar

### Backend
```
backend/src/modules/calidad/
├── integrations/
│   ├── sitradApi.client.js      [NUEVO]
│   ├── dataloggerParser.js     [NUEVO]
│   └── alarmMapper.js        [NUEVO]
├── ca0114/
│   ├── ca0114.calibration.routes.js    [NUEVO]
│   ├── ca0114.maintenance.routes.js   [NUEVO]
│   └── ca0114.equipment.routes.js  [NUEVO]
└── services/
    ├── temperatureMonitor.service.js  [NUEVO]
    └── compliance.service.js     [NUEVO]
```

### Frontend
```
spi_front/src/modules/calidad/
├── components/
│   ├── TemperatureHeatMap.jsx    [NUEVO]
│   ├── CalibrationScheduler.jsx     [NUEVO]
│   ├── MaintenanceCalendar.jsx      [NUEVO]
│   └── ComplianceDashboard.jsx     [NUEVO]
├── pages/
│   ├── CA0114Workspace.jsx         [MEJORAR]
│   └── QualityDashboard.jsx        [NUEVO]
└── hooks/
    ├── useSitradData.js             [NUEVO]
    └── useCompliance.js           [NUEVO]
```

### Base de Datos
```sql
-- Tablas nuevas
calidad_ca01xx_sitrad_logs
calidad_ca01xx_mapping_sessions
calidad_ca0114_equipment
calidad_ca0114_maintenance_schedule
calidad_calibration_certificates
```

---

## Dependencies

- `notifications.service.js` existente → Alertas push
- `calidad/*.routes.js` → Workflows
- Drive API → Archivos digitales

---

## Orden de Implementación

1. TASK-CAL-01 (SITRAD API)
2. TASK-CAL-02 (Mapeo)
3. TASK-CAL-03 (Alertas)
4. TASK-CAL-04 (Datalogger)
5. TASK-CAL-05 (Calibración)
6. TASK-CAL-06 (Mantenimiento)
7. TASK-CAL-07 (Dashboard)
8. TASK-CAL-08 (OCR)