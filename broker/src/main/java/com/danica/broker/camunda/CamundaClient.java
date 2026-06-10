package com.danica.broker.camunda;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class CamundaClient {

    private static final Logger log = LoggerFactory.getLogger(CamundaClient.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${camunda.rest-url}")
    private String restUrl;

    @Value("${camunda.rest-token}")
    private String restToken;

    @Value("${camunda.process-definition-key}")
    private String processDefinitionKey;

    public CamundaClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public String createProcessInstance(Map<String, Object> variables) {
        HttpHeaders headers = buildHeaders();
        Map<String, Object> body = Map.of(
            "processDefinitionKey", processDefinitionKey,
            "variables", wrapVariables(variables)
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        Map<?, ?> response = restTemplate.postForObject(restUrl + "/v2/process-instances", request, Map.class);

        if (response == null || !response.containsKey("processInstanceKey")) {
            throw new RuntimeException("Camunda returned null or missing processInstanceKey");
        }

        return String.valueOf(response.get("processInstanceKey"));
    }

    public void publishMessage(String messageName, String correlationKey, Map<String, Object> variables) {
        HttpHeaders headers = buildHeaders();
        Map<String, Object> body = Map.of(
            "messageName", messageName,
            "correlationKey", correlationKey,
            "variables", wrapVariables(variables)
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        try {
            restTemplate.postForEntity(restUrl + "/v2/messages/publication", request, Void.class);
            log.debug("Published message '{}' for correlationKey={}", messageName, correlationKey);
        } catch (RestClientException e) {
            // Rethrow with context so the caller can surface a clean error to the WebSocket client
            throw new RuntimeException("Failed to publish message '" + messageName + "': " + e.getMessage(), e);
        }
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (restToken != null && !restToken.isBlank()) {
            headers.setBearerAuth(restToken);
        } else {
            log.warn("CAMUNDA_REST_TOKEN is not set — REST calls will be unauthenticated");
        }
        return headers;
    }

    /**
     * Wraps variables into Camunda REST v2 format: { varName: { value: ..., type: ... } }.
     * Type is inferred from the Java type. Maps and Lists are serialised to JSON strings.
     */
    private Map<String, Object> wrapVariables(Map<String, Object> variables) {
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, Object> e : variables.entrySet()) {
            result.put(e.getKey(), buildVariableWrapper(e.getValue()));
        }
        return result;
    }

    private Map<String, Object> buildVariableWrapper(Object value) {
        if (value == null) {
            return Map.of("value", "null", "type", "Null");
        }
        if (value instanceof String s) {
            return Map.of("value", s, "type", "String");
        }
        if (value instanceof Long l) {
            return Map.of("value", l, "type", "Long");
        }
        if (value instanceof Integer i) {
            return Map.of("value", i.longValue(), "type", "Long");
        }
        if (value instanceof Double d) {
            return Map.of("value", d, "type", "Double");
        }
        if (value instanceof Boolean b) {
            return Map.of("value", b, "type", "Boolean");
        }
        if (value instanceof Map || value instanceof List) {
            try {
                String json = objectMapper.writeValueAsString(value);
                return Map.of("value", json, "type", "Json");
            } catch (Exception e) {
                log.warn("Failed to serialise variable value to JSON, falling back to String: {}", e.getMessage());
            }
        }
        return Map.of("value", String.valueOf(value), "type", "String");
    }
}
