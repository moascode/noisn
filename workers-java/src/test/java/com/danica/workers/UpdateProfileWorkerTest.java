package com.danica.workers;

import io.camunda.zeebe.client.api.ZeebeFuture;
import io.camunda.zeebe.client.api.command.ThrowErrorCommandStep1;
import io.camunda.zeebe.client.api.response.ActivatedJob;
import io.camunda.zeebe.client.api.worker.JobClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UpdateProfileWorkerTest {

    private UpdateProfileWorker worker;

    @Mock private JobClient jobClient;
    @Mock private ActivatedJob job;
    @Mock private ThrowErrorCommandStep1 throwErrorStep;
    @Mock private ThrowErrorCommandStep1.ThrowErrorCommandStep2 throwErrorStep2;
    @Mock private ZeebeFuture<Void> throwFuture;

    @BeforeEach
    void setUp() {
        worker = new UpdateProfileWorker();
        // Wire throw-error chain
        when(jobClient.newThrowErrorCommand(job)).thenReturn(throwErrorStep);
        when(throwErrorStep.errorCode(anyString())).thenReturn(throwErrorStep2);
        when(throwErrorStep2.errorMessage(anyString())).thenReturn(throwErrorStep2);
        when(throwErrorStep2.send()).thenReturn(throwFuture);
    }

    @Test
    void nullToolCall_throwsBpmnError() {
        when(job.getVariablesAsMap()).thenReturn(Map.of());
        worker.handle(jobClient, job);
        verify(throwErrorStep).errorCode("MISSING_TOOL_CALL");
    }

    @Test
    void invalidSection_throwsBpmnError() {
        Map<String, Object> vars = Map.of(
            "toolCall", Map.of("section", "hackerVariable", "fields", Map.of("x", 1))
        );
        when(job.getVariablesAsMap()).thenReturn(vars);
        worker.handle(jobClient, job);
        verify(throwErrorStep).errorCode("INVALID_SECTION");
    }

    @Test
    void nullFields_throwsBpmnError() {
        Map<String, Object> toolCall = new HashMap<>();
        toolCall.put("section", "customerProfile");
        toolCall.put("fields", null);
        when(job.getVariablesAsMap()).thenReturn(Map.of("toolCall", toolCall));
        worker.handle(jobClient, job);
        verify(throwErrorStep).errorCode("MISSING_FIELDS");
    }

    @Test
    void validCustomerProfile_mergesFieldsAndCompletes() {
        // Pre-existing profile data
        Map<String, Object> existing = new HashMap<>();
        existing.put("age", 35);

        Map<String, Object> newFields = Map.of("annualSalary", 600000, "riskProfile", "MEDIUM");
        Map<String, Object> toolCall = Map.of("section", "customerProfile", "fields", newFields);

        when(job.getVariablesAsMap()).thenReturn(Map.of(
            "toolCall", toolCall,
            "customerProfile", existing
        ));

        // Capture the completeCommand interaction
        var completeStep1 = mock(io.camunda.zeebe.client.api.command.CompleteJobCommandStep1.class);
        when(jobClient.newCompleteCommand(job)).thenReturn(completeStep1);
        when(completeStep1.variable(anyString(), any())).thenReturn(completeStep1);
        when(completeStep1.send()).thenReturn(mock(ZeebeFuture.class));

        worker.handle(jobClient, job);

        // Verify completed (not thrown)
        verify(jobClient).newCompleteCommand(job);
        verify(jobClient, never()).newThrowErrorCommand(any());

        // Verify merged profile was set
        ArgumentCaptor<Object> valueCaptor = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(completeStep1, atLeastOnce()).variable(keyCaptor.capture(), valueCaptor.capture());

        int profileIdx = keyCaptor.getAllValues().indexOf("customerProfile");
        assertThat(profileIdx).isGreaterThanOrEqualTo(0);
        @SuppressWarnings("unchecked")
        Map<String, Object> merged = (Map<String, Object>) valueCaptor.getAllValues().get(profileIdx);
        assertThat(merged).containsEntry("age", 35);
        assertThat(merged).containsEntry("annualSalary", 600000);
        assertThat(merged).containsEntry("riskProfile", "MEDIUM");
    }

    @Test
    void existingCoverageSection_isAllowed() {
        Map<String, Object> toolCall = Map.of(
            "section", "existingCoverage",
            "fields", Map.of("employerPension", "SomePension A/S")
        );
        when(job.getVariablesAsMap()).thenReturn(Map.of("toolCall", toolCall));

        var completeStep1 = mock(io.camunda.zeebe.client.api.command.CompleteJobCommandStep1.class);
        when(jobClient.newCompleteCommand(job)).thenReturn(completeStep1);
        when(completeStep1.variable(anyString(), any())).thenReturn(completeStep1);
        when(completeStep1.send()).thenReturn(mock(ZeebeFuture.class));

        worker.handle(jobClient, job);
        verify(jobClient).newCompleteCommand(job);
    }
}
