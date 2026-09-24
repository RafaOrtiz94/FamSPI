# Guía de uso — Auditoría (Admin y Preparación)

> **Para quién es esta guía:** TI, Gerencia, Talento Humano, Calidad, Finanzas, Comercial, Operaciones y jefes que consulta logs del sistema o prepara la empresa para auditorías externas.

---

## ¿Para qué sirven estos submódulos?

El sistema cuenta con dos submódulos bajo la rama de Auditoría:

1. **Auditoría (logs)**: consulta de registros de auditoría del sistema.
2. **Preparación de Auditoría (audit-prep)**: gestión del proceso previo a una auditoría externa GXP/ISO.

---

## 1) Auditoría — Logs del sistema

### ¿Para qué sirve?

Permite consultar **todos los eventos registrados** por los módulos del sistema:
- Quién hizo la acción.
- Cuándo la hizo.
- En qué módulo y sobre qué recurso.

Sirve para trazabilidad, cumplimiento, investigación de incidentes y respuesta a requerimientos normativos.

### ¿Quién puede usarlo?

| Rol | Acceso |
|---|---|
| `ti` | Ver lista, detalle y exportar CSV |
| `gerencia` | Ver lista, detalle y exportar CSV |
| `talento_humano` | Ver lista y detalle (no exportar) |

### Flujo principal — Consultar logs

1. Accede al panel de Auditoría.
2. Usa filtros para buscar eventos por usuario, módulo, fecha o acción.
3. Abre el detalle de un evento para ver la trazabilidad completa.
4. Exporta a CSV para análisis externo (solo TI y Gerencia).

---

## 2) Preparación de Auditoría (audit-prep)

### ¿Para qué sirve?

Gestiona el proceso de **preparación para auditorías externas (GXP/ISO)**. Ayuda a organizar la documentación, checklists y accesos temporales para los auditores.

Funcionalidades:
- **Feature flag** para activar/desactivar el modo de preparación.
- **Checklist** configurable por secciones.
- **Documentos requeridos** por sección.
- **Accesos externos temporales** para auditores externos.

### ¿Quién puede usarlo?

| Rol | Acceso |
|---|---|
| `ti`, `jefe_ti` | Configurar todo: status, secciones, accesos externos |
| Cualquier usuario autenticado | Ver checklist y documentos del checklist |

### Flujo principal — Preparar una auditoría externa

1. **Activar el modo de preparación** (`PUT /status`).
2. **Definir las secciones** del checklist que se evaluarán.
3. **Subir los documentos** requeridos por cada sección.
4. **Actualizar el estado** de cada documento (pendiente, listo, observado).
5. **Otorgar accesos temporales** a los auditores externos.
6. **Cerrar el proceso** al finalizar la auditoría: revocar accesos externos y desactivar el modo.

### Flujo principal — Acceder a documentos

- Listar documentos disponibles para la auditoría.
- Subir un documento a una sección.
- Actualizar el estado del documento.
- Descargar el documento.

---

## Accesos externos temporales

- Se otorgan a personas externas a la empresa para que revisen información específica.
- Tienen fecha de vencimiento y alcance limitado.
- Deben ser revocados al finalizar la auditoría.

---

## Pantalla principal

Ruta: `/dashboard/auditoria/preparacion` → `AuditPrepPage`.

Roles visibles: `admin_ti`, `jefe_ti`, `ti`, `gerencia`, `calidad`, `finanzas`, `comercial`, `talento_humano`, `operaciones`, `jefe_calidad`.

---

## Preguntas frecuentes

**[No veo la opción de exportar logs]**

Solo `ti` y `gerencia` pueden exportar a CSV. Si necesitas el reporte y no tienes ese rol, solicita el acceso a TI.

**[El modo de preparación no se activa]**

Verifica que tengas el rol `admin_ti` o `jefe_ti`. Solo esos roles pueden cambiar el estado global.

**[Un documento no aparece en la lista]**

Verifica que lo hayas subido a la sección correcta y que el estado no esté filtrado en tu vista.
