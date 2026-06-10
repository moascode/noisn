package com.danica.workers;

import com.danica.workers.client.CalculatorClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.camunda.zeebe.client.api.response.ActivatedJob;
import io.camunda.zeebe.client.api.worker.JobClient;
import io.camunda.zeebe.spring.client.annotation.JobWorker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Component
public class RunSimulationWorker {

    private static final Logger log = LoggerFactory.getLogger(RunSimulationWorker.class);
    private static final Set<String> REQUIRED_FIELDS = Set.of("productCode", "age", "annualSalary", "desiredRetirementAge", "monthlyContribution");

    private final CalculatorClient calculatorClient;
    private final ObjectMapper objectMapper;

    public RunSimulationWorker(CalculatorClient calculatorClient, ObjectMapper objectMapper) {
        this.calculatorClient = calculatorClient;
        this.objectMapper = objectMapper;
    }

    @JobWorker(type = "run-simulation", timeout = 30000)
    public void handle(JobClient client, ActivatedJob job) throws JsonProcessingException {
        Map<String, Object> vars = job.getVariablesAsMap();
        Map<String, Object> toolCall = (Map<String, Object>) vars.get("toolCall");

        if (toolCall == null) {
            client.newThrowErrorCommand(job)
                .errorCode("MISSING_TOOL_CALL")
                .errorMessage("toolCall variable is null — AI Agent Connector did not set it")
                .send().join();
            return;
        }

        // Validate required fields before attempting conversion
        for (String field : REQUIRED_FIELDS) {
            if (toolCall.get(field) == null) {
                client.newThrowErrorCommand(job)
                    .errorCode("MISSING_REQUIRED_FIELD")
                    .errorMessage("Required field '" + field + "' is null in run-simulation toolCall")
                    .send().join();
                return;
            }
        }

        Map<String, Object> request = new HashMap<>();
        request.put("productCode", toolCall.get("productCode"));
        request.put("age", toolCall.get("age"));
        request.put("annualSalary", toDouble(toolCall.get("annualSalary"), "annualSalary"));
        request.put("desiredRetirementAge", toolCall.get("desiredRetirementAge"));
        request.put("monthlyContribution", toDouble(toolCall.get("monthlyContribution"), "monthlyContribution"));
        request.put("riskProfile", toolCall.getOrDefault("riskProfile", "MEDIUM"));
        request.put("payoutType", toolCall.getOrDefault("payoutType", "ANNUITY"));

        log.info("run-simulation: productCode={}, age={}", request.get("productCode"), request.get("age"));

        Map<String, Object> result = calculatorClient.simulate(request);
        String resultJson = objectMapper.writeValueAsString(result);

        client.newCompleteCommand(job)
            .variable("toolCallResult", resultJson)
            .variable("simulationResult", result)
            .variable("recommendedProduct", request.get("productCode"))
            .send().join();
    }

    private double toDouble(Object val, String fieldName) {
        if (val instanceof Number n) return n.doubleValue();
        if (val instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Field '" + fieldName + "' is not a valid number: " + s);
            }
        }
        throw new IllegalArgumentException("Field '" + fieldName + "' has unexpected type: " + val.getClass().getSimpleName());
    }
}
