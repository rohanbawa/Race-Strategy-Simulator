# Pit Wall — Race Strategy Simulator + 2026 Race-Winner Predictor

Two tools behind one top toolbar:

1. **Strategy Sim** — pulls real historical F1 stint/pit-stop/lap data into a Spring Boot
   backend, then lets you build a hypothetical strategy (different tire compounds, different
   stop laps) and compares it lap-by-lap against what the driver actually did. Also answers
   the classic "would the undercut have worked?" question.
2. **Predict Race Winner** — a Python machine-learning service that estimates each 2026
   driver's win / podium / points odds under conditions you choose: safety-car risk, weather,
   and tyre-strategy offset, all under the new 2026 regulations.

```
race-strategy-simulator/
├── backend/      Spring Boot 3 / Java 17 — REST API, data model, simulation engine, ingestion
├── ml-service/   Python 3 / FastAPI / scikit-learn — 2026 race-winner ML predictor
└── frontend/     React 18 / TypeScript / Vite — strategy builder + prediction UI
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

## Race-winner predictor (ML service)

`ml-service/` is a standalone Python microservice (FastAPI + scikit-learn) that predicts, for
the **2026 grid under 2026 regulations**, how likely each driver is to win / finish on the
podium / score points given three scenario levers you set:

- **Safety-car probability** — a safety car bunches the field and throws a strategy lottery.
- **Weather** — dry / mixed / wet; rain compresses car advantage and rewards driver skill.
- **Tyre offset** — how big the compound/strategy delta is; larger offsets create more upsets
  (sharpened by 2026's narrower tyres).

### Why a simulator-trained model

There is no 2026 race history to learn from, so instead of fitting to results that don't exist
yet, `simulator.py` encodes domain knowledge — car/driver pace, the 2026 regulation effects
(new 50/50 power units, active aero + Manual Override making overtaking easier, narrower
tyres, and the expanded 11-team grid with Audi and Cadillac) — into an explainable
physics-informed Monte-Carlo generator. A `RandomForestClassifier` (`model.py`) is then
trained on thousands of races sampled from it to learn `P(win | conditions, grid)`. The
headline win % comes from that classifier; podium / points / average-finish come from a
Monte-Carlo of the same generator under your exact scenario. Every constant lives in
`grid_2026.py`, so the whole pipeline is editable and auditable.

### Requirements
- Python 3.10+

### Run it
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```
Starts on `http://localhost:8000`. The model trains automatically on the first request that
needs it (a few seconds) and is cached to `ml-service/models/race_winner.joblib`. To force a
rebuild or tune the training-set size:
```bash
python train.py --races 8000
```

### API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/grid` | 2026 field, regulation notes, and trained-model metadata |
| POST | `/qualifying` | Generate a plausible 2026 starting grid for a given weather |
| POST | `/predict` | Win / podium / points odds for the whole field under chosen conditions |
| GET  | `/model-info` | Model type, training size, accuracy, feature importances |

Example predict request:
```json
POST /predict
{
  "safetyCarProbability": 0.4,
  "weather": "WET",
  "tyreOffsetSeconds": 0.6,
  "qualifyingSeed": 2026,
  "monteCarloSims": 4000
}
```
The frontend reaches this service through the Vite dev proxy at `/ml/*` (see `vite.config.ts`),
so no CORS setup is needed in development.

## Frontend

### Requirements
- Node 18+

### Run it
```bash
cd frontend
npm install
npm run dev
```
Starts on `http://localhost:5173` and proxies `/api/*` to the Spring backend on `:8080` and
`/ml/*` to the Python ML service on `:8000` (see `vite.config.ts`). The top toolbar switches
between the two modes:

- **1 · Strategy Sim** — pick a race, pick a driver, and either read off their actual stint
  timeline or start editing the what-if strategy builder below it. The undercut panel at the
  bottom lets you pick a rival, a pit lap, and a compound, and tells you whether the swing works.
- **2 · Predict Race Winner** — set the safety-car, weather and tyre-offset conditions, (re)draw
  a 2026 qualifying grid, and the ML service returns the predicted podium, a full-field win-
  probability board, and a breakdown of what the model weighed. Requires the ML service running
  on `:8000`.

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
