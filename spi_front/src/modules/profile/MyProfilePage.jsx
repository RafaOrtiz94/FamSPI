import React, { useEffect, useMemo, useState } from "react";
import { FiCamera, FiSave } from "react-icons/fi";
import { fetchMyProfile, upsertMyProfile } from "../../core/api/userProfileApi";
import { useUI } from "../../core/ui/UIContext";
import { useAuth } from "../../core/auth/AuthContext";

const emptyMetadata = {
  job_title: "",
  phone: "",
  extension: "",
  location: "",
  about: "",
};

const emptyPreferences = {
  theme: "light",
  language: "es",
  density: "comfortable",
};

const MyProfilePage = () => {
  const { showToast, showLoader, hideLoader, theme, setTheme } = useUI();
  const { user, reloadProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const identity = useMemo(() => profile?.identity || user, [profile?.identity, user]);

  useEffect(() => {
    const load = async () => {
      try {
        showLoader();
        const data = await fetchMyProfile();
        setProfile(data);

        const incomingMetadata = {
          ...emptyMetadata,
          ...(data?.profile?.metadata || {}),
        };
        const incomingPrefs = {
          ...emptyPreferences,
          ...(data?.profile?.preferences || {}),
        };

        setMetadata(incomingMetadata);
        setPreferences(incomingPrefs);

        if (data?.profile?.avatar_url) {
          setAvatarPreview(data.profile.avatar_url);
        }

        if (incomingPrefs.theme && incomingPrefs.theme !== theme) {
          setTheme(incomingPrefs.theme);
        }
      } catch (err) {
        console.error(err);
        showToast("No se pudo cargar tu perfil", "error");
      } finally {
        hideLoader();
      }
    };

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Formato no permitido. Usa PNG/JPEG/WEBP", "warning");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen debe pesar máximo 2MB", "warning");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      showLoader();

      const data = await upsertMyProfile({ metadata, preferences, avatarFile });
      setProfile((prev) => ({ ...prev, profile: data }));
      // Sincroniza header/contexts con el nuevo avatar
      await reloadProfile?.();
      if (data?.avatar_url) {
        setAvatarPreview(data.avatar_url);
      }
      showToast("Perfil actualizado", "success");
      setAvatarFile(null);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error al actualizar el perfil", "error");
    } finally {
      setSaving(false);
      hideLoader();
    }
  };

  const labelClass = "text-sm font-semibold text-slate-700 dark:text-slate-200";
  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Seguridad</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Perfil</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Administra tu información interna sin afectar los datos del IdP.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <FiSave />
            Guardar cambios
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg dark:border-slate-800">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-3xl font-bold text-slate-600 dark:from-slate-800 dark:to-slate-700 dark:text-slate-200">
                  {(identity?.fullname || identity?.email || "?").charAt(0)}
                </div>
              )}
              <label className="absolute bottom-2 right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark">
                <FiCamera />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {identity?.fullname || "Nombre no disponible"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-300">{identity?.email}</p>
              <p className="text-xs uppercase text-slate-400 dark:text-slate-500">{identity?.role}</p>
            </div>
          </div>

          <div className="space-y-2 text-left">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Preferencias rápidas</p>
            <div className="flex flex-col gap-3">
              <label className={labelClass}>
                Tema
                <select
                  value={preferences.theme}
                  onChange={(e) => setPreferences((p) => ({ ...p, theme: e.target.value }))}
                  className={inputClass}
                >
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </label>
              <label className={labelClass}>
                Densidad
                <select
                  value={preferences.density}
                  onChange={(e) => setPreferences((p) => ({ ...p, density: e.target.value }))}
                  className={inputClass}
                >
                  <option value="comfortable">Cómoda</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
              <label className={labelClass}>
                Idioma
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences((p) => ({ ...p, language: e.target.value }))}
                  className={inputClass}
                >
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Datos internos</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Estos campos son internos y no modifican la información del proveedor de identidad.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Cargo interno
                <input
                  type="text"
                  value={metadata.job_title}
                  onChange={(e) => setMetadata((m) => ({ ...m, job_title: e.target.value }))}
                  className={inputClass}
                  placeholder="Ej. Coordinador de proyectos"
                />
              </label>
              <label className={labelClass}>
                Teléfono corporativo
                <input
                  type="tel"
                  value={metadata.phone}
                  onChange={(e) => setMetadata((m) => ({ ...m, phone: e.target.value }))}
                  className={inputClass}
                  placeholder="Número interno"
                />
              </label>
              <label className={labelClass}>
                Extensión
                <input
                  type="text"
                  value={metadata.extension}
                  onChange={(e) => setMetadata((m) => ({ ...m, extension: e.target.value }))}
                  className={inputClass}
                  placeholder="0000"
                />
              </label>
              <label className={labelClass}>
                Ubicación / Oficina
                <input
                  type="text"
                  value={metadata.location}
                  onChange={(e) => setMetadata((m) => ({ ...m, location: e.target.value }))}
                  className={inputClass}
                  placeholder="Edificio / Piso"
                />
              </label>
            </div>

            <label className={`${labelClass} mt-4 block`}>
              Nota interna
              <textarea
                rows={4}
                value={metadata.about}
                onChange={(e) => setMetadata((m) => ({ ...m, about: e.target.value }))}
                className={`${inputClass} min-h-[120px]`}
                placeholder="Información relevante para el equipo (no visible al IdP)"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/40">
            <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Recordatorios de seguridad</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-emerald-900/90 dark:text-emerald-100/90">
              <li>El email y nombre completo siguen siendo gestionados por el proveedor de identidad.</li>
              <li>Las preferencias se aplican sólo dentro de la aplicación y no afectan OAuth.</li>
              <li>Las actualizaciones quedan registradas en la bitácora de auditoría.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MyProfilePage;
