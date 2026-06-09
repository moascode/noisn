package com.danica.workers;

import io.camunda.zeebe.client.api.response.ActivatedJob;
import io.camunda.zeebe.client.api.worker.JobClient;
import io.camunda.zeebe.spring.client.annotation.JobWorker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class UpdateProfileWorker {

    private static final Logger log = LoggerFactory.getLogger(UpdateProfileWorker.class);

    @JobWorker(type = "update-profile", timeout = 5000)
    public Map<String, Object> handle(JobClient client, ActivatedJob job) {
        Map<String, Object> vars = job.getVariablesAsMap();
        Map<String, Object> toolCall = (Map<String, Object>) vars.get("toolCall");

        String section = (String) toolCall.get("section");
        Map<String, Object> fields = (Map<String, Object>) toolCall.get("fields");

        Map<String, Object> existing = new HashMap<>();
        Object current = vars.get(section);
        if (current instanceof Map<?, ?> map) {
            map.forEach((k, v) -> existing.put(String.valueOf(k), v));
        }
        existing.putAll(fields);

        log.info("update-profile: section={}, updatedFields={}", section, fields.keySet());

        return Map.of(
            section, existing,
            "toolCallResult", "updated"
        );
    }
}
