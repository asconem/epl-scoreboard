// ─────────────────────────────────────────────────────────────────────────────
// EPL STABLE POOL — SEASON CONFIG (2026–27)
//
// This is the ONLY file you touch on draft night. Everything else derives
// from it. Three steps, in order:
//
//   1. EARLY AUGUST (after the transfer window settles):
//      Fill in TIER for all 20 clubs — rank by bookmaker season points lines,
//      tier 1 = the four highest lines, tier 5 = the four lowest.
//      ✅ DONE — tiers below are cut from real sportsbook season-point lines
//      (England - Premier League 2026/27 Total Season Points props, pulled
//      08/08/2026). Sorted descending, cut every 4. No boundary ties.
//
//   2. DRAFT NIGHT:
//      Fill in STABLE for all 20 clubs. Stables 1–3 are the humans (five
//      clubs each, one per tier). Stable 4 is The Leftovers — the five clubs
//      nobody drafted. Set the owner names in OWNERS.
//
//   3. Deploy. The board validates this file on load and shows a setup
//      banner listing anything missing or inconsistent.
// ─────────────────────────────────────────────────────────────────────────────

// Owner names. Stable 4 is the ghost — leave it as The Leftovers.
export const OWNERS = {
  1: "",              // ← owner 1
  2: "",              // ← owner 2
  3: "",              // ← owner 3
  4: "The Leftovers", // ghost stable — receives the five undrafted clubs
};

// tier: 1–5 (done, from sportsbook lines) · stable: 1–4 (fill on draft night)
export const CLUB_CONFIG = {
  // Tier 1 — 77.5 / 75.5 / 71.5 / 69.5
  "Arsenal":          { tier: 1, stable: null },
  "Manchester City":  { tier: 1, stable: null },
  "Liverpool":        { tier: 1, stable: null },
  "Manchester United":{ tier: 1, stable: null },

  // Tier 2 — 67.5 / 61.5 / 58.5 / 54.5
  "Chelsea":          { tier: 2, stable: null },
  "Tottenham":        { tier: 2, stable: null },
  "Aston Villa":      { tier: 2, stable: null },
  "Brighton":         { tier: 2, stable: null },

  // Tier 3 — 51.5 / 49.5 / 48.5 / 48.5 (Everton & Forest tied — mid-tier, no boundary issue)
  "Newcastle":        { tier: 3, stable: null },
  "Bournemouth":      { tier: 3, stable: null },
  "Everton":          { tier: 3, stable: null },
  "Nottingham Forest":{ tier: 3, stable: null },

  // Tier 4 — 47.5 / 46.5 / 45.5 / 44.5
  "Brentford":        { tier: 4, stable: null },
  "Leeds United":     { tier: 4, stable: null },
  "Crystal Palace":   { tier: 4, stable: null },
  "Fulham":           { tier: 4, stable: null },

  // Tier 5 — 42.5 / 34.5 / 33.5 / 24.5
  "Sunderland":       { tier: 5, stable: null },
  "Coventry City":    { tier: 5, stable: null },
  "Ipswich Town":     { tier: 5, stable: null },
  "Hull City":        { tier: 5, stable: null },
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
    for (let t = 1; t <= 5; t++) {
      const n = entries.filter(([, c]) => c.tier === t).length;
      if (n !== 4) problems.push(`Tier ${t} has ${n} clubs (needs 4)`);
    }
  }

  const noStable = entries.filter(([, c]) => !c.stable).map(([n]) => n);
  if (noStable.length) problems.push(`Stables not set: ${noStable.length} club${noStable.length > 1 ? "s" : ""}`);
  else {
    for (let s = 1; s <= 4; s++) {
      const clubs = entries.filter(([, c]) => c.stable === s);
      if (clubs.length !== 5) problems.push(`Stable ${s} has ${clubs.length} clubs (needs 5)`);
      else if (!noTier.length) {
        const tiers = new Set(clubs.map(([, c]) => c.tier));
        if (tiers.size !== 5) problems.push(`Stable ${s} doesn't have one club per tier`);
      }
    }
  }
  return problems;
}
