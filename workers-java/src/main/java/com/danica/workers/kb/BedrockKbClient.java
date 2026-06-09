package com.danica.workers.kb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockagentruntime.BedrockAgentRuntimeClient;
import software.amazon.awssdk.services.bedrockagentruntime.model.KnowledgeBaseRetrieveAndGenerateConfiguration;
import software.amazon.awssdk.services.bedrockagentruntime.model.RetrieveAndGenerateConfiguration;
import software.amazon.awssdk.services.bedrockagentruntime.model.RetrieveAndGenerateInput;
import software.amazon.awssdk.services.bedrockagentruntime.model.RetrieveAndGenerateRequest;
import software.amazon.awssdk.services.bedrockagentruntime.model.RetrieveAndGenerateResponse;
import software.amazon.awssdk.services.bedrockagentruntime.model.RetrieveAndGenerateType;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Component
public class BedrockKbClient {

    private static final Logger log = LoggerFactory.getLogger(BedrockKbClient.class);

    @Value("${aws.region}")
    private String awsRegion;

    @Value("${aws.bedrock-kb-id}")
    private String knowledgeBaseId;

    private BedrockAgentRuntimeClient client;

    @PostConstruct
    public void init() {
        client = BedrockAgentRuntimeClient.builder()
            .region(Region.of(awsRegion))
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build();
        log.info("BedrockKbClient initialized for region={}, kbId={}", awsRegion, knowledgeBaseId);
    }

    public String retrieveAndGenerate(String query) {
        RetrieveAndGenerateRequest request = RetrieveAndGenerateRequest.builder()
            .input(RetrieveAndGenerateInput.builder().text(query).build())
            .retrieveAndGenerateConfiguration(
                RetrieveAndGenerateConfiguration.builder()
                    .type(RetrieveAndGenerateType.KNOWLEDGE_BASE)
                    .knowledgeBaseConfiguration(
                        KnowledgeBaseRetrieveAndGenerateConfiguration.builder()
                            .knowledgeBaseId(knowledgeBaseId)
                            .modelArn("anthropic.claude-3-5-sonnet-20241022-v2:0")
                            .build()
                    )
                    .build()
            )
            .build();

        RetrieveAndGenerateResponse response = client.retrieveAndGenerate(request);
        return response.output().text();
    }

    @PreDestroy
    public void destroy() {
        if (client != null) {
            client.close();
        }
    }
}
