# Guía de uso — Oportunidades (FamSheets)

> **Para quién es esta guía:** Comercial, asesor comercial, analista comercial, ACP comercial, gerencia y roles comerciales que gestiona oportunidades de negocio y seguimiento de cuentas prospecto.

---

## ¿Para qué sirve este módulo?

Este módulo, conocido también como **FamSheets**, gestiona las **oportunidades comerciales estratégicas** de la empresa. Va más allá de un simple CRM: permite construir una ficha completa por oportunidad que incluye:

- **Cuenta prospecto**: cliente potencial o existente.
- **Contactos**: personas vinculadas a la cuenta.
- **Influencias compradoras**: actores internos del cliente que influyen en la decisión.
- **Banderas rojas**: riesgos o alertas de la oportunidad.
- **Competidores**: actores del mercado contra los que se compite.
- **Plan de acción**: pasos a seguir para cerrar la oportunidad.
- **Comentarios de coaching**: seguimiento interno del equipo comercial.
- **Vínculos opcionales**: puede ligarse a un Business Case, una compra privada o una compra pública en curso.

El objetivo es darle a Comercial una herramienta estructurada para convertir leads y gestionar la estrategia de cada cuenta.

---

## ¿Quién puede usarlo?

| Rol o perfil | Acceso principal |
|---|---|
| `comercial`, `asesor_comercial`, `analista_comercial`, `acp_comercial` | CRUD sobre FamSheets |
| `backoffice`, `backoffice_comercial` | Lectura y apoyo |
| `jefe_comercial`, `jefe_de_comercial`, `gerencia`, `gerencia_general` | Visión agregada y control |

---

## Pantalla principal

Rutas asociadas:
- `/dashboard/comercial/famsheets` → listado de hojas de oportunidad.
- `/dashboard/comercial/famsheets/dashboard` → agregados comerciales.
- `/dashboard/comercial/famsheets/:id` → detalle del FamSheet.

---

## Flujo principal — Crear una oportunidad (FamSheet)

### Paso 1 — Acceder al workspace de FamSheets

Ve a la sección de FamSheets desde el área Comercial.

### Paso 2 — Crear una nueva hoja

Completa los datos generales:
- Nombre de la oportunidad.
- Cuenta prospecto.
- Contacto principal.
- Valor estimado.
- Probabilidad de cierre.
- Fecha estimada de cierre.

---

## Flujo principal — Registrar influencias compradoras

### Paso 1 — Acceder a "Influencias"

Dentro del detalle del FamSheet.

### Paso 2 — Crear o actualizar influencia

Registra a las personas del cliente que toman o influyen en la decisión:
- Nombre del influenciador.
- Rol en la organización del cliente.
- Nivel de influencia.
- Postura (favorable, neutral, adversa).

Esto ayuda al equipo comercial a definir la estrategia de acercamiento.

---

## Flujo principal — Marcar banderas rojas

### Paso 1 — Acceder a "Banderas"

### Paso 2 — Registrar el riesgo

Crea alertas como:
- Competidor favorito ya definido.
- Presupuesto no confirmado.
- Cliente con historial de incumplimientos.
- Requisitos técnicos no alineados con el equipo.

---

## Flujo principal — Registrar competidores

### Paso 1 — Acceder a "Competidores"

### Paso 2 — Cargar información

- Nombre del competidor.
- Ventajas percibidas.
- Desventajas.
- Estrategia de diferenciación.

---

## Flujo principal — Definir el plan de acción

### Paso 1 — Acceder a "Acciones"

### Paso 2 — Registrar pasos

Crea ítems accionables:
- Acción a realizar.
- Responsable.
- Fecha objetivo.
- Estado.

---

## Flujo principal — Vincular a proceso interno (opcional)

### Paso 1 — Acceder a "Vínculos"

### Paso 2 — Elegir el proceso

Puedes ligar el FamSheet a:
- Un **Business Case** existente.
- Una **Compra Privada**.
- Una **Compra de Equipos**.

Esto habilita la trazabilidad desde la oportunidad comercial hasta la operación.

---

## Flujo principal — Ver métricas del dashboard

El dashboard de FamSheets muestra agregados:
- Cantidad de FamSheets activos por estado o etapa.
- Oportunidades por responsable.
- Valor total en cartera.

---

## Preguntas frecuentes

**[Puedo crear un FamSheet sin cuenta prospecto]**

El formulario puede permitir crear la cuenta en el momento (creación rápida), pero normalmente una oportunidad debe asociarse a una cuenta para mantener trazabilidad.

**[Qué diferencia hay entre FamSheets y Business Case]**

FamSheets es la **oportunidad comercial** (la gestión del prospecto y la estrategia de venta). El Business Case es el **análisis de viabilidad económica** para una propuesta concreta. Van en etapas distintas del flujo comercial.

**[No veo la opción de vincular a un proceso]**

El vínculo es opcional y puede estar deshabilitado hasta que el proceso interno (BC, compra) exista y esté en un estado que permita la vinculación.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Crear una oportunidad | Ve a FamSheets → Nueva hoja |
| Registrar actores del cliente | Agrega influencias compradoras |
| Marcar riesgos | Registra banderas rojas |
| Definir la estrategia | Completa competidores y plan de acción |
| Vincular a un proyecto | Asocia a BC, compra privada o pública |
| Ver la cartera comercial | Consulta el dashboard FamSheets |
