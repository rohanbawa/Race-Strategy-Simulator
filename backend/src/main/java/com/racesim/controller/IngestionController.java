package com.racesim.controller;

import com.racesim.domain.Race;
import com.racesim.dto.RaceSummaryDto;
import com.racesim.dto.SeasonRaceDto;
import com.racesim.service.RaceIngestionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin-style endpoint to pull a race in from Jolpica + OpenF1 on demand. In a production
 * build this would be a scheduled job or a protected internal endpoint rather than open POST -
 * it's left simple here since seeding data is a one-off, deliberate action for this project.
 */
@RestController
@RequestMapping("/api/ingest")
public class IngestionController {

    private final RaceIngestionService ingestionService;

    public IngestionController(RaceIngestionService ingestionService) {
        this.ingestionService = ingestionService;
    }

    /** Live season calendar (round, name, circuit, ingestion status) - lets the frontend drive Year/Race dropdowns without a manual ingest call. */
    @GetMapping("/{season}/calendar")
    public List<SeasonRaceDto> calendar(@PathVariable int season) {
        return ingestionService.getSeasonCalendar(season);
    }

    @PostMapping("/{season}/{round}")
    public RaceSummaryDto ingest(@PathVariable int season, @PathVariable int round) {
        Race race = ingestionService.ingestRace(season, round);
        return new RaceSummaryDto(race.getId(), race.getSeason(), race.getRound(), race.getName(),
                race.getCircuitName(), race.getCountry(), race.getRaceDate(), race.getTotalLaps());
    }
}
