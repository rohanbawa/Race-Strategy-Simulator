package com.racesim.dto;

public record PitStopDto(
        int stopNumber,
        int lap,
        double stationaryTimeSeconds,
        Double totalTimeLossSeconds
) {}
