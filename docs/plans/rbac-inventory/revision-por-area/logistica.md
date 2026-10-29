# Revisión de roles y permisos — Logística

Generado el 2026-10-08. Para: jefe de Logística. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| logistica | 1 |
| jefe_logistica | 1 |

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | logistica | jefe_logistica | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|---|
| business-case (Backoffice Comercial, Business Case…) | – | V C E B | Servicio Técnico, Gerencia, Operaciones, TI, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| calculation-templates (Operaciones) | – | V | Servicio Técnico, Gerencia, Operaciones, TI, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| consumable-files (Business Case, Comercial (General)…) | V C | V C | Operaciones, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-ceilings (Comercial Maximos y Saldos) | – | V | Servicio Técnico, Operaciones, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| delivery-requests (Comercial Maximos y Saldos) | – | V C | Servicio Técnico, Operaciones, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| determinations-catalog (Operaciones) | – | V | Servicio Técnico, Gerencia, Comercial, Operaciones, TI, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| equipment-catalog (Business Case, Comercial (General)…) | – | V C E | Operaciones, TI, Servicio Técnico, Finanzas, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-management (Business Case, Comercial (General)…) | V C E B | V C E B | TI, Servicio Técnico, Operaciones, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| equipment-purchases (Backoffice Comercial, Business Case…) | V C | V C E | Comercial, Gerencia, Servicio Técnico, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| inventario (Backoffice Comercial, Business Case…) | V C E | V C E | TI, Servicio Técnico, Operaciones, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| mantenimientos (Inicio, Operaciones…) | V C | V C | Servicio Técnico, Gerencia, Comercial, TI | ☐ Sin cambio ☐ Cambiar: |
| private-purchases (Backoffice Comercial, Business Case…) | V C E | V C E | Comercial, Gerencia, Servicio Técnico, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| servicio (Inicio, Servicio Aplicaciones…) | C | V C | Servicio Técnico, Gerencia, Comercial, TI, Operaciones | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **consumable-files**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **delivery-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **determinations-catalog**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-catalog**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **inventario**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **mantenimientos**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **private-purchases**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 

## Lo que falta o sobra

1. ¿Hay algo que tu equipo **debería poder hacer y hoy no puede**?

   Respuesta: 

2. ¿Hay algo que tu equipo **puede hacer hoy y no debería**?

   Respuesta: 

3. ¿Algún rol de tu equipo debería tener permisos distintos al resto del equipo?

   Respuesta: 

## Aprobación

Nombre y fecha: 
