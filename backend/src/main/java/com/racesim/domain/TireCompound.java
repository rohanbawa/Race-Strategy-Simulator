package com.racesim.domain;

/**
 * Dry-weather compounds. Each carries the rough real-world characteristics used
 * as defaults by the simulation engine when a track-specific model isn't available:
 *
 *  - paceDeltaSeconds: how much slower (+) or faster (-) than the C3/medium reference
 *    the compound is on a single fresh-tire lap.
 *  - degradationPerLap: seconds of lap-time lost per lap of tire age (linear approximation).
 *  - cliffLap: the lap of age at which degradation accelerates sharply ("falling off a cliff").
 */
public enum TireCompound {
    SOFT(-0.55, 0.085, 18),
    MEDIUM(0.0, 0.055, 28),
    HARD(0.45, 0.035, 40),
    INTERMEDIATE(3.5, 0.11, 15),
    WET(6.0, 0.09, 25);

    private final double paceDeltaSeconds;
    private final double degradationPerLap;
    private final int cliffLap;

    TireCompound(double paceDeltaSeconds, double degradationPerLap, int cliffLap) {
        this.paceDeltaSeconds = paceDeltaSeconds;
        this.degradationPerLap = degradationPerLap;
        this.cliffLap = cliffLap;
    }

    public double getPaceDeltaSeconds() {
        return paceDeltaSeconds;
    }

    public double getDegradationPerLap() {
        return degradationPerLap;
    }

    public int getCliffLap() {
        return cliffLap;
    }

    public boolean isSlick() {
        return this == SOFT || this == MEDIUM || this == HARD;
    }
}
