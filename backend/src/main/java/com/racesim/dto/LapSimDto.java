package com.racesim.dto;

public record LapSimDto(
        int lap,
        double simulatedLapTimeSeconds,
        Double actualLapTimeSeconds,
        double cumulativeDeltaSeconds,
        boolean isPitLap
) {}
