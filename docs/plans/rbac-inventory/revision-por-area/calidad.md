# Revisión de roles y permisos — Calidad

Generado el 2026-10-08. Para: jefe de Calidad. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| jefe_calidad | 1 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: calidad.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | jefe_calidad | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|
| approvals (Servicio Solicitudes) | V | Servicio Técnico, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| business-case (Backoffice Comercial, Business Case…) | V | Servicio Técnico, Gerencia, Operaciones, TI, Logística, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| calidad (Calidad) | V C E B | Gerencia, Talento Humano, Servicio Técnico, Operaciones, Comercial | ☐ Sin cambio ☐ Cambiar: |
| collaborators (Calidad, Gerencia…) | V | Talento Humano, Gerencia, Comercial | ☐ Sin cambio ☐ Cambiar: |
| personnel-requests (Comercial Solicitudes, Servicio Solicitudes…) | C | Talento Humano, Gerencia, Servicio Técnico, Operaciones, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V E | TI, Gerencia, Comercial, Servicio Técnico, Finanzas, Talento Humano, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| suggestion-box (Inicio) | V C | TI, Talento Humano, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | TI, Talento Humano, Servicio Técnico, Operaciones, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **business-case**: 5 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **calidad**: 7 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collaborators**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **personnel-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **requests**: 3 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 

## Lo que falta o sobra

1. ¿Hay algo que tu equipo **debería poder hacer y hoy no puede**?

   Respuesta: 

2. ¿Hay algo que tu equipo **puede hacer hoy y no debería**?

   Respuesta: 

3. ¿Algún rol de tu equipo debería tener permisos distintos al resto del equipo?

   Respuesta: 

## Aprobación

Nombre y fecha: 
