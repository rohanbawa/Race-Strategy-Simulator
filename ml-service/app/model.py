"""
The race-winner classifier: train, persist, load, predict.

A `RandomForestClassifier` learns P(win) for a single entrant from the feature row
`features.build_features` produces. It is trained on races sampled from the
`simulator` Monte-Carlo generator - so the label chain scenario -> grid -> winner is
real supervised learning, just against a physics-informed generator rather than
(non-existent) 2026 history. At inference the per-entrant scores are normalised
across the 22 cars so a field's win probabilities sum to 1.

The trained model plus its metadata is cached to `models/race_winner.joblib`; the
service trains it automatically on first start if the file is missing or stale.
"""

from __future__ import annotations

import os
import time
import warnings
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import log_loss

# Harmless thread-config warning from the random forest's joblib workers (sklearn 1.9+).
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn.utils.parallel")

from .features import FEATURE_COLUMNS, build_features
from .simulator import Conditions, generate_races, ratings

MODEL_VERSION = "2026.2"  # track-aware: adds circuit overtaking/tyre-stress features
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "race_winner.joblib")

Race = Tuple[Conditions, np.ndarray, int]


def _dataset(races: List[Race]) -> Tuple[pd.DataFrame, np.ndarray]:
    r = ratings()
    frames, labels = [], []
    for cond, grid, winner_idx in races:
        frames.append(build_features(cond, grid))
        y = np.zeros(r.n, dtype=int)
        y[winner_idx] = 1
        labels.append(y)
    return pd.concat(frames, ignore_index=True), np.concatenate(labels)


def _evaluate(model: RandomForestClassifier, races: List[Race]) -> Dict[str, float]:
    """Race-level metrics: how often the model's favourite actually wins, etc."""
    correct = 0
    winner_probs = []
    for cond, grid, winner_idx in races:
        p = _normalized_proba(model, build_features(cond, grid))
        correct += int(np.argmax(p) == winner_idx)
        winner_probs.append(float(p[winner_idx]))
    return {
        "races_evaluated": len(races),
        "top1_accuracy": round(correct / len(races), 4),
        "mean_prob_on_actual_winner": round(float(np.mean(winner_probs)), 4),
    }


def _normalized_proba(model: RandomForestClassifier, feats: pd.DataFrame) -> np.ndarray:
    p = model.predict_proba(feats)[:, 1]
    total = p.sum()
    if total <= 0:
        return np.full(len(p), 1.0 / len(p))
    return p / total


def train(n_races: int = 4000, n_estimators: int = 260, seed: int = 2026) -> dict:
    train_races = generate_races(n_races, seed=seed)
    test_races = generate_races(max(600, n_races // 6), seed=seed + 1)

    X_train, y_train = _dataset(train_races)
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=11,
        min_samples_leaf=30,
        max_features="sqrt",
        class_weight="balanced_subsample",
        n_jobs=-1,
        random_state=seed,
    )
    model.fit(X_train, y_train)

    metrics = _evaluate(model, test_races)
    X_test, y_test = _dataset(test_races)
    proba = np.clip(model.predict_proba(X_test)[:, 1], 1e-6, 1 - 1e-6)
    metrics["log_loss"] = round(float(log_loss(y_test, proba)), 4)

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
        "model_type": "RandomForestClassifier",
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "n_train_races": n_races,
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
            "n_train_rows",
            "metrics",
            "feature_importances",
            "features",
        )
    }
