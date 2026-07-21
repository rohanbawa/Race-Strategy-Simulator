package com.racesim.repository;

import com.racesim.domain.Race;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RaceRepository extends JpaRepository<Race, Long> {
    Optional<Race> findByExternalRef(String externalRef);
    Optional<Race> findBySeasonAndRound(int season, int round);
}
