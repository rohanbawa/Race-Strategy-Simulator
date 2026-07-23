"""
FastAPI surface for the 2026 race-winner predictor.

Routes are served at the root; the Vite dev server proxies `/ml/*` here (stripping
the prefix), so the frontend calls `/ml/predict`, `/ml/grid`, etc. The model is
trained lazily on the first request that needs it (see `model.load_or_train`).
"""

from __future__ import annotations

from typing import Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import model as ml
from .calendar_2026 import CALENDAR_2026, Track, is_played, next_upcoming_round, track_for
from .grid_2026 import REGULATIONS_2026, entrants
from .schemas import (
    WETNESS,
    DriverPrediction,
    GridEntry,
    ModelSummary,
    PredictionResponse,
    QualifyingRequest,
    QualifyingResponse,
    ScenarioEcho,
    ScenarioRequest,
    TrackDto,
    TracksResponse,
    Weather,
)
from .simulator import Conditions, monte_carlo, ratings, simulate_qualifying

app = FastAPI(
    title="F1 2026 Race-Winner Predictor",
    description="ML predictions of race winners under 2026 regulations and chosen conditions.",
    version="1.0.0",
)

# The service also answers direct browser calls in dev, not only proxied ones.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _entrant_lookup():
    return {e.id: e for e in entrants()}


def _track_dto(track: Track) -> TrackDto:
    return TrackDto(
        round=track.round,
        name=track.name,
        country=track.country,
        circuit=track.circuit,
        date=track.date,
        laps=track.laps,
        kind=track.kind,
        overtakingEase=track.overtaking_ease,
        tyreStress=track.tyre_stress,
        safetyCarRate=track.safety_car_rate,
        played=is_played(track),
    )


def _track_seed(round_: Optional[int], explicit: Optional[int]) -> int:
    """A deterministic per-track qualifying seed, so each circuit gets its own grid."""
    if explicit is not None:
        return explicit
    if round_ is not None:
        return 3000 + round_
    return 2026


def _grid_from_request(req: ScenarioRequest) -> np.ndarray:
    """Explicit grid if supplied, else a per-track qualifying draw under the weather."""
    r = ratings()
    if req.grid:
        by_id = {e.id: i for i, e in enumerate(entrants())}
        grid = np.zeros(r.n, dtype=int)
        for slot in req.grid:
            if slot.driverId in by_id:
                grid[by_id[slot.driverId]] = slot.position
        # Any driver the client omitted starts at the back, in id order.
        missing = np.where(grid == 0)[0]
        next_pos = int(grid.max()) + 1 if grid.max() > 0 else 1
        for idx in missing:
            grid[idx] = next_pos
            next_pos += 1
        return grid
    rng = np.random.default_rng(_track_seed(req.trackRound, req.qualifyingSeed))
    return simulate_qualifying(Conditions(0.0, WETNESS[req.weather], 0.0), rng)


@app.get("/health")
def health():
    return {"status": "ok", "season": REGULATIONS_2026["season"]}


@app.get("/tracks", response_model=TracksResponse)
def tracks() -> TracksResponse:
    """The full 2026 calendar (played + upcoming) with per-circuit characteristics."""
    return TracksResponse(
        season=REGULATIONS_2026["season"],
        nextUpcomingRound=next_upcoming_round(),
        tracks=[_track_dto(t) for t in CALENDAR_2026],
    )


@app.get("/grid")
def grid():
    """The 2026 field, regulation notes, and model metadata (for the UI header)."""
    ents = entrants()
    drivers = [
        {
            "id": e.id,
            "code": e.code,
            "name": e.driver.name,
            "team": e.team.name,
            "teamColor": e.team.color,
            "powerUnit": e.team.power_unit,
            "carRating": e.team.car_rating,
            "driverRating": e.driver.driver_rating,
            "wetSkill": e.driver.wet_skill,
            "puAdaptation": e.team.pu_adaptation,
        }
        for e in ents
    ]
    return {
        "season": REGULATIONS_2026["season"],
        "regulationNotes": REGULATIONS_2026["notes"],
        "overtakingEase": REGULATIONS_2026["overtaking_ease"],
        "tyreSensitivity": REGULATIONS_2026["tyre_sensitivity"],
        "drivers": drivers,
        "model": ml.model_info(),
    }


@app.get("/model-info")
def model_info():
    return ml.model_info()


@app.post("/qualifying", response_model=QualifyingResponse)
def qualifying(req: QualifyingRequest) -> QualifyingResponse:
    """Generate a plausible 2026 qualifying grid for the chosen track and weather."""
    r = ratings()
    seed = _track_seed(req.trackRound, req.seed)
    rng = np.random.default_rng(seed)
    grid = simulate_qualifying(Conditions(0.0, WETNESS[req.weather], 0.0), rng)

    ents = entrants()
    entries = sorted(
        (
            GridEntry(
                id=e.id,
                code=e.code,
                name=e.driver.name,
                team=e.team.name,
                teamColor=e.team.color,
                powerUnit=e.team.power_unit,
                gridPosition=int(grid[i]),
                carRating=e.team.car_rating,
                driverRating=e.driver.driver_rating,
                wetSkill=e.driver.wet_skill,
            )
            for i, e in enumerate(ents)
        ),
        key=lambda g: g.gridPosition,
    )
    return QualifyingResponse(weather=req.weather, grid=entries)


@app.post("/predict", response_model=PredictionResponse)
def predict(req: ScenarioRequest) -> PredictionResponse:
    """Predict per-driver win/podium/points odds for the chosen circuit and scenario."""
    wetness = WETNESS[req.weather]

    # The selected circuit supplies its intrinsic characteristics; if none is chosen we
    # fall back to the Conditions defaults (the 2026 regulation baseline).
    track: Optional[Track] = track_for(req.trackRound) if req.trackRound else None
    overtaking_ease = track.overtaking_ease if track else Conditions.overtaking_ease
    tyre_stress = track.tyre_stress if track else Conditions.tyre_stress

    cond = Conditions(
        safety_car_prob=req.safetyCarProbability,
        wetness=wetness,
        tyre_offset=req.tyreOffsetSeconds,
        overtaking_ease=overtaking_ease,
        tyre_stress=tyre_stress,
    ).clamped()

    grid = _grid_from_request(req)

    # ML classifier -> headline win probability.
    win_probs = ml.predict_win_probabilities(cond, grid)
    # Monte-Carlo of the same generator -> distributional metrics the classifier
    # doesn't produce (podium/points odds, expected finishing position).
    rng = np.random.default_rng(7)
    mc = monte_carlo(cond, grid, req.monteCarloSims, rng)

    ents = entrants()
    preds = [
        DriverPrediction(
            id=e.id,
            code=e.code,
            name=e.driver.name,
            team=e.team.name,
            teamColor=e.team.color,
            gridPosition=int(grid[i]),
            winProbability=round(float(win_probs[i]), 4),
            podiumProbability=round(float(mc["podium"][i]), 4),
            pointsProbability=round(float(mc["points"][i]), 4),
            meanFinish=round(float(mc["mean_finish"][i]), 2),
            carRating=e.team.car_rating,
            driverRating=e.driver.driver_rating,
        )
        for i, e in enumerate(ents)
    ]
    preds.sort(key=lambda p: p.winProbability, reverse=True)

    info = ml.model_info()
    return PredictionResponse(
        track=_track_dto(track) if track else None,
        scenario=ScenarioEcho(
            safetyCarProbability=cond.safety_car_prob,
            weather=req.weather,
            wetness=wetness,
            tyreOffsetSeconds=cond.tyre_offset,
            overtakingEase=cond.overtaking_ease,
            tyreStress=cond.tyre_stress,
            monteCarloSims=req.monteCarloSims,
        ),
        predictions=preds,
        model=ModelSummary(
            type=info["model_type"],
            version=info["version"],
            trainedAt=info["trained_at"],
            nTrainRaces=info["n_train_races"],
            top1Accuracy=info["metrics"]["top1_accuracy"],
            logLoss=info["metrics"]["log_loss"],
        ),
        regulationNotes=REGULATIONS_2026["notes"],
    )
