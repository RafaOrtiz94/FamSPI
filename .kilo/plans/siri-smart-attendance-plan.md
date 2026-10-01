# Plan Siri Smart Attendance

Fecha: 2026-07-09  
Modulo principal: `attendance`  
Alcance: backend + integracion con iPhone Shortcuts + continuidad conversacional + handoff puntual a UI/FamSPI  
Objetivo: permitir que el usuario diga `Oye Siri, marcar asistencia` o `Oye Siri, salida operacional` y el sistema resuelva la marcacion correcta con una experiencia conversacional natural, incluyendo los casos donde haga falta captura de foto o seleccion puntual en UI sin perder el flujo.

## 1. Objetivo funcional

El flujo deseado es:

1. El usuario habla con Siri
2. Siri ejecuta un shortcut unico o shortcuts minimos por intencion
3. El shortcut consulta un endpoint inteligente de FamSPI
4. El backend detecta el estado real del dia
5. El backend responde una accion ejecutada o una pregunta siguiente
6. Siri responde con una frase natural
7. Si hace falta UI o foto, el sistema abre el punto exacto y conserva continuidad

Ejemplos esperados:

- `Realizado, se ha marcado entrada.`
- `Realizado, se ha marcado salida al almuerzo.`
- `Realizado, se ha marcado retorno del almuerzo.`
- `Realizado, se ha marcado salida final. Buen trabajo.`
- `¿Tu salida es a cliente, reunion, banco, proveedor u otra gestion?`
- `¿Es cliente de cronograma, prospecto o emergencia?`
- `Necesito la foto del kilometraje final. Te abro la captura para continuar.`

## 2. Principio de diseno

La inteligencia principal debe vivir en backend.

La web actual debe seguir funcionando igual.

Siri/Shortcuts debe ser una via adicional, no un reemplazo del widget ni de `AttendanceAction`.

Los casos simples deben resolverse sin abrir la web.

Los casos complejos no deben caer en error seco.

Cuando un caso requiera UI, el sistema debe:

1. explicar que falta
2. abrir la pantalla exacta
3. conservar el contexto
4. permitir retomar o cerrar el flujo sin reempezar

## 3. Flujos que deben soportarse

### 3.1 Asistencia normal por voz

Debe soportar:

- `entrada`
- `almuerzo-salida`
- `almuerzo-entrada`
- `salida`
- `permission-entry-start`
- `permission-exit-finish`

### 3.2 Salida operacional por voz

Debe soportar como minimo:

- iniciar salida operacional
- llegada a destino
- salida del destino
- retorno operacional
- cierre operacional

### 3.3 Conversacion operacional guiada

Debe soportar preguntas y respuestas para:

- categoria operacional
- tipo de visita cliente
- prospecto
- seleccion de cronograma cuando sea simple
- handoff a UI cuando sea complejo
- vehiculo personal
- kilometraje
- captura de fotos

## 4. Clasificacion de acciones por voz

### 4.1 Voice-safe directas

Se pueden ejecutar con una sola respuesta del backend:

- `entrada`
- `almuerzo-salida`
- `almuerzo-entrada`
- `salida`
- `permission-entry-start`
- `permission-exit-finish`
- `llegada-destino` cuando no requiere datos adicionales
- `retorno-operacional` cuando no requiere datos adicionales

### 4.2 Voice-safe conversacionales

Se pueden resolver por varias rondas de Siri:

- `salida-oficina` con categoria simple
- `cliente-entrada` con datos suficientes
- `cliente-salida` con decision de continuar o volver
- cierre operacional si solo faltan decisiones simples

### 4.3 Requieren handoff a UI puntual

No deben abortar el flujo; deben derivar al punto exacto:

- seleccion compleja de cliente
- emergencia con cliente exacto y motivo detallado
- cronograma con multiples candidatos no triviales
- kilometraje inicial/final
- foto de odometro
- cualquier evidencia fotografica

## 5. Experiencia conversacional deseada

Siri debe comportarse como una conversacion corta y util.

Ejemplo 1:

- Usuario: `Oye Siri, marcar asistencia`
- Siri: `Realizado, se ha marcado entrada.`

Ejemplo 2:

- Usuario: `Oye Siri, salida operacional`
- Siri: `¿Tu salida es a cliente, reunion, banco, proveedor u otra gestion?`
- Usuario: `Cliente`
- Siri: `¿Es cliente de cronograma, prospecto o emergencia?`
- Usuario: `Prospecto`
- Siri: `¿Cual es el nombre del prospecto?`
- Usuario: `Laboratorio San Pedro`
- Siri: `Realizado, se ha iniciado la salida operacional para prospecto Laboratorio San Pedro.`

Ejemplo 3:

- Usuario: `Oye Siri, cerrar salida operacional`
- Siri: `Necesito la foto del kilometraje final. Te abro la captura para continuar.`

Regla:

- Siri nunca debe responder con mensajes tecnicos internos
- siempre debe indicar accion completada o dato faltante

## 6. Arquitectura propuesta

### 6.1 Endpoint principal

Crear un endpoint especifico, por ejemplo:

- `POST /api/v1/attendance/shortcut/run-smart-mark`

Este endpoint debe:

1. autenticar al usuario
2. leer el estado real del dia
3. aceptar entrada opcional de conversacion
4. resolver el siguiente paso
5. ejecutar la marcacion o devolver la siguiente pregunta
6. devolver una respuesta estructurada para Siri

### 6.2 Contrato de entrada sugerido

```json
{
  "intent": "smart_attendance",
  "spoken_input": "cliente",
  "continuation_token": "opaque-token",
  "client_context": {
    "locale": "es-EC"
  }
}
```

### 6.3 Respuesta exitosa simple

```json
{
  "ok": true,
  "mode": "completed",
  "action": "entrada",
  "spoken_message": "Realizado, se ha marcado entrada.",
  "display_message": "Entrada registrada correctamente.",
  "requires_ui": false,
  "requires_follow_up": false
}
```

### 6.4 Respuesta conversacional

```json
{
  "ok": true,
  "mode": "conversation",
  "conversation_state": "awaiting_operational_category",
  "spoken_message": "¿Tu salida es a cliente, reunion, banco, proveedor u otra gestion?",
  "display_message": "Falta categoria operacional.",
  "requires_ui": false,
  "requires_follow_up": true,
  "continuation_token": "opaque-token"
}
```

### 6.5 Respuesta con handoff puntual

```json
{
  "ok": true,
  "mode": "handoff",
  "conversation_state": "awaiting_end_odometer_photo",
  "spoken_message": "Necesito la foto del kilometraje final. Te abro la captura para continuar.",
  "display_message": "Se requiere foto del kilometraje final.",
  "requires_ui": true,
  "requires_follow_up": true,
  "open_url": "https://fam-spi-front.web.app/asistencia/marcar/cierre-viaje?resume_token=opaque-token&step=end-odometer-photo",
  "continuation_token": "opaque-token"
}
```

## 7. Regla de resolucion inteligente

El endpoint debe apoyarse en la misma fuente de verdad del flujo actual:

- `GET /attendance/today`
- `canonical_flow`
- `allowed_actions`
- `active_time_off`
- `activeException`
- politica de atraso
- visita activa
- categoria operacional

Logica base:

1. si el usuario pide `marcar asistencia`, priorizar flujo normal/permiso
2. si el usuario pide `salida operacional`, priorizar flujo operacional
3. si hay un `continuation_token`, retomar el estado conversacional antes de recalcular desde cero
4. si el siguiente paso es directo y voice-safe, ejecutarlo
5. si faltan datos, devolver la siguiente pregunta
6. si falta UI o foto, devolver handoff puntual

## 8. Servicio backend dedicado

Crear un servicio tipo:

- `backend/src/modules/attendance/attendanceShortcut.service.js`

Responsabilidades:

1. consumir el estado del dia
2. mapear acciones permitidas por voz
3. decidir la accion correcta
4. ejecutar la marcacion usando la logica existente
5. construir `spoken_message`
6. responder con metadata apta para Siri

Regla:

- no duplicar reglas de negocio completas del modulo
- reutilizar helpers y servicios existentes siempre que sea posible

## 9. Servicio conversacional operacional

Crear una capa adicional, por ejemplo:

- `backend/src/modules/attendance/attendanceShortcutConversation.service.js`

Responsabilidades:

1. gestionar estados conversacionales
2. aceptar respuestas parciales del usuario
3. preguntar el siguiente dato
4. decidir si el caso sigue por voz o requiere handoff
5. persistir o firmar el contexto parcial

Estados sugeridos:

- `awaiting_operational_category`
- `awaiting_client_visit_type`
- `awaiting_prospect_name`
- `awaiting_emergency_client`
- `awaiting_emergency_reason`
- `awaiting_vehicle_usage`
- `awaiting_start_odometer`
- `awaiting_start_odometer_photo`
- `awaiting_end_odometer`
- `awaiting_end_odometer_photo`
- `awaiting_post_visit_decision`

## 10. Continuidad y handoff a UI

Se necesita un mecanismo de continuidad.

Opciones:

- token firmado corto
- tabla de sesiones conversacionales
- almacenamiento temporal en redis

El contexto debe incluir:

- usuario
- intencion original
- paso pendiente
- datos ya recolectados
- expiracion

Requisitos:

- solo el mismo usuario puede reutilizar el token
- el token expira rapido
- al completar el flujo se invalida

Cuando haga falta UI:

1. el backend devuelve `open_url`
2. la URL abre el paso exacto
3. la UI consume `resume_token`
4. completa el dato faltante
5. continua sin obligar al usuario a rehacer todo

## 11. Mensajes hablables estables

Definir un catalogo controlado:

- entrada: `Realizado, se ha marcado entrada.`
- almuerzo salida: `Realizado, se ha marcado salida al almuerzo.`
- almuerzo entrada: `Realizado, se ha marcado retorno del almuerzo.`
- salida: `Realizado, se ha marcado salida final. Buen trabajo.`
- permiso inicio: `Realizado, se ha marcado entrada y salida a permiso.`
- permiso fin: `Realizado, se ha marcado salida del permiso.`
- pedir categoria: `¿Tu salida es a cliente, reunion, banco, proveedor u otra gestion?`
- pedir tipo cliente: `¿Es cliente de cronograma, prospecto o emergencia?`
- pedir prospecto: `¿Cual es el nombre del prospecto?`
- pedir vehiculo: `¿Vas a usar vehiculo personal?`
- requerir foto: `Necesito una foto para continuar. Te abro el paso exacto en FamSPI.`
- requerir UI compleja: `Necesito que completes este paso en FamSPI. Te llevo al punto exacto.`
- no compatible: `No se puede completar esta marcacion por voz. Abre FamSPI para continuar.`
- autenticacion fallida: `No fue posible autenticar la solicitud.`
- error general: `No se pudo completar la marcacion. Intenta nuevamente.`

## 12. Integracion con iPhone Shortcuts

Shortcut sugerido principal:

- `Marcar asistencia`

Shortcut sugerido secundario:

- `Salida operacional`

Flujo del shortcut:

1. `Get Contents of URL`
   - metodo `POST`
   - endpoint: `/api/v1/attendance/shortcut/run-smart-mark`
2. leer el JSON
3. usar `spoken_message`
4. ejecutar `Speak Text`
5. si `requires_follow_up = true`:
   - capturar respuesta por dictado o input corto
   - reenviar con `continuation_token`
6. si `requires_ui = true`:
   - abrir `open_url`

El shortcut no debe depender de menus fijos.

Debe apoyarse en:

- dictado
- variables
- condicionales
- llamadas HTTP sucesivas
- lectura hablada

## 13. Problema critico: autenticacion

Antes de implementar, hay que verificar como autenticara Shortcuts contra el backend.

Opciones posibles:

### Opcion A. Reutilizar sesion/cookie actual

Ventaja:

- menos cambios

Riesgo:

- puede ser fragil o inconsistente desde Shortcuts

### Opcion B. Token dedicado para Shortcuts

Ventaja:

- control explicito
- revocable
- mas confiable

Riesgo:

- requiere implementacion adicional

### Opcion C. Shortcut token corto y renovable

Ventaja:

- mas seguro que una sesion persistente
- mas controlado que una cookie compartida

Recomendacion:

- auditar primero la autenticacion actual
- si Shortcuts no puede consumir la API con la sesion existente de forma estable, crear token especifico para shortcuts

## 14. Seguridad

El flujo debe incluir:

- autenticacion obligatoria
- rate limit
- auditoria del origen `shortcut_siri`
- bloqueo de acciones no voice-safe
- respuestas hablables sin datos sensibles
- proteccion contra doble ejecucion rapida
- expiracion corta de `continuation_token`
- validacion de uso del token solo por el mismo usuario
- invalidacion del token al cerrar el flujo

Tambien se recomienda registrar:

- usuario
- fecha/hora
- accion ejecutada
- origen: `ios_shortcut_siri`
- estado conversacional si aplica

## 15. Cambios tecnicos previstos

### Backend

Archivos probables:

- `backend/src/modules/attendance/CONTEXT.md`
- `backend/src/modules/attendance/attendance.controller.js`
- `backend/src/modules/attendance/attendance.routes.js`
- nuevo `backend/src/modules/attendance/attendanceShortcut.service.js`
- nuevo `backend/src/modules/attendance/attendanceShortcutConversation.service.js`
- posible almacenamiento de continuidad (`attendance_shortcut_sessions` o equivalente)
- tests del modulo de asistencia

### Frontend

Minimo en esta fase:

- soporte para `resume_token` en rutas puntuales
- handoff exacto a capturas/fotos/pasos operacionales
- no romper `AttendanceWidget` ni `AttendanceAction`

## 16. Fases de implementacion

### Fase 1. Auditoria de autenticacion real

Objetivo:

Verificar como consumiria la API un shortcut de iPhone.

Trabajo:

1. revisar autenticacion actual del frontend
2. revisar headers/token/cookie reales
3. probar si iPhone Shortcuts puede usar ese mismo mecanismo
4. decidir si se mantiene o se crea token dedicado

Criterio de salida:

- autenticacion definida y comprobable

### Fase 2. Matriz voice-safe

Objetivo:

Formalizar que acciones se pueden ejecutar por voz.

Trabajo:

1. crear lista oficial de acciones voice-safe directas
2. crear lista de acciones conversacionales
3. crear lista de acciones que requieren handoff a UI
4. definir mensajes de fallback

Criterio de salida:

- no hay ambiguedad sobre que puede o no puede marcar Siri

### Fase 3. Matriz conversacional operacional

Objetivo:

Formalizar el flujo de salida operacional por voz.

Trabajo:

1. inventariar todos los pasos operacionales reales del codigo
2. separar que se resuelve por voz y que requiere UI
3. definir prompts de Siri
4. definir `conversation_state`
5. definir estructura de `continuation_token`

Criterio de salida:

- el flujo operacional por voz queda definido sin suposiciones

### Fase 4. Servicio inteligente backend

Objetivo:

Crear la capa de resolucion de marcacion por voz.

Trabajo:

1. implementar `attendanceShortcut.service.js`
2. consumir el estado del dia
3. resolver accion segura
4. ejecutar accion correcta
5. construir respuesta JSON para Siri

Criterio de salida:

- la inteligencia por voz simple funciona sin depender de la web

### Fase 5. Servicio conversacional operacional

Objetivo:

Soportar salidas operacionales con continuidad conversacional.

Trabajo:

1. implementar estados conversacionales
2. aceptar respuestas parciales del usuario
3. generar siguiente pregunta o siguiente accion
4. emitir handoff exacto a UI cuando falte foto o seleccion compleja
5. permitir retomado con `continuation_token`

Criterio de salida:

- Siri puede guiar una salida operacional sin perder el estado

### Fase 6. Endpoint nuevo

Objetivo:

Exponer el servicio a Shortcuts.

Trabajo:

1. crear ruta `POST /api/v1/attendance/shortcut/run-smart-mark`
2. conectar autenticacion
3. agregar rate limit si aplica
4. devolver contrato estable

Criterio de salida:

- Shortcuts puede invocar el flujo con una sola llamada o varias rondas controladas

### Fase 7. Auditoria y seguridad

Objetivo:

Registrar y proteger la marcacion por voz.

Trabajo:

1. registrar origen `shortcut_siri`
2. prevenir duplicados por doble invocacion
3. controlar errores y mensajes seguros
4. proteger continuidad conversacional

Criterio de salida:

- el flujo es trazable y no riesgoso

### Fase 8. Pruebas tecnicas

Objetivo:

Validar el endpoint antes del iPhone real.

Trabajo:

1. probar con curl/Postman
2. validar respuestas para cada estado
3. validar casos conversacionales
4. validar handoff a UI

Criterio de salida:

- el endpoint es estable sin depender del dispositivo

### Fase 9. Shortcut real en iPhone

Objetivo:

Montar el shortcut de produccion.

Trabajo:

1. crear shortcut `Marcar asistencia`
2. crear shortcut `Salida operacional` si se decide separarlo
3. configurarlos con el endpoint
4. hacer que Siri lea `spoken_message`
5. probar activacion por voz real

Criterio de salida:

- el usuario puede hablar con Siri y completar el flujo esperado

## 17. QA minimo

Casos obligatorios:

1. sin entrada registrada -> marca entrada
2. con entrada y sin almuerzo -> marca salida a almuerzo
3. en almuerzo -> marca retorno del almuerzo
4. fin de jornada -> marca salida final
5. permiso al inicio -> marca entrada + salida a permiso
6. permiso al final -> marca salida del permiso
7. inicio de salida operacional simple por voz
8. llegada a destino simple por voz
9. retorno operacional simple por voz
10. salida operacional cliente con pregunta de tipo de visita
11. salida operacional prospecto con nombre dictado
12. salida operacional emergencia con handoff a UI
13. cierre operacional con requerimiento de foto
14. retomado correcto despues del handoff
15. entrada tardia fuera de ventana -> deriva correctamente
16. error de autenticacion -> mensaje controlado
17. doble ejecucion seguida -> no duplica marcacion
18. token conversacional expirado -> bloqueo controlado
19. token conversacional reutilizado por otro usuario -> bloqueado
20. Siri responde con mensaje natural en todos los casos

## 18. Criterio final de aceptacion

Se considera completo cuando:

1. el usuario dice `Oye Siri, marcar asistencia`
2. Siri ejecuta la accion correcta automaticamente cuando el caso es simple
3. Siri responde con un mensaje natural y correcto
4. el usuario puede iniciar y continuar salida operacional por voz en los casos soportados
5. cuando se requiere foto o seleccion compleja, el sistema hace handoff exacto sin perder el contexto
6. las acciones complejas se bloquean o derivan con fallback controlado
7. no se rompe el flujo actual de widget/web/atajos existentes

## 19. Siguiente paso recomendado

Empezar por:

- Fase 1: auditoria de autenticacion real de Shortcuts contra el backend

Razon:

- sin resolver autenticacion, no tiene sentido implementar el endpoint completo
- esa fase define la viabilidad real del flujo Siri-first
