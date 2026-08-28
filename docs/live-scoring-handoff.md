# Live scoring deployment handoff

This branch adds automatic in-play updates without changing the configured
owners, stable assignments, or the owner's board-migration safeguards.

## Behavior

- football-data.org statuses `LIVE`, `IN_PLAY`, and `PAUSED` are stored as
  local status `L`; `FINISHED` is stored as `F`.
- Live scores count provisionally in club totals, stable standings, goal
  difference, league positions, and upset bonuses.
- Live matches do not count toward completed-season validation or the results
  archive until football-data.org marks them finished.
- Manual admin scores remain locked and are never overwritten by either sync
  path.
- Public browsers continue reading cached board state every 15 seconds. They
  never receive the football-data.org token.

## Deployment requirements

Set these existing variables in Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_PASSWORD`
- `FOOTBALL_DATA_TOKEN`

Add one new variable:

- `CRON_SECRET` — a long random value that must not be committed

In GitHub → Settings → Secrets and variables → Actions:

- Add the same `CRON_SECRET` as a repository secret.
- Add `SCOREBOARD_URL` as a repository variable containing the deployed origin,
  such as `https://example.vercel.app` (no trailing path is needed).

`.github/workflows/live-scores.yml` invokes `GET /api/live` every five minutes
from 11:00–23:55 UTC and sends `Authorization: Bearer $CRON_SECRET`. The daily
window covers EPL match times without running overnight no-op jobs. Requests
without that exact header return 401. The workflow also supports a manual
**Run workflow** test. Scheduled workflows run from the repository's default
branch, so the schedule becomes active after merge.

After deployment, sign into `/admin` and run **Sync fixtures & results** once.
The scheduled endpoint uses those saved kickoff times to avoid provider calls
unless a fixture is between 15 minutes before kickoff and three hours after it.

The GitHub schedule performs at most 156 lightweight endpoint checks per day.
An isolated match window produces about 39 football-data.org calls; concurrent
matches share the same calls because each refresh fetches the competition once,
not once per fixture.

## Smoke test

During an active fixture, confirm:

1. A manual **Refresh live scores** workflow run returns 200.
2. The fixture displays a red `LIVE` label and current score.
3. The header says standings are provisional.
4. Stable totals respond to score changes.
5. The match moves to Results after the provider marks it finished.
6. A manually entered result remains unchanged after a scheduled sync.

Provider latency and live-score availability depend on the football-data.org
subscription attached to `FOOTBALL_DATA_TOKEN`.
