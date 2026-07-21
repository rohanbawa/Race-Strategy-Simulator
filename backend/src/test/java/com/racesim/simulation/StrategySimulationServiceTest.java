package com.racesim.simulation;

import com.racesim.domain.*;
import com.racesim.dto.PlannedStintDto;
import com.racesim.dto.SimulationRequestDto;
import com.racesim.dto.SimulationResultDto;
import com.racesim.repository.*;
import com.racesim.service.simulation.PitStopTimeLossModel;
import com.racesim.service.simulation.StrategySimulationService;
import com.racesim.service.simulation.TireDegradationModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StrategySimulationServiceTest {

    @Mock private RaceRepository raceRepository;
    @Mock private DriverRepository driverRepository;
    @Mock private StintRepository stintRepository;
    @Mock private PitStopRepository pitStopRepository;
    @Mock private LapTimeRepository lapTimeRepository;

    private StrategySimulationService service;
    private Race race;
    private Driver driver;

    @BeforeEach
    void setUp() {
        service = new StrategySimulationService(raceRepository, driverRepository, stintRepository,
                pitStopRepository, lapTimeRepository, new TireDegradationModel(), new PitStopTimeLossModel());

        race = new Race();
        race.setId(1L);
        race.setTotalLaps(20);
        race.setDefaultPitLaneLossSeconds(20.0);

        driver = new Driver();
        driver.setId(1L);
        driver.setCode("VER");

        when(raceRepository.findById(1L)).thenReturn(Optional.of(race));
        when(driverRepository.findById(1L)).thenReturn(Optional.of(driver));
        when(pitStopRepository.findByRaceIdAndDriverIdOrderByLapAsc(anyLong(), anyLong())).thenReturn(List.of());
    }

    @Test
    void simulatedRaceCoversExactlyTotalLaps() {
        when(lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(1L, 1L)).thenReturn(List.of());
        when(stintRepository.findByRaceIdAndDriverIdOrderByStintNumberAsc(1L, 1L)).thenReturn(List.of());

        SimulationRequestDto request = new SimulationRequestDto(1L, 1L,
                List.of(new PlannedStintDto(TireCompound.MEDIUM, 12), new PlannedStintDto(TireCompound.HARD, 8)),
                null);

        SimulationResultDto result = service.simulate(request);

        assertThat(result.laps()).hasSize(20);
        assertThat(result.laps().get(19).lap()).isEqualTo(20);
    }

    @Test
    void oneStopStrategyRecordsExactlyOnePitLap() {
        when(lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(1L, 1L)).thenReturn(List.of());
        when(stintRepository.findByRaceIdAndDriverIdOrderByStintNumberAsc(1L, 1L)).thenReturn(List.of());

        SimulationRequestDto request = new SimulationRequestDto(1L, 1L,
                List.of(new PlannedStintDto(TireCompound.SOFT, 10), new PlannedStintDto(TireCompound.HARD, 10)),
                null);

        SimulationResultDto result = service.simulate(request);

        long pitLapCount = result.laps().stream().filter(l -> l.isPitLap()).count();
        assertThat(pitLapCount).isEqualTo(1);
        assertThat(result.pitStopCount()).isEqualTo(1);
        // Lap 10 is the last lap of the first stint - that's where the stop is recorded.
        assertThat(result.laps().get(9).isPitLap()).isTrue();
    }

    @Test
    void overLongPlanIsTruncatedToRaceDistance() {
        when(lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(1L, 1L)).thenReturn(List.of());
        when(stintRepository.findByRaceIdAndDriverIdOrderByStintNumberAsc(1L, 1L)).thenReturn(List.of());

        // Planned stints sum to 30 laps but the race is only 20.
        SimulationRequestDto request = new SimulationRequestDto(1L, 1L,
                List.of(new PlannedStintDto(TireCompound.MEDIUM, 15), new PlannedStintDto(TireCompound.HARD, 15)),
                null);

        SimulationResultDto result = service.simulate(request);

        assertThat(result.laps()).hasSize(20);
    }
}
