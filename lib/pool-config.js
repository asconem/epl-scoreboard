// ─────────────────────────────────────────────────────────────────────────────
// EPL STABLE POOL — SEASON CONFIG (2026–27)
//
// This is the ONLY file you touch on draft night. Everything else derives
// from it. Three steps, in order:
//
//   1. EARLY AUGUST (after the transfer window settles):
//      Fill in TIER for all 20 clubs — rank by bookmaker season points lines,
//      tier 1 = the five highest lines, tier 4 = the five lowest.
//      ✅ DONE — tiers below are cut from real sportsbook season-point lines
//      (England - Premier League 2026/27 Total Season Points props, pulled
//      08/08/2026). Sorted descending, cut every 5. No boundary ties.
//
//   2. DRAFT NIGHT:
//      Fill in STABLE for all 20 clubs. Stables 1–4 are the humans (four
//      clubs each, one per tier). Stable 5 is The Leftovers — the four clubs
//      nobody drafted. Set the owner names in OWNERS.
//
//   3. Deploy. The board validates this file on load and shows a setup
//      banner listing anything missing or inconsistent.
// ─────────────────────────────────────────────────────────────────────────────

// Owner names. Stable 5 is the ghost — leave it as The Leftovers.
export const OWNERS = {
  1: "Josh",
  2: "Pete",
  3: "Brax",
  4: "Matt",
  5: "The Leftovers", // ghost stable — receives the four undrafted clubs
};

// tier: 1–4 (done, from sportsbook lines) · stable: 1–5 (filled on draft night)
export const CLUB_CONFIG = {
  // Tier 1 — 77.5 / 75.5 / 71.5 / 69.5 / 67.5
  "Arsenal":          { tier: 1, stable: 2 },
  "Manchester City":  { tier: 1, stable: 4 },
  "Liverpool":        { tier: 1, stable: 5 },
  "Manchester United":{ tier: 1, stable: 3 },
  "Chelsea":          { tier: 1, stable: 1 },

  // Tier 2 — 61.5 / 58.5 / 54.5 / 51.5 / 49.5
  "Tottenham":        { tier: 2, stable: 4 },
  "Aston Villa":      { tier: 2, stable: 3 },
  "Brighton":         { tier: 2, stable: 1 },
  "Newcastle":        { tier: 2, stable: 5 },
  "Bournemouth":      { tier: 2, stable: 2 },

  // Tier 3 — 48.5 / 48.5 / 47.5 / 46.5 / 45.5
  "Everton":          { tier: 3, stable: 4 },
  "Nottingham Forest":{ tier: 3, stable: 1 },
  "Brentford":        { tier: 3, stable: 2 },
  "Leeds United":     { tier: 3, stable: 5 },
  "Crystal Palace":   { tier: 3, stable: 3 },

  // Tier 4 — 44.5 / 42.5 / 34.5 / 33.5 / 24.5
  "Fulham":           { tier: 4, stable: 4 },
  "Sunderland":       { tier: 4, stable: 3 },
  "Coventry City":    { tier: 4, stable: 1 },
  "Ipswich Town":     { tier: 4, stable: 2 },
  "Hull City":        { tier: 4, stable: 5 },
};

// Milestone values (settled after matchweek 38, once "Season complete" is
// switched on in the admin panel).
export const MILESTONES = { title: 15, top4: 10, relegation: -10 };

// Returns a list of human-readable config problems; empty when ready.
export function configProblems() {
  const problems = [];
  const entries = Object.entries(CLUB_CONFIG);

  const noTier = entries.filter(([, c]) => !c.tier).map(([n]) => n);
  if (noTier.length) problems.push(`Tiers not set: ${noTier.length} club${noTier.length > 1 ? "s" : ""}`);
  else {
    for (let t = 1; t <= 4; t++) {
      const n = entries.filter(([, c]) => c.tier === t).length;
      if (n !== 5) problems.push(`Tier ${t} has ${n} clubs (needs 5)`);
    }
  }

  const noStable = entries.filter(([, c]) => !c.stable).map(([n]) => n);
  if (noStable.length) problems.push(`Stables not set: ${noStable.length} club${noStable.length > 1 ? "s" : ""}`);
  else {
    for (let s = 1; s <= 5; s++) {
      const clubs = entries.filter(([, c]) => c.stable === s);
      if (clubs.length !== 4) problems.push(`Stable ${s} has ${clubs.length} clubs (needs 4)`);
      else if (!noTier.length) {
        const tiers = new Set(clubs.map(([, c]) => c.tier));
        if (tiers.size !== 4) problems.push(`Stable ${s} doesn't have one club per tier`);
      }
    }
  }
  return problems;
}
