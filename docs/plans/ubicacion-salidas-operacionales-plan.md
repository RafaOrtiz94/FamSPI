# Plan de ejecución: ubicación de colaboradores en salida operacional

**Estado:** propuesto, pendiente de aprobación
**Fecha:** 2026-10-07
**Solicitado por:** usuarios de jefatura (necesidad urgente)

## 1. Objetivo

Que jefatura pueda ver en un mapa dónde están los colaboradores que tienen una salida operacional activa, con la ubicación más reciente disponible y su recorrido, sin instalar una aplicación nueva desde el App Store.

## 2. Decisión

Se usa la ubicación que ya reporta el MDM de la empresa (ManageEngine Endpoint Central) y se muestra dentro del SPI, limitada al tiempo en que la persona está en salida operacional.

Se descartaron:

| Alternativa | Por qué no |
|---|---|
| Seguimiento desde la aplicación web | En iPhone una aplicación web no puede leer la ubicación con la pantalla bloqueada ni con un push; solo con la app abierta. |
| App nativa propia distribuida por MDM | Da tiempo real, pero cuesta varias semanas y mantenimiento permanente. Queda como siguiente paso solo si el MDM no alcanza. |
| Automatizaciones de Atajos de iPhone | Se configuran a mano en cada teléfono y no hay certeza de que funcionen con el teléfono bloqueado. |

## 3. Qué existe hoy

- **Ubicación por marcación.** El SPI guarda latitud, longitud y precisión al iniciar y cerrar la salida operacional, al entrar y salir de cada visita y en el almuerzo operacional.
- **Presencia en vivo.** `GET /api/v1/attendance/live-presence` devuelve quién está en salida operacional, con destino, ciudad y estado. No devuelve coordenadas. Lo consume el widget de asistencia.
- **Mapa.** Talento Humano tiene un mapa de asistencia con Google Maps (`AttendanceMapView.jsx`).
- **MDM.** Todos los iPhone están en ManageEngine Endpoint Central con perfil de iOS. Su función Geo-Tracking guarda hasta 30 días de historial y tiene API de consulta.

## 4. Alcance

**Incluye**

- Mapa de colaboradores en salida operacional activa, con última posición, hora de esa posición, destino y estado.
- Recorrido de la salida en curso.
- Aviso cuando un dispositivo en salida lleva demasiado tiempo sin reportar.
- Respaldo con la última marcación cuando el MDM no tiene posición.

**No incluye**

- Ubicación fuera de una salida operacional activa.
- Seguimiento segundo a segundo.
- Dispositivos que no estén inscritos en el MDM.
- Alertas por salir de una zona (geocercas).

## 5. Límites conocidos

- **Frecuencia.** En iPhone el agente del MDM registra una posición nueva solo cuando el teléfono se movió al menos la distancia configurada (100 m, 500 m o 1 km) y pasó el intervalo. Sirve para saber por dónde va alguien, no para seguirlo calle a calle.
- **Permiso del usuario.** El agente necesita ubicación en "Permitir siempre". Apple no permite forzarlo por MDM; si el usuario lo desactiva, el dispositivo deja de reportar.
- **El MDM rastrea todo el día.** El filtro "solo durante la salida" lo aplica el SPI. En la consola de ManageEngine la ubicación queda visible para quien tenga ese permiso.

## 6. Fases

### Fase 0: verificación (TI, 1 a 2 días)

Antes de desarrollar hay que confirmar cuatro cosas. Si alguna falla, se pasa al plan alterno de la sección 10.

1. Endpoint Central: ¿en la nube o en servidor propio? Define cómo se autentica la API.
2. La edición contratada expone la API de ubicación. Está documentada para Mobile Device Manager Plus; falta confirmar que Endpoint Central la ofrece igual.
3. Geo-Tracking con historial está activado y los iPhone tienen el agente ME MDM con ubicación en "siempre".
4. El correo con que cada dispositivo está inscrito en el MDM coincide con el del SPI, o existe otro dato para vincularlos (IMEI, número de serie).

**Prueba de frecuencia.** Con dos o tres teléfonos en una salida real, consultar la API cada 5 minutos durante una jornada y anotar cada cuánto llega una posición nueva.

**Criterio de salida:** la API responde, y en movimiento llega al menos una posición cada 15 minutos.

### Fase 1: mapa con la última marcación (desarrollo, 2 a 3 días)

No depende del MDM y resuelve la urgencia. Queda además como respaldo permanente.

- Agregar a la consulta de presencia en vivo las coordenadas de la última marcación de cada persona (inicio de salida, entrada o salida de visita, almuerzo) y su hora.
- Pantalla de mapa para jefatura que reutiliza el componente de mapa existente.
- Mostrar siempre hace cuánto es la posición, para que no se confunda con tiempo real.

**Criterio de salida:** jefatura ve en el mapa a todas las personas en salida activa con su último punto marcado.

### Fase 2: integración con ManageEngine (desarrollo, 4 a 6 días)

- **Vínculo usuario–dispositivo.** Tabla que relaciona cada usuario del SPI con su dispositivo en el MDM, con carga inicial por correo y ajuste manual para TI.
- **Cliente de la API.** Servicio de solo lectura contra ManageEngine. Credenciales en Secret Manager, nunca en el repositorio.
- **Consulta periódica.** Tarea programada que, cada pocos minutos, pide la posición solo de los dispositivos cuyo usuario tiene una salida operacional activa. Sigue el patrón de tareas existente (`backend/src/jobs/`, solo en la instancia de tareas).
- **Almacenamiento.** Tabla de posiciones por salida operacional: usuario, salida, latitud, longitud, precisión, hora de la posición y origen (MDM o marcación).
- **Presencia en vivo.** La consulta devuelve la posición más reciente entre MDM y marcación, indicando el origen.

**Criterio de salida:** la posición en el mapa se actualiza sola mientras dura la salida y deja de actualizarse al cerrarla.

### Fase 3: recorrido y avisos (desarrollo, 3 a 4 días)

- Recorrido de la salida en curso sobre el mapa.
- Indicador por persona: reportando, sin señal reciente, sin dispositivo vinculado.
- Aviso a jefatura cuando un dispositivo en salida supera el tiempo máximo sin reportar.
- Depuración automática de posiciones según la retención definida.

**Criterio de salida:** jefatura distingue de un vistazo quién reporta y quién no, y puede ver el recorrido del día.

### Fase 4: piloto y despliegue (1 semana)

- Piloto con un equipo (por ejemplo, servicio técnico) durante cinco días hábiles.
- Medir: porcentaje de salidas con posiciones, tiempo medio entre posiciones, dispositivos que dejaron de reportar.
- Ajustar la distancia de Geo-Tracking y el intervalo de consulta con esos datos.
- Despliegue al resto de áreas.

## 7. Privacidad y accesos

- El SPI solo consulta y guarda posiciones entre el inicio y el cierre de una salida operacional.
- Comunicar a los colaboradores, antes del piloto, qué se registra, cuándo y quién lo ve.
- Restringir en ManageEngine quién puede ver Geo-Tracking; el acceso es configurable por rol.
- Validar el tratamiento con quien lleve protección de datos personales en la empresa.

## 8. Decisiones pendientes

| # | Decisión | Quién |
|---|---|---|
| 1 | Roles que pueden ver el mapa (jefatura directa, Talento Humano, gerencia) | Gerencia |
| 2 | Si cada jefe ve solo a su equipo o a toda la empresa | Gerencia |
| 3 | Tiempo de retención de los recorridos en el SPI | Gerencia y Talento Humano |
| 4 | Tiempo máximo sin reportar antes de avisar | Jefaturas |
| 5 | Distancia de registro en el MDM: 100 m, 500 m o 1 km | TI |

## 9. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| La edición de Endpoint Central no expone la API de ubicación | La fase 2 no se puede hacer | Se detecta en la fase 0; se pasa al plan alterno |
| Usuarios desactivan el permiso de ubicación | Dispositivos sin posición | Indicador y aviso en el SPI; respaldo con la última marcación |
| La frecuencia real es menor a la esperada | El mapa se percibe como desactualizado | Mostrar siempre la antigüedad de la posición; bajar la distancia a 100 m |
| Correos distintos entre MDM y SPI | Dispositivos sin vincular | Ajuste manual del vínculo por TI |
| Límite de consultas de la API | Posiciones perdidas | Consultar solo dispositivos en salida activa |

## 10. Plan alterno

Si la fase 0 falla, la fase 1 queda en producción como solución inmediata y se evalúa empaquetar la aplicación actual como app nativa instalada por el MDM, sin App Store, con ubicación en segundo plano activa solo durante la salida operacional.

## 11. Estimación

| Fase | Responsable | Duración |
|---|---|---|
| 0. Verificación | TI | 1 a 2 días |
| 1. Mapa con última marcación | Desarrollo | 2 a 3 días |
| 2. Integración con ManageEngine | Desarrollo y TI | 4 a 6 días |
| 3. Recorrido y avisos | Desarrollo | 3 a 4 días |
| 4. Piloto y despliegue | TI y jefaturas | 1 semana |

Las fases 0 y 1 pueden correr en paralelo. Total aproximado: tres semanas hasta el despliegue general, con el mapa básico disponible en la primera.

## 12. Referencias

- [Geo-Tracking en Endpoint Central](https://www.manageengine.com/products/desktop-central/help/inventory/location_tracking.html)
- [API de dispositivos de ManageEngine MDM](https://www.manageengine.com/mobile-device-management/api/devices/)
- Módulo de asistencia: `backend/src/modules/attendance/CONTEXT.md`
