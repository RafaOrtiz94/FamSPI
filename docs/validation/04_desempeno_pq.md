# Desempeno PQ

Documento vigente de calificacion de desempeno de FamSPI.

Fecha de emision: `16 de julio de 2026`

## 1. Objetivo

Confirmar que FamSPI soporta de forma consistente el uso real de negocio, con usuarios operativos y responsables funcionales, una vez superadas DQ, IQ y OQ del alcance definido.

## 2. Alcance PQ

PQ en FamSPI no es solo UAT informal. Debe validar:

- estabilidad de los flujos reales,
- consistencia del resultado final para el usuario,
- aceptacion funcional por responsables del proceso,
- continuidad operacional despues de cambios recientes,
- ausencia de regresiones severas en escenarios reales.

## 3. Escenarios PQ por dominio

| Dominio | Escenario de punta a punta requerido |
|---|---|
| Talento humano | solicitud, revision, aprobacion, consulta posterior y evidencia |
| Comercial | cliente u oportunidad desde registro hasta seguimiento operativo |
| Business Case | creacion, analisis, aprobacion, trazabilidad y consulta |
| Servicio tecnico | solicitud, planificacion o cronograma, ejecucion y cierre |
| Compras | solicitud, revision, aprobacion, expediente y cierre |
| Inventario y TI | alta o asignacion o entrega o ticket completo |
| Finanzas | viatico o flujo equivalente con revision y resultado final |
| Firma y documentos | firma completa y verificacion posterior |

## 4. Participantes PQ

Cada corrida PQ debe nombrar:

- usuario ejecutor del flujo,
- aprobador o revisor funcional,
- observador TI o QA documental,
- responsable que autoriza la aceptacion.

## 5. Evidencia minima PQ

- capturas o video corto del flujo,
- trazabilidad en sistema,
- datos finales persistidos,
- validacion del responsable funcional,
- desviaciones registradas si aplica.

## 6. Criterios de aceptacion PQ

| Criterio | Aceptacion |
|---|---|
| Flujo completo ejecutado | Obligatorio |
| Usuario funcional conforme | Obligatorio |
| Sin error critico abierto | Obligatorio |
| Resultado persistido y recuperable | Obligatorio |
| Evidencia adjunta | Obligatorio |

## 7. Motivos para no liberar PQ

- el usuario logra completar el flujo pero con workaround no aprobado;
- la interfaz permite operar pero contradice reglas del negocio;
- existen cambios recientes sin revalidacion del flujo impactado;
- OQ fue parcial o uso de evidencia vieja;
- no existe firma de aceptacion funcional.

## 8. Relacion con cambios futuros

Cada vez que exista:

- nuevo workspace,
- cambio material de flujo,
- nueva regla de aprobacion,
- nuevo rol con permisos operativos,
- nuevo portal publico conectado a backend productivo,

se debe decidir si requiere:

- solo actualizacion documental,
- rerun de OQ,
- rerun parcial de PQ,
- o reapertura completa del dominio.

Todo cambio futuro debe estar relacionado con un ticket TI verificable. La aceptacion PQ posterior al cambio solo puede cerrarse cuando el ticket asociado tiene codigo, estado `resuelto` o `cerrado`, eventos suficientes en `support_ticket_events` y evidencia de pruebas o decision registrada en comentarios.

## 9. Cierre PQ

PQ solo puede cerrarse por dominio cuando:

1. DQ del alcance esta vigente.
2. IQ del entorno usado esta aprobado o aprobado con desviaciones aceptadas.
3. OQ del dominio esta ejecutado.
4. El responsable funcional aprueba el uso previsto.
5. No quedan desviaciones criticas bloqueantes.

## 10. Conclusion

PQ es la ultima barrera para declarar que un dominio de FamSPI esta realmente validado para uso operativo. En el estado actual del sistema, este documento debe ejecutarse por dominio y por cambio material, no como una aprobacion unica historica del producto completo.
