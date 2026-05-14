package com.sar.controller;

import com.sar.web.handler.AbstractRequestHandler;
import com.sar.web.handler.ApiHandler;
import com.sar.web.handler.EventHandler;
import com.sar.web.handler.StaticFileHandler;
import com.sar.web.http.Request;
import com.sar.web.http.Response;
import com.sar.web.http.ReplyCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

public class HttpController {
    private static final Logger logger = LoggerFactory.getLogger(HttpController.class);

    private final Map<String, AbstractRequestHandler> handlers;
    private final StaticFileHandler defaultHandler;

    public HttpController(ApiHandler apiHandler, EventHandler eventHandler,
            StaticFileHandler staticFileHandler) {
        this.handlers = new HashMap<>();
        this.defaultHandler = staticFileHandler;
        registerHandler("api",    apiHandler);
        registerHandler("events", eventHandler);
    }

    public void registerHandler(String endpoint, AbstractRequestHandler handler) {
        handlers.put(endpoint.toLowerCase(), handler);
        logger.info("Registered handler for endpoint: {}", endpoint);
    }

    public void handleRequest(Request request, Response response) {
        try {
            if (request == null) {
                response.setError(ReplyCode.BADREQ, "HTTP/1.1");
                return;
            }

            // FIX: strip query string BEFORE matching.
            // Without this, "DELETE /api?groupNumber=12" becomes "api?groupnumber=12"
            // after lowercasing, and "api?groupnumber=12".endsWith("api") is FALSE,
            // so every DELETE fell through to StaticFileHandler → 501.
            String path = request.urlText;
            int qmark = path.indexOf('?');
            if (qmark >= 0) {
                path = path.substring(0, qmark);  // "/api?groupNumber=12" → "/api"
            }

            // Lowercase and strip leading slashes: "/api" → "api"
            path = path.toLowerCase();
            while (path.startsWith("/")) {
                path = path.substring(1);
            }

            // Match path exactly or as a trailing segment ("/foo/api" → "api")
            AbstractRequestHandler handler = null;
            for (Map.Entry<String, AbstractRequestHandler> entry : handlers.entrySet()) {
                String key = entry.getKey();
                if (path.equals(key) || path.endsWith("/" + key)) {
                    handler = entry.getValue();
                    break;
                }
            }

            if (handler == null) {
                handler = defaultHandler;
            }

            logger.info("Routing request to handler: {}", handler.getClass().getSimpleName());
            handler.handle(request, response);

        } catch (Exception e) {
            logger.error("Error handling request", e);
            response.setError(ReplyCode.NOTIMPLEMENTED, request.version);
        }
    }
}