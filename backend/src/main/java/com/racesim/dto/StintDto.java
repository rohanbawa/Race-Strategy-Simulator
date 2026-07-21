package com.racesim.dto;

import com.racesim.domain.TireCompound;

public record StintDto(
        int stintNumber,
        TireCompound compound,
        int startLap,
        int endLap,
        Double avgLapTimeSeconds
) {}
