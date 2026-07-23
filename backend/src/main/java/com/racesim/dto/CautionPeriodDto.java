package com.racesim.dto;

/**
 * A heuristically detected safety car / VSC window for a race - see
 * {@link com.racesim.service.simulation.CautionPeriodDetectionService} for how it's derived.
 * {@code type} is a best guess ("SC" or "VSC"), not sourced from an official flag feed.
 */
public record CautionPeriodDto(
        int startLap,
        int endLap,
        String type,
        double fieldPaceSecondsPerLap,
        double baselinePaceSecondsPerLap,
        int driversAffected
) {}
