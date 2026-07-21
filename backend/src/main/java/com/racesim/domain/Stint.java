package com.racesim.domain;

import jakarta.persistence.*;

/**
 * A single continuous run on one set of tires. A driver's race is a sequence of Stints,
 * each ending in a PitStop (except the final one, which ends at the flag).
 */
@Entity
@Table(name = "stints")
public class Stint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "race_id")
    private Race race;

    @ManyToOne(optional = false)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    /** 1-indexed order of this stint within the driver's race (1 = opening stint). */
    private int stintNumber;

    @Enumerated(EnumType.STRING)
    private TireCompound compound;

    private int startLap;
    private int endLap;

    /** Average lap time actually recorded across this stint, in seconds. Null if not available from the source data. */
    private Double avgLapTimeSeconds;

    public int lapCount() {
        return endLap - startLap + 1;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Race getRace() { return race; }
    public void setRace(Race race) { this.race = race; }
    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }
    public int getStintNumber() { return stintNumber; }
    public void setStintNumber(int stintNumber) { this.stintNumber = stintNumber; }
    public TireCompound getCompound() { return compound; }
    public void setCompound(TireCompound compound) { this.compound = compound; }
    public int getStartLap() { return startLap; }
    public void setStartLap(int startLap) { this.startLap = startLap; }
    public int getEndLap() { return endLap; }
    public void setEndLap(int endLap) { this.endLap = endLap; }
    public Double getAvgLapTimeSeconds() { return avgLapTimeSeconds; }
    public void setAvgLapTimeSeconds(Double avgLapTimeSeconds) { this.avgLapTimeSeconds = avgLapTimeSeconds; }
}
