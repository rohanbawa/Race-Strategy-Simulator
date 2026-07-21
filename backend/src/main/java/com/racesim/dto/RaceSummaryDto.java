package com.racesim.dto;

import java.time.LocalDate;

public record RaceSummaryDto(
        Long id,
        int season,
        int round,
        String name,
        String circuitName,
        String country,
        LocalDate raceDate,
        Integer totalLaps
) {}
