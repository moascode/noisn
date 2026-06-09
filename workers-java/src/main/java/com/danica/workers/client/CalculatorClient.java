package com.danica.workers.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
public class CalculatorClient {

    private static final Logger log = LoggerFactory.getLogger(CalculatorClient.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${calculator.api-url}")
    private String calculatorUrl;

    public CalculatorClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> simulate(Map<String, Object> request) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
        Map<?, ?> raw = restTemplate.postForObject(calculatorUrl + "/simulate", entity, Map.class);
        if (raw == null) {
            throw new RuntimeException("Null response from Calculator API /simulate");
        }
        return (Map<String, Object>) raw;
    }
}
