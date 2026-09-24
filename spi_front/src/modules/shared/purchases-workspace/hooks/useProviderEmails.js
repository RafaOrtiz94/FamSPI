/**
 * useProviderEmails
 *
 * Persiste en localStorage una lista de correos de proveedores frecuentes.
 * Cada entrada: { email, label, saved_at }
 *
 * Uso:
 *   const { emails, save, remove, isNew } = useProviderEmails();
 *   save('proveedor@empresa.com', 'Roche Ecuador');
 *   remove('proveedor@empresa.com');
 *   isNew('other@email.com') // true si no está guardado
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'spi_provider_emails_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* ignore quota errors */ }
}

export function useProviderEmails() {
  const [emails, setEmails] = useState(load);

  const save = useCallback((email, label = '') => {
    const trimmed = email?.trim();
    if (!trimmed) return;
    setEmails((prev) => {
      if (prev.some((e) => e.email === trimmed)) return prev;
      const updated = [
        { email: trimmed, label: label.trim() || trimmed, saved_at: new Date().toISOString() },
        ...prev,
      ].slice(0, 30); // máx 30 contactos
      persist(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((email) => {
    setEmails((prev) => {
      const updated = prev.filter((e) => e.email !== email);
      persist(updated);
      return updated;
    });
  }, []);

  const updateLabel = useCallback((email, label) => {
    setEmails((prev) => {
      const updated = prev.map((e) => e.email === email ? { ...e, label: label.trim() || e.email } : e);
      persist(updated);
      return updated;
    });
  }, []);

  const isNew = useCallback(
    (email) => !emails.some((e) => e.email === email?.trim()),
    [emails],
  );

  return { emails, save, remove, updateLabel, isNew };
}
