package com.danica.broker.camunda;

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
            throw new RuntimeException("Failed to create process instance: null or missing processInstanceKey in response");
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
        restTemplate.postForEntity(restUrl + "/v2/messages/publication", request, Void.class);
        log.debug("Published message '{}' for correlationKey={}", messageName, correlationKey);
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (restToken != null && !restToken.isBlank()) {
            headers.setBearerAuth(restToken);
        }
        return headers;
    }

    // Camunda REST v2 variables format: { varName: { value: ..., type: ... } }
    private Map<String, Object> wrapVariables(Map<String, Object> variables) {
        return variables.entrySet().stream().collect(
            java.util.stream.Collectors.toMap(
                Map.Entry::getKey,
                e -> Map.of("value", e.getValue())
            )
        );
    }
}
