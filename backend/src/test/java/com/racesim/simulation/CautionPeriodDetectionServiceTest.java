package com.racesim.simulation;

import com.racesim.domain.Driver;
import com.racesim.domain.LapTime;
import com.racesim.dto.CautionPeriodDto;
import com.racesim.repository.LapTimeRepository;
import com.racesim.service.simulation.CautionPeriodDetectionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CautionPeriodDetectionServiceTest {

    private static final int FIELD_SIZE = 6;

    @Mock private LapTimeRepository lapTimeRepository;

    private CautionPeriodDetectionService service;

    @Test
    void noCautionWhenFieldPaceIsConsistent() {
        service = new CautionPeriodDetectionService(lapTimeRepository);
        when(lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(1L)).thenReturn(fieldLaps(20, List.of()));

        assertThat(service.detect(1L)).isEmpty();
    }

    @Test
    void detectsAMultiLapWindowAsSafetyCar() {
        service = new CautionPeriodDetectionService(lapTimeRepository);
        when(lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(1L)).thenReturn(fieldLaps(20, List.of(10, 11, 12)));

        List<CautionPeriodDto> periods = service.detect(1L);

        assertThat(periods).hasSize(1);
        CautionPeriodDto period = periods.get(0);
        assertThat(period.startLap()).isEqualTo(10);
        assertThat(period.endLap()).isEqualTo(12);
        assertThat(period.type()).isEqualTo("SC");
    }

    @Test
    void detectsASingleLapWindowAsVsc() {
        service = new CautionPeriodDetectionService(lapTimeRepository);
        when(lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(1L)).thenReturn(fieldLaps(20, List.of(15)));

        List<CautionPeriodDto> periods = service.detect(1L);

        assertThat(periods).hasSize(1);
        assertThat(periods.get(0).type()).isEqualTo("VSC");
    }

    @Test
    void oneDriversSlowLapIsNotFlaggedAsCaution() {
        service = new CautionPeriodDetectionService(lapTimeRepository);

        List<LapTime> laps = new ArrayList<>(fieldLaps(20, List.of()));
        // Driver 1 alone has a bad lap (e.g. a spin) - the rest of the field is unaffected.
        laps.stream()
                .filter(lt -> lt.getDriver().getId() == 1L && lt.getLap() == 8)
                .findFirst()
                .ifPresent(lt -> lt.setLapTimeSeconds(140.0));

        when(lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(1L)).thenReturn(laps);

        assertThat(service.detect(1L)).isEmpty();
    }

    @Test
    void tooFewDriversOnALapIsIgnoredEvenIfAllAreSlow() {
        service = new CautionPeriodDetectionService(lapTimeRepository);

        List<LapTime> laps = new ArrayList<>();
        for (long driverId = 1; driverId <= 3; driverId++) { // below MIN_DRIVERS_ON_LAP
            Driver d = new Driver();
            d.setId(driverId);
            for (int lap = 2; lap <= 20; lap++) {
                double time = lap == 10 ? 130.0 : 90.0;
                laps.add(lapTime(d, lap, time));
            }
        }
        when(lapTimeRepository.findByRaceIdOrderByDriverIdAscLapAsc(1L)).thenReturn(laps);

        assertThat(service.detect(1L)).isEmpty();
    }

    /** Every driver runs a flat 90s pace, except on any lap in {@code cautionLaps} where the whole field goes to 118s (~31% slower). */
    private List<LapTime> fieldLaps(int totalLaps, List<Integer> cautionLaps) {
        List<LapTime> laps = new ArrayList<>();
        for (long driverId = 1; driverId <= FIELD_SIZE; driverId++) {
            Driver d = new Driver();
            d.setId(driverId);
            for (int lap = 2; lap <= totalLaps; lap++) {
                double time = cautionLaps.contains(lap) ? 118.0 : 90.0;
                laps.add(lapTime(d, lap, time));
            }
        }
        return laps;
    }

    private LapTime lapTime(Driver driver, int lap, double seconds) {
        LapTime lt = new LapTime();
        lt.setDriver(driver);
        lt.setLap(lap);
        lt.setLapTimeSeconds(seconds);
        return lt;
    }
}
