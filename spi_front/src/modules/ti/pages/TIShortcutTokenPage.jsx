import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getUsers } from "../../../core/api/usersApi";
import {
  generateShortcutTokenForUser,
  listShortcutTokensForUser,
  revokeShortcutToken,
} from "../../../core/api/attendanceShortcutApi";

const formatDate = (value) => (value ? new Date(value).toLocaleString("es-EC") : "-");

const TIShortcutTokenPage = () => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState(null); // { token, expires_in, forUser }
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setUsers((await getUsers()) || []);
      } catch {
        toast.error("No se pudo cargar la lista de usuarios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.fullname || ""} ${u.email || ""} ${u.role || ""}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const reloadTokens = useCallback(async (selected) => {
    if (!Number.isFinite(selected) || selected <= 0) {
      setTokens([]);
      return;
    }
    setTokensLoading(true);
    try {
      setTokens((await listShortcutTokensForUser(selected)) || []);
    } catch {
      toast.error("No se pudieron cargar los tokens emitidos");
    } finally {
      setTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    setResult(null);
    reloadTokens(Number(userId));
  }, [userId, reloadTokens]);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(userId)) || null,
    [users, userId]
  );

  const onGenerate = async () => {
    const selected = Number(userId);
    if (!Number.isFinite(selected) || selected <= 0) {
      toast.error("Selecciona un usuario");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const data = await generateShortcutTokenForUser(selected);
      setResult({ token: data.token, expires_in: data.expires_in, forUser: selectedUser });
      toast.success("Token generado");
      reloadTokens(selected);
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo generar el token");
    } finally {
      setGenerating(false);
    }
  };

  const onRevoke = async (tokenId) => {
    setRevokingId(tokenId);
    try {
      await revokeShortcutToken(tokenId);
      toast.success("Token revocado");
      reloadTokens(Number(userId));
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo revocar el token");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToken = async () => {
    if (!result?.token) return;
    await navigator.clipboard.writeText(result.token);
    toast.success("Token copiado");
  };

  if (loading) {
    return <div className="p-6">Cargando usuarios...</div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800">Token de Shortcut (Siri)</h1>
      <p className="text-sm text-slate-500">
        Genera el token de larga duración que un colaborador debe pegar en su atajo de iPhone
        ("Marcar asistencia" / "Salida operacional") para marcar por voz sin abrir la app.
        Dura 6 meses y puede revocarse individualmente en cualquier momento.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Buscar usuario</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, email o rol..."
            className="w-full rounded-lg border border-slate-300 p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Usuario</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2"
          >
            <option value="">Selecciona usuario</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullname || u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={generating || !userId}
          onClick={onGenerate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {generating ? "Generando..." : "Generar token nuevo"}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
            ⚠️ Este token pertenece a: {result.forUser?.fullname || result.forUser?.email || `usuario #${userId}`}
            {result.forUser?.email ? ` (${result.forUser.email})` : ""}. Verifica que vas a pegarlo en el
            iPhone de esta persona antes de copiarlo.
          </p>
          <p className="text-sm text-green-800">
            Válido por <strong>{result.expires_in}</strong>. Pégalo en el header{" "}
            <code>Authorization: Bearer &lt;token&gt;</code> del shortcut de iPhone.
          </p>
          <textarea
            readOnly
            value={result.token}
            rows={4}
            className="w-full font-mono text-xs rounded-lg border border-green-300 bg-white p-2 resize-none"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={copyToken}
            className="rounded-lg border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
          >
            Copiar token
          </button>
        </div>
      )}

      {userId && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Tokens emitidos para este usuario</h2>
          {tokensLoading ? (
            <p className="text-sm text-slate-500">Cargando...</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no se ha generado ningún token.</p>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => {
                const isRevoked = Boolean(t.revoked_at);
                const isExpired = new Date(t.expires_at).getTime() < Date.now();
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"
                  >
                    <div>
                      <div className="text-slate-700">
                        Emitido: {formatDate(t.issued_at)} · Expira: {formatDate(t.expires_at)}
                      </div>
                      <div className="text-xs mt-0.5">
                        {isRevoked ? (
                          <span className="text-red-600 font-medium">Revocado {formatDate(t.revoked_at)}</span>
                        ) : isExpired ? (
                          <span className="text-slate-400 font-medium">Expirado</span>
                        ) : (
                          <span className="text-green-600 font-medium">Activo</span>
                        )}
                      </div>
                    </div>
                    {!isRevoked && !isExpired && (
                      <button
                        type="button"
                        disabled={revokingId === t.id}
                        onClick={() => onRevoke(t.id)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                      >
                        {revokingId === t.id ? "Revocando..." : "Revocar"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TIShortcutTokenPage;
