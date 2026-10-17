# Especificación Objetivo del Módulo de Viáticos

## 1. Propósito

Definir el flujo funcional objetivo del workspace de viáticos con base en la operación real del negocio.

Esta especificación reemplaza ambigüedades y fija:

- origen real del viático
- clasificación inicial
- estructura padre/hijos
- reglas de plazo
- anticipos
- revisión por talento humano y finanzas
- liquidación
- trazabilidad
- visibilidad por rol

## 2. Origen del flujo

El origen válido del flujo de viáticos es:

- una salida operacional registrada en asistencia

Regla de negocio:

- todos los colaboradores están obligados a registrar la salida operacional en asistencia
- a partir de ese registro se crea el expediente base de viáticos

## 3. Creación inicial del expediente

Cuando se registra la salida operacional:

- el expediente base de viáticos se crea automáticamente
- no espera acción manual para existir

Ese expediente base entra a un proceso de clasificación realizado por:

- el mismo colaborador que registró la salida

## 4. Clasificación inicial de la salida

El colaborador debe clasificar la salida como:

- dentro del área
- fuera del área

### 4.1 Si la salida es dentro del área

Comportamiento:

- no aplica proceso de viáticos
- debe conservarse para consulta
- queda en el mismo workspace de viáticos
- debe existir una sección separada para este tipo de registros

### 4.2 Si la salida es fuera del área

Comportamiento:

- sí aplica proceso de viáticos
- el colaborador puede empezar a cargar gastos
- también puede dejarla pendiente para acumularla y procesarla al final del mes

## 5. Modelos de procesamiento permitidos

Las salidas fuera del área deben poder procesarse de dos formas:

- individual
- mensual consolidada

Regla operativa:

- el modo ideal es el mensual consolidado
- el individual sigue permitido por excepciones operativas

## 6. Regla de inclusión en expediente mensual

El expediente mensual debe incluir automáticamente:

- todas las salidas fuera del área del mes
- que ya hayan sido clasificadas
- y que sigan pendientes

Si una salida ya fue procesada individualmente:

- no debe duplicarse en el expediente mensual
- debe quedar marcada como procesada individualmente
- esa marca debe ser visible para colaborador, talento humano y finanzas

## 7. Tipos de gasto permitidos

Los tipos reales de gasto permitidos en el flujo son:

- facturas SRI
- notas de venta
- compras sin factura

Dentro de compras sin factura se incluyen casos como:

- peajes
- parqueos
- movilización en taxi
- movilización en bus
- otros casos equivalentes de operación

## 8. Vehículo personal y kilometraje

El uso de vehículo personal:

- no se trata como un rubro económico liquidable por km dentro de este flujo objetivo
- sí es evidencia operativa y de control

Debe mostrarse a talento humano y finanzas:

- la imagen tomada
- el kilometraje registrado
- el total de kilómetros recorridos en salidas operacionales

## 9. Datos mínimos del expediente base

### 9.1 Salida sin vehículo personal

Campos obligatorios:

- fecha
- hora de salida
- hora de retorno
- motivo
- destino

### 9.2 Salida con vehículo personal

Campos obligatorios:

- fecha
- hora de salida
- hora de retorno
- motivo
- destino
- si usó vehículo personal
- km inicial
- km final
- fotos de kilometraje

### 9.3 Si faltan datos obligatorios

Comportamiento:

- el expediente sí se crea
- el colaborador debe completar la información faltante

## 10. Regla de plazo

La regla final de plazo para completar y procesar información es:

- hasta el último día calendario del mes en que se generó la salida
- más una gracia fija de 7 días del mes siguiente

Ejemplo:

- salidas de junio pueden completarse y procesarse hasta el 7 de julio

Durante la gracia:

- el colaborador puede operar normalmente
- puede completar datos
- puede cargar gastos
- puede clasificar comprobantes
- puede enviar subexpedientes

## 11. Vencimiento y anulación

Al vencer el plazo del mes más la gracia de 7 días:

- se anulan para viáticos las salidas sin procesar
- también se anulan los subexpedientes que sigan en borrador

Los subexpedientes que ya fueron enviados antes del vencimiento:

- deben seguir su flujo normal aunque la fecha ya haya pasado

### 11.1 Estado de anulación

Comportamiento:

- queda anulado para viáticos pero visible
- debe existir una sección separada dentro del workspace de viáticos
- visible solo para:
  - dueño del expediente
  - finanzas
  - talento humano

Debe guardar y mostrar un motivo estándar:

- vencido por falta de información obligatoria

## 12. Estructura del expediente

### 12.1 Expediente padre

El expediente padre representa el contenedor general de la salida o del mes.

Estados del padre:

- sin procesar
- parcial
- liquidado total

Definiciones:

- `sin procesar`: ya existen salidas fuera del área clasificadas, pero todavía no se ha creado ningún subexpediente ni se ha cargado ningún gasto
- `parcial`: uno o varios hijos aún no están liquidados
- `liquidado total`: todos los hijos existentes están liquidados

Si solo existe un hijo:

- al liquidarse ese único hijo, el padre pasa a liquidado total

### 12.2 Subexpedientes hijos

La división del flujo depende de la clasificación manual de comprobantes por parte del colaborador:

- con tarjeta
- sin tarjeta

Cuando en un expediente hay gastos mixtos:

- se crean dos subexpedientes separados

Momento de creación:

- se crean automáticamente cuando el colaborador clasifica los comprobantes
- no esperan al envío a revisión

## 13. Comportamiento de la vista del colaborador

El colaborador debe poder:

- ver siempre el expediente padre completo
- ver todos sus hijos
- ver estados separados
- ver totales separados
- enviar cada hijo por separado
- enviar todo junto

Si envía solo un hijo:

- el otro queda en borrador
- el otro puede seguir editándose

## 14. Flujo de revisión por tipo de subexpediente

### 14.1 Subexpediente sin tarjeta

Lo procesa:

- talento humano

Talento humano:

- revisa
- aprueba o rechaza
- registra el resultado económico final

### 14.2 Subexpediente con tarjeta

Lo procesa:

- finanzas

Finanzas:

- revisa
- aprueba o rechaza
- registra el resultado económico final
- registra pago al banco o conciliación

## 15. Estados de los subexpedientes

Estados definidos:

- borrador
- enviado
- en revisión
- aprobado
- rechazado
- liquidado

Regla de rechazo:

- `rechazado` no es final
- vuelve a borrador para corrección
- el colaborador puede editar y reenviar
- debe conservarse el historial de observaciones

No se usará un estado intermedio `observado`:

- vuelve directamente a borrador
- dejando la observación registrada

Cuando un subexpediente pasa a `liquidado`:

- se considera terminado completamente

## 16. Edición y bloqueo

Mientras el subexpediente está en borrador:

- el colaborador puede agregar comprobantes
- el colaborador puede eliminar comprobantes
- el colaborador puede editar totalmente

Cuando pasa a enviado:

- debe quedar bloqueado

Si vuelve a borrador:

- debe reabrirse para edición total
- no solo para los comprobantes observados

## 17. Clasificación de comprobantes

La clasificación entre `con tarjeta` y `sin tarjeta` la define:

- el colaborador manualmente por cada comprobante

Talento humano y finanzas:

- no reclasifican
- solo observan
- y devuelven a borrador si el colaborador clasificó mal

## 18. Rechazo de comprobantes individuales

Si talento humano o finanzas rechazan un comprobante:

- el sistema recalcula automáticamente el valor del subexpediente
- excluyendo el comprobante rechazado

El comprobante rechazado:

- desaparece de la liquidación activa
- queda solo en trazabilidad

La trazabilidad del rechazado la pueden ver:

- colaborador
- talento humano
- finanzas

Si el expediente vuelve a borrador:

- el colaborador puede cargar un comprobante nuevo para reemplazarlo
- el comprobante anterior no debe reactivarse

## 19. Visibilidad por revisor

Cuando talento humano o finanzas revisan:

- deben ver solo su subexpediente
- no el expediente completo

El colaborador:

- sí debe seguir viendo el expediente padre con todos sus hijos

## 20. Cálculo económico de subexpedientes

### 20.1 Sin tarjeta

Resultado económico posible:

- valor a pagar al colaborador
- valor a devolver por el colaborador
- saldo en cero

El sistema:

- calcula automáticamente el valor del subexpediente

Talento humano:

- no edita el monto
- solo confirma y liquida el resultado

### 20.2 Con tarjeta

Resultado económico:

- valor conciliado/pagado por la empresa

No aplica como resultados de negocio del hijo:

- devolución
- saldo en cero editable

El sistema:

- calcula automáticamente el valor del subexpediente

Finanzas:

- no edita manualmente el monto
- solo confirma y liquida

## 21. Anticipos

Los anticipos viven en:

- el expediente padre general

No viven en hijos separados.

El anticipo afecta:

- al saldo global del padre

### 21.1 Flujo del anticipo

1. el colaborador solicita el anticipo antes de empezar a cargar gastos
2. finanzas decide si aprueba o rechaza
3. finanzas registra el anticipo con evidencia cuando se desembolsa

El colaborador:

- puede continuar con el flujo de viáticos aunque el anticipo esté aprobado y aún no desembolsado

Estados del anticipo:

- solicitado
- aprobado
- rechazado
- desembolsado

La evidencia del anticipo:

- debe subirse al registrarlo desde finanzas

## 22. Regla de impacto del anticipo

El anticipo solo afecta el saldo global:

- cuando pasa a desembolsado

Si no existe anticipo:

- el bloque de saldo global no aparece

## 23. Cálculo del saldo global del padre

El saldo global:

- lo calcula automáticamente el sistema
- es inmutable
- no puede ser editado por usuario alguno

Debe mostrarse a:

- colaborador
- talento humano
- finanzas

Debe mostrarse siempre de manera provisional cuando aplique:

- no solo al final

Pero el descuento real del anticipo se consolida cuando los hijos se liquidan.

Regla de dinero real:

- al liquidar es cuando se considera pagado

## 24. Resultado del saldo global

Casos posibles:

1. gasto total mayor al anticipo
   - valor adicional a pagar al colaborador
2. gasto total igual al anticipo
   - saldo en cero
3. gasto total menor al anticipo
   - valor a devolver por el colaborador

## 25. Documentos finales

Cuando un subexpediente se liquida:

- debe generarse automáticamente un documento
- sin intervención manual

Ese documento se genera:

- por cada subexpediente
- no uno consolidado del padre

Pueden verlo o descargarlo:

- financiero
- talento humano
- dueño del expediente

## 26. Matriz de estados y transiciones

### 26.1 Expediente base de salida

Estados relevantes:

- creado
- clasificado dentro del área
- clasificado fuera del área
- anulado para viáticos

Eventos:

- registro de salida en asistencia
- clasificación por colaborador
- vencimiento de plazo

### 26.2 Expediente padre

Estados:

- sin procesar
- parcial
- liquidado total

Eventos:

- creación de hijos
- liquidación parcial de hijos
- liquidación total de hijos

### 26.3 Subexpediente sin tarjeta

Estados:

- borrador
- enviado
- en revisión
- aprobado
- rechazado
- liquidado

Responsable de revisión:

- talento humano

### 26.4 Subexpediente con tarjeta

Estados:

- borrador
- enviado
- en revisión
- aprobado
- rechazado
- liquidado

Responsable de revisión:

- finanzas

### 26.5 Anticipo

Estados:

- solicitado
- aprobado
- rechazado
- desembolsado

Responsable de decisión y registro:

- finanzas

