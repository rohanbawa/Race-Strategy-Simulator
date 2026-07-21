package com.racesim.service.simulation;

import com.racesim.domain.*;
import com.racesim.dto.UndercutRequestDto;
import com.racesim.dto.UndercutResultDto;
import com.racesim.repository.*;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * Models the classic "undercut" question: if the attacking driver pits on a given lap
 * (earlier than the defender), do they emerge ahead once the defender has also stopped?
 *
 * The mechanism being modeled: the attacker loses pit-lane + stationary time immediately,
 * but gains fresh-tire pace for every lap before the defender also stops. The defender,
 * meanwhile, keeps track position but is running on aging tires. Whoever's cumulative time
 * from the attacker's pit lap to the defender's pit lap (inclusive of both pit losses) is
 * lower ends up ahead - that's the "undercut window".
 */
@Service
public class UndercutOvercutCalculator {

    private final RaceRepository raceRepository;
    private final DriverRepository driverRepository;
    private final StintRepository stintRepository;
    private final LapTimeRepository lapTimeRepository;
    private final TireDegradationModel tireDegradationModel;
    private final PitStopTimeLossModel pitStopTimeLossModel;

    public UndercutOvercutCalculator(RaceRepository raceRepository, DriverRepository driverRepository,
                                      StintRepository stintRepository, LapTimeRepository lapTimeRepository,
                                      TireDegradationModel tireDegradationModel, PitStopTimeLossModel pitStopTimeLossModel) {
        this.raceRepository = raceRepository;
        this.driverRepository = driverRepository;
        this.stintRepository = stintRepository;
        this.lapTimeRepository = lapTimeRepository;
        this.tireDegradationModel = tireDegradationModel;
        this.pitStopTimeLossModel = pitStopTimeLossModel;
    }

    public UndercutResultDto evaluate(UndercutRequestDto request) {
        Race race = raceRepository.findById(request.raceId())
                .orElseThrow(() -> new NoSuchElementException("Race " + request.raceId() + " not found"));
        Driver attacker = driverRepository.findById(request.attackingDriverId())
                .orElseThrow(() -> new NoSuchElementException("Attacking driver not found"));
        Driver defender = driverRepository.findById(request.defendingDriverId())
                .orElseThrow(() -> new NoSuchElementException("Defending driver not found"));

        int totalLaps = race.getTotalLaps() != null ? race.getTotalLaps() : 60;

        List<Stint> defenderStints = stintRepository.findByRaceIdAndDriverIdOrderByStintNumberAsc(race.getId(), defender.getId());
        int defenderPitLap = defenderStints.stream()
                .filter(s -> s.getStintNumber() > 1)
                .findFirst()
                .map(Stint::getStartLap)
                .map(startLap -> startLap - 1)
                .orElse(request.attackingPitLap() + 1);

        double gapBefore = observedGapAtLap(race.getId(), defender.getId(), attacker.getId(), request.attackingPitLap());

        TireCompound defenderCompoundAtWindow = defenderStints.isEmpty() ? TireCompound.MEDIUM
                : defenderStints.get(0).getCompound();

        double attackerPace = 0.0;
        double defenderPace = 0.0;
        int windowStart = Math.min(request.attackingPitLap(), defenderPitLap);
        int windowEnd = Math.max(request.attackingPitLap(), defenderPitLap);

        // Attacker: pits at attackingPitLap on fresh `attackingCompound`, then runs to windowEnd.
        for (int lap = windowStart; lap <= windowEnd; lap++) {
            if (lap == request.attackingPitLap()) {
                attackerPace += pitStopTimeLossModel.totalTimeLossSeconds(race.getDefaultPitLaneLossSeconds(), null);
            }
            int tireAge = Math.max(0, lap - request.attackingPitLap());
            attackerPace += tireDegradationModel.estimateLapTimeSeconds(90.0, request.attackingCompound(), tireAge, lap, totalLaps);
        }

        // Defender: stays out on aging original-stint tires until defenderPitLap, then (if within window) pits too.
        for (int lap = windowStart; lap <= windowEnd; lap++) {
            if (lap == defenderPitLap) {
                defenderPace += pitStopTimeLossModel.totalTimeLossSeconds(race.getDefaultPitLaneLossSeconds(), null);
            }
            int tireAge = lap <= defenderPitLap
                    ? lap - (defenderStints.isEmpty() ? 1 : defenderStints.get(0).getStartLap())
                    : lap - defenderPitLap;
            TireCompound compound = lap <= defenderPitLap ? defenderCompoundAtWindow
                    : (defenderStints.size() > 1 ? defenderStints.get(1).getCompound() : TireCompound.MEDIUM);
            defenderPace += tireDegradationModel.estimateLapTimeSeconds(90.0, compound, Math.max(tireAge, 0), lap, totalLaps);
        }

        double gapAfter = gapBefore + (attackerPace - defenderPace);
        boolean succeeds = gapAfter < 0;

        return new UndercutResultDto(
                race.getId(),
                attacker.getCode(),
                defender.getCode(),
                request.attackingPitLap(),
                defenderPitLap,
                round2(gapBefore),
                round2(gapAfter),
                succeeds,
                round2(Math.abs(gapAfter))
        );
    }

    /** Positive = attacker is this many seconds behind the defender at the given lap, based on recorded race data. */
    private double observedGapAtLap(Long raceId, Long defenderId, Long attackerId, int lap) {
        double defenderCumulative = cumulativeTimeThroughLap(raceId, defenderId, lap);
        double attackerCumulative = cumulativeTimeThroughLap(raceId, attackerId, lap);
        return attackerCumulative - defenderCumulative;
    }

    private double cumulativeTimeThroughLap(Long raceId, Long driverId, int lap) {
        return lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(raceId, driverId).stream()
                .filter(lt -> lt.getLap() <= lap)
                .mapToDouble(LapTime::getLapTimeSeconds)
                .sum();
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
