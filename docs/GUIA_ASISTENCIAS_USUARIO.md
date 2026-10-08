# Guía de Usuario — Módulo de Asistencias

**Sistema:** FamSPI  
**Aplica a:** Todos los colaboradores

---

## Contenido

1. [Acceso al widget de asistencia](#1-acceso-al-widget-de-asistencia)
2. [Flujo estándar (todos los roles)](#2-flujo-estándar-todos-los-roles)
3. [Atraso y justificación](#3-atraso-y-justificación)
4. [Salidas y visitas de campo (roles operacionales)](#4-salidas-y-visitas-de-campo-roles-operacionales)
   - 4.1 [Salida operacional — categorías](#41-salida-operacional--categorías)
   - 4.2 [Flujo para categoría "Visita a cliente"](#42-flujo-para-categoría-visita-a-cliente)
   - 4.3 [Flujo para otras categorías (reunión, banco, proveedor, etc.)](#43-flujo-para-otras-categorías-reunión-banco-proveedor-etc)
   - 4.4 [Cierre de viaje fuera de la oficina](#44-cierre-de-viaje-fuera-de-la-oficina)
   - 4.5 [Operación que abarca varios días](#45-operación-que-abarca-varios-días)
5. [Salida inesperada (todos los roles)](#5-salida-inesperada-todos-los-roles)
6. [Horas extra](#6-horas-extra)
7. [Historial y puntualidad](#7-historial-y-puntualidad)
8. [Preguntas frecuentes](#8-preguntas-frecuentes)

---

## 1. Acceso al widget de asistencia

El módulo de asistencias se opera desde el **widget flotante** que aparece en la esquina inferior derecha de cualquier pantalla del sistema.

```
[ícono circular]  ← botón flotante, siempre visible
```

Al hacer clic se abre el panel de asistencia. El color del botón indica el estado actual:

| Color del botón | Significado |
|---|---|
| Azul / Verde | Sin entrada marcada |
| Verde | Jornada abierta |
| Naranja | En almuerzo |
| Azul oscuro | Regresó del almuerzo |
| Gris oscuro | Jornada completada |

---

## 2. Flujo estándar (todos los roles)

La jornada laboral tiene **4 marcas** en orden obligatorio:

```
Entrada → Salida a almuerzo → Regreso de almuerzo → Salida final
```

### Horario estándar de referencia
- **Entrada:** 09:00
- **Salida a almuerzo:** 14:00
- **Regreso de almuerzo:** 15:00
- **Salida final:** 18:00

### Paso a paso

**Marcar entrada**
1. Abrir el widget (botón flotante).
2. El sistema muestra el botón **"Marcar entrada"** (verde).
3. Presionar el botón. El sistema toma la ubicación automáticamente.
4. Mensaje de confirmación: *"Entrada registrada"*.

**Salir a almuerzo**
1. Abrir el widget. El botón ahora dice **"Salir a almuerzo"** (naranja).
2. Presionar. El sistema registra la salida a almuerzo.

**Regresar del almuerzo**
1. Abrir el widget. El botón dice **"Regresar de almuerzo"** (azul).
2. Presionar al volver.

**Marcar salida final**
1. Abrir el widget. El botón dice **"Finalizar jornada"** (gris oscuro).
2. Aparece una confirmación: *"¿Confirmas que deseas registrar tu salida final de hoy?"*
3. Confirmar con **"Sí, registrar salida"**.

> **El sistema usa la ubicación GPS del dispositivo.** Si el GPS no está disponible, la marca se registra de todas formas pero sin coordenadas. Para mejor precisión, activar la ubicación antes de abrir el widget.

---

## 3. Atraso y justificación

El sistema registra un **atraso** cuando la entrada es marcada después de las 09:06 (6 minutos de tolerancia).

### Qué sucede al marcar tarde

1. Aparece un aviso rojo en el widget: *"Atraso registrado — X min"*.
2. Si tienes cupo de justificación disponible, el sistema abre automáticamente el formulario de justificación.

### Justificar el atraso

1. Se abre el modal **"Justificar atraso"**.
2. Describir el motivo en el campo de texto (mínimo 8 caracteres).
3. Presionar **"Guardar justificación"**.

**Límite mensual:** Cada colaborador puede justificar hasta **5 atrasos por mes**. El contador disponible se muestra en el aviso. Si no hay cupo, el atraso se registra en el acta sin posibilidad de regularización.

---

## 4. Salidas y visitas de campo (roles operacionales)

Esta sección aplica a los siguientes perfiles:

- Comercial, Asesor comercial, Jefe comercial, ACP Comercial, Backoffice
- Técnico, Ing. Servicio, Esp. App, Jefe técnico, Jefe servicio técnico
- TI, Jefe TI
- Logística, Jefe Logística

Para estos roles, el widget muestra la sección **"Salidas y visitas"** (expandible).

### 4.1 Salida operacional — categorías

Al registrar una salida de oficina se selecciona la categoría de la actividad:

| Categoría | Cuándo usarla |
|---|---|
| Visita a cliente | Cliente, prospecto o atención técnica |
| Reunión externa | Reunión de trabajo fuera de la oficina |
| Gestión bancaria | Depósitos, trámites o diligencias bancarias |
| Entidad pública | Ministerio u otra institución gubernamental |
| Visita a proveedor | Compras, entregas o coordinación |
| Gestión operativa | Diligencia administrativa externa |
| Otra salida | Cualquier otra gestión laboral |

### 4.2 Flujo para categoría "Visita a cliente"

```
Registrar salida → Llegar al destino → Entrada a cliente → Salida de cliente → Regresar a oficina
```

**1. Registrar salida de oficina**
1. Abrir widget → sección **"Salidas y visitas"**.
2. Presionar **"Registrar salida o visita"**.
3. Seleccionar categoría **"Visita a cliente"**.
4. (Opcional) Agregar detalle de la salida.
5. Si se usa **vehículo personal:** seleccionar "Con vehículo personal", ingresar kilometraje inicial y tomar foto del odómetro.
6. Confirmar con **"Registrar marcación"**.

**2. Llegar al destino**
1. Al arribar al lugar de destino, abrir el widget.
2. El sistema mostrará el botón **"Llegué al destino"** (verde).
3. Presionar para registrar la llegada.

**3. Registrar entrada al cliente**
1. El widget muestra el panel de tipo de gestión.
2. Seleccionar el tipo:
   - **Cliente de cronograma:** buscar el cliente en la agenda del día.
   - **Prospecto:** ingresar el nombre del prospecto.
   - **Emergencia:** buscar el cliente y describir el motivo.
3. Presionar **"Entrada a cliente"**.

**4. Registrar salida del cliente**
1. Al terminar la visita, abrir el widget.
2. El sistema muestra el botón **"Salida de cliente"**.
3. Seleccionar qué pasa después:
   - **"Continuar operación"** → puede ir a otro cliente.
   - **"Iniciar retorno a oficina"** → comienza el regreso.
4. Presionar **"Salida de cliente"**.

**5. Regresar a oficina**
1. Al llegar a la oficina, abrir el widget.
2. Aparece el modal de cierre. Si se usó vehículo personal: ingresar kilometraje final y tomar foto.
3. Confirmar con **"Registrar marcación"**.

### 4.3 Flujo para otras categorías (reunión, banco, proveedor, etc.)

```
Registrar salida → Llegar al destino → (gestión) → Registrar regreso a oficina
```

**1. Registrar salida de oficina**
1. Abrir widget → **"Salidas y visitas"** → **"Registrar salida o visita"**.
2. Seleccionar la categoría correspondiente (Reunión externa, Gestión bancaria, etc.).
3. Agregar detalle (opcional).
4. Confirmar.

**2. Llegar al destino**
1. Al arribar, abrir el widget.
2. Presionar **"Llegué al destino"**.

**3. Mientras realiza la gestión**
El widget muestra el nombre de la actividad activa y un campo de observaciones opcional. No es necesario registrar nada más hasta terminar.

**4. Registrar regreso a oficina**
1. Al terminar la gestión (o al salir del lugar), abrir el widget.
2. Presionar **"Registrar regreso a oficina"**.
3. Se abre el modal de cierre operacional.
4. Confirmar con **"Registrar marcación"**.

### 4.4 Cierre de viaje fuera de la oficina

Si el colaborador no puede regresar físicamente a la oficina para registrar el cierre (por ejemplo, cierra desde casa al final del día):

1. En el estado **"Regresando"**, abrir el widget → sección **"Salidas y visitas"**.
2. En la parte inferior del panel aparece **"¿Cierras el viaje fuera de la oficina?"**
3. Ingresar el motivo (opcional).
4. Presionar **"Preparar cierre fuera de oficina"**.

### 4.5 Operación que abarca varios días

Una salida operacional puede quedar abierta de un día para otro (por ejemplo, viaje con pernoctación).

- El sistema **mantiene la operación abierta** automáticamente al día siguiente.
- El widget mostrará el estado **"Operación abierta hace X días (Xh acumuladas)"**.
- Las marcas de asistencia de los días intermedios se completan automáticamente en el sistema.
- Al regresar, registrar el cierre normalmente desde el widget.

> **Si la operación supera 12 horas acumuladas**, el sistema muestra un aviso. Verificar con tu supervisor si corresponde regularizar o continuar.

---

## 5. Salida inesperada (todos los roles)

Una **salida inesperada** es cualquier ausencia temporal no planificada fuera del flujo operacional. Aplica para todos los roles.

```
Registrar salida → Llegar a destino → Salir de destino → Llegar a oficina
```

**1. Registrar la salida**
1. Abrir widget → sección **"Salidas y visitas"** (o buscar el botón **"Registrar salida inesperada"**).
2. Seleccionar el tipo:
   - **Salida por permiso personal**
   - **Salida por cita médica**
   - **Salida por reunión con proveedor**
   - **Salida inesperada** (otro motivo)
3. Describir el motivo.
4. Presionar **"Registrar salida inesperada"**.

> Si tienes un permiso aprobado para hoy, el sistema puede pre-completar el tipo y motivo automáticamente.

**2. Confirmar llegada al destino**
1. Al llegar, abrir el widget.
2. Presionar **"Llegué a destino"**.

**3. Registrar salida del destino**
1. Al terminar, abrir el widget.
2. Presionar **"Salir de destino"**.

**4. Confirmar regreso a oficina**
1. Al volver, abrir el widget.
2. Presionar **"Llegué a oficina"**.

---

## 6. Horas extra

Al marcar la **salida final**, el sistema detecta automáticamente si trabajaste más de 8 horas.

Si hay horas extra:
1. Aparece el modal **"Registrar horas extra"** con el número de horas detectadas.
2. Ingresar el motivo operativo de las horas adicionales.
3. Presionar **"Guardar horas extra"**.
4. Si no aplica o no deseas registrarlas, presionar **"Omitir"**.

---

## 7. Historial y puntualidad

El widget muestra al final del panel:

**Puntualidad**
- **Liga actual:** categoría según tu racha de puntualidad (Liga Leyenda, Liga Pro, Modo Constancia, Liga Enfocada).
- **Racha:** número consecutivo de días con entrada a tiempo.
- **Puesto:** posición comparativa respecto a tu historial.

**Historial reciente**
- Muestra los últimos 5 días con fecha, hora de entrada/salida y total de horas trabajadas.
- Los días sin entrada aparecen como *"Sin entrada"*.

---

## 8. Preguntas frecuentes

**¿Qué pasa si son las 09:20 o más y aún no marqué entrada?**
El sistema bloquea la marcación de entrada después de las 09:20. El widget muestra un aviso naranja y la siguiente acción disponible pasa a ser "Salir a almuerzo". Debes solicitar la regularización a Talento Humano usando el botón **"Solicitar regularización"** que aparece en el aviso. TH agregará tu entrada manualmente.

**¿Puedo marcar sin conexión GPS?**
Sí. La marca se registra aunque el GPS no esté disponible. El sistema intenta obtener ubicación automáticamente; si no puede, continúa sin coordenadas.

**Olvidé marcar la salida a almuerzo. ¿Qué hago?**
Marca el regreso del almuerzo cuando corresponda. Talento Humano puede regularizar los registros faltantes desde el módulo de administración.

**El widget no me muestra el botón de la siguiente acción. ¿Qué hago?**
1. Cerrar y volver a abrir el widget (el botón flotante).
2. Si persiste, recargar la página. El widget sincroniza el estado automáticamente al cargar.

**¿Puedo registrar una salida operacional si ya salí a almuerzo?**
No. El almuerzo debe estar cerrado (regreso marcado) antes de registrar una salida operacional o inesperada.

**¿Qué pasa si tengo una salida operacional abierta y quiero registrar la jornada normal?**
La jornada normal (entrada, almuerzo, salida) se registra en paralelo al estado operacional. El sistema las maneja de forma independiente. Si la operación dura varios días, las marcas de jornada se completan automáticamente.

**¿Cómo sé si mi operación de campo quedó correctamente cerrada?**
Al cerrar correctamente, el widget muestra el estado **"Jornada del día"** con todas las marcas completadas y el botón de salida operacional ya no estará activo.

**¿Qué es el F.RH y quién lo genera?**
El F.RH-09 es el formulario de registro de asistencia firmado. Lo genera exclusivamente el área de **Talento Humano** al final del período. Los colaboradores no necesitan generarlo manualmente.

---

*Última revisión: sistema v2 — módulo asistencias operacionales con auto-sincronización activada.*
