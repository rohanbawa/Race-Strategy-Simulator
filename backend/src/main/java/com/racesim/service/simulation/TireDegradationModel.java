package com.racesim.service.simulation;

import com.racesim.domain.TireCompound;
import org.springframework.stereotype.Component;

/**
 * Estimates lap time as a function of tire compound, tire age, and fuel load.
 *
 * This is deliberately a simple, explainable model rather than a fitted ML model -
 * it's meant to make the mechanics of an undercut/overcut visible, not to predict
 * real lap times to the hundredth of a second. Three effects are combined:
 *
 *  1. Compound offset: each compound's pace relative to the medium tire (see TireCompound).
 *  2. Linear degradation: seconds lost per lap of tire age, before the cliff.
 *  3. Cliff effect: once tire age passes the compound's cliffLap, degradation roughly
 *     triples for every lap beyond it, modeling graining/blistering falloff.
 *  4. Fuel effect: cars get faster as fuel burns off over the race distance
 *     (~0.035s/lap lighter is a commonly cited rough figure for modern F1 cars).
 */
@Component
public class TireDegradationModel {

    private static final double FUEL_EFFECT_PER_LAP_SECONDS = 0.035;
    private static final double CLIFF_MULTIPLIER = 3.0;

    /**
     * @param baseLapTimeSeconds the driver/car's underlying pace on a fresh medium tire, no fuel effect
     * @param compound           tire compound for this stint
     * @param tireAgeLaps        laps completed on this set of tires (0 = just fitted)
     * @param lapOfRace          1-indexed lap number within the race, used for the fuel effect
     * @param totalRaceLaps      total laps in the race, used to normalize the fuel effect
     */
    public double estimateLapTimeSeconds(double baseLapTimeSeconds, TireCompound compound,
                                          int tireAgeLaps, int lapOfRace, int totalRaceLaps) {
        double compoundOffset = compound.getPaceDeltaSeconds();
        double degradation = linearDegradation(compound, tireAgeLaps) + cliffPenalty(compound, tireAgeLaps);
        double fuelEffect = fuelCorrection(lapOfRace, totalRaceLaps);

        return baseLapTimeSeconds + compoundOffset + degradation + fuelEffect;
    }

    private double linearDegradation(TireCompound compound, int tireAgeLaps) {
        int lapsBeforeCliff = Math.min(tireAgeLaps, compound.getCliffLap());
        return lapsBeforeCliff * compound.getDegradationPerLap();
    }

    private double cliffPenalty(TireCompound compound, int tireAgeLaps) {
        int lapsPastCliff = Math.max(0, tireAgeLaps - compound.getCliffLap());
        if (lapsPastCliff == 0) return 0.0;
        return lapsPastCliff * compound.getDegradationPerLap() * CLIFF_MULTIPLIER;
    }

    /** Positive early in the race (heavy fuel = slower), trending to 0 at the end. */
    private double fuelCorrection(int lapOfRace, int totalRaceLaps) {
        if (totalRaceLaps <= 1) return 0.0;
        double lapsRemaining = totalRaceLaps - lapOfRace;
        return lapsRemaining * FUEL_EFFECT_PER_LAP_SECONDS;
    }
}
