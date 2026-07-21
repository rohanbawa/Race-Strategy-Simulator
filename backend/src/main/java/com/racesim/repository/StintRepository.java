package com.racesim.repository;

import com.racesim.domain.Stint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StintRepository extends JpaRepository<Stint, Long> {
    List<Stint> findByRaceIdAndDriverIdOrderByStintNumberAsc(Long raceId, Long driverId);
    List<Stint> findByRaceIdOrderByDriverIdAscStintNumberAsc(Long raceId);
}
