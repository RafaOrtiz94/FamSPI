import React from "react";
import { render, screen } from "@testing-library/react";
import LiveOperationalMap from "../LiveOperationalMap";
import { getAttendanceLiveMap } from "../../../../../core/api/attendanceApi";

jest.mock("../../../../../core/api/attendanceApi", () => ({ getAttendanceLiveMap: jest.fn() }));
// Sin mapa de Google en pruebas: la lista debe seguir mostrando hora y antiguedad.
jest.mock("../../../../../core/contexts/GoogleMapsContext", () => ({
  useGoogleMaps: () => ({ isLoaded: false, loadError: new Error("sin mapa") }),
}));

const entry = (overrides) => ({
  user_id: 1,
  display_name: "Ana Torres",
  status_label: "En visita",
  destination_label: "Hospital Latacunga",
  position: { lat: -0.93, lng: -78.61, at: "2026-10-07T17:00:00.000Z", age_minutes: 12, source_label: "Entrada a visita de cliente" },
  ...overrides,
});

describe("LiveOperationalMap", () => {
  beforeEach(() => jest.clearAllMocks());

  test("advierte que no es seguimiento continuo y muestra origen y antiguedad de cada punto", async () => {
    getAttendanceLiveMap.mockResolvedValue({
      data: [entry(), entry({ user_id: 2, display_name: "Luis Mora", position: { lat: -1.2, lng: -78.6, at: "2026-10-07T14:00:00.000Z", age_minutes: 185, source_label: "Inicio de la salida" } })],
      generatedAt: "2026-10-07T17:12:00.000Z",
    });
    render(<LiveOperationalMap />);
    expect(await screen.findByText("Ana Torres")).toBeTruthy();
    expect(screen.getByText(/No es seguimiento continuo/i)).toBeTruthy();
    expect(screen.getByText(/Entrada a visita de cliente/)).toBeTruthy();
    expect(screen.getByText(/hace 12 min/)).toBeTruthy();
    expect(screen.getByText(/hace 3 h 5 min/)).toBeTruthy();
  });

  test("lista aparte a quien no tiene ubicacion registrada", async () => {
    getAttendanceLiveMap.mockResolvedValue({ data: [entry({ user_id: 3, display_name: "Sin Punto", position: null })], generatedAt: null });
    render(<LiveOperationalMap />);
    expect(await screen.findByText(/Sin ubicación registrada/)).toBeTruthy();
    expect(screen.getByText(/Sin Punto/)).toBeTruthy();
  });

  test("sin salidas activas lo dice, y ante un error muestra el mensaje del servidor", async () => {
    getAttendanceLiveMap.mockResolvedValueOnce({ data: [], generatedAt: null });
    const { unmount } = render(<LiveOperationalMap />);
    expect(await screen.findByText(/No hay salidas operacionales activas/)).toBeTruthy();
    unmount();

    getAttendanceLiveMap.mockRejectedValueOnce({ response: { data: { message: "Tu rol no puede consultar" } } });
    render(<LiveOperationalMap />);
    expect(await screen.findByText("Tu rol no puede consultar")).toBeTruthy();
  });
});
