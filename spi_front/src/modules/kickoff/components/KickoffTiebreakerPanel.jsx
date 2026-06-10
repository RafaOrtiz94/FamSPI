import React, { useEffect, useState, useRef, useCallback } from 'react';
import kickoffApi from '../api/kickoffApi';
import { toast } from 'react-toastify';

const POLL_MS = 3000;

const C = {
  navy:  '#0a1628',
  cyan:  '#00a8d4',
  gold:  '#c49a10',
  red:   '#ef4444',
  green: '#22c55e',
  muted: '#6b8aaa',
  line:  '#dce8f5',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

function VoteBar({ count, total, voted }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e3a55' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: voted
              ? `linear-gradient(90deg, #8a6800, ${C.gold}, #f0d060)`
              : `linear-gradient(90deg, #006a88, ${C.cyan})`,
          }}
        />
      </div>
      <span className="text-xs font-black font-mono flex-shrink-0" style={{ color: voted ? C.gold : C.cyan, width: 36, textAlign: 'right' }}>
        {count}v · {pct}%
      </span>
    </div>
  );
}

// ─── Candidate card (mobile-first voting) ────────────────────────────────────

function CandidateCard({ candidate, roundId, userVotedFor, totalVotes, onVoted, showResults, disabled }) {
  const [voting, setVoting] = useState(false);
  const isVoted   = userVotedFor === candidate.aporte_id;
  const hasVoted  = !!userVotedFor;

  const handleVote = async () => {
    if (hasVoted || disabled || voting) return;
    setVoting(true);
    try {
      await kickoffApi.voteTiebreaker(roundId, candidate.aporte_id);
      onVoted(candidate.aporte_id);
      toast.success('¡Voto registrado!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo registrar el voto');
    } finally { setVoting(false); }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        border: isVoted
          ? `2px solid ${C.gold}`
          : showResults && candidate.vote_count === Math.max(...[candidate.vote_count]) ? `1.5px solid ${C.cyan}60` : `1.5px solid #1e3a55`,
        background: isVoted ? 'linear-gradient(135deg, #1a2800, #0d1f0d)' : '#060d18',
        boxShadow: isVoted ? `0 0 24px ${C.gold}30` : 'none',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 overflow-hidden"
          style={{
            background: isVoted ? `linear-gradient(135deg, #8a6800, ${C.gold})` : '#0d1f35',
            color: isVoted ? '#fff' : '#7aaac8',
            border: `1.5px solid ${isVoted ? C.gold : '#1e3a55'}`,
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {candidate.collaborator_avatar_url
            ? <img src={candidate.collaborator_avatar_url} alt="" className="w-full h-full object-cover" />
            : initials(candidate.collaborator_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black truncate" style={{ color: isVoted ? '#ffd700' : '#c8e0f0', fontFamily: "'Share Tech Mono', monospace" }}>
            {candidate.collaborator_name}
          </p>
          {candidate.presentation_title && (
            <p className="text-[11px] truncate" style={{ color: '#5a82a0', fontFamily: "'Share Tech Mono', monospace" }}>
              {candidate.presentation_title}
            </p>
          )}
        </div>
        {isVoted && (
          <span className="flex-shrink-0 text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${C.gold}20`, color: C.gold, border: `1px solid ${C.gold}50` }}>
            Tu voto
          </span>
        )}
      </div>

      {/* Aporte text */}
      <div className="px-4 pb-3">
        <div className="rounded-xl p-3" style={{ background: '#0a1628', border: '1px solid #1e3a55' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#9abfdf', fontFamily: "'Share Tech Mono', monospace" }}>
            {candidate.aporte_text}
          </p>
        </div>

        {/* Vote bar (shown after voting or in results view) */}
        {(hasVoted || showResults) && (
          <VoteBar count={candidate.vote_count} total={totalVotes} voted={isVoted} />
        )}

        {/* Vote button */}
        {!hasVoted && !showResults && (
          <button
            onClick={handleVote}
            disabled={voting || disabled}
            className="mt-3 w-full py-3 rounded-xl font-black tracking-[0.15em] uppercase text-sm transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, #004455, #006680)`,
              color: '#00e5ff',
              border: `1.5px solid #006680`,
              fontFamily: "'Share Tech Mono', monospace",
              boxShadow: '0 0 16px #00a8d418',
            }}
          >
            {voting ? '[ REGISTRANDO... ]' : '[ VOTAR POR ESTE APORTE ]'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Active round view ────────────────────────────────────────────────────────

function ActiveRound({ round, isAdmin, onFinish, onRefresh }) {
  const [finishing, setFinishing] = useState(false);
  const [localVotedFor, setLocalVotedFor] = useState(round.user_voted_for);

  // Keep local vote in sync if poll updates it
  useEffect(() => { setLocalVotedFor(round.user_voted_for); }, [round.user_voted_for]);

  const totalVotes = round.candidates.reduce((s, c) => s + c.vote_count, 0);

  const handleVoted = (aporteId) => {
    setLocalVotedFor(aporteId);
    setTimeout(onRefresh, 500);
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      const res = await kickoffApi.finishTiebreaker(round.id);
      const result = res.data;
      if (result.still_tied) {
        toast.info(`Aún hay empate entre ${result.tied_aporte_ids.length} aportes. Inicia otra ronda.`);
      } else {
        toast.success('¡Ganador del desempate determinado!');
      }
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al cerrar la ronda');
    } finally { setFinishing(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Round header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: C.cyan }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: C.cyan }} />
            </span>
            <span className="text-xs font-black tracking-widest font-mono" style={{ color: C.cyan }}>
              RONDA #{round.round_number} — VOTACIÓN EN CURSO
            </span>
          </div>
          <p className="text-sm" style={{ color: '#7aaac8' }}>
            {localVotedFor
              ? 'Voto registrado. Resultados en tiempo real:'
              : 'Elige el aporte que más impacto tuvo. Un solo voto por persona.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: '#0d1f35', color: '#5a82a0' }}>
            {round.total_votes} votos emitidos
          </span>
          {isAdmin && (
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#1f0a0a', color: '#f87171', border: '1.5px solid #7f1d1d' }}
            >
              {finishing ? 'Cerrando...' : 'Cerrar ronda'}
            </button>
          )}
        </div>
      </div>

      {/* Candidate cards — responsive grid */}
      <div className={`grid gap-3 ${round.candidates.length === 2 ? 'sm:grid-cols-2' : round.candidates.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {round.candidates.map(c => (
          <CandidateCard
            key={c.aporte_id}
            candidate={c}
            roundId={round.id}
            userVotedFor={localVotedFor}
            totalVotes={totalVotes}
            onVoted={handleVoted}
            showResults={false}
            disabled={false}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Finished round result ────────────────────────────────────────────────────

function FinishedRoundResult({ round }) {
  const totalVotes = round.candidates.reduce((s, c) => s + c.vote_count, 0);
  const maxVotes   = Math.max(...round.candidates.map(c => c.vote_count));
  const winners    = round.candidates.filter(c => c.vote_count === maxVotes);
  const stillTied  = winners.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black tracking-widest font-mono" style={{ color: stillTied ? C.gold : C.green }}>
          {stillTied ? `⚠ RONDA #${round.round_number} TERMINADA — SIGUE EMPATADO` : `✓ RONDA #${round.round_number} TERMINADA`}
        </span>
        <span className="text-xs font-mono" style={{ color: '#5a82a0' }}>· {totalVotes} votos</span>
      </div>
      <div className={`grid gap-3 ${round.candidates.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {round.candidates.map(c => (
          <CandidateCard
            key={c.aporte_id}
            candidate={c}
            roundId={round.id}
            userVotedFor={null}
            totalVotes={totalVotes}
            onVoted={() => {}}
            showResults
            disabled
          />
        ))}
      </div>
    </div>
  );
}

// ─── Admin start panel ────────────────────────────────────────────────────────

function AdminStartPanel({ tiedAportes, eventId, onStarted }) {
  const [selected, setSelected] = useState(() => new Set(tiedAportes.map(a => a.id)));
  const [starting, setStarting] = useState(false);

  const toggle = (id) => {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    if (selected.size < 2) { toast.error('Selecciona al menos 2 aportes'); return; }
    setStarting(true);
    try {
      await kickoffApi.startTiebreaker(eventId, [...selected]);
      toast.success('Ronda de desempate iniciada');
      onStarted();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al iniciar la ronda');
    } finally { setStarting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: '#7aaac8' }}>
        Los siguientes aportes están empatados en el primer lugar. Confirma cuáles participan en la ronda de desempate:
      </p>
      <div className="flex flex-col gap-2">
        {tiedAportes.map(a => (
          <label
            key={a.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
            style={{
              background: selected.has(a.id) ? '#0d1f0d' : '#060d18',
              border: `1.5px solid ${selected.has(a.id) ? `${C.green}60` : '#1e3a55'}`,
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(a.id)}
              onChange={() => toggle(a.id)}
              className="mt-0.5 flex-shrink-0 accent-green-500"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black" style={{ color: '#c8e0f0', fontFamily: "'Share Tech Mono', monospace" }}>
                {a.collaborator_name}
              </p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#5a82a0' }}>{a.aporte_text}</p>
              <p className="text-[10px] mt-1 font-bold" style={{ color: C.gold }}>
                ★ {parseFloat(a.avg_rating).toFixed(1)} · {a.rating_count} valoraciones
              </p>
            </div>
          </label>
        ))}
      </div>
      <button
        onClick={handleStart}
        disabled={starting || selected.size < 2}
        className="py-3 rounded-xl font-black tracking-[0.15em] uppercase text-sm transition-all active:scale-95 disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg, #004455, #006680)',
          color: '#00e5ff',
          border: '1.5px solid #006680',
          fontFamily: "'Share Tech Mono', monospace",
          boxShadow: '0 0 20px #00a8d418',
        }}
      >
        {starting ? '[ INICIANDO... ]' : `[ INICIAR RONDA DE DESEMPATE CON ${selected.size} APORTES ]`}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Acepta status como prop (desde KickoffAwardsSection que ya lo pollea)
// para evitar duplicar requests al mismo endpoint.
export default function KickoffTiebreakerPanel({ eventId, isAdmin, status, onRefresh }) {
  if (!status) return null;

  const { has_tie, tied_aportes, active_round, last_round } = status;

  // Nothing to show: no tie and no rounds at all
  if (!has_tie && !active_round && !last_round) return null;

  // Antes de que jefe_ti inicie una ronda, solo él puede ver el panel
  const roundEverStarted = !!active_round || !!last_round;
  if (!roundEverStarted && !isAdmin) return null;

  // Winner determined: last round finished with a single winner
  const winner = last_round?.winner_aporte_id
    ? last_round.candidates?.find(c => c.aporte_id === last_round.winner_aporte_id)
    : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#060d18', border: `1.5px solid ${active_round ? `${C.cyan}60` : has_tie ? `${C.gold}60` : '#1e3a55'}` }}>

      {/* Section header */}
      <div
        className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderBottom: '1px solid #0d1f35', background: '#070e1a' }}
      >
        <div>
          <p className="text-[10px] font-black tracking-[0.3em] font-mono mb-0.5" style={{ color: active_round ? C.cyan : C.gold }}>
            {active_round ? '⚡ DESEMPATE EN CURSO' : winner ? '🏆 GANADOR DEL DESEMPATE' : '⚖ SISTEMA DE DESEMPATE'}
          </p>
          <p className="text-sm font-bold" style={{ color: '#c8e0f0' }}>
            {active_round
              ? 'Votación activa — todos pueden votar desde su dispositivo'
              : winner
                ? 'El aporte ganador ha sido elegido por votación popular'
                : 'Empate detectado en el primer lugar del ranking'}
          </p>
        </div>
        {has_tie && !active_round && last_round && !winner && (
          <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: `${C.gold}15`, color: C.gold, border: `1px solid ${C.gold}40` }}>
            Sigue empatado — nueva ronda necesaria
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col gap-5">

        {/* Winner reveal */}
        {winner && (
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'linear-gradient(135deg, #1a2800, #0d1f0d)', border: `1.5px solid ${C.gold}` }}>
            <p className="text-[10px] font-black tracking-[0.3em] font-mono" style={{ color: C.gold }}>GANADOR DEFINITIVO</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0" style={{ background: `linear-gradient(135deg, #8a6800, ${C.gold})`, color: '#fff', fontFamily: "'Share Tech Mono', monospace" }}>
                {initials(winner.collaborator_name)}
              </div>
              <div>
                <p className="font-black text-base" style={{ color: '#ffd700', fontFamily: "'Share Tech Mono', monospace" }}>{winner.collaborator_name}</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: '#9abfdf' }}>{winner.aporte_text}</p>
                <p className="text-xs mt-1 font-bold" style={{ color: '#5a82a0' }}>{winner.vote_count} votos en el desempate</p>
              </div>
            </div>
          </div>
        )}

        {/* Active voting round */}
        {active_round && (
          <ActiveRound round={active_round} isAdmin={isAdmin} onFinish={() => {}} onRefresh={onRefresh} />
        )}

        {/* Last finished round results (if no active round) */}
        {!active_round && last_round && (
          <FinishedRoundResult round={last_round} />
        )}

        {/* Admin: start new round when there's a tie and no active round */}
        {isAdmin && (has_tie || (last_round && !last_round.winner_aporte_id)) && !active_round && (
          <div style={{ borderTop: '1px solid #0d1f35', paddingTop: 16, marginTop: 4 }}>
            <p className="text-[10px] font-black tracking-[0.3em] font-mono mb-3" style={{ color: '#4a7090' }}>
              {last_round ? 'INICIAR NUEVA RONDA' : 'INICIAR DESEMPATE'}
            </p>
            <AdminStartPanel
              tiedAportes={has_tie ? tied_aportes : last_round?.candidates?.filter(c => {
                const maxV = Math.max(...last_round.candidates.map(x => x.vote_count));
                return c.vote_count === maxV;
              }).map(c => ({ id: c.aporte_id, collaborator_name: c.collaborator_name, aporte_text: c.aporte_text, avg_rating: 5, rating_count: c.vote_count })) || []}
              eventId={eventId}
              onStarted={onRefresh}
            />
          </div>
        )}
      </div>
    </div>
  );
}
