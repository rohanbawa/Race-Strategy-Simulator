package com.racesim.dto;

public record UndercutResultDto(
        Long raceId,
        String attackingDriverCode,
        String defendingDriverCode,
        int attackingPitLap,
        int defendingActualPitLap,
        double gapAtAttackingPitLapSeconds,   // positive: attacker is behind by this much before pitting
        double gapAfterSequenceSeconds,       // positive: attacker still behind after both have stopped; negative: attacker ahead
        boolean undercutSucceeds,
        double marginSeconds                 // magnitude of the swing, always >= 0
) {}
