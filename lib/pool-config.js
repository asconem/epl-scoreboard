// ─────────────────────────────────────────────────────────────────────────────
// EPL STABLE POOL — SEASON CONFIG (2026–27)
//
// This is the ONLY file you touch on draft night. Everything else derives
// from it. Three steps, in order:
//
//   1. EARLY AUGUST (after the transfer window settles):
//      Fill in TIER for all 20 clubs — rank by bookmaker season points lines,
//      tier 1 = the four highest lines, tier 5 = the four lowest.
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

// tier: 1–5 (fill in August) · stable: 1–4 (fill on draft night)
export const CLUB_CONFIG = {
  "Arsenal":          { tier: null, stable: null },
  "Aston Villa":      { tier: null, stable: null },
  "Bournemouth":      { tier: null, stable: null },
  "Brentford":        { tier: null, stable: null },
  "Brighton":         { tier: null, stable: null },
  "Chelsea":          { tier: null, stable: null },
  "Coventry City":    { tier: null, stable: null },
  "Crystal Palace":   { tier: null, stable: null },
  "Everton":          { tier: null, stable: null },
  "Fulham":           { tier: null, stable: null },
  "Hull City":        { tier: null, stable: null },
  "Ipswich Town":     { tier: null, stable: null },
  "Leeds United":     { tier: null, stable: null },
  "Liverpool":        { tier: null, stable: null },
  "Manchester City":  { tier: null, stable: null },
  "Manchester United":{ tier: null, stable: null },
  "Newcastle":        { tier: null, stable: null },
  "Nottingham Forest":{ tier: null, stable: null },
  "Sunderland":       { tier: null, stable: null },
  "Tottenham":        { tier: null, stable: null },
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
