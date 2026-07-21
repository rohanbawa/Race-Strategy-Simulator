package com.racesim.client;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Thin client over the OpenF1 API (https://api.openf1.org/v1), which covers 2018+ seasons
 * and is the source for tire compound / stint data that Jolpica (Ergast-schema) doesn't carry.
 * Sessions are looked up by date + circuit short name since OpenF1 and Jolpica don't share a
 * common race identifier - see RaceIngestionService for the join logic.
 */
@Component
public class OpenF1Client {

    private final WebClient client;

    public OpenF1Client(@Qualifier("openF1WebClient") WebClient client) {
        this.client = client;
    }

    /** Race sessions on a given date - used to resolve the OpenF1 session_key for a Jolpica race. */
    public JsonNode getRaceSessionsByDate(String isoDate) {
        return get("/sessions?session_type=Race&date_start>=" + isoDate + "T00:00:00&date_start<=" + isoDate + "T23:59:59");
    }

    /** Driver roster (number <-> three-letter code) for a session. */
    public JsonNode getDrivers(long sessionKey) {
        return get("/drivers?session_key=" + sessionKey);
    }

    /** Tire stints (compound, lap range, tyre age at start) for a session. */
    public JsonNode getStints(long sessionKey) {
        return get("/stints?session_key=" + sessionKey);
    }

    private JsonNode get(String path) {
        return client.get()
                .uri(path)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
    }
}
