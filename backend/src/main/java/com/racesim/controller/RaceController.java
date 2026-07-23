package com.racesim.controller;

import com.racesim.dto.ActualStrategyDto;
import com.racesim.dto.CautionPeriodDto;
import com.racesim.dto.RaceDetailDto;
import com.racesim.dto.RaceSummaryDto;
import com.racesim.service.RaceQueryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/races")
public class RaceController {

    private final RaceQueryService raceQueryService;

    public RaceController(RaceQueryService raceQueryService) {
        this.raceQueryService = raceQueryService;
    }

    @GetMapping
    public List<RaceSummaryDto> listRaces() {
        return raceQueryService.listRaces();
    }

    @GetMapping("/{raceId}")
    public RaceDetailDto getRace(@PathVariable Long raceId) {
        return raceQueryService.getRaceDetail(raceId);
    }

    @GetMapping("/{raceId}/drivers/{driverId}/actual-strategy")
    public ActualStrategyDto getActualStrategy(@PathVariable Long raceId, @PathVariable Long driverId) {
        return raceQueryService.getActualStrategy(raceId, driverId);
    }

    /** Heuristically detected safety car / VSC windows for this race - see CautionPeriodDetectionService. */
    @GetMapping("/{raceId}/caution-periods")
    public List<CautionPeriodDto> getCautionPeriods(@PathVariable Long raceId) {
        return raceQueryService.getCautionPeriods(raceId);
    }
}
