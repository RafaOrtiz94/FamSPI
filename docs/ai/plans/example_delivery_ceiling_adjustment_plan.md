# PLAN-REQ-EXAMPLE-001

## Resumen
Se requiere agregar validacion de techo de entrega al flujo de creacion de solicitudes.
El modulo principal es `delivery-requests`.
Puede requerir lectura puntual de `delivery-ceilings` para fuente del limite.

## Modulos impactados
- modulo principal: `backend/src/modules/delivery-requests/`
- modulos secundarios: `backend/src/modules/delivery-ceilings/` (solo consulta)

## Contratos sensibles
- rutas: mantener `/api/v1/delivery-requests/*`
- payloads: no romper payload de creacion actual
- roles/estados: sin cambios

## Riesgos
- R1: doble validacion con reglas existentes.
- R2: mensaje de error inconsistente.

## Skills/agentes elegidos
- agente principal: module backend de compras privadas (por dominio)
- skills de apoyo: `orchestrator-skill.md` para dividir, luego skill puntual del modulo
- uso de orquestador: si

## Cola de micro-tareas
1. [ ] MT-01 - localizar punto de creacion y agregar validacion de techo (1-3 archivos)
2. [ ] MT-02 - ajustar test puntual de servicio
3. [ ] MT-03 - documentar cierre

## Orden sugerido
Primero validacion backend porque bloquea comportamiento incorrecto.
Luego test puntual para regresion minima.
Finalmente cierre tecnico.

## Regla de ejecucion
Ejecutar solo MT-01. No continuar sin instruccion.
