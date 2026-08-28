# EPL Stable Pool — Live Scoreboard (2026–27)

Four owners, one ghost stable (The Leftovers), all 20 Premier League clubs.
Sibling of the World Cup stable pool board — same stack (Next.js 14 · Upstash
Redis · Vercel), same one-scorer / everyone-watches model.

## Season setup (August)

1. `lib/pool-config.js` is the only file you touch:
   - Fill in `tier` for all 20 clubs from the bookmaker points lines (4 tiers of 5).
   - After draft night, fill in `stable` for all 20 clubs and the four owner
     names in `OWNERS`. Stable 5 is The Leftovers. Each stable gets four clubs,
     one from each tier.
   - The board shows a setup banner until the config validates.
2. Env vars (Vercel → Settings → Environment Variables): `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_PASSWORD`, `FOOTBALL_DATA_TOKEN`, and a
   long random `CRON_SECRET`.
3. GitHub → Settings → Secrets and variables → Actions:
   - Add the same `CRON_SECRET` as a repository secret.
   - Add `SCOREBOARD_URL` as a repository variable, using the deployed origin
     only (for example, `https://example.vercel.app`, with no trailing path).

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
4. Deploy. In `/admin`, hit **Sync fixtures & results** once to load all 380
   fixtures with dates and matchweeks.

## Running the season

- `.github/workflows/live-scores.yml` calls `/api/live` every five minutes from
  11:00–23:55 UTC. The endpoint checks saved kickoff times first and only calls
  football-data.org from 15 minutes before kickoff until three hours afterward.
- The workflow uses free GitHub Actions minutes for this public repository and
  avoids requiring a paid Vercel cron schedule.
- Live scores and provisional stable standings update automatically. Public
  boards read cached Redis state every 15 seconds and never expose the provider
  token or consume provider quota directly.
- After deployment, open `/admin` and hit **Sync fixtures & results** once to
  seed all fixture times. The button remains the manual sync fallback.
- Corrections: manual entry in the scorer tools upserts a result and marks it
  `manual` — the sync never overwrites manual entries.
- After matchweek 38: flip **Season complete** to apply milestones
  (+15 title, +10 top 4, −10 relegation) from the final table.

## Scoring

Win 3 / draw 1 / loss 0, upset bonus = tier gap on any win by the lower-tier
club, milestones at season's end. Tiebreakers: stable GD, goals scored, upset
points. If The Leftovers wins, the pot rolls over.
