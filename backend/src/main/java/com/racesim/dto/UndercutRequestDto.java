package com.racesim.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UndercutRequestDto(
        @NotNull Long raceId,
        @NotNull Long attackingDriverId,
        @NotNull Long defendingDriverId,
        /** The lap the attacking driver pits on, in this hypothetical (their actual out-lap compound is reused). */
        @Min(1) int attackingPitLap,
        /** Compound the attacker fits at this stop. */
        com.racesim.domain.TireCompound attackingCompound
) {}
