package com.danica.workers;

import com.danica.workers.client.BrokerClient;
import io.camunda.zeebe.client.api.response.ActivatedJob;
import io.camunda.zeebe.client.api.worker.JobClient;
import io.camunda.zeebe.spring.client.annotation.JobWorker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SendToUiWorker {

    private static final Logger log = LoggerFactory.getLogger(SendToUiWorker.class);

    private final BrokerClient brokerClient;

    public SendToUiWorker(BrokerClient brokerClient) {
        this.brokerClient = brokerClient;
    }

    @JobWorker(type = "send-to-ui", timeout = 10000)
    public Map<String, Object> handle(JobClient client, ActivatedJob job) {
        Map<String, Object> vars = job.getVariablesAsMap();
        Map<String, Object> toolCall = (Map<String, Object>) vars.get("toolCall");
        String processInstanceKey = String.valueOf(job.getProcessInstanceKey());

        String messageType = (String) toolCall.get("messageType");
        Object content = toolCall.get("content");

        log.info("send-to-ui: processInstanceKey={}, messageType={}", processInstanceKey, messageType);

        String result = brokerClient.send(processInstanceKey, messageType, content);
        return Map.of("toolCallResult", result);
    }
}
