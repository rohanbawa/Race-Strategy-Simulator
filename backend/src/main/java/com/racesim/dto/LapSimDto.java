package com.racesim.dto;

public record LapSimDto(
        int lap,
        double simulatedLapTimeSeconds,
        Double actualLapTimeSeconds,
        double cumulativeDeltaSeconds,
        boolean isPitLap,
        /** "SC", "VSC", or null - see CautionPeriodDetectionService. A pit stop on this lap gets a reduced time loss. */
        String cautionType
) {}
