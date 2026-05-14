package com.sar.web.http;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
import java.io.*;

/**
 * Stores and parses HTTP request/response headers.
 *
 * Header names are stored with their original casing but looked up
 * case-insensitively, matching RFC 7230 §3.2.
 *
 * Multi-line (obs-fold) header values per RFC 7230 §3.2.6 are supported:
 * continuation lines starting with SP or HTAB are folded into the previous
 * header's value, separated by a single space.
 */
public class Headers {
    private static final Logger logger = LoggerFactory.getLogger(Headers.class);

    public Properties headers; // Single value list of headers

    /**
     * Creates an empty list of headers
     */
    public Headers() {
        this.headers = new Properties();
    }

    /**
     * Clears the contents of the headers properties object
     */
    public void clear() {
        headers.clear();
    }

    /**
     * Store a header value. If a header with the same name (case-insensitive)
     * already exists, the new value is appended with a comma separator per
     * RFC 7230 §3.2.2. Does NOT combine Set-Cookie headers, which must remain
     * as independent values.
     *
     * @param hdrName header name
     * @param hdrVal  header value
     */
    public void setHeader(String hdrName, String hdrVal) {
        String existingKey = findExistingKey(hdrName);

        if (existingKey == null) {
            // First occurrence — store as-is
            headers.setProperty(hdrName, hdrVal);
        } else if (!existingKey.equalsIgnoreCase("set-cookie")) {
            // Combine duplicate headers with comma per RFC 7230 §3.2.2
            String existing = headers.getProperty(existingKey);
            headers.setProperty(existingKey, existing + ", " + hdrVal);
            logger.debug("Combined duplicate header '{}': '{}'", existingKey, headers.getProperty(existingKey));
        }
        // Set-Cookie duplicates are silently ignored — caller should use a
        // list-based structure if multiple Set-Cookie values are needed.
    }

    /**
     * Returns the value of a header (case-insensitive name lookup).
     *
     * @param hdrName header name
     * @return the header value, or null if not present
     */
    public String getHeaderValue(String hdrName) {
        String key = findExistingKey(hdrName);
        return key != null ? headers.getProperty(key) : null;
    }

    // -------------------------------------------------------------------------
    // Parsing
    // -------------------------------------------------------------------------

    /**
     * Reads and parses HTTP headers from a BufferedReader until an empty line
     * is reached (the blank line separating headers from the body).
     *
     * Handles:
     *   - Standard "Name: Value" headers
     *   - Multi-line (obs-fold) continuation lines beginning with SP or HTAB
     *   - Malformed lines (no colon) are logged and skipped
     *
     * @param reader reader positioned just after the HTTP request line
     * @throws IOException if an I/O error occurs
     */
    public void readHeaders(BufferedReader reader) throws IOException {
        String pendingName  = null; // name of the header being accumulated
        String pendingValue = null; // value accumulated so far

        String line;
        while ((line = reader.readLine()) != null) {

            // Empty line signals end of headers
            if (line.isEmpty()) {
                break;
            }

            // RFC 7230 §3.2.6 obs-fold: continuation line starts with SP or HTAB
            if ((line.charAt(0) == ' ' || line.charAt(0) == '\t') && pendingName != null) {
                pendingValue = pendingValue + " " + line.trim();
                logger.trace("  Folded continuation for '{}': '{}'", pendingName, pendingValue);
                continue;
            }

            // Flush the previously accumulated header before starting the new one
            if (pendingName != null) {
                setHeader(pendingName, pendingValue);
                logger.debug("Header stored [{}]: '{}'", pendingName, pendingValue);
            }

            // Parse "Header-Name: value"
            int colonIndex = line.indexOf(':');
            if (colonIndex <= 0) {
                logger.warn("Skipping malformed header line (no colon): '{}'", line);
                pendingName  = null;
                pendingValue = null;
                continue;
            }

            pendingName  = line.substring(0, colonIndex).trim();
            pendingValue = line.substring(colonIndex + 1).trim();
        }

        // Flush the last accumulated header
        if (pendingName != null) {
            setHeader(pendingName, pendingValue);
            logger.debug("Header stored [{}]: '{}'", pendingName, pendingValue);
        }

        logger.debug("Finished parsing headers ({} total)", headers.size());
    }

    // -------------------------------------------------------------------------
    // Typed accessors for commonly used headers
    // -------------------------------------------------------------------------

    /**
     * Returns the raw Cookie header value, e.g. "sessionId=abc; theme=dark",
     * or null if the header is absent.
     *
     * Use getCookies() to obtain individual name/value pairs.
     */
    public String getCookieHeader() {
        return getHeaderValue("Cookie");
    }

    /**
     * Parses the Cookie header and returns a map of cookie name -> value.
     * Returns an empty map if no Cookie header is present.
     *
     * Cookie values that contain '=' beyond the first are preserved in full
     * (the split is on the first '=' only).
     *
     * @return ordered map of cookie name to value
     */
    public Map<String, String> getCookies() {
        Map<String, String> cookies = new LinkedHashMap<>();
        String raw = getHeaderValue("Cookie");
        if (raw == null || raw.isEmpty()) {
            return cookies;
        }

        for (String pair : raw.split(";")) {
            pair = pair.trim();
            int eq = pair.indexOf('=');
            if (eq > 0) {
                cookies.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
            } else if (!pair.isEmpty()) {
                cookies.put(pair, ""); // cookie present but with no value
            }
        }

        logger.debug("Parsed {} cookie(s) from Cookie header", cookies.size());
        return cookies;
    }

    /**
     * Returns the value of a named cookie, or null if not present.
     *
     * @param cookieName cookie name (case-sensitive per RFC 6265)
     */
    public String getCookieValue(String cookieName) {
        return getCookies().get(cookieName);
    }

    /**
     * Returns the User-Agent header value, or null if absent.
     */
    public String getUserAgent() {
        return getHeaderValue("User-Agent");
    }

    /**
     * Returns the full Content-Type header value including parameters,
     * e.g. "text/html; charset=utf-8", or null if absent.
     */
    public String getContentType() {
        return getHeaderValue("Content-Type");
    }

    /**
     * Returns only the media-type portion of Content-Type, stripping parameters.
     *
     * Example: "text/html; charset=UTF-8" -> "text/html"
     *
     * @return lowercased media type, or null if Content-Type is absent
     */
    public String getMediaType() {
        String ct = getContentType();
        if (ct == null) return null;
        int semi = ct.indexOf(';');
        return (semi >= 0 ? ct.substring(0, semi) : ct).trim().toLowerCase();
    }

    /**
     * Returns the charset parameter from Content-Type, or null if absent.
     *
     * Example: "text/html; charset=UTF-8" -> "utf-8"
     *
     * @return lowercased charset value, or null
     */
    public String getCharset() {
        String ct = getContentType();
        if (ct == null) return null;
        for (String param : ct.split(";")) {
            param = param.trim();
            if (param.toLowerCase().startsWith("charset=")) {
                return param.substring("charset=".length()).trim().toLowerCase();
            }
        }
        return null;
    }

    /**
     * Returns the Connection header value lowercased, or null if absent.
     * Typical values: "keep-alive", "close".
     */
    public String getConnection() {
        String val = getHeaderValue("Connection");
        return val != null ? val.toLowerCase() : null;
    }

    /**
     * Returns true if the client requested a persistent (keep-alive) connection.
     *
     * HTTP/1.1 defaults to keep-alive when no Connection header is present.
     * HTTP/1.0 requires an explicit "Connection: keep-alive" header.
     *
     * @param httpVersion the request version string, e.g. "HTTP/1.1"
     */
    public boolean isKeepAlive(String httpVersion) {
        String conn = getConnection();
        if (conn != null) {
            return conn.contains("keep-alive");
        }
        return "HTTP/1.1".equalsIgnoreCase(httpVersion);
    }

    // -------------------------------------------------------------------------
    // Output
    // -------------------------------------------------------------------------

    public void writeHeaders(PrintStream writer) {
        headers.stringPropertyNames().forEach(name ->
            writer.print(name + ": " + headers.getProperty(name) + "\r\n"));
    }

    /**
     * Removes a header (case-insensitive name match).
     *
     * @param hdrName header name
     * @return true if a header was removed, false otherwise
     */
    public boolean removeHeader(String hdrName) {
        String key = findExistingKey(hdrName);
        if (key != null) {
            headers.remove(key);
            return true;
        }
        return false;
    }

    /**
     * Returns an enumeration of all header names.
     */
    public Enumeration<Object> getAllHeaderNames() {
        return headers.keys();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Finds the existing Properties key that matches hdrName case-insensitively.
     * Returns null if no match exists.
     */
    private String findExistingKey(String hdrName) {
        for (String key : headers.stringPropertyNames()) {
            if (key.equalsIgnoreCase(hdrName)) {
                return key;
            }
        }
        return null;
    }
}