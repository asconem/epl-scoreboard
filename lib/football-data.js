import { CMAP } from "./clubs";
import { getBoardStrict, saveBoard } from "./redis";

const FD_NAMES = {
  "Arsenal FC": "Arsenal", "Aston Villa FC": "Aston Villa", "AFC Bournemouth": "Bournemouth",
  "Brentford FC": "Brentford", "Brighton & Hove Albion FC": "Brighton", "Chelsea FC": "Chelsea",
  "Coventry City FC": "Coventry City", "Crystal Palace FC": "Crystal Palace", "Everton FC": "Everton",
  "Fulham FC": "Fulham", "Hull City AFC": "Hull City", "Ipswich Town FC": "Ipswich Town",
  "Leeds United FC": "Leeds United", "Liverpool FC": "Liverpool", "Manchester City FC": "Manchester City",
  "Manchester United FC": "Manchester United", "Newcastle United FC": "Newcastle",
  "Nottingham Forest FC": "Nottingham Forest", "Sunderland AFC": "Sunderland",
  "Tottenham Hotspur FC": "Tottenham",
};

const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "PAUSED"]);

export class FootballDataError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function toClub(fdName) {
  if (FD_NAMES[fdName]) return FD_NAMES[fdName];
  if (CMAP[fdName]) return fdName;
  const stripped = String(fdName).replace(/\bAFC\b|\bFC\b/g, "").replace(/\s+/g, " ").trim();
  if (CMAP[stripped]) return stripped;
  return Object.keys(CMAP).find(name => stripped.startsWith(name) || name.startsWith(stripped)) || null;
}

function providerState(match) {
  if (match.status === "FINISHED") return "F";
  if (LIVE_STATUSES.has(match.status)) return "L";
  return "S";
}

function score(match, side) {
  const value = match.score?.fullTime?.[side] ?? match.score?.regularTime?.[side];
  return Number.isFinite(value) ? value : null;
}

export function hasActiveFixture(matches, now = new Date()) {
  const time = now.getTime();
  return (matches || []).some(match => {
    if (match.status === "L") return true;
    if (!match.utc || match.status === "F") return false;
    const kickoff = new Date(match.utc).getTime();
    return Number.isFinite(kickoff) && time >= kickoff - 15 * 60_000 && time <= kickoff + 3 * 60 * 60_000;
  });
}

export async function syncFootballData() {
  if (!process.env.FOOTBALL_DATA_TOKEN) {
    throw new FootballDataError("FOOTBALL_DATA_TOKEN is not set", 500);
  }

  let response;
  try {
    response = await fetch("https://api.football-data.org/v4/competitions/PL/matches?season=2026", {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
      cache: "no-store",
    });
  } catch {
    throw new FootballDataError("could not reach football-data.org");
  }
  if (!response.ok) throw new FootballDataError(`football-data returned ${response.status}`);

  const data = await response.json();
  let board;
  try {
    board = await getBoardStrict();
  } catch {
    throw new FootballDataError("could not read saved board", 503);
  }

  const matches = [...(board.matches || [])];
  const index = new Map();
  matches.forEach((match, i) => index.set([match.mw, ...[match.a, match.b].sort()].join("|"), i));

  let added = 0, updated = 0, skipped = 0, unmapped = 0;
  for (const providerMatch of data.matches || []) {
    const a = toClub(providerMatch.homeTeam?.name);
    const b = toClub(providerMatch.awayTeam?.name);
    const mw = providerMatch.matchday;
    if (!a || !b || !mw) { unmapped++; continue; }

    const state = providerState(providerMatch);
    const ga = state === "S" ? null : score(providerMatch, "home");
    const gb = state === "S" ? null : score(providerMatch, "away");
    const date = providerMatch.utcDate ? String(providerMatch.utcDate).slice(0, 10) : null;
    const utc = providerMatch.utcDate || null;
    const key = [mw, ...[a, b].sort()].join("|");
    const pos = index.get(key);

    if (pos === undefined) {
      matches.push({
        id: `fd:${providerMatch.id}`, mw, date, utc, a, b, ga, gb,
        status: state !== "S" && Number.isFinite(ga) && Number.isFinite(gb) ? state : "S",
      });
      index.set(key, matches.length - 1);
      added++;
      continue;
    }

    const current = matches[pos];
    if (current.manual) { skipped++; continue; }
    const next = { ...current, a, b, date: date || current.date, utc: utc || current.utc };
    if (state !== "S" && Number.isFinite(ga) && Number.isFinite(gb)) {
      next.ga = ga;
      next.gb = gb;
      next.status = state;
    } else if (state === "S" && current.status !== "F") {
      next.ga = null;
      next.gb = null;
      next.status = "S";
    }
    if (JSON.stringify(next) !== JSON.stringify(current)) { matches[pos] = next; updated++; }
  }

  let saved;
  try {
    saved = await saveBoard({ ...board, matches });
  } catch {
    throw new FootballDataError("could not save updated board", 503);
  }
  return { added, updated, skipped, unmapped, total: matches.length, version: saved.version };
}
