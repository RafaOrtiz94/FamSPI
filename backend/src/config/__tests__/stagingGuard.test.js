const { assertEnvironmentIsolation } = require("../stagingGuard");

const staging = {
  NODE_ENV: "staging",
  DB_HOST: "ep-frosty-dawn-b5cn1c7v.c-7.us-east-2.aws.neon.tech",
  DISABLE_MAIL: "true",
  ENABLE_JOBS: "false",
};

describe("stagingGuard", () => {
  test("no interviene fuera de staging, aunque la base sea la de produccion", () => {
    expect(() => assertEnvironmentIsolation({ NODE_ENV: "production", DB_HOST: "ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech" })).not.toThrow();
    expect(() => assertEnvironmentIsolation({ DB_HOST: "localhost" })).not.toThrow();
    expect(() => assertEnvironmentIsolation({ NODE_ENV: "test" })).not.toThrow();
  });

  test("acepta un staging aislado", () => {
    expect(() => assertEnvironmentIsolation(staging)).not.toThrow();
    expect(() => assertEnvironmentIsolation({ ...staging, DISABLE_MAIL: undefined, EMAIL_NOTIFICATIONS_ENABLED: "false" })).not.toThrow();
  });

  test.each([
    ["base de produccion", { DB_HOST: "ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech" }, /produccion o de relevo/],
    ["base de relevo con pooler", { DB_HOST: "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech" }, /produccion o de relevo/],
    ["sin host", { DB_HOST: "" }, /DB_HOST no esta definido/],
    ["correo encendido", { DISABLE_MAIL: "false" }, /correo no esta apagado/],
    ["jobs encendidos", { ENABLE_JOBS: "true" }, /ENABLE_JOBS/],
  ])("bloquea el arranque en staging con %s", (_label, override, message) => {
    expect(() => assertEnvironmentIsolation({ ...staging, ...override })).toThrow(message);
  });
});
