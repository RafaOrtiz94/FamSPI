import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiEye,
  FiLoader,
  FiRadio,
  FiSend,
  FiTarget,
  FiUserCheck,
} from "react-icons/fi";
import {
  createWorldCupLiveStream,
  createWorldCupSubmission,
  getStoredParticipantToken,
  getWorldCupPortal,
  setStoredParticipantToken,
} from "../api/worldCup2026Api";
import { getTeamFlag } from "../utils/teamFlags";

const initialForm = {
  participant_name: "",
  identity_document: "",
  email: "",
  company_name: "",
  semi_1_home_score: "",
  semi_1_away_score: "",
  semi_1_home_penalties: "",
  semi_1_away_penalties: "",
  semi_2_home_score: "",
  semi_2_away_score: "",
  semi_2_home_penalties: "",
  semi_2_away_penalties: "",
  final_home_score: "",
  final_away_score: "",
  final_home_penalties: "",
  final_away_penalties: "",
  third_place_team: "",
  fourth_place_team: "",
  consent_accepted: false,
};

const fieldClassName =
  "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    return new Date(value).toLocaleString("es-EC", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatShortDate(value) {
  if (!value) return "";
  try {
    return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function parseScore(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function StatusPill({ open }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] ${
        open ? "bg-lime-300 text-stone-950" : "bg-amber-200 text-amber-950"
      }`}
    >
      <FiRadio className={open ? "animate-pulse" : ""} />
      {open ? "En vivo" : "Cerrado"}
    </div>
  );
}

function BoardCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
          <Icon />
        </div>
        <h3 className="text-lg font-bold text-stone-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function TeamFlag({ teamName, size = "md" }) {
  const { svgMarkup } = getTeamFlag(teamName);
  const sizeClassName = size === "sm" ? "h-6 w-6" : "h-7 w-7";

  if (svgMarkup) {
    return (
      <span
        className={`${sizeClassName} block shrink-0 overflow-hidden rounded-full shadow-sm`}
        role="img"
        aria-label={teamName ? `Bandera de ${teamName}` : "Bandera"}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} flex shrink-0 items-center justify-center rounded-full bg-stone-200 text-[10px] font-black uppercase text-stone-600`}
      aria-hidden="true"
    >
      {String(teamName || "?").slice(0, 2)}
    </div>
  );
}

function getTeamShortName(teamName) {
  const normalized = String(teamName || "").trim();
  if (!normalized) return "--";

  const known = {
    France: "FRA",
    Spain: "ESP",
    England: "ENG",
    Argentina: "ARG",
  };

  if (known[normalized]) return known[normalized];

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function TeamChip({ teamName, align = "left", muted = false }) {
  const alignment = align === "right" ? "justify-end text-right" : "justify-start text-left";
  const shortName = getTeamShortName(teamName);

  return (
    <div
      className={`flex min-w-0 w-full items-center gap-2 rounded-full px-2.5 py-2 text-sm font-semibold ${
        muted ? "bg-stone-200 text-stone-500" : "bg-white text-stone-900 shadow-sm"
      } ${alignment}`}
    >
      {align !== "right" ? <TeamFlag teamName={teamName} /> : null}
      <span className="min-w-0 truncate text-xs font-black uppercase tracking-[0.16em]">{shortName}</span>
      {align === "right" ? <TeamFlag teamName={teamName} /> : null}
    </div>
  );
}

function ScoreInput({ name, value, onChange, disabled }) {
  return (
    <input
      className="h-12 w-12 rounded-2xl border border-stone-300 bg-white text-center text-lg font-black text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 sm:w-14"
      type="number"
      min="0"
      max="20"
      inputMode="numeric"
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={!disabled}
    />
  );
}

function PenaltiesRow({ title, homeName, awayName, homeInputName, awayInputName, homeValue, awayValue, onChange, disabled = false }) {
  return (
    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">{title}</p>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-800">
          Obligatorio si empatan
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamFlag teamName={homeName} size="sm" />
          <span className="truncate text-xs font-black uppercase tracking-[0.16em] text-stone-700">
            {getTeamShortName(homeName)}
          </span>
        </div>

        <ScoreInput name={homeInputName} value={homeValue} onChange={onChange} disabled={disabled} />

        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">pen</span>

        <ScoreInput name={awayInputName} value={awayValue} onChange={onChange} disabled={disabled} />

        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate text-xs font-black uppercase tracking-[0.16em] text-stone-700">
            {getTeamShortName(awayName)}
          </span>
          <TeamFlag teamName={awayName} size="sm" />
        </div>
      </div>
    </div>
  );
}

function PositionSelect({ label, name, value, onChange, options }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">{label}</span>
      <select
        className={`${fieldClassName} bg-white`}
        name={name}
        value={value}
        onChange={onChange}
        required
      >
        <option value="">Selecciona un equipo</option>
        {options.map((team) => (
          <option key={`${name}-${team}`} value={team}>
            {team}
          </option>
        ))}
      </select>
    </label>
  );
}

function PositionDisplay({ label, teamName }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">{label}</span>
      <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3">
        <TeamFlag teamName={teamName} size="sm" />
        <span className="text-sm font-bold text-stone-900">{teamName || "Se define con tus marcadores"}</span>
      </div>
    </div>
  );
}

function MatchCard({
  fixture,
  homeScoreName,
  awayScoreName,
  homePenaltiesName,
  awayPenaltiesName,
  homeScore,
  awayScore,
  homePenalties,
  awayPenalties,
  onChange,
  disabled = false,
}) {
  const isDraw = parseScore(homeScore) !== null && parseScore(homeScore) === parseScore(awayScore);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-stone-100/80 p-4 shadow-inner">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">{fixture?.label}</p>
          <p className="mt-1 text-sm text-stone-600">
            {formatShortDate(fixture?.match_date)} {fixture?.city ? `· ${fixture.city}` : ""}
          </p>
        </div>
        <div className="rounded-full bg-stone-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-lime-300">
          {fixture?.stage}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <TeamChip teamName={fixture?.home_team} />
          </div>
          <div className="min-w-0">
            <TeamChip teamName={fixture?.away_team} align="right" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <ScoreInput name={homeScoreName} value={homeScore} onChange={onChange} disabled={disabled} />
          <span className="text-center text-sm font-black uppercase tracking-[0.16em] text-stone-500">vs</span>
          <ScoreInput name={awayScoreName} value={awayScore} onChange={onChange} disabled={disabled} />
        </div>

        {isDraw ? (
          <PenaltiesRow
            title="Definicion por penales"
            homeName={fixture?.home_team}
            awayName={fixture?.away_team}
            homeInputName={homePenaltiesName}
            awayInputName={awayPenaltiesName}
            homeValue={homePenalties}
            awayValue={awayPenalties}
            onChange={onChange}
            disabled={disabled}
          />
        ) : null}
      </div>
    </div>
  );
}

function BracketLayout({ fixtures, form, onChange, finalDisabled }) {
  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-stone-900">Bracket de resultados</h3>
          <p className="mt-1 text-sm text-stone-500">
            Suma puntos por ganador, marcador exacto y posiciones finales.
          </p>
        </div>
        <div className="rounded-full bg-lime-300 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-stone-950">
          500 puntos
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] xl:items-center">
        <div className="space-y-5">
          <MatchCard
            fixture={{ ...fixtures?.semi_1, label: "Semifinal 1" }}
            homeScoreName="semi_1_home_score"
            awayScoreName="semi_1_away_score"
            homePenaltiesName="semi_1_home_penalties"
            awayPenaltiesName="semi_1_away_penalties"
            homeScore={form.semi_1_home_score}
            awayScore={form.semi_1_away_score}
            homePenalties={form.semi_1_home_penalties}
            awayPenalties={form.semi_1_away_penalties}
            onChange={onChange}
          />
          <MatchCard
            fixture={{ ...fixtures?.semi_2, label: "Semifinal 2" }}
            homeScoreName="semi_2_home_score"
            awayScoreName="semi_2_away_score"
            homePenaltiesName="semi_2_home_penalties"
            awayPenaltiesName="semi_2_away_penalties"
            homeScore={form.semi_2_home_score}
            awayScore={form.semi_2_away_score}
            homePenalties={form.semi_2_home_penalties}
            awayPenalties={form.semi_2_away_penalties}
            onChange={onChange}
          />
        </div>

        <div className="hidden xl:flex justify-center">
          <div className="h-64 w-px bg-stone-300" />
        </div>

        <div>
          <MatchCard
            fixture={{ ...fixtures?.final, label: "Final" }}
            homeScoreName="final_home_score"
            awayScoreName="final_away_score"
            homePenaltiesName="final_home_penalties"
            awayPenaltiesName="final_away_penalties"
            homeScore={form.final_home_score}
            awayScore={form.final_away_score}
            homePenalties={form.final_home_penalties}
            awayPenalties={form.final_away_penalties}
            onChange={onChange}
            disabled={finalDisabled}
          />
          {finalDisabled ? (
            <p className="mt-3 text-sm text-amber-700">
              Define primero un ganador en cada semifinal para habilitar la final.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultSummary({ prediction, createdAt, referenceCode }) {
  const matches = [
    { label: "Semifinal 1", match: prediction?.semi_1 },
    { label: "Semifinal 2", match: prediction?.semi_2 },
    { label: "Final", match: prediction?.final },
  ];

  return (
    <div className="rounded-[1.75rem] bg-emerald-50 p-8">
      <FiCheckCircle className="text-4xl text-emerald-700" />
      <h2 className="mt-4 text-2xl font-bold text-stone-900">Tu prediccion ya fue registrada</h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Este navegador ya esta identificado con tu participacion. Famproject Cia. Ltda. conserva tu registro para esta dinamica promocional.
      </p>

      {referenceCode ? (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Codigo</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{referenceCode}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {matches.map((item) => (
          <div key={item.label} className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">{item.label}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-900">
                <TeamFlag teamName={item.match?.home_team} size="sm" />
                <span className="truncate">{item.match?.home_team || "Por definir"}</span>
              </span>
              <span className="text-base font-black text-emerald-700">
                {item.match?.home_score} - {item.match?.away_score}
                {item.match?.home_score === item.match?.away_score &&
                item.match?.home_penalties !== null &&
                item.match?.away_penalties !== null
                  ? ` (${item.match?.home_penalties}-${item.match?.away_penalties} pen)`
                  : ""}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-900">
                <span className="truncate">{item.match?.away_team || "Por definir"}</span>
                <TeamFlag teamName={item.match?.away_team} size="sm" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Campeon</p>
          <p className="mt-2 text-sm font-bold text-stone-900">{prediction?.positions?.champion_team || "Sin definir"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Vicecampeon</p>
          <p className="mt-2 text-sm font-bold text-stone-900">{prediction?.positions?.runner_up_team || "Sin definir"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Tercer lugar</p>
          <p className="mt-2 text-sm font-bold text-stone-900">{prediction?.positions?.third_place_team || "Sin definir"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Cuarto lugar</p>
          <p className="mt-2 text-sm font-bold text-stone-900">{prediction?.positions?.fourth_place_team || "Sin definir"}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Campeon proyectado</p>
          <p className="mt-2 text-lg font-black text-stone-900">{prediction?.predicted_champion_team || "Por definir"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Registrado</p>
          <p className="mt-2 text-sm font-bold text-stone-900">{formatDate(createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

export default function WorldCup2026PortalPage() {
  const [portal, setPortal] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [participantToken, setParticipantToken] = useState(() => getStoredParticipantToken());

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        setLoadError("");
        const response = await getWorldCupPortal(participantToken);
        if (!active) return;
        setPortal(response?.data || null);
      } catch (error) {
        if (!active) return;
        setLoadError(error?.response?.data?.message || error.message || "No se pudo cargar el portal.");
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [participantToken]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let stream;

    try {
      stream = createWorldCupLiveStream();
      stream.addEventListener("board-snapshot", (event) => {
        try {
          const payload = JSON.parse(event.data);
          setPortal((current) => ({
            ...(current || {}),
            board: payload,
          }));
        } catch (_error) {
          // no-op
        }
      });
    } catch (_error) {
      return undefined;
    }

    return () => {
      if (stream) stream.close();
    };
  }, []);

  const participantProfile = portal?.participant || successData || null;
  const board = portal?.board || { stats: {}, leaderboard: [], latest_participants: [] };
  const fixtures = portal?.fixtures || board?.fixtures || {};
  const participantTeamOptions = portal?.participant_team_options || [
    fixtures?.semi_1?.home_team,
    fixtures?.semi_1?.away_team,
    fixtures?.semi_2?.home_team,
    fixtures?.semi_2?.away_team,
  ].filter(Boolean);
  const isClosed = portal && portal.participation_open === false;

  const resolveWinnerWithPenalties = (homeTeam, awayTeam, homeScore, awayScore, homePenalties, awayPenalties) => {
    const mainHome = parseScore(homeScore);
    const mainAway = parseScore(awayScore);
    if (mainHome === null || mainAway === null || !homeTeam || !awayTeam) return null;
    if (mainHome !== mainAway) return mainHome > mainAway ? homeTeam : awayTeam;
    const pensHome = parseScore(homePenalties);
    const pensAway = parseScore(awayPenalties);
    if (pensHome === null || pensAway === null || pensHome === pensAway) return null;
    return pensHome > pensAway ? homeTeam : awayTeam;
  };

  const semi1Winner = resolveWinnerWithPenalties(
    fixtures?.semi_1?.home_team,
    fixtures?.semi_1?.away_team,
    form.semi_1_home_score,
    form.semi_1_away_score,
    form.semi_1_home_penalties,
    form.semi_1_away_penalties
  );
  const semi2Winner = resolveWinnerWithPenalties(
    fixtures?.semi_2?.home_team,
    fixtures?.semi_2?.away_team,
    form.semi_2_home_score,
    form.semi_2_away_score,
    form.semi_2_home_penalties,
    form.semi_2_away_penalties
  );

  const finalFixture = {
    ...(fixtures?.final || {}),
    home_team: semi1Winner || fixtures?.final?.home_team || null,
    away_team: semi2Winner || fixtures?.final?.away_team || null,
  };

  const championTeam = resolveWinnerWithPenalties(
    finalFixture.home_team,
    finalFixture.away_team,
    form.final_home_score,
    form.final_away_score,
    form.final_home_penalties,
    form.final_away_penalties
  );
  const runnerUpTeam =
    championTeam && finalFixture.home_team && finalFixture.away_team
      ? championTeam === finalFixture.home_team
        ? finalFixture.away_team
        : finalFixture.home_team
      : null;

  const finalDisabled = !semi1Winner || !semi2Winner;

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (
      parseScore(form.semi_1_home_score) === parseScore(form.semi_1_away_score) &&
      (parseScore(form.semi_1_home_penalties) === null ||
        parseScore(form.semi_1_away_penalties) === null ||
        parseScore(form.semi_1_home_penalties) === parseScore(form.semi_1_away_penalties))
    ) {
      setSubmitError("Si la semifinal 1 queda empatada, debes definir un ganador por penales.");
      return;
    }
    if (
      parseScore(form.semi_2_home_score) === parseScore(form.semi_2_away_score) &&
      (parseScore(form.semi_2_home_penalties) === null ||
        parseScore(form.semi_2_away_penalties) === null ||
        parseScore(form.semi_2_home_penalties) === parseScore(form.semi_2_away_penalties))
    ) {
      setSubmitError("Si la semifinal 2 queda empatada, debes definir un ganador por penales.");
      return;
    }
    if (
      parseScore(form.final_home_score) === parseScore(form.final_away_score) &&
      (parseScore(form.final_home_penalties) === null ||
        parseScore(form.final_away_penalties) === null ||
        parseScore(form.final_home_penalties) === parseScore(form.final_away_penalties))
    ) {
      setSubmitError("Si la final queda empatada, debes definir un ganador por penales.");
      return;
    }
    if (finalDisabled) {
      setSubmitError("Primero define los ganadores de ambas semifinales.");
      return;
    }
    if (
      new Set([championTeam, runnerUpTeam, form.third_place_team, form.fourth_place_team].filter(Boolean)).size !== 4
    ) {
      setSubmitError("Campeon, vicecampeon, tercer y cuarto lugar deben ser equipos distintos.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await createWorldCupSubmission({
        ...form,
        champion_team: championTeam,
        runner_up_team: runnerUpTeam,
      });
      const created = response?.data || null;
      if (created?.participant_token) {
        setStoredParticipantToken(created.participant_token);
        setParticipantToken(created.participant_token);
      }
      setSuccessData(created);
    } catch (error) {
      setSubmitError(error?.response?.data?.message || error.message || "No se pudo registrar tu prediccion.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dcfce7,_#fafaf9_55%)] px-6 py-16">
        <div className="mx-auto flex max-w-2xl items-center justify-center rounded-3xl bg-white/90 p-12 shadow-xl">
          <FiLoader className="mr-3 animate-spin text-2xl text-emerald-700" />
          <span className="text-sm font-medium text-stone-700">Cargando portal de predicciones...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fee2e2,_#fafaf9_55%)] px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-10 shadow-xl">
          <div className="mb-4 flex items-center gap-3 text-red-700">
            <FiAlertCircle className="text-2xl" />
            <h1 className="text-xl font-semibold">No se pudo abrir el portal</h1>
          </div>
          <p className="text-sm text-stone-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#d9f99d,_#fafaf9_40%,_#dcfce7_100%)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]"
        >
          <section className="overflow-hidden rounded-[2rem] bg-stone-950 px-7 py-8 text-white shadow-2xl sm:px-10 sm:py-10">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.25em] text-lime-300">
                Promocion Famproject Cia. Ltda.
              </div>
              <StatusPill open={!isClosed} />
            </div>

            <h1 className="max-w-xl text-4xl font-black uppercase leading-none sm:text-5xl">
              {portal?.title || "Predicciones Mundial 2026"}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
              {portal?.subtitle ||
                "Pronostica las semifinales y la final del Mundial 2026 en la experiencia digital de Famproject Cia. Ltda."}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-300">Acceso</p>
                <p className="mt-2 text-lg font-semibold">Portal Famproject</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-300">Participantes</p>
                <p className="mt-2 text-lg font-semibold">{board.stats?.total_participants || 0}</p>
              </div>
              <div className="rounded-3xl bg-lime-300 p-5 text-stone-950">
                <p className="text-xs uppercase tracking-[0.2em]">Criterio</p>
                <p className="mt-2 text-lg font-semibold">Hasta 500 puntos</p>
              </div>
            </div>

            {participantProfile ? (
              <div className="mt-10 rounded-[1.75rem] border border-lime-300/30 bg-lime-300/10 p-6">
                <div className="flex items-center gap-3 text-lime-300">
                  <FiUserCheck className="text-xl" />
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">Participante identificado</p>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">{participantProfile.participant_name}</h2>
                <p className="mt-2 text-sm text-stone-300">
                  {participantProfile.company_name} · {participantProfile.identity_document}
                </p>
                {"score" in participantProfile ? (
                  <p className="mt-4 text-sm text-stone-200">
                    Puntaje actual:{" "}
                    <span className="font-black text-lime-300">{participantProfile.score?.total_points ?? 0} pts</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-10 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-semibold text-lime-300">Reglas del portal</p>
                <ul className="mt-4 space-y-3 text-sm text-stone-200">
                  <li>Se registra una sola participacion por correo y documento de identidad.</li>
                  <li>El sistema permitira tan solo una participación por usuario.</li>
                  <li>Ganador correcto: 50 puntos. Marcador exacto: 100 puntos. Posicion final correcta: 50 puntos.</li>
                </ul>
              </div>
            )}
          </section>

          <section className="grid gap-6">
            <BoardCard title="Tablero en vivo" icon={FiEye}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-stone-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-stone-700">Quien va ganando</h4>
                    <span className="text-xs font-semibold text-emerald-700">Tiempo real</span>
                  </div>
                  <div className="space-y-3">
                    {board.leaderboard?.length ? (
                      board.leaderboard.map((item) => (
                        <div
                          key={item.participant_token}
                          className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
                        >
                          <div>
                            <p className="text-sm font-bold text-stone-900">
                              #{item.rank} {item.participant_name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-stone-500">{item.company_name}</span>
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                                <TeamFlag teamName={item.predicted_champion_team} size="sm" />
                                <span>{item.predicted_champion_team || "Sin finalista"}</span>
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-emerald-700">{item.total_points} pts</p>
                            <p className="text-[11px] text-stone-500">
                              exactos {item.exact_score_hits} · pos {item.position_hits}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-stone-500">Aun no hay participantes suficientes para mostrar ranking.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl bg-stone-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-stone-700">Quien ha postulado</h4>
                    <span className="text-xs font-semibold text-emerald-700">Ultimos ingresos</span>
                  </div>
                  <div className="space-y-3">
                    {board.latest_participants?.length ? (
                      board.latest_participants.map((item) => (
                        <div
                          key={`${item.participant_token}-${item.created_at}`}
                          className="rounded-2xl bg-white px-4 py-3 shadow-sm"
                        >
                          <p className="text-sm font-bold text-stone-900">{item.participant_name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-stone-500">
                              {item.company_name} · {formatDate(item.created_at)}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-700">
                              <TeamFlag teamName={item.predicted_champion_team} size="sm" />
                              <span>{item.predicted_champion_team || "Sin finalista"}</span>
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-stone-500">Todavia no hay participaciones registradas.</p>
                    )}
                  </div>
                </div>
              </div>
            </BoardCard>

            {participantProfile ? (
              <ResultSummary
                prediction={participantProfile.prediction}
                createdAt={participantProfile.created_at}
                referenceCode={participantProfile.reference_code}
              />
            ) : isClosed ? (
              <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-8 shadow-xl">
                <FiAlertCircle className="text-4xl text-amber-700" />
                <h2 className="mt-4 text-2xl font-bold text-stone-900">Participacion cerrada</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  El portal esta deshabilitado en este momento. Si necesitas habilitarlo de nuevo, se hace desde la configuracion del backend.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-6">
                <section className="rounded-[2rem] border border-stone-200 bg-white/95 p-6 shadow-2xl sm:p-8">
                  <div>
                    <h2 className="text-2xl font-bold text-stone-900">Registra tu pronostico</h2>
                    <p className="mt-2 text-sm text-stone-500">
                      Completa tus datos una sola vez y carga tus marcadores exactos.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <input
                      className={fieldClassName}
                      name="participant_name"
                      placeholder="Nombres y Apellidos completos"
                      value={form.participant_name}
                      onChange={handleChange}
                      required
                    />
                    <input
                      className={fieldClassName}
                      name="identity_document"
                      placeholder="Cedula o documento"
                      value={form.identity_document}
                      onChange={handleChange}
                      required
                    />
                    <input
                      className={fieldClassName}
                      type="email"
                      name="email"
                      placeholder="Correo electronico"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                    <input
                      className={fieldClassName}
                      name="company_name"
                      placeholder="Empresa o cliente"
                      value={form.company_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </section>

                <BracketLayout
                  fixtures={{
                    ...fixtures,
                    final: finalFixture,
                  }}
                  form={form}
                  onChange={handleChange}
                  finalDisabled={finalDisabled}
                />

                <section className="rounded-[2rem] border border-stone-200 bg-white/95 p-6 shadow-2xl sm:p-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl bg-stone-100 p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                          <FiTarget />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Tu final proyectada</p>
                          <p className="mt-1 text-lg font-black text-stone-900">
                            {finalFixture.home_team || "Por definir"} vs {finalFixture.away_team || "Por definir"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-stone-100 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Reglamento de puntos</p>
                      <div className="mt-3 space-y-2 text-sm text-stone-700">
                        <p>Ganador correcto por partido: 50 puntos</p>
                        <p>Ganador + marcador exacto por partido: 100 puntos</p>
                        <p>Si empatas un partido, debes ingresar tambien el resultado por penales.</p>
                        <p>Campeon, vice, tercero y cuarto correctos: 50 puntos cada uno</p>
                        <p>Campeon y vicecampeon se calculan automaticamente con tus marcadores.</p>
                        <p className="font-bold text-emerald-700">Maximo total: 500 puntos</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <PositionDisplay label="Campeon" teamName={championTeam} />
                    <PositionDisplay label="Vicecampeon" teamName={runnerUpTeam} />
                    <PositionSelect
                      label="Tercer lugar"
                      name="third_place_team"
                      value={form.third_place_team}
                      onChange={handleChange}
                      options={participantTeamOptions}
                    />
                    <PositionSelect
                      label="Cuarto lugar"
                      name="fourth_place_team"
                      value={form.fourth_place_team}
                      onChange={handleChange}
                      options={participantTeamOptions}
                    />
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                      <input
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-300"
                        type="checkbox"
                        name="consent_accepted"
                        checked={form.consent_accepted}
                        onChange={handleChange}
                        required
                      />
                      <span>
                        Acepto registrar esta informacion una sola vez y autorizo su almacenamiento para fines promocionales de Famproject Cia. Ltda.
                      </span>
                    </label>
                  </div>

                  {submitError ? (
                    <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? <FiLoader className="animate-spin" /> : <FiSend />}
                    {submitting ? "Enviando prediccion..." : "Registrar mi prediccion"}
                  </button>
                </section>
              </form>
            )}
          </section>
        </motion.div>
      </div>
    </div>
  );
}
