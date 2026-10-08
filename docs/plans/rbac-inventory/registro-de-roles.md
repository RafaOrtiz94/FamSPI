# Registro de roles observados

Generado el 2026-10-08 por `backend/scripts/rbac/build_access_review.js`. No editar a mano: se regenera.

Cada nombre que aparece como rol en la base, en los grupos del backend, en una guarda de endpoint o en una ruta del frontend.

- **Guardas backend**: endpoints cuya guarda nombra este valor literalmente (antes de expandir grupos).
- **Rutas frontend**: rutas cuya lista `allowedRoles` lo nombra.

| Nombre | Tipo | Pertenece a los grupos | Guardas backend | Rutas frontend |
|---|---|---|---|---|
| `acp_comercial` | rol real | comercial | 479 | 150 |
| `admin` | superrol del backend (sin usuarios) | - | 247 | 10 |
| `admin_ti` | alias o rol sin usuarios | support_ti | 169 | 150 |
| `administrador` | superrol del backend (sin usuarios) | admin | 146 | 8 |
| `analista_comercial` | alias o rol sin usuarios | comercial | 305 | 17 |
| `analista_operaciones` | alias o rol sin usuarios | operaciones | 0 | 0 |
| `analista_talento_humano` | alias o rol sin usuarios | talento_humano | 0 | 1 |
| `asesor_comercial` | alias o rol sin usuarios | comercial | 304 | 17 |
| `asistente_talento_humano` | alias o rol sin usuarios | talento_humano | 0 | 1 |
| `auxiliar_talento_humano` | alias o rol sin usuarios | talento_humano | 0 | 1 |
| `backoffice` | alias o rol sin usuarios | comercial | 256 | 17 |
| `backoffice_comercial` | capacidad (extra_roles) | comercial | 406 | 150 |
| `bc_quality_summary` | capacidad (extra_roles) | - | 2 | 1 |
| `calidad` | grupo del backend | - | 182 | 150 |
| `ceac` | alias o rol sin usuarios | - | 14 | 0 |
| `comercial` | rol real y grupo | - | 465 | 150 |
| `contador` | alias o rol sin usuarios | finanzas | 32 | 2 |
| `crm_leads_all_access` | capacidad (extra_roles) | - | 0 | 0 |
| `desarrollador` | alias o rol sin usuarios | ti | 0 | 0 |
| `director` | alias o rol sin usuarios | gerencia | 131 | 15 |
| `dispatcher` | alias o rol sin usuarios | - | 14 | 0 |
| `esp_app` | grupo del backend | tecnico, servicio_tecnico, support_ti | 189 | 150 |
| `esp_app_ext` | grupo del backend | ext_users | 47 | 150 |
| `ext_users` | grupo del backend | - | 0 | 0 |
| `financiera` | alias o rol sin usuarios | - | 2 | 0 |
| `financiero` | rol real | finanzas | 118 | 150 |
| `finanzas` | grupo del backend | - | 109 | 150 |
| `gerencia` | grupo del backend | - | 853 | 150 |
| `gerencia_general` | rol real | gerencia | 656 | 150 |
| `gerente` | alias o rol sin usuarios | gerencia | 119 | 13 |
| `gerente_general` | alias o rol sin usuarios | gerencia | 123 | 16 |
| `ing_servicio` | rol real y grupo | tecnico, servicio_tecnico, support_ti | 201 | 150 |
| `ing_servicio_ext` | rol real y grupo | ext_users | 47 | 150 |
| `jefe_calidad` | rol real y grupo | calidad | 14 | 150 |
| `jefe_comercial` | rol real y grupo | comercial | 555 | 150 |
| `jefe_de_calidad` | alias o rol sin usuarios | jefe_calidad | 3 | 0 |
| `jefe_de_comercial` | alias o rol sin usuarios | - | 0 | 15 |
| `jefe_de_finanzas` | alias o rol sin usuarios | finanzas, jefe_finanzas | 0 | 0 |
| `jefe_de_operaciones` | alias o rol sin usuarios | operaciones, jefe_operaciones | 14 | 150 |
| `jefe_de_servicio_tecnico` | alias o rol sin usuarios | tecnico, servicio_tecnico, jefe_servicio, jefe_servicio_tecnico, jefe_tecnico | 0 | 0 |
| `jefe_de_talento_humano` | alias o rol sin usuarios | talento_humano, jefe_talento_humano | 0 | 1 |
| `jefe_de_tecnico` | alias o rol sin usuarios | tecnico, servicio_tecnico, jefe_servicio, jefe_tecnico | 0 | 0 |
| `jefe_de_ti` | alias o rol sin usuarios | ti, support_ti, jefe_ti | 66 | 13 |
| `jefe_financiera` | alias o rol sin usuarios | - | 2 | 0 |
| `jefe_financiero` | rol real | finanzas | 178 | 150 |
| `jefe_finanzas` | grupo del backend | finanzas | 65 | 150 |
| `jefe_logistica` | rol real | - | 185 | 150 |
| `jefe_operaciones` | rol real y grupo | operaciones | 250 | 150 |
| `jefe_servicio` | rol real y grupo | tecnico, servicio_tecnico, support_ti, jefe_tecnico | 271 | 150 |
| `jefe_servicio_tecnico` | grupo del backend | tecnico, servicio_tecnico, jefe_servicio, support_ti, jefe_tecnico | 233 | 150 |
| `jefe_talento_humano` | grupo del backend | talento_humano | 80 | 3 |
| `jefe_tecnico` | grupo del backend | tecnico, servicio_tecnico, jefe_servicio, support_ti | 366 | 150 |
| `jefe_ti` | rol real y grupo | ti, support_ti | 362 | 150 |
| `logistica` | rol real | - | 85 | 150 |
| `null` | valor invalido en users.role | - | 0 | 0 |
| `operaciones` | rol real y grupo | - | 188 | 150 |
| `pasante` | rol real y grupo | - | 1 | 1 |
| `pending` | valor invalido en users.role | - | 0 | 0 |
| `responsable_tecnico` | alias o rol sin usuarios | tecnico, servicio_tecnico | 0 | 0 |
| `rh` | alias o rol sin usuarios | talento_humano | 0 | 1 |
| `rrhh` | alias o rol sin usuarios | talento_humano | 0 | 1 |
| `servicio_tecnico` | grupo del backend | tecnico, support_ti | 191 | 150 |
| `soporte` | alias o rol sin usuarios | ti | 0 | 0 |
| `support_ti` | grupo del backend | - | 0 | 0 |
| `talento_humano` | rol real y grupo | - | 161 | 150 |
| `tecnico` | grupo del backend | servicio_tecnico, ing_servicio, support_ti | 217 | 150 |
| `ti` | grupo del backend | support_ti | 250 | 150 |

## Para decidir

- Nombres sin usuarios que siguen en guardas o rutas (candidatos a alias obsoleto): `admin_ti`, `analista_comercial`, `analista_talento_humano`, `asesor_comercial`, `asistente_talento_humano`, `auxiliar_talento_humano`, `backoffice`, `ceac`, `contador`, `director`, `dispatcher`, `financiera`, `gerente`, `gerente_general`, `jefe_de_calidad`, `jefe_de_comercial`, `jefe_de_operaciones`, `jefe_de_talento_humano`, `jefe_de_ti`, `jefe_financiera`, `rh`, `rrhh`.
- Nombres que solo existen dentro de un grupo y nadie nombra directamente: `analista_operaciones`, `desarrollador`, `jefe_de_finanzas`, `jefe_de_servicio_tecnico`, `jefe_de_tecnico`, `responsable_tecnico`, `soporte`.
- Roles reales que ningun grupo del backend incluye: `jefe_logistica`, `logistica`.
- Nombres usados solo en el frontend (el backend no los conoce): `jefe_de_comercial`.
