package com.racesim.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient jolpicaWebClient(@Value("${racesim.data-sources.jolpica-base-url}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }

    @Bean
    public WebClient openF1WebClient(@Value("${racesim.data-sources.openf1-base-url}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }
}
