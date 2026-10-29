jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { buildGoogleMapsDeepLink } = require("../schedules.service");

describe("schedules – buildGoogleMapsDeepLink", () => {
  it("devuelve null cuando no hay paradas", () => {
    expect(buildGoogleMapsDeepLink([])).toBeNull();
    expect(buildGoogleMapsDeepLink()).toBeNull();
  });

  it("construye la URL con origen y destino cuando hay locationQuery validos", () => {
    const url = buildGoogleMapsDeepLink([
      { locationQuery: "Oficina Central" },
      { locationQuery: "Cliente Norte" },
    ]);
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
    expect(url).toContain("origin=Oficina");
    expect(url).toContain("destination=Cliente");
  });

  it("devuelve null si falta locationQuery en la primera o ultima parada", () => {
    expect(buildGoogleMapsDeepLink([{ locationQuery: "" }])).toBeNull();
  });
});
