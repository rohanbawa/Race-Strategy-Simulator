package com.racesim.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "pit_stops")
public class PitStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "race_id")
    private Race race;

    @ManyToOne(optional = false)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    private int lap;

    /** 1-indexed stop number for this driver in this race. */
    private int stopNumber;

    /** Stationary time (wheel gun to release), in seconds - what the source APIs report as "pit stop duration". */
    private double stationaryTimeSeconds;

    /** Total time lost vs. a hypothetical flying lap: pit-lane transit + stationary time + delta to racing speed. */
    private Double totalTimeLossSeconds;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Race getRace() { return race; }
    public void setRace(Race race) { this.race = race; }
    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }
    public int getLap() { return lap; }
    public void setLap(int lap) { this.lap = lap; }
    public int getStopNumber() { return stopNumber; }
    public void setStopNumber(int stopNumber) { this.stopNumber = stopNumber; }
    public double getStationaryTimeSeconds() { return stationaryTimeSeconds; }
    public void setStationaryTimeSeconds(double stationaryTimeSeconds) { this.stationaryTimeSeconds = stationaryTimeSeconds; }
    public Double getTotalTimeLossSeconds() { return totalTimeLossSeconds; }
    public void setTotalTimeLossSeconds(Double totalTimeLossSeconds) { this.totalTimeLossSeconds = totalTimeLossSeconds; }
}
