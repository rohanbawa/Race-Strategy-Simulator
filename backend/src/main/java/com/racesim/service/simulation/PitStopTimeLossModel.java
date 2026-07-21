package com.racesim.service.simulation;

import org.springframework.stereotype.Component;

/**
 * Time lost by pitting, split into two components so callers can override just the
 * part they have an opinion about (e.g. "what if the crew does a 2.1s stop instead of 3.0s"):
 *
 *  - pitLaneDeltaSeconds: time lost to the speed-limited pit lane vs. staying on track at
 *    racing speed (entry/exit lane length dependent - a per-circuit constant).
 *  - stationaryTimeSeconds: time the car is stopped for the tire change itself.
 */
@Component
public class PitStopTimeLossModel {

    /** Used when a circuit has no recorded default pit lane loss. Roughly the F1 grid average. */
    public static final double FALLBACK_PIT_LANE_DELTA_SECONDS = 20.0;

    /** Used when no observed stationary time is available for a driver/team. */
    public static final double FALLBACK_STATIONARY_TIME_SECONDS = 2.6;

    public double totalTimeLossSeconds(Double circuitPitLaneDeltaSeconds, Double stationaryTimeSeconds) {
        double laneLoss = circuitPitLaneDeltaSeconds != null ? circuitPitLaneDeltaSeconds : FALLBACK_PIT_LANE_DELTA_SECONDS;
        double stopTime = stationaryTimeSeconds != null ? stationaryTimeSeconds : FALLBACK_STATIONARY_TIME_SECONDS;
        return laneLoss + stopTime;
    }
}
