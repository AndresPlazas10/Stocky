package com.stocky.printbridge;

import android.bluetooth.BluetoothAdapter;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.HashMap;
import java.util.Map;

public class PrintBridgeHttpServer {
    private static final String TAG = "PrintBridgeHttp";
    private static final String PREFS = "stocky_print_bridge";
    private static final int DEFAULT_PORT = 41781;

    private ServerSocket serverSocket;
    private Thread serverThread;
    private volatile boolean running = false;
    private final BluetoothAdapter bluetoothAdapter;
    private final SharedPreferences prefs;

    public PrintBridgeHttpServer(BluetoothAdapter bluetoothAdapter, SharedPreferences prefs) {
        this.bluetoothAdapter = bluetoothAdapter;
        this.prefs = prefs;
    }

    public synchronized void start() {
        if (running) return;
        running = true;
        ensureToken();

        serverThread = new Thread(new Runnable() {
            @Override
            public void run() {
                ServerSocket localSocket = null;
                try {
                    if (!running) return;
                    localSocket = new ServerSocket(DEFAULT_PORT, 8, InetAddress.getByName("127.0.0.1"));
                    serverSocket = localSocket;
                    Log.i(TAG, "HTTP server started on 127.0.0.1:" + DEFAULT_PORT);

                    while (running) {
                        Socket client = null;
                        try {
                            client = localSocket.accept();
                            handleClient(client);
                        } catch (Exception e) {
                            if (running) Log.e(TAG, "Client error", e);
                        } finally {
                            if (client != null) try { client.close(); } catch (Exception ignored) {}
                        }
                    }
                } catch (Exception e) {
                    if (running) {
                        Log.e(TAG, "Server start failed", e);
                        running = false;
                    }
                } finally {
                    if (localSocket != null) {
                        try { localSocket.close(); } catch (Exception ignored) {}
                    }
                    serverSocket = null;
                }
            }
        }, "PrintBridgeHttp");
        serverThread.setDaemon(true);
        serverThread.start();
    }

    public synchronized void stop() {
        running = false;
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (Exception e) {
                Log.e(TAG, "Server close error", e);
            }
        }
        serverSocket = null;
        serverThread = null;
    }

    private void handleClient(Socket client) {
        try {
            client.setSoTimeout(15000);
            InputStream input = client.getInputStream();
            OutputStream output = client.getOutputStream();

            String requestLine = readLine(input);
            if (requestLine == null || requestLine.isEmpty()) {
                client.close();
                return;
            }

            String[] parts = requestLine.split(" ");
            if (parts.length < 2) {
                client.close();
                return;
            }

            String method = parts[0];
            String path = parts[1];

            Map<String, String> headers = new HashMap<>();
            String headerLine;
            while ((headerLine = readLine(input)) != null && !headerLine.isEmpty()) {
                int colon = headerLine.indexOf(':');
                if (colon > 0) {
                    String key = headerLine.substring(0, colon).trim().toLowerCase();
                    String value = headerLine.substring(colon + 1).trim();
                    headers.put(key, value);
                }
            }

            String body = "";
            String contentLengthStr = headers.get("content-length");
            if (contentLengthStr != null) {
                try {
                    int contentLength = Integer.parseInt(contentLengthStr.trim());
                    if (contentLength < 0 || contentLength > 512 * 1024) {
                        sendResponse(output, 413, "{\"ok\":false,\"error\":\"Payload demasiado grande\"}");
                        client.close();
                        return;
                    }
                    byte[] bodyBytes = new byte[contentLength];
                    int read = 0;
                    while (read < contentLength) {
                        int n = input.read(bodyBytes, read, contentLength - read);
                        if (n < 0) break;
                        read += n;
                    }
                    body = new String(bodyBytes, 0, read, "UTF-8");
                } catch (NumberFormatException e) {
                    Log.e(TAG, "Invalid Content-Length: " + contentLengthStr);
                }
            }

            if ("OPTIONS".equals(method)) {
                sendCorsResponse(output, 204, "{}");
            } else if ("GET".equals(method) && "/v1/status".equals(path)) {
                handleStatus(output);
            } else if ("POST".equals(method) && "/v1/print".equals(path)) {
                handlePrint(output, headers, body);
            } else {
                sendCorsResponse(output, 404, "{\"ok\":false,\"error\":\"Ruta no encontrada\"}");
            }

            client.close();
        } catch (Exception e) {
            Log.e(TAG, "Request handling error", e);
            try { client.close(); } catch (Exception ignored) {}
        }
    }

    private void handleStatus(OutputStream output) throws Exception {
        JSONObject status = new JSONObject();
        String deviceAddress = prefs.getString("deviceAddress", "");
        boolean hasPrinter = !deviceAddress.isEmpty();
        status.put("ok", true);
        status.put("enabled", hasPrinter);
        status.put("hasPrinter", hasPrinter);
        status.put("name", hasPrinter ? prefs.getString("deviceName", "") : "");
        status.put("paperWidthMm", parseInt(prefs.getString("paper", "80"), 80));
        sendCorsResponse(output, 200, status.toString());
    }

    private void handlePrint(OutputStream output, Map<String, String> headers, String body) throws Exception {
        String token = headers.get("x-stocky-bridge-token");
        boolean hasToken = token != null && !token.trim().isEmpty();
        boolean tokenValid = hasToken && token.trim().equals(prefs.getString("bridgeToken", ""));
        if (hasToken && !tokenValid) {
            sendCorsResponse(output, 401, "{\"ok\":false,\"error\":\"Token invalido\"}");
            return;
        }

        String deviceAddress = prefs.getString("deviceAddress", "");
        if (deviceAddress.isEmpty()) {
            sendCorsResponse(output, 503, "{\"ok\":false,\"error\":\"No hay impresora configurada. Abre Stocky Print y configura una impresora.\"}");
            return;
        }

        JSONObject payload;
        try {
            payload = new JSONObject(body);
        } catch (Exception e) {
            sendCorsResponse(output, 400, "{\"ok\":false,\"error\":\"JSON invalido\"}");
            return;
        }

        JSONObject receipt = payload.optJSONObject("receipt");
        if (receipt == null || !"sale".equals(receipt.optString("type"))) {
            sendCorsResponse(output, 422, "{\"ok\":false,\"error\":\"Tipo de recibo no soportado\"}");
            return;
        }

        JSONArray itemsArray = receipt.optJSONArray("items");
        JSONObject totals = receipt.optJSONObject("totals");
        if (itemsArray == null || itemsArray.length() == 0) {
            sendCorsResponse(output, 422, "{\"ok\":false,\"error\":\"El recibo no tiene items\"}");
            return;
        }
        if (totals == null || !totals.has("totalText")) {
            sendCorsResponse(output, 422, "{\"ok\":false,\"error\":\"El recibo no tiene total\"}");
            return;
        }

        final int paperWidthMm = parseInt(prefs.getString("paper", "80"), 80);
        final boolean openCashDrawer = prefs.getBoolean("cashDrawer", false);
        final byte[] escposData = ReceiptSerializer.serialize(receipt, paperWidthMm);

        sendCorsResponse(output, 202, "{\"ok\":true,\"message\":\"Impresion iniciada\"}");

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.i(TAG, "Async print starting: " + escposData.length + " bytes");
                    BluetoothPrinter.printBytes(escposData, openCashDrawer, bluetoothAdapter, prefs);
                    Log.i(TAG, "Async print completed successfully");
                } catch (Exception e) {
                    Log.e(TAG, "Async print failed", e);
                }
            }
        }, "AsyncPrintJob").start();
    }

    private void sendCorsResponse(OutputStream output, int status, String body) throws Exception {
        String response = "HTTP/1.1 " + status + " " + statusText(status) + "\r\n" +
                "Content-Type: application/json\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Headers: Content-Type, X-Stocky-Bridge-Token, X-Stocky-Origin\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Content-Length: " + body.getBytes("UTF-8").length + "\r\n" +
                "Connection: close\r\n" +
                "\r\n" +
                body;
        output.write(response.getBytes("UTF-8"));
        output.flush();
    }

    private void sendResponse(OutputStream output, int status, String body) throws Exception {
        sendCorsResponse(output, status, body);
    }

    private String readLine(InputStream input) throws Exception {
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int b;
        while ((b = input.read()) >= 0) {
            if (b == '\r') continue;
            if (b == '\n') return new String(line.toByteArray(), "UTF-8");
            line.write(b);
        }
        return line.size() > 0 ? new String(line.toByteArray(), "UTF-8") : null;
    }

    private String statusText(int status) {
        switch (status) {
            case 200: return "OK";
            case 204: return "No Content";
            case 400: return "Bad Request";
            case 401: return "Unauthorized";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 413: return "Payload Too Large";
            case 422: return "Unprocessable Entity";
            case 500: return "Internal Server Error";
            case 503: return "Service Unavailable";
            default: return "Unknown";
        }
    }

    private int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    private void ensureToken() {
        if (!prefs.getString("bridgeToken", "").trim().isEmpty()) return;
        String token = java.util.UUID.randomUUID().toString().replace("-", "");
        prefs.edit().putString("bridgeToken", token).apply();
        Log.i(TAG, "Generated bridge token: " + token);
    }

    private boolean validateToken(Map<String, String> headers) {
        String token = headers.get("x-stocky-bridge-token");
        if (token == null) token = "";
        String saved = prefs.getString("bridgeToken", "");
        return saved.equals(token.trim());
    }
}
