# Guía de uso — Activos de TI (TI Assets)

> **Para quién es esta guía:** TI, jefes de TI, servicio técnico y gerencia que gestiona activos tecnológicos (hardware, software, licencias) asignados a usuarios o áreas.

---

## ¿Para qué sirve este módulo?

Este módulo gestiona el inventario de **activos de tecnología** de la empresa: equipos informáticos, periféricos, licencias de software y otros recursos tecnológicos asignados a colaboradores.

Permite:
- Registrar activos (marca, modelo, serial, estado).
- Asignar activos a usuarios.
- Dar seguimiento al ciclo de vida del activo.
- Gestionar devoluciones y transferencias entre usuarios.

---

## Estado

No se confirmó CONTEXT.md ni endpoints públicos detallados en el listado inicial de módulos. La existencia de la carpeta `backend/src/modules/ti-assets/` indica que el módulo existe, pero se recomienda revisar el código backend directo para acceder a sus rutas, roles y flujos antes de operar.

Si necesitas urgencia:
- Revisa `backend/src/modules/ti-assets/`.
- Consulta `registerRoutes.js` para confirmar el prefijo.
- Contacta a TI para la ruta operativa.

---

## Pantalla principal

No confirmada. Es probable que se acceda desde el área de **TI** o desde un panel de administración de activos.

---

## Flujos esperados

1. Alta de activo tecnológico.
2. Asignación a colaborador.
3. Transferencia o reasignación.
4. Devolución / baja.
5. Reporte de activos por usuario o área.

---

## Resumen rápido

| Si necesitas... | Haz esto |
|---|---|
| Registrar un activo nuevo | Ingresa al módulo TI Assets / Administración TI |
| Asignar equipo a usuario | Crea la asignación con usuario y activo |
| Devolver un equipo | Genera la devolución desde el detalle del activo |
| Consultar inventario de TI | Filtra por usuario, área o estado |
