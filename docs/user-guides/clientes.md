# Guía de uso — Clientes

> **Para quién es esta guía:** Personal comercial, backoffice comercial, jefes de comercial y gerencia que gestiona la relación con clientes y prospectos.

---

## ¿Para qué sirve este módulo?

Este módulo es el CRM (Customer Relationship Management) de la empresa. Permite llevar un registro completo de cada cliente: datos generales, ubicaciones o sucursales, historial de interacciones (llamadas, visitas, reuniones), ejecutivo de cuenta asignado y documentos legales actualizados.

Además, sincroniza información con Odoo (el ERP de la empresa) para mantener ambos sistemas alineados.

---

## ¿Quién puede usarlo?

| Rol o perfil | ¿Qué puede hacer? |
|---|---|
| Cualquier usuario autenticado | Ver lista de clientes y detalle básico |
| Comercial / ACP comercial | Registrar visitas de prospección, registrar interacciones, editar clientes |
| Backoffice comercial | Registrar interacciones, editar clientes, agregar ubicaciones |
| Jefe comercial | Todo lo anterior + asignar ejecutivo de cuenta |
| Gerencia | Todo lo anterior + asignar ejecutivo de cuenta |
| Admin / administrador | Acceso completo |
| TI | Acceso completo |

---

## Pantalla principal

La pantalla principal muestra una **lista de clientes** con su información resumida.

Puedes acceder desde:

- **"Clientes"** dentro del área Comercial.
- **"Clientes compartido"** desde cualquier área.

### ¿Qué contiene cada cliente?

| Campo | Descripción |
|---|---|
| Razón social / Nombre | Nombre legal del cliente |
| RUC / Identificación | Número de documento fiscal |
| Ejecutivo asignado | Persona del equipo comercial responsable |
| Estado | Activo o inactivo |
| Sucursales | Cantidad de ubicaciones registradas |

---

## Flujo principal — Buscar un cliente

### Paso 1 — Ingresar a la lista de clientes

Ve a **"Clientes"** en el menú principal.

### Paso 2 — Usar el buscador

Escribe el nombre del cliente, su RUC o cualquier palabra clave en el campo de búsqueda. La lista se filtra automáticamente.

### Paso 3 — Tocar el cliente

Selecciona el cliente para ver su **página de detalle**.

---

## Flujo principal — Ver el detalle de un cliente

### Paso 1 — Abrir el cliente

Toca el nombre del cliente en la lista.

### Paso 2 — Explorar las secciones

En la página de detalle verás:

- **Datos generales**: razón social, identificación, teléfono, correo, dirección principal.
- **Ubicaciones / sucursales**: todas las direcciones donde opera el cliente.
- **Historial de interacciones**: visitas, llamadas, correos y reuniones registradas.
- **Documentos legales**: RUC, permiso de operación, certificaciones, etc.
- **Ejecutivo asignado**: quién es el responsable comercial.

---

## Flujo principal — Registrar una visita o interacción

Cada vez que hablas con un cliente, registra la interacción para dejar trazabilidad.

### Paso 1 — Abrir el cliente

Ve al detalle del cliente.

### Paso 2 — Tocar "Registrar interacción" o "Nueva visita"

En la sección de interacciones, busca el botón **"+"** o **"Nueva visita"**.

### Paso 3 — Completar la información

Según el tipo de interacción, registra:

- **Fecha y hora** del encuentro.
- **Tipo**: llamada, visita presencial, reunión, correo, etc.
- **Participantes**: quiénes estuvieron presentes.
- **Temas tratados**: puntos clave de la conversación.
- **Próximos pasos**: acuerdos o compromisos.

### Paso 4 — Guardar

Toca **"Guardar"**. La interacción queda registrada en el historial del cliente.

---

## Flujo principal — Agregar una sucursal o ubicación

### Paso 1 — Ir a "Ubicaciones" del cliente

En la página de detalle, busca la sección **"Ubicaciones"**.

### Paso 2 — Tocar "Agregar ubicación"

Completa los datos de la nueva sucursal:

- Nombre de la sucursal.
- Dirección completa.
- Ciudad / zona.
- Teléfono de contacto (si es distinto).
- Persona de contacto en esa ubicación.

### Paso 3 — Guardar

Toca **"Guardar"**. La nueva ubicación queda asociada al cliente.

---

## Flujo principal — Asignar un ejecutivo de cuenta

### Paso 1 — Abrir el cliente

Ve al detalle del cliente.

### Paso 2 — Tocar "Asignar ejecutivo"

Busca la opción **"Asignar"** o **"Cambiar ejecutivo"**.

### Paso 3 — Seleccionar al comercial

Elige de la lista el nombre del comercial que tomará la cuenta.

### Paso 4 — Confirmar

Toca **"Asignar"**. El sistema notifica al nuevo ejecutivo (si aplica).

---

## Flujo principal — Actualizar documentos legales del cliente

### Paso 1 — Ir a "Documentos" del cliente

En la página de detalle, busca la sección de archivos adjuntos.

### Paso 2 — Subir o reemplazar documentos

Puedes actualizar:

- RUC o identificación fiscal.
- Nombramiento del representante legal.
- Certificación BPA/DT.
- Permiso de operación.
- Consentimiento de datos personales.

Toca **"Subir archivo"** o **"Reemplazar"** según corresponda.

### Paso 3 — Guardar

Los documentos quedan asociados al cliente y están disponibles para consulta.

---

## Flujo principal — Registrar una visita de prospección

Si aún no es cliente pero tuviste una visita para presentar la empresa:

### Paso 1 — Tocar "Registrar visita de prospección" (acceso público o autenticado)

Según el rol, esta opción puede estar disponible directamente en el listado de clientes.

### Paso 2 — Completar datos del prospecto

Registra:

- Nombre del prospecto o empresa.
- Datos de contacto.
- Resultado de la visita (interesado, no interesado, en evaluación).
- Próximos pasos acordados.

---

## Preguntas frecuentes

**[No veo un cliente en la lista]**

Asegúrate de no tener un filtro activo (por estado o fecha). Busca por nombre o RUC. Si no aparece, puede estar en estado inactivo; cambia el filtro a "Todos".

**[El cliente aparece desactualizado]**

Verifica si tienes la última versión de sus datos. Si es un dato que cambió recientemente, actualízalo manualmente desde su detalle.

**[Puedo registrar una interacción por otro compañero]**

Sí, puedes registrar interacciones de cualquier ejecutivo. Asegúrate de indicar quién participó para que el registro sea fiel.

**[La sincronización con Odoo no se realizó]**

Odoo se sincroniza según la configuración del sistema. Si notas diferencias, contacta a TI para revisar el estado de la integración.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Buscar un cliente | Va a "Clientes" y escribe en el buscador |
| Ver detalle y historial | Toca el cliente en la lista |
| Registrar una llamada o visita | Dentro del cliente → "Registrar interacción" |
| Agregar una sucursal | Dentro del cliente → "Ubicaciones" → "Agregar" |
| Asignar un ejecutivo | Dentro del cliente → "Asignar ejecutivo" |
| Actualizar documentos legales | Dentro del cliente → "Documentos" → subir archivo |
