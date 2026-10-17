# Guía de uso — Control de Plagas (CA-01-04)

> **Para quién es esta guía:** Personal de Calidad y servicio técnico que gestiona el control de plagas en las instalaciones.

---

## ¿Para qué sirve este submódulo?

Este submódulo está diseñado para registrar y dar seguimiento a las actividades de **control de plagas** en las instalaciones de la empresa: inspecciones, tratamientos realizados, productos utilizados, resultados y acciones correctivas.

Su objetivo es mantener las instalaciones libres de infestaciones y cumplir con normativas de Buenas Prácticas (GXP) e higiene industrial.

---

## Estado actual del submódulo

> **Importante:** El backend de este submódulo (`ca0104.routes.js`) existe en el código, pero **no está registrado en las rutas generales del sistema** (`registerRoutes.js`). Esto significa que el frontend está disponible en la ruta `/dashboard/calidad/plagas`, pero el flujo completo puede no estar operativo. Si necesitas usar este submódulo, contacta a TI para verificar su estado de despliegue.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Calidad | Acceso completo (una vez operativo) |
| Servicio técnico | Registrar inspecciones y tratamientos |
| Gerencia | Consultar reportes |

> Mientras el backend no esté registrado, ninguna acción estará disponible.

---

## Pantalla principal

Si accedes a la ruta `/dashboard/calidad/plagas`, verás la interfaz del workspace de Control de Plagas. La pantalla sigue el patrón visual del resto de los submódulos de Calidad:
- Encabezado con título **"CA-01-04 | Control de Plagas"**.
- Panel de estado del sistema.
- Lista de eventos o inspecciones registradas.
- Formularios de registro (cuando el backend esté activo).

---

## Flujo principal (diseñado, pendiente de activación)

Cuando el submódulo esté completamente operativo, se espera el siguiente flujo:

### Paso 1 — Inspeccionar áreas

El operador o servicio técnico recorre las áreas críticas (almacén, sala de producción, áreas de empaque, etc.) y registra:

- Área inspeccionada.
- Fecha y hora.
- Tipo de plaga detectada (si aplica): insectos, roedores, microorganismos, etc.
- Nivel de infestación: nulo, bajo, medio, alto.
- Observaciones.

### Paso 2 — Registrar el tratamiento

Si se detectó plaga, se registra el tratamiento aplicado:

- Producto utilizado (nombre, lote, dosis).
- Método de aplicación (fumigación, cebos, trampas, etc.).
- Personal que ejecutó el tratamiento.
- Equipos de protección utilizados.

### Paso 3 — Seguimiento y verificación

Calidad verifica la efectividad del tratamiento:
- Revisa las áreas tratadas en un plazo determinado (por ejemplo, 7 días después).
- Registra si la plaga fue erradicada o persiste.
- Si persiste, escala el caso a un proveedor especializado o a un plan de corrective action (CAPA).

### Paso 4 — Cierre del registro

Una vez erradicada la plaga y verificada la eficacia del tratamiento, Calidad cierra el registro con notas de cierre.

---

## Preguntas frecuentes

**[No veo datos en el módulo de plagas]**

Es posible que el backend no esté registrado en las rutas generales del sistema aún. Consulta a TI para confirmar el estado de este submódulo.

**[Puedo registrar una inspección pero no se guarda]**

Si la pantalla carga pero las acciones no responden, el backend probablemente no está activo. Contacta a soporte.

**[El módulo aparece en el dashboard de Calidad pero no funciona]**

Esto se debe a que el frontend está integrado en el dashboard, pero el servicio backend no está montado. Es un caso conocido y documentado en el sistema.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Acceder al submódulo | Ve a "Calidad" → "Control de Plagas" (ruta: `/dashboard/calidad/plagas`) |
| Registrar una inspección | Completa el formulario de inspección (cuando el backend esté activo) |
| Registrar un tratamiento | Completa los datos del producto y método aplicado |
| Verificar efectividad | Consulta el seguimiento post-tratamiento |
| Cerrar el caso | Cambia el estado a "Cerrado" desde Calidad |
