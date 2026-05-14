package com.sar.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Broadcasts Server-Sent Events to all connected SSE clients.
 *
 * <h2>Thread safety</h2>
 * {@link CopyOnWriteArrayList} makes iteration safe under concurrent
 * register/remove/broadcast calls.  Writes to individual streams are not
 * synchronized because each stream belongs to exactly one client thread;
 * only the broadcaster itself writes to it, so there is no contention.
 *
 * <h2>Dead-client removal</h2>
 * If {@code write()} or {@code flush()} throws an {@link IOException} the
 * client is silently removed from the list.  The removal happens inside the
 * broadcast loop using an iterator-safe pattern (CopyOnWriteArrayList allows
 * removal during iteration via {@code remove()}).
 */
public class EventBroadcaster {
    private static final Logger logger = LoggerFactory.getLogger(EventBroadcaster.class);

    private final List<OutputStream> clients = new CopyOnWriteArrayList<>();

    /**
     * Registers a new SSE client.
     * The stream must remain open for the duration of the connection.
     *
     * @param clientStream socket OutputStream belonging to the SSE client
     */
    public void registerClient(OutputStream clientStream) {
        clients.add(clientStream);
        logger.info("SSE client registered ({} total)", clients.size());
    }

    /**
     * Removes a client — called when the client disconnects or the
     * EventHandler heartbeat detects a dead connection.
     *
     * @param clientStream the stream to remove
     */
    public void removeClient(OutputStream clientStream) {
        clients.remove(clientStream);
        logger.info("SSE client removed ({} remaining)", clients.size());
    }

    /**
     * Broadcasts an event to every registered client.
     *
     * <p>The message is wrapped in the SSE {@code data:} frame format:
     * <pre>data: {eventData}\n\n</pre>
     *
     * <p>Clients that fail to receive the event (IOException) are removed
     * automatically.
     *
     * @param eventData raw event payload — typically a JSON string
     */
    public void broadcast(String eventData) {
        if (clients.isEmpty()) {
            logger.debug("broadcast() called but no SSE clients connected");
            return;
        }

        // SSE frame: "data: " prefix + payload + two newlines
        String frame = "data: " + eventData + "\n\n";
        byte[] bytes = frame.getBytes(StandardCharsets.UTF_8);

        logger.debug("Broadcasting SSE event to {} client(s): {}", clients.size(), eventData);

        for (OutputStream client : clients) {
            try {
                client.write(bytes);
                client.flush();
            } catch (IOException e) {
                // Write failed — client is gone; remove it so we don't retry
                logger.warn("SSE client unreachable during broadcast — removing");
                removeClient(client);
            }
        }
    }

    /** Returns the number of currently connected SSE clients. */
    public int getClientCount() {
        return clients.size();
    }
}