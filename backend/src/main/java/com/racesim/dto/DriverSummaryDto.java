package com.racesim.dto;

public record DriverSummaryDto(
        Long id,
        String code,
        String fullName,
        String constructorName
) {}
