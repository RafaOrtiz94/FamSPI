# Revisión de roles y permisos — Operaciones

Generado el 2026-10-08. Para: jefe de Operaciones. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| operaciones | 2 |
| jefe_operaciones | 2 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: jefe_de_operaciones, analista_operaciones.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | operaciones | jefe_operaciones | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|---|
| business-case (Backoffice Comercial, Business Case…) | V C E B | V C E B | Servicio Técnico, Gerencia, TI, Logística, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| calculation-templates (Operaciones) | V | V | Servicio Técnico, Gerencia, TI, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| calidad (Calidad) | C | C | Gerencia, Calidad, Talento Humano, Servicio Técnico, Comercial | ☐ Sin cambio ☐ Cambiar: |
| clients | – | V C E B | Comercial, TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| consumable-files (Business Case, Comercial (General)…) | V C | V C | Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-ceilings (Comercial Maximos y Saldos) | V | V | Servicio Técnico, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-requests (Comercial Maximos y Saldos) | V C | V C | Servicio Técnico, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| determinations-catalog (Operaciones) | V | V | Servicio Técnico, Gerencia, Comercial, TI, Logística, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| equipment-catalog (Business Case, Comercial (General)…) | V C E | V C E | TI, Servicio Técnico, Logística, Finanzas, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-management (Business Case, Comercial (General)…) | V C E B | V C E B | TI, Servicio Técnico, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-purchases (Backoffice Comercial, Business Case…) | V C E | V C E | Comercial, Gerencia, Servicio Técnico, Logística | ☐ Sin cambio ☐ Cambiar: |
| famsheets (Comercial (General)) | V | V | Gerencia, Comercial, Servicio Técnico | ☐ Sin cambio ☐ Cambiar: |
| inventario (Backoffice Comercial, Business Case…) | V C E | V C E | TI, Servicio Técnico, Logística, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| opportunities | V | V | Gerencia, Comercial, Servicio Técnico | ☐ Sin cambio ☐ Cambiar: |
| personnel-requests (Comercial Solicitudes, Servicio Solicitudes…) | – | C | Talento Humano, Gerencia, Servicio Técnico, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| private-purchases (Backoffice Comercial, Business Case…) | V C E | V C E | Comercial, Gerencia, Servicio Técnico, Logística | ☐ Sin cambio ☐ Cambiar: |
| public-delivery-plans | – | V C | Comercial, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V | V | TI, Gerencia, Comercial, Calidad, Servicio Técnico, Finanzas, Talento Humano | ☐ Sin cambio ☐ Cambiar: |
| servicio (Inicio, Servicio Aplicaciones…) | V | V | Servicio Técnico, Gerencia, Comercial, TI, Logística | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | C E B | TI, Talento Humano, Servicio Técnico, Gerencia, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| users (Backoffice Comercial, Entregas Colaboradores…) | – | V | TI, Talento Humano, Servicio Técnico, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| viaticos (Finanzas Viaticos) | – | V C E B | TI, Talento Humano, Servicio Técnico, Usuarios externos, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **calidad**: 7 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **clients**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **consumable-files**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **delivery-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **determinations-catalog**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-catalog**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **inventario**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
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
