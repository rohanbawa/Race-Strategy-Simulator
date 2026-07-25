"""
The race-winner model: train, persist, load, predict.

A `RandomForestRegressor` learns each entrant's *win probability* directly from the
feature row `features.build_features` produces. The training target is not a noisy
one-hot "did this car win this single race" label - it is the Monte-Carlo win
frequency for that (scenario, grid), i.e. the true generative P(win) estimated from
many race draws (see `simulator.monte_carlo`). Regressing on that calibrated target
lets the model reproduce the generator's probability surface rather than a flattened,
under-confident approximation of it.

Why this matters: a classifier fitted to single-draw winners is badly under-confident
- it spreads probability across the field, so the favourite shows far less win% than
the model truly implies, and the headline win% can even fall below the Monte-Carlo
podium%. Learning the soft target fixes the calibration and keeps the headline win%
consistent with the podium/points odds (which come from the same Monte-Carlo).

At inference the per-entrant scores are clipped to >= 0 and normalised across the 22
cars so a field's win probabilities sum to 1. The trained model plus its metadata is
cached to `models/race_winner.joblib`; the service trains it automatically on first
start if the file is missing or stale.
"""

from __future__ import annotations

import os
import time
import warnings
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import log_loss

# Harmless thread-config warning from the random forest's joblib workers (sklearn 1.9+).
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn.utils.parallel")

from .features import FEATURE_COLUMNS, build_features
from .simulator import (
    Conditions,
    generate_races,
    monte_carlo,
    ratings,
    sample_conditions,
    simulate_qualifying,
)

MODEL_VERSION = "2026.3"  # soft-target regressor: learns the Monte-Carlo win-probability surface
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "race_winner.joblib")


def _soft_dataset(n_scenarios: int, n_sims: int, seed: int):
    """
    Build the supervised set: for each sampled (scenario, grid), every entrant is one
    row of features and its target is that car's Monte-Carlo win probability - the
    generative P(win) estimated from `n_sims` race draws. This soft, calibrated label
    is what lets the regressor match the true probability surface.
    """
    rng = np.random.default_rng(seed)
    frames: List[pd.DataFrame] = []
    targets: List[np.ndarray] = []
    for _ in range(n_scenarios):
        cond = sample_conditions(rng)
        grid = simulate_qualifying(cond, rng)
        mc = monte_carlo(cond, grid, n_sims, rng)
        frames.append(build_features(cond, grid))
        targets.append(mc["win"])
    return pd.concat(frames, ignore_index=True), np.concatenate(targets)


def _normalized_proba(model: RandomForestRegressor, feats: pd.DataFrame) -> np.ndarray:
    """Regressor scores, clipped to >= 0 and normalised to a probability distribution."""
    p = np.clip(model.predict(feats), 0.0, None)
    total = p.sum()
    if total <= 0:
        return np.full(len(p), 1.0 / len(p))
    return p / total


def _evaluate(model: RandomForestRegressor, races: List) -> Dict[str, float]:
    """
    Race-level metrics on held-out races that each have a concrete winner:
      * top1_accuracy            - how often the model's favourite actually wins,
      * mean_prob_on_actual_winner - the model's calibration on winners (higher = sharper),
      * log_loss                 - per-race normalised probabilistic loss (lower = better).
    """
    correct = 0
    winner_probs: List[float] = []
    all_p: List[np.ndarray] = []
    all_y: List[np.ndarray] = []
    for cond, grid, winner_idx in races:
        p = _normalized_proba(model, build_features(cond, grid))
        correct += int(np.argmax(p) == winner_idx)
        winner_probs.append(float(p[winner_idx]))
        y = np.zeros(len(p), dtype=int)
        y[winner_idx] = 1
        all_p.append(p)
        all_y.append(y)
    proba = np.clip(np.concatenate(all_p), 1e-6, 1 - 1e-6)
    labels = np.concatenate(all_y)
    return {
        "races_evaluated": len(races),
        "top1_accuracy": round(correct / len(races), 4),
        "mean_prob_on_actual_winner": round(float(np.mean(winner_probs)), 4),
        "log_loss": round(float(log_loss(labels, proba)), 4),
    }


def train(
    n_scenarios: int = 4000,
    n_sims: int = 250,
    n_estimators: int = 400,
    seed: int = 2026,
) -> dict:
    X_train, y_train = _soft_dataset(n_scenarios, n_sims, seed=seed)
    model = RandomForestRegressor(
        n_estimators=n_estimators,
        max_depth=18,
        min_samples_leaf=6,
        max_features="sqrt",
        n_jobs=-1,
        random_state=seed,
    )
    model.fit(X_train, y_train)

    # Held-out races (each with a concrete winner) drawn from an unseen seed.
    test_races = generate_races(max(1500, n_scenarios // 3), seed=seed + 1)
    metrics = _evaluate(model, test_races)

    importances = {
        k: round(v, 4)
        for k, v in sorted(
            zip(FEATURE_COLUMNS, model.feature_importances_.tolist()),
            key=lambda kv: kv[1],
            reverse=True,
        )
    }

    bundle = {
        "version": MODEL_VERSION,
        "model": model,
        "features": FEATURE_COLUMNS,
        "model_type": "RandomForestRegressor",
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "n_train_races": n_scenarios,
        "n_sims_per_scenario": n_sims,
        "n_train_rows": int(len(y_train)),
        "metrics": metrics,
        "feature_importances": importances,
    }
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH)
    return bundle


_BUNDLE: dict | None = None


def load_or_train() -> dict:
    global _BUNDLE
    if _BUNDLE is not None:
        return _BUNDLE
    if os.path.exists(MODEL_PATH):
        try:
            bundle = joblib.load(MODEL_PATH)
            if bundle.get("version") == MODEL_VERSION and bundle.get("features") == FEATURE_COLUMNS:
                _BUNDLE = bundle
                return _BUNDLE
        except Exception:
            pass  # fall through and retrain on any load/compat failure
    _BUNDLE = train()
    return _BUNDLE


def predict_win_probabilities(cond: Conditions, grid: np.ndarray) -> np.ndarray:
    bundle = load_or_train()
    return _normalized_proba(bundle["model"], build_features(cond, grid))


def model_info() -> dict:
    bundle = load_or_train()
    return {
        k: bundle[k]
        for k in (
            "version",
            "model_type",
            "trained_at",
            "n_train_races",
            "n_sims_per_scenario",
            "n_train_rows",
            "metrics",
            "feature_importances",
            "features",
        )
    }
