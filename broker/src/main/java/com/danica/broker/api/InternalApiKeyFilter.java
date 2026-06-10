package com.danica.broker.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Guards /internal/** endpoints with a shared secret header.
 * Workers must send X-Internal-Api-Key matching BROKER_INTERNAL_API_KEY.
 * The broker port should NOT be published to the internet in production —
 * this filter is an additional defence-in-depth layer.
 */
@Component
public class InternalApiKeyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(InternalApiKeyFilter.class);

    @Value("${broker.internal-api-key}")
    private String expectedApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/internal/")) {
            String providedKey = request.getHeader("X-Internal-Api-Key");
            if (providedKey == null || !providedKey.equals(expectedApiKey)) {
                log.warn("Rejected /internal request with invalid API key from {}", request.getRemoteAddr());
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Unauthorized\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
