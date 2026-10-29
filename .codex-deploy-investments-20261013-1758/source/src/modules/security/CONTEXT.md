# CONTEXT.md — security

## 1. Descripción
Módulo de seguridad operacional. Detecta y permite revisar logins fuera de horario laboral (off-hours). Exclusivo para el rol TI. Incluye SIEM básico, whitelist de IPs y detección de comportamiento anómalo.

## 2. Endpoints

Prefijo: `/api/v1/security` — todos requieren verifyToken + requireRole(`ti`)

- **GET /api/v1/security/offhours-logins/export** — `exportOffHoursLogins`
- **GET /api/v1/security/offhours-logins** — `getOffHoursLogins`
- **GET /api/v1/security/offhours-logins/:id/timeline** — `getOffHoursLoginTimeline`
- **POST /api/v1/security/offhours-logins/:id/review** — `reviewOffHoursLogin`
- **POST /api/v1/security/dev/emit-offhours** — solo en entorno development (501 Not Implemented)

## 3. Flujo principal

1. Sistema detecta logins fuera de horario laboral automáticamente
2. TI consulta la lista de eventos anómalos
3. TI revisa el timeline detallado de un evento
4. TI marca el evento como revisado
5. TI puede exportar el historial

## 4. Validaciones
- Acceso exclusivo a rol `ti` (expandido por ROLE_GROUPS: `ti`, `jefe_ti`, `jefe_de_ti`, `desarrollador`, `soporte`)
- Endpoint de dev bloqueado en producción (retorna 404)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `auth`: consume datos de sesiones para detectar anomalías
- `security.siem.js` (7KB): lógica SIEM
- `security.whitelist.js` (9KB): gestión de IPs permitidas
- `security.holidays.ec.js` (4KB): calendario de feriados Ecuador para determinar "off-hours"

## 7. Frontend asociado
- No verificado en frontend (probable integración en dashboard de TI)

## 8. Riesgos detectados
- Módulo exclusivo para TI — sin acceso de gerencia para revisión cruzada

## 9. Notas técnicas
- `security.privacy.js` (1KB): utilidades de privacidad de datos
- Feriados Ecuador integrados para cálculo correcto de horario laboral
