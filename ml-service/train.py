"""
Train (or retrain) the race-winner model and print its evaluation.

    python train.py                 # defaults: 4000 synthetic races
    python train.py --races 8000    # more data, slower, slightly sharper

The service also trains automatically on first request if no cached model exists,
so running this by hand is only needed to force a rebuild or tune the data size.
"""

import argparse
import json

from app import model as ml


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the 2026 race-winner model.")
    parser.add_argument("--races", type=int, default=4000, help="number of synthetic races to generate")
    parser.add_argument("--trees", type=int, default=260, help="number of trees in the random forest")
    parser.add_argument("--seed", type=int, default=2026)
    args = parser.parse_args()

    print(f"Generating {args.races} synthetic 2026 races and training {args.trees} trees...")
    bundle = ml.train(n_races=args.races, n_estimators=args.trees, seed=args.seed)

    print(f"\nSaved model v{bundle['version']} -> {ml.MODEL_PATH}")
    print(f"  training rows : {bundle['n_train_rows']}")
    print(f"  metrics       : {json.dumps(bundle['metrics'])}")
    print("  top features  :")
    for name, imp in list(bundle["feature_importances"].items())[:6]:
        print(f"      {name:<22} {imp}")


if __name__ == "__main__":
    main()
