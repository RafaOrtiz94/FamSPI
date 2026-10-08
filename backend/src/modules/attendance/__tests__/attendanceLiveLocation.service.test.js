jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const { pickLatestPosition, getLiveMap } = require("../attendanceLiveLocation.service");

const T0 = "2026-10-07T17:00:00.000Z";
const T1 = "2026-10-07T18:30:00.000Z";
const T2 = "2026-10-07T19:45:00.000Z";

describe("pickLatestPosition", () => {
  test("solo inicio: usa su coordenada y la hora de inicio de la salida", () => {
    const position = pickLatestPosition({ start_location: "-1.2325,-78.6396", start_time: T0 });
    expect(position).toMatchObject({ lat: -1.2325, lng: -78.6396, at: T0, source: "start" });
  });

  test("llegada: usa la hora real de la marcacion de llegada (caso real: location_timestamp vacio)", () => {
    const position = pickLatestPosition({
      start_location: "-1.30,-78.63", start_time: T0,
      arrival_location: "-1.66,-78.65", arrival_location_timestamp: null, arrival_time: T1,
    });
    expect(position).toMatchObject({ lat: -1.66, lng: -78.65, at: T1, source: "arrival" });
  });

  test("la hora de lectura del dispositivo manda sobre la hora de la marcacion", () => {
    const position = pickLatestPosition({
      start_location: "-1.30,-78.63", start_time: T0,
      arrival_location: "-1.66,-78.65", arrival_location_timestamp: T2, arrival_time: T1,
    });
    expect(position).toMatchObject({ source: "arrival", at: T2 });
  });

  test("el evento mas avanzado gana: salida del destino sobre llegada e inicio", () => {
    const position = pickLatestPosition({
      start_location: "-1.30,-78.63", start_time: T0,
      arrival_location: "-1.66,-78.65", arrival_time: T1,
      departure_location: "-1.70,-78.60", departure_time: T2,
    });
    expect(position).toMatchObject({ source: "departure", at: T2 });
  });

  test("una visita abierta mas reciente que la llegada gana", () => {
    const position = pickLatestPosition({
      start_location: "-1.30,-78.63", start_time: T0,
      arrival_location: "-1.66,-78.65", arrival_time: T1,
      client_lat: -1.67, client_lng: -78.66, client_at: T2,
    });
    expect(position).toMatchObject({ source: "client_visit_entry", lat: -1.67, lng: -78.66, at: T2 });
  });

  test("un almuerzo operacional mas reciente que el inicio gana", () => {
    const position = pickLatestPosition({
      start_location: "-1.30,-78.63", start_time: T0,
      op_lunch_start_location: "-1.31,-78.64", op_lunch_start_time: T1,
    });
    expect(position).toMatchObject({ source: "op_lunch_start", at: T1 });
  });

  test("ignora coordenadas invalidas, fuera de rango o sin hora; null si no queda ninguna", () => {
    expect(pickLatestPosition({ start_location: "no-es-coordenada", start_time: T0 })).toBeNull();
    expect(pickLatestPosition({ start_location: "95,-78", start_time: T0 })).toBeNull();
    expect(pickLatestPosition({ start_location: "-1.2,-78.6" })).toBeNull();
    expect(pickLatestPosition({ client_lat: null, client_lng: null, client_at: T1 })).toBeNull();
    expect(pickLatestPosition({})).toBeNull();
  });
});

describe("getLiveMap", () => {
  test("incluye a quien no tiene ubicacion con position null y calcula la antiguedad", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { user_id: 1, display_name: "Con punto", start_location: "-1.2,-78.6", start_time: T0 },
        { user_id: 2, display_name: "Sin punto", start_location: null, start_time: T0 },
      ],
    });
    const result = await getLiveMap({
      operationalTypes: ["operacion_campo"],
      now: new Date("2026-10-07T17:30:00.000Z").getTime(),
    });
    expect(result).toHaveLength(2);
    expect(result[0].position).toMatchObject({ lat: -1.2, lng: -78.6, age_minutes: 30 });
    expect(result[1].position).toBeNull();
  });

  test("la consulta excluye teletrabajo y salidas cerradas", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await getLiveMap({ operationalTypes: ["operacion_campo"] });
    const [sql, params] = db.query.mock.calls.at(-1);
    expect(sql).toMatch(/<>\s*'teletrabajo'/);
    expect(sql).toMatch(/<>\s*'COMPLETED'/);
    expect(params).toEqual([["operacion_campo"]]);
  });
});
