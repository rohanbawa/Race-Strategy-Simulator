"""Pydantic request/response models for the ML service API."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Weather(str, Enum):
    DRY = "DRY"
    MIXED = "MIXED"
    WET = "WET"


WETNESS = {Weather.DRY: 0.0, Weather.MIXED: 0.5, Weather.WET: 1.0}


class GridSlot(BaseModel):
    driverId: int
    position: int = Field(ge=1)


class ScenarioRequest(BaseModel):
    """The 2026 scenario levers, the chosen circuit, plus an optional explicit grid."""

    trackRound: Optional[int] = Field(None, ge=1, le=24)
    safetyCarProbability: float = Field(0.35, ge=0.0, le=1.0)
    weather: Weather = Weather.DRY
    tyreOffsetSeconds: float = Field(0.35, ge=0.0, le=2.0)
    grid: Optional[List[GridSlot]] = None
    qualifyingSeed: Optional[int] = None
    monteCarloSims: int = Field(4000, ge=200, le=20000)


class QualifyingRequest(BaseModel):
    trackRound: Optional[int] = Field(None, ge=1, le=24)
    weather: Weather = Weather.DRY
    seed: Optional[int] = None


class TrackDto(BaseModel):
    round: int
    name: str
    country: str
    circuit: str
    date: str
    laps: int
    kind: str
    overtakingEase: float
    tyreStress: float
    safetyCarRate: float
    played: bool


class TracksResponse(BaseModel):
    season: int
    nextUpcomingRound: int
    tracks: List[TrackDto]


class GridEntry(BaseModel):
    id: int
    code: str
    name: str
    team: str
    teamColor: str
    powerUnit: str
    gridPosition: int
    carRating: float
    driverRating: float
    wetSkill: float


class DriverPrediction(BaseModel):
    id: int
    code: str
    name: str
    team: str
    teamColor: str
    gridPosition: int
    winProbability: float
    podiumProbability: float
    pointsProbability: float
    meanFinish: float
    carRating: float
    driverRating: float


class ScenarioEcho(BaseModel):
    safetyCarProbability: float
    weather: Weather
    wetness: float
    tyreOffsetSeconds: float
    overtakingEase: float
    tyreStress: float
    monteCarloSims: int


class ModelSummary(BaseModel):
    type: str
    version: str
    trainedAt: str
    nTrainRaces: int
    top1Accuracy: float
    logLoss: float


class PredictionResponse(BaseModel):
    track: Optional[TrackDto]
    scenario: ScenarioEcho
    predictions: List[DriverPrediction]
    model: ModelSummary
    regulationNotes: List[str]


class QualifyingResponse(BaseModel):
    weather: Weather
    grid: List[GridEntry]
