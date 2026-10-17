import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("../../../../../core/api", () => ({ get: jest.fn(), put: jest.fn() }));

const { LabStatisticsPanel } = require("../DeterminationPredictions");

const statistics = {
 missingRequired: ["ise_tests_per_year"],
 statistics: [
  {
   key: "ise_tests_per_year", label: "Muestras ISE por año (Na, K y Cl)", unit: "muestras/año", help: "", max: 5000000, integer: true,
   value: null, required: true, reference: { processes: 0, value: null, minProcesses: 3, sufficient: false },
  },
  {
   key: "rerun_rate_pct", label: "Muestras que se repiten", unit: "%", help: "", max: 50,
   value: null, required: false, reference: { processes: 3, value: 4, minProcesses: 3, sufficient: true },
  },
 ],
};

describe("estadisticas del laboratorio", () => {
 it("marca lo obligatorio y explica la referencia", () => {
  render(<LabStatisticsPanel statistics={statistics} canEdit onSave={jest.fn()} />);
  expect(screen.getByText("Obligatorio")).toBeTruthy();
  expect(screen.getByText(/Sin referencia: hacen falta 3 procesos/)).toBeTruthy();
  expect(screen.getByText(/Referencia de 3 proceso\(s\) parecido\(s\)/)).toBeTruthy();
 });

 it("guarda solo lo que cambio", async () => {
  const onSave = jest.fn(async () => {});
  render(<LabStatisticsPanel statistics={statistics} canEdit onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("Muestras ISE por año (Na, K y Cl)"), { target: { value: "52000" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar estadísticas" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ise_tests_per_year: 52000 }));
 });

 it("sin permiso no se edita", () => {
  render(<LabStatisticsPanel statistics={statistics} canEdit={false} onSave={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Guardar estadísticas" })).toBeNull();
  expect(screen.getByLabelText("Muestras que se repiten").disabled).toBe(true);
 });
});

describe("entregas reales del proceso anterior", () => {
 const { DeliveryHistoryPanel } = require("../DeterminationPredictions");

 it("muestra lo cargado y permite reemplazarlo a quien valida", async () => {
  const onUpload = jest.fn(async () => {});
  render(<DeliveryHistoryPanel history={{ products: 107, byType: { calibrador: 35 }, sourceFile: "IESS.xlsx" }} canUpload onUpload={onUpload} />);
  expect(screen.getByText(/107 producto\(s\) cargado\(s\)/)).toBeTruthy();
  const file = new File(["x"], "entregas.xlsx");
  fireEvent.change(screen.getByLabelText("Archivo de control de entregas"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Reemplazar entregas" }));
  await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
 });

 it("cliente nuevo: explica que se predice con otros clientes y la carga es opcional", () => {
  render(<DeliveryHistoryPanel history={{ products: 0, referenceSources: [{ name: "HJMVI Tena", products: 58 }] }} canUpload onUpload={jest.fn()} />);
  expect(screen.getByText("Cliente sin historial de entregas")).toBeTruthy();
  expect(screen.getByText(/HJMVI Tena .58 productos./)).toBeTruthy();
  expect(screen.getByText(/Opcional/)).toBeTruthy();
 });

 it("sin permiso se ve el estado pero no la carga", () => {
  render(<DeliveryHistoryPanel history={{ products: 0, referenceSources: [] }} canUpload={false} onUpload={jest.fn()} />);
  expect(screen.getByText(/todavía no hay clientes de referencia/)).toBeTruthy();
  expect(screen.queryByLabelText("Archivo de control de entregas")).toBeNull();
 });
});
