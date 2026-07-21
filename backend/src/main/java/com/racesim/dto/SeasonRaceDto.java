package com.racesim.dto;

import java.time.LocalDate;

/** One race on a season's calendar, as fetched live from Jolpica, cross-referenced against local ingestion state. */
public record SeasonRaceDto(
        int season,
        int round,
        String name,
        String circuitName,
        String country,
        LocalDate raceDate,
        boolean ingested,
        Long raceId
) {}
