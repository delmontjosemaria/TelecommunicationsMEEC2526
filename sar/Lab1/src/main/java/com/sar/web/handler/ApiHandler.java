package com.sar.web.handler;

import com.sar.model.Group;
import com.sar.service.GroupService;
import com.sar.web.http.Request;
import com.sar.web.http.Response;
import com.sar.web.http.ReplyCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Properties;

public class ApiHandler extends AbstractRequestHandler {
    private static final Logger logger = LoggerFactory.getLogger(ApiHandler.class);

    private static final String JSON_CONTENT_TYPE = "application/json; charset=UTF-8";
    private static final int GROUP_SIZE = 2;

    private final GroupService groupService;

    public ApiHandler(GroupService groupService) {
        this.groupService = groupService;
    }

    @Override
    protected void handleGet(Request request, Response response) {
        logger.debug("GET /api - fetching all groups");

        String body;

        try {
            List<Group> groups = groupService.getAllGroups();
            body = buildGroupsTable(groups);

            response.setCode(ReplyCode.OK);
            response.setVersion(request.version);
            response.setText(body);

            response.setHeader("Content-Type", "text/html; charset=UTF-8");
            response.setHeader("Content-Length",
                    String.valueOf(body.getBytes(StandardCharsets.UTF_8).length));
            response.setHeader("Cache-Control", "no-store");

        } catch (Exception e) {
            logger.error("Failed to fetch groups", e);

            body = "<p>Error loading groups</p>";

            response.setCode(ReplyCode.NOTIMPLEMENTED);
            response.setVersion(request.version);
            response.setText(body);
            response.setHeader("Content-Type", "text/html; charset=UTF-8");
        }
    }

    @Override
    protected void handlePost(Request request, Response response) {
        logger.debug("POST /api - creating/updating group");

        try {
            parsePostParameters(request);
        } catch (UnsupportedEncodingException e) {
            logger.error("Failed to decode POST body", e);
            sendError(response, request, ReplyCode.BADREQ, "Failed to decode request body");
            return;
        }

        Properties params = request.getPostParameters();

        String groupNumber = params.getProperty("groupNumber", "").trim();
        if (groupNumber.isEmpty()) {
            sendError(response, request, ReplyCode.BADREQ, "Missing field: groupNumber");
            return;
        }
        try {
            int gn = Integer.parseInt(groupNumber);
            if (gn <= 0) throw new NumberFormatException("non-positive");
        } catch (NumberFormatException e) {
            sendError(response, request, ReplyCode.BADREQ,
                    "Invalid groupNumber: must be a positive integer");
            return;
        }

        String[] numbers = new String[GROUP_SIZE];
        String[] names   = new String[GROUP_SIZE];
        for (int i = 0; i < GROUP_SIZE; i++) {
            String number = params.getProperty("number" + i, "").trim();
            String name   = params.getProperty("name"   + i, "").trim();
            if (number.isEmpty()) {
                sendError(response, request, ReplyCode.BADREQ, "Missing field: number" + i);
                return;
            }
            if (name.isEmpty()) {
                sendError(response, request, ReplyCode.BADREQ, "Missing field: name" + i);
                return;
            }
            numbers[i] = number;
            names[i]   = name;
        }

        boolean counter = "on".equalsIgnoreCase(params.getProperty("counter", "off"));

        try {
            groupService.saveGroup(groupNumber, numbers, names, counter);
            logger.info("Group {} saved (counter={})", groupNumber, counter);
        } catch (Exception e) {
            logger.error("Failed to save group {}", groupNumber, e);
            sendError(response, request, ReplyCode.NOTIMPLEMENTED,
                    "Failed to save group: " + e.getMessage());
            return;
        }

        String body = "{\"status\":\"ok\",\"message\":\"Group " + groupNumber + " saved successfully\"}";
        response.setCode(ReplyCode.OK);
        response.setVersion(request.version);
        response.setText(body);
        setJsonHeaders(body, request, response);
        response.setHeader("Set-Cookie", "lastGroupNumber=" + groupNumber + "; Path=/");
    }

    @Override
    protected void handleDelete(Request request, Response response) {
        logger.debug("DELETE /api - deleting group");

        String groupNumber = getQueryParam(request.urlText, "groupNumber");
        if (groupNumber == null || groupNumber.isEmpty()) {
            sendError(response, request, ReplyCode.BADREQ,
                    "Missing query parameter: groupNumber");
            return;
        }

        if (!groupService.groupExists(groupNumber)) {
            sendError(response, request, ReplyCode.NOTFOUND,
                    "Group not found: " + groupNumber);
            return;
        }

        try {
            groupService.deleteGroup(groupNumber);
            logger.info("Group {} deleted", groupNumber);
        } catch (Exception e) {
            logger.error("Failed to delete group {}", groupNumber, e);
            sendError(response, request, ReplyCode.NOTIMPLEMENTED,
                    "Failed to delete group: " + e.getMessage());
            return;
        }

        String body = "{\"status\":\"ok\",\"message\":\"Group " + groupNumber + " deleted\"}";
        response.setCode(ReplyCode.OK);
        response.setVersion(request.version);
        response.setText(body);
        setJsonHeaders(body, request, response);
    }



    //Serialises a list of groups to a JSON array.
    private String buildGroupsJson(List<Group> groups) {
        StringBuilder sb = new StringBuilder("[");
        for (int g = 0; g < groups.size(); g++) {
            Group group = groups.get(g);
            if (g > 0) sb.append(",");
            sb.append("{");
            sb.append("\"groupNumber\":\"").append(escape(group.getGroupNumber())).append("\",");
            sb.append("\"members\":[");
            for (int i = 0; i < GROUP_SIZE; i++) {
                if (i > 0) sb.append(",");
                Group.Member member = group.getMember(i);
                sb.append("{");
                if (member != null) {
                    sb.append("\"number\":\"").append(escape(member.getNumber())).append("\",");
                    sb.append("\"name\":\"").append(escape(member.getName())).append("\"");
                } else {
                    sb.append("\"number\":\"\",\"name\":\"\"");
                }
                sb.append("}");
            }
            sb.append("],");
            sb.append("\"counter\":").append(group.isCounter()).append(",");
            String lastUpdate = group.getLastUpdate();
            sb.append("\"lastUpdate\":\"").append(escape(lastUpdate != null ? lastUpdate : "")).append("\"");
            sb.append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    //Escapes characters that would break JSON string values. 
    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private void setJsonHeaders(String body, Request request, Response response) {
        int byteLength = body.getBytes(StandardCharsets.UTF_8).length;
        response.setHeader("Content-Type",   JSON_CONTENT_TYPE);
        response.setHeader("Content-Length", String.valueOf(byteLength));
        response.setHeader("Cache-Control",  "no-store");
        boolean keepAlive = request.headers.isKeepAlive(request.version);
        response.setHeader("Connection", keepAlive ? "keep-alive" : "close");
    }

    private void sendError(Response response, Request request, int replyCode, String message) {
        String body = "{\"status\":\"error\",\"message\":\"" + escape(message) + "\"}";
        logger.warn("ApiHandler error ({}): {}", replyCode, message);
        response.setCode(replyCode);
        response.setVersion(request.version);
        response.setText(body);
        setJsonHeaders(body, request, response);
    }

    private void parsePostParameters(Request request) throws UnsupportedEncodingException {
        Properties params = request.getPostParameters();
        params.clear();
        String body = request.text;
        if (body == null || body.isEmpty()) return;
        for (String pair : body.split("&")) {
            if (pair.isEmpty()) continue;
            int eq = pair.indexOf('=');
            if (eq <= 0) {
                params.setProperty(URLDecoder.decode(pair, "UTF-8").trim(), "");
                continue;
            }
            String key   = URLDecoder.decode(pair.substring(0, eq),  "UTF-8").trim();
            String value = URLDecoder.decode(pair.substring(eq + 1), "UTF-8").trim();
            params.setProperty(key, value);
        }
        logger.debug("Parsed {} POST parameter(s)", params.size());
    }

    private String getQueryParam(String urlText, String paramName) {
        int qmark = urlText.indexOf('?');
        if (qmark < 0) return null;
        for (String pair : urlText.substring(qmark + 1).split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0) continue;
            if (pair.substring(0, eq).trim().equalsIgnoreCase(paramName)) {
                try {
                    return URLDecoder.decode(pair.substring(eq + 1).trim(), "UTF-8");
                } catch (UnsupportedEncodingException e) {
                    return pair.substring(eq + 1).trim();
                }
            }
        }
        return null;
    }

    private String buildGroupsTable(List<Group> groups) {
    StringBuilder sb = new StringBuilder();

    sb.append("<table border='1' style='width:100%; border-collapse:collapse;'>");
    sb.append("<tr>");
    sb.append("<th>Group</th>");
    sb.append("<th>Member 1</th>");
    sb.append("<th>Member 2</th>");
    sb.append("<th>Counter</th>");
    sb.append("</tr>");

    for (Group group : groups) {
        sb.append("<tr>");

        sb.append("<td>").append(group.getGroupNumber()).append("</td>");

        for (int i = 0; i < 2; i++) {
            Group.Member m = group.getMember(i);

            if (m != null) {
                sb.append("<td>")
                  .append(m.getNumber())
                  .append(" - ")
                  .append(m.getName())
                  .append("</td>");
            } else {
                sb.append("<td></td>");
            }
        }

        sb.append("<td>").append(group.isCounter()).append("</td>");

        sb.append("</tr>");
    }

    sb.append("</table>");

    return sb.toString();
    }
}