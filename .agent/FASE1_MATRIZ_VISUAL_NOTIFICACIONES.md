# MATRIZ VISUAL DE NOTIFICACIONES - FASE 1

## 🎯 MAPA DE COBERTURA ACTUAL

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROCESOS vs NOTIFICACIONES                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SOLICITUDES (Requests)                                                  │
│  ├─ Creación                    ✅ IMPLEMENTADO (email a backoffice)    │
│  ├─ Código consentimiento       ✅ IMPLEMENTADO (email a cliente)       │
│  ├─ Aprobación                  ❌ FALTA                                │
│  ├─ Rechazo                     ❌ FALTA                                │
│  ├─ Asignación                  ❌ FALTA                                │
│  ├─ Cambio de estado            ❌ FALTA                                │
│  ├─ Comentarios                 ❌ FALTA                                │
│  ├─ Documentos adjuntos         ❌ FALTA                                │
│  └─ Completado                  ❌ FALTA                                │
│                                                                          │
│  Cobertura: 22% (2/9 eventos)                                           │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BUSINESS CASE                                                           │
│  ├─ Creación                    ❌ FALTA                                │
│  ├─ Asignación inicial          ❌ FALTA                                │
│  ├─ DRAFT → DATOS_BASE          ❌ FALTA                                │
│  ├─ DATOS_BASE → VIABILIDAD     ❌ FALTA                                │
│  ├─ VIABILIDAD → OBSERVADO      ❌ FALTA                                │
│  ├─ VIABILIDAD → VIABLE         ❌ FALTA                                │
│  ├─ VIABLE → AJUSTES_OP         ❌ FALTA                                │
│  ├─ AJUSTES_OP → APROBACION     ❌ FALTA                                │
│  ├─ Equipos agregados           ❌ FALTA                                │
│  ├─ Determinaciones agregadas   ❌ FALTA                                │
│  ├─ Cálculos actualizados       ❌ FALTA                                │
│  ├─ Validaciones fallidas       ❌ FALTA                                │
│  └─ Comentarios                 ❌ FALTA                                │
│                                                                          │
│  Cobertura: 0% (0/13 eventos)                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📊 FLUJO DE BUSINESS CASE CON NOTIFICACIONES (PROPUESTO)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE BUSINESS CASE                                │
└─────────────────────────────────────────────────────────────────────────┘

  [DRAFT_INICIAL]
       │
       │ Comercial completa datos base
       │ 📧 → Jefe Comercial: "BC listo para revisión"
       ▼
  [DATOS_BASE_COMPLETOS]
       │
       │ Jefe Comercial envía a viabilidad
       │ 📧 → Equipo Viabilidad: "Nuevo BC para evaluar"
       │ 💬 → Google Chat: "BC #123 en cola de viabilidad"
       ▼
  [EN_EVALUACION_VIABILIDAD]
       │
       ├─────────────┬─────────────┐
       │             │             │
       │ VIABLE      │ OBSERVADO   │
       │             │             │
       ▼             ▼             │
  [VIABLE]      [OBSERVADO]        │
       │             │             │
       │             │ 📧 → Comercial: "BC observado, revisar"
       │             │ 📧 → Jefe: "BC requiere ajustes"
       │             │             │
       │             └─────────────┘
       │                   │
       │                   │ Comercial corrige
       │                   │ 📧 → Viabilidad: "BC corregido"
       │                   │
       │                   ▼
       │         [EN_EVALUACION_VIABILIDAD]
       │                   │
       │                   │ Re-evaluación
       │                   ▼
       │              [VIABLE]
       │                   │
       └───────────────────┘
       │
       │ 📧 → Comercial: "BC viable, continuar"
       │ 📧 → Jefe Comercial: "BC aprobado por viabilidad"
       │
       │ Jefe envía a operaciones
       │ 📧 → Operaciones: "BC para ajustes operativos"
       │ 💬 → Google Chat: "BC #123 en operaciones"
       ▼
  [AJUSTES_OPERATIVOS]
       │
       │ Operaciones completa planificación
       │ 📧 → Comercial: "BC listo para aprobación final"
       │ 📧 → Jefe Comercial: "BC cerrado, revisar"
       ▼
  [CERRADO_PARA_APROBACION]
       │
       │ 📧 → Gerencia: "BC requiere aprobación final"
       │ 💬 → Google Chat: "BC #123 en aprobación final"
       │ 📧 → Finanzas: "BC para revisión financiera"
       │
       ├─────────────┬─────────────┐
       │             │             │
       │ APROBADO    │ RECHAZADO   │
       │             │             │
       ▼             ▼             │
  [APROBADO]    [RECHAZADO]        │
       │             │             │
       │             │ 📧 → Comercial: "BC rechazado"
       │             │ 📧 → Jefe: "BC no aprobado"
       │             │             │
       │             └─────────────┘
       │
       │ 📧 → Comercial: "BC aprobado, iniciar implementación"
       │ 📧 → Jefe Comercial: "BC aprobado"
       │ 📧 → Operaciones: "BC aprobado, ejecutar"
       │ 💬 → Google Chat: "BC #123 APROBADO ✅"
       │
       ▼
  [IMPLEMENTACION]

Leyenda:
  📧 = Email
  💬 = Google Chat
  ✅ = Notificación implementada
  ❌ = Notificación faltante
```

## 🎭 ROLES Y RESPONSABILIDADES

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE ROLES vs EVENTOS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ROL: Comercial (Creador de BC)                                         │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ BC es observado por viabilidad        (email + BD)              │
│  │  ├─ BC es aprobado como viable            (email + BD)              │
│  │  ├─ BC está listo para aprobación         (email + BD)              │
│  │  ├─ BC es aprobado finalmente             (email + BD)              │
│  │  ├─ BC es rechazado                       (email + BD)              │
│  │  └─ Comentarios en su BC                  (BD)                      │
│                                                                          │
│  ROL: Jefe Comercial                                                     │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ BC completa datos base                (email + BD)              │
│  │  ├─ BC es viable                          (email + BD)              │
│  │  ├─ BC está listo para aprobación         (email + BD)              │
│  │  ├─ BC es aprobado/rechazado              (email + BD)              │
│  │  └─ Solicitud nueva de su equipo          (email + BD)              │
│                                                                          │
│  ROL: Viabilidad                                                         │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ BC entra en evaluación                (email + chat + BD)       │
│  │  ├─ BC corregido vuelve a evaluación      (email + BD)              │
│  │  └─ Comentarios en BC en evaluación       (BD)                      │
│                                                                          │
│  ROL: Operaciones                                                        │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ BC entra en ajustes operativos        (email + chat + BD)       │
│  │  ├─ BC es aprobado (para ejecutar)        (email + BD)              │
│  │  └─ Equipos/determinaciones cambian       (BD)                      │
│                                                                          │
│  ROL: Gerencia                                                           │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ BC listo para aprobación final        (email + chat + BD)       │
│  │  └─ BC aprobado/rechazado (confirmación)  (email + BD)              │
│                                                                          │
│  ROL: Finanzas                                                           │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ BC listo para aprobación final        (email + BD)              │
│  │  ├─ Cálculos actualizados                 (BD)                      │
│  │  └─ BC aprobado (para facturación)        (email + BD)              │
│                                                                          │
│  ROL: TI                                                                 │
│  ├─ Recibe notificación cuando:                                         │
│  │  ├─ Login fuera de horario                (email + chat + BD) ✅    │
│  │  ├─ Errores críticos del sistema          (email + chat + BD)       │
│  │  └─ Cambios masivos en configuración      (BD)                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📈 PRIORIDADES DE NOTIFICACIONES

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NIVELES DE PRIORIDAD                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRIORIDAD 3 (ALTA) 🔴                                                   │
│  ├─ BC observado por viabilidad                                         │
│  ├─ BC listo para aprobación final                                      │
│  ├─ BC rechazado                                                         │
│  ├─ Solicitud rechazada                                                  │
│  ├─ Validación fallida (bloquea flujo)                                  │
│  └─ Login fuera de horario (seguridad)                                  │
│                                                                          │
│  PRIORIDAD 2 (MEDIA) 🟡                                                  │
│  ├─ BC creado                                                            │
│  ├─ BC transición de estado (normal)                                    │
│  ├─ BC viable                                                            │
│  ├─ Solicitud aprobada                                                   │
│  ├─ Solicitud asignada                                                   │
│  └─ Equipos/determinaciones agregados                                   │
│                                                                          │
│  PRIORIDAD 1 (BAJA) 🟢                                                   │
│  ├─ Comentarios agregados                                               │
│  ├─ Documentos adjuntos                                                  │
│  ├─ Cambios menores en BC                                               │
│  └─ Notificaciones informativas                                         │
│                                                                          │
│  PRIORIDAD 0 (INFO) ⚪                                                   │
│  ├─ Recordatorios                                                        │
│  ├─ Resúmenes diarios/semanales                                         │
│  └─ Notificaciones de sistema                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔧 CANALES DE NOTIFICACIÓN POR TIPO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CANALES vs EVENTOS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  EMAIL + CHAT + BD (Máxima urgencia)                                    │
│  ├─ BC listo para aprobación final                                      │
│  ├─ BC observado por viabilidad                                         │
│  ├─ Login fuera de horario                                              │
│  └─ Errores críticos del sistema                                        │
│                                                                          │
│  EMAIL + BD (Importante, requiere acción)                               │
│  ├─ BC creado                                                            │
│  ├─ BC transiciones de estado                                           │
│  ├─ Solicitud aprobada/rechazada                                        │
│  ├─ Solicitud asignada                                                   │
│  └─ BC aprobado/rechazado                                               │
│                                                                          │
│  BD ONLY (Informativo, no urgente)                                      │
│  ├─ Comentarios agregados                                               │
│  ├─ Documentos adjuntos                                                  │
│  ├─ Equipos/determinaciones agregados                                   │
│  ├─ Cálculos actualizados                                               │
│  └─ Cambios menores                                                     │
│                                                                          │
│  EMAIL ONLY (Sin persistencia)                                          │
│  ├─ Código de consentimiento (OTP)                                      │
│  ├─ Recuperación de contraseña                                          │
│  └─ Verificación de email                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📅 ROADMAP DE IMPLEMENTACIÓN

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TIMELINE FASE 2                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SEMANA 1: Sprint 1 - Solicitudes                                       │
│  ├─ Día 1-2: Aprobación + Rechazo                                       │
│  ├─ Día 3: Asignación + Cambio de estado                                │
│  ├─ Día 4: Completado + Templates                                       │
│  └─ Día 5: Testing + Documentación                                      │
│                                                                          │
│  SEMANA 2: Sprint 2 - Business Case (Parte 1)                           │
│  ├─ Día 1-2: Integración en State Machine                               │
│  ├─ Día 3: Helpers de destinatarios                                     │
│  ├─ Día 4: Notificación en creación                                     │
│  └─ Día 5: Testing de transiciones                                      │
│                                                                          │
│  SEMANA 3: Sprint 2 - Business Case (Parte 2)                           │
│  ├─ Día 1-2: Equipos/Determinaciones                                    │
│  ├─ Día 3: Templates de BC                                              │
│  ├─ Día 4-5: Testing completo                                           │
│                                                                          │
│  SEMANA 4: Sprint 3 + 4 - Config y Testing                              │
│  ├─ Día 1-2: Tabla de configuración                                     │
│  ├─ Día 3: Servicio de configuración                                    │
│  ├─ Día 4: Testing end-to-end                                           │
│  └─ Día 5: Documentación final                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🎯 MÉTRICAS DE ÉXITO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KPIs FASE 2                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cobertura de Eventos                                                    │
│  ├─ Solicitudes: 22% → 100% (objetivo)                                  │
│  ├─ Business Case: 0% → 100% (objetivo)                                 │
│  └─ Total: 9% → 100% (objetivo)                                         │
│                                                                          │
│  Tasa de Entrega                                                         │
│  ├─ Email: > 95% (objetivo)                                             │
│  ├─ Google Chat: > 90% (objetivo)                                       │
│  └─ BD: 100% (objetivo)                                                 │
│                                                                          │
│  Performance                                                             │
│  ├─ Tiempo de envío: < 2s (objetivo)                                    │
│  ├─ Impacto en transiciones: < 500ms (objetivo)                         │
│  └─ Tasa de error: < 1% (objetivo)                                      │
│                                                                          │
│  Satisfacción de Usuario                                                 │
│  ├─ Notificaciones útiles: > 80% (objetivo)                             │
│  ├─ Spam reportado: < 5% (objetivo)                                     │
│  └─ Tiempo de respuesta a notificaciones: < 1h (objetivo)               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**Última actualización:** 2026-01-13
**Versión:** 1.0
**Estado:** FASE 1 COMPLETADA - Esperando aprobación para FASE 2
