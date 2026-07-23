package com.racesim.service.simulation;

import com.racesim.domain.LapTime;
import com.racesim.dto.CautionPeriodDto;
import com.racesim.repository.LapTimeRepository;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Heuristically detects safety car / VSC windows from lap time data alone - Jolpica doesn't
 * flag these directly, and OpenF1's session-status feed isn't ingested. A lap counts as
 * "elevated" for a driver if it's at least {@link #ELEVATED_THRESHOLD} slower than that driver's
 * own median race pace (their own median, not a fixed number, since pace varies hugely by
 * car/circuit). A lap is flagged as a caution candidate only if a majority of the field posts an
 * elevated lap simultaneously - one driver's slow lap is traffic, a mistake, or their own pit
 * lane transit; the whole field slowing down together means the track is neutralized.
 * Consecutive candidate laps are merged into a single window.
 *
 * Windows are labeled a rough best guess of SC vs VSC: a single-lap window is called "VSC" (a
 * Virtual Safety Car imposes a lap-time delta without physically bunching the pack, and often
 * clears within a lap), anything longer is called "SC" (a physical Safety Car needs a lap or two
 * to gather the leader before the restart). This is a proportional guess for suggesting "pit
 * here instead," not a claim about what officially happened.
 */
@Component
public class CautionPeriodDetectionService {

    static final double ELEVATED_THRESHOLD = 0.30;
    static final double FIELD_CONSENSUS_FRACTION = 0.5;
    static final int MIN_DRIVERS_ON_LAP = 5;

    private final LapTimeRepository lapTimeRepository;

    public CautionPeriodDetectionService(LapTimeRepository lapTimeRepository) {
        this.lapTimeRepository = lapTimeRepository;
    }

    public List<CautionPeriodDto> detect(Long raceId) {
        List<LapTime> allLaps = lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(raceId);
        if (allLaps.isEmpty()) return List.of();

        Map<Long, Double> baselineByDriver = computeBaselines(allLaps);
        Map<Integer, List<LapTime>> lapsByLapNumber = allLaps.stream()
                .filter(lt -> lt.getLap() > 1) // lap 1 is a standing start, not comparable field-wide
                .collect(Collectors.groupingBy(LapTime::getLap));

        SortedSet<Integer> candidateLaps = new TreeSet<>();
        for (Map.Entry<Integer, List<LapTime>> entry : lapsByLapNumber.entrySet()) {
            List<LapTime> lapsThisLap = entry.getValue();
            if (lapsThisLap.size() < MIN_DRIVERS_ON_LAP) continue;

            long elevatedCount = lapsThisLap.stream().filter(lt -> isElevated(lt, baselineByDriver)).count();
            if ((double) elevatedCount / lapsThisLap.size() >= FIELD_CONSENSUS_FRACTION) {
                candidateLaps.add(entry.getKey());
            }
        }

        return mergeIntoWindows(candidateLaps, lapsByLapNumber, baselineByDriver);
    }

    private boolean isElevated(LapTime lt, Map<Long, Double> baselineByDriver) {
        Double baseline = baselineByDriver.get(lt.getDriver().getId());
        return baseline != null && baseline > 0 && lt.getLapTimeSeconds() >= baseline * (1 + ELEVATED_THRESHOLD);
    }

    /** Each driver's own median lap time (excluding lap 1) stands in for their "clean" pace. */
    private Map<Long, Double> computeBaselines(List<LapTime> allLaps) {
        Map<Long, List<Double>> byDriver = new HashMap<>();
        for (LapTime lt : allLaps) {
            if (lt.getLap() == 1) continue;
            byDriver.computeIfAbsent(lt.getDriver().getId(), k -> new ArrayList<>()).add(lt.getLapTimeSeconds());
        }
        Map<Long, Double> baselines = new HashMap<>();
        for (Map.Entry<Long, List<Double>> entry : byDriver.entrySet()) {
            baselines.put(entry.getKey(), median(entry.getValue()));
        }
        return baselines;
    }

    private List<CautionPeriodDto> mergeIntoWindows(SortedSet<Integer> candidateLaps,
                                                      Map<Integer, List<LapTime>> lapsByLapNumber,
                                                      Map<Long, Double> baselineByDriver) {
        List<CautionPeriodDto> windows = new ArrayList<>();
        Integer windowStart = null;
        Integer windowEnd = null;

        for (int lap : candidateLaps) {
            if (windowStart == null) {
                windowStart = lap;
                windowEnd = lap;
            } else if (lap == windowEnd + 1) {
                windowEnd = lap;
            } else {
                windows.add(buildWindow(windowStart, windowEnd, lapsByLapNumber, baselineByDriver));
                windowStart = lap;
                windowEnd = lap;
            }
        }
        if (windowStart != null) {
            windows.add(buildWindow(windowStart, windowEnd, lapsByLapNumber, baselineByDriver));
        }
        return windows;
    }

    private CautionPeriodDto buildWindow(int start, int end, Map<Integer, List<LapTime>> lapsByLapNumber,
                                          Map<Long, Double> baselineByDriver) {
        List<Double> fieldTimes = new ArrayList<>();
        List<Double> baselines = new ArrayList<>();
        int maxDrivers = 0;
        for (int lap = start; lap <= end; lap++) {
            List<LapTime> lapsThisLap = lapsByLapNumber.getOrDefault(lap, List.of());
            maxDrivers = Math.max(maxDrivers, lapsThisLap.size());
            for (LapTime lt : lapsThisLap) {
                fieldTimes.add(lt.getLapTimeSeconds());
                Double baseline = baselineByDriver.get(lt.getDriver().getId());
                if (baseline != null) baselines.add(baseline);
            }
        }
        double fieldPace = median(fieldTimes);
        double baselinePace = median(baselines);
        String type = (end - start + 1) <= 1 ? "VSC" : "SC";
        return new CautionPeriodDto(start, end, type, round2(fieldPace), round2(baselinePace), maxDrivers);
    }

    private double median(List<Double> values) {
        if (values.isEmpty()) return 0.0;
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 0 ? (sorted.get(mid - 1) + sorted.get(mid)) / 2.0 : sorted.get(mid);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
