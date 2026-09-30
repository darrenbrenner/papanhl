import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import {
  Home, Calendar, BarChart3, Landmark, ScrollText, RefreshCw, ChevronLeft, ChevronRight, X, Radio,
  Trophy, Star, ArrowLeft, Users, ClipboardList, Shield,
} from 'lucide-react';

// The NHL's web API has no CORS headers — route through our own serverless
// proxy instead. `path` is the part after the host, e.g. '/v1/standings/now'.
const nhlFetch = (path) => fetch(`/.netlify/functions/nhl?path=${encodeURIComponent(path)}`)
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

// Same idea for the AHL's HockeyTech feed: `params` are the feed parameters,
// e.g. { feed: 'modulekit', view: 'seasons' }. The proxy adds the site key.
const ahlFetch = (params) => fetch(`/.netlify/functions/ahl?${new URLSearchParams(params)}`)
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

const PlayerClickContext = createContext(() => {});
const usePlayerClick = () => useContext(PlayerClickContext);

// ─── Design tokens ──────────────────────────────────────────────────────────
const INK = 'var(--text)';
const ACCENT = '#0b5cad';
const BRAND = '#0b2545';
const LIVE = '#dc2626';
const PUCK_ORANGE = '#f97316';
const AHL_RED = '#c8102e';
const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
const SHADOW = {
  sm: '0 1px 2px rgba(15,23,42,0.05)',
  md: '0 6px 20px rgba(15,23,42,0.07)',
  lg: '0 20px 50px rgba(15,23,42,0.14)',
};
const LINE = 'var(--border)';
const LINE2 = 'var(--border2)';
const MONO = 'ui-monospace, monospace';

const THEME_VARS = {
  bg: '#f4f7fb', surface: '#ffffff', surface2: '#f1f5f9',
  border: 'rgba(15,23,42,0.09)', border2: 'rgba(15,23,42,0.16)',
  text: '#0f172a', text2: '#475569', text3: '#64748b', text4: '#94a3b8',
  hover: '#eef4fb',
};

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #f4f7fb;
    color: #0f172a;
    font-size: 13px;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.18); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.28); }
  button { font-family: inherit; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .fade-up { animation: fadeUp 0.25s ease both; }
`;

const S = {
  app: { minHeight: '100vh', background: 'var(--bg)', color: INK, fontFamily: "'Inter', system-ui, sans-serif" },
  header: {
    background: 'var(--surface)', borderBottom: `1px solid ${LINE}`,
    padding: '11px 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  pageTitle: { fontSize: 17, fontWeight: 700, margin: 0, color: INK, letterSpacing: '0.2px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  btnGray: { padding: '6px 13px', background: 'var(--surface)', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, color: INK, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 },
  btnBlue: { padding: '6px 13px', background: ACCENT, border: 'none', borderRadius: RADIUS.sm, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 },
  dateInput: { padding: '5px 8px', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, fontSize: 12, fontFamily: 'inherit', color: INK, background: 'var(--surface)' },
  body: { maxWidth: 1400, margin: '0 auto', padding: '18px 16px' },
  bodyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: 19, fontWeight: 700, margin: 0, color: INK, letterSpacing: '-0.2px' },
  card: { background: 'var(--surface)', border: `1px solid ${LINE}`, borderRadius: RADIUS.lg, overflow: 'hidden', boxShadow: SHADOW.sm },
  cardLabel: { fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '10px 16px', background: 'var(--surface2)', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 6 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '24px 12px' },
  modal: { background: 'var(--surface)', borderRadius: RADIUS.lg, width: '100%', maxWidth: 860, boxShadow: SHADOW.lg, overflow: 'hidden' },
  modalClose: { background: 'var(--surface2)', border: `1px solid ${LINE2}`, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 6, borderRadius: RADIUS.sm, display: 'flex' },
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--text4)', fontSize: 12 },
  th: { padding: '5px 6px', fontSize: 9, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  td: { padding: '4px 6px', fontSize: 11, fontFamily: MONO, textAlign: 'center', color: 'var(--text2)', whiteSpace: 'nowrap' },
};

// ─── NHL structure ──────────────────────────────────────────────────────────
const CONFERENCES = [
  { name: 'Eastern', divisions: ['Atlantic', 'Metropolitan'] },
  { name: 'Western', divisions: ['Central', 'Pacific'] },
];
const DIV_ORDER = CONFERENCES.flatMap(c => c.divisions);

const NHL_QUOTES = [
  { quote: "You miss 100% of the shots you don't take.", author: 'Wayne Gretzky' },
  { quote: "A good hockey player plays where the puck is. A great hockey player plays where the puck is going to be.", author: 'Wayne Gretzky' },
  { quote: "Every day is a great day for hockey.", author: 'Mario Lemieux' },
  { quote: "I went to a fight the other night and a hockey game broke out.", author: 'Rodney Dangerfield' },
  { quote: "Half the game is mental; the other half is being mental.", author: 'Jim McKenny' },
  { quote: "Hockey captures the essence of Canadian experience in the New World. In a land so inescapably and inhospitably cold, hockey is the chance of life, and an affirmation that despite the deathly chill of winter we are alive.", author: 'Stephen Leacock' },
  { quote: "Success is not the result of spontaneous combustion. You must set yourself on fire.", author: 'Reggie Leach' },
  { quote: "It's a great day for hockey!", author: '"Badger" Bob Johnson' },
  { quote: "Great moments are born from great opportunity.", author: 'Herb Brooks' },
  { quote: "The name on the front is a hell of a lot more important than the one on the back.", author: 'Herb Brooks' },
  { quote: "If you don't have any fun, you don't win.", author: 'Mark Messier' },
  { quote: "All hockey players are bilingual. They know English and profanity.", author: 'Gordie Howe' },
  { quote: "The thing about hockey is you learn to never give up.", author: 'Bobby Orr' },
  { quote: "Forget about style; worry about results.", author: 'Bobby Orr' },
  { quote: "Goaltending is a normal job, sure. How would you like it in your job if every time you made a small mistake, a red light went on over your desk and 15,000 people stood up and yelled at you?", author: 'Jacques Plante' },
];

// Same quote all day for everyone, rotates at midnight local time.
function quoteOfTheDay() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000);
  return NHL_QUOTES[dayOfYear % NHL_QUOTES.length];
}

// ─── Helpers ────────────────────────────────────────────────────────────────
// The NHL API localizes most strings as { default, fr, ... } objects.
const tx = (v) => (v && typeof v === 'object' ? v.default : v) ?? '';
const logoFor = (abbrev) => abbrev ? `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg` : '';

// Local-calendar YYYY-MM-DD (toISOString would roll to tomorrow on US evenings).
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(str, days) {
  const d = new Date(`${str}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}
const longDate = (str) => new Date(`${str}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const isLive = (g) => g?.gameState === 'LIVE' || g?.gameState === 'CRIT';
const isFinal = (g) => g?.gameState === 'OFF' || g?.gameState === 'FINAL';
const isStarted = (g) => isLive(g) || isFinal(g);

const ordinal = (n) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;
function periodLabel(pd) {
  if (!pd) return '';
  if (pd.periodType === 'SO') return 'SO';
  if (pd.periodType === 'OT') {
    const n = pd.number - (pd.maxRegulationPeriods ?? 3);
    return n > 1 ? `${n}OT` : 'OT';
  }
  return ordinal(pd.number);
}
function periodLongName(pd) {
  if (pd.periodType === 'SO') return 'Shootout';
  if (pd.periodType === 'OT') {
    const n = pd.number - (pd.maxRegulationPeriods ?? 3);
    return n > 1 ? `${ordinal(n)} Overtime` : 'Overtime';
  }
  return `${['First', 'Second', 'Third'][pd.number - 1] ?? ordinal(pd.number)} Period`;
}

function gameStatusText(g) {
  if (g.gameScheduleState === 'PPD') return 'Postponed';
  if (g.gameScheduleState === 'CNCL') return 'Cancelled';
  if (isFinal(g)) {
    const t = g.gameOutcome?.lastPeriodType;
    return t === 'OT' ? 'Final/OT' : t === 'SO' ? 'Final/SO' : 'Final';
  }
  if (isLive(g)) {
    const p = periodLabel(g.periodDescriptor);
    if (g.clock?.inIntermission) return `${p} Int`;
    return `${p} ${g.clock?.timeRemaining ?? ''}`.trim();
  }
  return new Date(g.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const fmtPct = (v, digits = 3) => (v == null ? '—' : Number(v).toFixed(digits).replace(/^0(?=\.)/, ''));
const fmtNum = (v, digits = 2) => (v == null ? '—' : Number(v).toFixed(digits));
const fmtPlus = (v) => (v == null ? '—' : v > 0 ? `+${v}` : String(v));
const fmtToi = (secs) => (secs == null ? '—' : `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`);
const fmtSeason = (id) => { const s = String(id); return `${s.slice(0, 4)}-${s.slice(6, 8)}`; };
const fmtHeight = (inches) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : '—');
const recordStr = (t) => (t ? `${t.wins}-${t.losses}-${t.otLosses}` : '');

// Mouse-over lift used on every clickable card.
const liftHover = {
  onMouseEnter: e => { e.currentTarget.style.boxShadow = SHADOW.md; e.currentTarget.style.transform = 'translateY(-1px)'; },
  onMouseLeave: e => { e.currentTarget.style.boxShadow = SHADOW.sm; e.currentTarget.style.transform = 'none'; },
};
const rowHover = {
  onMouseEnter: e => { e.currentTarget.style.background = 'var(--hover)'; },
  onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; },
};

function LeagueBadge({ league, size = 22 }) {
  const ahl = league === 'ahl';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: ahl ? '#111827' : BRAND, color: '#fff', fontWeight: 900, fontSize: size * 0.5,
      letterSpacing: '0.04em', borderRadius: 6, padding: `${size * 0.18}px ${size * 0.32}px`,
      border: `2px solid ${ahl ? AHL_RED : PUCK_ORANGE}`,
    }}>
      {ahl ? 'AHL' : 'NHL'}
    </span>
  );
}

function StatusBadge({ live, final, text }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: live ? '#fff' : final ? 'var(--text2)' : ACCENT,
      background: live ? LIVE : 'var(--surface2)',
      padding: '2px 8px', borderRadius: RADIUS.pill, whiteSpace: 'nowrap',
    }}>
      {live && <Radio size={9} />} {text}
    </span>
  );
}

function StatusPill({ game }) {
  return <StatusBadge live={isLive(game)} final={isFinal(game)} text={gameStatusText(game)} />;
}

function Headshot({ src, size = 40, style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface2)', border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>
        <Users size={size * 0.45} color="var(--text4)" />
      </div>
    );
  }
  return <img src={src} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface2)', border: `1px solid ${LINE}`, flexShrink: 0, ...style }} alt="" />;
}

function PlayerName({ id, children, style }) {
  const onPlayerClick = usePlayerClick();
  return (
    <span onClick={(e) => { e.stopPropagation(); if (id) onPlayerClick(id); }}
      style={{ cursor: id ? 'pointer' : 'default', ...style }}
      onMouseEnter={e => { if (id) e.currentTarget.style.textDecoration = 'underline'; }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
    >{children}</span>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${LINE}`, overflowX: 'auto', padding: '0 12px' }}>
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
          borderBottom: `2px solid ${active === id ? ACCENT : 'transparent'}`, cursor: 'pointer',
          padding: '10px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0,
          color: active === id ? ACCENT : 'var(--text2)',
        }}>{label}</button>
      ))}
    </div>
  );
}

// ─── Game Card ──────────────────────────────────────────────────────────────
function TeamLine({ team, teamMap, showScore, winner }) {
  const info = teamMap[team.abbrev];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img src={team.logo || logoFor(team.abbrev)} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} alt="" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: winner ? 900 : 700, fontSize: 15, color: winner ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {info?.name ?? tx(team.name) ?? team.abbrev}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>
            {info ? `${recordStr(info)} · ${info.points} pts` : team.abbrev}
            {showScore && team.sog != null && <span> · {team.sog} SOG</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: MONO, color: winner ? ACCENT : 'var(--text)', flexShrink: 0, marginLeft: 8 }}>
        {showScore ? team.score : <span style={{ fontSize: 12, color: 'var(--text4)' }}>—</span>}
      </div>
    </div>
  );
}

function GameCard({ game, teamMap, onClick }) {
  const started = isStarted(game);
  const final = isFinal(game);
  const { awayTeam: away, homeTeam: home } = game;
  const awayWin = final && away.score > home.score;
  const homeWin = final && home.score > away.score;
  const goals = game.goals ?? [];
  const tv = (game.tvBroadcasts ?? []).filter(b => b.countryCode === 'US').map(b => b.network);

  return (
    <div onClick={onClick} style={{ ...S.card, padding: '12px 14px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }} {...liftHover}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <StatusPill game={game} />
        <span style={{ fontSize: 10, color: 'var(--text4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tx(game.venue)}{!started && tv.length > 0 ? ` · ${tv.slice(0, 2).join(', ')}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TeamLine team={away} teamMap={teamMap} showScore={started} winner={awayWin} />
        <TeamLine team={home} teamMap={teamMap} showScore={started} winner={homeWin} />
      </div>
      {goals.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {goals.slice(-5).map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              <span style={{ fontFamily: MONO, color: 'var(--text4)', width: 58, flexShrink: 0 }}>{periodLabel(g.periodDescriptor)} {g.timeInPeriod}</span>
              <img src={logoFor(g.teamAbbrev)} style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
              <span style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tx(g.name)} ({g.goalsToDate ?? '—'})
              </span>
              {g.strength && g.strength !== 'ev' && <span style={{ fontSize: 9, fontWeight: 800, color: PUCK_ORANGE, textTransform: 'uppercase' }}>{g.strength}</span>}
              {g.goalModifier === 'empty-net' && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)' }}>EN</span>}
            </div>
          ))}
          {goals.length > 5 && <div style={{ fontSize: 10, color: 'var(--text4)' }}>+{goals.length - 5} earlier goal{goals.length - 5 === 1 ? '' : 's'}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Game Modal (game center) ───────────────────────────────────────────────
const TEAM_STAT_LABELS = {
  sog: 'Shots on Goal', faceoffWinningPctg: 'Faceoff %', powerPlay: 'Power Play',
  pim: 'Penalty Minutes', hits: 'Hits', blockedShots: 'Blocked Shots',
  giveaways: 'Giveaways', takeaways: 'Takeaways',
};

function LineScore({ game, rightRail }) {
  const byPeriod = rightRail?.linescore?.byPeriod ?? [];
  const shots = rightRail?.shotsByPeriod ?? [];
  if (byPeriod.length === 0) return null;
  const cols = byPeriod.map(p => p.periodDescriptor);
  const totals = rightRail.linescore.totals ?? {};
  const shotTotal = (side) => shots.reduce((s, p) => s + (p[side] ?? 0), 0);
  const rows = [['away', game.awayTeam], ['home', game.homeTeam]];
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>Team</th>
            {cols.map((pd, i) => <th key={i} style={S.th}>{periodLabel(pd)}</th>)}
            <th style={{ ...S.th, borderLeft: `1px solid ${LINE2}` }}>G</th>
            <th style={S.th}>SOG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([side, team]) => (
            <tr key={side} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <img src={logoFor(team.abbrev)} style={{ width: 18, height: 18 }} alt="" />{team.abbrev}
                </span>
              </td>
              {byPeriod.map((p, i) => <td key={i} style={S.td}>{p[side]}</td>)}
              <td style={{ ...S.td, borderLeft: `1px solid ${LINE2}`, fontWeight: 900, color: 'var(--text)' }}>{totals[side] ?? team.score}</td>
              <td style={S.td}>{shots.length ? shotTotal(side) : (team.sog ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoringSummary({ landing }) {
  const periods = landing?.summary?.scoring ?? [];
  if (periods.length === 0) return <p style={S.empty}>No scoring yet.</p>;
  return (
    <div>
      {periods.map((p, pi) => (
        <div key={pi} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 0', borderBottom: `1px solid ${LINE}` }}>
            {periodLongName(p.periodDescriptor)}
          </div>
          {p.goals.length === 0 && <div style={{ fontSize: 12, color: 'var(--text4)', padding: '8px 0' }}>No scoring</div>}
          {p.goals.map((g, gi) => (
            <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
              <Headshot src={g.headshot} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  <PlayerName id={g.playerId}>{tx(g.firstName)} {tx(g.lastName)}</PlayerName>
                  <span style={{ fontWeight: 400, color: 'var(--text3)' }}> ({g.goalsToDate})</span>
                  {g.strength && g.strength !== 'ev' && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#fff', background: PUCK_ORANGE, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' }}>{g.strength}</span>}
                  {g.goalModifier === 'empty-net' && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: 'var(--text2)', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4 }}>EN</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {g.assists?.length
                    ? g.assists.map((a, ai) => <span key={a.playerId}>{ai > 0 && ', '}<PlayerName id={a.playerId}>{tx(a.name) || `${tx(a.firstName)} ${tx(a.lastName)}`}</PlayerName> ({a.assistsToDate})</span>)
                    : 'Unassisted'}
                  {g.shotType && <span> · {g.shotType}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  <img src={logoFor(tx(g.teamAbbrev))} style={{ width: 16, height: 16 }} alt="" />
                  <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: 'var(--text)' }}>{g.awayScore}–{g.homeScore}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: MONO }}>{g.timeInPeriod}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ThreeStars({ stars }) {
  if (!stars?.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
      {stars.map(s => (
        <div key={s.star} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, border: `1px solid ${LINE}`, borderRadius: RADIUS.md, background: 'var(--surface2)' }}>
          <Headshot src={s.headshot} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: PUCK_ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>★ {ordinal(s.star)} Star</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <PlayerName id={s.playerId}>{tx(s.name)}</PlayerName>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>
              {s.teamAbbrev} · {s.position === 'G'
                ? `${fmtPct(s.savePctg)} SV%`
                : `${s.goals}G ${s.assists}A`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PenaltySummary({ landing }) {
  const periods = (landing?.summary?.penalties ?? []).filter(p => p.penalties.length > 0);
  if (periods.length === 0) return <p style={S.empty}>No penalties.</p>;
  return (
    <div>
      {periods.map((p, pi) => (
        <div key={pi} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 0', borderBottom: `1px solid ${LINE}` }}>
            {periodLongName(p.periodDescriptor)}
          </div>
          {p.penalties.map((pen, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
              <span style={{ fontFamily: MONO, color: 'var(--text4)', width: 40, flexShrink: 0 }}>{pen.timeInPeriod}</span>
              <img src={logoFor(tx(pen.teamAbbrev))} style={{ width: 16, height: 16, flexShrink: 0 }} alt="" />
              <span style={{ flex: 1, minWidth: 0, color: 'var(--text)' }}>
                <strong>{pen.committedByPlayer ? `${tx(pen.committedByPlayer.firstName)} ${tx(pen.committedByPlayer.lastName)}` : (tx(pen.servedBy) || 'Bench')}</strong>
                <span style={{ color: 'var(--text3)' }}> — {(pen.descKey ?? '').replace(/-/g, ' ')}</span>
              </span>
              <span style={{ fontFamily: MONO, color: 'var(--text2)', flexShrink: 0 }}>{pen.duration} min</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamStatsCompare({ game, rightRail }) {
  const stats = rightRail?.teamGameStats ?? [];
  if (stats.length === 0) return <p style={S.empty}>Team stats will appear once the game starts.</p>;
  const show = stats.filter(s => TEAM_STAT_LABELS[s.category]);
  const fmt = (cat, v) => (cat.endsWith('Pctg') ? `${(Number(v) * 100).toFixed(1)}%` : v);
  const awayColor = '#94a3b8';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><img src={logoFor(game.awayTeam.abbrev)} style={{ width: 18, height: 18 }} alt="" />{game.awayTeam.abbrev}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{game.homeTeam.abbrev}<img src={logoFor(game.homeTeam.abbrev)} style={{ width: 18, height: 18 }} alt="" /></span>
      </div>
      {show.map(s => {
        const a = typeof s.awayValue === 'number' ? s.awayValue : null;
        const h = typeof s.homeValue === 'number' ? s.homeValue : null;
        const total = a != null && h != null ? a + h : 0;
        const awayShare = total > 0 ? (a / total) * 100 : 50;
        return (
          <div key={s.category} style={{ padding: '7px 0', borderBottom: `1px solid ${LINE}` }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
              <span style={{ flex: 1, fontWeight: 700, color: 'var(--text)', fontFamily: MONO }}>{fmt(s.category, s.awayValue)}</span>
              <span style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{TEAM_STAT_LABELS[s.category]}</span>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontFamily: MONO }}>{fmt(s.category, s.homeValue)}</span>
            </div>
            {total > 0 && (
              <div style={{ display: 'flex', height: 5, borderRadius: RADIUS.pill, overflow: 'hidden', marginTop: 4, gap: 2 }}>
                <div style={{ width: `${awayShare}%`, background: awayColor }} />
                <div style={{ flex: 1, background: ACCENT }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkaterBoxTable({ title, players }) {
  if (!players?.length) return null;
  const cols = [['G', 'goals'], ['A', 'assists'], ['P', 'points'], ['+/-', 'plusMinus'], ['SOG', 'sog'], ['HIT', 'hits'], ['BLK', 'blockedShots'], ['PIM', 'pim'], ['TOI', 'toi']];
  return (
    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>{title}</th>
            {cols.map(([l]) => <th key={l} style={S.th}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.playerId} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', color: 'var(--text)', fontWeight: 600 }}>
                <span style={{ color: 'var(--text4)', fontFamily: MONO, marginRight: 6 }}>{p.sweaterNumber}</span>
                <PlayerName id={p.playerId}>{tx(p.name)}</PlayerName>
                <span style={{ color: 'var(--text4)', fontSize: 10 }}> {p.position}</span>
              </td>
              {cols.map(([l, k]) => (
                <td key={l} style={{ ...S.td, fontWeight: (k === 'points' && p.points > 0) || (k === 'goals' && p.goals > 0) ? 800 : 400, color: (k === 'goals' && p.goals > 0) ? ACCENT : S.td.color }}>
                  {k === 'plusMinus' ? fmtPlus(p[k]) : p[k] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalieBoxTable({ goalies }) {
  const played = (goalies ?? []).filter(g => g.toi && g.toi !== '00:00');
  if (played.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>Goalies</th>
            {['SA', 'SV', 'GA', 'SV%', 'EV', 'PP', 'SH', 'TOI', 'DEC'].map(l => <th key={l} style={S.th}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {played.map(g => (
            <tr key={g.playerId} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', color: 'var(--text)', fontWeight: 600 }}>
                <span style={{ color: 'var(--text4)', fontFamily: MONO, marginRight: 6 }}>{g.sweaterNumber}</span>
                <PlayerName id={g.playerId}>{tx(g.name)}</PlayerName>
              </td>
              <td style={S.td}>{g.shotsAgainst}</td>
              <td style={S.td}>{g.saves}</td>
              <td style={S.td}>{g.goalsAgainst}</td>
              <td style={{ ...S.td, fontWeight: 700, color: 'var(--text)' }}>{fmtPct(g.savePctg)}</td>
              <td style={S.td}>{g.evenStrengthShotsAgainst}</td>
              <td style={S.td}>{g.powerPlayShotsAgainst}</td>
              <td style={S.td}>{g.shorthandedShotsAgainst}</td>
              <td style={S.td}>{g.toi}</td>
              <td style={{ ...S.td, fontWeight: 800, color: g.decision === 'W' ? '#15803d' : g.decision ? LIVE : S.td.color }}>{g.decision ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerBoxScore({ game, boxscore }) {
  const stats = boxscore?.playerByGameStats;
  if (!stats) return <p style={S.empty}>Player stats will appear once the game starts.</p>;
  return (
    <div>
      {[['awayTeam', game.awayTeam], ['homeTeam', game.homeTeam]].map(([key, team]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            <img src={logoFor(team.abbrev)} style={{ width: 22, height: 22 }} alt="" />
            {tx(boxscore[key]?.placeName)} {tx(boxscore[key]?.commonName)}
          </div>
          <SkaterBoxTable title="Forwards" players={stats[key]?.forwards} />
          <SkaterBoxTable title="Defense" players={stats[key]?.defense} />
          <GoalieBoxTable goalies={stats[key]?.goalies} />
        </div>
      ))}
    </div>
  );
}

function GameInfoPanel({ game, rightRail, teamMap }) {
  const info = rightRail?.gameInfo;
  const series = rightRail?.seasonSeries ?? [];
  const tv = (game.tvBroadcasts ?? []).map(b => `${b.network} (${b.countryCode})`);
  const row = (label, value) => value ? (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
      <span style={{ width: 110, flexShrink: 0, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em', paddingTop: 1 }}>{label}</span>
      <span style={{ color: 'var(--text)', flex: 1 }}>{value}</span>
    </div>
  ) : null;
  const away = teamMap[game.awayTeam.abbrev];
  const home = teamMap[game.homeTeam.abbrev];
  return (
    <div>
      {row('Puck drop', new Date(game.startTimeUTC).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}
      {row('Arena', tx(game.venue))}
      {row('TV', tv.join(', '))}
      {away && home && row('Records', `${game.awayTeam.abbrev} ${recordStr(away)} (${away.points} pts) · ${game.homeTeam.abbrev} ${recordStr(home)} (${home.points} pts)`)}
      {info?.awayTeam?.headCoach && row('Coaches', `${game.awayTeam.abbrev}: ${tx(info.awayTeam.headCoach)} · ${game.homeTeam.abbrev}: ${tx(info.homeTeam?.headCoach)}`)}
      {info?.referees?.length > 0 && row('Referees', info.referees.map(r => tx(r.fullName)).join(', '))}
      {info?.linesmen?.length > 0 && row('Linesmen', info.linesmen.map(r => tx(r.fullName)).join(', '))}
      {series.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Season Series</div>
          {series.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: `1px solid ${LINE}` }}>
              <span style={{ color: 'var(--text3)' }}>{new Date(`${s.gameDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span style={{ fontFamily: MONO, color: 'var(--text)' }}>
                {s.awayTeam.abbrev} {isStarted(s) ? s.awayTeam.score : ''} @ {s.homeTeam.abbrev} {isStarted(s) ? s.homeTeam.score : ''}
              </span>
              <span style={{ color: 'var(--text3)' }}>{gameStatusText(s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalTeamSide({ team, teamMap }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <img src={logoFor(team.abbrev)} style={{ width: 56, height: 56, objectFit: 'contain' }} alt="" />
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{teamMap[team.abbrev]?.name ?? tx(team.name) ?? team.abbrev}</div>
      <div style={{ fontSize: 11, color: 'var(--text4)' }}>{teamMap[team.abbrev] ? recordStr(teamMap[team.abbrev]) : ''}</div>
    </div>
  );
}

function GameModal({ game, teamMap, onClose }) {
  const [landing, setLanding] = useState(null);
  const [boxscore, setBoxscore] = useState(null);
  const [rightRail, setRightRail] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const started = isStarted(game);
  const live = isLive(game);
  const [tab, setTab] = useState(started ? 'summary' : 'info');

  useEffect(() => {
    const load = () => Promise.all([
      nhlFetch(`/v1/gamecenter/${game.id}/landing`).then(setLanding).catch(() => {}),
      nhlFetch(`/v1/gamecenter/${game.id}/boxscore`).then(setBoxscore).catch(() => {}),
      nhlFetch(`/v1/gamecenter/${game.id}/right-rail`).then(setRightRail).catch(() => {}),
    ]).finally(() => setLoaded(true));
    load();
    if (!live) return;
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [game.id, live]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { awayTeam: away, homeTeam: home } = game;
  const tabs = started
    ? [['summary', 'Summary'], ['box', 'Box Score'], ['stats', 'Team Stats'], ['penalties', 'Penalties'], ['info', 'Game Info']]
    : [['info', 'Preview']];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="fade-up" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 20px 12px', background: `linear-gradient(180deg, var(--surface2), var(--surface))` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusPill game={game} />
            <button style={S.modalClose} onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
            <ModalTeamSide team={away} teamMap={teamMap} />
            <div style={{ fontSize: 34, fontWeight: 900, fontFamily: MONO, color: 'var(--text)', flexShrink: 0 }}>
              {started ? `${away.score}–${home.score}` : <span style={{ fontSize: 16, color: 'var(--text3)' }}>@</span>}
            </div>
            <ModalTeamSide team={home} teamMap={teamMap} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{tx(game.venue)}</div>
        </div>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ padding: '16px 20px 20px' }}>
          {!loaded && <p style={S.empty}>Loading game center...</p>}
          {loaded && (
            <>
              {tab !== 'info' && <LineScore game={game} rightRail={rightRail} />}
              {tab === 'summary' && (
                <>
                  <ThreeStars stars={landing?.summary?.threeStars} />
                  <ScoringSummary landing={landing} />
                </>
              )}
              {tab === 'box' && <PlayerBoxScore game={game} boxscore={boxscore} />}
              {tab === 'stats' && <TeamStatsCompare game={game} rightRail={rightRail} />}
              {tab === 'penalties' && <PenaltySummary landing={landing} />}
              {tab === 'info' && <GameInfoPanel game={game} rightRail={rightRail} teamMap={teamMap} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Player Modal ───────────────────────────────────────────────────────────
function StatTile({ label, value }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: RADIUS.md, padding: '8px 10px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: MONO, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

const SKATER_TILES = [['GP', 'gamesPlayed'], ['G', 'goals'], ['A', 'assists'], ['P', 'points'], ['+/-', 'plusMinus'], ['PIM', 'pim']];
const GOALIE_TILES = [['GP', 'gamesPlayed'], ['W', 'wins'], ['L', 'losses'], ['OTL', 'otLosses'], ['GAA', 'goalsAgainstAvg'], ['SV%', 'savePctg'], ['SO', 'shutouts']];
const fmtTile = (key, v) => v == null ? '—' : key === 'savePctg' ? fmtPct(v) : key === 'goalsAgainstAvg' ? fmtNum(v) : key === 'plusMinus' ? fmtPlus(v) : v;

function PlayerModal({ playerId, onClose }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setP(null); setError(false);
    nhlFetch(`/v1/player/${playerId}/landing`).then(setP).catch(() => setError(true));
  }, [playerId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isGoalie = p?.position === 'G';
  const tiles = isGoalie ? GOALIE_TILES : SKATER_TILES;
  const cur = p?.featuredStats?.regularSeason?.subSeason;
  const career = p?.careerTotals?.regularSeason ?? p?.featuredStats?.regularSeason?.career;
  const seasons = (p?.seasonTotals ?? []).filter(s => s.leagueAbbrev === 'NHL' && s.gameTypeId === 2).reverse();
  const tableCols = isGoalie
    ? [['GP', 'gamesPlayed'], ['W', 'wins'], ['L', 'losses'], ['OTL', 'otLosses'], ['GAA', 'goalsAgainstAvg'], ['SV%', 'savePctg'], ['SO', 'shutouts']]
    : [['GP', 'gamesPlayed'], ['G', 'goals'], ['A', 'assists'], ['P', 'points'], ['+/-', 'plusMinus'], ['PIM', 'pim'], ['PPG', 'powerPlayGoals'], ['S', 'shots']];

  return (
    <div style={{ ...S.overlay, zIndex: 120 }} onClick={onClose}>
      <div className="fade-up" style={{ ...S.modal, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        {error && <p style={S.empty}>Couldn't load this player.</p>}
        {!p && !error && <p style={S.empty}>Loading player...</p>}
        {p && (
          <>
            <div style={{ position: 'relative', background: BRAND, color: '#fff', padding: '20px 20px 16px', overflow: 'hidden' }}>
              {p.heroImage && <img src={p.heroImage} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }} alt="" />}
              <button style={{ ...S.modalClose, position: 'absolute', top: 12, right: 12, zIndex: 2 }} onClick={onClose} aria-label="Close"><X size={14} /></button>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Headshot src={p.headshot} size={96} style={{ border: '3px solid #fff' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.teamLogo && <img src={p.teamLogo} style={{ width: 20, height: 20, background: '#fff', borderRadius: 4, padding: 1 }} alt="" />}
                    {tx(p.fullTeamName) || 'Free agent'} · #{p.sweaterNumber ?? '—'} · {p.position}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{tx(p.firstName)} {tx(p.lastName)}</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                    {fmtHeight(p.heightInInches)} · {p.weightInPounds} lb · {isGoalie ? 'Catches' : 'Shoots'} {p.shootsCatches}
                    {p.birthDate && <> · Born {new Date(`${p.birthDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {tx(p.birthCity)}{p.birthStateProvince ? `, ${tx(p.birthStateProvince)}` : ''}, {p.birthCountry}</>}
                  </div>
                  {p.draftDetails && (
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                      Drafted {p.draftDetails.year} by {p.draftDetails.teamAbbrev} — Round {p.draftDetails.round}, #{p.draftDetails.overallPick} overall
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
              {cur && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 10px', padding: '6px 20px' }}>{fmtSeason(p.featuredStats.season)} Regular Season</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(70px, 1fr))`, gap: 6, marginBottom: 14 }}>
                    {tiles.map(([l, k]) => <StatTile key={l} label={l} value={fmtTile(k, cur[k])} />)}
                  </div>
                </>
              )}
              {career && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 10px', padding: '6px 20px' }}>NHL Career</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(70px, 1fr))`, gap: 6, marginBottom: 14 }}>
                    {tiles.map(([l, k]) => <StatTile key={l} label={l} value={fmtTile(k, career[k])} />)}
                  </div>
                </>
              )}
              {p.last5Games?.length > 0 && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 8px', padding: '6px 20px' }}>Last 5 Games</div>
                  <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead><tr>
                        <th style={{ ...S.th, textAlign: 'left' }}>Date</th><th style={S.th}>Opp</th>
                        {isGoalie
                          ? ['Dec', 'SA', 'GA', 'SV%', 'TOI'].map(l => <th key={l} style={S.th}>{l}</th>)
                          : ['G', 'A', 'P', '+/-', 'S', 'TOI'].map(l => <th key={l} style={S.th}>{l}</th>)}
                      </tr></thead>
                      <tbody>
                        {p.last5Games.map(g => (
                          <tr key={g.gameId} style={{ borderTop: `1px solid ${LINE}` }}>
                            <td style={{ ...S.td, textAlign: 'left' }}>{new Date(`${g.gameDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                            <td style={S.td}>{g.homeRoadFlag === 'R' ? '@' : 'vs'} {g.opponentAbbrev}</td>
                            {isGoalie ? (
                              <><td style={S.td}>{g.decision ?? '—'}</td><td style={S.td}>{g.shotsAgainst}</td><td style={S.td}>{g.goalsAgainst}</td><td style={S.td}>{fmtPct(g.savePctg)}</td><td style={S.td}>{g.toi}</td></>
                            ) : (
                              <><td style={S.td}>{g.goals}</td><td style={S.td}>{g.assists}</td><td style={{ ...S.td, fontWeight: 800, color: 'var(--text)' }}>{g.points}</td><td style={S.td}>{fmtPlus(g.plusMinus)}</td><td style={S.td}>{g.shots}</td><td style={S.td}>{g.toi}</td></>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {seasons.length > 0 && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 8px', padding: '6px 20px' }}>Season by Season</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead><tr>
                        <th style={{ ...S.th, textAlign: 'left' }}>Season</th><th style={{ ...S.th, textAlign: 'left' }}>Team</th>
                        {tableCols.map(([l]) => <th key={l} style={S.th}>{l}</th>)}
                      </tr></thead>
                      <tbody>
                        {seasons.map((s, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
                            <td style={{ ...S.td, textAlign: 'left' }}>{fmtSeason(s.season)}</td>
                            <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit' }}>{tx(s.teamName)}</td>
                            {tableCols.map(([l, k]) => <td key={l} style={S.td}>{fmtTile(k, s[k])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Standings ──────────────────────────────────────────────────────────────
const CLINCH_LABELS = { x: 'Clinched playoff berth', y: 'Clinched division', z: 'Clinched conference', p: "Presidents' Trophy", e: 'Eliminated' };

function StandingsTable({ title, rows, onTeamClick, cutoffAfter, rankKey = 'divisionSequence', accent = ACCENT }) {
  const cols = [
    ['GP', t => t.gamesPlayed], ['W', t => t.wins], ['L', t => t.losses], ['OTL', t => t.otLosses],
    ['PTS', t => t.points, true], ['P%', t => fmtPct(t.pointPctg)], ['RW', t => t.regulationWins],
    ['GF', t => t.goalFor], ['GA', t => t.goalAgainst], ['DIFF', t => fmtPlus(t.goalDifferential)],
    ['HOME', t => `${t.homeWins}-${t.homeLosses}-${t.homeOtLosses}`], ['AWAY', t => `${t.roadWins}-${t.roadLosses}-${t.roadOtLosses}`],
    ['L10', t => `${t.l10Wins}-${t.l10Losses}-${t.l10OtLosses}`], ['STRK', t => t.streakCode ? `${t.streakCode}${t.streakCount}` : '—'],
  ];
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, color: '#fff', background: accent, letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...S.th, width: 24 }}>#</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Team</th>
              {cols.map(([l]) => <th key={l} style={S.th}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={tx(t.teamAbbrev)} onClick={() => onTeamClick?.(tx(t.teamAbbrev))} {...rowHover}
                style={{ cursor: onTeamClick ? 'pointer' : 'default', borderTop: i === cutoffAfter ? `2px dashed ${LIVE}` : `1px solid ${LINE}` }}>
                <td style={{ ...S.td, color: 'var(--text4)' }}>{rankKey ? t[rankKey] : i + 1}</td>
                <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <img src={t.teamLogo} style={{ width: 22, height: 22, objectFit: 'contain' }} alt="" />
                    {tx(t.teamName)}
                    {t.clinchIndicator && <span title={CLINCH_LABELS[t.clinchIndicator]} style={{ fontSize: 10, fontWeight: 800, color: t.clinchIndicator === 'e' ? LIVE : '#15803d' }}>{t.clinchIndicator}</span>}
                  </span>
                </td>
                {cols.map(([l, fn, bold]) => <td key={l} style={{ ...S.td, fontWeight: bold ? 900 : 400, color: bold ? 'var(--text)' : S.td.color }}>{fn(t)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StandingsPage({ currentStandings, onTeamClick }) {
  const [view, setView] = useState('division');
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    nhlFetch('/v1/standings-season').then(d => {
      const list = (d.seasons ?? []).slice().reverse();
      setSeasons(list);
      setSeasonId(list[0]?.id ?? null);
    }).catch(() => {});
  }, []);

  const latestId = seasons[0]?.id;
  useEffect(() => {
    if (seasonId == null || seasonId === latestId) { setData(currentStandings); return; }
    const s = seasons.find(x => x.id === seasonId);
    setData(null);
    nhlFetch(`/v1/standings/${s.standingsEnd}`).then(d => setData(d.standings ?? [])).catch(() => setData([]));
  }, [seasonId, latestId, seasons, currentStandings]);

  const selected = seasons.find(s => s.id === seasonId);
  const hasWildcard = selected ? selected.wildcardInUse : true;
  const rows = data ?? currentStandings;
  const activeView = view === 'wildcard' && !hasWildcard ? 'division' : view;
  const btn = (id, label) => (
    <button onClick={() => setView(id)} style={{ ...S.btnGray, background: activeView === id ? ACCENT : 'var(--surface)', color: activeView === id ? '#fff' : INK, borderColor: activeView === id ? ACCENT : undefined }}>{label}</button>
  );

  const divisions = [...new Set((rows ?? []).map(t => t.divisionName))];
  const conferences = [...new Set((rows ?? []).map(t => t.conferenceName).filter(Boolean))];

  return (
    <div>
      <div style={S.bodyHeader}>
        <h2 style={S.sectionTitle}>Standings</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {btn('division', 'Division')}
          {hasWildcard && btn('wildcard', 'Wild Card')}
          {btn('conference', 'Conference')}
          {btn('league', 'League')}
          <select value={seasonId ?? ''} onChange={e => setSeasonId(Number(e.target.value))} style={{ ...S.dateInput, padding: '6px 8px', fontWeight: 600 }}>
            {seasons.map(s => <option key={s.id} value={s.id}>{fmtSeason(s.id)}</option>)}
          </select>
        </div>
      </div>
      {!rows && <p style={S.empty}>Loading standings...</p>}
      {rows && rows.length === 0 && <p style={S.empty}>No standings available.</p>}
      {rows && rows.length > 0 && (
        <>
          {activeView === 'division' && DIV_ORDER.concat(divisions.filter(d => !DIV_ORDER.includes(d))).map(div => {
            const teams = rows.filter(t => t.divisionName === div).sort((a, b) => a.divisionSequence - b.divisionSequence);
            return teams.length > 0 && <StandingsTable key={div} title={`${div} Division`} rows={teams} onTeamClick={onTeamClick} accent={CONFERENCES[0].divisions.includes(div) ? ACCENT : BRAND} />;
          })}
          {activeView === 'wildcard' && CONFERENCES.map(conf => {
            const confTeams = rows.filter(t => t.conferenceName === conf.name);
            if (confTeams.length === 0) return null;
            const wild = confTeams.filter(t => t.wildcardSequence > 0).sort((a, b) => a.wildcardSequence - b.wildcardSequence);
            return (
              <div key={conf.name} style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 8px', color: 'var(--text)' }}>{conf.name} Conference</h3>
                {conf.divisions.map(div => (
                  <StandingsTable key={div} title={div} onTeamClick={onTeamClick}
                    rows={confTeams.filter(t => t.divisionName === div && t.wildcardSequence === 0).sort((a, b) => a.divisionSequence - b.divisionSequence)} />
                ))}
                <StandingsTable title="Wild Card" rows={wild} onTeamClick={onTeamClick} cutoffAfter={2} rankKey="wildcardSequence" accent={PUCK_ORANGE} />
              </div>
            );
          })}
          {activeView === 'conference' && conferences.map(conf => (
            <StandingsTable key={conf} title={`${conf} Conference`} onTeamClick={onTeamClick} rankKey="conferenceSequence"
              rows={rows.filter(t => t.conferenceName === conf).sort((a, b) => a.conferenceSequence - b.conferenceSequence)} />
          ))}
          {activeView === 'league' && (
            <StandingsTable title="National Hockey League" onTeamClick={onTeamClick} rankKey="leagueSequence" accent={BRAND}
              rows={[...rows].sort((a, b) => a.leagueSequence - b.leagueSequence)} />
          )}
          <p style={{ fontSize: 11, color: 'var(--text4)' }}>
            {Object.entries(CLINCH_LABELS).map(([k, v]) => `${k} — ${v}`).join(' · ')}
            {activeView === 'wildcard' && ' · Dashed red line marks the playoff cutoff.'}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Teams ──────────────────────────────────────────────────────────────────
function TeamsGrid({ standings, onSelect }) {
  if (!standings) return <p style={S.empty}>Loading teams...</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {CONFERENCES.map(conf => (
        <div key={conf.name}>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${PUCK_ORANGE}` }}>{conf.name} Conference</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {conf.divisions.map(div => (
              <div key={div} style={S.card}>
                <div style={S.cardLabel}>{div}</div>
                {standings.filter(t => t.divisionName === div).sort((a, b) => a.divisionSequence - b.divisionSequence).map((t, i, arr) => (
                  <div key={tx(t.teamAbbrev)} onClick={() => onSelect(tx(t.teamAbbrev))} {...rowHover}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 700, width: 14 }}>{i + 1}</span>
                    <img src={t.teamLogo} style={{ width: 32, height: 32, objectFit: 'contain' }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{tx(t.teamName)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: MONO }}>{recordStr(t)} · {t.points} pts</div>
                    </div>
                    <ChevronRight size={14} color="var(--text4)" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamDetail({ abbrev, teamMap, onBack, onGameClick }) {
  const [tab, setTab] = useState('stats');
  const [clubStats, setClubStats] = useState(null);
  const [roster, setRoster] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const info = teamMap[abbrev];

  useEffect(() => {
    setClubStats(null); setRoster(null); setSchedule(null);
    nhlFetch(`/v1/club-stats/${abbrev}/now`).then(setClubStats).catch(() => setClubStats({}));
    nhlFetch(`/v1/roster/${abbrev}/current`).then(setRoster).catch(() => setRoster({}));
    nhlFetch(`/v1/club-schedule-season/${abbrev}/now`).then(setSchedule).catch(() => setSchedule({}));
  }, [abbrev]);

  const skaters = [...(clubStats?.skaters ?? [])].sort((a, b) => b.points - a.points || b.goals - a.goals);
  const goalies = [...(clubStats?.goalies ?? [])].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  const games = schedule?.games ?? [];

  return (
    <div>
      <button style={{ ...S.btnGray, marginBottom: 12 }} onClick={onBack}><ArrowLeft size={13} /> All teams</button>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', flexWrap: 'wrap', background: `linear-gradient(90deg, var(--surface2), var(--surface))` }}>
          <img src={logoFor(abbrev)} style={{ width: 80, height: 80, objectFit: 'contain' }} alt="" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>{info?.name ?? abbrev}</div>
            {info && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{info.division} Division · {info.conference} Conference</div>}
          </div>
          {info && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))', gap: 6 }}>
              <StatTile label="Record" value={recordStr(info)} />
              <StatTile label="Points" value={info.points} />
              <StatTile label="Div Rank" value={ordinal(info.divisionRank)} />
              <StatTile label="Diff" value={fmtPlus(info.goalDiff)} />
            </div>
          )}
        </div>
        <TabBar tabs={[['stats', <><BarChart3 size={13} /> Player Stats</>], ['roster', <><Users size={13} /> Roster</>], ['schedule', <><Calendar size={13} /> Schedule</>]]} active={tab} onChange={setTab} />
        <div style={{ padding: '12px 16px 16px' }}>
          {tab === 'stats' && (!clubStats ? <p style={S.empty}>Loading stats...</p> : (
            <>
              {skaters.length === 0 && <p style={S.empty}>No stats yet this season.</p>}
              {skaters.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ ...S.th, textAlign: 'left' }}>Skater</th>
                      {['Pos', 'GP', 'G', 'A', 'P', '+/-', 'PIM', 'PPG', 'S', 'S%', 'TOI', 'FO%'].map(l => <th key={l} style={S.th}>{l}</th>)}
                    </tr></thead>
                    <tbody>
                      {skaters.map(s => (
                        <tr key={s.playerId} style={{ borderTop: `1px solid ${LINE}` }}>
                          <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 600, color: INK }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Headshot src={s.headshot} size={24} />
                              <PlayerName id={s.playerId}>{tx(s.firstName)} {tx(s.lastName)}</PlayerName>
                            </span>
                          </td>
                          <td style={S.td}>{s.positionCode}</td>
                          <td style={S.td}>{s.gamesPlayed}</td>
                          <td style={S.td}>{s.goals}</td>
                          <td style={S.td}>{s.assists}</td>
                          <td style={{ ...S.td, fontWeight: 900, color: INK }}>{s.points}</td>
                          <td style={S.td}>{fmtPlus(s.plusMinus)}</td>
                          <td style={S.td}>{s.penaltyMinutes}</td>
                          <td style={S.td}>{s.powerPlayGoals}</td>
                          <td style={S.td}>{s.shots}</td>
                          <td style={S.td}>{s.shots ? `${(s.shootingPctg * 100).toFixed(1)}` : '—'}</td>
                          <td style={S.td}>{fmtToi(s.avgTimeOnIcePerGame)}</td>
                          <td style={S.td}>{s.faceoffWinPctg ? `${(s.faceoffWinPctg * 100).toFixed(1)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {goalies.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ ...S.th, textAlign: 'left' }}>Goalie</th>
                      {['GP', 'GS', 'W', 'L', 'OTL', 'GAA', 'SV%', 'SA', 'SV', 'SO'].map(l => <th key={l} style={S.th}>{l}</th>)}
                    </tr></thead>
                    <tbody>
                      {goalies.map(g => (
                        <tr key={g.playerId} style={{ borderTop: `1px solid ${LINE}` }}>
                          <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 600, color: INK }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Headshot src={g.headshot} size={24} />
                              <PlayerName id={g.playerId}>{tx(g.firstName)} {tx(g.lastName)}</PlayerName>
                            </span>
                          </td>
                          <td style={S.td}>{g.gamesPlayed}</td>
                          <td style={S.td}>{g.gamesStarted}</td>
                          <td style={{ ...S.td, fontWeight: 800, color: INK }}>{g.wins}</td>
                          <td style={S.td}>{g.losses}</td>
                          <td style={S.td}>{g.overtimeLosses}</td>
                          <td style={S.td}>{fmtNum(g.goalsAgainstAverage)}</td>
                          <td style={S.td}>{fmtPct(g.savePercentage)}</td>
                          <td style={S.td}>{g.shotsAgainst}</td>
                          <td style={S.td}>{g.saves}</td>
                          <td style={S.td}>{g.shutouts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ))}
          {tab === 'roster' && (!roster ? <p style={S.empty}>Loading roster...</p> : (
            [['Forwards', roster.forwards], ['Defense', roster.defensemen], ['Goalies', roster.goalies]].map(([label, list]) => list?.length > 0 && (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                  {list.map(pl => (
                    <PlayerName key={pl.id} id={pl.id} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: `1px solid ${LINE}`, borderRadius: RADIUS.md, background: 'var(--surface)' }} {...rowHover}>
                        <Headshot src={pl.headshot} size={42} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ color: ACCENT, fontFamily: MONO, marginRight: 5 }}>#{pl.sweaterNumber ?? '—'}</span>
                            {tx(pl.firstName)} {tx(pl.lastName)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {pl.positionCode} · {fmtHeight(pl.heightInInches)} · {pl.weightInPounds} lb · {pl.shootsCatches} · {pl.birthCountry}
                          </div>
                        </div>
                      </div>
                    </PlayerName>
                  ))}
                </div>
              </div>
            ))
          ))}
          {tab === 'schedule' && (!schedule ? <p style={S.empty}>Loading schedule...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {games.length === 0 && <p style={S.empty}>No schedule found.</p>}
              {games.map(g => {
                const home = g.homeTeam.abbrev === abbrev;
                const opp = home ? g.awayTeam : g.homeTeam;
                const us = home ? g.homeTeam : g.awayTeam;
                const final = isFinal(g);
                const won = final && us.score > opp.score;
                return (
                  <div key={g.id} onClick={() => onGameClick(g)} {...rowHover}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', borderBottom: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 12 }}>
                    <span style={{ width: 90, color: 'var(--text3)', flexShrink: 0 }}>{new Date(`${g.gameDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    {g.gameType === 1 && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text4)', border: `1px solid ${LINE2}`, borderRadius: 4, padding: '0 4px' }}>PRE</span>}
                    {g.gameType === 3 && <span style={{ fontSize: 9, fontWeight: 800, color: PUCK_ORANGE, border: `1px solid ${PUCK_ORANGE}`, borderRadius: 4, padding: '0 4px' }}>PLAYOFF</span>}
                    <span style={{ color: 'var(--text4)', width: 18 }}>{home ? 'vs' : '@'}</span>
                    <img src={logoFor(opp.abbrev)} style={{ width: 20, height: 20 }} alt="" />
                    <span style={{ fontWeight: 700, color: INK, flex: 1 }}>{teamMap[opp.abbrev]?.name ?? opp.abbrev}</span>
                    {final
                      ? <span style={{ fontFamily: MONO, fontWeight: 800, color: won ? '#15803d' : LIVE }}>{won ? 'W' : 'L'} {us.score}–{opp.score}{g.gameOutcome?.lastPeriodType && g.gameOutcome.lastPeriodType !== 'REG' ? ` ${g.gameOutcome.lastPeriodType}` : ''}</span>
                      : <span style={{ color: 'var(--text3)', fontFamily: MONO }}>{gameStatusText(g)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Leaders ────────────────────────────────────────────────────────────────
const SKATER_LEADER_CATS = [
  ['points', 'Points'], ['goals', 'Goals'], ['assists', 'Assists'],
  ['plusMinus', 'Plus/Minus'], ['goalsPp', 'Power-Play Goals'], ['penaltyMins', 'Penalty Minutes'],
];
const GOALIE_LEADER_CATS = [
  ['wins', 'Wins'], ['savePctg', 'Save %'], ['goalsAgainstAverage', 'Goals Against Avg'], ['shutouts', 'Shutouts'],
];
const fmtLeader = (cat, v) => cat === 'savePctg' ? fmtPct(v) : cat === 'goalsAgainstAverage' ? fmtNum(v) : cat === 'plusMinus' ? fmtPlus(v) : v;

function LeaderCard({ label, cat, leaders }) {
  const top = leaders?.[0];
  return (
    <div style={S.card}>
      <div style={S.cardLabel}><Trophy size={12} /> {label}</div>
      {!leaders && <p style={S.empty}>Loading...</p>}
      {leaders?.length === 0 && <p style={S.empty}>No data yet.</p>}
      {top && (
        <PlayerName id={top.id} style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${LINE}` }} {...rowHover}>
            <Headshot src={top.headshot} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{tx(top.firstName)} {tx(top.lastName)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <img src={top.teamLogo} style={{ width: 15, height: 15 }} alt="" /> {tx(top.teamName)} · #{top.sweaterNumber} · {top.position}
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: MONO, color: ACCENT }}>{fmtLeader(cat, top.value)}</div>
          </div>
        </PlayerName>
      )}
      {leaders?.slice(1).map((l, i) => (
        <PlayerName key={l.id} id={l.id} style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: `1px solid ${LINE}`, fontSize: 12 }} {...rowHover}>
            <span style={{ width: 16, color: 'var(--text4)', fontWeight: 700 }}>{i + 2}</span>
            <img src={l.teamLogo} style={{ width: 16, height: 16 }} alt="" />
            <span style={{ flex: 1, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx(l.firstName)} {tx(l.lastName)}</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--text2)' }}>{fmtLeader(cat, l.value)}</span>
          </div>
        </PlayerName>
      ))}
    </div>
  );
}

function useLeaders(limit) {
  const [skaters, setSkaters] = useState(null);
  const [goalies, setGoalies] = useState(null);
  useEffect(() => {
    nhlFetch(`/v1/skater-stats-leaders/current?categories=${SKATER_LEADER_CATS.map(c => c[0]).join(',')}&limit=${limit}`).then(setSkaters).catch(() => setSkaters({}));
    nhlFetch(`/v1/goalie-stats-leaders/current?categories=${GOALIE_LEADER_CATS.map(c => c[0]).join(',')}&limit=${limit}`).then(setGoalies).catch(() => setGoalies({}));
  }, [limit]);
  return { skaters, goalies };
}

function LeadersPage() {
  const { skaters, goalies } = useLeaders(10);
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 22 };
  return (
    <div>
      <div style={S.bodyHeader}><h2 style={S.sectionTitle}>League Leaders</h2></div>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text2)', margin: '0 0 10px' }}>Skaters</h3>
      <div style={grid}>
        {SKATER_LEADER_CATS.map(([cat, label]) => <LeaderCard key={cat} cat={cat} label={label} leaders={skaters ? (skaters[cat] ?? []) : null} />)}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text2)', margin: '0 0 10px' }}>Goaltenders</h3>
      <div style={grid}>
        {GOALIE_LEADER_CATS.map(([cat, label]) => <LeaderCard key={cat} cat={cat} label={label} leaders={goalies ? (goalies[cat] ?? []) : null} />)}
      </div>
    </div>
  );
}

// ─── Box Scores (aged newspaper clipping style) ─────────────────────────────
// Old-style hockey agate: a period-by-period line score, then the written
// scoring summary ("First Period — 1, Florida, Forsling 1 (Verhaeghe), 4:55
// (pp)."), shots on goal by period, power-play chances, goalies and three
// stars — styled like a yellowed newspaper page.
const PAPER = {
  page: '#e7dcbf',
  card: '#f3ead2',
  ink: '#2b2117',
  ink2: '#5f4f37',
  rule: '#8c7a55',
  ruleDark: '#332920',
};
const PAPER_FONT = "'Special Elite', 'Courier New', monospace";
const PAPER_SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
// Subtle fractal-noise grain, tiled, to fake aged paper texture.
const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`;

const lastName = (p) => tx(p?.lastName) || tx(p?.name).replace(/^\w\.\s*/, '');

function PaperLineScore({ game, rightRail }) {
  const byPeriod = rightRail?.linescore?.byPeriod ?? [];
  const periods = byPeriod.length ? byPeriod : [1, 2, 3].map(n => ({ periodDescriptor: { number: n, periodType: 'REG' } }));
  const th = { padding: '2px 5px', fontSize: 10, fontWeight: 700, color: PAPER.ink2, textAlign: 'center' };
  const td = { padding: '2px 5px', fontSize: 12, textAlign: 'center', color: PAPER.ink2 };
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${PAPER.rule}` }}>
          <th style={{ ...th, textAlign: 'left' }}></th>
          {periods.map((p, i) => <th key={i} style={th}>{periodLabel(p.periodDescriptor).replace(/(st|nd|rd|th)$/, '')}</th>)}
          <th style={{ ...th, borderLeft: `1px solid ${PAPER.rule}` }}>T</th>
        </tr>
      </thead>
      <tbody>
        {[['away', game.awayTeam], ['home', game.homeTeam]].map(([side, team]) => (
          <tr key={side}>
            <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: PAPER.ink }}>{teamName(team)}</td>
            {periods.map((p, i) => <td key={i} style={td}>{p[side] ?? '—'}</td>)}
            <td style={{ ...td, fontWeight: 700, color: PAPER.ink, borderLeft: `1px solid ${PAPER.rule}` }}>{team.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// City/place name as a newspaper would print it ("Florida", "N.Y. Rangers").
function teamName(team) {
  return tx(team.placeName) || tx(team.name) || team.abbrev;
}

function PaperBoxScore({ game, detail }) {
  const final = isFinal(game);
  const { awayTeam: away, homeTeam: home } = game;
  const cardStyle = {
    background: PAPER.card,
    backgroundImage: PAPER_NOISE,
    backgroundBlendMode: 'multiply',
    border: `1px solid ${PAPER.ruleDark}`,
    borderTop: `4px double ${PAPER.ruleDark}`,
    boxShadow: '2px 4px 10px rgba(30,20,10,0.28)',
    fontFamily: PAPER_FONT,
    color: PAPER.ink,
    padding: '0 14px 14px',
  };
  const lastType = game.gameOutcome?.lastPeriodType;
  const winner = away.score > home.score ? away : home;
  const loser = winner === away ? home : away;
  const names = { [away.abbrev]: tx(detail?.landing?.awayTeam?.placeName) || away.abbrev, [home.abbrev]: tx(detail?.landing?.homeTeam?.placeName) || home.abbrev };
  const nameOf = (abbrev) => names[abbrev] ?? abbrev;
  const headline = final
    ? `${tx(detail?.landing?.[winner === away ? 'awayTeam' : 'homeTeam']?.commonName) || winner.abbrev} ${winner.score}, ${tx(detail?.landing?.[loser === away ? 'awayTeam' : 'homeTeam']?.commonName) || loser.abbrev} ${loser.score}${lastType === 'OT' ? ' (OT)' : lastType === 'SO' ? ' (SO)' : ''}`
    : `${away.abbrev} at ${home.abbrev}`;

  const section = (label, body) => (
    <p style={{ margin: '5px 0', fontSize: 11.5, lineHeight: 1.45, color: PAPER.ink }}>
      <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span> — {body}
    </p>
  );

  if (!final || !detail) {
    return (
      <div style={cardStyle}>
        <div style={{ margin: '0 -14px', padding: '6px 14px', fontSize: 10, color: PAPER.ink2, borderBottom: `1px solid ${PAPER.ruleDark}`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tx(game.venue)}</div>
        <div style={{ fontFamily: PAPER_SERIF, fontWeight: 900, fontSize: 18, margin: '10px 0 4px' }}>{headline}</div>
        <div style={{ fontSize: 12, color: PAPER.ink2 }}>{final ? 'Setting type...' : gameStatusText(game)}</div>
      </div>
    );
  }

  const { landing, rightRail, boxscore } = detail;
  const goalsByPeriod = landing?.summary?.scoring ?? [];
  const pensByPeriod = landing?.summary?.penalties ?? [];
  const periodDescs = goalsByPeriod.length ? goalsByPeriod.map(p => p.periodDescriptor) : pensByPeriod.map(p => p.periodDescriptor);
  let goalNo = 0;
  const shots = rightRail?.shotsByPeriod ?? [];
  const pp = rightRail?.teamGameStats?.find(s => s.category === 'powerPlay');
  const goalieLine = (key, abbrev) => {
    const gs = (boxscore?.playerByGameStats?.[key]?.goalies ?? []).filter(g => g.toi && g.toi !== '00:00');
    return `${nameOf(abbrev)}, ${gs.map(g => `${tx(g.name).replace(/^\w\.\s*/, '')}${g.decision ? ` (${g.decision})` : ''} ${g.shotsAgainst}-${g.saves}`).join('; ')}`;
  };

  return (
    <div style={cardStyle}>
      <div style={{ margin: '0 -14px', padding: '6px 14px', fontSize: 10, color: PAPER.ink2, borderBottom: `1px solid ${PAPER.ruleDark}`, display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <span>{tx(game.venue)}</span>
        <span>{gameStatusText(game)}</span>
      </div>
      <div style={{ fontFamily: PAPER_SERIF, fontWeight: 900, fontSize: 20, margin: '10px 0 2px', lineHeight: 1.15 }}>{headline}</div>
      <PaperLineScore game={{ ...game, awayTeam: { ...away, placeName: names[away.abbrev] }, homeTeam: { ...home, placeName: names[home.abbrev] } }} rightRail={rightRail} />
      <div style={{ borderTop: `3px double ${PAPER.ruleDark}`, marginTop: 8, paddingTop: 4 }}>
        {periodDescs.map((pd, i) => {
          const goals = goalsByPeriod.find(p => p.periodDescriptor.number === pd.number)?.goals ?? [];
          const pens = pensByPeriod.find(p => p.periodDescriptor.number === pd.number)?.penalties ?? [];
          if (pd.periodType === 'SO') {
            return <div key={i}>{section('Shootout', goals.length ? goals.map(g => `${nameOf(tx(g.teamAbbrev))}, ${lastName(g)}`).join('; ') + '.' : 'No goals.')}</div>;
          }
          const goalText = goals.length
            ? goals.map(g => {
                goalNo += 1;
                const assists = g.assists?.length ? ` (${g.assists.map(a => lastName(a)).join(', ')})` : '';
                const tag = [g.strength && g.strength !== 'ev' ? g.strength : null, g.goalModifier === 'empty-net' ? 'en' : null].filter(Boolean).join(', ');
                return `${goalNo}, ${nameOf(tx(g.teamAbbrev))}, ${lastName(g)} ${g.goalsToDate ?? ''}${assists}, ${g.timeInPeriod}${tag ? ` (${tag})` : ''}`;
              }).join('. ') + '.'
            : 'None.';
          const penText = pens.length
            ? pens.map(p => `${p.committedByPlayer ? lastName(p.committedByPlayer) : 'Bench'}, ${tx(p.teamAbbrev)} (${(p.descKey ?? '').replace(/-/g, ' ')}), ${p.timeInPeriod}`).join('; ') + '.'
            : 'None.';
          return (
            <div key={i}>
              {section(periodLongName(pd), goalText)}
              <p style={{ margin: '0 0 5px', fontSize: 11.5, lineHeight: 1.45, color: PAPER.ink2 }}>Penalties — {penText}</p>
            </div>
          );
        })}
        {shots.length > 0 && section('Shots on goal', [['away', away], ['home', home]].map(([side, t]) =>
          `${nameOf(t.abbrev)} ${shots.map(p => p[side]).join('-')}—${shots.reduce((s, p) => s + (p[side] ?? 0), 0)}`).join('. ') + '.')}
        {pp && section('Power-play opportunities', `${nameOf(away.abbrev)} ${String(pp.awayValue).replace('/', ' of ')}; ${nameOf(home.abbrev)} ${String(pp.homeValue).replace('/', ' of ')}.`)}
        {boxscore && section('Goalies', `${goalieLine('awayTeam', away.abbrev)}. ${goalieLine('homeTeam', home.abbrev)}.`)}
        {landing?.summary?.threeStars?.length > 0 && section('Three stars', landing.summary.threeStars.map(s => `${s.star}. ${tx(s.name).replace(/^\w\.\s*/, '')}, ${s.teamAbbrev}`).join('; ') + '.')}
        {rightRail?.gameInfo?.referees?.length > 0 && section('Referees', rightRail.gameInfo.referees.map(r => tx(r.fullName)).join(', ') + '.')}
      </div>
    </div>
  );
}

function BoxScoresPage() {
  const [dateStr, setDateStr] = useState(() => shiftDate(localDateStr(), -1));
  const [games, setGames] = useState(null);
  const [details, setDetails] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setGames(null); setDetails({}); setError(null);
    nhlFetch(`/v1/score/${dateStr}`)
      .then(d => {
        if (cancelled) return;
        const list = d.games ?? [];
        setGames(list);
        list.filter(isFinal).forEach(g => {
          Promise.all([
            nhlFetch(`/v1/gamecenter/${g.id}/landing`).catch(() => null),
            nhlFetch(`/v1/gamecenter/${g.id}/right-rail`).catch(() => null),
            nhlFetch(`/v1/gamecenter/${g.id}/boxscore`).catch(() => null),
          ]).then(([landing, rightRail, boxscore]) => {
            if (!cancelled) setDetails(prev => ({ ...prev, [g.id]: { landing, rightRail, boxscore } }));
          });
        });
      })
      .catch(() => { if (!cancelled) { setGames([]); setError('Failed to load box scores.'); } });
    return () => { cancelled = true; };
  }, [dateStr]);

  const paperBtn = { fontFamily: PAPER_FONT, fontSize: 12, background: 'transparent', color: PAPER.ink, border: `1px solid ${PAPER.ruleDark}`, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
  const isTodayOrLater = dateStr >= localDateStr();

  return (
    <div style={{
      background: PAPER.page, backgroundImage: PAPER_NOISE, backgroundBlendMode: 'multiply',
      padding: '24px 20px 40px', margin: '-18px -16px 0', minHeight: 'calc(100vh - 100px)',
    }}>
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22, paddingBottom: 12, borderBottom: `4px double ${PAPER.ruleDark}` }}>
          <div style={{ fontFamily: PAPER_FONT, fontSize: 11, color: PAPER.ink2, letterSpacing: '0.2em', textTransform: 'uppercase' }}>The Papa Hockey Gazette</div>
          <div style={{ fontFamily: PAPER_SERIF, fontWeight: 900, fontSize: 38, letterSpacing: '0.05em', color: PAPER.ink, textTransform: 'uppercase', lineHeight: 1.1 }}>Hockey Summaries</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button style={paperBtn} onClick={() => setDateStr(d => shiftDate(d, -1))}><ChevronLeft size={12} /> Prev</button>
            <span style={{ fontFamily: PAPER_FONT, fontSize: 13, color: PAPER.ink2, fontStyle: 'italic' }}>{longDate(dateStr)}</span>
            <button style={{ ...paperBtn, opacity: isTodayOrLater ? 0.4 : 1 }} disabled={isTodayOrLater} onClick={() => setDateStr(d => shiftDate(d, 1))}>Next <ChevronRight size={12} /></button>
          </div>
        </div>
        {!games && <p style={{ textAlign: 'center', padding: '60px 0', color: PAPER.ink2, fontFamily: PAPER_FONT }}>Setting type...</p>}
        {error && <p style={{ textAlign: 'center', color: '#8a2c1f', padding: 24, fontFamily: PAPER_FONT }}>{error}</p>}
        {games && !error && games.length === 0 && (
          <p style={{ textAlign: 'center', padding: '60px 0', color: PAPER.ink2, fontFamily: PAPER_FONT }}>No games were played on this date.</p>
        )}
        <div style={{ columns: '380px', columnGap: 24 }}>
          {(games ?? []).map(g => (
            <div key={g.id} style={{ breakInside: 'avoid', marginBottom: 20 }}>
              <PaperBoxScore game={g} detail={details[g.id]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Home ───────────────────────────────────────────────────────────────────
function HomePage({ standings, games, dateStr, teamMap, onGameClick, onTeamClick }) {
  const todayQuote = useMemo(() => quoteOfTheDay(), []);
  const { skaters, goalies } = useLeaders(1);
  const featured = [
    ...[['points', 'Points'], ['goals', 'Goals'], ['assists', 'Assists']].map(([c, l]) => ({ cat: c, label: l, p: skaters?.[c]?.[0] })),
    ...[['wins', 'Wins'], ['savePctg', 'Save %'], ['goalsAgainstAverage', 'GAA']].map(([c, l]) => ({ cat: c, label: l, p: goalies?.[c]?.[0] })),
  ].filter(f => f.p);
  const isToday = dateStr === localDateStr();
  const th = { ...S.th, padding: '3px 5px' };
  const td = { ...S.td, padding: '3px 5px' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.cardLabel}><Calendar size={13} /> {isToday ? "Today's Games" : `Games · ${longDate(dateStr)}`}</div>
          {!games && <p style={S.empty}>Loading games...</p>}
          {games?.length === 0 && <p style={S.empty}>No games scheduled.</p>}
          {(games ?? []).map(g => {
            const started = isStarted(g);
            return (
              <div key={g.id} onClick={() => onGameClick(g)} {...rowHover}
                style={{ padding: '9px 16px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, fontSize: 12 }}>
                  {[g.awayTeam, g.homeTeam].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={logoFor(t.abbrev)} style={{ width: 20, height: 20, objectFit: 'contain' }} alt="" />
                      <span style={{ fontWeight: 700, color: 'var(--text)', width: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teamMap[t.abbrev]?.name ?? t.abbrev}</span>
                      {started && <span style={{ fontFamily: MONO, fontWeight: 900, color: 'var(--text)' }}>{t.score}</span>}
                    </div>
                  ))}
                </div>
                <StatusPill game={g} />
              </div>
            );
          })}
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}><Star size={13} /> League Leaders</div>
          {!skaters && <p style={S.empty}>Loading...</p>}
          {featured.map((f, i) => (
            <PlayerName key={f.cat} id={f.p.id} style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i === featured.length - 1 ? 'none' : `1px solid ${LINE}` }} {...rowHover}>
                <Headshot src={f.p.headshot} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tx(f.p.firstName)} {tx(f.p.lastName)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                    <img src={f.p.teamLogo} style={{ width: 15, height: 15 }} alt="" />{tx(f.p.teamName)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: MONO, color: ACCENT }}>{fmtLeader(f.cat, f.p.value)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label} leader</div>
                </div>
              </div>
            </PlayerName>
          ))}
        </div>
      </div>

      <div>
        {!standings && <div style={S.card}><p style={S.empty}>Loading standings...</p></div>}
        {standings && CONFERENCES.map(conf => (
          <div key={conf.name} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>{conf.name} Conference</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {conf.divisions.map(div => (
                <div key={div} style={{ background: 'var(--surface)', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                  <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 800, color: '#fff', background: conf.name === 'Eastern' ? ACCENT : BRAND }}>{div}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ ...th, textAlign: 'left', paddingLeft: 8 }}>Team</th>
                        <th style={th}>GP</th><th style={th}>W-L-OT</th><th style={th}>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.filter(t => t.divisionName === div).sort((a, b) => a.divisionSequence - b.divisionSequence).map(t => (
                        <tr key={tx(t.teamAbbrev)} onClick={() => onTeamClick(tx(t.teamAbbrev))} style={{ cursor: 'pointer', borderTop: `1px solid ${LINE}` }} {...rowHover}>
                          <td style={{ ...td, textAlign: 'left', paddingLeft: 8, fontFamily: 'inherit', fontWeight: 700, color: ACCENT }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <img src={t.teamLogo} style={{ width: 15, height: 15 }} alt="" />{tx(t.teamAbbrev)}
                            </span>
                          </td>
                          <td style={td}>{t.gamesPlayed}</td>
                          <td style={td}>{recordStr(t)}</td>
                          <td style={{ ...td, fontWeight: 900, color: 'var(--text)' }}>{t.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ ...S.card, marginTop: 8 }}>
          <div style={S.cardLabel}><ScrollText size={13} /> Quote of the Day</div>
          <div style={{ padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.5 }}>&ldquo;{todayQuote.quote}&rdquo;</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: ACCENT, textAlign: 'right' }}>— {todayQuote.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AHL ────────────────────────────────────────────────────────────────────
// AHL data comes from HockeyTech's LeagueStat feed (netlify/functions/ahl.js).
// Its shapes differ from the NHL API (every value arrives as a string, teams
// are keyed by numeric id, records are W-L-OTL-SOL), so the AHL views get
// their own components built from the same design pieces as the NHL ones.
// Logo file names vary by team and season (309.png, 317_90.png, ...), so the
// dashboard loads the real URLs from the season's team list and hands them
// down through context; the plain id URL is only a fallback.
const ahlLogoFallback = (teamId) => (teamId ? `https://assets.leaguestat.com/ahl/logos/${teamId}.png` : '');
const AhlLogoContext = createContext({});
const useAhlLogo = () => {
  const logos = useContext(AhlLogoContext);
  return (teamId) => logos[teamId] ?? ahlLogoFallback(teamId);
};
const ahlHeadshot = (playerId) => (playerId ? `https://assets.leaguestat.com/ahl/240x240/${playerId}.jpg` : '');
const ahlKit = (view, params = {}) => ahlFetch({ feed: 'modulekit', view, ...params }).then(d => d.SiteKit ?? {});
const ahlRecord = (t) => (t ? `${t.wins}-${t.losses}-${t.ot_losses}-${t.shootout_losses}` : '');
const ahlName = (p) => (p ? `${p.first_name} ${p.last_name}` : '');
const ahlHeight = (h) => (h ? `${h.replace('-', "'")}"` : '—');
// "00:08:05" → "8:05"
const ahlClock = (t) => (t ?? '').replace(/^00:/, '').replace(/^0(\d:)/, '$1');
const ahlPeriodName = (sum, pid) => ({ 1: 'First Period', 2: 'Second Period', 3: 'Third Period' }[pid]
  ?? (sum?.periods?.[pid]?.long_name === 'OT' ? 'Overtime' : sum?.periods?.[pid]?.long_name ?? `Period ${pid}`));

// The day's games and a team's schedule share most field names.
// status: 1 scheduled, 2 in progress, 3 unofficial final, 4 final.
function normAhlGame(g) {
  const status = Number(g.status);
  const side = (pre, idKey) => ({
    id: g[idKey], code: g[`${pre}_team_code`], name: g[`${pre}_team_name`],
    score: Number(g[`${pre}_goal_count`] ?? 0), shots: g[`${pre}_shots`] != null ? Number(g[`${pre}_shots`]) : null,
  });
  return {
    id: g.game_id ?? g.id, date: g.date_played, status, statusText: g.game_status,
    live: status === 2, final: status >= 3, started: status >= 2,
    venue: g.venue ?? g.venue_name, playoff: g.playoff === '1',
    away: side('visiting', 'visiting_team'), home: side('home', 'home_team'),
    goals: Array.isArray(g.goal_list) ? g.goal_list : [],
  };
}

function AhlTeamLine({ team, teamMap, showScore, winner }) {
  const ahlLogo = useAhlLogo();
  const info = teamMap[team.id];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img src={ahlLogo(team.id)} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} alt="" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: winner ? 900 : 700, fontSize: 15, color: winner ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {team.name ?? info?.name ?? team.code}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>
            {info ? `${ahlRecord(info)} · ${info.points} pts` : team.code}
            {showScore && team.shots > 0 && <span> · {team.shots} SOG</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: MONO, color: winner ? ACCENT : 'var(--text)', flexShrink: 0, marginLeft: 8 }}>
        {showScore ? team.score : <span style={{ fontSize: 12, color: 'var(--text4)' }}>—</span>}
      </div>
    </div>
  );
}

function AhlGameCard({ game, teamMap, onClick }) {
  const ahlLogo = useAhlLogo();
  const { away, home } = game;
  const idByCode = { [away.code]: away.id, [home.code]: home.id };
  const goals = game.goals;
  return (
    <div onClick={onClick} style={{ ...S.card, padding: '12px 14px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }} {...liftHover}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <StatusBadge live={game.live} final={game.final} text={game.statusText} />
        <span style={{ fontSize: 10, color: 'var(--text4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.venue}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AhlTeamLine team={away} teamMap={teamMap} showScore={game.started} winner={game.final && away.score > home.score} />
        <AhlTeamLine team={home} teamMap={teamMap} showScore={game.started} winner={game.final && home.score > away.score} />
      </div>
      {goals.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {goals.slice(-5).map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              <span style={{ fontFamily: MONO, color: 'var(--text4)', width: 58, flexShrink: 0 }}>{g.short_name === 'OT' ? 'OT' : ordinal(Number(g.period_id))} {ahlClock(g.time)}</span>
              <img src={ahlLogo(idByCode[g.code])} style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
              <span style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.first_name} {g.actual_last_name ?? g.last_name}
              </span>
              {g.power_play === '1' && <span style={{ fontSize: 9, fontWeight: 800, color: PUCK_ORANGE }}>PP</span>}
              {g.short_handed === '1' && <span style={{ fontSize: 9, fontWeight: 800, color: PUCK_ORANGE }}>SH</span>}
              {g.empty_net === '1' && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)' }}>EN</span>}
            </div>
          ))}
          {goals.length > 5 && <div style={{ fontSize: 10, color: 'var(--text4)' }}>+{goals.length - 5} earlier goal{goals.length - 5 === 1 ? '' : 's'}</div>}
        </div>
      )}
    </div>
  );
}

// ─── AHL game center ────────────────────────────────────────────────────────
function AhlLineScore({ sum }) {
  const ahlLogo = useAhlLogo();
  const pids = Object.keys(sum?.goalsByPeriod?.visitor ?? {});
  if (pids.length === 0) return null;
  const shots = sum.shotsByPeriod ?? {};
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>Team</th>
            {pids.map(pid => <th key={pid} style={S.th}>{sum.periods?.[pid]?.long_name ?? pid}</th>)}
            <th style={{ ...S.th, borderLeft: `1px solid ${LINE2}` }}>G</th>
            <th style={S.th}>SOG</th>
          </tr>
        </thead>
        <tbody>
          {[['visitor', sum.visitor], ['home', sum.home]].map(([side, team]) => (
            <tr key={side} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <img src={ahlLogo(team?.id)} style={{ width: 18, height: 18, objectFit: 'contain' }} alt="" />{team?.code}
                </span>
              </td>
              {pids.map(pid => <td key={pid} style={S.td}>{sum.goalsByPeriod[side]?.[pid] ?? '—'}</td>)}
              <td style={{ ...S.td, borderLeft: `1px solid ${LINE2}`, fontWeight: 900, color: 'var(--text)' }}>{sum.totalGoals?.[side] ?? '—'}</td>
              <td style={S.td}>{sum.totalShots?.[side] ?? Object.values(shots[side] ?? {}).reduce((a, b) => a + Number(b), 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AhlThreeStars({ sum }) {
  const stars = (sum?.mvps ?? []).filter(s => s.player_id);
  if (stars.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
      {stars.map((s, i) => {
        const team = Number(s.home) ? sum.home : sum.visitor;
        return (
          <div key={s.player_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, border: `1px solid ${LINE}`, borderRadius: RADIUS.md, background: 'var(--surface2)' }}>
            <Headshot src={ahlHeadshot(s.player_id)} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: PUCK_ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>★ {ordinal(i + 1)} Star</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <PlayerName id={s.player_id}>{ahlName(s)}</PlayerName>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{team?.code} · #{s.jersey_number}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const periodHeading = { fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 0', borderBottom: `1px solid ${LINE}` };
const flagChip = (text, bg = PUCK_ORANGE, color = '#fff') => (
  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color, background: bg, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' }}>{text}</span>
);

function AhlScoringSummary({ sum }) {
  const ahlLogo = useAhlLogo();
  const goals = sum?.goals ?? [];
  if (goals.length === 0) return <p style={S.empty}>No scoring yet.</p>;
  // Running score after each goal.
  const scored = goals.reduce((acc, g) => {
    const prev = acc[acc.length - 1] ?? { awayScore: 0, homeScore: 0 };
    const isHome = Number(g.home) === 1;
    return [...acc, { ...g, awayScore: prev.awayScore + (isHome ? 0 : 1), homeScore: prev.homeScore + (isHome ? 1 : 0) }];
  }, []);
  const pids = [...new Set(scored.map(g => g.period_id))];
  return (
    <div>
      {pids.map(pid => (
        <div key={pid} style={{ marginBottom: 12 }}>
          <div style={periodHeading}>{ahlPeriodName(sum, pid)}</div>
          {scored.filter(g => g.period_id === pid).map((g, gi) => {
            const assists = [g.assist1_player, g.assist2_player].filter(a => a?.player_id);
            return (
              <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
                <Headshot src={ahlHeadshot(g.goal_scorer?.player_id)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    <PlayerName id={g.goal_scorer?.player_id}>{ahlName(g.goal_scorer)}</PlayerName>
                    {g.scorer_goal_num && <span style={{ fontWeight: 400, color: 'var(--text3)' }}> ({g.scorer_goal_num})</span>}
                    {g.power_play === '1' && flagChip('pp')}
                    {g.short_handed === '1' && flagChip('sh')}
                    {g.penalty_shot === '1' && flagChip('ps')}
                    {g.empty_net === '1' && flagChip('EN', 'var(--surface2)', 'var(--text2)')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {assists.length
                      ? assists.map((a, ai) => <span key={a.player_id}>{ai > 0 && ', '}<PlayerName id={a.player_id}>{ahlName(a)}</PlayerName></span>)
                      : 'Unassisted'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                    <img src={ahlLogo(g.team_id)} style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" />
                    <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: 'var(--text)' }}>{g.awayScore}–{g.homeScore}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: MONO }}>{g.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AhlPenaltySummary({ sum }) {
  const ahlLogo = useAhlLogo();
  const pens = sum?.penalties ?? [];
  if (pens.length === 0) return <p style={S.empty}>No penalties.</p>;
  const pids = [...new Set(pens.map(p => p.period_id))];
  return (
    <div>
      {pids.map(pid => (
        <div key={pid} style={{ marginBottom: 12 }}>
          <div style={periodHeading}>{ahlPeriodName(sum, pid)}</div>
          {pens.filter(p => p.period_id === pid).map((pen, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
              <span style={{ fontFamily: MONO, color: 'var(--text4)', width: 40, flexShrink: 0 }}>{pen.time_off_formatted}</span>
              <img src={ahlLogo(pen.team_id)} style={{ width: 16, height: 16, flexShrink: 0, objectFit: 'contain' }} alt="" />
              <span style={{ flex: 1, minWidth: 0, color: 'var(--text)' }}>
                <strong>{pen.bench === '1' || !pen.player_penalized_info?.player_id ? 'Bench' : ahlName(pen.player_penalized_info)}</strong>
                <span style={{ color: 'var(--text3)' }}> — {pen.lang_penalty_description}</span>
              </span>
              <span style={{ fontFamily: MONO, color: 'var(--text2)', flexShrink: 0 }}>{pen.minutes} min</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AhlSkaterTable({ title, players }) {
  if (!players?.length) return null;
  const cols = [['G', p => p.goals], ['A', p => p.assists], ['P', p => Number(p.goals) + Number(p.assists)], ['+/-', p => fmtPlus(Number(p.plusminus))], ['SOG', p => p.shots], ['PIM', p => p.pim]];
  return (
    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>{title}</th>
            {cols.map(([l]) => <th key={l} style={S.th}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.player_id} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', color: 'var(--text)', fontWeight: 600 }}>
                <span style={{ color: 'var(--text4)', fontFamily: MONO, marginRight: 6 }}>{p.jersey_number}</span>
                <PlayerName id={p.player_id}>{ahlName(p)}</PlayerName>
                <span style={{ color: 'var(--text4)', fontSize: 10 }}> {p.position_str}</span>
              </td>
              {cols.map(([l, fn]) => {
                const hot = (l === 'G' || l === 'P') && Number(fn(p)) > 0;
                return <td key={l} style={{ ...S.td, fontWeight: hot ? 800 : 400, color: l === 'G' && hot ? ACCENT : S.td.color }}>{fn(p) ?? '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AhlGoalieTable({ goalies }) {
  if (!goalies?.length) return null;
  const decision = (g) => (g.win === '1' ? 'W' : g.loss === '1' ? 'L' : g.ot_loss === '1' ? 'OTL' : g.shootout_loss === '1' ? 'SOL' : '');
  return (
    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...S.th, textAlign: 'left' }}>Goalies</th>
            {['SA', 'SV', 'GA', 'SV%', 'TOI', 'DEC'].map(l => <th key={l} style={S.th}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {goalies.map(g => {
            const dec = decision(g);
            return (
              <tr key={g.player_id} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', color: 'var(--text)', fontWeight: 600 }}><PlayerName id={g.player_id}>{ahlName(g)}</PlayerName></td>
                <td style={S.td}>{g.shots_against}</td>
                <td style={S.td}>{g.saves}</td>
                <td style={S.td}>{g.goals_against}</td>
                <td style={{ ...S.td, fontWeight: 700, color: 'var(--text)' }}>{Number(g.shots_against) > 0 ? fmtPct(Number(g.saves) / Number(g.shots_against)) : '—'}</td>
                <td style={S.td}>{g.secs_mmss}</td>
                <td style={{ ...S.td, fontWeight: 800, color: dec === 'W' ? '#15803d' : dec ? LIVE : S.td.color }}>{dec}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AhlPlayerBoxScore({ sum }) {
  const ahlLogo = useAhlLogo();
  const sides = [['visitor', sum?.visitor_team_lineup], ['home', sum?.home_team_lineup]];
  if (!sides.some(([, l]) => l?.players?.length)) return <p style={S.empty}>Player stats will appear once the game starts.</p>;
  return (
    <div>
      {sides.map(([side, lineup]) => {
        const skaters = (lineup?.players ?? []).filter(p => p.position_str !== 'G');
        return (
          <div key={side} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
              <img src={ahlLogo(sum[side]?.id)} style={{ width: 22, height: 22, objectFit: 'contain' }} alt="" />
              {sum[side]?.name}
            </div>
            <AhlSkaterTable title="Forwards" players={skaters.filter(p => p.position_str !== 'D')} />
            <AhlSkaterTable title="Defense" players={skaters.filter(p => p.position_str === 'D')} />
            <AhlGoalieTable goalies={sum.goalies?.[side]} />
          </div>
        );
      })}
    </div>
  );
}

function AhlGameInfoPanel({ game, sum, teamMap }) {
  const row = (label, value) => value ? (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
      <span style={{ width: 110, flexShrink: 0, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em', paddingTop: 1 }}>{label}</span>
      <span style={{ color: 'var(--text)', flex: 1 }}>{value}</span>
    </div>
  ) : null;
  const away = teamMap[game.away.id];
  const home = teamMap[game.home.id];
  const pp = (side) => `${sum.powerPlayGoals?.[side] ?? 0} of ${sum.powerPlayCount?.[side] ?? 0}`;
  return (
    <div>
      {row('Date', sum?.game_date ?? longDate(game.date))}
      {row('Status', game.statusText)}
      {row('Arena', sum?.venue ?? game.venue)}
      {Number(sum?.meta?.attendance) > 0 && row('Attendance', Number(sum.meta.attendance).toLocaleString('en-US'))}
      {away && home && row('Records', `${game.away.code} ${ahlRecord(away)} (${away.points} pts) · ${game.home.code} ${ahlRecord(home)} (${home.points} pts)`)}
      {game.started && sum?.powerPlayCount && row('Power play', `${game.away.code} ${pp('visitor')} · ${game.home.code} ${pp('home')}`)}
      {row('Referees', [sum?.referee1, sum?.referee2].filter(Boolean).join(', '))}
      {row('Linesmen', [sum?.linesman1, sum?.linesman2].filter(Boolean).join(', '))}
    </div>
  );
}

function AhlGameModal({ game, teamMap, onClose }) {
  const ahlLogo = useAhlLogo();
  const [sum, setSum] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState(game.started ? 'summary' : 'info');

  useEffect(() => {
    const load = () => ahlFetch({ feed: 'gc', tab: 'gamesummary', game_id: game.id })
      .then(d => setSum(d.GC?.Gamesummary ?? null)).catch(() => {}).finally(() => setLoaded(true));
    load();
    if (!game.live) return;
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [game.id, game.live]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { away, home } = game;
  const tabs = game.started
    ? [['summary', 'Summary'], ['box', 'Box Score'], ['penalties', 'Penalties'], ['info', 'Game Info']]
    : [['info', 'Preview']];
  const side = (team) => (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <img src={ahlLogo(team.id)} style={{ width: 56, height: 56, objectFit: 'contain' }} alt="" />
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{team.name ?? teamMap[team.id]?.name ?? team.code}</div>
      <div style={{ fontSize: 11, color: 'var(--text4)' }}>{ahlRecord(teamMap[team.id])}</div>
    </div>
  );

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="fade-up" style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 20px 12px', background: 'linear-gradient(180deg, var(--surface2), var(--surface))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusBadge live={game.live} final={game.final} text={game.statusText} />
            <button style={S.modalClose} onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
            {side(away)}
            <div style={{ fontSize: 34, fontWeight: 900, fontFamily: MONO, color: 'var(--text)', flexShrink: 0 }}>
              {game.started ? `${sum?.totalGoals?.visitor ?? away.score}–${sum?.totalGoals?.home ?? home.score}` : <span style={{ fontSize: 16, color: 'var(--text3)' }}>@</span>}
            </div>
            {side(home)}
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{game.venue}</div>
        </div>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ padding: '16px 20px 20px' }}>
          {!loaded && <p style={S.empty}>Loading game center...</p>}
          {loaded && (
            <>
              {tab !== 'info' && <AhlLineScore sum={sum} />}
              {tab === 'summary' && (
                <>
                  <AhlThreeStars sum={sum} />
                  <AhlScoringSummary sum={sum} />
                </>
              )}
              {tab === 'box' && <AhlPlayerBoxScore sum={sum} />}
              {tab === 'penalties' && <AhlPenaltySummary sum={sum} />}
              {tab === 'info' && <AhlGameInfoPanel game={game} sum={sum ?? {}} teamMap={teamMap} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AHL player card ────────────────────────────────────────────────────────
const AHL_SKATER_COLS = [['GP', 'games_played'], ['G', 'goals'], ['A', 'assists'], ['P', 'points'], ['+/-', 'plus_minus'], ['PIM', 'penalty_minutes']];
const AHL_GOALIE_COLS = [['GP', 'games_played'], ['W', 'wins'], ['L', 'losses'], ['OTL', 'ot_losses'], ['SOL', 'shootout_losses'], ['GAA', 'gaa'], ['SV%', 'savepct'], ['SO', 'shutouts']];
const fmtAhlStat = (key, v) => v == null || v === '' ? '—' : key === 'savepct' ? fmtPct(v) : key === 'gaa' ? fmtNum(v) : key === 'plus_minus' ? fmtPlus(Number(v)) : v;

function AhlPlayerModal({ playerId, onClose }) {
  const ahlLogo = useAhlLogo();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null); setError(false);
    Promise.all([
      ahlKit('player', { category: 'profile', player_id: playerId }),
      ahlKit('player', { category: 'seasonstats', player_id: playerId }),
    ]).then(([prof, stats]) => {
      if (!prof.Player?.name) throw new Error('not found');
      setData({ p: prof.Player, stats: stats.Player ?? {} });
    }).catch(() => setError(true));
  }, [playerId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = data?.p;
  const isGoalie = p?.position === 'G';
  const cols = isGoalie ? AHL_GOALIE_COLS : AHL_SKATER_COLS;
  const regular = data?.stats?.regular ?? [];
  const seasons = regular.filter(s => s.season_name !== 'Total');
  const career = regular.find(s => s.season_name === 'Total');
  const latest = seasons[0];
  const tableCols = isGoalie ? AHL_GOALIE_COLS : [...AHL_SKATER_COLS, ['PPG', 'power_play_goals'], ['S', 'shots']];
  const draft = p?.draft?.[0];

  return (
    <div style={{ ...S.overlay, zIndex: 120 }} onClick={onClose}>
      <div className="fade-up" style={{ ...S.modal, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        {error && <p style={S.empty}>Couldn't load this player.</p>}
        {!p && !error && <p style={S.empty}>Loading player...</p>}
        {p && (
          <>
            <div style={{ position: 'relative', background: `linear-gradient(120deg, #111827, ${BRAND})`, color: '#fff', padding: '20px 20px 16px' }}>
              <button style={{ ...S.modalClose, position: 'absolute', top: 12, right: 12, zIndex: 2 }} onClick={onClose} aria-label="Close"><X size={14} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Headshot src={p.primary_image || ahlHeadshot(playerId)} size={96} style={{ border: '3px solid #fff' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.most_recent_team_id && <img src={ahlLogo(p.most_recent_team_id)} style={{ width: 20, height: 20, background: '#fff', borderRadius: 4, padding: 1, objectFit: 'contain' }} alt="" />}
                    {p.most_recent_team_name || 'AHL'} · #{p.jersey_number || '—'} · {p.position}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                    {ahlHeight(p.height)} · {p.weight} lb · {isGoalie ? 'Catches' : 'Shoots'} {isGoalie ? p.catches : p.shoots}
                    {p.birthdate && <> · Born {new Date(`${p.birthdate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{p.birthtown ? `, ${p.birthtown}` : ''}</>}
                  </div>
                  {draft?.draft_text && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{draft.draft_league} Draft: {draft.draft_text.trim()}</div>}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
              {latest && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 10px', padding: '6px 20px' }}>{latest.season_name}{latest.team_code ? ` · ${latest.team_code}` : ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 6, marginBottom: 14 }}>
                    {cols.map(([l, k]) => <StatTile key={l} label={l} value={fmtAhlStat(k, latest[k])} />)}
                  </div>
                </>
              )}
              {career && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 10px', padding: '6px 20px' }}>AHL Career</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 6, marginBottom: 14 }}>
                    {cols.map(([l, k]) => <StatTile key={l} label={l} value={fmtAhlStat(k, career[k])} />)}
                  </div>
                </>
              )}
              {seasons.length > 0 && (
                <>
                  <div style={{ ...S.cardLabel, margin: '0 -20px 8px', padding: '6px 20px' }}>Season by Season</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead><tr>
                        <th style={{ ...S.th, textAlign: 'left' }}>Season</th><th style={{ ...S.th, textAlign: 'left' }}>Team</th>
                        {tableCols.map(([l]) => <th key={l} style={S.th}>{l}</th>)}
                      </tr></thead>
                      <tbody>
                        {seasons.map((s, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
                            <td style={{ ...S.td, textAlign: 'left' }}>{s.shortname}</td>
                            <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit' }}>{s.team_name}</td>
                            {tableCols.map(([l, k]) => <td key={l} style={S.td}>{fmtAhlStat(k, s[k])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {!latest && <p style={S.empty}>No AHL regular-season stats yet.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── AHL standings ──────────────────────────────────────────────────────────
const AHL_CLINCH_LABELS = { x: 'Clinched playoff berth', y: 'Clinched division', z: 'Clinched conference', e: 'Eliminated' };

function AhlStandingsTable({ title, rows, onTeamClick, accent = ACCENT }) {
  const ahlLogo = useAhlLogo();
  const cols = [
    ['GP', t => t.games_played], ['W', t => t.wins], ['L', t => t.losses], ['OTL', t => t.ot_losses], ['SOL', t => t.shootout_losses],
    ['PTS', t => t.points, true], ['PCT', t => fmtPct(t.percentage)], ['RW', t => t.regulation_wins],
    ['GF', t => t.goals_for], ['GA', t => t.goals_against], ['DIFF', t => fmtPlus(Number(t.goals_diff))],
    ['HOME', t => t.home_record], ['AWAY', t => t.visiting_record], ['L10', t => t.past_10], ['STRK', t => t.streak_wl || '—'],
    ['PP%', t => t.power_play_pct], ['PK%', t => t.penalty_kill_pct],
  ];
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, color: '#fff', background: accent, letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...S.th, width: 24 }}>#</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Team</th>
              {cols.map(([l]) => <th key={l} style={S.th}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.team_id} onClick={() => onTeamClick?.(t.team_id)} {...rowHover}
                style={{ cursor: onTeamClick ? 'pointer' : 'default', borderTop: `1px solid ${LINE}` }}>
                <td style={{ ...S.td, color: 'var(--text4)' }}>{i + 1}</td>
                <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <img src={ahlLogo(t.team_id)} style={{ width: 22, height: 22, objectFit: 'contain' }} alt="" />
                    {t.team_name}
                    {t.clinched && <span title={AHL_CLINCH_LABELS[t.clinched]} style={{ fontSize: 10, fontWeight: 800, color: t.clinched === 'e' ? LIVE : '#15803d' }}>{t.clinched}</span>}
                  </span>
                </td>
                {cols.map(([l, fn, bold]) => <td key={l} style={{ ...S.td, fontWeight: bold ? 900 : 400, color: bold ? 'var(--text)' : S.td.color }}>{fn(t)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The AHL ranks teams by points percentage (teams play different numbers of games).
const byAhlPct = (a, b) => Number(b.percentage_full) - Number(a.percentage_full) || Number(b.points) - Number(a.points);

function AhlStandingsPage({ standings, seasonPicker, onTeamClick }) {
  const [view, setView] = useState('division');
  const rows = standings;
  const conferences = [...new Set((rows ?? []).map(t => t.conference_name))];
  const divisions = [...new Set((rows ?? []).map(t => t.division_name))];
  const confAccent = (conf) => (conferences.indexOf(conf) === 0 ? ACCENT : BRAND);
  const btn = (id, label) => (
    <button onClick={() => setView(id)} style={{ ...S.btnGray, background: view === id ? ACCENT : 'var(--surface)', color: view === id ? '#fff' : INK, borderColor: view === id ? ACCENT : undefined }}>{label}</button>
  );
  return (
    <div>
      <div style={S.bodyHeader}>
        <h2 style={S.sectionTitle}>AHL Standings</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {btn('division', 'Division')}
          {btn('conference', 'Conference')}
          {btn('league', 'League')}
          {seasonPicker}
        </div>
      </div>
      {!rows && <p style={S.empty}>Loading standings...</p>}
      {rows && rows.length === 0 && <p style={S.empty}>No standings available.</p>}
      {rows && rows.length > 0 && (
        <>
          {view === 'division' && divisions.map(div => {
            const teams = rows.filter(t => t.division_name === div);
            return <AhlStandingsTable key={div} title={div} rows={teams} onTeamClick={onTeamClick} accent={confAccent(teams[0]?.conference_name)} />;
          })}
          {view === 'conference' && conferences.map(conf => (
            <AhlStandingsTable key={conf} title={conf} onTeamClick={onTeamClick} accent={confAccent(conf)}
              rows={rows.filter(t => t.conference_name === conf).sort(byAhlPct)} />
          ))}
          {view === 'league' && (
            <AhlStandingsTable title="American Hockey League" onTeamClick={onTeamClick} accent={BRAND} rows={[...rows].sort(byAhlPct)} />
          )}
          <p style={{ fontSize: 11, color: 'var(--text4)' }}>
            Record is W-L-OTL-SOL. Teams are ranked by points percentage. {Object.entries(AHL_CLINCH_LABELS).map(([k, v]) => `${k} — ${v}`).join(' · ')}
          </p>
        </>
      )}
    </div>
  );
}

// ─── AHL teams ──────────────────────────────────────────────────────────────
function AhlTeamsGrid({ standings, onSelect }) {
  const ahlLogo = useAhlLogo();
  if (!standings) return <p style={S.empty}>Loading teams...</p>;
  if (standings.length === 0) return <p style={S.empty}>No teams found for this season.</p>;
  const conferences = [...new Set(standings.map(t => t.conference_name))];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {conferences.map(conf => (
        <div key={conf}>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${AHL_RED}` }}>{conf}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            {[...new Set(standings.filter(t => t.conference_name === conf).map(t => t.division_name))].map(div => (
              <div key={div} style={S.card}>
                <div style={S.cardLabel}>{div}</div>
                {standings.filter(t => t.division_name === div).map((t, i, arr) => (
                  <div key={t.team_id} onClick={() => onSelect(t.team_id)} {...rowHover}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 700, width: 14 }}>{i + 1}</span>
                    <img src={ahlLogo(t.team_id)} style={{ width: 32, height: 32, objectFit: 'contain' }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{t.team_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: MONO }}>{ahlRecord(t)} · {t.points} pts</div>
                    </div>
                    <ChevronRight size={14} color="var(--text4)" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AhlTeamDetail({ teamId, teamMap, seasonId, seasonPicker, onBack, onGameClick }) {
  const ahlLogo = useAhlLogo();
  const [tab, setTab] = useState('stats');
  const [skaters, setSkaters] = useState(null);
  const [goalies, setGoalies] = useState(null);
  const [roster, setRoster] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const info = teamMap[teamId];

  useEffect(() => {
    if (!seasonId) return;
    setSkaters(null); setGoalies(null); setRoster(null); setSchedule(null);
    const common = { season_id: seasonId, team_id: teamId, first: 0, limit: 200, context: 'overall' };
    ahlKit('statviewtype', { ...common, type: 'topscorers', sort: 'points', stat: 'all', qualified: 'all' }).then(d => setSkaters((d.Statviewtype ?? []).filter(p => p.position !== 'G'))).catch(() => setSkaters([]));
    ahlKit('statviewtype', { ...common, type: 'topgoalies', sort: 'gaa', qualified: 'all' }).then(d => setGoalies(d.Statviewtype ?? [])).catch(() => setGoalies([]));
    ahlKit('roster', { team_id: teamId, season_id: seasonId }).then(d => setRoster((d.Roster ?? []).filter(p => p?.position))).catch(() => setRoster([]));
    ahlKit('schedule', { team_id: teamId, season_id: seasonId }).then(d => setSchedule((d.Schedule ?? []).map(normAhlGame))).catch(() => setSchedule([]));
  }, [teamId, seasonId]);

  const games = schedule ?? [];
  const nameFromSchedule = games[0] && (games[0].home.id === teamId ? games[0].home.name : games[0].away.name);
  const rosterGroups = [
    ['Forwards', (roster ?? []).filter(p => !['D', 'G'].includes(p.position))],
    ['Defense', (roster ?? []).filter(p => p.position === 'D')],
    ['Goalies', (roster ?? []).filter(p => p.position === 'G')],
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={S.btnGray} onClick={onBack}><ArrowLeft size={13} /> All teams</button>
        {seasonPicker}
      </div>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', flexWrap: 'wrap', background: 'linear-gradient(90deg, var(--surface2), var(--surface))' }}>
          <img src={ahlLogo(teamId)} style={{ width: 80, height: 80, objectFit: 'contain' }} alt="" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>{info?.name ?? nameFromSchedule ?? 'AHL Team'}</div>
            {info && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{info.division} · {info.conference}</div>}
          </div>
          {info && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))', gap: 6 }}>
              <StatTile label="Record" value={ahlRecord(info)} />
              <StatTile label="Points" value={info.points} />
              <StatTile label="Div Rank" value={ordinal(info.divisionRank)} />
              <StatTile label="Diff" value={fmtPlus(info.goalDiff)} />
            </div>
          )}
        </div>
        <TabBar tabs={[['stats', <><BarChart3 size={13} /> Player Stats</>], ['roster', <><Users size={13} /> Roster</>], ['schedule', <><Calendar size={13} /> Schedule</>]]} active={tab} onChange={setTab} />
        <div style={{ padding: '12px 16px 16px' }}>
          {tab === 'stats' && (!skaters || !goalies ? <p style={S.empty}>Loading stats...</p> : (
            <>
              {skaters.length === 0 && <p style={S.empty}>No stats yet this season.</p>}
              {skaters.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ ...S.th, textAlign: 'left' }}>Skater</th>
                      {['Pos', 'GP', 'G', 'A', 'P', '+/-', 'PIM', 'PPG', 'SHG', 'S', 'S%'].map(l => <th key={l} style={S.th}>{l}</th>)}
                    </tr></thead>
                    <tbody>
                      {skaters.map(s => (
                        <tr key={s.player_id} style={{ borderTop: `1px solid ${LINE}` }}>
                          <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 600, color: INK }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Headshot src={ahlHeadshot(s.player_id)} size={24} />
                              <PlayerName id={s.player_id}>{s.name}</PlayerName>
                              {s.rookie === '1' && <span style={{ fontSize: 9, fontWeight: 800, color: PUCK_ORANGE }}>R</span>}
                            </span>
                          </td>
                          <td style={S.td}>{s.position}</td>
                          <td style={S.td}>{s.games_played}</td>
                          <td style={S.td}>{s.goals}</td>
                          <td style={S.td}>{s.assists}</td>
                          <td style={{ ...S.td, fontWeight: 900, color: INK }}>{s.points}</td>
                          <td style={S.td}>{fmtPlus(Number(s.plus_minus))}</td>
                          <td style={S.td}>{s.penalty_minutes}</td>
                          <td style={S.td}>{s.power_play_goals}</td>
                          <td style={S.td}>{s.short_handed_goals}</td>
                          <td style={S.td}>{s.shots}</td>
                          <td style={S.td}>{Number(s.shots) ? s.shooting_percentage : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {goalies.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ ...S.th, textAlign: 'left' }}>Goalie</th>
                      {['GP', 'W', 'L', 'OTL', 'SOL', 'GAA', 'SV%', 'SA', 'SV', 'SO'].map(l => <th key={l} style={S.th}>{l}</th>)}
                    </tr></thead>
                    <tbody>
                      {[...goalies].sort((a, b) => Number(b.games_played) - Number(a.games_played)).map(g => (
                        <tr key={g.player_id} style={{ borderTop: `1px solid ${LINE}` }}>
                          <td style={{ ...S.td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 600, color: INK }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <Headshot src={ahlHeadshot(g.player_id)} size={24} />
                              <PlayerName id={g.player_id}>{g.name}</PlayerName>
                            </span>
                          </td>
                          <td style={S.td}>{g.games_played}</td>
                          <td style={{ ...S.td, fontWeight: 800, color: INK }}>{g.wins}</td>
                          <td style={S.td}>{g.losses}</td>
                          <td style={S.td}>{g.ot_losses}</td>
                          <td style={S.td}>{g.shootout_losses}</td>
                          <td style={S.td}>{fmtNum(g.goals_against_average)}</td>
                          <td style={S.td}>{fmtPct(g.save_percentage)}</td>
                          <td style={S.td}>{g.shots}</td>
                          <td style={S.td}>{g.saves}</td>
                          <td style={S.td}>{g.shutouts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ))}
          {tab === 'roster' && (!roster ? <p style={S.empty}>Loading roster...</p> : roster.length === 0 ? <p style={S.empty}>No roster listed for this season.</p> : (
            rosterGroups.map(([label, list]) => list.length > 0 && (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                  {list.map(pl => (
                    <PlayerName key={pl.player_id} id={pl.player_id} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: `1px solid ${LINE}`, borderRadius: RADIUS.md, background: 'var(--surface)' }} {...rowHover}>
                        <Headshot src={pl.player_image || ahlHeadshot(pl.player_id)} size={42} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ color: ACCENT, fontFamily: MONO, marginRight: 5 }}>#{pl.tp_jersey_number || '—'}</span>
                            {pl.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {pl.position} · {ahlHeight(pl.height)} · {pl.weight} lb · {pl.shoots}{pl.birthplace ? ` · ${pl.birthplace.replace(/,\s*$/, '')}` : ''}
                          </div>
                        </div>
                      </div>
                    </PlayerName>
                  ))}
                </div>
              </div>
            ))
          ))}
          {tab === 'schedule' && (!schedule ? <p style={S.empty}>Loading schedule...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {games.length === 0 && <p style={S.empty}>No schedule found.</p>}
              {games.map(g => {
                const home = g.home.id === teamId;
                const opp = home ? g.away : g.home;
                const us = home ? g.home : g.away;
                const won = g.final && us.score > opp.score;
                return (
                  <div key={g.id} onClick={() => onGameClick(g)} {...rowHover}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', borderBottom: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 12 }}>
                    <span style={{ width: 90, color: 'var(--text3)', flexShrink: 0 }}>{new Date(`${g.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span style={{ color: 'var(--text4)', width: 18 }}>{home ? 'vs' : '@'}</span>
                    <img src={ahlLogo(opp.id)} style={{ width: 20, height: 20, objectFit: 'contain' }} alt="" />
                    <span style={{ fontWeight: 700, color: INK, flex: 1 }}>{opp.name ?? teamMap[opp.id]?.name ?? opp.code}</span>
                    {g.final
                      ? <span style={{ fontFamily: MONO, fontWeight: 800, color: won ? '#15803d' : LIVE }}>{won ? 'W' : 'L'} {us.score}–{opp.score}{/OT|SO/.test(g.statusText ?? '') ? ` ${g.statusText.match(/\d*OT|SO/)[0]}` : ''}</span>
                      : <span style={{ color: 'var(--text3)', fontFamily: MONO }}>{g.statusText}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AHL leaders ────────────────────────────────────────────────────────────
// [cat, label, feed type, sort param, value field, extra params]. The cat ids
// reuse the NHL names so fmtLeader/LeaderCard format them the same way.
const AHL_SKATER_LEADER_CATS = [
  ['points', 'Points', 'topscorers', 'points', 'points'],
  ['goals', 'Goals', 'topscorers', 'goals', 'goals'],
  ['assists', 'Assists', 'topscorers', 'assists', 'assists'],
  ['rookiePoints', 'Rookie Points', 'topscorers', 'points', 'points', { stat: 'rookies' }],
  ['plusMinus', 'Plus/Minus', 'topscorers', 'plus_minus', 'plus_minus'],
  ['goalsPp', 'Power-Play Goals', 'topscorers', 'power_play_goals', 'power_play_goals'],
  ['penaltyMins', 'Penalty Minutes', 'topscorers', 'penalty_minutes', 'penalty_minutes'],
];
const AHL_GOALIE_LEADER_CATS = [
  ['wins', 'Wins', 'topgoalies', 'wins', 'wins'],
  ['savePctg', 'Save %', 'topgoalies', 'save_percentage', 'save_percentage'],
  ['goalsAgainstAverage', 'Goals Against Avg', 'topgoalies', 'gaa', 'goals_against_average'],
  ['shutouts', 'Shutouts', 'topgoalies', 'shutouts', 'shutouts'],
];
const AHL_ALL_LEADER_CATS = [...AHL_SKATER_LEADER_CATS, ...AHL_GOALIE_LEADER_CATS];
const AHL_HOME_LEADER_CATS = AHL_ALL_LEADER_CATS.filter(c => ['points', 'goals', 'assists', 'wins', 'savePctg', 'goalsAgainstAverage'].includes(c[0]));

// Returns { [cat]: rows } in LeaderCard's shape; a cat is missing until it loads.
function useAhlLeaders(seasonId, limit, cats) {
  const [data, setData] = useState({});
  useEffect(() => {
    if (!seasonId) return;
    let cancelled = false;
    setData({});
    cats.forEach(([cat, , type, sort, key, extra]) => {
      const qualify = type === 'topscorers' ? { stat: 'all', qualified: 'all' } : { qualified: 'qualified' };
      ahlKit('statviewtype', { type, season_id: seasonId, first: 0, limit, sort, context: 'overall', ...qualify, ...extra })
        .then(d => (d.Statviewtype ?? []).map(r => ({
          id: r.player_id, headshot: ahlHeadshot(r.player_id), firstName: r.first_name, lastName: r.last_name,
          teamId: r.team_id, teamName: r.team_name, sweaterNumber: r.jersey_number, position: r.position ?? 'G',
          value: Number(r[key]),
        })))
        .catch(() => [])
        .then(rows => { if (!cancelled) setData(prev => ({ ...prev, [cat]: rows })); });
    });
    return () => { cancelled = true; };
  }, [seasonId, limit, cats]);
  const ahlLogo = useAhlLogo();
  return Object.fromEntries(Object.entries(data).map(([cat, rows]) => [cat, rows.map(r => ({ ...r, teamLogo: ahlLogo(r.teamId) }))]));
}

function AhlLeadersPage({ seasonId, seasonPicker }) {
  const leaders = useAhlLeaders(seasonId, 10, AHL_ALL_LEADER_CATS);
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14, marginBottom: 22 };
  return (
    <div>
      <div style={S.bodyHeader}><h2 style={S.sectionTitle}>AHL Leaders</h2>{seasonPicker}</div>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text2)', margin: '0 0 10px' }}>Skaters</h3>
      <div style={grid}>
        {AHL_SKATER_LEADER_CATS.map(([cat, label]) => <LeaderCard key={cat} cat={cat} label={label} leaders={leaders[cat]} />)}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text2)', margin: '0 0 10px' }}>Goaltenders <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--text4)' }}>(qualified)</span></h3>
      <div style={grid}>
        {AHL_GOALIE_LEADER_CATS.map(([cat, label]) => <LeaderCard key={cat} cat={cat} label={label} leaders={leaders[cat]} />)}
      </div>
    </div>
  );
}

// ─── AHL home ───────────────────────────────────────────────────────────────
function AhlHomePage({ standings, games, dateStr, seasonId, onGameClick, onTeamClick }) {
  const ahlLogo = useAhlLogo();
  const todayQuote = useMemo(() => quoteOfTheDay(), []);
  const leaders = useAhlLeaders(seasonId, 1, AHL_HOME_LEADER_CATS);
  const featured = AHL_HOME_LEADER_CATS.map(([cat, label]) => ({ cat, label, p: leaders[cat]?.[0] })).filter(f => f.p);
  const isToday = dateStr === localDateStr();
  const conferences = [...new Set((standings ?? []).map(t => t.conference_name))];
  const th = { ...S.th, padding: '3px 5px' };
  const td = { ...S.td, padding: '3px 5px' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.cardLabel}><Calendar size={13} /> {isToday ? "Today's AHL Games" : `AHL Games · ${longDate(dateStr)}`}</div>
          {!games && <p style={S.empty}>Loading games...</p>}
          {games?.length === 0 && <p style={S.empty}>No games scheduled.</p>}
          {(games ?? []).map(g => (
            <div key={g.id} onClick={() => onGameClick(g)} {...rowHover}
              style={{ padding: '9px 16px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, fontSize: 12 }}>
                {[g.away, g.home].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={ahlLogo(t.id)} style={{ width: 20, height: 20, objectFit: 'contain' }} alt="" />
                    <span style={{ fontWeight: 700, color: 'var(--text)', width: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name ?? t.code}</span>
                    {g.started && <span style={{ fontFamily: MONO, fontWeight: 900, color: 'var(--text)' }}>{t.score}</span>}
                  </div>
                ))}
              </div>
              <StatusBadge live={g.live} final={g.final} text={g.statusText} />
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}><Star size={13} /> AHL Leaders</div>
          {featured.length === 0 && <p style={S.empty}>{Object.keys(leaders).length < AHL_HOME_LEADER_CATS.length ? 'Loading...' : 'No stats yet this season.'}</p>}
          {featured.map((f, i) => (
            <PlayerName key={f.cat} id={f.p.id} style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i === featured.length - 1 ? 'none' : `1px solid ${LINE}` }} {...rowHover}>
                <Headshot src={f.p.headshot} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{f.p.firstName} {f.p.lastName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                    <img src={f.p.teamLogo} style={{ width: 15, height: 15, objectFit: 'contain' }} alt="" />{f.p.teamName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: MONO, color: ACCENT }}>{fmtLeader(f.cat, f.p.value)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label} leader</div>
                </div>
              </div>
            </PlayerName>
          ))}
        </div>
      </div>

      <div>
        {!standings && <div style={S.card}><p style={S.empty}>Loading standings...</p></div>}
        {conferences.map((conf, ci) => (
          <div key={conf} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>{conf}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {[...new Set(standings.filter(t => t.conference_name === conf).map(t => t.division_name))].map(div => (
                <div key={div} style={{ background: 'var(--surface)', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                  <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 800, color: '#fff', background: ci === 0 ? ACCENT : BRAND }}>{div}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ ...th, textAlign: 'left', paddingLeft: 8 }}>Team</th>
                        <th style={th}>GP</th><th style={th}>W-L-OT-SO</th><th style={th}>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.filter(t => t.division_name === div).map(t => (
                        <tr key={t.team_id} onClick={() => onTeamClick(t.team_id)} style={{ cursor: 'pointer', borderTop: `1px solid ${LINE}` }} {...rowHover}>
                          <td style={{ ...td, textAlign: 'left', paddingLeft: 8, fontFamily: 'inherit', fontWeight: 700, color: ACCENT }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <img src={ahlLogo(t.team_id)} style={{ width: 15, height: 15, objectFit: 'contain' }} alt="" />{t.team_code}
                            </span>
                          </td>
                          <td style={td}>{t.games_played}</td>
                          <td style={td}>{ahlRecord(t)}</td>
                          <td style={{ ...td, fontWeight: 900, color: 'var(--text)' }}>{t.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ ...S.card, marginTop: 8 }}>
          <div style={S.cardLabel}><ScrollText size={13} /> Quote of the Day</div>
          <div style={{ padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.5 }}>&ldquo;{todayQuote.quote}&rdquo;</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: ACCENT, textAlign: 'right' }}>— {todayQuote.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AHL dashboard ──────────────────────────────────────────────────────────
// Everything under the AHL toggle. The header's date controls, tab bar and
// Refresh button are shared with the NHL side and passed in.
function AhlDashboard({ tab, dateStr, refreshKey, onRefreshed, selectedTeam, onSelectTeam, onOpenTeam }) {
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState(null);
  const [standings, setStandings] = useState(null);
  const [games, setGames] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [logos, setLogos] = useState({});

  const dateRef = useRef(dateStr);
  useEffect(() => { dateRef.current = dateStr; }, [dateStr]);
  const seasonRef = useRef(seasonId);
  useEffect(() => { seasonRef.current = seasonId; }, [seasonId]);

  const fetchGames = (date, silent = false) => {
    if (!silent) { setGames(null); setError(null); }
    return ahlKit('gamesbydate', { fetch_date: date })
      .then(d => {
        if (date !== dateRef.current) return;
        setGames((d.Gamesbydate ?? []).map(normAhlGame));
        onRefreshed(new Date());
      })
      .catch(() => { if (!silent && date === dateRef.current) { setGames([]); setError('Failed to load AHL games.'); } });
  };
  const fetchStandings = (sid) => ahlKit('statviewtype', { type: 'standings', stat: 'division', season_id: sid, context: 'overall', special: 'false' })
    .then(d => { if (sid === seasonRef.current) setStandings((d.Statviewtype ?? []).filter(r => r.team_id)); })
    .catch(() => { if (sid === seasonRef.current) setStandings([]); });

  // Regular seasons only; default to the newest one that has started.
  useEffect(() => {
    ahlKit('seasons').then(d => {
      const regular = (d.Seasons ?? []).filter(s => s.career === '1' && s.playoff === '0');
      const today = localDateStr();
      setSeasons(regular);
      setSeasonId((regular.find(s => s.start_date <= today) ?? regular[0])?.season_id ?? null);
    }).catch(() => setStandings([]));
  }, []);

  useEffect(() => { fetchGames(dateStr); }, [dateStr]);
  useEffect(() => {
    if (!seasonId) return;
    setStandings(null);
    fetchStandings(seasonId);
    ahlKit('teamsbyseason', { season_id: seasonId }).then(d => {
      const found = Object.fromEntries((d.Teamsbyseason ?? []).filter(t => t.team_logo_url).map(t => [t.id, t.team_logo_url]));
      setLogos(prev => ({ ...found, ...prev }));
    }).catch(() => {});
  }, [seasonId]);
  useEffect(() => {
    if (!refreshKey) return;
    fetchGames(dateRef.current);
    if (seasonRef.current) fetchStandings(seasonRef.current);
  }, [refreshKey]);

  // Live polling, same cadence as the NHL side.
  useEffect(() => {
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      fetchGames(dateRef.current, true);
      if (tick % 10 === 0 && seasonRef.current) fetchStandings(seasonRef.current);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const teamMap = useMemo(() => {
    const map = {};
    const divCount = {};
    (standings ?? []).forEach(t => {
      divCount[t.division_name] = (divCount[t.division_name] ?? 0) + 1;
      map[t.team_id] = {
        name: t.team_name, code: t.team_code, wins: t.wins, losses: t.losses, ot_losses: t.ot_losses, shootout_losses: t.shootout_losses,
        points: t.points, division: t.division_name, conference: t.conference_name, divisionRank: divCount[t.division_name], goalDiff: Number(t.goals_diff),
      };
    });
    return map;
  }, [standings]);

  const seasonPicker = seasons.length > 0 && (
    <select value={seasonId ?? ''} onChange={e => setSeasonId(e.target.value)} aria-label="Season" style={{ ...S.dateInput, padding: '6px 8px', fontWeight: 600 }}>
      {seasons.map(s => <option key={s.season_id} value={s.season_id}>{s.shortname}</option>)}
    </select>
  );

  const liveSelectedGame = selectedGame ? (games?.find(g => g.id === selectedGame.id) ?? selectedGame) : null;
  const filteredGames = (games ?? []).filter(g => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [g.away, g.home].some(t => (t.code ?? '').toLowerCase().includes(q) || (t.name ?? '').toLowerCase().includes(q));
  });

  return (
    <AhlLogoContext.Provider value={logos}>
    <PlayerClickContext.Provider value={setSelectedPlayer}>
      {tab === 'home' && (
        <AhlHomePage standings={standings} games={games} dateStr={dateStr} seasonId={seasonId} onGameClick={setSelectedGame} onTeamClick={onOpenTeam} />
      )}

      {tab === 'games' && (
        <>
          <div style={S.bodyHeader}>
            <h2 style={S.sectionTitle}>AHL Games <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)' }}>· {longDate(dateStr)}</span></h2>
            <input type="text" placeholder="Search team..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.dateInput, padding: '6px 10px', width: 200 }} />
          </div>
          {!games && <p style={S.empty}>Loading games...</p>}
          {error && <p style={{ textAlign: 'center', color: LIVE, padding: 24 }}>{error}</p>}
          {games && !error && filteredGames.length === 0 && <p style={{ ...S.empty, padding: '60px 0' }}>No games scheduled.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {filteredGames.map(g => <AhlGameCard key={g.id} game={g} teamMap={teamMap} onClick={() => setSelectedGame(g)} />)}
          </div>
        </>
      )}

      {tab === 'standings' && <AhlStandingsPage standings={standings} seasonPicker={seasonPicker} onTeamClick={onOpenTeam} />}

      {tab === 'teams' && (
        selectedTeam
          ? <AhlTeamDetail teamId={selectedTeam} teamMap={teamMap} seasonId={seasonId} seasonPicker={seasonPicker} onBack={() => onSelectTeam(null)} onGameClick={setSelectedGame} />
          : (
            <>
              <div style={S.bodyHeader}><h2 style={S.sectionTitle}>AHL Teams</h2>{seasonPicker}</div>
              <AhlTeamsGrid standings={standings} onSelect={onSelectTeam} />
            </>
          )
      )}

      {tab === 'leaders' && <AhlLeadersPage seasonId={seasonId} seasonPicker={seasonPicker} />}

      {liveSelectedGame && <AhlGameModal game={liveSelectedGame} teamMap={teamMap} onClose={() => setSelectedGame(null)} />}
      {selectedPlayer && <AhlPlayerModal playerId={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </PlayerClickContext.Provider>
    </AhlLogoContext.Provider>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
const LEAGUE_KEY = 'papanhl.league';

export default function App() {
  const [league, setLeague] = useState(() => {
    try { return localStorage.getItem(LEAGUE_KEY) === 'ahl' ? 'ahl' : 'nhl'; } catch { return 'nhl'; }
  });
  const [ahlRefreshKey, setAhlRefreshKey] = useState(0);
  const [mainTab, setMainTab] = useState('home');
  const [selectedDate, setSelectedDate] = useState(() => localDateStr());
  const [games, setGames] = useState(null);
  const [standings, setStandings] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(THEME_VARS).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
    document.body.style.background = THEME_VARS.bg;
    document.body.style.color = THEME_VARS.text;
    const styleId = 'nhl-global-css';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
  }, []);

  // abbrev → { name, record, points, division, ... } for labeling scoreboard
  // rows (the score endpoint only carries short team names).
  const teamMap = useMemo(() => {
    const map = {};
    (standings ?? []).forEach(t => {
      map[tx(t.teamAbbrev)] = {
        name: tx(t.teamName), wins: t.wins, losses: t.losses, otLosses: t.otLosses, points: t.points,
        division: t.divisionName, conference: t.conferenceName, divisionRank: t.divisionSequence, goalDiff: t.goalDifferential,
      };
    });
    return map;
  }, [standings]);

  const fetchGames = (date, silent = false) => {
    if (!silent) { setGames(null); setError(null); }
    return nhlFetch(`/v1/score/${date}`)
      .then(d => { setGames(d.games ?? []); setLastRefresh(new Date()); })
      .catch(() => { if (!silent) { setGames([]); setError('Failed to load games.'); } });
  };
  const fetchStandings = () => nhlFetch('/v1/standings/now').then(d => setStandings(d.standings ?? [])).catch(() => setStandings([]));

  useEffect(() => { fetchGames(selectedDate); }, [selectedDate]);
  useEffect(() => { fetchStandings(); }, []);

  // Live polling: silently refresh the scoreboard (and standings, less often)
  // every 30s. A ref avoids a stale date closure inside the interval.
  const dateRef = useRef(selectedDate);
  useEffect(() => { dateRef.current = selectedDate; }, [selectedDate]);
  const leagueRef = useRef(league);
  useEffect(() => { leagueRef.current = league; }, [league]);
  useEffect(() => {
    let tick = 0;
    const id = setInterval(() => {
      if (leagueRef.current !== 'nhl') return;
      tick += 1;
      fetchGames(dateRef.current, true);
      if (tick % 10 === 0) fetchStandings();
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Keep an open game modal in sync with refreshed scoreboard data.
  const liveSelectedGame = selectedGame ? (games?.find(g => g.id === selectedGame.id) ?? selectedGame) : null;

  const changeDate = (days) => { setSelectedDate(d => shiftDate(d, days)); setMainTab(t => (t === 'home' ? t : 'games')); };
  const openTeam = (abbrev) => { setSelectedTeam(abbrev); setMainTab('teams'); };
  const switchLeague = (next) => {
    if (next === league) return;
    setLeague(next);
    try { localStorage.setItem(LEAGUE_KEY, next); } catch { /* storage unavailable */ }
    setSelectedTeam(null); setSelectedGame(null); setSelectedPlayer(null); setLastRefresh(null);
    if (next === 'ahl' && mainTab === 'boxscores') setMainTab('home');
    if (next === 'nhl') { fetchGames(selectedDate, true); fetchStandings(); }
  };
  const refresh = () => {
    if (league === 'ahl') setAhlRefreshKey(k => k + 1);
    else { fetchGames(selectedDate); fetchStandings(); }
  };

  const filteredGames = (games ?? []).filter(g => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [g.awayTeam, g.homeTeam].some(t => t.abbrev.toLowerCase().includes(q) || (teamMap[t.abbrev]?.name ?? '').toLowerCase().includes(q));
  });

  const tabs = [
    ['home', <><Home size={13} /> Home</>],
    ['games', <><Shield size={13} /> Games</>],
    ['boxscores', <><ScrollText size={13} /> Box Scores</>],
    ['standings', <><BarChart3 size={13} /> Standings</>],
    ['teams', <><Landmark size={13} /> Teams</>],
    ['leaders', <><Trophy size={13} /> Leaders</>],
  ].filter(([id]) => league === 'nhl' || id !== 'boxscores');

  return (
    <PlayerClickContext.Provider value={setSelectedPlayer}>
      <div style={S.app}>
        {/* Header + tab bar stick together so the tabs never slide under a wrapped (taller) mobile header. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, boxShadow: SHADOW.sm }}>
        <header style={S.header}>
          <div style={S.headerLeft}>
            <LeagueBadge league={league} size={22} />
            <h1 style={S.pageTitle}>Dashboard</h1>
            <div role="group" aria-label="League" style={{ display: 'inline-flex', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
              {[['nhl', 'NHL'], ['ahl', 'AHL']].map(([id, label]) => (
                <button key={id} onClick={() => switchLeague(id)} aria-pressed={league === id} style={{
                  padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
                  background: league === id ? (id === 'ahl' ? AHL_RED : ACCENT) : 'var(--surface)', color: league === id ? '#fff' : INK,
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={S.headerRight}>
            <button style={S.btnGray} onClick={() => changeDate(-1)}><ChevronLeft size={13} /> Yesterday</button>
            <button style={S.btnGray} onClick={() => { setSelectedDate(localDateStr()); setMainTab(t => (t === 'home' ? t : 'games')); }}><Calendar size={13} /> Today</button>
            <button style={S.btnGray} onClick={() => changeDate(1)}>Tomorrow <ChevronRight size={13} /></button>
            <input type="date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)} style={S.dateInput} />
            <button style={S.btnBlue} onClick={refresh}><RefreshCw size={13} /> Refresh</button>
            {lastRefresh && (
              <span style={{ fontSize: 11, color: 'var(--text4)', whiteSpace: 'nowrap' }}>
                ↻ {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </header>

        <div style={{ background: 'var(--surface)', borderBottom: `1px solid ${LINE}`, display: 'flex', gap: 2, padding: '0 16px', overflowX: 'auto' }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => { setMainTab(id); if (id === 'teams') setSelectedTeam(null); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              borderBottom: `2px solid ${mainTab === id ? ACCENT : 'transparent'}`, cursor: 'pointer',
              padding: '11px 14px', fontSize: 12, fontWeight: 700,
              color: mainTab === id ? ACCENT : 'var(--text)', letterSpacing: '0.15px', fontFamily: 'inherit', flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}>{label}</button>
          ))}
        </div>
        </div>

        <div style={S.body}>
          {league === 'ahl' && (
            <AhlDashboard tab={mainTab} dateStr={selectedDate} refreshKey={ahlRefreshKey} onRefreshed={setLastRefresh}
              selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} onOpenTeam={openTeam} />
          )}
          {league === 'nhl' && (<>
          {mainTab === 'home' && (
            <HomePage standings={standings} games={games} dateStr={selectedDate} teamMap={teamMap} onGameClick={setSelectedGame} onTeamClick={openTeam} />
          )}

          {mainTab === 'games' && (
            <>
              <div style={S.bodyHeader}>
                <h2 style={S.sectionTitle}>Games <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)' }}>· {longDate(selectedDate)}</span></h2>
                <input type="text" placeholder="Search team..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.dateInput, padding: '6px 10px', width: 200 }} />
              </div>
              {!games && <p style={S.empty}>Loading games...</p>}
              {error && <p style={{ textAlign: 'center', color: LIVE, padding: 24 }}>{error}</p>}
              {games && !error && filteredGames.length === 0 && <p style={{ ...S.empty, padding: '60px 0' }}>No games scheduled.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
                {filteredGames.map(g => <GameCard key={g.id} game={g} teamMap={teamMap} onClick={() => setSelectedGame(g)} />)}
              </div>
            </>
          )}

          {mainTab === 'boxscores' && <BoxScoresPage />}

          {mainTab === 'standings' && <StandingsPage currentStandings={standings} onTeamClick={openTeam} />}

          {mainTab === 'teams' && (
            selectedTeam
              ? <TeamDetail abbrev={selectedTeam} teamMap={teamMap} onBack={() => setSelectedTeam(null)} onGameClick={setSelectedGame} />
              : (
                <>
                  <div style={S.bodyHeader}><h2 style={S.sectionTitle}>Teams</h2></div>
                  <TeamsGrid standings={standings} onSelect={setSelectedTeam} />
                </>
              )
          )}

          {mainTab === 'leaders' && <LeadersPage />}
          </>)}

          <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text4)', marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <ClipboardList size={11} /> {league === 'ahl' ? 'Data from the AHL / HockeyTech LeagueStat feed' : 'Data from the NHL public stats API'} · papanhl
          </p>
        </div>

        {league === 'nhl' && liveSelectedGame && <GameModal game={liveSelectedGame} teamMap={teamMap} onClose={() => setSelectedGame(null)} />}
        {league === 'nhl' && selectedPlayer && <PlayerModal playerId={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      </div>
    </PlayerClickContext.Provider>
  );
}
