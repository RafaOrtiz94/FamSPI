// Hilo aparte para la simulacion de escenarios y la calibracion: es calculo puro y pesado
// (segundos a minutos por equipo); en el hilo principal bloquearia al resto de peticiones del backend.
const { parentPort, workerData } = require("worker_threads");
const { runSimulation } = require("./consumableSimulation");

try {
  let result;
  if (workerData.task === "calibrate") {
    result = require("./consumableCalibration").calibrate(workerData.model, new Map(workerData.real), workerData.options);
  } else if (workerData.task === "fitLabStatistics") {
    result = require("./labStatisticsSearch").search(workerData.model, new Map(workerData.real), workerData.bounds, workerData.options);
  } else {
    result = runSimulation(workerData.model, workerData.options);
  }
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({ ok: false, message: error?.message || String(error) });
}
