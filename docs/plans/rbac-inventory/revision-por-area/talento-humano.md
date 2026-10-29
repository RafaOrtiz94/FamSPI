# Revisión de roles y permisos — Talento Humano

Generado el 2026-10-08. Para: jefe de Talento Humano. Fuente: reglas escritas en el código del sistema.

## Qué es esto

Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.

Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.

## Tu equipo hoy

| Rol | Usuarios activos |
|---|---|
| talento_humano | 2 |

Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: jefe_talento_humano, jefe_de_talento_humano, analista_talento_humano, asistente_talento_humano, auxiliar_talento_humano, rh, rrhh.

## Qué puede hacer cada rol, parte por parte del sistema

| Parte del sistema | talento_humano | Otros equipos con acceso | ¿Debe ser distinto? |
|---|---|---|---|
| api | C | Gerencia | ☐ Sin cambio ☐ Cambiar: |
| auditoria (Auditoria y Trazabilidad) | V | TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| calidad (Calidad) | V C | Gerencia, Calidad, Servicio Técnico, Operaciones, Comercial | ☐ Sin cambio ☐ Cambiar: |
| collab-deliveries (Entregas Colaboradores, Resumen Entregas Colaboradores…) | V C E B | Servicio Técnico, Finanzas, TI, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| collaborators (Calidad, Gerencia…) | V C E | Gerencia, Calidad, Comercial | ☐ Sin cambio ☐ Cambiar: |
| departments (Talento Departamentos, Talento Gestion…) | V C E B | TI, Gerencia, Finanzas | ☐ Sin cambio ☐ Cambiar: |
| hiring-pipeline (Talento Colaboradores, Talento Centro de Comando…) | V C E | Gerencia | ☐ Sin cambio ☐ Cambiar: |
| offboarding (Talento Colaboradores, Talento Centro de Comando…) | V C E | TI, Finanzas, Gerencia | ☐ Sin cambio ☐ Cambiar: |
| personnel-requests (Comercial Solicitudes, Servicio Solicitudes…) | V C E | Gerencia, Servicio Técnico, Operaciones, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| requests (Backoffice Comercial, Business Case…) | V | TI, Gerencia, Comercial, Calidad, Servicio Técnico, Finanzas, Operaciones | ☐ Sin cambio ☐ Cambiar: |
| suggestion-box (Inicio) | V C | TI, Gerencia, Calidad | ☐ Sin cambio ☐ Cambiar: |
| talento-humano | V C E | Gerencia | ☐ Sin cambio ☐ Cambiar: |
| trainings (Capacitaciones) | C E B | TI, Servicio Técnico, Operaciones, Gerencia, Finanzas, Comercial, Calidad | ☐ Sin cambio ☐ Cambiar: |
| users (Backoffice Comercial, Entregas Colaboradores…) | V C E B | TI, Servicio Técnico, Operaciones, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |
| viaticos (Finanzas Viaticos) | V C E B | TI, Servicio Técnico, Operaciones, Usuarios externos, Gerencia, Finanzas, Comercial | ☐ Sin cambio ☐ Cambiar: |

## Partes donde el sistema trata distinto a endpoints parecidos

En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.

- **calidad**: 7 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collab-deliveries**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **collaborators**: 2 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
- **personnel-requests**: 1 grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: 
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
