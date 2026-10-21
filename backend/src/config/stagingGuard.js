// Aislamiento del ambiente de staging (plan RBAC, Fase 1A).
// Con NODE_ENV=staging el proceso no arranca si podria tocar produccion o avisar a personas
// reales. En cualquier otro ambiente (production incluido) no hace nada.

// Proyectos de Neon de produccion y sus relevos; ver .agents/skills/neon-compute-quota-failover-skill.md.
// Al rotar el proyecto activo hacia uno nuevo, agregarlo aqui.
const PRODUCTION_DB_HOSTS = /muddy-sun|wispy-moon|lucky-bar/i;

const isTrue = (value) => String(value || "").trim().toLowerCase() === "true";

function assertEnvironmentIsolation(env = process.env) {
  if (String(env.NODE_ENV || "").trim().toLowerCase() !== "staging") return;

  const problems = [];
  const host = String(env.DB_HOST || "").trim();
  if (!host) problems.push("DB_HOST no esta definido");
  else if (PRODUCTION_DB_HOSTS.test(host)) problems.push(`DB_HOST (${host}) es un proyecto de produccion o de relevo`);
  if (!isTrue(env.DISABLE_MAIL) && String(env.EMAIL_NOTIFICATIONS_ENABLED || "").trim().toLowerCase() !== "false") {
    problems.push("el correo no esta apagado (DISABLE_MAIL=true o EMAIL_NOTIFICATIONS_ENABLED=false)");
  }
  if (isTrue(env.ENABLE_JOBS)) problems.push("ENABLE_JOBS debe ser false");

  if (problems.length) {
    throw new Error(`Staging mal configurado, el backend no arranca: ${problems.join("; ")}.`);
  }
}

module.exports = { assertEnvironmentIsolation, PRODUCTION_DB_HOSTS };
