"""
The 2026 Formula 1 grid and the regulation constants that shape the model.

Everything the simulator and the ML feature builder need about *who is racing* and
*what the 2026 rules change* lives here, in one editable place. Ratings are on a
0-100 scale and are illustrative pre-season estimates, not results - tweak them and
the whole prediction pipeline updates.

2026 regulation changes reflected downstream (see REGULATIONS_2026):

  * New power units - 50/50 split between the internal-combustion engine and the
    electric motor (MGU-K up to ~350 kW), the MGU-H removed, running on 100%
    sustainable fuel. Which manufacturers nail the new PU is the single biggest
    performance variable, so every team carries a `pu_adaptation` rating.
  * Active aerodynamics - movable front and rear wings with a low-drag "X-mode"
    for straights and high-downforce "Z-mode" for corners, plus a "Manual Override"
    electrical boost that replaces DRS. Net effect: overtaking is easier, so raw
    pace matters more relative to track position than in 2025.
  * Smaller, lighter cars on narrower Pirelli tyres - reduced minimum weight and
    dimensions, which sharpens the effect of tyre-strategy offsets.
  * Grid expands to 11 teams / 22 cars: Audi takes over the Sauber entry and
    Cadillac joins as a brand-new 11th team, both of which start off the ultimate pace.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class Team:
    name: str
    power_unit: str
    # Underlying 2026 car performance, 0-100 (higher = faster car over a lap).
    car_rating: float
    # How well the team is expected to have adapted to the new 2026 power unit and
    # active-aero package, 0-1 (1 = fully on top of the new rules). Feeds a pace
    # penalty for teams still finding their feet with the new formula.
    pu_adaptation: float
    color: str


@dataclass(frozen=True)
class Driver:
    id: int
    code: str
    name: str
    team: str
    # Driver quality, 0-100 (racecraft + one-lap pace combined).
    driver_rating: float
    # Wet-weather skill, 0-1. Rain amplifies driver skill over car performance, and
    # some drivers gain far more from it than others.
    wet_skill: float


# --- 2026 regulation constants -------------------------------------------------
# These are the knobs the 2026 rulebook turns; the simulator reads them directly.

REGULATIONS_2026 = {
    "season": 2026,
    # Active aero + Manual Override make passing easier than the DRS era. 0 = track
    # position is everything (2021-style), 1 = grid slot is almost irrelevant.
    # 2026 pushes this notably higher than recent seasons.
    "overtaking_ease": 0.55,
    # Narrower tyres + lighter cars make tyre-strategy offsets bite a little harder.
    "tyre_sensitivity": 1.15,
    # New-formula reliability/adaptation spread: how much an imperfect power-unit
    # transition can cost a team over a race distance (seconds, at pu_adaptation=0).
    "pu_pace_spread": 2.4,
    "notes": [
        "50/50 combustion-electric power units (MGU-H removed, 100% sustainable fuel)",
        "Active front & rear aero: low-drag X-mode / high-downforce Z-mode",
        "Manual Override electrical boost replaces DRS - overtaking is easier",
        "Lighter cars on narrower Pirelli tyres sharpen tyre-offset strategy",
        "11 teams / 22 cars: Audi takes over Sauber, Cadillac debuts as the 11th team",
    ],
}


TEAMS_2026: List[Team] = [
    Team("McLaren",      "Mercedes", 95.0, 0.90, "#ff8000"),
    Team("Ferrari",      "Ferrari",  91.0, 0.82, "#e8002d"),
    Team("Mercedes",     "Mercedes", 90.0, 0.92, "#27f4d2"),
    Team("Red Bull",     "Red Bull-Ford", 89.0, 0.74, "#3671c6"),
    Team("Aston Martin", "Honda",    82.0, 0.85, "#229971"),
    Team("Williams",     "Mercedes", 79.0, 0.80, "#64c4ff"),
    Team("Alpine",       "Mercedes", 74.0, 0.78, "#0093cc"),
    Team("Racing Bulls", "Red Bull-Ford", 76.0, 0.72, "#6692ff"),
    Team("Haas",         "Ferrari",  72.0, 0.75, "#b6babd"),
    Team("Audi",         "Audi",     70.0, 0.68, "#00e701"),  # ex-Sauber, new works PU
    Team("Cadillac",     "Ferrari",  64.0, 0.60, "#e4002b"),  # brand-new 11th team
]


DRIVERS_2026: List[Driver] = [
    Driver(1,  "NOR", "Lando Norris",         "McLaren",      93.0, 0.86),
    Driver(2,  "PIA", "Oscar Piastri",        "McLaren",      92.0, 0.82),
    Driver(3,  "LEC", "Charles Leclerc",      "Ferrari",      92.0, 0.84),
    Driver(4,  "HAM", "Lewis Hamilton",       "Ferrari",      91.0, 0.94),
    Driver(5,  "RUS", "George Russell",       "Mercedes",     89.0, 0.83),
    Driver(6,  "ANT", "Kimi Antonelli",       "Mercedes",     81.0, 0.78),
    Driver(7,  "VER", "Max Verstappen",       "Red Bull",     98.0, 0.96),
    Driver(8,  "TSU", "Yuki Tsunoda",         "Red Bull",     80.0, 0.75),
    Driver(9,  "ALO", "Fernando Alonso",      "Aston Martin", 90.0, 0.92),
    Driver(10, "STR", "Lance Stroll",         "Aston Martin", 74.0, 0.70),
    Driver(11, "SAI", "Carlos Sainz",         "Williams",     88.0, 0.82),
    Driver(12, "ALB", "Alexander Albon",      "Williams",     83.0, 0.79),
    Driver(13, "GAS", "Pierre Gasly",         "Alpine",       82.0, 0.80),
    Driver(14, "COL", "Franco Colapinto",     "Alpine",       75.0, 0.73),
    Driver(15, "LAW", "Liam Lawson",          "Racing Bulls", 78.0, 0.74),
    Driver(16, "HAD", "Isack Hadjar",         "Racing Bulls", 77.0, 0.72),
    Driver(17, "OCO", "Esteban Ocon",         "Haas",         81.0, 0.77),
    Driver(18, "BEA", "Oliver Bearman",       "Haas",         76.0, 0.71),
    Driver(19, "HUL", "Nico Hulkenberg",      "Audi",         82.0, 0.81),
    Driver(20, "BOR", "Gabriel Bortoleto",    "Audi",         74.0, 0.70),
    Driver(21, "PER", "Sergio Perez",         "Cadillac",     84.0, 0.78),
    Driver(22, "BOT", "Valtteri Bottas",      "Cadillac",     80.0, 0.76),
]


_TEAM_BY_NAME = {t.name: t for t in TEAMS_2026}


def team_for(driver: Driver) -> Team:
    return _TEAM_BY_NAME[driver.team]


@dataclass
class Entrant:
    """A driver joined to their car - the unit the simulator and model reason over."""

    driver: Driver
    team: Team

    @property
    def id(self) -> int:
        return self.driver.id

    @property
    def code(self) -> str:
        return self.driver.code


def entrants() -> List[Entrant]:
    return [Entrant(d, team_for(d)) for d in DRIVERS_2026]
