import { CLUB_CONFIG, MILESTONES } from "./pool-config";

// ── Clubs ────────────────────────────────────────────────────────────────────
// The 20 clubs of the 2026–27 Premier League. Tier and stable come from
// pool-config.js (filled in August / on draft night).

const CODES = {
  "Arsenal": "ARS", "Aston Villa": "AVL", "Bournemouth": "BOU", "Brentford": "BRE",
  "Brighton": "BHA", "Chelsea": "CHE", "Coventry City": "COV", "Crystal Palace": "CRY",
  "Everton": "EVE", "Fulham": "FUL", "Hull City": "HUL", "Ipswich Town": "IPS",
  "Leeds United": "LEE", "Liverpool": "LIV", "Manchester City": "MCI",
  "Manchester United": "MUN", "Newcastle": "NEW", "Nottingham Forest": "NFO",
  "Sunderland": "SUN", "Tottenham": "TOT",
};

export const CLUBS = Object.keys(CLUB_CONFIG).map(n => ({
  n,
  code: CODES[n] || n.slice(0, 3).toUpperCase(),
  t: CLUB_CONFIG[n].tier,
  s: CLUB_CONFIG[n].stable,
}));
export const CMAP = Object.fromEntries(CLUBS.map(c => [c.n, c]));
export const CODE = CODES;

export const WIN = 3, DRAW = 1;
export const MATCHWEEKS = 38;

// ── Match model ──────────────────────────────────────────────────────────────
// { id, mw (1–38), date (YYYY-MM-DD or null), a, b, ga, gb, status }
//   status: "S" scheduled · "F" finished
// Only finished matches with numeric scores count for anything.

export function isFinished(m) {
  return m && m.status !== "S" && Number.isFinite(m.ga) && Number.isFinite(m.gb);
}

export function matchResult(m) {
  if (!isFinished(m)) return null;
  return m.ga > m.gb ? "A" : (m.gb > m.ga ? "B" : "D");
}

export function upsetGap(winner, loser) {
  const w = CMAP[winner], l = CMAP[loser];
  return w && l && w.t && l.t && w.t > l.t ? w.t - l.t : 0;
}

// ── League table ─────────────────────────────────────────────────────────────
// Real Premier League table from finished results. PL tiebreakers: points,
// goal difference, goals scored, then alphabetical (head-to-head is a
// last-resort official rule we don't model).
export function leagueTable(matches) {
  const rows = {};
  CLUBS.forEach(c => { rows[c.n] = { club: c.n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; });
  for (const m of matches) {
    if (!isFinished(m) || !rows[m.a] || !rows[m.b]) continue;
    const A = rows[m.a], B = rows[m.b];
    A.p++; B.p++; A.gf += m.ga; A.ga += m.gb; B.gf += m.gb; B.ga += m.ga;
    if (m.ga > m.gb) { A.w++; B.l++; }
    else if (m.gb > m.ga) { B.w++; A.l++; }
    else { A.d++; B.d++; }
  }
  return Object.values(rows)
    .map(r => ({ ...r, gd: r.gf - r.ga, pts: r.w * WIN + r.d * DRAW }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.club.localeCompare(b.club));
}

// ── Pool scoring ─────────────────────────────────────────────────────────────
// Base 3/1/0 mirrors the real table. Upset bonus = tier gap on any win by the
// lower-tier club. Milestones apply only when seasonComplete is on:
// title +15, each other top-4 finish +10, each relegation −10.
export function computeScores(matches, seasonComplete = false) {
  const pts = {}, goals = {}, against = {}, detail = {};
  CLUBS.forEach(c => {
    pts[c.n] = 0; goals[c.n] = 0; against[c.n] = 0;
    detail[c.n] = { base: 0, upset: 0, milestone: 0, w: 0, d: 0, l: 0 };
  });
  const add = (club, v, kind) => { if (pts[club] === undefined) return; pts[club] += v; detail[club][kind] += v; };

  for (const m of matches) {
    if (!isFinished(m)) continue;
    if (pts[m.a] !== undefined) { goals[m.a] += m.ga; against[m.a] += m.gb; }
    if (pts[m.b] !== undefined) { goals[m.b] += m.gb; against[m.b] += m.ga; }
    const res = matchResult(m);
    if (res === "D") {
      add(m.a, DRAW, "base"); add(m.b, DRAW, "base");
      if (detail[m.a]) detail[m.a].d++; if (detail[m.b]) detail[m.b].d++;
    } else {
      const w = res === "A" ? m.a : m.b, l = res === "A" ? m.b : m.a;
      add(w, WIN, "base");
      if (detail[w]) detail[w].w++; if (detail[l]) detail[l].l++;
      const g = upsetGap(w, l);
      if (g) add(w, g, "upset");
    }
  }

  const table = leagueTable(matches);
  const milestones = {}; // club → { label, value }
  if (seasonComplete && table.length === 20) {
    table.forEach((row, i) => {
      const pos = i + 1;
      if (pos === 1) { add(row.club, MILESTONES.title, "milestone"); milestones[row.club] = { label: "Champions", value: MILESTONES.title }; }
      else if (pos <= 4) { add(row.club, MILESTONES.top4, "milestone"); milestones[row.club] = { label: "Top 4", value: MILESTONES.top4 }; }
      else if (pos >= 18) { add(row.club, MILESTONES.relegation, "milestone"); milestones[row.club] = { label: "Relegated", value: MILESTONES.relegation }; }
    });
  }

  const stableTotals = {}, stableGF = {}, stableGA = {}, stableUpset = {};
  for (let s = 1; s <= 4; s++) { stableTotals[s] = 0; stableGF[s] = 0; stableGA[s] = 0; stableUpset[s] = 0; }
  CLUBS.forEach(c => {
    if (!c.s) return;
    stableTotals[c.s] += pts[c.n];
    stableGF[c.s] += goals[c.n];
    stableGA[c.s] += against[c.n];
    stableUpset[c.s] += detail[c.n].upset;
  });

  const position = {}; table.forEach((r, i) => { position[r.club] = i + 1; });

  return { pts, goals, against, detail, milestones, table, position, stableTotals, stableGF, stableGA, stableUpset };
}

// Pool standings order — tiebreakers per the rules doc:
// points, then stable GD, then stable goals, then upset points.
export function rankStables(scores) {
  return [1, 2, 3, 4]
    .map(s => ({
      s,
      total: scores.stableTotals[s],
      gd: scores.stableGF[s] - scores.stableGA[s],
      gf: scores.stableGF[s],
      upset: scores.stableUpset[s],
    }))
    .sort((a, b) => b.total - a.total || b.gd - a.gd || b.gf - a.gf || b.upset - a.upset || a.s - b.s);
}

// ── Matchweek helpers ────────────────────────────────────────────────────────
export function matchesInWeek(matches, mw) {
  return matches
    .filter(m => m.mw === mw)
    .sort((x, y) => String(x.date || "9999").localeCompare(String(y.date || "9999")) || x.a.localeCompare(y.a));
}

// The "current" matchweek: the lowest week that still has an unfinished
// fixture; if everything entered so far is finished, the week after the
// latest finished one. Defaults to 1 on an empty board.
export function currentMatchweek(matches) {
  const weeks = new Set(matches.map(m => m.mw).filter(Boolean));
  if (!weeks.size) return 1;
  for (let mw = 1; mw <= MATCHWEEKS; mw++) {
    const inWeek = matches.filter(m => m.mw === mw);
    if (inWeek.length && inWeek.some(m => !isFinished(m))) return mw;
  }
  const lastFinished = Math.max(...matches.filter(isFinished).map(m => m.mw), 0);
  return Math.min(lastFinished + 1, MATCHWEEKS) || 1;
}
