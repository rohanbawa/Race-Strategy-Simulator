package com.racesim.repository;

import com.racesim.domain.LapTime;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LapTimeRepository extends JpaRepository<LapTime, Long> {
    List<LapTime> findByRaceIdAndDriverIdOrderByLapAsc(Long raceId, Long driverId);
    List<LapTime> findByRaceIdOrderByDriverIdAscLapAsc(Long raceId);
}
