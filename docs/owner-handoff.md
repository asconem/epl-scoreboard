# Owner handoff: five-stable pool and live scoring

## What this branch changes

This branch updates the 2026–27 EPL pool from three owners plus Leftovers to
four owners plus Leftovers:

- 4 tiers of 5 clubs
- 5 stables of 4 clubs
- exactly one club from each tier in every stable
- live and finished score ingestion from football-data.org
- provisional pool and league standings while matches are in progress
- a protected Vercel cron endpoint for automatic live refreshes
- migration of the old saved owner-name shape, where Stable 4 was Leftovers

The configured stables are:

| Stable | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
| --- | --- | --- | --- | --- |
| Josh | Chelsea | Brighton | Nottingham Forest | Coventry City |
| Pete | Arsenal | Bournemouth | Brentford | Ipswich Town |
| Brax | Manchester United | Aston Villa | Crystal Palace | Sunderland |
| Matt | Manchester City | Tottenham | Everton | Fulham |
| The Leftovers | Liverpool | Newcastle | Leeds United | Hull City |

## Scoring behavior

- Win: 3 points; draw: 1; loss: 0.
- A lower-tier club that wins receives an upset bonus equal to the tier gap
  (`+1` through `+3`).
- Live scores count provisionally in stable totals, goal difference, league
  position, and upset points. They become permanent when the provider marks
  the match finished.
- Season-end milestones remain title `+15`, other top-four finish `+10`, and
  relegation `-10`.
- Stable ties remain points, goal difference, goals scored, then upset points.
- Manual admin scores remain locked and are never overwritten by syncs.

## Required deployment configuration

Configure these environment variables in Vercel for the production deployment:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_PASSWORD`
- `FOOTBALL_DATA_TOKEN`
- `CRON_SECRET` — generate a new long random value; do not commit it

`vercel.json` schedules `GET /api/live` every minute. Vercel supplies
`Authorization: Bearer $CRON_SECRET` to cron requests. Confirm that the Vercel
plan used by this project supports one-minute cron schedules. If it does not,
use an external scheduler with the same authorization header or choose a plan
that supports the required frequency.

After the first deployment, sign in at `/admin` and press **Sync fixtures &
results** once. This seeds all fixtures and kickoff times. Automatic polling
then calls football-data.org only from 15 minutes before a saved kickoff until
three hours after it, limiting unnecessary API usage. The admin Sync button is
also the operational fallback.

Confirm that the football-data.org subscription supplies sufficiently current
Premier League in-play scores and permits the intended request frequency.
Provider latency and account limits determine how close to real time the board
can be.

## Verification completed

- Pool configuration validation passes.
- All 20 clubs are assigned exactly once.
- Every tier contains five clubs.
- Every stable contains four clubs, one from each tier.
- `npm run build` passes, including `/api/live`.
- `git diff --check` passes.

Actual live-provider behavior still needs a deployment smoke test because it
requires the production Redis credentials, football-data.org token, cron
secret, and an active fixture.

## Dependency note

Next.js was updated from 14.2.5 to 14.2.35, removing the critical advisory
reported against the original version. As of this handoff, `npm audit` still
reports three high-severity advisories in `next`, `nanoid`, and `postcss`; npm's
recommended complete fix is a major upgrade to Next.js 16.3.2. That framework
upgrade is intentionally not bundled with the pool/live-scoring feature and
should be planned and tested separately.

## Suggested pre-merge checklist

1. Review the stable and tier assignments above.
2. Review the scoring rules and provisional-live behavior.
3. Confirm the deployment's cron frequency and football-data.org plan.
4. Merge and configure all five environment variables before production use.
5. Run the initial admin fixture sync.
6. Test `/api/live` during an active fixture and confirm the score, `LIVE`
   indicator, provisional standings, and final transition.
7. Schedule the remaining Next.js major-version security upgrade.
