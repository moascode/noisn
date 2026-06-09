package com.danica.workers;

import com.danica.workers.kb.BedrockKbClient;
import io.camunda.zeebe.client.api.response.ActivatedJob;
import io.camunda.zeebe.client.api.worker.JobClient;
import io.camunda.zeebe.spring.client.annotation.JobWorker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SearchKbWorker {

    private static final Logger log = LoggerFactory.getLogger(SearchKbWorker.class);

    private final BedrockKbClient kbClient;

    public SearchKbWorker(BedrockKbClient kbClient) {
        this.kbClient = kbClient;
    }

    @JobWorker(type = "search-kb", timeout = 30000)
    public Map<String, Object> handle(JobClient client, ActivatedJob job) {
        Map<String, Object> vars = job.getVariablesAsMap();
        Map<String, Object> toolCall = (Map<String, Object>) vars.get("toolCall");
        String query = (String) toolCall.get("query");

        log.info("search-kb: query={}", query);

        String answer = kbClient.retrieveAndGenerate(query);
        return Map.of("toolCallResult", answer);
    }
}
