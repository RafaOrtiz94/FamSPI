# Plan de Corrección del Módulo de Viáticos

## 1. Objetivo

Alinear el módulo actual de viáticos al flujo objetivo definido en `ESPECIFICACION_OBJETIVO_VIATICOS_WORKSPACE.md` sin afectar el funcionamiento de otros módulos ni romper contratos existentes innecesariamente.

## 2. Alcance

Áreas impactadas:

- asistencia
- viáticos backend
- workspace frontend de viáticos
- colas de talento humano
- colas de finanzas
- anticipos
- documentos finales
- trazabilidad

## 3. Principios de implementación

- no asumir estructura distinta a la verificada en código
- mantener prefijo `/api/v1/`
- mantener contratos `{ ok: true|false }`
- evitar ruptura de roles existentes
- encapsular nuevas reglas en el módulo de viáticos y en el origen de asistencia
- no duplicar vistas ni flujos paralelos inconsistentes

## 4. Brechas detectadas entre estado actual y estado objetivo

### 4.1 Origen y creación

Brecha:

- el sistema actual ya usa salidas operacionales como base, pero el flujo objetivo exige que ese sea el único origen formal del viático

Corrección:

- validar que toda creación elegible nazca de `attendance_exceptions`
- despriorizar o aislar otros orígenes donde hoy existan

### 4.2 Clasificación inicial

Brecha:

- hoy existe clasificación operativa, pero no está formalizada con la separación funcional exacta `dentro del área` vs `fuera del área` con destino visible específico

Corrección:

- agregar o consolidar estado/tipo de clasificación inicial
- crear sección visible separada para:
  - dentro del área
  - anulados para viáticos

### 4.3 Modelo padre/hijos

Brecha:

- el flujo actual usa decisiones y aprobaciones mixtas, pero no está modelado visual y funcionalmente como expediente padre con subexpedientes `con tarjeta` y `sin tarjeta`

Corrección:

- introducir explícitamente:
  - expediente padre
  - subexpediente hijo `con tarjeta`
  - subexpediente hijo `sin tarjeta`
- recalcular estados del padre:
  - sin procesar
  - parcial
  - liquidado total

### 4.4 Clasificación de comprobantes

Brecha:

- hoy el flujo ya usa `expense_mode`, pero debe alinearse a regla estricta:
  - clasificación manual por colaborador
  - sin reclasificación por revisores

Corrección:

- bloquear reclasificación por talento/finanzas
- dejar solo observación y devolución a borrador

### 4.5 Flujo de revisión

Brecha:

- el sistema actual maneja segmentos, pero debe expresarse por subexpediente separado con aislamiento de vista

Corrección:

- talento humano solo debe ver su hijo `sin tarjeta`
- finanzas solo debe ver su hijo `con tarjeta`
- el colaborador sí debe ver el padre completo

### 4.6 Rechazo y corrección

Brecha:

- hoy existe observación y devolución, pero debe fijarse que el regreso siempre sea a borrador con historial persistente

Corrección:

- unificar la lógica de rechazo/observación
- persistir historial de observaciones por hijo y por comprobante

### 4.7 Plazos

Brecha:

- el sistema actual no está alineado a la regla:
  - cierre de mes
  - más 7 días de gracia del mes siguiente

Corrección:

- implementar cálculo de vencimiento por mes del registro
- anular solo:
  - expedientes sin procesar
  - hijos en borrador
- no anular hijos ya enviados

### 4.8 Anticipos

Brecha:

- el flujo actual de anticipo existe, pero debe amarrarse al padre general y al saldo global visible

Corrección:

- vincular el anticipo solo al padre
- mostrarlo solo si existe
- descontarlo solo desde `desembolsado`
- exigir evidencia de desembolso en finanzas

### 4.9 Resultado económico

Brecha:

- los resultados económicos actuales no están plenamente modelados con la separación formal esperada

Corrección:

- hijo `sin tarjeta`:
  - pagar
  - devolver
  - cero
- hijo `con tarjeta`:
  - conciliado/pagado por empresa
- saldo global del padre:
  - cálculo automático inmutable

### 4.10 Documentos finales

Brecha:

- hoy no está cerrado el comportamiento formal de generación documental automática por hijo liquidado

Corrección:

- generar documento automático al liquidar cada hijo
- hacer visible ese documento a:
  - dueño
  - talento humano
  - finanzas

## 5. Fases de implementación

### Fase 1. Auditoría técnica puntual del estado actual

Objetivo:

- confirmar en código y DB real cómo están hoy:
  - `travel_allowances`
  - anticipos
  - invoices
  - purchases/no invoice
  - estados actuales
  - relación con asistencia

Entregables:

- matriz de tablas y columnas
- matriz de endpoints reales
- matriz de pantallas y roles

Estado:

- completada en código
- pendiente validación Neon

Documento de salida:

- `MATRIZ_ACTUAL_VS_OBJETIVO_VIATICOS.md`

### Fase 2. Modelo de datos objetivo

Objetivo:

- definir cómo representar padre, hijos, trazabilidad, anulados y dentro del área

Decisiones a cerrar:

- si padre e hijos viven en la misma tabla con tipo/nivel
- o si requieren tabla hija formal separada
- cómo registrar historial de observaciones
- cómo registrar comprobantes rechazados en trazabilidad

Entregables:

- diseño de tablas o extensión de schema
- mapa de estados y transiciones persistidas

### Fase 3. Corrección backend de dominio

Objetivo:

- ajustar servicios y controladores de viáticos al nuevo flujo

Trabajo:

- creación automática del expediente base
- clasificación `dentro/fuera`
- vencimiento por fin de mes + 7 días
- anulación automática
- creación automática de hijos por clasificación de comprobantes
- exclusión de salidas ya procesadas individualmente del mensual
- saldo global automático del padre
- liquidación separada por tipo de hijo

### Fase 4. Corrección backend de colas y vistas por rol

Objetivo:

- separar con precisión lo que ve cada revisor

Trabajo:

- talento humano solo hijo `sin tarjeta`
- finanzas solo hijo `con tarjeta`
- colaborador ve padre completo
- dueño/TH/finanzas ven anulados y trazabilidad relevante

### Fase 5. Corrección frontend del workspace

Objetivo:

- rehacer el workspace para que el modelo visual sea coherente con el flujo objetivo

Secciones mínimas:

- dentro del área
- anulados para viáticos
- expedientes sin procesar
- expedientes parciales
- expedientes liquidado total
- trazabilidad de procesadas individualmente

Estructura visual:

- padre visible
- hijos separados
- envío individual o conjunto
- historial de observaciones
- trazabilidad de rechazados
- bloque de anticipo solo si existe

### Fase 6. Flujo de anticipos

Objetivo:

- alinear solicitud, aprobación, desembolso, evidencia y descuento automático

Trabajo:

- solicitud por colaborador
- aprobación por finanzas
- registro con evidencia
- reflejo en saldo global solo desde desembolsado

### Fase 7. Documentos automáticos

Objetivo:

- generar documento final por hijo liquidado

Trabajo:

- plantilla
- datos automáticos
- almacenamiento
- permisos de visualización

### Fase 8. Validación end to end

Objetivo:

- probar casos reales por rol

Casos mínimos:

- salida dentro del área
- salida fuera del área sin gastos aún
- proceso mensual
- proceso individual
- mixto con tarjeta/sin tarjeta
- hijo enviado y otro en borrador
- rechazo y retorno a borrador
- anticipo aprobado no desembolsado
- anticipo desembolsado
- liquidación con anticipo
- anulación por vencimiento

## 6. Orden recomendado de ejecución

1. verificar DB real y modelo actual
2. cerrar diseño padre/hijos
3. implementar reglas backend de estados y vencimiento
4. implementar separación por rol y colas
5. rediseñar workspace frontend
6. integrar anticipos al padre
7. generar documentos automáticos
8. validar E2E

## 7. Riesgos principales

- mezclar estado actual de `travel_allowances` con nuevo modelo sin migración clara
- duplicar registros entre proceso individual y mensual
- romper colas actuales de talento/finanzas
- dejar inconsistencias entre monto del hijo y saldo global del padre
- anular expedientes enviados por error al aplicar vencimiento
- no conservar trazabilidad de rechazados y observaciones

## 8. Criterios de aceptación

- toda salida operacional crea expediente base
- el colaborador clasifica dentro/fuera
- dentro del área no entra a viáticos
- fuera del área puede ir por flujo mensual o individual
- el mensual incluye pendientes clasificados y excluye individuales ya procesados
- la clasificación manual de comprobantes crea hijos separados
- cada hijo puede enviarse por separado o junto
- talento ve solo `sin tarjeta`
- finanzas ve solo `con tarjeta`
- rechazo siempre devuelve a borrador con historial
- comprobantes rechazados salen de liquidación activa y quedan en trazabilidad
- el anticipo vive en el padre
- el descuento solo aplica desde `desembolsado`
- el saldo global se calcula automáticamente
- cada hijo liquidado genera documento automático
- el padre pasa a `liquidado total` solo cuando todos los hijos existentes están liquidados

## 9. Entregables documentales

- especificación funcional objetivo
- plan de corrección
- matriz de estados y transiciones
- checklist E2E por rol
- evidencia de validación técnica
