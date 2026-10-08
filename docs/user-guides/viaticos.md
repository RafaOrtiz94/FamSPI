# Guía de uso — Viáticos

> **Para quién es esta guía:** Colaboradores que solicitan viáticos, personal de Finanzas/Talento Humano que revisa y aprueba, y administradores que configuran zonas y políticas.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el ciclo completo de **solicitud, liquidación y aprobación de viáticos**. Permite a los colaboradores registrar gastos de viaje, subir facturas electrónicas del SRI, dar seguimiento al estado de la solicitud y obtener reportes para contabilidad.

Incluye:
- Configuración de **zonas** y **perfiles fijos** (valores predefinidos por destino o cargo).
- Carga de facturas electrónicas en XML, ZIP y TXT.
- Flujo de aprobación por Finanzas y Talento Humano.
- Generación de reportes y exportación **ATS-XML** compatible con el SRI.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso principal |
|---|---|
| Cualquier usuario autenticado | Ver, crear y editar sus propias solicitudes |
| `finanzas`, `financiero`, `jefe_financiero`, `jefe_finanzas` | Revisar, aprobar y generar reportes |
| `talento_humano`, `jefe_talento_humano` | Aprobar segmentos específicos |
| `admin`, `administrador`, `gerencia_general` | Configuración de zonas, perfiles y políticas |

> Los revisores financieros tienen acceso restringido a endpoints sensibles (estados, reportes, ATS-XML).

---

## Pantalla principal

Accede desde **"Finanzas" → "Viáticos"** (`/dashboard/finanzas/viaticos`) o desde el perfil del colaborador.

---

## Flujo principal — Crear una solicitud de viáticos

### Paso 1 — Acceder al workspace de Viáticos

Ve a la ruta de Viáticos en el menú.

### Paso 2 — Completar la solicitud

Registra:
- Motivo del viaje.
- Fechas de ida y vuelta.
- Destino.
- Detalle de gastos previstos o reales.
- Documentos de respaldo.

### Paso 3 — Guardar

La solicitud queda en estado inicial (generalmente borrador o pendiente).

---

## Flujo principal — Subir facturas electrónicas

### Paso 1 — Abrir la solicitud

Selecciona la solicitud a la que cargarás comprobantes.

### Paso 2 — Cargar documentos

Puedes subir facturas en varios formatos:
- **XML**: factura electrónica completa del SRI.
- **ZIP**: paquete de facturas.
- **TXT**: texto plano con datos de facturación.

### Paso 3 — Previsualizar (opcional)

Antes de guardar, puedes previsualizar el contenido del TXT para confirmar que los datos son correctos.

---

## Flujo principal — Enviar a revisión

### Paso 1 — Revisar la solicitud

Asegúrate de que todas las facturas estén adjuntas y los montos sean correctos.

### Paso 2 — Enviar

Toca **"Enviar a revisión"** o el equivalente. El sistema notifica a Finanzas para que revise la solicitud.

---

## Flujo principal — Revisar y aprobar (Finanzas)

### Paso 1 — Ver las solicitudes pendientes

Finanzas ve las solicitudes enviadas por los colaboradores.

### Paso 2 — Revisar facturas

- Consulta cada factura cargada.
- Verifica los montos, fechas y destinatarios.
- Ajusta el estado de las facturas individuales si es necesario.

### Paso 3 — Aprobar o rechazar la liquidación

Cambia el estado general de la solicitud:
- Aprobada: los montos se confirman.
- Rechazada: con observaciones para que el solicitante corrija.

### Paso 4 — Aprobar segmentos (si aplica)

Talento Humano puede aprobar segmentos específicos de la solicitud.

---

## Flujo principal — Generar reportes y exportar

### Paso 1 — Acceder a reportes (solo Finanzas)

Finanzas puede generar:
- Resumen consolidado de viáticos.
- Reporte individual por viaje.

### Paso 2 — Exportar ATS-XML

Genera el archivo **ATS-XML** compatible con el SRI para declaraciones o envío a entidades regulatorias.

---

## Flujo principal — Configurar zonas, perfiles y políticas (Admin)

### Paso 1 — Acceder a la configuración

Los roles autorizados pueden acceder a la configuración.

### Paso 2 — Definir zonas

Crea zonas geográficas con valores de viático predefinidos por día.

### Paso 3 — Definir perfiles fijos

Asigna montos fijos por cargo o perfil del colaborador.

### Paso 4 — Actualizar la política

Modifica las reglas generales de viáticos (topes, porcentajes, categorías permitidas, etc.).

---

## Flujo principal — Sincronizar con el SRI

### Paso 1 — Iniciar sincronización

### Paso 2 — Verificar resultados

El sistema consulta la información de facturas en el SRI y la compara con los comprobantes cargados. Valida que las facturas existan y estén autorizadas.

---

## Preguntas frecuentes

**[Subí una factura y el sistema no la reconoce]**

Verifica que el XML esté correctamente firmado por el SRI. Si es un TXT, revisa que el formato coincida con el esperado por el sistema. Usa la previsualización para confirmar los datos.

**[La solicitud está rechazada pero no sé por qué]**

Revisa los comentarios de Finanzas en el estado del rechazo. Generalmente se solicita corregir el monto, agregar facturas faltantes o ajustar las fechas.

**[Puedo editar una solicitud ya enviada]**

Si el sistema lo permite, envía una solicitud de modificación. Si fue aprobada, deberás crear una solicitud de ajuste o contactar a Finanzas.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una solicitud de viáticos | Ve a Viáticos → completa los datos del viaje |
| Subir facturas del SRI | Abre la solicitud → carga XML, ZIP o TXT |
| Enviar a revisión | Toca "Enviar a revisión" |
| Revisar facturas (Finanzas) | Abre la solicitud pendiente → valida cada factura |
| Aprobar o rechazar | Cambia el estado de la liquidación |
| Generar reporte | Accede a reportes desde Finanzas |
| Exportar ATS-XML | Usa la opción de exportación |
| Configurar zonas o perfiles | Accede a configuración (roles autorizados) |
