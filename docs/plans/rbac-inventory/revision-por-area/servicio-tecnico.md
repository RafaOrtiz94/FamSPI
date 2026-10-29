# Revisión de roles y permisos — Servicio Técnico

Generado el 2026-10-08. Para: jefe de Servicio Técnico. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| ing_servicio | 4 |
| jefe_servicio | 1 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: servicio_tecnico, tecnico, esp_app, responsable_tecnico, jefe_servicio_tecnico, jefe_de_servicio_tecnico, jefe_tecnico, jefe_de_tecnico.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | ing_servicio | jefe_servicio | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|---|
| approvals (Servicio Solicitudes) | V | V C | Gerencia, Calidad | ☐ Sin cambio ☐ Cambiar: |
| business-case (Backoffice Comercial, Business Case…) | V C E B | V C E B | Gerencia, Operaciones, TI, Logística, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| calculation-templates (Operaciones) | V | V C E B | Gerencia, Operaciones, TI, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| calidad (Calidad) | V C | V C | Gerencia, Calidad, Talento Humano, Operaciones, Comercial | ☐ Sin cambio ☐ Cambiar: |
| collab-deliveries (Entregas Colaboradores, Resumen Entregas Colaboradores…) | – | V C E | Talento Humano, Finanzas, TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| delivery-ceilings (Comercial Maximos y Saldos) | V | V | Operaciones, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-requests (Comercial Maximos y Saldos) | V | V | Operaciones, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| determinations-catalog (Operaciones) | V | V C E B | Gerencia, Comercial, Operaciones, TI, Logística, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| documents (Comercial Solicitudes) | C | C | Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-catalog (Business Case, Comercial (General)…) | V C E | V C E | Operaciones, TI, Logística, Finanzas, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-management (Business Case, Comercial (General)…) | V C E B | V C E B | TI, Operaciones, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-purchases (Backoffice Comercial, Business Case…) | V C E | V C E | Comercial, Gerencia, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| famsheets (Comercial (General)) | V | V | Gerencia, Comercial, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| files (Business Case, Comercial (General)…) | V C | V C | Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| integrations | V | V C E | TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| inventario (Backoffice Comercial, Business Case…) | V C E | V C E | TI, Operaciones, Logística, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| mantenimientos (Inicio, Operaciones…) | V C | V C | Logística, Gerencia, Comercial, TI | ☐ Sin cambio ☐ Cambiar: |
| opportunities | V | V | Gerencia, Comercial, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| personnel-requests (Comercial Solicitudes, Servicio Solicitudes…) | – | C | Talento Humano, Gerencia, Operaciones, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| private-purchases (Backoffice Comercial, Business Case…) | V C E | V C E | Comercial, Gerencia, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V | V C | TI, Gerencia, Comercial, Calidad, Finanzas, Talento Humano, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| servicio (Inicio, Servicio Aplicaciones…) | V C E B | V C E B | Gerencia, Comercial, TI, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| support-tickets (TI Reportes y KPIs, TI Workspace) | V E | V E | TI | ☐ Sin cambio ☐ Cambiar: |
| technical-applications (Servicio Aplicaciones) | V | V | Gerencia | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | C E B | TI, Talento Humano, Operaciones, Gerencia, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| users (Backoffice Comercial, Entregas Colaboradores…) | – | V | TI, Talento Humano, Operaciones, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| viaticos (Finanzas Viaticos) | V C E B | V C E B | TI, Talento Humano, Operaciones, Usuarios externos, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **calidad**: 7 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collab-deliveries**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **delivery-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **determinations-catalog**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-catalog**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **inventario**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **mantenimientos**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **personnel-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **private-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **requests**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
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
