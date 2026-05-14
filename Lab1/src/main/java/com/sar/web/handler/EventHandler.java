package com.sar.web.handler;

import com.sar.service.EventBroadcaster;
import com.sar.web.http.Request;
import com.sar.web.http.Response;
import com.sar.web.http.ReplyCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.OutputStream;

/**
 * EventHandler manages Server-Sent Events (SSE) connections.
 *
 * <h2>Why SSE is different from normal HTTP</h2>
 * A normal handler writes a complete response and returns — ConnectionThread
 * then closes the socket.  SSE must keep the socket open indefinitely so the
 * server can push events at any time.  This handler achieves that by:
 *
 * <ol>
 *   <li>Calling {@code response.markAsSseConnection()} so ConnectionThread
 *       knows to skip {@code send_Answer()} and the keep-alive loop.</li>
 *   <li>Writing the HTTP status line and SSE headers directly to the raw
 *       {@code OutputStream} stored in {@code response} (put there by
 *       ConnectionThread before the controller runs).</li>
 *   <li>Registering the stream with {@link EventBroadcaster} so future
 *       {@code broadcast()} calls reach this client.</li>
 *   <li>Blocking in a heartbeat loop — sending {@code : ping\n\n} every
 *       {@value #HEARTBEAT_INTERVAL_MS} ms — until the client disconnects.
 *       The heartbeat serves two purposes: it keeps the TCP connection alive
 *       through proxies/NAT, and it detects dead connections quickly so they
 *       can be removed from the broadcaster list.</li>
 * </ol>
 *
 * <h2>SSE event format (RFC)</h2>
 * <pre>
 *   data: {"type":"group.created","groupNumber":42}\n\n
 * </pre>
 * Comment / heartbeat lines:
 * <pre>
 *   : ping\n\n
 * </pre>
 */
public class EventHandler extends AbstractRequestHandler {
    private static final Logger logger = LoggerFactory.getLogger(EventHandler.class);

    /** Period between heartbeat pings sent to keep the connection alive. */
    private static final int HEARTBEAT_INTERVAL_MS = 15_000;

    /** SSE-required status line + headers, written once on connection open. */
    private static final String SSE_STATUS  = "HTTP/1.1 200 OK\r\n";
    private static final String SSE_HEADERS =
            "Content-Type: text/event-stream\r\n" +
            "Cache-Control: no-cache\r\n"          +
            "Connection: keep-alive\r\n"           +
            "\r\n";  // blank line ends HTTP headers

    /** SSE comment line used as a heartbeat ping. */
    private static final byte[] HEARTBEAT = ": ping\n\n".getBytes();

    private final EventBroadcaster eventBroadcaster;

    public EventHandler(EventBroadcaster eventBroadcaster) {
        this.eventBroadcaster = eventBroadcaster;
    }

    // -------------------------------------------------------------------------
    // GET /events  — establish SSE stream
    // -------------------------------------------------------------------------

    /**
     * Establishes an SSE connection.
     *
     * <p>This method does NOT return until the client disconnects. The calling
     * thread (a {@code ConnectionThread}) is intentionally held here for the
     * lifetime of the SSE session.
     */
    @Override
    protected void handleGet(Request request, Response response) {

        // Step 1 — claim the connection for SSE.
        // Tells ConnectionThread.run() to skip send_Answer() and the
        // keep-alive loop; we own the socket from here.
        response.markAsSseConnection();

        // Step 2 — get the raw socket OutputStream.
        // ConnectionThread stored it in the Response before calling the controller.
        OutputStream out = response.getOutputStream();
        if (out == null) {
            // Should never happen if ConnectionThread is wired correctly.
            logger.error("SSE: no OutputStream available in Response — cannot open stream");
            response.setCode(ReplyCode.NOTIMPLEMENTED);
            response.setVersion(request.version);
            response.markAsSseConnection(); // prevent double send_Answer
            return;
        }

        String clientId = request.getClientAddress() + ":" + request.getClientPort();

        // Step 3 — send the HTTP status line and SSE headers directly to the wire.
        // We bypass send_Answer() entirely because SSE must NOT send a body
        // or flush-close the stream after the headers.
        try {
            out.write(SSE_STATUS.getBytes());
            out.write(SSE_HEADERS.getBytes());
            out.flush();
            logger.info("SSE connection opened for client {}", clientId);
        } catch (IOException e) {
            logger.warn("SSE: failed to send headers to {} — aborting", clientId);
            return;
        }

        // Step 4 — register with the broadcaster so this client receives events.
        eventBroadcaster.registerClient(out);
        logger.debug("SSE client {} registered ({} total)",
                clientId, eventBroadcaster.getClientCount());

        // Step 5 — heartbeat loop.
        // Block here, sending a ping comment every HEARTBEAT_INTERVAL_MS.
        // An IOException means the client has closed the connection.
        try {
            while (true) {
                Thread.sleep(HEARTBEAT_INTERVAL_MS);
                out.write(HEARTBEAT);
                out.flush();
                logger.trace("SSE heartbeat sent to {}", clientId);
            }
        } catch (IOException e) {
            // Client disconnected — this is normal, not an error.
            logger.info("SSE client {} disconnected", clientId);
        } catch (InterruptedException e) {
            // Thread interrupted (e.g. server shutdown)
            logger.info("SSE handler thread interrupted for client {}", clientId);
            Thread.currentThread().interrupt();
        } finally {
            // Step 6 — clean up: remove from broadcaster so no future writes
            // are attempted on the now-dead stream.
            eventBroadcaster.removeClient(out);
            logger.debug("SSE client {} unregistered ({} remaining)",
                    clientId, eventBroadcaster.getClientCount());
        }
    }

    // -------------------------------------------------------------------------
    // POST /events  — not supported
    // -------------------------------------------------------------------------

    @Override
    protected void handlePost(Request request, Response response) {
        // SSE is a unidirectional server→client protocol; POST makes no sense here.
        response.setCode(ReplyCode.NOTIMPLEMENTED);
        response.setVersion(request.version);
        response.setText("{\"error\":\"SSE endpoint only accepts GET requests\"}");
        response.setHeader("Content-Type", "application/json");
    }
}