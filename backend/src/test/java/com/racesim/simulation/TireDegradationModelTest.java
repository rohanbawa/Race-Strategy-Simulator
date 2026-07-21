package com.racesim.simulation;

import com.racesim.domain.TireCompound;
import com.racesim.service.simulation.TireDegradationModel;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TireDegradationModelTest {

    private final TireDegradationModel model = new TireDegradationModel();

    @Test
    void freshSoftTireIsFasterThanFreshMedium() {
        double soft = model.estimateLapTimeSeconds(90.0, TireCompound.SOFT, 0, 1, 50);
        double medium = model.estimateLapTimeSeconds(90.0, TireCompound.MEDIUM, 0, 1, 50);

        assertThat(soft).isLessThan(medium);
    }

    @Test
    void degradationIncreasesLapTimeAsTireAges() {
        double lapAge0 = model.estimateLapTimeSeconds(90.0, TireCompound.MEDIUM, 0, 20, 50);
        double lapAge10 = model.estimateLapTimeSeconds(90.0, TireCompound.MEDIUM, 10, 20, 50);
        double lapAge25 = model.estimateLapTimeSeconds(90.0, TireCompound.MEDIUM, 25, 20, 50);

        assertThat(lapAge10).isGreaterThan(lapAge0);
        assertThat(lapAge25).isGreaterThan(lapAge10);
    }

    @Test
    void cliffAccelerementsDegradationPastCliffLap() {
        TireCompound soft = TireCompound.SOFT; // cliffLap = 18
        double justBeforeCliff = model.estimateLapTimeSeconds(90.0, soft, 17, 20, 50);
        double justAfterCliff = model.estimateLapTimeSeconds(90.0, soft, 19, 20, 50);

        double stepBeforeCliff = model.estimateLapTimeSeconds(90.0, soft, 17, 20, 50)
                - model.estimateLapTimeSeconds(90.0, soft, 16, 20, 50);
        double stepAfterCliff = justAfterCliff
                - model.estimateLapTimeSeconds(90.0, soft, 18, 20, 50);

        assertThat(stepAfterCliff).isGreaterThan(stepBeforeCliff);
        assertThat(justAfterCliff).isGreaterThan(justBeforeCliff);
    }

    @Test
    void fuelEffectMakesEarlyRaceLapsSlowerThanLateRaceLaps() {
        double earlyLap = model.estimateLapTimeSeconds(90.0, TireCompound.MEDIUM, 0, 1, 50);
        double lateLap = model.estimateLapTimeSeconds(90.0, TireCompound.MEDIUM, 0, 49, 50);

        assertThat(earlyLap).isGreaterThan(lateLap);
    }
}
