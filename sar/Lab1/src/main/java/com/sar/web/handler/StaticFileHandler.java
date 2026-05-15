package com.sar.web.handler;

import com.sar.web.http.Request;
import com.sar.web.http.Response;
import com.sar.web.http.ReplyCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

public class StaticFileHandler extends AbstractRequestHandler {
    private static final Logger logger = LoggerFactory.getLogger(StaticFileHandler.class);
    private final String baseDirectory;
    private final String homeFileName;
    private final Map<String, String> mimeTypes;

    private static final Map<String, String> MIME_TYPES = new HashMap<>();

    static {
        MIME_TYPES.put(".html", "text/html; charset=UTF-8");
        MIME_TYPES.put(".htm",  "text/html; charset=UTF-8");
        MIME_TYPES.put(".css",  "text/css");
        MIME_TYPES.put(".js",   "application/javascript");
        MIME_TYPES.put(".json", "application/json");
        MIME_TYPES.put(".jpg",  "image/jpeg");
        MIME_TYPES.put(".jpeg", "image/jpeg");
        MIME_TYPES.put(".png",  "image/png");
        MIME_TYPES.put(".gif",  "image/gif");
    }

    public StaticFileHandler(String baseDirectory, String homeFileName) {
        this.baseDirectory = baseDirectory;
        this.homeFileName  = homeFileName;
        this.mimeTypes     = MIME_TYPES;
    }

    @Override
    protected void handleGet(Request request, Response response) {
        String path = request.urlText;
        if (path.equals("/")) {
            path = "/" + homeFileName;
        }

        String fullPath = baseDirectory + path;
        File file = new File(fullPath);

        try {
            if (file.exists() && file.isFile()) {
                response.setCode(ReplyCode.OK);
                response.setVersion(request.version);
                response.setFile(file);

                // Content-Type derived from file extension
                response.setHeader("Content-Type", getMimeType(fullPath));

                // Content-Length must reflect the actual file size in bytes
                response.setHeader("Content-Length", String.valueOf(file.length()));

                // Cache-Control: no-cache keeps behaviour predictable during development.
                // Switch to "public, max-age=3600" for static assets in production.
                response.setHeader("Cache-Control", "no-cache");

                // FIX: use Headers.isKeepAlive() instead of a raw string comparison.
                // The old code only recognised "keep-alive" but ignored HTTP/1.1's
                // default keep-alive behaviour when no Connection header is present.
                setConnectionHeader(request, response);

                logger.info("Serving file: {}", fullPath);
            } else {
                logger.warn("File not found: {}. Returning 404.", fullPath);
                response.setCode(ReplyCode.NOTFOUND);
                response.setVersion(request.version);
            }
        } catch (Exception e) {
            logger.error("Error serving file: {}", fullPath, e);
            response.setError(ReplyCode.BADREQ, request.version);
        }
    }

    @Override
    protected void handlePost(Request request, Response response) {
        logger.error("StaticFileHandler does not handle POST requests.");
        response.setError(ReplyCode.NOTIMPLEMENTED, request.version);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String getMimeType(String path) {
        int dot = path.lastIndexOf('.');
        if (dot > 0) {
            String ext = path.substring(dot).toLowerCase();
            return mimeTypes.getOrDefault(ext, DEFAULT_MIME_TYPE);
        }
        return DEFAULT_MIME_TYPE;
    }

    /**
     * Sets the Connection header and delegates the keep-alive decision to
     * Headers.isKeepAlive(), which correctly handles both explicit header values
     * and the HTTP/1.1 implicit default.
     */
    private void setConnectionHeader(Request request, Response response) {
        boolean keepAlive = request.headers.isKeepAlive(request.version);
        response.setHeader("Connection", keepAlive ? "keep-alive" : "close");
    }
}