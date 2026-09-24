import { getLocationForAction, invalidateLocationCache } from "../attendanceLocationCache";

const COLD_STRATEGY_TIMEOUT_MS = 45000;

// El mock de geolocation responde de inmediato segun el `timeout` solicitado
// (no necesitamos esperar los ms reales) -- asi distinguimos el intento
// "en frio" (unico con timeout >= 40s) del resto de estrategias rapidas.
const mockGeolocation = ({ failFastStrategies, coldFixCoords }) => {
  global.navigator.geolocation = {
    getCurrentPosition: jest.fn((success, error, options) => {
      const isColdAttempt = Number(options?.timeout) >= 40000;
      if (isColdAttempt && !failFastStrategies) {
        success({
          coords: { latitude: coldFixCoords[0], longitude: coldFixCoords[1], accuracy: 20 },
          timestamp: Date.now(),
        });
        return;
      }
      error(new Error("timeout"));
    }),
    watchPosition: jest.fn((success, error) => {
      error(new Error("timeout"));
      return 1;
    }),
    clearWatch: jest.fn(),
  };
};

describe("attendanceLocationCache — getLocationForAction sin internet", () => {
  beforeEach(() => {
    invalidateLocationCache();
    localStorage.clear();
  });

  test("cuando todas las estrategias rapidas fallan, intenta un GPS en frio con margen real (offline)", async () => {
    mockGeolocation({ failFastStrategies: false, coldFixCoords: [-2.9007, -79.0055] });

    const result = await getLocationForAction();

    expect(result.latitude).toBeCloseTo(-2.9007, 3);
    expect(result.longitude).toBeCloseTo(-79.0055, 3);

    // La estrategia en frio debe haberse pedido con margen real (>=40s), no
    // con los 4-8s que alcanzan solo cuando hay A-GPS/red.
    const coldCall = global.navigator.geolocation.getCurrentPosition.mock.calls.find(
      ([, , options]) => Number(options?.timeout) >= 40000,
    );
    expect(coldCall).toBeDefined();
    expect(coldCall[2].timeout).toBe(COLD_STRATEGY_TIMEOUT_MS);
  });

  test("cuando una estrategia rapida ya tiene exito, nunca llega a pedir el GPS en frio", async () => {
    // Todas las llamadas (incluida una posible en frio) tienen exito
    // inmediato -- si el codigo intentara la estrategia en frio de todas
    // formas, este test seguiria pasando por resultado pero fallaria por el
    // assert de "nunca se pidio timeout>=40000" de abajo.
    global.navigator.geolocation = {
      getCurrentPosition: jest.fn((success) => {
        success({ coords: { latitude: -2.9, longitude: -79.0, accuracy: 15 }, timestamp: Date.now() });
      }),
      watchPosition: jest.fn(() => 1),
      clearWatch: jest.fn(),
    };

    const result = await getLocationForAction();
    expect(result.latitude).toBeCloseTo(-2.9, 3);

    const coldCall = global.navigator.geolocation.getCurrentPosition.mock.calls.find(
      ([, , options]) => Number(options?.timeout) >= 40000,
    );
    expect(coldCall).toBeUndefined();
  });

  test("si incluso el GPS en frio falla, sigue lanzando el error claro de ubicacion obligatoria", async () => {
    mockGeolocation({ failFastStrategies: true, coldFixCoords: [0, 0] });

    await expect(getLocationForAction()).rejects.toThrow(/Ubicacion obligatoria/);
  });
});
