# Implementación Gmail ↔ SPI basada exclusivamente en revisión del sistema real

## OBJETIVO

Implementar una integración entre Google Workspace Gmail y SPI que permita registrar dentro del sistema la comunicación recibida de un cliente, manteniendo trazabilidad desde el correo original hasta el cliente, su proceso/caso y la nota correspondiente.

La integración deberá funcionar desde el contexto del correo actualmente abierto en Gmail.

NO debes asumir ninguna API, endpoint, tabla, modelo, estructura de base de datos, sistema de notas, mecanismo de autenticación, sistema de permisos, relación cliente-proceso, almacenamiento de archivos ni flujo de creación de clientes.

TODO contrato de integración debe obtenerse primero mediante revisión del sistema SPI existente.

La arquitectura de integración será un RESULTADO de la investigación técnica inicial, no un supuesto de esta especificación.

---

# PRINCIPIO FUNDAMENTAL

Antes de escribir cualquier código de integración:

DEBES INSPECCIONAR SPI.

Utiliza las herramientas/skills disponibles para revisar:

- repositorio Git;
- ramas existentes;
- commits recientes;
- backend;
- frontend;
- migraciones;
- base de datos Neon;
- tablas;
- constraints;
- índices;
- triggers;
- funciones;
- sistema de autenticación;
- permisos;
- clientes;
- solicitudes de creación de cliente;
- procesos/casos;
- notas;
- almacenamiento de archivos;
- integraciones Gmail existentes;
- OAuth Google existente;
- trazabilidad;
- auditoría.

NO generes código basado únicamente en nombres encontrados.

Debes localizar cómo las estructuras encontradas son utilizadas realmente por la aplicación.

---

# REGLA CRÍTICA: NO ASUMIR QUE MAIN ES PRODUCCIÓN

El repositorio puede contener:

- `main`;
- ramas de desarrollo;
- ramas más recientes;
- código que todavía no ha sido fusionado;
- funcionalidades desplegadas que no están en `main`;
- migraciones existentes en Neon cuya implementación está en otra rama.

Por tanto:

NO asumir:

```text
main = versión desplegada
```

Tampoco asumir:

```text
rama más reciente = producción
```

Debes establecer, en la medida que permitan las herramientas disponibles, cuál revisión representa mejor el sistema actual.

Comparar:

```text
Código
↕
Migraciones
↕
Esquema Neon
↕
Frontend
↕
Backend
```

Si no es posible demostrar con certeza cuál commit está desplegado:

documentarlo claramente.

Indicar:

```text
Revisión inspeccionada:
Commit:
Rama:
Fecha:

Coincidencias con BD:
...

Discrepancias:
...

Nivel de certeza:
...
```

No inventar una respuesta.

---

# FASE 0 — DESCUBRIMIENTO OBLIGATORIO

No implementar todavía.

Generar primero un:

# INFORME DE ARQUITECTURA ACTUAL DE SPI

Debe incluir evidencia concreta.

---

## 0.1 BACKEND

Determinar:

- framework;
- punto de entrada;
- organización modular;
- sistema de rutas;
- controllers;
- services;
- repositorios;
- acceso PostgreSQL;
- ORM/query builder si existe;
- middlewares;
- manejo de errores;
- validaciones;
- transacciones;
- logging;
- variables de entorno.

Registrar rutas de archivos reales.

Ejemplo de formato:

```text
Componente:
Autenticación

Archivo:
backend/...

Funcionamiento observado:
...

Dependencias:
...

Debe reutilizarse:
Sí/No
```

---

# 0.2 AUTENTICACIÓN REAL

Localizar cómo SPI identifica actualmente al usuario.

Determinar:

- emisión del token;
- validación;
- claims;
- sesiones;
- OAuth;
- Google Workspace;
- JWT;
- refresh;
- cookies;
- frontend;
- backend;
- roles;
- identidad interna.

NO asumir que:

```text
Google token = SPI token
```

El token contextual de Gmail debe tratarse exclusivamente según el propósito que Google le asigna.

Después de descubrir la autenticación real, diseñar el mecanismo mediante el cual:

```text
Usuario Gmail
       ↓
Workspace Add-on
       ↓
SPI
       ↓
usuario SPI real
```

La integración NO debe poder indicar simplemente:

```json
{
  "user": "usuario@empresa.com"
}
```

y ser considerada confiable.

SPI debe verificar realmente la identidad.

---

# 0.3 PERMISOS REALES

Localizar el sistema existente.

Investigar:

- roles;
- permisos;
- ownership;
- asignaciones;
- restricciones por departamento;
- restricciones por comercial;
- filtros de consulta;
- visibilidad de procesos;
- visibilidad de clientes;
- creación de notas.

NO crear permisos como:

```text
gmail.use
notes.create
customers.view
```

salvo que el sistema realmente utilice una estructura compatible y sean necesarios.

Primero determinar cómo funciona actualmente.

La integración debe respetar exactamente las reglas de acceso existentes.

---

# 0.4 CLIENTE — DETERMINAR FUENTE REAL

Este punto es CRÍTICO.

No asumir que una tabla llamada:

```text
clients
```

es la fuente maestra.

No asumir que:

```text
client_requests
```

es exclusivamente una tabla temporal.

No asumir que CRM es la fuente maestra.

Debes seguir el código real.

Investigar cómo SPI actualmente:

1. muestra clientes;
2. busca clientes;
3. obtiene un cliente;
4. relaciona un usuario con un cliente;
5. relaciona un cliente con procesos;
6. restringe los clientes visibles;
7. obtiene nombre;
8. obtiene RUC;
9. obtiene contactos.

Seguir el flujo:

```text
Frontend
↓
API
↓
Controller
↓
Service
↓
SQL
↓
Tabla real
```

Determinar:

```text
FUENTE DE VERDAD DEL CLIENTE:
_____________________________
```

con evidencia.

---

# 0.5 SOLICITUD DE CREACIÓN DE CLIENTE

Existe un flujo de SPI para solicitar la creación de clientes.

DEBE REUTILIZARSE.

No crear otro sistema paralelo.

Localizar completamente:

```text
Frontend
↓
Formulario
↓
API
↓
Validación
↓
Service
↓
Persistencia
↓
Aprobación
↓
Conversión/alta definitiva
```

Determinar exactamente:

- pantalla existente;
- componente;
- campos;
- validaciones;
- archivos;
- permisos;
- endpoint;
- estados;
- responsables;
- aprobación;
- creación del cliente;
- relación entre solicitud aprobada y cliente operativo.

NO asumir cómo una solicitud aprobada se convierte en cliente.

Seguir el código hasta demostrarlo.

Si el mecanismo no puede localizarse:

reportarlo como hallazgo pendiente.

---

# 0.6 SISTEMA DE NOTAS

Este es otro punto CRÍTICO.

El requerimiento funcional indica:

> El correo debe terminar registrado como una nota dentro del sistema de notas del caso/proceso correspondiente.

Pero NO se debe asumir dónde están esas notas.

Debes localizar el sistema real.

Buscar:

- UI de notas;
- componentes;
- hooks;
- APIs;
- controllers;
- services;
- queries;
- tablas;
- foreign keys;
- permisos;
- edición;
- autor;
- fechas;
- adjuntos.

La existencia de una tabla cuyo nombre contenga:

```text
notes
```

NO demuestra que sea el sistema utilizado por SPI.

Debes demostrar:

```text
UI
→ backend
→ servicio
→ persistencia
```

antes de seleccionarla.

Si encuentras estructuras como:

```text
crm_notes
```

pero no encuentras código que las utilice:

NO asumir que son el destino.

Registrarlas únicamente como:

```text
estructura detectada pendiente de confirmar
```

---

# 0.7 PROCESOS / CASOS

Determinar qué entidad representa realmente el:

```text
"caso específico del cliente"
```

No asumir una entidad universal `process`.

Investigar todas las estructuras relevantes que puedan representar procesos:

- Business Case;
- oportunidades;
- servicio;
- compras;
- procesos comerciales;
- procesos privados;
- procesos públicos;
- CRM;
- otras estructuras existentes.

Para cada una determinar:

```text
Entidad
Identificador
Código visible
Cliente relacionado
Estado
Responsable
Permisos
Notas
Frontend
Backend
Tabla
```

---

# 0.8 RELACIÓN CLIENTE ↔ PROCESO

Seguir las relaciones reales.

No asumir:

```text
process.client_id
```

No asumir:

```text
client.processes
```

No crear foreign keys imaginarias.

Determinar exactamente cómo cada proceso obtiene su cliente.

---

# 0.9 GMAIL EXISTENTE

Buscar TODO desarrollo relacionado con:

```text
gmail
google
oauth
email
thread
message
mail
tokens
```

en:

- backend;
- frontend;
- ramas;
- migraciones;
- Neon.

Determinar:

- qué funcionalidad existe;
- si está activa;
- si está incompleta;
- si se utiliza;
- qué scopes usa;
- qué tokens guarda;
- quién los consume;
- si existe Gmail API;
- si existe threading;
- si se pueden reutilizar componentes.

NO crear una segunda integración Gmail si ya existe infraestructura reutilizable.

---

# 0.10 BASE DE DATOS

Usando Neon, revisar exclusivamente metadatos durante la investigación.

Consultar:

- tablas;
- columnas;
- tipos;
- PK;
- FK;
- unique constraints;
- índices;
- triggers;
- funciones;
- vistas;
- secuencias.

NO modificar producción durante el descubrimiento.

NO insertar datos de prueba.

NO eliminar datos.

NO crear tablas solo para probar una hipótesis.

---

# 0.11 ALMACENAMIENTO DE ARCHIVOS

Determinar cómo SPI almacena actualmente:

- PDFs;
- adjuntos;
- documentos;
- fotografías;
- archivos de solicitudes.

Investigar:

```text
Frontend upload
↓
Backend
↓
Storage
↓
Referencia BD
```

Los adjuntos de Gmail deberán reutilizar este mecanismo.

NO crear almacenamiento adicional sin necesidad.

---

# 0.12 AUDITORÍA

Determinar si SPI ya tiene:

- logs de actividad;
- historial;
- auditoría;
- created_by;
- updated_by;
- eventos;
- bitácora.

Reutilizarlo cuando corresponda.

---

# ENTREGABLE OBLIGATORIO ANTES DE PROGRAMAR

Crear:

# INFORME DE DESCUBRIMIENTO

con la siguiente tabla:

```text
COMPONENTE                ESTADO
---------------------------------------------------
Autenticación              identificado / pendiente
Permisos                   identificado / pendiente
Clientes                   identificado / pendiente
Búsqueda cliente           identificado / pendiente
Solicitud cliente          identificado / pendiente
Aprobación cliente         identificado / pendiente
Procesos                   identificado / pendiente
Relación cliente/proceso   identificado / pendiente
Notas                      identificado / pendiente
Adjuntos                   identificado / pendiente
Gmail existente            identificado / pendiente
Auditoría                  identificado / pendiente
```

Para cada elemento incluir:

```text
Archivos relevantes:
...

Rutas reales:
...

Tablas reales:
...

Funciones relevantes:
...

Comportamiento:
...

Conclusión:
...
```

---

# MATRIZ DE DECISIÓN

Después del descubrimiento generar:

```text
REUTILIZAR
----------------
...

AMPLIAR
----------------
...

CREAR
----------------
...

NO UTILIZAR
----------------
...
```

Nada nuevo debe crearse si existe una funcionalidad adecuada.

---

# SOLO DESPUÉS DE ESTA FASE

Diseñar la integración Gmail ↔ SPI.

---

# REQUERIMIENTO FUNCIONAL DEL ADD-ON

Cuando un usuario abre un correo en Gmail:

```text
Gmail
↓
Correo abierto
↓
SPI Add-on
```

el sistema debe permitir:

1. determinar qué mensaje está abierto;
2. obtener únicamente la información necesaria;
3. determinar identidad del usuario SPI;
4. verificar si ese mensaje ya fue registrado;
5. verificar si la conversación ya tiene alguna relación conocida;
6. intentar identificar el cliente;
7. permitir buscarlo manualmente;
8. mostrar sus procesos/casos disponibles;
9. seleccionar el correcto;
10. registrar el correo como nota;
11. conservar trazabilidad;
12. evitar duplicados.

---

# IDENTIFICACIÓN DEL CLIENTE

NO depender exclusivamente del correo electrónico.

Los clientes pueden:

- no tener correo registrado;
- utilizar cuentas personales;
- utilizar Gmail;
- utilizar Outlook;
- escribir desde direcciones nuevas;
- utilizar múltiples contactos.

El sistema debe utilizar primero las capacidades reales que SPI tenga disponibles.

Posibles señales que pueden estudiarse:

```text
correo
RUC
nombre comercial
razón social
contacto
teléfono
dominio empresarial
referencias en firma
referencias en asunto
relaciones históricas
thread de Gmail
identificador de proceso
```

Pero únicamente implementar las que sean técnicamente justificables después de estudiar los datos reales.

---

# DOMINIOS GENÉRICOS

No considerar automáticamente:

```text
gmail.com
hotmail.com
outlook.com
yahoo.com
```

como identificadores de una organización.

---

# RESULTADOS AMBIGUOS

Nunca asignar silenciosamente un cliente cuando existen dudas.

Ejemplo UI:

```text
SPI

Encontramos posibles clientes:

○ Cliente A
○ Cliente B
○ Cliente C

[Seleccionar]

[Buscar manualmente]
```

---

# BÚSQUEDA MANUAL

La búsqueda manual debe utilizar o ampliar EL MECANISMO REAL DE SPI.

No crear automáticamente algo como:

```text
/api/gmail/customers/search
```

si SPI ya tiene una consulta adecuada.

Primero descubrir:

```text
Cómo busca clientes actualmente SPI
```

Luego reutilizar su service/repository/reglas.

La búsqueda debe respetar los mismos permisos que la aplicación web.

---

# APRENDIZAJE DE CONTACTOS

Puede ser conveniente que SPI recuerde:

```text
correo/contacto
→
cliente confirmado
```

pero NO crear de entrada una tabla nueva para ello.

Primero investigar si existen:

- contactos;
- CRM contacts;
- asociaciones;
- relaciones de correo;
- directorio;
- metadata.

Si hay una estructura apropiada:

reutilizarla.

Si no existe ninguna:

documentar la necesidad y proponer la modificación mínima.

La persistencia solo se realizará después de justificarla técnicamente.

---

# CLIENTE ENCONTRADO

Una vez seleccionado un cliente:

SPI debe recuperar los procesos/casos a los cuales el usuario tenga acceso.

La consulta debe reutilizar la lógica real encontrada.

La UI puede mostrar conceptualmente:

```text
CLIENTE

Hospital XYZ

Procesos disponibles:

○ ...
○ ...
○ ...
```

Pero los tipos, campos, códigos y estados deben provenir del sistema real.

---

# CLIENTE NO ENCONTRADO

Este escenario es obligatorio.

Después de:

```text
identificación automática
+
búsqueda manual
```

si el cliente no existe:

mostrar:

```text
No encuentro este cliente

[SOLICITAR CREACIÓN DE CLIENTE]
```

---

# NO CREAR EL CLIENTE DESDE EL ADD-ON

El botón:

```text
SOLICITAR CREACIÓN DE CLIENTE
```

debe enlazar con el flujo REAL existente de SPI.

NO:

```text
crear cliente directamente
```

NO:

```text
crear otro formulario alternativo
```

NO:

```text
crear otra tabla de solicitudes
```

---

# PRESERVAR EL CORREO ANTES DE SALIR DE GMAIL

Este requisito es fundamental.

Si el usuario recibe un correo de un cliente inexistente y tiene que abrir el formulario de SPI:

el correo NO puede quedar nuevamente fuera de trazabilidad.

Debe existir una representación persistente de esa comunicación antes o durante el inicio del flujo de creación.

Pero:

NO asumir que se necesita una tabla llamada:

```text
gmail_intake
```

Primero investigar si SPI ya tiene alguna estructura apta para:

- correo pendiente;
- actividad;
- comunicación;
- notas;
- CRM;
- oportunidades;
- solicitudes;
- email threads;
- integraciones.

Si existe:

reutilizarla.

Si ninguna estructura puede representar correctamente el estado:

proponer el modelo mínimo necesario.

La migración será un resultado del diseño, no una premisa.

---

# TRAZABILIDAD LÓGICA REQUERIDA

Independientemente de cómo se llamen las entidades reales:

debe poder reconstruirse conceptualmente:

```text
Mensaje Gmail
       ↓
Comunicación preservada
       ↓
Solicitud creación cliente
       ↓
Cliente creado
       ↓
Caso/proceso
       ↓
Nota
```

No es obligatorio que cada línea represente una tabla.

Puede reutilizar estructuras existentes.

Lo obligatorio es que la relación sea recuperable.

---

# PREFILL DE LA SOLICITUD DE CLIENTE

Al abrir el formulario existente de SPI:

prellenar únicamente datos que puedan obtenerse razonablemente del correo.

Ejemplos posibles:

```text
nombre contacto
correo
teléfono
empresa encontrada en firma
RUC encontrado
```

El usuario debe poder verificarlos y corregirlos.

NO completar silenciosamente datos empresariales inciertos.

---

# NO TRANSPORTAR EL CORREO COMPLETO EN QUERYSTRING

No hacer:

```text
?body=contenido-completo-del-correo...
```

Si debe transferirse contexto Gmail → SPI:

preferir una referencia opaca generada en servidor.

Conceptualmente:

```text
/context/<id-seguro>
```

El nombre y mecanismo concretos deben adaptarse a la arquitectura descubierta.

---

# SOLICITUD DE CLIENTE PENDIENTE

Si el correo ya inició una solicitud:

al volver a abrirlo Gmail debe poder indicar algo equivalente a:

```text
SPI

Cliente pendiente de creación

Solicitud:
...

Estado:
...

[Abrir solicitud]
```

NO generar otra solicitud accidentalmente.

---

# APROBACIÓN DEL CLIENTE

Debes localizar el mecanismo REAL mediante el cual una solicitud aprobada se convierte o se reconoce como cliente operativo.

Después de comprobarlo:

relacionar la comunicación pendiente con ese cliente.

No asumir una columna:

```text
created_customer_id
```

No crearla sin investigar primero.

---

# CONTINUAR DESPUÉS DE LA APROBACIÓN

Una vez que SPI reconozca el cliente:

al abrir el correo nuevamente debe poder continuar:

```text
Cliente identificado
       ↓
Procesos/casos
       ↓
Seleccionar
       ↓
Crear nota
```

---

# CLIENTE EXISTE PERO NO HAY PROCESO

Puede ocurrir:

```text
cliente encontrado
+
ningún proceso apropiado
```

No crear automáticamente un Business Case ni otro proceso.

Mostrar una acción hacia la funcionalidad real correspondiente de SPI, únicamente si existe y el usuario tiene permisos.

---

# SISTEMA DE NOTAS

Al seleccionar el proceso:

mostrar una confirmación similar a:

```text
Registrar correo en SPI

Cliente:
...

Proceso:
...

Asunto:
...

Comentario adicional:
[________________]

[REGISTRAR]
```

La creación debe utilizar el servicio real del sistema de notas.

NO escribir directamente a PostgreSQL desde Apps Script.

NO crear un sistema de notas nuevo.

---

# CONTENIDO DE LA NOTA

Debe preservar información suficiente para trazabilidad.

Conceptualmente:

```text
Origen:
Gmail

De:
...

Para:
...

Fecha:
...

Asunto:
...

Comentario interno:
...

Contenido relevante:
...
```

La estructura definitiva debe adaptarse al modelo real de notas.

---

# SNAPSHOT VS REFERENCIA

Analizar el sistema real y determinar si la nota debe conservar:

- copia del cuerpo;
- referencia Gmail;
- ambas.

Para garantizar trazabilidad, la eliminación posterior del correo en Gmail no debería borrar necesariamente el historial empresarial ya registrado en SPI.

Documentar la decisión.

---

# IDENTIFICADORES DE GMAIL

Cuando sea técnicamente posible y permitido, conservar referencias que permitan:

- deduplicación;
- reconocimiento del hilo;
- correlación.

Por ejemplo:

```text
messageId
threadId
```

Pero determinar primero dónde deben persistirse.

NO crear automáticamente columnas en la tabla de notas.

---

# DEDUPLICACIÓN

Debe existir protección del lado servidor.

No depender únicamente de que el botón quede deshabilitado.

Las llamadas repetidas no deben generar múltiples notas accidentalmente.

Determinar la estrategia de idempotencia después de conocer el modelo real.

---

# THREAD DE GMAIL

Si SPI ya dispone de infraestructura relacionada con threads/correos:

investigar si es aplicable.

No reutilizar una tabla únicamente porque contenga:

```text
email_threads
```

Debes entender su propósito real.

Si actualmente se utiliza para otro flujo, no modificar su semántica indebidamente.

---

# INTEGRACIÓN GMAIL EXISTENTE

Si encuentras servicios existentes que:

- autentican Gmail;
- almacenan Google tokens;
- envían correos;
- responden correos;
- leen Gmail;

analizar cuáles pueden reutilizarse.

Documentar:

```text
Componente existente
Propósito actual
Compatible con add-on: sí/no/parcial
Cambios necesarios
```

No duplicar OAuth innecesariamente.

---

# GOOGLE WORKSPACE ADD-ON

Solo después de analizar SPI decidir:

```text
Apps Script
```

o:

```text
HTTP endpoint / alternate runtime
```

No elegirlo únicamente porque sea más sencillo.

Considerar:

- autenticación;
- despliegue;
- mantenimiento;
- código existente;
- seguridad;
- Workspace;
- backend SPI.

---

# ACCESO AL CORREO ACTUAL

Solicitar los scopes mínimos posibles.

El acceso al mensaje abierto debe utilizar los mecanismos oficiales del Workspace Add-on.

NO solicitar acceso completo al buzón si no es necesario.

---

# AUTENTICACIÓN ADD-ON ↔ SPI

Este diseño debe salir de la revisión del sistema.

Requisitos:

1. SPI debe conocer al usuario real.
2. El usuario debe existir y estar autorizado.
3. No confiar solamente en un correo enviado desde el cliente.
4. No almacenar credenciales personales inseguramente.
5. No exponer secretos dentro del Apps Script cuando puedan evitarse.
6. No confundir el access token contextual Gmail con un token SPI.
7. Reutilizar el SSO/OAuth/autenticación existente cuando sea viable.

Documentar claramente el flujo final:

```text
Gmail user
→ Google
→ Add-on
→ mecanismo de autenticación
→ SPI user
```

---

# ADJUNTOS

Antes de implementar adjuntos:

localizar almacenamiento real de SPI.

Reutilizarlo.

La UI puede permitir:

```text
☑ documento.pdf
☑ cotizacion.xlsx
☐ logo.png
```

Aplicar:

- límites;
- validación MIME;
- nombres seguros;
- control de tamaño;
- permisos.

Una falla en un adjunto debe tener tratamiento explícito.

---

# ESTADOS DE LA INTERFAZ

Diseñar las Cards del Add-on para representar al menos:

## 1. Cargando contexto

```text
Consultando SPI...
```

## 2. Mensaje ya registrado

```text
Este correo ya está registrado.

Cliente:
...

Proceso:
...

[Ver en SPI]
```

## 3. Cliente identificado

```text
Cliente:
...

Procesos:
...
```

## 4. Múltiples candidatos

```text
Posibles clientes:
...
```

## 5. Búsqueda manual

```text
Buscar cliente:
[________________]
```

## 6. Cliente inexistente

```text
No encuentro el cliente.

[SOLICITAR CREACIÓN]
```

## 7. Solicitud pendiente

```text
Solicitud de cliente pendiente.

[Abrir en SPI]
```

## 8. Cliente creado

```text
Cliente disponible.

Selecciona proceso:
...
```

## 9. Confirmación de nota

```text
Registrar correo
```

## 10. Registro completado

```text
✓ Correo registrado en SPI
```

---

# SEGURIDAD

Tratar todos los datos del correo como input no confiable.

Considerar:

- XSS;
- HTML malicioso;
- links;
- MIME;
- adjuntos;
- nombres de archivos;
- contenido inesperado;
- direcciones falsificadas;
- datos de formulario.

No insertar HTML de Gmail directamente en SPI sin sanitización.

---

# NO CONFIAR EN IDENTIFICADORES DEL CLIENTE

Si el Add-on envía un identificador de:

- cliente;
- proceso;
- caso;
- nota;

el backend debe volver a comprobar:

```text
existe
+
relación válida
+
usuario autorizado
```

---

# NO ACCESO DIRECTO A NEON DESDE EL ADD-ON

Flujo obligatorio:

```text
Gmail Add-on
       ↓
Backend SPI
       ↓
Servicios/repositorios SPI
       ↓
PostgreSQL/Neon
```

Nunca:

```text
Gmail
↓
PostgreSQL
```

---

# RENDIMIENTO

Después de descubrir el backend real:

evaluar si conviene una operación de contexto agregada para reducir múltiples viajes.

Pero NO inventar de antemano:

```text
POST /api/integrations/gmail/context
```

Primero comprobar las rutas y servicios existentes.

Si se necesita un nuevo endpoint:

definirlo siguiendo las convenciones reales del proyecto.

Documentar por qué no puede resolverse reutilizando los existentes.

---

# CONVENCIÓN PARA CUALQUIER NUEVA API

Si después de la investigación se demuestra que hace falta una nueva API:

debe seguir:

- estructura de módulos existente;
- middleware real;
- validación real;
- respuesta estándar;
- manejo de errores;
- autorización;
- logging;
- testing;
- convenciones de nombres.

No crear una miniarquitectura diferente dentro de SPI.

---

# CONVENCIÓN PARA NUEVAS TABLAS

Solo crear nuevas estructuras si:

1. no existe estructura reutilizable;
2. existe una necesidad funcional demostrable;
3. se ha documentado por qué;
4. encaja con el modelo de SPI.

Antes de crearla presentar:

```text
Problema:
...

Alternativas existentes evaluadas:
...

Por qué no sirven:
...

Nueva estructura propuesta:
...

Relaciones:
...

Constraints:
...

Índices:
...

Retención:
...

Auditoría:
...
```

---

# NO HACER PRUEBAS DE ESCRITURA EN PRODUCCIÓN DURANTE DESCUBRIMIENTO

Queda prohibido usar Neon para:

```text
INSERT
UPDATE
DELETE
ALTER
DROP
CREATE
```

durante la fase de investigación.

Las pruebas funcionales se realizarán en un entorno apropiado después de definir la implementación.

---

# CASOS DE PRUEBA FUNCIONALES

La solución final debe cubrir:

## Caso 1

Cliente identificable automáticamente.

```text
correo
→ cliente
→ proceso
→ nota
```

## Caso 2

Coincidencia ambigua.

```text
correo
→ múltiples clientes
→ selección usuario
```

## Caso 3

Cliente encontrado manualmente.

```text
correo desconocido
→ búsqueda manual
→ cliente
→ proceso
→ nota
```

## Caso 4

Cliente inexistente.

```text
correo
→ búsqueda
→ no existe
→ preservar comunicación
→ solicitud existente de creación
```

## Caso 5

Solicitud pendiente.

```text
abrir correo nuevamente
→ detectar solicitud
→ mostrar estado
→ no duplicar
```

## Caso 6

Cliente creado posteriormente.

```text
solicitud aprobada
→ reconocer cliente
→ recuperar correo
→ seleccionar proceso
```

## Caso 7

Correo ya registrado.

```text
mismo messageId/contexto
→ impedir duplicado
```

## Caso 8

Thread conocido.

```text
nuevo mensaje del hilo
→ sugerir relación existente
→ usuario confirma/corrige
```

## Caso 9

Cliente existente sin proceso.

```text
cliente
→ no hay proceso adecuado
→ no inventar proceso
```

## Caso 10

Usuario sin permiso.

No revelar datos a los que el usuario no tiene acceso.

## Caso 11

Usuario Gmail sin correspondencia válida en SPI.

Mostrar flujo de autenticación/autorización apropiado.

## Caso 12

Autenticación vencida.

Recuperación controlada.

## Caso 13

SPI no responde.

Mostrar error entendible y permitir reintento.

## Caso 14

Adjunto falla.

No producir un estado silenciosamente inconsistente.

## Caso 15

Correo desde dominio genérico.

No inferir cliente por `gmail.com`, etc.

## Caso 16

POST repetido.

No generar duplicados.

## Caso 17

Dos usuarios intentan registrar el mismo correo.

Resolver la condición de carrera del lado servidor.

---

# VERIFICACIÓN DE TRAZABILIDAD

Crear una prueba end-to-end:

```text
1. abrir correo Gmail

2. SPI no reconoce cliente

3. buscar manualmente

4. no existe

5. pulsar Solicitar creación de cliente

6. comprobar que la comunicación no se pierde

7. abrir el formulario REAL de SPI

8. comprobar información precargada

9. completar solicitud

10. procesar por el flujo real

11. aprobar/crear cliente

12. abrir nuevamente el correo

13. comprobar que se reconoce la relación pendiente

14. seleccionar proceso

15. crear nota mediante sistema REAL de notas

16. abrir proceso en SPI

17. comprobar nota

18. comprobar trazabilidad hasta Gmail

19. volver a pulsar Registrar

20. comprobar que no se duplica
```

---

# INVESTIGACIÓN ESPECÍFICA DE ELEMENTOS YA DETECTADOS

Durante la revisión inicial se han observado indicios de estructuras relacionadas con:

```text
Gmail
clientes
solicitudes de clientes
Business Case
CRM
notas
oportunidades
threads de correo
tokens Gmail
```

NO debes asumir que todas estén activas ni que deban utilizarse.

Para cada una responder:

```text
¿Existe en código activo?
¿Existe en BD?
¿Está conectada al frontend?
¿Tiene registros?
¿Tiene servicios?
¿Tiene rutas?
¿Está desplegada?
¿Su semántica coincide con esta integración?
¿Debe reutilizarse?
```

---

# ESPECIAL ATENCIÓN A DISCREPANCIAS CÓDIGO ↔ BD

Si encuentras una tabla en Neon pero no código:

NO utilizarla todavía.

Si encuentras código en una rama pero la BD no tiene las estructuras requeridas:

NO asumir que está desplegado.

Si encuentras versiones distintas de una misma funcionalidad:

compararlas.

Documentar cuál se usará y por qué.

---

# BLOQUEADORES

Los siguientes elementos deben estar resueltos antes de implementar esa parte:

## NOTAS

Si no puede demostrarse cuál es el sistema real de notas:

NO escribir en una tabla candidata.

Reportar:

```text
BLOQUEADOR:
Destino real del sistema de notas no identificado.
```

Puede continuar el resto de la investigación.

## CLIENTES

Si no puede determinarse la fuente maestra:

NO inventar mappings.

## PROCESOS

Si no puede determinarse cómo se relacionan los procesos con el cliente:

NO inventar foreign keys.

## AUTENTICACIÓN

Si no puede demostrarse cómo autenticar al usuario del Add-on contra SPI:

NO implementar una autenticación insegura.

---

# ENTREGABLE 1

## Informe de descubrimiento

Debe contener toda la evidencia obtenida.

---

# ENTREGABLE 2

## Arquitectura AS-IS

Diagrama del SPI actual:

```text
Frontend
↓
Backend
↓
Auth
↓
Clientes
↓
Procesos
↓
Notas
↓
BD
```

utilizando exclusivamente componentes descubiertos.

---

# ENTREGABLE 3

## Arquitectura TO-BE

Después de entender AS-IS:

diseñar:

```text
Gmail
↓
Workspace Add-on
↓
SPI
↓
cliente
↓
proceso
↓
nota
```

incluyendo autenticación y trazabilidad.

---

# ENTREGABLE 4

## Contrato de integración real

Aquí recién definir:

- endpoints a reutilizar;
- endpoints nuevos realmente necesarios;
- payloads;
- respuestas;
- autenticación;
- errores;
- idempotencia.

Cada endpoint nuevo deberá indicar:

```text
Por qué se necesita
Qué servicio existente reutiliza
Quién puede llamarlo
Cómo se autentica
Qué valida
Qué devuelve
```

---

# ENTREGABLE 5

## Modelo de datos

Mostrar exclusivamente:

```text
estructuras existentes reutilizadas
+
modificaciones imprescindibles
+
nuevas estructuras estrictamente necesarias
```

No crear estructuras especulativas.

---

# ENTREGABLE 6

## Diseño del Add-on

Incluir:

- runtime elegido;
- manifest;
- scopes;
- tarjetas;
- navegación;
- callbacks;
- autenticación SPI;
- errores;
- caché si aplica;
- manejo de correo actual.

---

# ENTREGABLE 7

## Implementación backend

Siguiendo exactamente la arquitectura actual de SPI.

---

# ENTREGABLE 8

## Implementación frontend

Modificar únicamente lo necesario.

Especialmente:

- solicitud creación cliente;
- prefill;
- regreso/continuación del flujo;
- links desde Add-on.

---

# ENTREGABLE 9

## Migraciones

Únicamente si la investigación demuestra que son necesarias.

Deben seguir el sistema de migraciones existente.

---

# ENTREGABLE 10

## Pruebas

Incluir:

- unitarias;
- integración;
- permisos;
- seguridad;
- idempotencia;
- end-to-end.

---

# ENTREGABLE 11

## Despliegue Google Workspace

Documentar:

- proyecto Google;
- Workspace Add-on;
- scopes;
- permisos;
- instalación privada;
- grupos/OU si aplica;
- variables;
- dominios;
- configuración;
- actualización.

---

# ENTREGABLE 12

## Despliegue SPI

Documentar:

- cambios backend;
- cambios frontend;
- migraciones;
- variables de entorno;
- orden de despliegue;
- compatibilidad.

---

# ENTREGABLE 13

## Rollback

Definir cómo revertir:

- backend;
- frontend;
- migraciones;
- Add-on;

sin afectar funcionalidades existentes.

---

# ENTREGABLE 14

## Documentación final de trazabilidad

Demostrar con un ejemplo real de prueba:

```text
Gmail message
↓
referencia persistida
↓
cliente/solicitud
↓
proceso
↓
nota
```

indicando los identificadores reales utilizados por SPI.

---

# METODOLOGÍA DE EJECUCIÓN

Trabajar en este orden:

```text
FASE 0
Descubrimiento

FASE 1
Informe AS-IS

FASE 2
Confirmar fuentes de verdad

FASE 3
Diseñar integración

FASE 4
Definir autenticación

FASE 5
Definir trazabilidad

FASE 6
Implementar backend

FASE 7
Integrar creación de cliente

FASE 8
Integrar procesos/notas

FASE 9
Crear Workspace Add-on

FASE 10
Adjuntos

FASE 11
Pruebas

FASE 12
Despliegue
```

NO empezar FASE 6 mientras existan sin resolver:

```text
fuente real de clientes
flujo real creación cliente
proceso/caso destino
sistema real de notas
autenticación
```

salvo componentes completamente independientes.

---

# REGLA FINAL

No diseñes SPI según esta especificación.

ADAPTA la integración al SPI que realmente existe.

El objetivo funcional es fijo:

```text
Gmail
→ identificar cliente
→ encontrar proceso
→ crear nota
→ preservar trazabilidad

o

Gmail
→ cliente inexistente
→ preservar correo
→ solicitud REAL de creación de cliente
→ cliente
→ proceso
→ nota
```

Pero la forma técnica de lograrlo debe determinarse exclusivamente mediante evidencia obtenida del código y la base de datos reales.

No inventes APIs.

No inventes tablas.

No inventes permisos.

No inventes relaciones.

No asumas que el nombre de una tabla define su propósito.

No escribas directamente sobre una tabla sin localizar primero el servicio que controla ese dominio.

Cuando haya incertidumbre, documenta la incertidumbre y continúa investigando antes de implementar.
