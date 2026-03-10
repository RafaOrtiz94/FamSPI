# GUIA DE GESTION DE CAMBIOS Y VALIDACION

## 1. Objetivo
Establecer la regla operativa para que todo cambio funcional o tecnico del SPI quede revisado, documentado y validable antes, durante y despues de su implementacion.

## 2. Regla general
- Ningun cambio debe implementarse sin una revision previa del alcance, impacto y riesgos.
- Todo cambio debe dejar evidencia documental en `validacion_sistema`.
- Todo cambio debe poder trazarse desde necesidad de negocio hasta evidencia de validacion.

## 3. Artefactos minimos obligatorios
Segun el tipo de cambio, se debe actualizar o crear al menos uno de los siguientes documentos:

- `URS`: cuando cambia o nace una necesidad del usuario.
- `FRS`: cuando cambia el comportamiento funcional esperado.
- `DDS`: cuando cambia el diseno tecnico, integraciones, jobs, seguridad o infraestructura.
- `informes`: cuando se realiza revision, diagnostico, validacion o cierre de incidente/cambio.

## 4. Flujo obligatorio antes de implementar
1. Revisar el estado actual en codigo, configuracion e infraestructura.
2. Identificar modulo, area funcional, dependencias y riesgos.
3. Registrar el hallazgo o requerimiento en `validacion_sistema`.
4. Ajustar `URS/FRS/DDS` si el cambio modifica alcance, reglas o arquitectura.
5. Implementar el cambio.
6. Ejecutar verificaciones funcionales y tecnicas.
7. Registrar resultado, evidencia y estado final en un informe.

## 5. Criterios minimos de documentacion por cambio
Todo cambio debe dejar documentado:

- objetivo del cambio
- problema o hallazgo detectado
- impacto funcional
- impacto tecnico
- configuracion o dependencias externas involucradas
- riesgos operativos
- criterio de aceptacion
- evidencia de validacion
- estado final

## 6. Ubicacion sugerida por tipo de contenido
- Requerimientos por area o modulo: `validacion_sistema/URS`
- Especificacion funcional: `validacion_sistema/FRS`
- Diseno tecnico: `validacion_sistema/DDS`
- Revision, incidentes, pruebas, cierre y validacion: `validacion_sistema/informes`

## 7. Checklist previo a implementacion
- Existe documento de revision del caso.
- El cambio esta asignado a un area funcional.
- El impacto en seguridad y datos fue revisado.
- El cambio identifica dependencias en GCP, DB, Drive, Scheduler o secretos.
- Existe criterio concreto para validar exito o falla.

## 8. Checklist de cierre
- El cambio quedo desplegado o aplicado donde corresponde.
- La evidencia tecnica fue verificada.
- La documentacion quedo actualizada.
- El estado final quedo registrado como `pendiente`, `en progreso`, `validado` o `cerrado`.

## 9. Aplicacion inmediata
A partir de ahora, cualquier cambio relacionado con:

- backend
- frontend
- migraciones
- jobs internos
- Cloud Run
- Cloud Scheduler
- secretos e integraciones de Google

debe quedar reflejado en `validacion_sistema` antes de considerarse terminado.
