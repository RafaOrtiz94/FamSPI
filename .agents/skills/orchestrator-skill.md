# skill: orchestrator

## Propósito
Orquestar cambios complejos en FamSPI con máxima precisión, cero suposiciones y mínimo riesgo.

Este skill NO implementa directamente por defecto. Primero analiza, valida contexto, clasifica el cambio, divide en fases y luego habilita ejecución controlada.

Su objetivo es evitar errores por:
- falta de contexto
- micro-tareas ciegas
- suposiciones sobre DB
- cambios transversales no controlados
- modelos con capacidad limitada

---

## Principio central

Primero entender el flujo completo.  
Después dividir.  
Luego ejecutar.

Nunca dividir ni implementar sin evidencia suficiente.

---

## Activar cuando

Usar este skill si el requerimiento:

- Toca 2 o más módulos.
- Requiere DB + backend + frontend.
- Afecta aprobaciones.
- Afecta notificaciones.
- Afecta auditoría.
- Afecta archivos/documentos/Drive.
- Afecta firma digital.
- Afecta integraciones externas.
- Cambia estados o flujos sensibles.
- Tiene alcance ambiguo.
- Puede impactar contratos API.
- Puede impactar RBAC.
- Puede impactar datos existentes.
- Requiere coordinar varios skills o agentes de módulo.

---

## No usar cuando

No usar si:

- Es un bug puntual de un solo módulo.
- No requiere DB.
- No requiere frontend.
- No afecta módulos transversales.
- El cambio puede resolverse directamente usando el CONTEXT.md del módulo.
- El alcance está completamente claro y limitado.

---

## Fuentes obligatorias

Consultar en este orden:

1. `backend/src/modules/<modulo>/CONTEXT.md`
2. Código real del módulo
3. Neon PostgreSQL usando secrets desde GCP Secret Manager
4. Frontend asociado
5. Skills transversales
6. Archivos globales solo si aplica

Si no existe `CONTEXT.md`, escribir:

CONTEXT.md no disponible o insuficiente.

Si el `CONTEXT.md` contradice el código, escribir:

CONTEXT.md inconsistente con el código.

Si Neon contradice el `CONTEXT.md`, escribir:

Neon contradice el CONTEXT.md. Neon es la fuente de verdad para DB.

---

## Reglas de precisión

Prohibido:

- Implementar sin diagnóstico.
- Dividir sin entender el flujo.
- Ignorar CONTEXT.md.
- Inventar endpoints.
- Inventar tablas.
- Inventar columnas.
- Inventar estados.
- Inventar roles.
- Inventar relaciones.
- Basarse en migraciones como fuente principal de DB.
- Cambiar contratos `{ ok: true|false }`.
- Cambiar prefijo `/api/v1/`.
- Cambiar RBAC sin evidencia.
- Hacer refactor amplio no solicitado.
- Mezclar varios requerimientos no relacionados.
- Resolver deuda técnica no solicitada.
- Tocar archivos globales sin justificación.

---

## Diagnóstico obligatorio

Antes de planificar o ejecutar, responder internamente:

```txt
Requerimiento:
Objetivo real:
Módulo principal:
Módulos secundarios:
Tipo de cambio:
Flujo actual según CONTEXT.md:
Evidencia en código:
Evidencia en Neon:
Frontend afectado:
Dependencias transversales:
Riesgo: