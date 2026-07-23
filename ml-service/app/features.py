"""
Feature engineering for the race-winner classifier.

`build_features` turns one (scenario, grid) pair into a 22-row table - one row per
entrant - with exactly the columns the model trains and predicts on. Training and
inference both call it, so the feature contract can never drift between them.

The columns deliberately mix raw signals (ratings, grid slot, the three scenario
levers) with *relative* signals (how far a car is off the strongest one) and a few
interaction terms that encode 2026 race dynamics - e.g. a safety car or a big tyre
offset helps whoever is starting further back. Giving the model these interactions
explicitly lets a plain tree ensemble recover the upset structure the simulator
builds in.
"""

from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

from .simulator import Conditions, ratings

FEATURE_COLUMNS: List[str] = [
    "car_rating",
    "driver_rating",
    "pu_adaptation",
    "wet_skill",
    "combined_rating",
    "car_gap_to_best",
    "driver_gap_to_best",
    "grid_position",
    "grid_norm",
    "safety_car_prob",
    "wetness",
    "tyre_offset",
    "grid_x_safety_car",     # starting back is less costly when a SC is likely
    "grid_x_tyre_offset",    # ...and when tyre strategy can shuffle the order
    "wet_x_wet_skill",       # rain rewards wet-weather craft
    "wet_x_car_gap",         # rain lets a weaker car punch above the machinery
]


def build_features(cond: Conditions, grid: np.ndarray) -> pd.DataFrame:
    """Return a DataFrame of FEATURE_COLUMNS, one row per entrant (grid order-independent)."""
    r = ratings()
    cond = cond.clamped()

    car = r.car
    driver = r.driver
    combined = 0.65 * car + 0.35 * driver
    car_gap = car.max() - car
    driver_gap = driver.max() - driver
    grid_norm = (grid - 1) / (r.n - 1)

    sc = np.full(r.n, cond.safety_car_prob)
    wet = np.full(r.n, cond.wetness)
    tyre = np.full(r.n, cond.tyre_offset)

    data = {
        "car_rating": car,
        "driver_rating": driver,
        "pu_adaptation": r.pu_adaptation,
        "wet_skill": r.wet_skill,
        "combined_rating": combined,
        "car_gap_to_best": car_gap,
        "driver_gap_to_best": driver_gap,
        "grid_position": grid.astype(float),
        "grid_norm": grid_norm,
        "safety_car_prob": sc,
        "wetness": wet,
        "tyre_offset": tyre,
        "grid_x_safety_car": grid_norm * sc,
        "grid_x_tyre_offset": grid_norm * tyre,
        "wet_x_wet_skill": wet * r.wet_skill,
        "wet_x_car_gap": wet * car_gap,
    }
    return pd.DataFrame(data, columns=FEATURE_COLUMNS)
