# Revisión de roles y permisos — Gerencia

Generado el 2026-10-08. Para: jefe de Gerencia. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| gerencia_general | 1 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: gerencia, gerente_general, director, gerente.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | gerencia_general | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|
| api | C | Talento Humano | ☐ Sin cambio ☐ Cambiar: |
| approvals (Servicio Solicitudes) | V | Servicio Técnico, Calidad | ☐ Sin cambio ☐ Cambiar: |
| auditoria (Auditoria y Trazabilidad) | V | TI, Talento Humano | ☐ Sin cambio ☐ Cambiar: |
| auth | V | TI | ☐ Sin cambio ☐ Cambiar: |
| bc-availability (Business Case, Comercial (General)…) | V | Comercial | ☐ Sin cambio ☐ Cambiar: |
| business-case (Backoffice Comercial, Business Case…) | V C E B | Servicio Técnico, Operaciones, TI, Logística, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| calculation-templates (Operaciones) | V C E B | Servicio Técnico, Operaciones, TI, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| calidad (Calidad) | V C E | Calidad, Talento Humano, Servicio Técnico, Operaciones, Comercial | ☐ Sin cambio ☐ Cambiar: |
| clients | V C | Operaciones, Comercial, TI | ☐ Sin cambio ☐ Cambiar: |
| collab-deliveries (Entregas Colaboradores, Resumen Entregas Colaboradores…) | V | Talento Humano, Servicio Técnico, Finanzas, TI | ☐ Sin cambio ☐ Cambiar: |
| collaborators (Calidad, Gerencia…) | V C E | Talento Humano, Calidad, Comercial | ☐ Sin cambio ☐ Cambiar: |
| consumable-files (Business Case, Comercial (General)…) | V C E B | Operaciones, Logística, Comercial | ☐ Sin cambio ☐ Cambiar: |
| crm-fam (Comercial Planificacion, CRM Fam) | V C E B | Comercial, TI | ☐ Sin cambio ☐ Cambiar: |
| dashboard (Backoffice Comercial, Business Case…) | V | Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-ceilings (Comercial Maximos y Saldos) | V | Servicio Técnico, Operaciones, Logística, Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-requests (Comercial Maximos y Saldos) | V C | Servicio Técnico, Operaciones, Logística, Comercial | ☐ Sin cambio ☐ Cambiar: |
| departments (Talento Departamentos, Talento Gestion…) | V C E B | TI, Talento Humano, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| determinations-catalog (Operaciones) | V C E B | Servicio Técnico, Comercial, Operaciones, TI, Logística, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| documents (Comercial Solicitudes) | C | Servicio Técnico, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-catalog (Business Case, Comercial (General)…) | V C E | Operaciones, TI, Servicio Técnico, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-management (Business Case, Comercial (General)…) | V C E B | TI, Servicio Técnico, Operaciones, Logística, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-purchases (Backoffice Comercial, Business Case…) | V C E | Comercial, Servicio Técnico, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| famsheets (Comercial (General)) | V C E B | Comercial, Servicio Técnico, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| files (Business Case, Comercial (General)…) | V C B | Servicio Técnico, Comercial | ☐ Sin cambio ☐ Cambiar: |
| finanzas | V C | Finanzas | ☐ Sin cambio ☐ Cambiar: |
| hiring-pipeline (Talento Colaboradores, Talento Centro de Comando…) | V C E | Talento Humano | ☐ Sin cambio ☐ Cambiar: |
| integrations | V C E | TI, Servicio Técnico | ☐ Sin cambio ☐ Cambiar: |
| inventario (Backoffice Comercial, Business Case…) | V C E | TI, Servicio Técnico, Operaciones, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| mantenimientos (Inicio, Operaciones…) | V C | Servicio Técnico, Logística, Comercial, TI | ☐ Sin cambio ☐ Cambiar: |
| offboarding (Talento Colaboradores, Talento Centro de Comando…) | V C E | Talento Humano, TI, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| opportunities | V C E B | Comercial, Servicio Técnico, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| personnel-requests (Comercial Solicitudes, Servicio Solicitudes…) | V C E | Talento Humano, Servicio Técnico, Operaciones, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| private-purchases (Backoffice Comercial, Business Case…) | V C E | Comercial, Servicio Técnico, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| public-delivery-plans | V C | Operaciones, Comercial | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V | TI, Comercial, Calidad, Servicio Técnico, Finanzas, Talento Humano, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| schedules (Comercial Aprobacion de Planes, Comercial Planificacion) | V C | Comercial | ☐ Sin cambio ☐ Cambiar: |
| servicio (Inicio, Servicio Aplicaciones…) | V C E B | Servicio Técnico, Comercial, TI, Operaciones, Logística | ☐ Sin cambio ☐ Cambiar: |
| suggestion-box (Inicio) | V C | TI, Talento Humano, Calidad | ☐ Sin cambio ☐ Cambiar: |
| talento-humano | V C E | Talento Humano | ☐ Sin cambio ☐ Cambiar: |
| technical-applications (Servicio Aplicaciones) | V | Servicio Técnico | ☐ Sin cambio ☐ Cambiar: |
| ti-assets (Business Case, Entregas Colaboradores…) | V C E B | TI, Finanzas, Comercial, Pasantes | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | TI, Talento Humano, Servicio Técnico, Operaciones, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| users (Backoffice Comercial, Entregas Colaboradores…) | V C E B | TI, Talento Humano, Servicio Técnico, Operaciones, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| viaticos (Finanzas Viaticos) | V C E B | TI, Talento Humano, Servicio Técnico, Operaciones, Usuarios externos, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **bc-availability**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **calidad**: 7 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **clients**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collab-deliveries**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collaborators**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **consumable-files**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **crm-fam**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **delivery-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **determinations-catalog**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-catalog**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **inventario**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **mantenimientos**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **personnel-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **private-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **requests**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **schedules**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
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
