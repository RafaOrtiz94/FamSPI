import React, { useEffect, useMemo, useState } from "react";
import { FiCamera, FiSave, FiAward, FiAlertCircle } from "react-icons/fi";
import { fetchMyProfile, upsertMyProfile } from "../../core/api/userProfileApi";
import { useUI } from "../../core/ui/UIContext";
import Modal from "../../core/ui/components/Modal";
import { useAuth } from "../../core/auth/AuthContext";
import CertificationsBoard from "./components/CertificationsBoard";

const emptyMetadata = {
  job_title: "",
  phone: "",
  extension: "",
  location: "",
  about: "",
  personal: {
    telefono_personal: "",
    email_personal: "",
    estado_civil: "",
  },
  domicilio: {
    ciudad_domicilio: "",
    direccion_domicilio: "",
    telefono_fijo: "",
  },
  emergencia: {
    persona_contacto: "",
    telefono_contacto: "",
  },
};

const emptyPreferences = {
  theme: "light",
  language: "es",
  density: "comfortable",
};

const reviewSections = [
  {
    key: "personal",
    title: "Contacto personal",
    fields: [
      { key: "telefono_personal", label: "Teléfono personal" },
      { key: "email_personal", label: "Email personal" },
      { key: "estado_civil", label: "Estado civil" },
    ],
  },
  {
    key: "domicilio",
    title: "Domicilio",
    fields: [
      { key: "ciudad_domicilio", label: "Ciudad" },
      { key: "direccion_domicilio", label: "Dirección" },
      { key: "telefono_fijo", label: "Teléfono fijo" },
    ],
  },
  {
    key: "emergencia",
    title: "Contacto de emergencia",
    fields: [
      { key: "persona_contacto", label: "Persona de contacto" },
      { key: "telefono_contacto", label: "Teléfono contacto" },
    ],
  },
];


const MyProfilePage = () => {
  const { showToast, showLoader, hideLoader, theme, setTheme } = useUI();
  const { user, reloadProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({});
  const [saving, setSaving] = useState(false);


  const needsReview = useMemo(() => {
    const last = metadata?.profile_last_reviewed_at;
    if (!last) return true;
    const lastDate = new Date(last);
    if (Number.isNaN(lastDate.getTime())) return true;
    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 365;
  }, [metadata?.profile_last_reviewed_at]);

  const buildReviewData = (source = {}) => {
    const result = {};
    reviewSections.forEach((section) => {
      result[section.key] = {
        ...(source?.[section.key] || {}),
      };
    });
    return result;
  };
  const identity = useMemo(() => profile?.identity || user, [profile?.identity, user]);

  useEffect(() => {
    const load = async () => {
      try {
        showLoader();
        const data = await fetchMyProfile();
        setProfile(data);

        const rawMetadata = data?.profile?.metadata || {};
        const incomingMetadata = {
          ...emptyMetadata,
          ...rawMetadata,
          personal: {
            ...(emptyMetadata.personal || {}),
            ...(rawMetadata.personal || {}),
          },
          domicilio: {
            ...(emptyMetadata.domicilio || {}),
            ...(rawMetadata.domicilio || {}),
          },
          emergencia: {
            ...(emptyMetadata.emergencia || {}),
            ...(rawMetadata.emergencia || {}),
          },
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

      {needsReview && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <FiAlertCircle className="mt-0.5" />
              <div>
                <p className="font-semibold">Actualización anual de datos</p>
                <p className="text-xs text-amber-800">
                  Debes confirmar tus datos personales. Esto ayuda a mantener vacaciones, permisos y contactos actualizados.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setReviewData(buildReviewData(metadata || {}));
                setShowReviewModal(true);
              }}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Actualizar ahora
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg dark:border-slate-800">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback si la imagen de Drive no carga
                    console.warn('Error cargando imagen de perfil:', avatarPreview);
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              {/* Fallback siempre visible cuando no hay avatarPreview o cuando hay error */}
              <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-3xl font-bold text-slate-600 dark:from-slate-800 dark:to-slate-700 dark:text-slate-200 ${avatarPreview ? 'hidden' : ''}`}>
                {(identity?.fullname || identity?.email || "?").charAt(0).toUpperCase()}
              </div>
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

          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-800 dark:bg-amber-900/40">
            <div className="flex items-center gap-3 mb-4">
              <FiAward className="text-amber-600 dark:text-amber-400" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Mis Credenciales</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">Gestiona tus certificaciones, cursos y títulos profesionales</p>
              </div>
            </div>
            <CertificationsBoard />
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


      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="Actualización anual de datos"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Actualiza tus datos personales. Estos cambios se reflejarán en los módulos de permisos, vacaciones y reportes internos.
          </p>
          <div className="grid gap-4">
            {reviewSections.map((section) => (
              <div key={section.key} className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">{section.title}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <label key={field.key} className="text-xs text-slate-600">
                      <span className="uppercase font-medium">{field.label}</span>
                      <input
                        type="text"
                        value={reviewData?.[section.key]?.[field.key] || ""}
                        onChange={(e) =>
                          setReviewData((prev) => ({
                            ...(prev || {}),
                            [section.key]: {
                              ...(prev?.[section.key] || {}),
                              [field.key]: e.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowReviewModal(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  setSaving(true);
                  showLoader();
                  const nextMetadata = {
                    ...metadata,
                    ...reviewData,
                    profile_last_reviewed_at: new Date().toISOString(),
                  };
                  const data = await upsertMyProfile({ metadata: nextMetadata, preferences, avatarFile: null });
                  setProfile((prev) => ({ ...prev, profile: data }));
                  setMetadata({ ...nextMetadata });
                  setShowReviewModal(false);
                  await reloadProfile?.();
                  showToast("Datos actualizados", "success");
                } catch (err) {
                  console.error(err);
                  showToast(err.message || "Error al actualizar", "error");
                } finally {
                  setSaving(false);
                  hideLoader();
                }
              }}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Guardar actualización
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default MyProfilePage;
