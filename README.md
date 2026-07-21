# EPL Stable Pool — Live Scoreboard (2026–27)

Three owners, one ghost stable (The Leftovers), all 20 Premier League clubs.
Sibling of the World Cup stable pool board — same stack (Next.js 14 · Upstash
Redis · Vercel), same one-scorer / everyone-watches model.

## Season setup (August)

1. `lib/pool-config.js` is the only file you touch:
   - Fill in `tier` for all 20 clubs from the bookmaker points lines (5 tiers of 4).
   - After draft night, fill in `stable` for all 20 clubs and the three owner
     names in `OWNERS`. Stable 4 is The Leftovers.
   - The board shows a setup banner until the config validates.
2. Env vars (Vercel → Settings → Environment Variables): `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_PASSWORD`, `FOOTBALL_DATA_TOKEN`.

   Getting the football-data token:
   - Register at https://www.football-data.org/client/register (free tier:
     fixtures, results and league tables for 12 competitions incl. the
     Premier League, 10 calls/min — one sync is one call).
   - The token is emailed to you; the same page can resend it if lost.
   - Verify it before deploying:
     `curl -H "X-Auth-Token: YOUR_TOKEN" "https://api.football-data.org/v4/competitions/PL/matches?season=2026"`
     A JSON `matches` array means it works — that is the exact request the
     sync makes. 403 = bad token.
   - Add it as `FOOTBALL_DATA_TOKEN` in Vercel, then redeploy.
3. Deploy. In `/admin`, hit **Sync fixtures & results** once to load all 380
   fixtures with dates and matchweeks.

## Running the season

- After a matchweek: open `/admin`, hit **Sync fixtures & results**. Done.
- Corrections: manual entry in the scorer tools upserts a result and marks it
  `manual` — the sync never overwrites manual entries.
- After matchweek 38: flip **Season complete** to apply milestones
  (+15 title, +10 top 4, −10 relegation) from the final table.

## Scoring

Win 3 / draw 1 / loss 0, upset bonus = tier gap on any win by the lower-tier
club, milestones at season's end. Tiebreakers: stable GD, goals scored, upset
points. If The Leftovers wins, the pot rolls over.
