package com.racesim.service.simulation;

import com.racesim.domain.*;
import com.racesim.dto.*;
import com.racesim.repository.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class StrategySimulationService {

    private final RaceRepository raceRepository;
    private final DriverRepository driverRepository;
    private final StintRepository stintRepository;
    private final PitStopRepository pitStopRepository;
    private final LapTimeRepository lapTimeRepository;
    private final TireDegradationModel tireDegradationModel;
    private final PitStopTimeLossModel pitStopTimeLossModel;

    public StrategySimulationService(RaceRepository raceRepository, DriverRepository driverRepository,
                                      StintRepository stintRepository, PitStopRepository pitStopRepository,
                                      LapTimeRepository lapTimeRepository, TireDegradationModel tireDegradationModel,
                                      PitStopTimeLossModel pitStopTimeLossModel) {
        this.raceRepository = raceRepository;
        this.driverRepository = driverRepository;
        this.stintRepository = stintRepository;
        this.pitStopRepository = pitStopRepository;
        this.lapTimeRepository = lapTimeRepository;
        this.tireDegradationModel = tireDegradationModel;
        this.pitStopTimeLossModel = pitStopTimeLossModel;
    }

    public SimulationResultDto simulate(SimulationRequestDto request) {
        Race race = raceRepository.findById(request.raceId())
                .orElseThrow(() -> new NoSuchElementException("Race " + request.raceId() + " not found"));
        Driver driver = driverRepository.findById(request.driverId())
                .orElseThrow(() -> new NoSuchElementException("Driver " + request.driverId() + " not found"));

        int totalLaps = race.getTotalLaps() != null ? race.getTotalLaps() : impliedLapCount(race, driver);

        List<LapTime> actualLaps = lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(race.getId(), driver.getId());
        List<Stint> actualStints = stintRepository.findByRaceIdAndDriverIdOrderByStintNumberAsc(race.getId(), driver.getId());
        Map<Integer, Double> actualByLap = new HashMap<>();
        for (LapTime lt : actualLaps) actualByLap.put(lt.getLap(), lt.getLapTimeSeconds());

        double basePace = calibrateBasePace(actualLaps, actualStints, totalLaps);

        List<PlannedStintDto> normalizedPlan = normalizeStintLengths(request.plannedStints(), totalLaps);
        Set<Integer> pitLaps = pitLapsFor(normalizedPlan);

        List<LapSimDto> laps = new ArrayList<>();
        double cumulativeSim = 0.0;
        double cumulativeActual = 0.0;
        double lastKnownDelta = 0.0;
        boolean actualDataComplete = true;
        int lap = 1;

        for (PlannedStintDto stint : normalizedPlan) {
            for (int tireAge = 0; tireAge < stint.lengthLaps() && lap <= totalLaps; tireAge++, lap++) {
                double simLapTime = tireDegradationModel.estimateLapTimeSeconds(
                        basePace, stint.compound(), tireAge, lap, totalLaps);

                boolean isPitLap = pitLaps.contains(lap);
                if (isPitLap) {
                    simLapTime += pitStopTimeLossModel.totalTimeLossSeconds(
                            race.getDefaultPitLaneLossSeconds(), request.assumedStationaryTimeSeconds());
                }

                cumulativeSim += simLapTime;

                Double actualLapTime = actualByLap.get(lap);
                if (actualLapTime == null) {
                    actualDataComplete = false;
                } else {
                    cumulativeActual += actualLapTime;
                    lastKnownDelta = cumulativeSim - cumulativeActual;
                }

                laps.add(new LapSimDto(
                        lap,
                        round2(simLapTime),
                        actualLapTime,
                        round2(lastKnownDelta),
                        isPitLap
                ));
            }
        }

        Double actualTotal = actualLaps.isEmpty() ? null : round2(cumulativeActual);
        Double delta = actualTotal != null ? round2(cumulativeSim - actualTotal) : null;

        List<StintDto> plannedStintDtos = toStintDtos(normalizedPlan);

        Integer projectedPosition = actualDataComplete
                ? projectFinishPosition(race.getId(), driver.getId(), cumulativeSim, totalLaps)
                : null; // ranking a partial total against other drivers' full totals isn't meaningful

        Integer actualFinishPosition = actualLaps.isEmpty() ? null : actualLaps.get(actualLaps.size() - 1).getPosition();

        return new SimulationResultDto(
                race.getId(),
                driver.getId(),
                driver.getCode(),
                plannedStintDtos,
                laps,
                round2(cumulativeSim),
                actualTotal,
                delta,
                pitLaps.size(),
                actualDataComplete,
                projectedPosition,
                actualFinishPosition
        );
    }

    /**
     * Ranks a hypothetical total race time against the field's actual total times, to give a
     * rough "you'd have finished Pn" answer. Deliberately simple: it assumes every other driver's
     * pace is unaffected by this driver's what-if (no traffic/blocking modeling), and only ranks
     * against drivers who completed at least totalLaps - 1 laps, as a proxy for "classified"
     * finishers vs. retirements (we don't currently ingest official race status).
     */
    private Integer projectFinishPosition(Long raceId, Long driverId, double simulatedTotal, int totalLaps) {
        List<LapTime> allLaps = lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(raceId);
        if (allLaps.isEmpty()) return null;

        Map<Long, Double> totalByDriver = new HashMap<>();
        Map<Long, Integer> maxLapByDriver = new HashMap<>();
        for (LapTime lt : allLaps) {
            Long id = lt.getDriver().getId();
            totalByDriver.merge(id, lt.getLapTimeSeconds(), Double::sum);
            maxLapByDriver.merge(id, lt.getLap(), Math::max);
        }

        List<Double> classifiedTimes = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : totalByDriver.entrySet()) {
            if (entry.getKey().equals(driverId)) continue; // the simulated total replaces this driver's own actual total
            int maxLap = maxLapByDriver.getOrDefault(entry.getKey(), 0);
            if (maxLap >= totalLaps - 1) {
                classifiedTimes.add(entry.getValue());
            }
        }
        if (classifiedTimes.isEmpty()) return null;

        classifiedTimes.add(simulatedTotal);
        Collections.sort(classifiedTimes);
        return classifiedTimes.indexOf(simulatedTotal) + 1;
    }

    /**
     * Backs out an approximate "clean, fresh-tire, zero-fuel-effect" pace from the driver's
     * actually recorded lap times, so the simulator's compound/degradation/fuel model has a
     * realistic starting point for this specific driver at this specific circuit.
     *
     * Uses the median of per-lap normalized paces (actual lap time with the model's own
     * compound/degradation/fuel corrections subtracted back out) rather than the mean, since
     * traffic, safety cars, and in/out laps create outliers that would otherwise skew a simple
     * average.
     */
    private double calibrateBasePace(List<LapTime> actualLaps, List<Stint> actualStints, int totalLaps) {
        if (actualLaps.isEmpty() || actualStints.isEmpty()) {
            return 90.0; // generic fallback pace when no historical data exists for this driver/race
        }

        List<Double> normalizedPaces = new ArrayList<>();
        for (LapTime lt : actualLaps) {
            Stint stint = findStintForLap(actualStints, lt.getLap());
            if (stint == null) continue;
            // Skip the lap immediately after pitting - out-laps are run at reduced pace and would
            // bias the calibration slow.
            if (lt.getLap() == stint.getStartLap() && stint.getStintNumber() > 1) continue;

            int tireAge = lt.getLap() - stint.getStartLap();
            double compoundOffset = stint.getCompound().getPaceDeltaSeconds();
            double degradation = tireDegradationModel.estimateLapTimeSeconds(0, stint.getCompound(), tireAge, lt.getLap(), totalLaps)
                    - compoundOffset
                    - fuelOnlyCorrection(lt.getLap(), totalLaps);
            double fuelCorrection = fuelOnlyCorrection(lt.getLap(), totalLaps);

            double normalized = lt.getLapTimeSeconds() - compoundOffset - degradation - fuelCorrection;
            normalizedPaces.add(normalized);
        }

        if (normalizedPaces.isEmpty()) return 90.0;
        Collections.sort(normalizedPaces);
        int mid = normalizedPaces.size() / 2;
        return normalizedPaces.size() % 2 == 0
                ? (normalizedPaces.get(mid - 1) + normalizedPaces.get(mid)) / 2.0
                : normalizedPaces.get(mid);
    }

    private double fuelOnlyCorrection(int lap, int totalLaps) {
        return tireDegradationModel.estimateLapTimeSeconds(0, TireCompound.MEDIUM, 0, lap, totalLaps)
                - TireCompound.MEDIUM.getPaceDeltaSeconds();
    }

    private Stint findStintForLap(List<Stint> stints, int lap) {
        for (Stint s : stints) {
            if (lap >= s.getStartLap() && lap <= s.getEndLap()) return s;
        }
        return null;
    }

    /** Ensures planned stint lengths sum exactly to totalLaps: pads or truncates the final stint. */
    private List<PlannedStintDto> normalizeStintLengths(List<PlannedStintDto> requested, int totalLaps) {
        List<PlannedStintDto> result = new ArrayList<>();
        int running = 0;
        for (PlannedStintDto stint : requested) {
            if (running >= totalLaps) break;
            int remaining = totalLaps - running;
            int length = Math.min(stint.lengthLaps(), remaining);
            result.add(new PlannedStintDto(stint.compound(), length));
            running += length;
        }
        if (running < totalLaps && !result.isEmpty()) {
            PlannedStintDto last = result.get(result.size() - 1);
            result.set(result.size() - 1, new PlannedStintDto(last.compound(), last.lengthLaps() + (totalLaps - running)));
        }
        return result;
    }

    private Set<Integer> pitLapsFor(List<PlannedStintDto> plan) {
        Set<Integer> pitLaps = new LinkedHashSet<>();
        int lap = 0;
        for (int i = 0; i < plan.size() - 1; i++) {
            lap += plan.get(i).lengthLaps();
            pitLaps.add(lap); // pit happens on the last lap of the stint being ended
        }
        return pitLaps;
    }

    private List<StintDto> toStintDtos(List<PlannedStintDto> plan) {
        List<StintDto> dtos = new ArrayList<>();
        int start = 1;
        int stintNumber = 1;
        for (PlannedStintDto p : plan) {
            int end = start + p.lengthLaps() - 1;
            dtos.add(new StintDto(stintNumber++, p.compound(), start, end, null));
            start = end + 1;
        }
        return dtos;
    }

    private int impliedLapCount(Race race, Driver driver) {
        return lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(race.getId(), driver.getId())
                .stream().mapToInt(LapTime::getLap).max().orElse(0);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
