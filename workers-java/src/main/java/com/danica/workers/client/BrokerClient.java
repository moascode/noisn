package com.danica.workers.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
public class BrokerClient {

    private static final Logger log = LoggerFactory.getLogger(BrokerClient.class);

    private final RestTemplate restTemplate;

    @Value("${broker.internal-url}")
    private String brokerUrl;

    @Value("${broker.internal-api-key}")
    private String internalApiKey;

    public BrokerClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String send(String processInstanceKey, String messageType, Object payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Internal-Api-Key", internalApiKey);

        Map<String, Object> body = Map.of(
            "processInstanceKey", processInstanceKey,
            "messageType", messageType,
            "payload", payload != null ? payload : Map.of()
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        try {
            restTemplate.postForEntity(brokerUrl + "/internal/send", request, Map.class);
            return "delivered";
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Session not found in broker for processInstanceKey={}", processInstanceKey);
            return "session_not_connected";
        } catch (Exception e) {
            log.error("Failed to deliver to broker for processInstanceKey={}", processInstanceKey, e);
            return "send_failed: " + e.getMessage();
        }
    }
}
