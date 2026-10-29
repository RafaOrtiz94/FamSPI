# Revisión de roles y permisos — TI

Generado el 2026-10-08. Para: jefe de TI. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| jefe_ti | 1 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: ti, jefe_de_ti, desarrollador, soporte, admin_ti.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | jefe_ti | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|
| attendance | V C | solo este equipo | ☐ Sin cambio ☐ Cambiar: |
| audit-prep | V C E B | solo este equipo | ☐ Sin cambio ☐ Cambiar: |
| auditoria (Auditoria y Trazabilidad) | V | Gerencia, Talento Humano | ☐ Sin cambio ☐ Cambiar: |
| auth | V | Gerencia | ☐ Sin cambio ☐ Cambiar: |
| business-case (Backoffice Comercial, Business Case…) | V C E B | Servicio Técnico, Gerencia, Operaciones, Logística, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| calculation-templates (Operaciones) | V | Servicio Técnico, Gerencia, Operaciones, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| clients | V C | Operaciones, Comercial, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| collab-deliveries (Entregas Colaboradores, Resumen Entregas Colaboradores…) | V | Talento Humano, Servicio Técnico, Finanzas, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| crm-fam (Comercial Planificacion, CRM Fam) | V C E B | Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| departments (Talento Departamentos, Talento Gestion…) | V C E B | Talento Humano, Gerencia, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| determinations-catalog (Operaciones) | V | Servicio Técnico, Gerencia, Comercial, Operaciones, Logística, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| equipment-catalog (Business Case, Comercial (General)…) | V C E | Operaciones, Servicio Técnico, Logística, Finanzas, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-management (Business Case, Comercial (General)…) | V C E B | Servicio Técnico, Operaciones, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| integrations | V C E | Servicio Técnico, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| inventario (Backoffice Comercial, Business Case…) | V C E | Servicio Técnico, Operaciones, Logística, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| kickoff | V C E B | solo este equipo | ☐ Sin cambio ☐ Cambiar: |
| mantenimientos (Inicio, Operaciones…) | V C | Servicio Técnico, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| offboarding (Talento Colaboradores, Talento Centro de Comando…) | V C E | Talento Humano, Finanzas, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V | Gerencia, Comercial, Calidad, Servicio Técnico, Finanzas, Talento Humano, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| security | V C | solo este equipo | ☐ Sin cambio ☐ Cambiar: |
| servicio (Inicio, Servicio Aplicaciones…) | V C | Servicio Técnico, Gerencia, Comercial, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| suggestion-box (Inicio) | V C | Talento Humano, Gerencia, Calidad | ☐ Sin cambio ☐ Cambiar: |
| support-tickets (TI Reportes y KPIs, TI Workspace) | V C E B | Servicio Técnico | ☐ Sin cambio ☐ Cambiar: |
| ti-assets (Business Case, Entregas Colaboradores…) | V C E B | Gerencia, Finanzas, Comercial, Pasantes | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | Talento Humano, Servicio Técnico, Operaciones, Gerencia, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| users (Backoffice Comercial, Entregas Colaboradores…) | V C E B | Talento Humano, Servicio Técnico, Operaciones, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| viaticos (Finanzas Viaticos) | V C E B | Talento Humano, Servicio Técnico, Operaciones, Usuarios externos, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **clients**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collab-deliveries**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **crm-fam**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **determinations-catalog**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-catalog**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **inventario**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **mantenimientos**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **requests**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **ti-assets**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **users**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **viaticos**: 6 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 

## Lo que falta o sobra

1. ¿Hay algo que tu equipo **debería poder hacer y hoy no puede**?

   Respuesta: 

2. ¿Hay algo que tu equipo **puede hacer hoy y no debería**?

   Respuesta: 

3. ¿Algún rol de tu equipo debería tener permisos distintos al resto del equipo?

   Respuesta: 

## Aprobación

Nombre y fecha: 
