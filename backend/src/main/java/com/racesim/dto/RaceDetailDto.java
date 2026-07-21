package com.racesim.dto;

import java.util.List;

public record RaceDetailDto(
        RaceSummaryDto race,
        List<DriverSummaryDto> drivers
) {}
