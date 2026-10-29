# Revisión de roles y permisos — Finanzas

Generado el 2026-10-08. Para: jefe de Finanzas. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| financiero | 2 |
| jefe_financiero | 1 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: finanzas, jefe_finanzas, jefe_de_finanzas, contador.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | financiero | jefe_financiero | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|---|
| business-case (Backoffice Comercial, Business Case…) | – | V C E B | Servicio Técnico, Gerencia, Operaciones, TI, Logística, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| calculation-templates (Operaciones) | – | V | Servicio Técnico, Gerencia, Operaciones, TI, Logística, Comercial | ☐ Sin cambio ☐ Cambiar: |
| collab-deliveries (Entregas Colaboradores, Resumen Entregas Colaboradores…) | V C E B | V C E B | Talento Humano, Servicio Técnico, TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| departments (Talento Departamentos, Talento Gestion…) | V | V | TI, Talento Humano, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| determinations-catalog (Operaciones) | – | V | Servicio Técnico, Gerencia, Comercial, Operaciones, TI, Logística | ☐ Sin cambio ☐ Cambiar: |
| equipment-catalog (Business Case, Comercial (General)…) | – | V C E | Operaciones, TI, Servicio Técnico, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| finanzas | V C | V C | Gerencia | ☐ Sin cambio ☐ Cambiar: |
| inventario (Backoffice Comercial, Business Case…) | V C E | V C E | TI, Servicio Técnico, Operaciones, Logística, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| offboarding (Talento Colaboradores, Talento Centro de Comando…) | – | V C E | Talento Humano, TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V | V C | TI, Gerencia, Comercial, Calidad, Servicio Técnico, Talento Humano, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| ti-assets (Business Case, Entregas Colaboradores…) | V C | V C | TI, Gerencia, Comercial, Pasantes | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | C E B | TI, Talento Humano, Servicio Técnico, Operaciones, Gerencia, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| users (Backoffice Comercial, Entregas Colaboradores…) | V | V | TI, Talento Humano, Servicio Técnico, Operaciones, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| viaticos (Finanzas Viaticos) | V C E B | V C E B | TI, Talento Humano, Servicio Técnico, Operaciones, Usuarios externos, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collab-deliveries**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **determinations-catalog**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **equipment-catalog**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **inventario**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
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
