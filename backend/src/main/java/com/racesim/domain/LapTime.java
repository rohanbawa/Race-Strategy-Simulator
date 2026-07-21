package com.racesim.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "lap_times", uniqueConstraints = @UniqueConstraint(columnNames = {"race_id", "driver_id", "lap"}))
public class LapTime {

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
    private double lapTimeSeconds;
    private Integer position;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Race getRace() { return race; }
    public void setRace(Race race) { this.race = race; }
    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }
    public int getLap() { return lap; }
    public void setLap(int lap) { this.lap = lap; }
    public double getLapTimeSeconds() { return lapTimeSeconds; }
    public void setLapTimeSeconds(double lapTimeSeconds) { this.lapTimeSeconds = lapTimeSeconds; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
}
