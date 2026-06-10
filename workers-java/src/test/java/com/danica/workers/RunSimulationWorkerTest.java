package com.danica.workers;

import com.danica.workers.client.CalculatorClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.camunda.zeebe.client.api.ZeebeFuture;
import io.camunda.zeebe.client.api.command.ThrowErrorCommandStep1;
import io.camunda.zeebe.client.api.response.ActivatedJob;
import io.camunda.zeebe.client.api.worker.JobClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RunSimulationWorkerTest {

    private RunSimulationWorker worker;

    @Mock private JobClient jobClient;
    @Mock private ActivatedJob job;
    @Mock private CalculatorClient calculatorClient;
    @Mock private ThrowErrorCommandStep1 throwErrorStep;
    @Mock private ThrowErrorCommandStep1.ThrowErrorCommandStep2 throwErrorStep2;
    @Mock private ZeebeFuture<Void> throwFuture;

    @BeforeEach
    void setUp() {
        worker = new RunSimulationWorker(calculatorClient, new ObjectMapper());
        when(jobClient.newThrowErrorCommand(job)).thenReturn(throwErrorStep);
        when(throwErrorStep.errorCode(anyString())).thenReturn(throwErrorStep2);
        when(throwErrorStep2.errorMessage(anyString())).thenReturn(throwErrorStep2);
        when(throwErrorStep2.send()).thenReturn(throwFuture);
    }

    @Test
    void nullToolCall_throwsMissingToolCallError() throws Exception {
        when(job.getVariablesAsMap()).thenReturn(Map.of());
        worker.handle(jobClient, job);
        verify(throwErrorStep).errorCode("MISSING_TOOL_CALL");
        verify(calculatorClient, never()).simulate(any());
    }

    @Test
    void missingProductCode_throwsMissingRequiredFieldError() throws Exception {
        Map<String, Object> toolCall = new HashMap<>();
        toolCall.put("age", 40);
        toolCall.put("annualSalary", 500000.0);
        toolCall.put("desiredRetirementAge", 67);
        toolCall.put("monthlyContribution", 2000.0);
        // productCode intentionally absent

        when(job.getVariablesAsMap()).thenReturn(Map.of("toolCall", toolCall));
        worker.handle(jobClient, job);
        verify(throwErrorStep).errorCode("MISSING_REQUIRED_FIELD");
        verify(calculatorClient, never()).simulate(any());
    }

    @Test
    void nullAnnualSalary_throwsMissingRequiredFieldError() throws Exception {
        Map<String, Object> toolCall = new HashMap<>();
        toolCall.put("productCode", "DANICA_BALANCE");
        toolCall.put("age", 40);
        toolCall.put("annualSalary", null);
        toolCall.put("desiredRetirementAge", 67);
        toolCall.put("monthlyContribution", 2000.0);

        when(job.getVariablesAsMap()).thenReturn(Map.of("toolCall", toolCall));
        worker.handle(jobClient, job);
        verify(throwErrorStep).errorCode("MISSING_REQUIRED_FIELD");
    }

    @Test
    void validInput_callsCalculatorAndCompletes() throws Exception {
        Map<String, Object> toolCall = Map.of(
            "productCode", "DANICA_BALANCE",
            "age", 40,
            "annualSalary", 600000.0,
            "desiredRetirementAge", 67,
            "monthlyContribution", 2500.0,
            "riskProfile", "MEDIUM"
        );
        when(job.getVariablesAsMap()).thenReturn(Map.of("toolCall", toolCall));

        Map<String, Object> simulationResult = Map.of(
            "projectedPensionMonthlyDKK", 18500.0,
            "salaryReplacementPct", 74.0
        );
        when(calculatorClient.simulate(any())).thenReturn(simulationResult);

        var completeStep = mock(io.camunda.zeebe.client.api.command.CompleteJobCommandStep1.class);
        when(jobClient.newCompleteCommand(job)).thenReturn(completeStep);
        when(completeStep.variable(anyString(), any())).thenReturn(completeStep);
        when(completeStep.send()).thenReturn(mock(ZeebeFuture.class));

        worker.handle(jobClient, job);

        verify(calculatorClient).simulate(any());
        verify(jobClient).newCompleteCommand(job);
        verify(jobClient, never()).newThrowErrorCommand(any());
    }

    @Test
    void integerAnnualSalary_acceptedViaToDouble() throws Exception {
        // Zeebe sometimes deserialises numbers as Integer not Double
        Map<String, Object> toolCall = Map.of(
            "productCode", "DANICA_LINK",
            "age", 35,
            "annualSalary", 500000,   // Integer, not Double
            "desiredRetirementAge", 65,
            "monthlyContribution", 1500
        );
        when(job.getVariablesAsMap()).thenReturn(Map.of("toolCall", toolCall));
        when(calculatorClient.simulate(any())).thenReturn(Map.of("projectedPensionMonthlyDKK", 12000.0));

        var completeStep = mock(io.camunda.zeebe.client.api.command.CompleteJobCommandStep1.class);
        when(jobClient.newCompleteCommand(job)).thenReturn(completeStep);
        when(completeStep.variable(anyString(), any())).thenReturn(completeStep);
        when(completeStep.send()).thenReturn(mock(ZeebeFuture.class));

        worker.handle(jobClient, job);
        verify(jobClient, never()).newThrowErrorCommand(any());
        verify(calculatorClient).simulate(any());
    }
}
