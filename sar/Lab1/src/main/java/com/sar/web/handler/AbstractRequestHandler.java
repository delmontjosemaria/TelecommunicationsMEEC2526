package com.sar.web.handler;

import com.sar.web.http.Request;
import com.sar.web.http.Response;
import com.sar.web.http.ReplyCode;

public abstract class AbstractRequestHandler {
    protected static final String DEFAULT_MIME_TYPE = "application/octet-stream";

    public void handle(Request request, Response response) {
        preHandle(request, response);

        switch (request.method.toUpperCase()) {
            case "GET":
                handleGet(request, response);
                break;
            case "POST":
                handlePost(request, response);
                break;
            case "DELETE":
                handleDelete(request, response);
                break;
            default:
                handleUnsupportedMethod(request, response);
        }

        postHandle(request, response);
    }

    protected void preHandle(Request request, Response response) {}
    protected void postHandle(Request request, Response response) {}

    protected abstract void handleGet(Request request, Response response);
    protected abstract void handlePost(Request request, Response response);

    /**
     * DELETE handler — returns 501 by default so only handlers that explicitly
     * support DELETE need to override this method.
     */
    protected void handleDelete(Request request, Response response) {
        handleUnsupportedMethod(request, response);
    }

    protected void handleUnsupportedMethod(Request request, Response response) {
        response.setError(ReplyCode.NOTIMPLEMENTED, request.version);
    }
}