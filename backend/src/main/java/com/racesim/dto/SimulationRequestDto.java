package com.racesim.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record SimulationRequestDto(
        @NotNull Long raceId,
        @NotNull Long driverId,
        @NotEmpty @Valid List<PlannedStintDto> plannedStints,
        /** Optional: stationary pit time to assume for each stop, in seconds. Defaults to the driver's season-average if omitted. */
        Double assumedStationaryTimeSeconds
) {}
