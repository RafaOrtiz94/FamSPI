/**
 * useProviderEmailGroups
 *
 * Persiste en localStorage grupos de correos de proveedores frecuentes
 * (ej. "Roche Ecuador" = [compras@roche.com, ventas@roche.com]), para
 * aplicarlos de una sola vez en el campo de destinatarios en vez de
 * agregar cada correo a mano cada vez.
 *
 * Cada entrada: { name, emails: string[], saved_at }
 *
 * Uso:
 *   const { groups, save, remove } = useProviderEmailGroups();
 *   save('Roche Ecuador', ['compras@roche.com', 'ventas@roche.com']);
 *   remove('Roche Ecuador');
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'spi_provider_email_groups_v1';

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

export function useProviderEmailGroups() {
  const [groups, setGroups] = useState(load);

  const save = useCallback((name, emails) => {
    const trimmedName = name?.trim();
    const cleanEmails = Array.from(new Set((emails || []).map((e) => e?.trim()).filter(Boolean)));
    if (!trimmedName || !cleanEmails.length) return;
    setGroups((prev) => {
      const withoutExisting = prev.filter((g) => g.name.toLowerCase() !== trimmedName.toLowerCase());
      const updated = [
        { name: trimmedName, emails: cleanEmails, saved_at: new Date().toISOString() },
        ...withoutExisting,
      ].slice(0, 20); // máx 20 grupos
      persist(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((name) => {
    setGroups((prev) => {
      const updated = prev.filter((g) => g.name !== name);
      persist(updated);
      return updated;
    });
  }, []);

  return { groups, save, remove };
}
