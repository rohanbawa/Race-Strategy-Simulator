package com.racesim.repository;

import com.racesim.domain.Driver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DriverRepository extends JpaRepository<Driver, Long> {
    Optional<Driver> findByExternalRef(String externalRef);
    Optional<Driver> findByCode(String code);
}
