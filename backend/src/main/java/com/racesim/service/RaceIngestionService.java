package com.racesim.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.racesim.client.JolpicaClient;
import com.racesim.client.OpenF1Client;
import com.racesim.domain.*;
import com.racesim.dto.SeasonRaceDto;
import com.racesim.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * Pulls one race's worth of data from two complementary sources and merges it into the
 * local domain model:
 *
 *  - Jolpica (Ergast-schema): race metadata, driver roster, official results, lap-by-lap
 *    times, pit stop laps/durations. This is the system of record for "what actually happened,
 *    timing-wise".
 *  - OpenF1: tire compound and stint boundaries, which Ergast/Jolpica's schema doesn't carry
 *    at all. Sessions are joined to a Jolpica race by date, since the two APIs don't share
 *    a common identifier.
 *
 * Ingestion is idempotent on externalRef, so re-running it for an already-ingested race
 * updates rather than duplicates.
 */
@Service
public class RaceIngestionService {

    private static final Logger log = LoggerFactory.getLogger(RaceIngestionService.class);

    private final JolpicaClient jolpicaClient;
    private final OpenF1Client openF1Client;
    private final RaceRepository raceRepository;
    private final DriverRepository driverRepository;
    private final LapTimeRepository lapTimeRepository;
    private final PitStopRepository pitStopRepository;
    private final StintRepository stintRepository;

    public RaceIngestionService(JolpicaClient jolpicaClient, OpenF1Client openF1Client,
                                 RaceRepository raceRepository, DriverRepository driverRepository,
                                 LapTimeRepository lapTimeRepository, PitStopRepository pitStopRepository,
                                 StintRepository stintRepository) {
        this.jolpicaClient = jolpicaClient;
        this.openF1Client = openF1Client;
        this.raceRepository = raceRepository;
        this.driverRepository = driverRepository;
        this.lapTimeRepository = lapTimeRepository;
        this.pitStopRepository = pitStopRepository;
        this.stintRepository = stintRepository;
    }

    /**
     * Live season calendar from Jolpica (no ingestion), cross-referenced against locally
     * ingested races so the frontend can drive a Year/Race picker without the user ever
     * having to know a round number or hand-craft an ingest request.
     */
    public List<SeasonRaceDto> getSeasonCalendar(int season) {
        JsonNode scheduleRoot = jolpicaClient.getRaceSchedule(season);
        JsonNode races = scheduleRoot.at("/MRData/RaceTable/Races");

        List<SeasonRaceDto> calendar = new ArrayList<>();
        for (JsonNode raceNode : races) {
            int round = raceNode.path("round").asInt();
            String name = raceNode.path("raceName").asText();
            String circuitName = raceNode.at("/Circuit/circuitName").asText();
            String country = raceNode.at("/Circuit/Location/country").asText();
            String dateStr = raceNode.path("date").asText(null);
            LocalDate date = dateStr != null ? LocalDate.parse(dateStr) : null;

            Optional<Race> existing = raceRepository.findBySeasonAndRound(season, round);
            calendar.add(new SeasonRaceDto(season, round, name, circuitName, country, date,
                    existing.isPresent(), existing.map(Race::getId).orElse(null)));
        }
        return calendar;
    }

    @Transactional
    public Race ingestRace(int season, int round) {
        JsonNode resultsRoot = jolpicaClient.getResults(season, round);
        JsonNode raceNode = resultsRoot.at("/MRData/RaceTable/Races/0");
        if (raceNode.isMissingNode()) {
            throw new NoSuchElementException("No Jolpica data for season " + season + " round " + round);
        }

        Race race = upsertRace(season, round, raceNode);
        Map<String, Driver> driversByExternalRef = upsertDrivers(raceNode.path("Results"));

        ingestLapTimes(season, round, race, driversByExternalRef);
        ingestPitStops(season, round, race, driversByExternalRef);
        ingestStints(race, driversByExternalRef);

        log.info("Ingested {} {} round {} ({})", season, race.getName(), round, race.getCircuitName());
        return race;
    }

    private Race upsertRace(int season, int round, JsonNode raceNode) {
        String externalRef = season + "_" + round;
        Race race = raceRepository.findByExternalRef(externalRef).orElseGet(Race::new);
        race.setExternalRef(externalRef);
        race.setSeason(season);
        race.setRound(round);
        race.setName(raceNode.path("raceName").asText());
        race.setCircuitName(raceNode.at("/Circuit/circuitName").asText());
        race.setCountry(raceNode.at("/Circuit/Location/country").asText());
        String dateStr = raceNode.path("date").asText(null);
        if (dateStr != null) race.setRaceDate(LocalDate.parse(dateStr));

        int maxLaps = 0;
        for (JsonNode result : raceNode.path("Results")) {
            maxLaps = Math.max(maxLaps, result.path("laps").asInt(0));
        }
        if (maxLaps > 0) race.setTotalLaps(maxLaps);

        return raceRepository.save(race);
    }

    private Map<String, Driver> upsertDrivers(JsonNode results) {
        Map<String, Driver> byExternalRef = new HashMap<>();
        for (JsonNode result : results) {
            JsonNode driverNode = result.path("Driver");
            String externalRef = driverNode.path("driverId").asText();
            Driver driver = driverRepository.findByExternalRef(externalRef).orElseGet(Driver::new);
            driver.setExternalRef(externalRef);
            driver.setCode(driverNode.path("code").asText(externalRef.toUpperCase()));
            driver.setGivenName(driverNode.at("/givenName").asText(null));
            driver.setFamilyName(driverNode.at("/familyName").asText(null));
            driver.setNationality(driverNode.path("nationality").asText(null));
            driver.setConstructorName(result.at("/Constructor/name").asText(null));
            driver = driverRepository.save(driver);
            byExternalRef.put(externalRef, driver);
        }
        return byExternalRef;


    }

    private void ingestLapTimes(int season, int round, Race race, Map<String, Driver> driversByExternalRef) {
        JsonNode lapsRoot = jolpicaClient.getLaps(season, round);
        JsonNode laps = lapsRoot.at("/MRData/RaceTable/Races/0/Laps");
        for (JsonNode lapNode : laps) {
            int lapNumber = lapNode.path("number").asInt();
            for (JsonNode timing : lapNode.path("Timings")) {
                String driverRef = timing.path("driverId").asText();
                Driver driver = driversByExternalRef.get(driverRef);
                if (driver == null) continue; // driver retired before results were recorded, or DNS

                double seconds = parseLapTime(timing.path("time").asText(null));
                if (seconds <= 0) continue;

                LapTime lt = new LapTime();
                lt.setRace(race);
                lt.setDriver(driver);
                lt.setLap(lapNumber);
                lt.setLapTimeSeconds(seconds);
                Integer position = timing.path("position").isMissingNode() ? null : timing.path("position").asInt();
                lt.setPosition(position);
                lapTimeRepository.save(lt);
            }
        }
    }

    private void ingestPitStops(int season, int round, Race race, Map<String, Driver> driversByExternalRef) {
        JsonNode pitRoot = jolpicaClient.getPitStops(season, round);
        JsonNode pitStops = pitRoot.at("/MRData/RaceTable/Races/0/PitStops");
        for (JsonNode stopNode : pitStops) {
            String driverRef = stopNode.path("driverId").asText();
            Driver driver = driversByExternalRef.get(driverRef);
            if (driver == null) continue;

            PitStop stop = new PitStop();
            stop.setRace(race);
            stop.setDriver(driver);
            stop.setLap(stopNode.path("lap").asInt());
            stop.setStopNumber(stopNode.path("stop").asInt());
            stop.setStationaryTimeSeconds(stopNode.path("duration").asDouble(0.0));
            pitStopRepository.save(stop);
        }
    }

    /**
     * Resolves an OpenF1 session by race date, pulls stint boundaries + compounds, and maps
     * them onto our Driver rows via the shared three-letter driver code. If OpenF1 has no
     * matching session (e.g. very old or very recent races not yet indexed), stints are simply
     * left empty and the simulator falls back to its generic base-pace calibration.
     */
    private void ingestStints(Race race, Map<String, Driver> driversByExternalRef) {
        if (race.getRaceDate() == null) return;

        JsonNode sessions = openF1Client.getRaceSessionsByDate(race.getRaceDate().toString());
        if (!sessions.isArray() || sessions.isEmpty()) {
            log.warn("No OpenF1 session found for {} on {} - stints/compounds unavailable", race.getName(), race.getRaceDate());
            return;
        }
        long sessionKey = sessions.get(0).path("session_key").asLong();

        Map<Integer, String> codeByDriverNumber = new HashMap<>();
        for (JsonNode d : openF1Client.getDrivers(sessionKey)) {
            codeByDriverNumber.put(d.path("driver_number").asInt(), d.path("name_acronym").asText());
        }

        Map<String, Driver> driversByCode = new HashMap<>();
        for (Driver d : driversByExternalRef.values()) driversByCode.put(d.getCode(), d);

        for (JsonNode stintNode : openF1Client.getStints(sessionKey)) {
            int driverNumber = stintNode.path("driver_number").asInt();
            String code = codeByDriverNumber.get(driverNumber);
            Driver driver = code != null ? driversByCode.get(code) : null;
            if (driver == null) continue;

            TireCompound compound = parseCompound(stintNode.path("compound").asText("MEDIUM"));

            Stint stint = new Stint();
            stint.setRace(race);
            stint.setDriver(driver);
            stint.setStintNumber(stintNode.path("stint_number").asInt());
            stint.setCompound(compound);
            stint.setStartLap(stintNode.path("lap_start").asInt());
            stint.setEndLap(stintNode.path("lap_end").asInt());
            stint.setAvgLapTimeSeconds(averageLapTime(race.getId(), driver.getId(), stint.getStartLap(), stint.getEndLap()));
            stintRepository.save(stint);
        }
    }

    private Double averageLapTime(Long raceId, Long driverId, int startLap, int endLap) {
        List<LapTime> laps = lapTimeRepository.findByRaceIdAndDriverIdOrderByLapAsc(raceId, driverId);
        double sum = 0;
        int count = 0;
        for (LapTime lt : laps) {
            if (lt.getLap() >= startLap && lt.getLap() <= endLap) {
                sum += lt.getLapTimeSeconds();
                count++;
            }
        }
        return count > 0 ? sum / count : null;
    }

    private TireCompound parseCompound(String raw) {
        try {
            return TireCompound.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return TireCompound.MEDIUM;
        }
    }

    /** Ergast/Jolpica lap times are formatted "m:ss.SSS" (e.g. "1:32.190"). */
    private double parseLapTime(String raw) {
        if (raw == null || raw.isBlank()) return -1;
        try {
            String[] parts = raw.split(":");
            double minutes = parts.length > 1 ? Double.parseDouble(parts[0]) : 0;
            double seconds = Double.parseDouble(parts[parts.length - 1]);
            return minutes * 60 + seconds;
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
