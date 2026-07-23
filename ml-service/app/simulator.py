"""
A physics-informed Monte-Carlo race generator for the 2026 grid.

There is no historical 2026 race data to learn from (the formula is brand new), so
instead of fitting a model to results that don't exist yet, we encode domain
knowledge - car/driver pace, the 2026 regulation effects, and the randomness that
safety cars, weather and tyre strategy inject - into an explainable generative
model. Sampling it produces two things:

  * a labelled dataset the ML classifier in `model.py` learns from, and
  * at inference time, a full outcome distribution (podium odds, expected finish)
    under a chosen scenario.

Every effect below is a plain seconds-over-the-race term, so the model stays
readable. The regulation-sensitive knobs (`overtaking_ease`, `tyre_sensitivity`)
are read straight from `grid_2026.REGULATIONS_2026`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np

from .grid_2026 import REGULATIONS_2026, entrants

# --- pace model (all deficits are "seconds slower than a theoretical perfect car") ---
RACE_LAPS = 55

CAR_PACE_PER_LAP = 0.030       # s/lap per point of car-rating deficit
DRIVER_PACE_PER_LAP = 0.009    # s/lap per point of driver-rating deficit (race)
DRIVER_QUALI_PER_LAP = 0.013   # driver matters a little more over one qualifying lap
REG_PU_PER_LAP = 0.055         # s/lap penalty at pu_adaptation = 0 (new-formula cost)

WET_CAR_DAMPEN = 0.45          # rain compresses car advantage by up to this fraction
WET_SKILL_GAIN = 14.0          # seconds swing across the wet-skill range at full wet
FORM_NOISE_SD = 1.6            # race-day form / minor incidents (seconds, dry)

TRACK_POSITION_COST = 0.55     # seconds lost per grid slot, before overtaking-ease
SC_PROB_TO_EVENT = 1.0         # safety_car_prob is read directly as P(defining SC)
SC_COMPRESSION = 0.40          # a safety car bunches the field, shrinking pace gaps
SC_SHUFFLE_SD = 5.0            # ...and throws a strategy lottery (seconds)

TYRE_VARIANCE = 4.5            # seconds of strategic spread per unit of tyre offset
TYRE_SKILL_GAIN = 2.5          # better drivers extract more from a tyre offset

QUALI_NOISE_SD = 0.16          # one-lap qualifying scatter (seconds, dry)

_OVERTAKING_EASE = float(REGULATIONS_2026["overtaking_ease"])
_TYRE_SENSITIVITY = float(REGULATIONS_2026["tyre_sensitivity"])


@dataclass(frozen=True)
class Conditions:
    """The three scenario levers the user sets, plus the field size."""

    safety_car_prob: float   # 0-1, probability of a race-defining safety car
    wetness: float           # 0 = dry, 0.5 = mixed/damp, 1 = full wet
    tyre_offset: float       # >= 0, strategic tyre-performance spread (s/lap)

    def clamped(self) -> "Conditions":
        return Conditions(
            safety_car_prob=float(np.clip(self.safety_car_prob, 0.0, 1.0)),
            wetness=float(np.clip(self.wetness, 0.0, 1.0)),
            tyre_offset=float(np.clip(self.tyre_offset, 0.0, 2.0)),
        )


class RatingArrays:
    """Static per-entrant rating vectors, built once and reused across sims."""

    def __init__(self) -> None:
        ents = entrants()
        self.ids = np.array([e.id for e in ents])
        self.codes = [e.code for e in ents]
        self.car = np.array([e.team.car_rating for e in ents], dtype=float)
        self.driver = np.array([e.driver.driver_rating for e in ents], dtype=float)
        self.pu_adaptation = np.array([e.team.pu_adaptation for e in ents], dtype=float)
        self.wet_skill = np.array([e.driver.wet_skill for e in ents], dtype=float)
        self.n = len(ents)


_RATINGS: RatingArrays | None = None


def ratings() -> RatingArrays:
    global _RATINGS
    if _RATINGS is None:
        _RATINGS = RatingArrays()
    return _RATINGS


def _base_race_deficit(cond: Conditions, r: RatingArrays) -> np.ndarray:
    """Deterministic seconds-over-the-race deficit from pace, regs and weather."""
    car_term = (100.0 - r.car) * CAR_PACE_PER_LAP * RACE_LAPS
    car_term *= 1.0 - cond.wetness * WET_CAR_DAMPEN            # rain levels the cars
    driver_term = (100.0 - r.driver) * DRIVER_PACE_PER_LAP * RACE_LAPS
    reg_term = (1.0 - r.pu_adaptation) * REG_PU_PER_LAP * RACE_LAPS
    wet_term = (0.9 - r.wet_skill) * cond.wetness * WET_SKILL_GAIN
    return car_term + driver_term + reg_term + wet_term


def simulate_qualifying(cond: Conditions, rng: np.random.Generator) -> np.ndarray:
    """Return each entrant's grid position (1 = pole), as an int array."""
    r = ratings()
    quali_time = (
        (100.0 - r.car) * CAR_PACE_PER_LAP
        + (100.0 - r.driver) * DRIVER_QUALI_PER_LAP
        + (1.0 - r.pu_adaptation) * REG_PU_PER_LAP
        + (0.9 - r.wet_skill) * cond.wetness * 0.5
    )
    noise_sd = QUALI_NOISE_SD * (1.0 + cond.wetness * 3.0)
    quali_time = quali_time + rng.normal(0.0, noise_sd, size=r.n)
    order = np.argsort(quali_time)          # fastest first
    grid = np.empty(r.n, dtype=int)
    grid[order] = np.arange(1, r.n + 1)
    return grid


def _race_scores(cond: Conditions, grid: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """One race sample: lower score finishes ahead."""
    r = ratings()
    deficit = _base_race_deficit(cond, r).copy()

    track_term = (grid - 1) * TRACK_POSITION_COST * (1.0 - _OVERTAKING_EASE)

    sc_occurs = rng.random() < cond.safety_car_prob * SC_PROB_TO_EVENT
    if sc_occurs:
        deficit *= 1.0 - SC_COMPRESSION          # field bunched behind the SC
        track_term *= 1.0 - SC_COMPRESSION       # gaps to the front wiped out
        sc_shuffle = rng.normal(0.0, SC_SHUFFLE_SD, size=r.n)
    else:
        sc_shuffle = 0.0

    tyre_sd = cond.tyre_offset * TYRE_VARIANCE * _TYRE_SENSITIVITY
    tyre_shuffle = rng.normal(0.0, tyre_sd, size=r.n) if tyre_sd > 0 else 0.0
    tyre_skill = -(r.driver - 80.0) / 100.0 * cond.tyre_offset * TYRE_SKILL_GAIN

    form_sd = FORM_NOISE_SD * (1.0 + cond.wetness * 0.8)
    form = rng.normal(0.0, form_sd, size=r.n)

    return deficit + track_term + tyre_skill + form + sc_shuffle + tyre_shuffle


def simulate_race(cond: Conditions, grid: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Return finishing order as entrant indices, winner first."""
    return np.argsort(_race_scores(cond, grid, rng))


def monte_carlo(
    cond: Conditions,
    grid: np.ndarray,
    n_sims: int,
    rng: np.random.Generator,
) -> Dict[str, np.ndarray]:
    """
    Sample `n_sims` races under fixed conditions and grid, returning per-entrant
    win / podium / points probabilities and mean finishing position.
    """
    r = ratings()
    finish_counts_win = np.zeros(r.n)
    finish_counts_podium = np.zeros(r.n)
    finish_counts_points = np.zeros(r.n)
    finish_position_sum = np.zeros(r.n)

    for _ in range(n_sims):
        order = simulate_race(cond, grid, rng)
        positions = np.empty(r.n, dtype=int)
        positions[order] = np.arange(1, r.n + 1)
        finish_position_sum += positions
        finish_counts_win += positions == 1
        finish_counts_podium += positions <= 3
        finish_counts_points += positions <= 10

    return {
        "win": finish_counts_win / n_sims,
        "podium": finish_counts_podium / n_sims,
        "points": finish_counts_points / n_sims,
        "mean_finish": finish_position_sum / n_sims,
    }


def sample_conditions(rng: np.random.Generator) -> Conditions:
    """Draw a plausible race scenario for training-data generation."""
    return Conditions(
        safety_car_prob=float(rng.beta(1.6, 3.0)),      # skewed toward lower SC odds
        wetness=float(rng.choice([0.0, 0.0, 0.0, 0.35, 0.7, 1.0])),  # mostly dry
        tyre_offset=float(np.abs(rng.normal(0.35, 0.30))),
    )


def generate_races(
    n_races: int, seed: int = 2026
) -> List[Tuple[Conditions, np.ndarray, int]]:
    """
    Produce `n_races` labelled races: (conditions, grid, winner_index). One race =
    one qualifying draw + one race draw, so the label carries the full chain of
    scenario -> grid -> winner that the classifier will learn to short-circuit.
    """
    rng = np.random.default_rng(seed)
    races: List[Tuple[Conditions, np.ndarray, int]] = []
    for _ in range(n_races):
        cond = sample_conditions(rng)
        grid = simulate_qualifying(cond, rng)
        order = simulate_race(cond, grid, rng)
        races.append((cond, grid, int(order[0])))
    return races
