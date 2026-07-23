# ML service — 2026 race-winner predictor

A standalone FastAPI + scikit-learn microservice that predicts each 2026 driver's win / podium
/ points odds under conditions you choose (safety-car risk, weather, tyre offset), all under
the 2026 regulations. Consumed by the frontend's **Predict Race Winner** tab via the Vite proxy
at `/ml/*`.

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

The model trains itself on first use (~a few seconds) and caches to `models/race_winner.joblib`.
Force a rebuild / resize the training set with:

```bash
python train.py --races 8000
```

## How it works

No 2026 race history exists yet, so the pipeline learns from a **physics-informed Monte-Carlo
generator** instead of real results:

| File | Role |
|---|---|
| `app/grid_2026.py` | The 2026 grid (11 teams incl. Audi & Cadillac, 22 drivers) + all regulation constants — the single place to edit ratings and rules. |
| `app/calendar_2026.py` | The 24-round 2026 calendar with per-circuit characteristics (overtaking ease, tyre stress, safety-car rate) and played/upcoming status. |
| `app/simulator.py` | Generative race model: car/driver pace, 2026 reg effects, per-circuit factors, and the randomness safety cars / weather / tyre strategy inject. Produces training labels and inference distributions. |
| `app/features.py` | Feature engineering — the single feature contract shared by training and inference. |
| `app/model.py` | Trains / persists / loads a `RandomForestClassifier` for `P(win)` and normalises across the field. |
| `app/main.py` | FastAPI routes (`/health`, `/grid`, `/qualifying`, `/predict`, `/model-info`). |

The headline win % comes from the trained classifier; podium / points / average-finish come
from a Monte-Carlo of the same generator under your exact scenario.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/tracks` | Full 2026 calendar (played + upcoming) with per-circuit characteristics |
| GET | `/grid` | 2026 field, regulation notes, trained-model metadata |
| POST | `/qualifying` | Generate a plausible 2026 grid for a given track + weather |
| POST | `/predict` | Win / podium / points odds for the whole field (pass `trackRound` for a circuit) |
| GET | `/model-info` | Model type, training size, accuracy, feature importances |

> Ratings in `grid_2026.py` are illustrative pre-season estimates, not results — tweak them and
> every prediction updates.
