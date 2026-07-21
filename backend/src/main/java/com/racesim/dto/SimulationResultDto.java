package com.racesim.dto;

import java.util.List;

public record SimulationResultDto(
        Long raceId,
        Long driverId,
        String driverCode,
        List<StintDto> plannedStints,
        List<LapSimDto> laps,
        double simulatedTotalTimeSeconds,
        Double actualTotalTimeSeconds,
        Double deltaSeconds, // simulated - actual; negative means the what-if strategy would have been faster
        int pitStopCount,
        /** False if some laps in this race are missing recorded actual times - actualTotalTimeSeconds is then a partial sum, not the full race. */
        boolean actualDataComplete,
        /**
         * Where the simulated total would rank against the field's actual race times (1 = fastest).
         * Approximate: assumes every other driver's actual pace is unchanged by this driver's what-if,
         * and only counts drivers who completed at least totalLaps - 1 laps (i.e. excludes clear retirements).
         * Null if there isn't enough classified field data in this race to rank against.
         */
        Integer projectedFinishPosition,
        /** The driver's actual finishing position in this race, for comparison against projectedFinishPosition. */
        Integer actualFinishPosition
) {}

