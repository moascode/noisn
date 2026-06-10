package com.danica.workers;

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
public class UpdateProfileWorker {

    private static final Logger log = LoggerFactory.getLogger(UpdateProfileWorker.class);

    private static final Set<String> ALLOWED_SECTIONS = Set.of("customerProfile", "existingCoverage");

    @JobWorker(type = "update-profile", timeout = 5000)
    public void handle(JobClient client, ActivatedJob job) {
        Map<String, Object> vars = job.getVariablesAsMap();
        Map<String, Object> toolCall = (Map<String, Object>) vars.get("toolCall");

        if (toolCall == null) {
            client.newThrowErrorCommand(job)
                .errorCode("MISSING_TOOL_CALL")
                .errorMessage("toolCall variable is null")
                .send().join();
            return;
        }

        String section = (String) toolCall.get("section");
        if (section == null || !ALLOWED_SECTIONS.contains(section)) {
            client.newThrowErrorCommand(job)
                .errorCode("INVALID_SECTION")
                .errorMessage("section must be one of " + ALLOWED_SECTIONS + ", got: " + section)
                .send().join();
            return;
        }

        Object rawFields = toolCall.get("fields");
        if (rawFields == null) {
            client.newThrowErrorCommand(job)
                .errorCode("MISSING_FIELDS")
                .errorMessage("fields is null in update-profile toolCall")
                .send().join();
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) rawFields;

        Map<String, Object> existing = new HashMap<>();
        Object current = vars.get(section);
        if (current instanceof Map<?, ?> map) {
            map.forEach((k, v) -> existing.put(String.valueOf(k), v));
        }
        existing.putAll(fields);

        log.info("update-profile: section={}, updatedFields={}", section, fields.keySet());

        client.newCompleteCommand(job)
            .variable(section, existing)
            .variable("toolCallResult", "updated")
            .send().join();
    }
}
