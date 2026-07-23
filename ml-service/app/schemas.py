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
    """The three 2026 scenario levers, plus an optional explicit grid."""

    safetyCarProbability: float = Field(0.35, ge=0.0, le=1.0)
    weather: Weather = Weather.DRY
    tyreOffsetSeconds: float = Field(0.35, ge=0.0, le=2.0)
    grid: Optional[List[GridSlot]] = None
    qualifyingSeed: Optional[int] = None
    monteCarloSims: int = Field(4000, ge=200, le=20000)


class QualifyingRequest(BaseModel):
    weather: Weather = Weather.DRY
    seed: Optional[int] = None


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
    monteCarloSims: int


class ModelSummary(BaseModel):
    type: str
    version: str
    trainedAt: str
    nTrainRaces: int
    top1Accuracy: float
    logLoss: float


class PredictionResponse(BaseModel):
    scenario: ScenarioEcho
    predictions: List[DriverPrediction]
    model: ModelSummary
    regulationNotes: List[str]


class QualifyingResponse(BaseModel):
    weather: Weather
    grid: List[GridEntry]
