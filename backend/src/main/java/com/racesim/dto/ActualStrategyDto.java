package com.racesim.dto;

import java.util.List;

/** The strategy a driver actually ran in a given race - the baseline everything gets compared to. */
public record ActualStrategyDto(
        Long raceId,
        Long driverId,
        String driverCode,
        List<StintDto> stints,
        List<PitStopDto> pitStops,
        double totalRaceTimeSeconds,
        Integer finishPosition
) {}
