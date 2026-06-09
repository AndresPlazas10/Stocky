package com.stocky.printbridge;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.UUID;

public class BluetoothPrinter {
    private static final String TAG = "PrintBridgeBT";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int MAX_RETRIES = 2;
    private static final int RETRY_DELAY_MS = 2000;

    public static void print(PrintJobData job, BluetoothAdapter adapter, SharedPreferences prefs) throws Exception {
        byte[] data = serialize(job);
        sendRaw(data, job.openCashDrawer, adapter, prefs);
    }

    public static void sendRaw(byte[] data, boolean openCashDrawer, BluetoothAdapter adapter, SharedPreferences prefs) throws Exception {
        printBytes(data, openCashDrawer, adapter, prefs);
    }

    public static void printBytes(byte[] data, boolean openCashDrawer, BluetoothAdapter adapter, SharedPreferences prefs) throws Exception {
        String address = prefs.getString("deviceAddress", "");
        if (address == null || address.isEmpty()) throw new Exception("Selecciona y guarda una impresora");
        if (adapter == null || !adapter.isEnabled()) throw new Exception("Bluetooth apagado");

        Exception lastException = null;

        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            BluetoothDevice device = null;
            BluetoothSocket socket = null;
            try {
                if (attempt > 0) {
                    Log.w(TAG, "Retry attempt " + attempt + " for device " + address);
                    Thread.sleep(RETRY_DELAY_MS);
                }

                Log.d(TAG, "Connecting to device: " + address);
                device = adapter.getRemoteDevice(address);
                String deviceName = prefs.getString("deviceName", "");
                Log.d(TAG, "Device name: " + deviceName + " address: " + address);

                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                Log.d(TAG, "RFCOMM socket created, canceling discovery...");

                try {
                    adapter.cancelDiscovery();
                    Log.d(TAG, "Discovery canceled successfully");
                } catch (SecurityException e) {
                    Log.e(TAG, "SecurityException canceling discovery (Android 12+ permission)", e);
                }

                try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

                Log.d(TAG, "Connecting socket...");
                socket.connect();
                Log.d(TAG, "Socket connected, writing data: " + data.length + " bytes");

                OutputStream output = socket.getOutputStream();
                output.write(data);
                EscPos.feed(output, 1);
                EscPos.cut(output);
                if (openCashDrawer) EscPos.openCashDrawer(output);
                output.flush();
                Log.d(TAG, "Print completed successfully on attempt " + (attempt + 1));
                return;
            } catch (Exception e) {
                lastException = e;
                Log.e(TAG, "Print attempt " + (attempt + 1) + " failed: " + e.getMessage(), e);
            } finally {
                if (socket != null) {
                    try { socket.close(); } catch (Exception ignored) {
                        Log.w(TAG, "Socket close error: " + ignored.getMessage());
                    }
                }
            }
        }

        Log.e(TAG, "All " + (MAX_RETRIES + 1) + " print attempts failed");
        throw new Exception("Impresión falló después de " + (MAX_RETRIES + 1) + " intentos: " +
            (lastException != null ? lastException.getMessage() : "error desconocido"));
    }

    public static byte[] serialize(PrintJobData job) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        EscPos.init(out);
        EscPos.align(out, 1);
        EscPos.bold(out, true);
        EscPos.size(out, true);
        EscPos.writeLine(out, safe(job.header, "RECIBO"));
        EscPos.size(out, false);
        EscPos.bold(out, false);
        EscPos.writeLine(out, "");
        EscPos.align(out, 0);

        if (job.rawText != null && !job.rawText.trim().isEmpty()) {
            for (String line : job.rawText.split("\\n")) {
                EscPos.writeLine(out, line);
            }
        }

        EscPos.writeLine(out, "");
        EscPos.align(out, 1);
        EscPos.writeLine(out, safe(job.footer, "Gracias por su compra"));
        EscPos.align(out, 0);
        EscPos.feed(out, 3);
        EscPos.cut(out);
        if (job.openCashDrawer) EscPos.openCashDrawer(out);
        return out.toByteArray();
    }

    private static String safe(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) return fallback;
        return value.trim();
    }

    public static class EscPos {
        private static final int ESC = 0x1b;
        private static final int GS = 0x1d;

        static void init(ByteArrayOutputStream out) {
            cmd(out, ESC, 0x40);
        }

        static void align(ByteArrayOutputStream out, int mode) {
            cmd(out, ESC, 0x61, mode);
        }

        static void bold(ByteArrayOutputStream out, boolean enabled) {
            cmd(out, ESC, 0x45, enabled ? 1 : 0);
        }

        static void size(ByteArrayOutputStream out, boolean large) {
            cmd(out, GS, 0x21, large ? 0x11 : 0x00);
        }

        static void feed(ByteArrayOutputStream out, int lines) {
            cmd(out, ESC, 0x64, Math.max(1, lines));
        }

        static void cut(ByteArrayOutputStream out) {
            cmd(out, GS, 0x56, 0x42, 0x00);
        }

        static void openCashDrawer(ByteArrayOutputStream out) {
            cmd(out, ESC, 0x70, 0x00, 0x19, 0xFA);
        }

        static void feed(OutputStream out, int lines) throws Exception {
            out.write(new byte[]{(byte) ESC, 0x64, (byte) Math.max(1, lines)});
        }

        static void cut(OutputStream out) throws Exception {
            out.write(new byte[]{(byte) GS, 0x56, 0x42, 0x00});
        }

        static void openCashDrawer(OutputStream out) throws Exception {
            out.write(new byte[]{(byte) ESC, 0x70, 0x00, 0x19, (byte) 0xFA});
        }

        static void writeLine(ByteArrayOutputStream out, String value) throws Exception {
            out.write((clean(value) + "\n").getBytes("US-ASCII"));
        }

        private static void cmd(ByteArrayOutputStream out, int... bytes) {
            for (int b : bytes) out.write(b);
        }

        private static String clean(String value) {
            String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD);
            return normalized.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "").replaceAll("[^\\x20-\\x7E]", "");
        }
    }
}
