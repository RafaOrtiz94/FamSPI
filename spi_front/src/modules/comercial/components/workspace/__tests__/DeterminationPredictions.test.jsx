import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("../../../../../core/api", () => ({ get: jest.fn(), put: jest.fn() }));

const { PredictionCell, PredictionChangeModal, predictionKey } = require("../DeterminationPredictions");

const prediction = {
 equipmentId: 16, itemType: "control", supplierCode: "5165059190", name: "PreciControl ClinChem Multi 1",
 unit: "presentacion", predicted: 5, p50: 1, p90: 5, basis: "simulation_p90", validation: null,
};

describe("prediccion del motor en Determinaciones", () => {
 it("la clave ignora ceros a la izquierda del ID del fabricante", () => {
  expect(predictionKey(16, "control", "05165059190")).toBe(predictionKey("16", "control", "5165059190"));
 });

 it("muestra la prediccion y, para quien valida, las acciones Validar y Cambiar", () => {
  const onValidate = jest.fn();
  render(<PredictionCell prediction={prediction} canValidate onValidate={onValidate} onChange={jest.fn()} />);
  expect(screen.getByText("Simulación (P90)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Validar/ }));
  expect(onValidate).toHaveBeenCalledWith(prediction);
 });

 it("sin permiso solo se ve la prediccion; validada muestra el cambio y su motivo", () => {
  const validated = { ...prediction, validation: { quantity: 8, changed: true, reason: "Corren 3 niveles" } };
  render(<PredictionCell prediction={validated} canValidate={false} onValidate={jest.fn()} onChange={jest.fn()} />);
  expect(screen.getByText("Cambiado a 8")).toBeTruthy();
  expect(screen.getByText("Motivo: Corren 3 niveles")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Validar/ })).toBeNull();
 });

 it("al cambiar la cantidad el motivo es obligatorio antes de guardar", async () => {
  const onSave = jest.fn().mockResolvedValue();
  const onClose = jest.fn();
  render(<PredictionChangeModal prediction={prediction} onClose={onClose} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText(/Cantidad correcta/), { target: { value: "8" } });
  const save = screen.getByRole("button", { name: "Guardar cambio" });
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/Por qué cambia/), { target: { value: "El laboratorio corre 3 niveles" } });
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
   equipmentId: 16, itemType: "control", supplierCode: "5165059190", quantity: 8, reason: "El laboratorio corre 3 niveles",
  }));
  expect(onClose).toHaveBeenCalled();
 });
});

describe("diferencia con PRODUCTO A ENTREGAR del Sheet", () => {
 const { SheetDifferenceModal } = require("../DeterminationPredictions");
 const differing = { ...prediction, sheetPlanned: 9, sheetDifference: 4, needsJustification: true };

 it("la celda avisa la diferencia y ofrece justificarla en vez de validar", () => {
  const onJustify = jest.fn();
  render(<PredictionCell prediction={differing} canValidate onValidate={jest.fn()} onChange={jest.fn()} onJustify={onJustify} />);
  expect(screen.getByText(/Sheet 9 \(\+4\): falta justificar/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Validar$/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Justificar diferencia/ }));
  expect(onJustify).toHaveBeenCalledWith(differing);
 });

 it("pide un motivo y un solo dato, y solo guarda si reproduce el Sheet", async () => {
  const onSave = jest.fn(async () => {});
  // Consumo esperado 5, Sheet 9, proceso de 12 meses sin entregas parciales.
  render(<SheetDifferenceModal prediction={{ ...differing, expectedConsumption: 5, partialDeliveries: 1 }} processMonths={12} onClose={jest.fn()} onSave={onSave} />);
  const save = screen.getByRole("button", { name: "Guardar justificación" });
  expect(save.disabled).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "El laboratorio consume esa cantidad" }));
  // Sugiere 9 / 12 = 0,75 por mes, que da 9.
  expect(screen.getByLabelText("Unidades por mes").value).toBe("0.75");
  expect(screen.getByText(/la cantidad da 9; el Sheet dice 9/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Unidades por mes"), { target: { value: "2" } });
  expect(screen.getByText(/da 24.*Ajuste el dato/)).toBeTruthy();
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Unidades por mes"), { target: { value: "0.75" } });
  fireEvent.click(save);
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
   quantity: 9, justification: { reason: "monthly_consumption", value: 0.75, note: null },
  })));
 });

 it("stock del cliente y decision comercial", async () => {
  const onSave = jest.fn(async () => {});
  render(<SheetDifferenceModal prediction={{ ...differing, sheetPlanned: 3, expectedConsumption: 5, partialDeliveries: 1 }} processMonths={12} onClose={jest.fn()} onSave={onSave} />);
  fireEvent.click(screen.getByRole("radio", { name: "Stock que ya tiene el cliente" }));
  expect(screen.getByLabelText("Unidades en stock").value).toBe("2");
  expect(screen.getByText(/no se usa en otros procesos/)).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Decisión comercial" }));
  const save = screen.getByRole("button", { name: "Guardar justificación" });
  fireEvent.change(screen.getByLabelText("Describa la decisión"), { target: { value: "corto" } });
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Describa la decisión"), { target: { value: "Cortesia pactada con el cliente" } });
  fireEvent.click(save);
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ justification: { reason: "commercial", value: null, note: "Cortesia pactada con el cliente" } })));
 });
});

describe("consumo esperado y producto a entregar", () => {
 it("muestra el consumo esperado cuando las entregas lo redondean", () => {
  render(<PredictionCell prediction={{ ...prediction, predicted: 8, expectedConsumption: 5, partialDeliveries: 4 }} canValidate={false} onValidate={jest.fn()} onChange={jest.fn()} />);
  expect(screen.getByText("Consumo esperado 5 · 4 entregas en presentaciones completas")).toBeTruthy();
 });

 it("sin redondeo no repite el consumo", () => {
  render(<PredictionCell prediction={{ ...prediction, predicted: 5, expectedConsumption: 5, partialDeliveries: 1 }} canValidate={false} onValidate={jest.fn()} onChange={jest.fn()} />);
  expect(screen.queryByText(/Consumo esperado/)).toBeNull();
 });
});
