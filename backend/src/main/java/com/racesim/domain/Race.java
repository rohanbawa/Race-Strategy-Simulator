package com.racesim.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "races", uniqueConstraints = @UniqueConstraint(columnNames = {"season", "round"}))
public class Race {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Upstream identifier from the source API (Jolpica raceId / OpenF1 meeting_key), used for idempotent ingestion. */
    @Column(name = "external_ref", unique = true)
    private String externalRef;

    private int season;
    private int round;

    @Column(nullable = false)
    private String name;

    private String circuitName;
    private String country;
    private LocalDate raceDate;
    private Integer totalLaps;
    private Double circuitLengthKm;

    /** Reference pit-lane time loss for this circuit, in seconds, used when no observed pit stops exist for a "what-if". */
    private Double defaultPitLaneLossSeconds;

    @OneToMany(mappedBy = "race", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Stint> stints = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getExternalRef() { return externalRef; }
    public void setExternalRef(String externalRef) { this.externalRef = externalRef; }
    public int getSeason() { return season; }
    public void setSeason(int season) { this.season = season; }
    public int getRound() { return round; }
    public void setRound(int round) { this.round = round; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCircuitName() { return circuitName; }
    public void setCircuitName(String circuitName) { this.circuitName = circuitName; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public LocalDate getRaceDate() { return raceDate; }
    public void setRaceDate(LocalDate raceDate) { this.raceDate = raceDate; }
    public Integer getTotalLaps() { return totalLaps; }
    public void setTotalLaps(Integer totalLaps) { this.totalLaps = totalLaps; }
    public Double getCircuitLengthKm() { return circuitLengthKm; }
    public void setCircuitLengthKm(Double circuitLengthKm) { this.circuitLengthKm = circuitLengthKm; }
    public Double getDefaultPitLaneLossSeconds() { return defaultPitLaneLossSeconds; }
    public void setDefaultPitLaneLossSeconds(Double defaultPitLaneLossSeconds) { this.defaultPitLaneLossSeconds = defaultPitLaneLossSeconds; }
    public List<Stint> getStints() { return stints; }
    public void setStints(List<Stint> stints) { this.stints = stints; }
}
