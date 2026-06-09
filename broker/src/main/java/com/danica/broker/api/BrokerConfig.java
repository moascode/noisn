package com.danica.broker.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class BrokerConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
