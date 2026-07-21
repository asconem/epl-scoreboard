import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { getBoard, saveBoard } from "@/lib/redis";
import { CMAP } from "@/lib/clubs";

export const dynamic = "force-dynamic";

// Map football-data.org team names to our short names. Anything not matched
// directly is normalized (strip FC/AFC etc.) and re-checked, so minor naming
// drift on their side doesn't break the sync.
const FD_NAMES = {
  "Arsenal FC": "Arsenal",
  "Aston Villa FC": "Aston Villa",
  "AFC Bournemouth": "Bournemouth",
  "Brentford FC": "Brentford",
  "Brighton & Hove Albion FC": "Brighton",
  "Chelsea FC": "Chelsea",
  "Coventry City FC": "Coventry City",
  "Crystal Palace FC": "Crystal Palace",
  "Everton FC": "Everton",
  "Fulham FC": "Fulham",
  "Hull City AFC": "Hull City",
  "Ipswich Town FC": "Ipswich Town",
  "Leeds United FC": "Leeds United",
  "Liverpool FC": "Liverpool",
  "Manchester City FC": "Manchester City",
  "Manchester United FC": "Manchester United",
  "Newcastle United FC": "Newcastle",
  "Nottingham Forest FC": "Nottingham Forest",
  "Sunderland AFC": "Sunderland",
  "Tottenham Hotspur FC": "Tottenham",
};

function toClub(fdName) {
  if (FD_NAMES[fdName]) return FD_NAMES[fdName];
  if (CMAP[fdName]) return fdName;
  const stripped = String(fdName)
    .replace(/\bAFC\b|\bFC\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (CMAP[stripped]) return stripped;
  const hit = Object.keys(CMAP).find(n => stripped.startsWith(n) || n.startsWith(stripped));
  return hit || null;
}

// POST /api/ingest — admin only. Pulls the full 2026–27 PL fixture list from
// football-data.org and upserts into the board:
//   · new fixtures are added as scheduled
//   · finished matches get their scores (unless the fixture was manually
//     locked by the scorer, which the admin panel marks with manual: true)
export async function POST() {
  const token = cookies().get("epl_admin")?.value;
  if (!isAdmin(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.FOOTBALL_DATA_TOKEN) {
    return NextResponse.json({ error: "FOOTBALL_DATA_TOKEN is not set" }, { status: 500 });
  }

  let data;
  try {
    const r = await fetch("https://api.football-data.org/v4/competitions/PL/matches?season=2026", {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ error: `football-data returned ${r.status}` }, { status: 502 });
    data = await r.json();
  } catch (e) {
    return NextResponse.json({ error: "could not reach football-data.org" }, { status: 502 });
  }

  const board = await getBoard();
  const matches = [...(board.matches || [])];
  const index = new Map(); // "mw|a|b" (order-independent) → array position
  matches.forEach((m, i) => {
    const k = [m.mw, ...[m.a, m.b].sort()].join("|");
    index.set(k, i);
  });

  let added = 0, updated = 0, skipped = 0, unmapped = 0;
  for (const fm of data.matches || []) {
    const a = toClub(fm.homeTeam?.name);
    const b = toClub(fm.awayTeam?.name);
    const mw = fm.matchday;
    if (!a || !b || !mw) { unmapped++; continue; }

    const finished = fm.status === "FINISHED";
    const ga = finished ? fm.score?.fullTime?.home : null;
    const gb = finished ? fm.score?.fullTime?.away : null;
    const date = fm.utcDate ? String(fm.utcDate).slice(0, 10) : null;

    const k = [mw, ...[a, b].sort()].join("|");
    const pos = index.get(k);

    if (pos === undefined) {
      matches.push({
        id: `fd:${fm.id}`, mw, date, a, b,
        ga: Number.isFinite(ga) ? ga : null,
        gb: Number.isFinite(gb) ? gb : null,
        status: finished && Number.isFinite(ga) ? "F" : "S",
      });
      index.set(k, matches.length - 1);
      added++;
    } else {
      const cur = matches[pos];
      if (cur.manual) { skipped++; continue; } // scorer override wins
      const next = { ...cur, date: date || cur.date };
      if (finished && Number.isFinite(ga) && Number.isFinite(gb)) {
        next.a = a; next.b = b; next.ga = ga; next.gb = gb; next.status = "F";
      }
      if (JSON.stringify(next) !== JSON.stringify(cur)) { matches[pos] = next; updated++; }
    }
  }

  const saved = await saveBoard({ ...board, matches });
  return NextResponse.json({ ok: true, added, updated, skipped, unmapped, total: matches.length, version: saved.version });
}
