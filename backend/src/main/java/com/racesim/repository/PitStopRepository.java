package com.racesim.repository;

import com.racesim.domain.PitStop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PitStopRepository extends JpaRepository<PitStop, Long> {
    List<PitStop> findByRaceIdAndDriverIdOrderByLapAsc(Long raceId, Long driverId);
    List<PitStop> findByRaceIdOrderByLapAsc(Long raceId);
}
