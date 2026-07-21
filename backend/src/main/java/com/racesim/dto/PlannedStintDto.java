package com.racesim.dto;

import com.racesim.domain.TireCompound;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * One leg of a hypothetical strategy. lengthLaps is how long the driver stays out before
 * the next stop (or the flag, for the final stint). The simulation service clamps/fills
 * the final stint to the race's actual lap count so the person doesn't have to do the math.
 */
public record PlannedStintDto(
        @NotNull TireCompound compound,
        @Min(1) int lengthLaps
) {}
