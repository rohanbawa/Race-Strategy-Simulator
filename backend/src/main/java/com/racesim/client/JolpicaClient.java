package com.racesim.client;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Thin client over the Jolpica API (https://api.jolpi.ca/ergast/f1), the community-run,
 * schema-compatible successor to the retired Ergast API. Returns raw JsonNode trees rather
 * than a hand-maintained POJO for every nested Ergast object - the upstream schema is deep
 * and mostly used transiently during ingestion, so RaceIngestionService picks out only the
 * fields it needs and this client stays a thin, low-maintenance wrapper.
 */
@Component
public class JolpicaClient {

    private final WebClient client;

    public JolpicaClient(@Qualifier("jolpicaWebClient") WebClient client) {
        this.client = client;
    }

    /** Race schedule for a season: dates, circuits, round numbers. */
    public JsonNode getRaceSchedule(int season) {
        return get("/" + season + ".json?limit=100");
    }

    /** Final classification for one race: finish order, constructor, status. */
    public JsonNode getResults(int season, int round) {
        return get("/" + season + "/" + round + "/results.json?limit=100");
    }

    /** Lap-by-lap times for every driver in one race. */
    public JsonNode getLaps(int season, int round) {
        return get("/" + season + "/" + round + "/laps.json?limit=2000");
    }

    /** Pit stop laps and stationary durations for one race. */
    public JsonNode getPitStops(int season, int round) {
        return get("/" + season + "/" + round + "/pitstops.json?limit=200");
    }

    private JsonNode get(String path) {
        return client.get()
                .uri(path)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
    }
}
