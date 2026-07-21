# Pit Wall — Race Strategy Simulator

Pulls real historical F1 stint/pit-stop/lap data into a Spring Boot backend, then lets you
build a hypothetical strategy — different tire compounds, different stop laps — and compares
it lap-by-lap against what the driver actually did. Also answers the classic "would the
undercut have worked?" question.

```
race-strategy-simulator/
├── backend/    Spring Boot 3 / Java 17 — REST API, data model, simulation engine, ingestion
└── frontend/   React 18 / TypeScript / Vite — strategy builder UI
```

## Why this shape

**Two data sources, joined at ingestion time.** [Jolpica](https://github.com/jolpica/jolpica-f1)
(the community-run, schema-compatible successor to the retired Ergast API) is the system of
record for race schedules, results, lap times, and pit stop laps/durations. It does **not**
carry tire compound data. [OpenF1](https://openf1.org/) does, but only from 2018 onward and
under a different identifier scheme. `RaceIngestionService` joins the two by race date and
driver code, so the domain model ends up with one coherent picture: `Race → Stint (compound,
lap range) → PitStop → LapTime`.

**The simulation engine is deliberately explainable, not a fitted ML model.** Given a planned
stint sequence, `StrategySimulationService` first calibrates a driver's underlying "clean pace"
by taking their actual lap times for that race and backing out the model's own compound,
degradation, and fuel-load corrections (median-normalized, to shrug off traffic and safety-car
laps) — see the class-level Javadoc for the exact method. It then re-runs the race lap by lap
under the hypothetical plan, using the same three effects: compound offset, linear tire
degradation with an accelerating "cliff" past a compound-specific age, and a fuel-burn
correction. `UndercutOvercutCalculator` reuses the same model to answer a narrower question:
if you pit on lap N while a rival stays out, who's ahead once both have stopped?

This tradeoff is worth being upfront about: lap times won't match real telemetry to the
hundredth of a second, but every number in the output traces back to a rule you can read in
`TireDegradationModel` and `PitStopTimeLossModel` — which is the point for a strategy
*explainer*, as opposed to a predictor.

## Backend

### Requirements
- Java 17+
- Maven 3.9+ (or use the wrapper if you add one)

### Run it
```bash
cd backend
mvn spring-boot:run
```
Starts on `http://localhost:8080`, backed by a file-based H2 database at `backend/data/racesim`
(created automatically). The H2 console is available at `/h2-console` if you want to poke at
the tables directly.

### Load some data
The database starts empty — nothing is bundled, since fetching live is more interesting than a
stale seed file. Ingest a race by season and round number:
```bash
curl -X POST http://localhost:8080/api/ingest/2024/1     # 2024 Bahrain GP
curl -X POST http://localhost:8080/api/ingest/2024/2     # 2024 Saudi Arabian GP
```
Round numbers follow the season's calendar order (round 1 = season opener). Re-running the
same ingest is safe — it's idempotent on the upstream race/driver identifiers, so it updates
rather than duplicates. If OpenF1 doesn't have a session for the given date (very old seasons,
or a race from the last few days that hasn't been indexed yet), the race still ingests but
stints/compounds are left empty and the simulator falls back to a generic base pace.

### API

| Method | Path | Description |
|---|---|---|
| GET | `/api/races` | List all ingested races |
| GET | `/api/races/{raceId}` | Race detail + driver roster |
| GET | `/api/races/{raceId}/drivers/{driverId}/actual-strategy` | What that driver actually ran: stints, pit stops, total time |
| POST | `/api/simulate` | Run a hypothetical stint plan, get lap-by-lap comparison to actual |
| POST | `/api/simulate/undercut` | Evaluate whether pitting on a given lap undercuts a named rival |
| POST | `/api/ingest/{season}/{round}` | Pull one race in from Jolpica + OpenF1 |

Example simulate request:
```json
POST /api/simulate
{
  "raceId": 1,
  "driverId": 3,
  "plannedStints": [
    { "compound": "MEDIUM", "lengthLaps": 18 },
    { "compound": "HARD", "lengthLaps": 20 }
  ]
}
```
Stint lengths don't need to sum exactly to the race distance — the last stint is trimmed or
padded automatically to fit.

### Tests
```bash
cd backend
mvn test
```
`TireDegradationModelTest` and `StrategySimulationServiceTest` cover the simulation engine in
isolation (mocked repositories, no network) — the part of the codebase most worth trusting.

## Frontend

### Requirements
- Node 18+

### Run it
```bash
cd frontend
npm install
npm run dev
```
Starts on `http://localhost:5173` and proxies `/api/*` to the backend on `:8080` (see
`vite.config.ts`). Pick a race, pick a driver, and either read off their actual stint timeline
or start editing the what-if strategy builder below it. The undercut panel at the bottom lets
you pick a rival, a pit lap, and a compound, and tells you whether the swing works.

### Build
```bash
npm run build
```
Type-checks with `tsc -b` and produces a static bundle in `dist/` via Vite.

## Data model

```
Race (season, round, circuit, totalLaps)
 ├── Driver (code, name, constructor)         — via Stint/PitStop/LapTime join tables
 ├── Stint (driver, stintNumber, compound, startLap, endLap, avgLapTimeSeconds)
 ├── PitStop (driver, lap, stopNumber, stationaryTimeSeconds)
 └── LapTime (driver, lap, lapTimeSeconds, position)
```

`externalRef` columns on `Race` and `Driver` hold the upstream Jolpica identifiers and make
re-ingestion idempotent; `Stint.compound` is populated separately from OpenF1 once the session
is resolved by date.

## Known limitations / next steps

- The base-pace calibration is race-local — it doesn't yet borrow signal across a driver's
  season, so a race with very few clean laps (e.g. heavily disrupted by safety cars) will
  calibrate on thin data.
- OpenF1 session matching is by date only; on a rare doubleheader weekend at the same circuit
  this could need a tie-breaker.
- No auth on the ingest endpoint — fine for a local/demo project, not for a public deployment.
- The undercut calculator assumes the defender's second stint compound is known; for very
  early-race what-ifs before the defender has pitted, it falls back to a medium-tire guess.
