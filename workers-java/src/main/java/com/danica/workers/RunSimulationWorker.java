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

@Component
public class RunSimulationWorker {

    private static final Logger log = LoggerFactory.getLogger(RunSimulationWorker.class);

    private final CalculatorClient calculatorClient;
    private final ObjectMapper objectMapper;

    public RunSimulationWorker(CalculatorClient calculatorClient, ObjectMapper objectMapper) {
        this.calculatorClient = calculatorClient;
        this.objectMapper = objectMapper;
    }

    @JobWorker(type = "run-simulation", timeout = 30000)
    public Map<String, Object> handle(JobClient client, ActivatedJob job) throws JsonProcessingException {
        Map<String, Object> vars = job.getVariablesAsMap();
        Map<String, Object> toolCall = (Map<String, Object>) vars.get("toolCall");

        Map<String, Object> request = new HashMap<>();
        request.put("productCode", toolCall.get("productCode"));
        request.put("age", toolCall.get("age"));
        request.put("annualSalary", toDouble(toolCall.get("annualSalary")));
        request.put("desiredRetirementAge", toolCall.get("desiredRetirementAge"));
        request.put("monthlyContribution", toDouble(toolCall.get("monthlyContribution")));
        request.put("riskProfile", toolCall.getOrDefault("riskProfile", "MEDIUM"));
        request.put("payoutType", toolCall.getOrDefault("payoutType", "ANNUITY"));

        log.info("run-simulation: productCode={}, age={}", request.get("productCode"), request.get("age"));

        Map<String, Object> result = calculatorClient.simulate(request);
        String resultJson = objectMapper.writeValueAsString(result);

        return Map.of(
            "toolCallResult", resultJson,
            "simulationResult", result,
            "recommendedProduct", request.get("productCode")
        );
    }

    private double toDouble(Object val) {
        if (val instanceof Number n) return n.doubleValue();
        if (val instanceof String s) return Double.parseDouble(s);
        throw new IllegalArgumentException("Cannot convert to double: " + val);
    }
}
