package com.sar.server;

import com.sar.controller.HttpController;
import com.sar.web.http.Request;
import com.sar.web.http.Response;
import com.sar.web.http.ReplyCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.net.ssl.SSLSocket;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.StringTokenizer;

public class ConnectionThread extends Thread {
    private static final Logger logger = LoggerFactory.getLogger(ConnectionThread.class);

    private static final int DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 5_000;

    private final HttpController controller;
    private final Main           HTTPServer;
    private final ServerSocket   ServerSock;
    private final Socket         client;
    private final boolean        isPlainHttp;

    public ConnectionThread(Main HTTPServer, ServerSocket ServerSock,
            Socket client, HttpController controller) {
        this.HTTPServer  = HTTPServer;
        this.ServerSock  = ServerSock;
        this.client      = client;
        this.controller  = controller;
        this.isPlainHttp = !(client instanceof SSLSocket);
        setPriority(NORM_PRIORITY - 1);
    }

    //Handling requests and delegating respective headers info to header space
    public Request GetRequest(BufferedReader reader) throws IOException {

        //retrieves first line depending on the type of request
        String requestLine = reader.readLine();
        if (requestLine == null) {
            logger.debug("Connection closed before request line was received");
            return null;
        }
        logger.info("Request: {}", requestLine);

        StringTokenizer st = new StringTokenizer(requestLine); 
        if (st.countTokens() != 3) {
            logger.debug("Invalid request line (expected 3 tokens): '{}'", requestLine);
            return null;
        }

        Request req = new Request(client.getInetAddress().getHostAddress(), client.getPort(), ServerSock.getLocalPort());
        req.method  = st.nextToken();
        req.urlText = st.nextToken();
        req.urlText = req.urlText.replaceAll("[^\\x20-\\x7E]", ""); // remove lixo binário, por algum motivo estava a dar esse erro no nosso
        req.version = st.nextToken();

        // Parse all headers (Cookie, User-Agent, Content-Type, Connection …)
        req.headers.readHeaders(reader);

        // parsing the Cookie header into req.cookies so handlers can call
        // req.getCookies() without doing the split themselves.
        req.parseCookies();
        logger.debug("Cookies: {}", req.getCookies());

        // Read body when Content-Length > 0
        int contentLength = 0;
        try {
            String len = req.headers.getHeaderValue("Content-Length");
            if (len != null) contentLength = Integer.parseInt(len.trim());
        } catch (NumberFormatException e) {
            logger.error("Malformed Content-Length — rejecting request");
            return null;
        }

        if (contentLength > 0) {
            StringBuilder body = new StringBuilder(contentLength);
            char[] cbuf   = new char[contentLength];
            int totalRead = 0;
            while (totalRead < contentLength) {
                int n = reader.read(cbuf, 0, contentLength - totalRead);
                if (n < 0) break;
                body.append(cbuf, 0, n);
                totalRead += n;
            }
            if (totalRead != contentLength) {
                logger.warn("Body truncated: read {} bytes but Content-Length was {} bytes",
                        totalRead, contentLength);
                return null;
            }
            req.text = body.toString();
            logger.debug("Request body: '{}'", req.text);
        }

        return req;
    }

    //In case the client tries to access to the server through HTTP port instead of HTTPS
    private void sendHttpsRedirect(Request req, PrintStream printer) throws IOException {
        String host = req.headers.getHeaderValue("Host");
        if (host == null || host.isEmpty()) {
            host = client.getLocalAddress().getHostName();
        } else {
            int colon = host.lastIndexOf(':');
            if (colon >= 0) host = host.substring(0, colon);
        }

        String location = "https://" + host + ":" + Integer.toString(HTTPServer.getPortHTTPS()) + req.urlText;
        logger.info("Redirecting plain-HTTP request to: {}", location);

        Response redirect = new Response(HTTPServer.ServerName);
        redirect.setVersion(req.version);
        redirect.setCode(ReplyCode.TMPREDIRECT);
        redirect.setHeader("Location",       location);
        redirect.setHeader("Content-Length", "0");
        redirect.setHeader("Connection",     "close");
        redirect.send_Answer(printer);
    }

    @Override
    public void run() {
        PrintStream textPrinter = null;
        Response    res         = null;
        Request     req         = null;

        try {
            InputStream  in  = client.getInputStream();
            OutputStream out = client.getOutputStream();

            BufferedReader textReader = new BufferedReader(
                    new InputStreamReader(in, "8859_1"));
            textPrinter = new PrintStream(out, false, "8859_1");

            req = GetRequest(textReader);
            res = new Response(HTTPServer.ServerName);

            if (req == null) {
                res.setError(ReplyCode.BADREQ, "HTTP/1.1");
                res.send_Answer(textPrinter);
                return;
            }

             if (ServerSock.getLocalPort() == HTTPServer.getPortHTTP()) {
                sendHttpsRedirect(req, textPrinter);
                return;
            }

            //give the Response the raw OutputStream so that
            // EventHandler.handleGet() can write SSE frames directly to the
            // wire without going through send_Answer().
            res.setOutputStream(out);

            controller.handleRequest(req, res);

            // if EventHandler claimed the connection, skip
            // send_Answer() and the keep-alive loop entirely.
            // The EventHandler heartbeat loop is already blocking above in
            // controller.handleRequest(); by the time we reach here the SSE
            // session is over and the socket is ready to be closed
            if (res.isSseConnection()) {
                logger.debug("SSE connection ended for {}:{}",
                        client.getInetAddress().getHostAddress(), client.getPort());
                return; // cleanup() runs in finally and can close the socket
            }

            res.send_Answer(textPrinter);

            // Keep-alive loop for normal (non-SSE) requests
            int keepAliveTimeout = HTTPServer.getKeepAlive() > 0 ? HTTPServer.getKeepAlive() : DEFAULT_KEEP_ALIVE_TIMEOUT_MS;

            while (req.headers.isKeepAlive(req.version)) {
                client.setSoTimeout(keepAliveTimeout);
                try {
                    req = GetRequest(textReader);
                } catch (SocketTimeoutException e) {
                    logger.debug("Keep-alive idle timeout ({}ms) — closing connection", keepAliveTimeout);
                    break;
                } finally {
                    client.setSoTimeout(0);
                }

                if (req == null) {
                    logger.debug("Keep-alive: client closed connection or bad request");
                    break;
                }

                res = new Response(HTTPServer.ServerName);
                res.setOutputStream(out); // inject for every new response
                controller.handleRequest(req, res);

                if (res.isSseConnection()) {
                    // Client upgraded to SSE mid-keep-alive — session is now done
                    break;
                }

                res.send_Answer(textPrinter);
            }

        } catch (Exception e) {
            logger.error("Error processing request", e);
            if (res != null && textPrinter != null) {
                try {
                    res.setError(ReplyCode.BADREQ, req != null ? req.version : "HTTP/1.1");
                    res.send_Answer(textPrinter);
                } catch (IOException ioException) {
                    logger.error("Error sending error response", ioException);
                }
            }
        } finally {
            cleanup(textPrinter);
        }
    }

    private void cleanup(PrintStream textPrinter) {
        try {
            if (textPrinter != null) textPrinter.close();
            if (client != null) client.close();
        } catch (IOException e) {
            logger.error("Error during cleanup", e);
        } finally {
            HTTPServer.thread_ended();
            logger.debug("Connection closed for client: {}:{}", client.getInetAddress().getHostAddress(), client.getPort());
        }
    }
}