package com.racesim.service;

import com.racesim.domain.*;
import com.racesim.dto.*;
import com.racesim.repository.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RaceQueryService {

    private final RaceRepository raceRepository;
    private final DriverRepository driverRepository;
    private final StintRepository stintRepository;
    private final PitStopRepository pitStopRepository;
    private final LapTimeRepository lapTimeRepository;

    public RaceQueryService(RaceRepository raceRepository, DriverRepository driverRepository,
                             StintRepository stintRepository, PitStopRepository pitStopRepository,
                             LapTimeRepository lapTimeRepository) {
        this.raceRepository = raceRepository;
        this.driverRepository = driverRepository;
        this.stintRepository = stintRepository;
        this.pitStopRepository = pitStopRepository;
        this.lapTimeRepository = lapTimeRepository;
    }

    public List<RaceSummaryDto> listRaces() {
        return raceRepository.findAll().stream()
                .sorted(Comparator.comparing(Race::getSeason).thenComparing(Race::getRound))
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    public RaceDetailDto getRaceDetail(Long raceId) {
        Race race = raceRepository.findById(raceId)
                .orElseThrow(() -> new NoSuchElementException("Race " + raceId + " not found"));

        List<Long> driverIds = stintRepository.findByRaceIdOrderByDriverIdAscStintNumberAsc(raceId).stream()
                .map(s -> s.getDriver().getId())
                .distinct()
                .toList();

        List<DriverSummaryDto> drivers = driverIds.stream()
                .map(id -> driverRepository.findById(id).orElseThrow())
                .map(this::toDriverSummary)
                .collect(Collectors.toList());

        return new RaceDetailDto(toSummary(race), drivers);
    }

    public ActualStrategyDto getActualStrategy(Long raceId, Long driverId) {
        Race race = raceRepository.findById(raceId)
                .orElseThrow(() -> new NoSuchElementException("Race " + raceId + " not found"));
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new NoSuchElementException("Driver " + driverId + " not found"));

        List<StintDto> stints = stintRepository.findByRaceIdAndDriverIdOrderByStintNumberAsc(raceId, driverId).stream()
                .map(s -> new StintDto(s.getStintNumber(), s.getCompound(), s.getStartLap(), s.getEndLap(), s.getAvgLapTimeSeconds()))
                .collect(Collectors.toList());

        List<PitStopDto> pitStops = pitStopRepository.findByRaceIdAndDriverIdOrderByLapAsc(raceId, driverId).stream()
                .map(p -> new PitStopDto(p.getStopNumber(), p.getLap(), p.getStationaryTimeSeconds(), p.getTotalTimeLossSeconds()))
                .collect(Collectors.toList());

        List<LapTime> laps = lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(raceId, driverId);
        double totalTime = laps.stream().mapToDouble(LapTime::getLapTimeSeconds).sum();
        Integer finishPosition = laps.isEmpty() ? null : laps.get(laps.size() - 1).getPosition();

        return new ActualStrategyDto(raceId, driverId, driver.getCode(), stints, pitStops, totalTime, finishPosition);
    }

    private RaceSummaryDto toSummary(Race r) {
        return new RaceSummaryDto(r.getId(), r.getSeason(), r.getRound(), r.getName(), r.getCircuitName(),
                r.getCountry(), r.getRaceDate(), r.getTotalLaps());
    }

    private DriverSummaryDto toDriverSummary(Driver d) {
        return new DriverSummaryDto(d.getId(), d.getCode(), d.getFullName(), d.getConstructorName());
    }
}
