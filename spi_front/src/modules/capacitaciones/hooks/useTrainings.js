import { useState, useCallback, useEffect } from "react";
import {
  listTrainings,
  getTraining,
  createTraining,
  updateTraining,
  cancelTraining,
  addAttendees,
  removeAttendee,
  markAttendance,
  generateActa,
  uploadExternalActa,
  uploadManualSignedActa,
  sendActaToFamSign,
  remindMainSigners,
  generateAbsentActa,
  uploadManualSignedAbsentActa,
  sendAbsentActaToFamSign,
  remindAbsentSigners,
  getMyAssigned,
} from "../../../core/api/trainingsApi";

export function useTrainings(initialFilters = {}) {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [filters, setFilters]     = useState(initialFilters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTrainings(filters);
      setTrainings(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Error al cargar capacitaciones");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return { trainings, loading, error, filters, setFilters, reload: load };
}

export function useTraining(id) {
  const [training, setTraining] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getTraining(id);
      setTraining(result);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Error al cargar capacitación");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { training, loading, error, reload: load };
}

export function useMyTrainings() {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyAssigned();
      setTrainings(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Error al cargar mis capacitaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { trainings, loading, error, reload: load };
}

export function useTrainingActions(onSuccess) {
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);

  const wrap = useCallback(async (fn, ...args) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn(...args);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [onSuccess]);

  return {
    busy,
    error,
    create:              (payload)        => wrap(createTraining, payload),
    update:              (id, payload)    => wrap(updateTraining, id, payload),
    cancel:              (id)             => wrap(cancelTraining, id),
    addAttendees:        (id, attendees)  => wrap(addAttendees, id, attendees),
    removeAttendee:      (id, attendeeId) => wrap(removeAttendee, id, attendeeId),
    markAttendance:      (id, attendance) => wrap(markAttendance, id, attendance),
    generateActa:        (id)             => wrap(generateActa, id),
    uploadExternalActa:  (id, file)       => wrap(uploadExternalActa, id, file),
    uploadManualSignedActa: (id, file)    => wrap(uploadManualSignedActa, id, file),
    sendActaToFamSign:   (id)             => wrap(sendActaToFamSign, id),
    remindMain:          (id)             => wrap(remindMainSigners, id),
    generateAbsentActa:  (id)             => wrap(generateAbsentActa, id),
    uploadManualSignedAbsentActa: (id, file) => wrap(uploadManualSignedAbsentActa, id, file),
    sendAbsentToFamSign: (id)             => wrap(sendAbsentActaToFamSign, id),
    remindAbsent:        (id)             => wrap(remindAbsentSigners, id),
  };
}
