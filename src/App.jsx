import { useState, useEffect, useLayoutEffect, useMemo, useRef, createContext, useContext } from 'react';
import {
  Home, Calendar, BarChart3, Landmark, ScrollText, RefreshCw, ChevronLeft, ChevronRight, X,
  Trophy, ArrowLeft, Users, ClipboardList, Shield,
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
// ACCENT and BRAND are CSS variables so the whole app re-themes when the
// league toggle flips (NHL: blue-line blue on rink navy, AHL: red on charcoal).
const INK = 'var(--text)';
const ACCENT = 'var(--accent)';
const BRAND = 'var(--brand)';
const LIVE = '#e11d48';
const WIN = '#15803d';
const PUCK_ORANGE = '#f97316';
const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
const SHADOW = {
  sm: '0 1px 2px rgba(11,20,36,0.05), 0 2px 8px rgba(11,20,36,0.04)',
  md: '0 2px 4px rgba(11,20,36,0.05), 0 12px 28px rgba(11,20,36,0.10)',
  lg: '0 30px 80px rgba(4,10,24,0.38)',
};
const LINE = 'var(--border)';
const LINE2 = 'var(--border2)';
// Numbers: Inter with tabular figures (set globally) so columns line up.
const MONO = "'Inter', system-ui, sans-serif";
// Scores, headings and labels: a condensed scoreboard face.
const DISPLAY = "'Barlow Condensed', 'Inter', system-ui, sans-serif";

const THEME_VARS = {
  bg: '#edf1f6', surface: '#ffffff', surface2: '#f3f6fa',
  border: 'rgba(11,20,36,0.08)', border2: 'rgba(11,20,36,0.16)',
  text: '#0b1424', text2: '#3e4c63', text3: '#5b6b84', text4: '#7c8aa0',
  hover: 'var(--accent-soft)',
};
const LEAGUE_THEME = {
  nhl: { accent: '#1259c3', 'accent-soft': 'rgba(18,89,195,0.08)', 'accent-glow': 'rgba(59,130,246,0.45)', brand: '#0a1930', brand2: '#143463' },
  ahl: { accent: '#c8102e', 'accent-soft': 'rgba(200,16,46,0.07)', 'accent-glow': 'rgba(244,63,94,0.45)', brand: '#15171c', brand2: '#4a101c' },
};
// Dark panel used by the masthead and every hero: league gradient with a
// faint sheet-of-ice sheen coming in from the top right.
const BRAND_PANEL = 'radial-gradient(120% 140% at 100% 0%, var(--accent-glow) 0%, transparent 55%), linear-gradient(135deg, var(--brand) 20%, var(--brand2) 100%)';

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    background: #edf1f6;
    color: #0b1424;
    font-size: 13px;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(11,20,36,0.18); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(11,20,36,0.28); }
  button, input, select { font-family: inherit; }
  button { transition: filter 0.15s, transform 0.1s, background 0.15s, color 0.15s; }
  button:hover:not(:disabled) { filter: brightness(0.95); }
  button:active:not(:disabled) { transform: translateY(1px); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .masthead :focus-visible { outline-color: #fff; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .fade-up { animation: fadeUp 0.28s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  @keyframes livePulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); } 70%, 100% { box-shadow: 0 0 0 6px rgba(255,255,255,0); } }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: livePulse 1.6s ease-out infinite; flex-shrink: 0; }

  /* Clickable cards lift toward the viewer. */
  .lift { transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s; }
  .lift:hover { box-shadow: 0 2px 4px rgba(11,20,36,0.05), 0 12px 28px rgba(11,20,36,0.10) !important; transform: translateY(-2px); border-color: var(--border2) !important; }

  /* Masthead navigation: the active tab is cut out to the page colour. */
  .nav-tab {
    display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; cursor: pointer;
    border: none; background: transparent; color: rgba(255,255,255,0.68);
    padding: 10px 16px 11px; border-radius: 10px 10px 0 0;
    font-family: 'Barlow Condensed', 'Inter', sans-serif; font-size: 16px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .nav-tab:hover { color: #fff; background: rgba(255,255,255,0.08); filter: none !important; }
  .nav-tab[aria-current="page"] { background: var(--bg); color: var(--text); box-shadow: inset 0 3px 0 var(--accent); }
  .mast-btn {
    display: inline-flex; align-items: center; gap: 5px; cursor: pointer; white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.07); color: #fff;
    padding: 6px 11px; border-radius: 8px; font-size: 12px; font-weight: 600;
  }
  .mast-btn:hover { background: rgba(255,255,255,0.16); filter: none !important; }
  .mast-btn.primary { background: var(--accent); border-color: rgba(255,255,255,0.3); }
  .mast-btn.primary:hover { background: var(--accent); filter: brightness(1.15) !important; }
  .mast-date {
    color-scheme: dark; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.07); color: #fff;
    padding: 5px 8px; border-radius: 8px; font-size: 12px; font-weight: 600;
  }
  .no-scrollbar { scrollbar-width: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; }

  @media (prefers-reduced-motion: reduce) {
    .fade-up, .live-dot { animation: none; }
    .lift, button { transition: none; }
    .lift:hover { transform: none; }
  }
`;

const S = {
  app: { minHeight: '100vh', background: 'var(--bg)', color: INK, fontFamily: "'Inter', system-ui, sans-serif" },
  btnGray: { padding: '6px 13px', background: 'var(--surface)', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, color: INK, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 },
  dateInput: { padding: '5px 8px', border: `1px solid ${LINE2}`, borderRadius: RADIUS.sm, fontSize: 12, fontFamily: 'inherit', color: INK, background: 'var(--surface)' },
  body: { maxWidth: 1400, margin: '0 auto', padding: '22px 20px' },
  bodyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontFamily: DISPLAY, fontSize: 30, fontWeight: 700, margin: 0, color: INK, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.1 },
  subTitle: { fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, color: INK, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10 },
  card: { background: 'var(--surface)', border: `1px solid ${LINE}`, borderRadius: RADIUS.lg, overflow: 'hidden', boxShadow: SHADOW.sm },
  cardLabel: { fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, color: INK, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '11px 16px', borderBottom: `1px solid ${LINE}`, boxShadow: `inset 3px 0 0 ${ACCENT}`, display: 'flex', alignItems: 'center', gap: 7 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(6,12,26,0.62)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '24px 12px' },
  modal: { background: 'var(--surface)', borderRadius: RADIUS.xl, width: '100%', maxWidth: 860, boxShadow: SHADOW.lg, overflow: 'hidden' },
  modalClose: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 7, borderRadius: RADIUS.pill, display: 'flex' },
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--text4)', fontSize: 12 },
  th: { padding: '6px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  td: { padding: '5px 6px', fontSize: 12, fontFamily: MONO, textAlign: 'center', color: 'var(--text2)', whiteSpace: 'nowrap' },
  // Small uppercase caption used above values and groups.
  eyebrow: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  // White disc that keeps any team logo legible on a dark panel.
  logoDisc: (size) => ({ width: size, height: size, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 18px rgba(0,0,0,0.28)' }),
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

const rowHover = {
  onMouseEnter: e => { e.currentTarget.style.background = 'var(--hover)'; },
  onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; },
};
const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// Masthead lockup: a puck on an accent tile, then "papa" + the league.
function Wordmark({ league }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(145deg, ${ACCENT}, var(--brand2))`, border: '1px solid rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9.5v5c0 2.2 4 4 9 4s9-1.8 9-4v-5" fill="rgba(255,255,255,0.55)" />
          <ellipse cx="12" cy="9.5" rx="9" ry="4" fill="#fff" />
        </svg>
      </span>
      <span style={{ fontFamily: DISPLAY, fontSize: 27, lineHeight: 1, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#fff' }}>
        <span style={{ fontWeight: 500, opacity: 0.72 }}>papa</span><span style={{ fontWeight: 800 }}>{league === 'ahl' ? 'AHL' : 'NHL'}</span>
      </span>
    </span>
  );
}

// `onDark` is for badges sitting on a hero/scoreboard panel.
function StatusBadge({ live, final, text, onDark }) {
  const quiet = onDark
    ? { color: '#fff', background: 'rgba(255,255,255,0.14)' }
    : { color: final ? 'var(--text2)' : ACCENT, background: final ? 'var(--surface2)' : 'var(--accent-soft)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1,
      padding: '4px 9px', borderRadius: RADIUS.pill, whiteSpace: 'nowrap',
      ...(live ? { color: '#fff', background: LIVE } : quiet),
    }}>
      {live && <span className="live-dot" />}{text}
    </span>
  );
}

function StatusPill({ game, onDark }) {
  return <StatusBadge live={isLive(game)} final={isFinal(game)} text={gameStatusText(game)} onDark={onDark} />;
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

// `plain` skips the hover underline, for when the child is a whole card or row.
function PlayerName({ id, children, style, plain }) {
  const onPlayerClick = usePlayerClick();
  return (
    <span onClick={(e) => { e.stopPropagation(); if (id) onPlayerClick(id); }}
      style={{ cursor: id ? 'pointer' : 'default', ...style }}
      onMouseEnter={e => { if (id && !plain) e.currentTarget.style.textDecoration = 'underline'; }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
    >{children}</span>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="no-scrollbar" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${LINE}`, overflowX: 'auto', padding: '0 12px' }}>
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          borderBottom: `3px solid ${active === id ? ACCENT : 'transparent'}`, cursor: 'pointer',
          padding: '12px 12px 9px', fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
          color: active === id ? INK : 'var(--text3)',
        }}>{label}</button>
      ))}
    </div>
  );
}

// Pill group for switching between views of the same page.
function Segmented({ options, value, onChange }) {
  return (
    <div role="group" style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'var(--surface)', border: `1px solid ${LINE2}`, borderRadius: RADIUS.pill }}>
      {options.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} aria-pressed={value === id} style={{
          padding: '5px 13px', border: 'none', borderRadius: RADIUS.pill, cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: value === id ? ACCENT : 'transparent', color: value === id ? '#fff' : 'var(--text2)',
        }}>{label}</button>
      ))}
    </div>
  );
}

// Title bar for a table card: a colour tick, then the name in the display face.
function TableTitle({ title, accent = ACCENT, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ width: 4, height: 18, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: INK, lineHeight: 1 }}>{title}</span>
      {note && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text4)' }}>{note}</span>}
    </div>
  );
}

const titleCaption = { fontFamily: MONO, fontSize: 13, fontWeight: 500, color: 'var(--text3)', letterSpacing: 0, textTransform: 'none', marginLeft: 8 };

// Section heading inside a page: accent tick + display-face label.
function SubTitle({ children, style }) {
  return (
    <h3 style={{ ...S.subTitle, ...style }}>
      <span style={{ width: 4, height: 18, borderRadius: 2, background: ACCENT, flexShrink: 0 }} />
      <span>{children}</span>
    </h3>
  );
}

// Points column: tinted so the number that decides the order stands out.
const ptsCell = { fontWeight: 800, color: 'var(--text)', background: 'var(--accent-soft)' };

// Green for a positive number or a win streak, red for the opposite.
const signColor = (n) => (n > 0 ? WIN : n < 0 ? LIVE : undefined);

// ─── Game Card ──────────────────────────────────────────────────────────────
// One team's row on a game card; shared by the NHL and AHL cards.
function ScoreLine({ logo, name, sub, score, showScore, winner, loser }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <img src={logo} style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0, opacity: loser ? 0.7 : 1 }} alt="" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: loser ? 'var(--text3)' : 'var(--text)', ...ellipsis }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text4)', ...ellipsis }}>{sub}</div>
        </div>
      </div>
      {showScore && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 700, lineHeight: 1, minWidth: 20, textAlign: 'right', color: loser ? 'var(--text4)' : 'var(--text)' }}>{score}</span>
          <span aria-hidden="true" style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: `7px solid ${ACCENT}`, visibility: winner ? 'visible' : 'hidden' }} />
        </div>
      )}
    </div>
  );
}

// Shell shared by both leagues' game cards: status row, two teams, goal feed.
function GameCardShell({ onClick, live, status, meta, children, goals }) {
  return (
    <div onClick={onClick} className="lift" style={{ ...S.card, position: 'relative', padding: '14px 16px', cursor: 'pointer' }}>
      {live && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: LIVE }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        {status}
        <span style={{ fontSize: 11, color: 'var(--text4)', ...ellipsis }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      {goals}
    </div>
  );
}
const goalFeed = { marginTop: 12, paddingTop: 10, borderTop: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', gap: 4 };
const goalFeedRow = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' };
const goalFeedTime = { fontFamily: MONO, color: 'var(--text4)', width: 58, flexShrink: 0 };
const goalTag = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' };

function TeamLine({ team, teamMap, showScore, winner, loser }) {
  const info = teamMap[team.abbrev];
  return (
    <ScoreLine logo={team.logo || logoFor(team.abbrev)} name={info?.name ?? tx(team.name) ?? team.abbrev}
      sub={<>{info ? `${recordStr(info)} · ${info.points} pts` : team.abbrev}{showScore && team.sog != null && <span> · {team.sog} SOG</span>}</>}
      score={team.score} showScore={showScore} winner={winner} loser={loser} />
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
    <GameCardShell onClick={onClick} live={isLive(game)} status={<StatusPill game={game} />}
      meta={<>{tx(game.venue)}{!started && tv.length > 0 ? ` · ${tv.slice(0, 2).join(', ')}` : ''}</>}
      goals={goals.length > 0 && (
        <div style={goalFeed}>
          {goals.slice(-5).map((g, i) => (
            <div key={i} style={goalFeedRow}>
              <span style={goalFeedTime}>{periodLabel(g.periodDescriptor)} {g.timeInPeriod}</span>
              <img src={logoFor(g.teamAbbrev)} style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
              <span style={{ fontWeight: 700, color: 'var(--text)', ...ellipsis }}>
                {tx(g.name)} ({g.goalsToDate ?? '—'})
              </span>
              {g.strength && g.strength !== 'ev' && <span style={{ ...goalTag, color: PUCK_ORANGE }}>{g.strength}</span>}
              {g.goalModifier === 'empty-net' && <span style={{ ...goalTag, color: 'var(--text3)' }}>EN</span>}
            </div>
          ))}
          {goals.length > 5 && <div style={{ fontSize: 10, color: 'var(--text4)' }}>+{goals.length - 5} earlier goal{goals.length - 5 === 1 ? '' : 's'}</div>}
        </div>
      )}>
      <TeamLine team={away} teamMap={teamMap} showScore={started} winner={awayWin} loser={homeWin} />
      <TeamLine team={home} teamMap={teamMap} showScore={started} winner={homeWin} loser={awayWin} />
    </GameCardShell>
  );
}

// Dark scoreboard banner at the top of a game modal. `score` is [away, home],
// or null before puck drop. Logos sit on white discs so they read on the panel.
function MatchupHeader({ status, away, home, score, venue, onClose }) {
  const side = (t) => (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div style={{ ...S.logoDisc(72), margin: '0 auto 9px' }}><img src={t.logo} style={{ width: 50, height: 50, objectFit: 'contain' }} alt="" /></div>
      <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1.1 }}>{t.name}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{t.sub}</div>
    </div>
  );
  return (
    <div style={{ padding: '14px 20px 18px', background: BRAND_PANEL, color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {status}
        <button style={S.modalClose} onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
        {side(away)}
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
          {score ? (
            <>
              <span style={{ fontSize: 68, opacity: score[0] < score[1] ? 0.55 : 1 }}>{score[0]}</span>
              <span style={{ fontSize: 30, opacity: 0.35 }}>–</span>
              <span style={{ fontSize: 68, opacity: score[1] < score[0] ? 0.55 : 1 }}>{score[1]}</span>
            </>
          ) : <span style={{ fontSize: 24, letterSpacing: '0.1em', opacity: 0.55 }}>AT</span>}
        </div>
        {side(home)}
      </div>
      {venue && <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{venue}</div>}
    </div>
  );
}

// ─── Game Modal (game center) ───────────────────────────────────────────────
const periodHeading = { fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 0 6px', borderBottom: `2px solid ${LINE2}` };
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
          <div style={periodHeading}>{periodLongName(p.periodDescriptor)}</div>
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

const starTile = { display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid rgba(249,115,22,0.25)', borderRadius: RADIUS.md, background: 'linear-gradient(135deg, rgba(249,115,22,0.10), rgba(249,115,22,0.02))' };
const starLabel = { fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.08em' };

function ThreeStars({ stars }) {
  if (!stars?.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
      {stars.map(s => (
        <div key={s.star} style={starTile}>
          <Headshot src={s.headshot} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={starLabel}>★ {ordinal(s.star)} Star</div>
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
          <div style={periodHeading}>{periodLongName(p.periodDescriptor)}</div>
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
              <span style={{ flex: 1, fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmt(s.category, s.awayValue)}</span>
              <span style={{ ...S.eyebrow, textAlign: 'center' }}>{TEAM_STAT_LABELS[s.category]}</span>
              <span style={{ flex: 1, textAlign: 'right', fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmt(s.category, s.homeValue)}</span>
            </div>
            {total > 0 && (
              <div style={{ display: 'flex', height: 7, marginTop: 5, gap: 3 }}>
                <div style={{ width: `${awayShare}%`, background: BRAND, borderRadius: RADIUS.pill, opacity: a >= h ? 1 : 0.35 }} />
                <div style={{ flex: 1, background: ACCENT, borderRadius: RADIUS.pill, opacity: h >= a ? 1 : 0.35 }} />
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
              <td style={{ ...S.td, fontWeight: 800, color: g.decision === 'W' ? WIN : g.decision ? LIVE : S.td.color }}>{g.decision ?? ''}</td>
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
          <div style={{ ...periodHeading, borderBottom: 'none', padding: 0, marginBottom: 6 }}>Season Series</div>
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
  const side = (team) => ({
    logo: logoFor(team.abbrev), name: teamMap[team.abbrev]?.name ?? tx(team.name) ?? team.abbrev,
    sub: teamMap[team.abbrev] ? recordStr(teamMap[team.abbrev]) : '',
  });
  const tabs = started
    ? [['summary', 'Summary'], ['box', 'Box Score'], ['stats', 'Team Stats'], ['penalties', 'Penalties'], ['info', 'Game Info']]
    : [['info', 'Preview']];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="fade-up" style={S.modal} onClick={e => e.stopPropagation()}>
        <MatchupHeader status={<StatusPill game={game} onDark />} onClose={onClose} venue={tx(game.venue)}
          away={side(away)} home={side(home)} score={started ? [away.score, home.score] : null} />
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
// `onDark` is for tiles sitting on a hero panel.
function StatTile({ label, value, onDark }) {
  return (
    <div style={{ background: onDark ? 'rgba(255,255,255,0.10)' : 'var(--surface2)', border: `1px solid ${onDark ? 'rgba(255,255,255,0.14)' : LINE}`, borderRadius: RADIUS.md, padding: '9px 10px 8px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, lineHeight: 1, color: onDark ? '#fff' : 'var(--text)' }}>{value}</div>
      <div style={{ ...S.eyebrow, fontSize: 9, marginTop: 4, color: onDark ? 'rgba(255,255,255,0.65)' : 'var(--text3)' }}>{label}</div>
    </div>
  );
}

const SKATER_TILES = [['GP', 'gamesPlayed'], ['G', 'goals'], ['A', 'assists'], ['P', 'points'], ['+/-', 'plusMinus'], ['PIM', 'pim']];
const GOALIE_TILES = [['GP', 'gamesPlayed'], ['W', 'wins'], ['L', 'losses'], ['OTL', 'otLosses'], ['GAA', 'goalsAgainstAvg'], ['SV%', 'savePctg'], ['SO', 'shutouts']];
const fmtTile = (key, v) => v == null ? '—' : key === 'savePctg' ? fmtPct(v) : key === 'goalsAgainstAvg' ? fmtNum(v) : key === 'plusMinus' ? fmtPlus(v) : v;

const playerHeroName = { fontFamily: DISPLAY, fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase', margin: '3px 0 2px' };

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
            <div style={{ position: 'relative', background: BRAND_PANEL, color: '#fff', padding: '22px 22px 18px', overflow: 'hidden' }}>
              {p.heroImage && <img src={p.heroImage} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.24, mixBlendMode: 'luminosity' }} alt="" />}
              {/* Keeps the name readable over the action shot. */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--brand) 0%, transparent 80%)', opacity: 0.75 }} />
              <button style={{ ...S.modalClose, position: 'absolute', top: 12, right: 12, zIndex: 2 }} onClick={onClose} aria-label="Close"><X size={14} /></button>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Headshot src={p.headshot} size={104} style={{ border: '3px solid #fff', background: '#dfe7f1', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.teamLogo && <img src={p.teamLogo} style={{ width: 20, height: 20, background: '#fff', borderRadius: 4, padding: 1 }} alt="" />}
                    {tx(p.fullTeamName) || 'Free agent'} · #{p.sweaterNumber ?? '—'} · {p.position}
                  </div>
                  <div style={playerHeroName}>{tx(p.firstName)} {tx(p.lastName)}</div>
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
    ['GF', t => t.goalFor], ['GA', t => t.goalAgainst], ['DIFF', t => fmtPlus(t.goalDifferential), false, t => signColor(t.goalDifferential)],
    ['HOME', t => `${t.homeWins}-${t.homeLosses}-${t.homeOtLosses}`], ['AWAY', t => `${t.roadWins}-${t.roadLosses}-${t.roadOtLosses}`],
    ['L10', t => `${t.l10Wins}-${t.l10Losses}-${t.l10OtLosses}`], ['STRK', t => t.streakCode ? `${t.streakCode}${t.streakCount}` : '—', false, t => (t.streakCode === 'W' ? WIN : t.streakCode === 'L' ? LIVE : undefined)],
  ];
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <TableTitle title={title} accent={accent} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...S.th, width: 24 }}>#</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Team</th>
              {cols.map(([l, , bold]) => <th key={l} style={{ ...S.th, ...(bold ? { background: 'var(--accent-soft)', color: 'var(--text)' } : null) }}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={tx(t.teamAbbrev)} onClick={() => onTeamClick?.(tx(t.teamAbbrev))} {...rowHover}
                style={{ cursor: onTeamClick ? 'pointer' : 'default', borderTop: i === cutoffAfter ? `2px dashed ${LIVE}` : `1px solid ${LINE}` }}>
                <td style={{ ...S.td, color: 'var(--text4)' }}>{rankKey ? t[rankKey] : i + 1}</td>
                <td style={{ ...S.td, textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <img src={t.teamLogo} style={{ width: 24, height: 24, objectFit: 'contain' }} alt="" />
                    {tx(t.teamName)}
                    {t.clinchIndicator && <span title={CLINCH_LABELS[t.clinchIndicator]} style={{ fontSize: 10, fontWeight: 800, color: t.clinchIndicator === 'e' ? LIVE : WIN }}>{t.clinchIndicator}</span>}
                  </span>
                </td>
                {cols.map(([l, fn, bold, tone]) => (
                  <td key={l} style={{ ...S.td, ...(bold ? ptsCell : null), ...(tone?.(t) ? { color: tone(t), fontWeight: 600 } : null) }}>{fn(t)}</td>
                ))}
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
  const views = [['division', 'Division'], hasWildcard && ['wildcard', 'Wild Card'], ['conference', 'Conference'], ['league', 'League']].filter(Boolean);

  const divisions = [...new Set((rows ?? []).map(t => t.divisionName))];
  const conferences = [...new Set((rows ?? []).map(t => t.conferenceName).filter(Boolean))];

  return (
    <div>
      <div style={S.bodyHeader}>
        <h2 style={S.sectionTitle}>Standings</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented options={views} value={activeView} onChange={setView} />
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
                <SubTitle style={{ marginTop: 6 }}>{conf.name} Conference</SubTitle>
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
          <SubTitle>{conf.name} Conference</SubTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {conf.divisions.map(div => (
              <div key={div} style={S.card}>
                <div style={S.cardLabel}>{div}</div>
                {standings.filter(t => t.divisionName === div).sort((a, b) => a.divisionSequence - b.divisionSequence).map((t, i, arr) => (
                  <div key={tx(t.teamAbbrev)} onClick={() => onSelect(tx(t.teamAbbrev))} {...rowHover}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : 'none', cursor: 'pointer' }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: 'var(--text4)', width: 14, textAlign: 'center' }}>{i + 1}</span>
                    <img src={t.teamLogo} style={{ width: 36, height: 36, objectFit: 'contain' }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{tx(t.teamName)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{recordStr(t)} · {t.points} pts</div>
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

const rosterCard = { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', border: `1px solid ${LINE}`, borderRadius: RADIUS.md, background: 'var(--surface)' };
const teamHero = { display: 'flex', alignItems: 'center', gap: 20, padding: '24px 26px', flexWrap: 'wrap', background: BRAND_PANEL, color: '#fff' };
const teamHeroName = { fontFamily: DISPLAY, fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase' };
const teamHeroSub = { ...S.eyebrow, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 7 };

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
        <div style={teamHero}>
          <div style={S.logoDisc(96)}><img src={logoFor(abbrev)} style={{ width: 68, height: 68, objectFit: 'contain' }} alt="" /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={teamHeroName}>{info?.name ?? abbrev}</div>
            {info && <div style={teamHeroSub}>{info.division} Division · {info.conference} Conference</div>}
          </div>
          {info && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(72px, 1fr))', gap: 8 }}>
              <StatTile onDark label="Record" value={recordStr(info)} />
              <StatTile onDark label="Points" value={info.points} />
              <StatTile onDark label="Div Rank" value={ordinal(info.divisionRank)} />
              <StatTile onDark label="Diff" value={fmtPlus(info.goalDiff)} />
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
                <div style={{ ...periodHeading, borderBottom: 'none', padding: 0, marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                  {list.map(pl => (
                    <PlayerName key={pl.id} id={pl.id} plain>
                      <div className="lift" style={rosterCard}>
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
                      ? <span style={{ fontFamily: MONO, fontWeight: 800, color: won ? WIN : LIVE }}>{won ? 'W' : 'L'} {us.score}–{opp.score}{g.gameOutcome?.lastPeriodType && g.gameOutcome.lastPeriodType !== 'REG' ? ` ${g.gameOutcome.lastPeriodType}` : ''}</span>
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
        <PlayerName id={top.id} plain style={{ display: 'block', background: 'linear-gradient(110deg, var(--accent-soft), transparent 75%)', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }} {...rowHover}>
            <Headshot src={top.headshot} size={62} style={{ background: 'var(--surface)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: INK, ...ellipsis }}>{tx(top.firstName)} {tx(top.lastName)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                <img src={top.teamLogo} style={{ width: 15, height: 15, objectFit: 'contain', flexShrink: 0 }} alt="" />
                <span style={ellipsis}>{tx(top.teamName)} · #{top.sweaterNumber} · {top.position}</span>
              </div>
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 700, lineHeight: 1, color: ACCENT }}>{fmtLeader(cat, top.value)}</div>
          </div>
        </PlayerName>
      )}
      {leaders?.slice(1).map((l, i) => (
        <PlayerName key={l.id} id={l.id} plain style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 16px', borderBottom: `1px solid ${LINE}`, fontSize: 12 }} {...rowHover}>
            <span style={{ width: 16, color: 'var(--text4)', fontWeight: 700 }}>{i + 2}</span>
            <img src={l.teamLogo} style={{ width: 18, height: 18, objectFit: 'contain' }} alt="" />
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
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 26 };
  return (
    <div>
      <div style={S.bodyHeader}><h2 style={S.sectionTitle}>League Leaders</h2></div>
      <SubTitle>Skaters</SubTitle>
      <div style={grid}>
        {SKATER_LEADER_CATS.map(([cat, label]) => <LeaderCard key={cat} cat={cat} label={label} leaders={skaters ? (skaters[cat] ?? []) : null} />)}
      </div>
      <SubTitle>Goaltenders</SubTitle>
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
      padding: '24px 20px 40px', margin: '-22px -20px 0', minHeight: 'calc(100vh - 100px)',
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
// Building blocks shared by the NHL and AHL home pages.

// Dark banner: the day's slate on the left, quote of the day on the right,
// with a faint centre-ice circle behind it.
function HomeHero({ leagueName, dateStr, total, live, final, quote }) {
  const isToday = dateStr === localDateStr();
  const summary = total == null
    ? 'Loading the slate...'
    : total === 0
      ? 'No games on the schedule'
      : [`${total} game${total === 1 ? '' : 's'}`, live > 0 && `${live} live`, final > 0 && `${final} final`].filter(Boolean).join(' · ');
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: RADIUS.xl, background: BRAND_PANEL, color: '#fff', boxShadow: SHADOW.md, padding: '26px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px 32px' }}>
      <svg aria-hidden="true" width="380" height="380" viewBox="0 0 380 380" style={{ position: 'absolute', right: -70, top: -110, opacity: 0.09, pointerEvents: 'none' }}>
        <circle cx="190" cy="190" r="150" fill="none" stroke="#fff" strokeWidth="4" />
        <circle cx="190" cy="190" r="9" fill="#fff" />
        <line x1="190" y1="0" x2="190" y2="380" stroke="#fff" strokeWidth="4" />
      </svg>
      <div style={{ position: 'relative', flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ ...S.eyebrow, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{longDate(dateStr)}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: '0.01em', textTransform: 'uppercase', margin: '6px 0 12px' }}>
          {isToday ? 'Today' : 'The day'} in the {leagueName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {live > 0 && <StatusBadge live text="Live now" />}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{summary}</span>
        </div>
      </div>
      <figure style={{ position: 'relative', flex: '1 1 340px', minWidth: 0, margin: 0, paddingLeft: 22, borderLeft: '2px solid rgba(255,255,255,0.22)' }}>
        <div style={{ ...S.eyebrow, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Quote of the day</div>
        <blockquote style={{ margin: 0, fontSize: 15, fontStyle: 'italic', lineHeight: 1.5, color: 'rgba(255,255,255,0.92)' }}>&ldquo;{quote.quote}&rdquo;</blockquote>
        <figcaption style={{ marginTop: 8, fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>— {quote.author}</figcaption>
      </figure>
    </div>
  );
}

// Compact scoreboard tile. `rows` is [away, home] as { logo, code, name, score, loser }.
function ScoreTile({ onClick, status, live, started, rows }) {
  return (
    <div onClick={onClick} className="lift" style={{ ...S.card, position: 'relative', padding: '12px 14px', cursor: 'pointer' }}>
      {live && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: LIVE }} />}
      <div style={{ display: 'flex', marginBottom: 9 }}>{status}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '3px 0' }}>
          <img src={r.logo} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0, opacity: r.loser ? 0.7 : 1 }} alt="" />
          <span style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1, minWidth: 40, color: r.loser ? 'var(--text3)' : 'var(--text)' }}>{r.code}</span>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--text4)', ...ellipsis }}>{r.name}</span>
          {started && <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, lineHeight: 1, color: r.loser ? 'var(--text4)' : 'var(--text)' }}>{r.score}</span>}
        </div>
      ))}
    </div>
  );
}
const scoreTileGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 10, marginBottom: 26 };

// One category leader: the number does the talking.
function SpotlightLeader({ label, value, player }) {
  return (
    <PlayerName id={player.id} plain style={{ display: 'block' }}>
      <div className="lift" style={{ ...S.card, padding: '13px 14px 12px', height: '100%' }}>
        <div style={S.eyebrow}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 48, fontWeight: 700, lineHeight: 0.85, color: ACCENT }}>{value}</div>
          <Headshot src={player.headshot} size={58} />
        </div>
        <div style={{ marginTop: 11, fontSize: 13, fontWeight: 700, color: 'var(--text)', ...ellipsis }}>{player.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
          <img src={player.teamLogo} style={{ width: 15, height: 15, objectFit: 'contain', flexShrink: 0 }} alt="" />
          <span style={ellipsis}>{player.teamName}</span>
        </div>
      </div>
    </PlayerName>
  );
}
const spotlightGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10 };

// Small division table. `rows` is [{ key, logo, code, gp, record, pts, onClick }].
function MiniStandings({ title, accent, recordLabel, rows }) {
  const th = { ...S.th, padding: '4px 5px' };
  const td = { ...S.td, padding: '4px 5px' };
  return (
    <div style={{ ...S.card, borderRadius: RADIUS.md }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <span style={{ width: 4, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, color: INK }}>{title}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 10 }}>Team</th>
            <th style={th}>GP</th><th style={th}>{recordLabel}</th><th style={{ ...th, paddingRight: 10 }}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} onClick={r.onClick} style={{ cursor: 'pointer', borderTop: `1px solid ${LINE}` }} {...rowHover}>
              <td style={{ ...td, textAlign: 'left', paddingLeft: 10, fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <img src={r.logo} style={{ width: 18, height: 18, objectFit: 'contain' }} alt="" />{r.code}
                </span>
              </td>
              <td style={td}>{r.gp}</td>
              <td style={td}>{r.record}</td>
              <td style={{ ...td, paddingRight: 10, fontWeight: 800, color: 'var(--text)' }}>{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const homeColumns = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '26px 28px', alignItems: 'start', marginTop: 24 };
const miniStandingsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10, alignItems: 'start' };
const conferenceLabel = { ...S.eyebrow, fontSize: 11, margin: '0 0 7px' };

function HomePage({ standings, games, dateStr, teamMap, onGameClick, onTeamClick }) {
  const todayQuote = useMemo(() => quoteOfTheDay(), []);
  const { skaters, goalies } = useLeaders(1);
  const featured = [
    ...[['points', 'Points'], ['goals', 'Goals'], ['assists', 'Assists']].map(([c, l]) => ({ cat: c, label: l, p: skaters?.[c]?.[0] })),
    ...[['wins', 'Wins'], ['savePctg', 'Save %'], ['goalsAgainstAverage', 'GAA']].map(([c, l]) => ({ cat: c, label: l, p: goalies?.[c]?.[0] })),
  ].filter(f => f.p);

  return (
    <div>
      <HomeHero leagueName="NHL" dateStr={dateStr} quote={todayQuote}
        total={games?.length} live={(games ?? []).filter(isLive).length} final={(games ?? []).filter(isFinal).length} />
      <div style={homeColumns}>
        <div>
          <SubTitle>Scoreboard</SubTitle>
          {!games && <p style={S.empty}>Loading games...</p>}
          {games?.length === 0 && <div style={{ ...S.card, marginBottom: 26 }}><p style={S.empty}>No games scheduled.</p></div>}
          {games?.length > 0 && (
            <div style={scoreTileGrid}>
              {games.map(g => {
                const final = isFinal(g);
                const row = (t, other) => ({ logo: logoFor(t.abbrev), code: t.abbrev, name: teamMap[t.abbrev]?.name ?? tx(t.name), score: t.score, loser: final && t.score < other.score });
                return (
                  <ScoreTile key={g.id} onClick={() => onGameClick(g)} status={<StatusPill game={g} />} live={isLive(g)} started={isStarted(g)}
                    rows={[row(g.awayTeam, g.homeTeam), row(g.homeTeam, g.awayTeam)]} />
                );
              })}
            </div>
          )}
          <SubTitle>League Leaders</SubTitle>
          {!skaters && <p style={S.empty}>Loading...</p>}
          <div style={spotlightGrid}>
            {featured.map(f => (
              <SpotlightLeader key={f.cat} label={f.label} value={fmtLeader(f.cat, f.p.value)}
                player={{ id: f.p.id, headshot: f.p.headshot, name: `${tx(f.p.firstName)} ${tx(f.p.lastName)}`, teamLogo: f.p.teamLogo, teamName: tx(f.p.teamName) }} />
            ))}
          </div>
        </div>

        <div>
          <SubTitle>Standings</SubTitle>
          {!standings && <div style={S.card}><p style={S.empty}>Loading standings...</p></div>}
          {standings && CONFERENCES.map(conf => (
            <div key={conf.name} style={{ marginBottom: 16 }}>
              <div style={conferenceLabel}>{conf.name} Conference</div>
              <div style={miniStandingsGrid}>
                {conf.divisions.map(div => (
                  <MiniStandings key={div} title={div} accent={conf.name === 'Eastern' ? ACCENT : BRAND} recordLabel="W-L-OT"
                    rows={standings.filter(t => t.divisionName === div).sort((a, b) => a.divisionSequence - b.divisionSequence).map(t => ({
                      key: tx(t.teamAbbrev), logo: t.teamLogo, code: tx(t.teamAbbrev), gp: t.gamesPlayed, record: recordStr(t), pts: t.points,
                      onClick: () => onTeamClick(tx(t.teamAbbrev)),
                    }))} />
                ))}
              </div>
            </div>
          ))}
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

function AhlTeamLine({ team, teamMap, showScore, winner, loser }) {
  const ahlLogo = useAhlLogo();
  const info = teamMap[team.id];
  return (
    <ScoreLine logo={ahlLogo(team.id)} name={team.name ?? info?.name ?? team.code}
      sub={<>{info ? `${ahlRecord(info)} · ${info.points} pts` : team.code}{showScore && team.shots > 0 && <span> · {team.shots} SOG</span>}</>}
      score={team.score} showScore={showScore} winner={winner} loser={loser} />
  );
}

function AhlGameCard({ game, teamMap, onClick }) {
  const ahlLogo = useAhlLogo();
  const { away, home } = game;
  const idByCode = { [away.code]: away.id, [home.code]: home.id };
  const goals = game.goals;
  const awayWin = game.final && away.score > home.score;
  const homeWin = game.final && home.score > away.score;
  return (
    <GameCardShell onClick={onClick} live={game.live} meta={game.venue}
      status={<StatusBadge live={game.live} final={game.final} text={game.statusText} />}
      goals={goals.length > 0 && (
        <div style={goalFeed}>
          {goals.slice(-5).map((g, i) => (
            <div key={i} style={goalFeedRow}>
              <span style={goalFeedTime}>{g.short_name === 'OT' ? 'OT' : ordinal(Number(g.period_id))} {ahlClock(g.time)}</span>
              <img src={ahlLogo(idByCode[g.code])} style={{ width: 14, height: 14, objectFit: 'contain' }} alt="" />
              <span style={{ fontWeight: 700, color: 'var(--text)', ...ellipsis }}>
                {g.first_name} {g.actual_last_name ?? g.last_name}
              </span>
              {g.power_play === '1' && <span style={{ ...goalTag, color: PUCK_ORANGE }}>PP</span>}
              {g.short_handed === '1' && <span style={{ ...goalTag, color: PUCK_ORANGE }}>SH</span>}
              {g.empty_net === '1' && <span style={{ ...goalTag, color: 'var(--text3)' }}>EN</span>}
            </div>
          ))}
          {goals.length > 5 && <div style={{ fontSize: 10, color: 'var(--text4)' }}>+{goals.length - 5} earlier goal{goals.length - 5 === 1 ? '' : 's'}</div>}
        </div>
      )}>
      <AhlTeamLine team={away} teamMap={teamMap} showScore={game.started} winner={awayWin} loser={homeWin} />
      <AhlTeamLine team={home} teamMap={teamMap} showScore={game.started} winner={homeWin} loser={awayWin} />
    </GameCardShell>
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
          <div key={s.player_id} style={starTile}>
            <Headshot src={ahlHeadshot(s.player_id)} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={starLabel}>★ {ordinal(i + 1)} Star</div>
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
                <td style={{ ...S.td, fontWeight: 800, color: dec === 'W' ? WIN : dec ? LIVE : S.td.color }}>{dec}</td>
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
  const side = (team) => ({ logo: ahlLogo(team.id), name: team.name ?? teamMap[team.id]?.name ?? team.code, sub: ahlRecord(teamMap[team.id]) });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="fade-up" style={S.modal} onClick={e => e.stopPropagation()}>
        <MatchupHeader status={<StatusBadge live={game.live} final={game.final} text={game.statusText} onDark />} onClose={onClose} venue={game.venue}
          away={side(away)} home={side(home)}
          score={game.started ? [Number(sum?.totalGoals?.visitor ?? away.score), Number(sum?.totalGoals?.home ?? home.score)] : null} />
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
            <div style={{ position: 'relative', background: BRAND_PANEL, color: '#fff', padding: '22px 22px 18px' }}>
              <button style={{ ...S.modalClose, position: 'absolute', top: 12, right: 12, zIndex: 2 }} onClick={onClose} aria-label="Close"><X size={14} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Headshot src={p.primary_image || ahlHeadshot(playerId)} size={104} style={{ border: '3px solid #fff', background: '#dfe7f1', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.most_recent_team_id && <img src={ahlLogo(p.most_recent_team_id)} style={{ width: 20, height: 20, background: '#fff', borderRadius: 4, padding: 1, objectFit: 'contain' }} alt="" />}
                    {p.most_recent_team_name || 'AHL'} · #{p.jersey_number || '—'} · {p.position}
                  </div>
                  <div style={playerHeroName}>{p.name}</div>
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
    ['GF', t => t.goals_for], ['GA', t => t.goals_against], ['DIFF', t => fmtPlus(Number(t.goals_diff)), false, t => signColor(Number(t.goals_diff))],
    ['HOME', t => t.home_record], ['AWAY', t => t.visiting_record], ['L10', t => t.past_10], ['STRK', t => t.streak_wl || '—'],
    ['PP%', t => t.power_play_pct], ['PK%', t => t.penalty_kill_pct],
  ];
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <TableTitle title={title} accent={accent} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...S.th, width: 24 }}>#</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Team</th>
              {cols.map(([l, , bold]) => <th key={l} style={{ ...S.th, ...(bold ? { background: 'var(--accent-soft)', color: 'var(--text)' } : null) }}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.team_id} onClick={() => onTeamClick?.(t.team_id)} {...rowHover}
                style={{ cursor: onTeamClick ? 'pointer' : 'default', borderTop: `1px solid ${LINE}` }}>
                <td style={{ ...S.td, color: 'var(--text4)' }}>{i + 1}</td>
                <td style={{ ...S.td, textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <img src={ahlLogo(t.team_id)} style={{ width: 24, height: 24, objectFit: 'contain' }} alt="" />
                    {t.team_name}
                    {t.clinched && <span title={AHL_CLINCH_LABELS[t.clinched]} style={{ fontSize: 10, fontWeight: 800, color: t.clinched === 'e' ? LIVE : WIN }}>{t.clinched}</span>}
                  </span>
                </td>
                {cols.map(([l, fn, bold, tone]) => (
                  <td key={l} style={{ ...S.td, ...(bold ? ptsCell : null), ...(tone?.(t) ? { color: tone(t), fontWeight: 600 } : null) }}>{fn(t)}</td>
                ))}
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
  return (
    <div>
      <div style={S.bodyHeader}>
        <h2 style={S.sectionTitle}>AHL Standings</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented options={[['division', 'Division'], ['conference', 'Conference'], ['league', 'League']]} value={view} onChange={setView} />
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
          <SubTitle>{conf}</SubTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            {[...new Set(standings.filter(t => t.conference_name === conf).map(t => t.division_name))].map(div => (
              <div key={div} style={S.card}>
                <div style={S.cardLabel}>{div}</div>
                {standings.filter(t => t.division_name === div).map((t, i, arr) => (
                  <div key={t.team_id} onClick={() => onSelect(t.team_id)} {...rowHover}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : 'none', cursor: 'pointer' }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: 'var(--text4)', width: 14, textAlign: 'center' }}>{i + 1}</span>
                    <img src={ahlLogo(t.team_id)} style={{ width: 36, height: 36, objectFit: 'contain' }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{t.team_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ahlRecord(t)} · {t.points} pts</div>
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
        <div style={teamHero}>
          <div style={S.logoDisc(96)}><img src={ahlLogo(teamId)} style={{ width: 68, height: 68, objectFit: 'contain' }} alt="" /></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={teamHeroName}>{info?.name ?? nameFromSchedule ?? 'AHL Team'}</div>
            {info && <div style={teamHeroSub}>{info.division} · {info.conference}</div>}
          </div>
          {info && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(72px, 1fr))', gap: 8 }}>
              <StatTile onDark label="Record" value={ahlRecord(info)} />
              <StatTile onDark label="Points" value={info.points} />
              <StatTile onDark label="Div Rank" value={ordinal(info.divisionRank)} />
              <StatTile onDark label="Diff" value={fmtPlus(info.goalDiff)} />
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
                <div style={{ ...periodHeading, borderBottom: 'none', padding: 0, marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                  {list.map(pl => (
                    <PlayerName key={pl.player_id} id={pl.player_id} plain>
                      <div className="lift" style={rosterCard}>
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
                      ? <span style={{ fontFamily: MONO, fontWeight: 800, color: won ? WIN : LIVE }}>{won ? 'W' : 'L'} {us.score}–{opp.score}{/OT|SO/.test(g.statusText ?? '') ? ` ${g.statusText.match(/\d*OT|SO/)[0]}` : ''}</span>
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
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14, marginBottom: 26 };
  return (
    <div>
      <div style={S.bodyHeader}><h2 style={S.sectionTitle}>AHL Leaders</h2>{seasonPicker}</div>
      <SubTitle>Skaters</SubTitle>
      <div style={grid}>
        {AHL_SKATER_LEADER_CATS.map(([cat, label]) => <LeaderCard key={cat} cat={cat} label={label} leaders={leaders[cat]} />)}
      </div>
      <SubTitle>Goaltenders <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 11, color: 'var(--text4)', letterSpacing: 0, textTransform: 'none' }}>(qualified)</span></SubTitle>
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
  const conferences = [...new Set((standings ?? []).map(t => t.conference_name))];

  return (
    <div>
      <HomeHero leagueName="AHL" dateStr={dateStr} quote={todayQuote}
        total={games?.length} live={(games ?? []).filter(g => g.live).length} final={(games ?? []).filter(g => g.final).length} />
      <div style={homeColumns}>
        <div>
          <SubTitle>Scoreboard</SubTitle>
          {!games && <p style={S.empty}>Loading games...</p>}
          {games?.length === 0 && <div style={{ ...S.card, marginBottom: 26 }}><p style={S.empty}>No games scheduled.</p></div>}
          {games?.length > 0 && (
            <div style={scoreTileGrid}>
              {games.map(g => {
                const row = (t, other) => ({ logo: ahlLogo(t.id), code: t.code, name: t.name, score: t.score, loser: g.final && t.score < other.score });
                return (
                  <ScoreTile key={g.id} onClick={() => onGameClick(g)} live={g.live} started={g.started}
                    status={<StatusBadge live={g.live} final={g.final} text={g.statusText} />}
                    rows={[row(g.away, g.home), row(g.home, g.away)]} />
                );
              })}
            </div>
          )}
          <SubTitle>AHL Leaders</SubTitle>
          {featured.length === 0 && <p style={S.empty}>{Object.keys(leaders).length < AHL_HOME_LEADER_CATS.length ? 'Loading...' : 'No stats yet this season.'}</p>}
          <div style={spotlightGrid}>
            {featured.map(f => (
              <SpotlightLeader key={f.cat} label={f.label} value={fmtLeader(f.cat, f.p.value)}
                player={{ id: f.p.id, headshot: f.p.headshot, name: `${f.p.firstName} ${f.p.lastName}`, teamLogo: f.p.teamLogo, teamName: f.p.teamName }} />
            ))}
          </div>
        </div>

        <div>
          <SubTitle>Standings</SubTitle>
          {!standings && <div style={S.card}><p style={S.empty}>Loading standings...</p></div>}
          {conferences.map((conf, ci) => (
            <div key={conf} style={{ marginBottom: 16 }}>
              <div style={conferenceLabel}>{conf}</div>
              <div style={miniStandingsGrid}>
                {[...new Set(standings.filter(t => t.conference_name === conf).map(t => t.division_name))].map(div => (
                  <MiniStandings key={div} title={div} accent={ci === 0 ? ACCENT : BRAND} recordLabel="W-L-OT-SO"
                    rows={standings.filter(t => t.division_name === div).map(t => ({
                      key: t.team_id, logo: ahlLogo(t.team_id), code: t.team_code, gp: t.games_played, record: ahlRecord(t), pts: t.points,
                      onClick: () => onTeamClick(t.team_id),
                    }))} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AHL dashboard ──────────────────────────────────────────────────────────
// Everything under the AHL toggle. The header's date controls, tab bar and
// Refresh button are shared with the NHL side and passed in.
function AhlDashboard({ tab, dateStr, refreshKey, onRefreshed, onLiveCount, selectedTeam, onSelectTeam, onOpenTeam }) {
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

  // The masthead's live badge is owned by App; report how many games are on.
  useEffect(() => { onLiveCount((games ?? []).filter(g => g.live).length); }, [games, onLiveCount]);

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
            <h2 style={S.sectionTitle}>AHL Games <span style={titleCaption}>{longDate(dateStr)}</span></h2>
            <input type="text" placeholder="Search team..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.dateInput, padding: '8px 14px', width: 220, borderRadius: RADIUS.pill }} />
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
  const [ahlLiveCount, setAhlLiveCount] = useState(0);
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

  // Layout effects so the first paint already has its colours.
  useLayoutEffect(() => {
    const root = document.documentElement;
    Object.entries(LEAGUE_THEME[league]).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  }, [league]);
  useLayoutEffect(() => {
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

  const liveCount = league === 'ahl' ? ahlLiveCount : (games ?? []).filter(isLive).length;
  // The box scores tab is a full-bleed newspaper page rather than the ice background.
  const onPaper = league === 'nhl' && mainTab === 'boxscores';

  const tabs = [
    ['home', <><Home size={15} /> Home</>],
    ['games', <><Shield size={15} /> Games</>],
    ['boxscores', <><ScrollText size={15} /> Box Scores</>],
    ['standings', <><BarChart3 size={15} /> Standings</>],
    ['teams', <><Landmark size={15} /> Teams</>],
    ['leaders', <><Trophy size={15} /> Leaders</>],
  ].filter(([id]) => league === 'nhl' || id !== 'boxscores');

  return (
    <PlayerClickContext.Provider value={setSelectedPlayer}>
      <div style={S.app}>
        {/* Masthead: brand + controls on top, navigation below. Sticky as one block so the tabs never slide under a wrapped (taller) mobile header. */}
        <div className="masthead" style={{ position: 'sticky', top: 0, zIndex: 50, background: BRAND_PANEL, color: '#fff', boxShadow: '0 6px 24px rgba(6,12,26,0.22)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 0 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit', display: 'flex' }}><Wordmark league={league} /></h1>
                <div role="group" aria-label="League" style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: RADIUS.pill }}>
                  {[['nhl', 'NHL'], ['ahl', 'AHL']].map(([id, label]) => (
                    <button key={id} onClick={() => switchLeague(id)} aria-pressed={league === id} style={{
                      padding: '4px 15px', border: 'none', borderRadius: RADIUS.pill, cursor: 'pointer',
                      fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, letterSpacing: '0.08em',
                      background: league === id ? '#fff' : 'transparent', color: league === id ? BRAND : 'rgba(255,255,255,0.75)',
                    }}>{label}</button>
                  ))}
                </div>
                {liveCount > 0 && <StatusBadge live text={`${liveCount} live`} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button className="mast-btn" style={{ padding: 6 }} onClick={() => changeDate(-1)} aria-label="Previous day" title="Previous day"><ChevronLeft size={15} /></button>
                <input type="date" className="mast-date" aria-label="Date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)} />
                <button className="mast-btn" style={{ padding: 6 }} onClick={() => changeDate(1)} aria-label="Next day" title="Next day"><ChevronRight size={15} /></button>
                <button className="mast-btn" onClick={() => { setSelectedDate(localDateStr()); setMainTab(t => (t === 'home' ? t : 'games')); }}><Calendar size={13} /> Today</button>
                <button className="mast-btn primary" onClick={refresh}><RefreshCw size={13} /> Refresh</button>
                {lastRefresh && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', marginLeft: 4 }}>
                    Updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </header>

            <nav className="no-scrollbar" aria-label="Sections" style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
              {tabs.map(([id, label]) => (
                <button key={id} className="nav-tab" aria-current={mainTab === id ? 'page' : undefined}
                  style={onPaper && id === 'boxscores' ? { background: PAPER.page } : undefined}
                  onClick={() => { setMainTab(id); if (id === 'teams') setSelectedTeam(null); }}>{label}</button>
              ))}
            </nav>
          </div>
        </div>


        <div style={onPaper ? { ...S.body, maxWidth: 'none' } : S.body}>
          {league === 'ahl' && (
            <AhlDashboard tab={mainTab} dateStr={selectedDate} refreshKey={ahlRefreshKey} onRefreshed={setLastRefresh} onLiveCount={setAhlLiveCount}
              selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} onOpenTeam={openTeam} />
          )}
          {league === 'nhl' && (<>
          {mainTab === 'home' && (
            <HomePage standings={standings} games={games} dateStr={selectedDate} teamMap={teamMap} onGameClick={setSelectedGame} onTeamClick={openTeam} />
          )}

          {mainTab === 'games' && (
            <>
              <div style={S.bodyHeader}>
                <h2 style={S.sectionTitle}>Games <span style={titleCaption}>{longDate(selectedDate)}</span></h2>
                <input type="text" placeholder="Search team..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.dateInput, padding: '8px 14px', width: 220, borderRadius: RADIUS.pill }} />
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

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text4)', margin: '36px 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ClipboardList size={12} /> {league === 'ahl' ? 'Data from the AHL / HockeyTech LeagueStat feed' : 'Data from the NHL public stats API'} · papanhl
          </p>
        </div>

        {league === 'nhl' && liveSelectedGame && <GameModal game={liveSelectedGame} teamMap={teamMap} onClose={() => setSelectedGame(null)} />}
        {league === 'nhl' && selectedPlayer && <PlayerModal playerId={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      </div>
    </PlayerClickContext.Provider>
  );
}
