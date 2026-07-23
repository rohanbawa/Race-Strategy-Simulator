"""
The 2026 Formula 1 calendar, with the per-circuit characteristics that make each
race predict differently.

This is the prediction-side analogue of the strategy simulator's real per-track data
(laps, pit loss, degradation): every circuit carries three characteristics that feed
straight into the race model, so selecting a different track genuinely changes the
odds rather than just relabelling them.

  * overtaking_ease   0-1  - how easy it is to pass (Monaco ~0.12, Monza ~0.85).
                             Low values make grid position decisive; high values let
                             pace win out. Already adjusted for 2026's active aero +
                             Manual Override making passing easier everywhere.
  * tyre_stress       ~0.7-1.45 - how punishing the circuit is on tyres. Higher values
                             amplify the tyre-offset lever (more strategic upsets).
  * safety_car_rate   0-1  - the circuit's typical safety-car likelihood; used to
                             pre-fill the safety-car control when a track is picked.

Dates are the illustrative 2026 schedule; `played` is computed against today's date.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import List


@dataclass(frozen=True)
class Track:
    round: int
    name: str
    country: str
    circuit: str
    date: str          # ISO yyyy-mm-dd
    laps: int
    kind: str          # street | permanent | hybrid
    overtaking_ease: float
    tyre_stress: float
    safety_car_rate: float


CALENDAR_2026: List[Track] = [
    Track(1,  "Australian Grand Prix",   "Australia",    "Albert Park",            "2026-03-08", 58, "hybrid",     0.50, 1.00, 0.45),
    Track(2,  "Chinese Grand Prix",      "China",        "Shanghai",               "2026-03-15", 56, "permanent",  0.60, 1.15, 0.35),
    Track(3,  "Japanese Grand Prix",     "Japan",        "Suzuka",                 "2026-03-29", 53, "permanent",  0.45, 1.20, 0.30),
    Track(4,  "Bahrain Grand Prix",      "Bahrain",      "Sakhir",                 "2026-04-12", 57, "permanent",  0.70, 1.30, 0.30),
    Track(5,  "Saudi Arabian Grand Prix","Saudi Arabia", "Jeddah Corniche",        "2026-04-19", 50, "street",     0.55, 0.90, 0.55),
    Track(6,  "Miami Grand Prix",        "United States","Miami",                  "2026-05-03", 57, "street",     0.55, 1.00, 0.45),
    Track(7,  "Canadian Grand Prix",     "Canada",       "Circuit Gilles-Villeneuve","2026-05-24", 70, "hybrid",   0.60, 0.95, 0.50),
    Track(8,  "Monaco Grand Prix",       "Monaco",       "Monte Carlo",            "2026-06-07", 78, "street",     0.12, 0.75, 0.60),
    Track(9,  "Spanish Grand Prix",      "Spain",        "Barcelona-Catalunya",    "2026-06-14", 66, "permanent",  0.50, 1.35, 0.20),
    Track(10, "Austrian Grand Prix",     "Austria",      "Red Bull Ring",          "2026-06-28", 71, "permanent",  0.75, 1.05, 0.40),
    Track(11, "British Grand Prix",      "Great Britain","Silverstone",            "2026-07-05", 52, "high-speed", 0.65, 1.25, 0.35),
    Track(12, "Belgian Grand Prix",      "Belgium",      "Spa-Francorchamps",      "2026-07-19", 44, "high-speed", 0.70, 1.15, 0.45),
    Track(13, "Hungarian Grand Prix",    "Hungary",      "Hungaroring",            "2026-07-26", 70, "permanent",  0.30, 1.00, 0.30),
    Track(14, "Dutch Grand Prix",        "Netherlands",  "Zandvoort",              "2026-08-23", 72, "permanent",  0.35, 1.10, 0.35),
    Track(15, "Italian Grand Prix",      "Italy",        "Monza",                  "2026-09-06", 53, "high-speed", 0.85, 0.90, 0.35),
    Track(16, "Madrid Grand Prix",       "Spain",        "Madring",                "2026-09-13", 57, "hybrid",     0.45, 1.00, 0.40),
    Track(17, "Azerbaijan Grand Prix",   "Azerbaijan",   "Baku City",              "2026-09-27", 51, "street",     0.60, 0.85, 0.60),
    Track(18, "Singapore Grand Prix",    "Singapore",    "Marina Bay",             "2026-10-11", 62, "street",     0.25, 1.05, 0.70),
    Track(19, "United States Grand Prix","United States","Circuit of the Americas","2026-10-25", 56, "permanent",  0.65, 1.20, 0.35),
    Track(20, "Mexico City Grand Prix",  "Mexico",       "Hermanos Rodriguez",     "2026-11-01", 71, "permanent",  0.50, 0.95, 0.40),
    Track(21, "Sao Paulo Grand Prix",    "Brazil",       "Interlagos",             "2026-11-08", 71, "permanent",  0.70, 1.10, 0.50),
    Track(22, "Las Vegas Grand Prix",    "United States","Las Vegas Strip",        "2026-11-21", 50, "street",     0.70, 0.85, 0.55),
    Track(23, "Qatar Grand Prix",        "Qatar",        "Lusail",                 "2026-11-29", 57, "permanent",  0.55, 1.30, 0.30),
    Track(24, "Abu Dhabi Grand Prix",    "UAE",          "Yas Marina",             "2026-12-06", 58, "permanent",  0.45, 1.00, 0.35),
]

_BY_ROUND = {t.round: t for t in CALENDAR_2026}


def track_for(round_: int) -> Track:
    return _BY_ROUND[round_]


def is_played(track: Track, today: date | None = None) -> bool:
    today = today or date.today()
    return date.fromisoformat(track.date) <= today


def next_upcoming_round(today: date | None = None) -> int:
    today = today or date.today()
    for t in CALENDAR_2026:
        if not is_played(t, today):
            return t.round
    return CALENDAR_2026[-1].round  # season finished - default to the finale
