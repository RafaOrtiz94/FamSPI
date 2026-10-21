/**
 * Material para el jefe de cada area (plan RBAC, Fase 0): "esto es lo que hoy puede hacer tu equipo".
 *
 * Todo sale de las reglas que estan escritas en el codigo (catalogo central derivado de requireRole) y de la
 * cantidad de usuarios por rol. Cada documento muestra, por area del sistema, que acciones puede hacer cada rol
 * del equipo, quien mas comparte ese acceso, y deja casillas para que el jefe marque lo que debe ser distinto.
 * Lo que el jefe decida se aplica despues en el codigo (roles y permisos viven en requireRole).
 *
 * Solo lee la base local de staging. Uso (desde backend/):
 *   STAGING_DATABASE_URL=postgresql://... node scripts/rbac/build_area_review.js
 * Salida: docs/plans/rbac-inventory/revision-por-area/<area>.md y 00-indice.md
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { assertStagingTarget } = require("../staging/sanitize_staging_db");
const { ROLE_GROUPS } = require("../../src/middlewares/roles");

const OUT = path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory", "revision-por-area");
const REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "security", "authorization", "apiModuleRegistry.data.json"), "utf8"));

const TEAMS = [
  { key: "gerencia", label: "Gerencia", roles: ROLE_GROUPS.gerencia },
  { key: "comercial", label: "Comercial", roles: ROLE_GROUPS.comercial },
  { key: "servicio-tecnico", label: "Servicio Técnico", roles: ROLE_GROUPS.servicio_tecnico },
  { key: "operaciones", label: "Operaciones", roles: ROLE_GROUPS.operaciones },
  { key: "logistica", label: "Logística", roles: ["logistica", "jefe_logistica"] },
  { key: "finanzas", label: "Finanzas", roles: ROLE_GROUPS.finanzas },
  { key: "talento-humano", label: "Talento Humano", roles: ROLE_GROUPS.talento_humano },
  { key: "calidad", label: "Calidad", roles: ROLE_GROUPS.calidad },
  { key: "ti", label: "TI", roles: [...ROLE_GROUPS.ti, "admin_ti"] },
  { key: "externos", label: "Usuarios externos", roles: ROLE_GROUPS.ext_users },
  { key: "pasantes", label: "Pasantes", roles: ["pasante"] },
];
const teamOf = (role) => TEAMS.find((team) => team.roles.includes(role));

const ACTION = { GET: "V", HEAD: "V", POST: "C", PUT: "E", PATCH: "E", DELETE: "B" };
const ORDER = ["V", "C", "E", "B"];

function apiAreaOf(routePattern) {
  const parts = String(routePattern).split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "v1") return parts[2] || "(raiz)";
  if (parts[0] === "asistencia") return "attendance";
  return parts[0] || "(raiz)";
}

const moduleLabels = () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "..", "src", "modules", "module-access", "moduleAccess.service.js"), "utf8");
  return Object.fromEntries([...text.matchAll(/\{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
};

async function main() {
  const url = process.env.STAGING_DATABASE_URL;
  const hostname = assertStagingTarget(url);
  if (!/^(localhost|127\.0\.0\.1)$/.test(hostname)) throw new Error("Solo lee la base local de staging.");
  const target = new URL(url);
  const client = new Client({ host: target.hostname, port: Number(target.port || 5432), user: decodeURIComponent(target.username), password: decodeURIComponent(target.password), database: target.pathname.slice(1), ssl: false });
  await client.connect();
  try {
    const labels = moduleLabels();
    const { rows: userRows } = await client.query("SELECT lower(role) AS role, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE COALESCE(active, true))::int AS active FROM public.users WHERE username NOT LIKE 'prueba.%' OR username IS NULL GROUP BY 1");
    const users = Object.fromEntries(userRows.map((row) => [row.role, row]));
    const { rows: access } = await client.query(`
      SELECT r.key AS role, e.method, e.route_pattern, e.permission_key
        FROM public.rbac_endpoint_permissions e
        JOIN public.role_permissions rp ON rp.permission_key = e.permission_key
        JOIN public.roles r ON r.id = rp.role_id AND r.tenant_id IS NULL AND r.is_active`);

    // role -> api -> Set(acciones) ; api -> Set(roles) ; api -> permisos con variantes
    const byRole = {};
    const byApi = {};
    const variants = {};
    access.forEach((row) => {
      const api = apiAreaOf(row.route_pattern);
      const action = ACTION[row.method] || "C";
      ((byRole[row.role] ||= {})[api] ||= new Set()).add(action);
      (byApi[api] ||= new Set()).add(row.role);
      if (/-v\d+$/.test(row.permission_key)) (variants[api] ||= new Set()).add(row.permission_key.replace(/-v\d+$/, ""));
    });

    const roleWithUsers = (role) => (users[role]?.active || 0) > 0;
    const today = new Date().toISOString().slice(0, 10);
    fs.mkdirSync(OUT, { recursive: true });
    const index = ["# Revisión de roles y permisos por área", "",
      `Generado el ${today} por \`backend/scripts/rbac/build_area_review.js\`. No editar a mano: se regenera.`, "",
      "Cada área tiene un documento que muestra qué puede hacer hoy su equipo según las reglas escritas en el código, y deja casillas para marcar qué debería ser distinto. Lo que cada jefe responda se aplica después en el código.", "",
      "| Área | Roles con usuarios | Usuarios activos | Documento |", "|---|---|---|---|"];

    for (const team of TEAMS) {
      const teamRoles = team.roles.filter((role, i, list) => list.indexOf(role) === i);
      const active = teamRoles.filter(roleWithUsers);
      const aliases = teamRoles.filter((role) => !roleWithUsers(role) && byRole[role]);
      const total = active.reduce((sum, role) => sum + users[role].active, 0);
      index.push(`| ${team.label} | ${active.join(", ") || "(ninguno)"} | ${total} | [${team.key}.md](${team.key}.md) |`);
      if (!active.length) continue;

      const apis = Object.keys(byApi).filter((api) => active.some((role) => byRole[role]?.[api])).sort();
      const lines = [
        `# Revisión de roles y permisos — ${team.label}`, "",
        `Generado el ${today}. Para: jefe de ${team.label}. Fuente: reglas escritas en el código del sistema.`, "",
        "## Qué es esto",
        "",
        "Este documento muestra, por cada parte del sistema, **qué puede hacer hoy cada rol de tu equipo**. No es una propuesta: es lo que el sistema permite ahora. Tu trabajo es marcar lo que **debería ser diferente** para tu equipo. Las reglas viven en el código, así que TI las cambia cuando respondas.",
        "",
        "Acciones: **V** ver · **C** crear o ejecutar · **E** editar · **B** borrar. Un guion (–) significa que ese rol no puede hacer nada ahí.",
        "",
        "## Tu equipo hoy", "",
        "| Rol | Usuarios activos |", "|---|---|",
        ...active.map((role) => `| ${role} | ${users[role].active} |`), "",
        ...(aliases.length ? [`Otros nombres de rol aceptados por el sistema pero sin ningún usuario hoy: ${aliases.join(", ")}.`, ""] : []),
        "## Qué puede hacer cada rol, parte por parte del sistema", "",
        `| Parte del sistema | ${active.join(" | ")} | Otros equipos con acceso | ¿Debe ser distinto? |`,
        `|---|${active.map(() => "---").join("|")}|---|---|`,
        ...apis.map((api) => {
          const modules = (REGISTRY[`/api/v1/${api}`]?.modules || []).map((key) => labels[key]).filter(Boolean);
          const name = modules.length ? `${api} (${modules.slice(0, 2).join(", ")}${modules.length > 2 ? "…" : ""})` : api;
          const cells = active.map((role) => { const set = byRole[role]?.[api]; return set ? ORDER.filter((a) => set.has(a)).join(" ") : "–"; });
          const others = [...new Set([...byApi[api]].map((role) => teamOf(role)?.label).filter((label) => label && label !== team.label))];
          return `| ${name} | ${cells.join(" | ")} | ${others.join(", ") || "solo este equipo"} | ☐ Sin cambio ☐ Cambiar: |`;
        }),
        "",
      ];

      const split = apis.filter((api) => variants[api]);
      if (split.length) {
        lines.push("## Partes donde el sistema trata distinto a endpoints parecidos", "",
          "En estas partes, funciones parecidas aceptan conjuntos de roles distintos. Puede ser intencional o una inconsistencia. Indica cuál es la regla correcta.", "",
          ...split.map((api) => `- **${api}**: ${[...variants[api]].length} grupo(s) de funciones con reglas distintas. ☐ Es intencional ☐ Unificar así: `), "");
      }

      lines.push("## Lo que falta o sobra", "",
        "1. ¿Hay algo que tu equipo **debería poder hacer y hoy no puede**?", "", "   Respuesta: ", "",
        "2. ¿Hay algo que tu equipo **puede hacer hoy y no debería**?", "", "   Respuesta: ", "",
        "3. ¿Algún rol de tu equipo debería tener permisos distintos al resto del equipo?", "", "   Respuesta: ", "",
        "## Aprobación", "",
        "Nombre y fecha: ", "");
      fs.writeFileSync(path.join(OUT, `${team.key}.md`), lines.join("\n"));
    }

    const assigned = new Set(TEAMS.flatMap((team) => team.roles));
    const orphan = Object.keys(users).filter((role) => role && !assigned.has(role) && users[role].active > 0);
    index.push("", ...(orphan.length ? [`Roles con usuarios que no pertenecen a ninguna de estas áreas: ${orphan.join(", ")}.`, ""] : []),
      "Los usuarios con rol `pending` o `null` no aparecen: se gestionan por separado.", "",
      "Las cantidades de usuarios salen de la copia local de pruebas y pueden diferir de producción.");
    fs.writeFileSync(path.join(OUT, "00-indice.md"), index.join("\n"));
    console.log(JSON.stringify({ areas: TEAMS.length, orphan }));
  } finally {
    await client.end();
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });
