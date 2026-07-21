package com.racesim.controller;

import com.racesim.dto.SimulationRequestDto;
import com.racesim.dto.SimulationResultDto;
import com.racesim.dto.UndercutRequestDto;
import com.racesim.dto.UndercutResultDto;
import com.racesim.service.simulation.StrategySimulationService;
import com.racesim.service.simulation.UndercutOvercutCalculator;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/simulate")
public class SimulationController {

    private final StrategySimulationService simulationService;
    private final UndercutOvercutCalculator undercutOvercutCalculator;

    public SimulationController(StrategySimulationService simulationService,
                                 UndercutOvercutCalculator undercutOvercutCalculator) {
        this.simulationService = simulationService;
        this.undercutOvercutCalculator = undercutOvercutCalculator;
    }

    /** Runs a full hypothetical strategy (compound + stint length sequence) and compares it lap-by-lap to what actually happened. */
    @PostMapping
    public SimulationResultDto simulate(@Valid @RequestBody SimulationRequestDto request) {
        return simulationService.simulate(request);
    }

    /** Evaluates whether pitting on a given lap would undercut (or overcut) a named rival. */
    @PostMapping("/undercut")
    public UndercutResultDto evaluateUndercut(@Valid @RequestBody UndercutRequestDto request) {
        return undercutOvercutCalculator.evaluate(request);
    }
}
