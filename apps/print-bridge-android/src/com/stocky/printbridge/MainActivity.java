package com.stocky.printbridge;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String PREFS = "stocky_print_bridge";
    private static final String SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB";
    private static final int INDIGO = Color.rgb(79, 70, 229);
    private static final int PURPLE = Color.rgb(124, 58, 237);
    private static final int BG = Color.rgb(238, 242, 255);
    private static final int TEXT = Color.rgb(15, 23, 42);
    private static final int MUTED = Color.rgb(100, 116, 139);

    private SharedPreferences prefs;
    private BluetoothAdapter bluetoothAdapter;
    private final List<BluetoothDevice> devices = new ArrayList<>();
    private ArrayAdapter<String> deviceAdapter;
    private Spinner deviceSpinner;
    private Spinner paperSpinner;
    private CheckBox webBridgeCheck;
    private CheckBox voluntaryTipCheck;
    private EditText businessNameInput;
    private EditText footerInput;
    private EditText tipInput;
    private TextView tokenText;
    private TextView statusText;
    private LocalPrintServer localServer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        ensureToken();
        requestBluetoothPermissions();
        buildUi();
        loadSettings();
        refreshBondedDevices();
        syncServer();
    }

    @Override
    protected void onDestroy() {
        if (localServer != null) localServer.stopServerSocket();
        super.onDestroy();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(24), dp(18), dp(24));
        scroll.addView(root);

        TextView eyebrow = text("Stocky Print Bridge", 13, PURPLE, true);
        root.addView(eyebrow);

        TextView title = text("Impresora termica Bluetooth", 27, TEXT, true);
        title.setPadding(0, dp(4), 0, dp(6));
        root.addView(title);

        TextView subtitle = text("Configura una impresora ESC/POS emparejada y prueba la impresion desde Android.", 14, MUTED, false);
        root.addView(subtitle);

        statusText = pill("Iniciando...");
        root.addView(statusText);

        root.addView(sectionTitle("Conexion"));
        deviceSpinner = new Spinner(this);
        deviceAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new ArrayList<String>());
        deviceSpinner.setAdapter(deviceAdapter);
        root.addView(label("Impresora emparejada"));
        root.addView(deviceSpinner);

        LinearLayout buttonRow = row();
        Button scanButton = button("Escanear emparejadas", false);
        scanButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                refreshBondedDevices();
            }
        });
        Button settingsButton = button("Ajustes Bluetooth", false);
        settingsButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
            }
        });
        buttonRow.addView(scanButton, weightParams());
        buttonRow.addView(settingsButton, weightParams());
        root.addView(buttonRow);

        root.addView(sectionTitle("Configuracion"));
        root.addView(label("Tamano de papel"));
        paperSpinner = new Spinner(this);
        ArrayAdapter<String> paperAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"58mm", "80mm", "104mm"});
        paperSpinner.setAdapter(paperAdapter);
        root.addView(paperSpinner);

        webBridgeCheck = new CheckBox(this);
        webBridgeCheck.setText("Permitir impresion desde Stocky Web/Mobile");
        webBridgeCheck.setTextColor(TEXT);
        webBridgeCheck.setPadding(0, dp(10), 0, dp(10));
        root.addView(webBridgeCheck);

        root.addView(label("Token de emparejamiento"));
        tokenText = pill(prefs.getString("token", ""));
        root.addView(tokenText);

        root.addView(sectionTitle("Recibo"));
        root.addView(label("Nombre del negocio"));
        businessNameInput = input("Sistema Stocky", false);
        root.addView(businessNameInput);

        root.addView(label("Mensaje final"));
        footerInput = input("Gracias por su compra", false);
        root.addView(footerInput);

        voluntaryTipCheck = new CheckBox(this);
        voluntaryTipCheck.setText("Agregar propina voluntaria");
        voluntaryTipCheck.setTextColor(TEXT);
        root.addView(voluntaryTipCheck);

        root.addView(label("Valor de propina"));
        tipInput = input("0", true);
        root.addView(tipInput);

        LinearLayout actions = row();
        Button saveButton = button("Guardar", true);
        saveButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                saveSettings();
            }
        });
        Button testButton = button("Imprimir prueba", false);
        testButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                printTest();
            }
        });
        actions.addView(testButton, weightParams());
        actions.addView(saveButton, weightParams());
        root.addView(actions);

        setContentView(scroll);
    }

    private void requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= 31) {
            List<String> permissions = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_SCAN);
            }
            if (!permissions.isEmpty()) requestPermissions(permissions.toArray(new String[0]), 10);
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 11);
        }
    }

    private void refreshBondedDevices() {
        devices.clear();
        deviceAdapter.clear();

        if (bluetoothAdapter == null) {
            toast("Este telefono no tiene Bluetooth disponible");
            setStatus("Bluetooth no disponible");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            toast("Activa Bluetooth para listar impresoras");
            setStatus("Bluetooth apagado");
            return;
        }

        try {
            Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
            String selectedAddress = prefs.getString("deviceAddress", "");
            int selectedIndex = 0;
            int index = 0;
            for (BluetoothDevice device : bonded) {
                devices.add(device);
                String label = safeDeviceName(device) + " - " + device.getAddress();
                deviceAdapter.add(label);
                if (device.getAddress().equals(selectedAddress)) selectedIndex = index;
                index++;
            }
            if (devices.isEmpty()) deviceAdapter.add("No hay dispositivos emparejados");
            deviceSpinner.setSelection(selectedIndex);
            setStatus(devices.isEmpty() ? "Sin impresoras emparejadas" : "Lista para configurar");
        } catch (SecurityException err) {
            setStatus("Permisos Bluetooth pendientes");
            toast("Concede permisos Bluetooth");
        }
    }

    private void loadSettings() {
        String paper = prefs.getString("paper", "80");
        if ("58".equals(paper)) paperSpinner.setSelection(0);
        else if ("104".equals(paper)) paperSpinner.setSelection(2);
        else paperSpinner.setSelection(1);
        webBridgeCheck.setChecked(prefs.getBoolean("webBridge", false));
        voluntaryTipCheck.setChecked(prefs.getBoolean("tipEnabled", false));
        businessNameInput.setText(prefs.getString("businessName", "Sistema Stocky"));
        footerInput.setText(prefs.getString("footer", "Gracias por su compra"));
        tipInput.setText(String.valueOf(prefs.getInt("tipValue", 0)));
        tokenText.setText(prefs.getString("token", ""));
    }

    private void saveSettings() {
        int selected = deviceSpinner.getSelectedItemPosition();
        String address = selected >= 0 && selected < devices.size() ? devices.get(selected).getAddress() : "";
        String name = selected >= 0 && selected < devices.size() ? safeDeviceName(devices.get(selected)) : "";
        String paper = paperSpinner.getSelectedItem().toString().replace("mm", "");
        int tip = parseInt(tipInput.getText().toString(), 0);

        prefs.edit()
                .putString("deviceAddress", address)
                .putString("deviceName", name)
                .putString("paper", paper)
                .putBoolean("webBridge", webBridgeCheck.isChecked())
                .putString("businessName", businessNameInput.getText().toString().trim())
                .putString("footer", footerInput.getText().toString().trim())
                .putBoolean("tipEnabled", voluntaryTipCheck.isChecked())
                .putInt("tipValue", tip)
                .apply();

        syncServer();
        setStatus(address.isEmpty() ? "Guarda una impresora emparejada" : "Configuracion guardada");
        toast("Configuracion guardada");
    }

    private void printTest() {
        saveSettings();
        try {
            JSONObject receipt = new JSONObject();
            JSONObject header = new JSONObject();
            header.put("title", "PRUEBA STOCKY");
            header.put("businessName", prefs.getString("businessName", "Sistema Stocky"));
            header.put("dateText", new java.util.Date().toString());
            header.put("alignment", "center");
            receipt.put("type", "sale");
            receipt.put("header", header);
            receipt.put("metadata", new JSONArray()
                    .put(new JSONObject().put("label", "Bridge").put("value", "Android"))
                    .put(new JSONObject().put("label", "Impresora").put("value", prefs.getString("deviceName", ""))));
            receipt.put("items", new JSONArray().put(new JSONObject()
                    .put("name", "Impresion de prueba")
                    .put("quantity", 1)
                    .put("subtotalText", "0 COP")));
            receipt.put("totals", new JSONObject().put("totalText", "0 COP").put("total", 0));
            receipt.put("payment", new JSONObject().put("methodText", "Prueba"));
            receipt.put("footer", new JSONObject().put("message", prefs.getString("footer", "Gracias por su compra")).put("alignment", "center"));
            printReceipt(receipt);
            setStatus("Prueba enviada");
        } catch (Exception err) {
            setStatus("Error imprimiendo");
            toast(err.getMessage());
        }
    }

    private void printReceipt(JSONObject receipt) throws Exception {
        String address = prefs.getString("deviceAddress", "");
        if (address.isEmpty()) throw new Exception("Selecciona y guarda una impresora");
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) throw new Exception("Bluetooth apagado");

        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        BluetoothSocket socket = device.createRfcommSocketToServiceRecord(UUID.fromString(SPP_UUID));
        bluetoothAdapter.cancelDiscovery();
        socket.connect();
        OutputStream output = socket.getOutputStream();
        output.write(EscPos.serialize(receipt, parseInt(prefs.getString("paper", "80"), 80)));
        output.flush();
        socket.close();
    }

    private void syncServer() {
        boolean enabled = prefs.getBoolean("webBridge", false);
        if (enabled && localServer == null) {
            localServer = new LocalPrintServer();
            localServer.start();
        } else if (!enabled && localServer != null) {
            localServer.stopServerSocket();
            localServer = null;
        }
    }

    private void ensureToken() {
        if (!prefs.getString("token", "").isEmpty()) return;
        prefs.edit().putString("token", UUID.randomUUID().toString().replace("-", "")).apply();
    }

    private String safeDeviceName(BluetoothDevice device) {
        try {
            String name = device.getName();
            return name == null || name.trim().isEmpty() ? "Impresora Bluetooth" : name;
        } catch (SecurityException err) {
            return "Impresora Bluetooth";
        }
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(null, bold ? 1 : 0);
        view.setLineSpacing(0, 1.08f);
        return view;
    }

    private TextView label(String value) {
        TextView view = text(value, 13, Color.rgb(51, 65, 85), true);
        view.setPadding(0, dp(14), 0, dp(5));
        return view;
    }

    private TextView sectionTitle(String value) {
        TextView view = text(value, 18, TEXT, true);
        view.setPadding(0, dp(24), 0, dp(8));
        return view;
    }

    private TextView pill(String value) {
        TextView view = text(value, 14, INDIGO, true);
        view.setPadding(dp(14), dp(12), dp(14), dp(12));
        view.setBackgroundColor(Color.WHITE);
        return view;
    }

    private EditText input(String hint, boolean number) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        input.setTextColor(TEXT);
        input.setHintTextColor(MUTED);
        input.setInputType(number ? InputType.TYPE_CLASS_NUMBER : InputType.TYPE_CLASS_TEXT);
        return input;
    }

    private Button button(String label, boolean primary) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(primary ? Color.WHITE : INDIGO);
        button.setBackgroundColor(primary ? INDIGO : Color.WHITE);
        return button;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        row.setPadding(0, dp(10), 0, 0);
        return row;
    }

    private LinearLayout.LayoutParams weightParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.setMargins(dp(4), 0, dp(4), 0);
        return params;
    }

    private void setStatus(String value) {
        statusText.setText(value);
    }

    private void toast(String value) {
        Toast.makeText(this, value, Toast.LENGTH_LONG).show();
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    private int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception err) {
            return fallback;
        }
    }

    private class LocalPrintServer extends Thread {
        private ServerSocket serverSocket;
        private volatile boolean running = true;

        @Override
        public void run() {
            try {
                serverSocket = new ServerSocket(41781, 8, InetAddress.getByName("127.0.0.1"));
                while (running) {
                    Socket socket = serverSocket.accept();
                    handle(socket);
                }
            } catch (Exception ignored) {
            }
        }

        void stopServerSocket() {
            running = false;
            try {
                if (serverSocket != null) serverSocket.close();
            } catch (Exception ignored) {
            }
        }

        private void handle(Socket socket) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                try {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                    String requestLine = reader.readLine();
                    String token = "";
                    int length = 0;
                    String line;
                    while ((line = reader.readLine()) != null && !line.isEmpty()) {
                        String lower = line.toLowerCase();
                        if (lower.startsWith("x-stocky-bridge-token:")) token = line.substring(line.indexOf(':') + 1).trim();
                        if (lower.startsWith("content-length:")) length = parseInt(line.substring(line.indexOf(':') + 1), 0);
                    }
                    char[] bodyChars = new char[length];
                    if (length > 0) reader.read(bodyChars);

                    if (requestLine != null && requestLine.startsWith("GET /v1/status")) {
                        respond(socket, 200, "{\"ok\":true,\"platform\":\"android\"}");
                        return;
                    }

                    if (requestLine == null || !requestLine.startsWith("POST /v1/print")) {
                        respond(socket, 404, "{\"ok\":false}");
                        return;
                    }

                    if (!prefs.getString("token", "").equals(token)) {
                        respond(socket, 401, "{\"ok\":false,\"error\":\"token\"}");
                        return;
                    }

                    JSONObject payload = new JSONObject(new String(bodyChars));
                    JSONObject receipt = payload.getJSONObject("receipt");
                    applyReceiptConfig(receipt);
                    printReceipt(receipt);
                    respond(socket, 200, "{\"ok\":true}");
                } catch (Exception err) {
                    try {
                        respond(socket, 500, "{\"ok\":false,\"error\":\"" + sanitize(err.getMessage()) + "\"}");
                    } catch (Exception ignored) {
                    }
                }
                }
            }).start();
        }

        private void respond(Socket socket, int status, String body) throws Exception {
            OutputStream output = socket.getOutputStream();
            String statusText = status == 200 ? "OK" : "ERROR";
            byte[] bytes = body.getBytes("UTF-8");
            String headers = "HTTP/1.1 " + status + " " + statusText + "\r\n"
                    + "Content-Type: application/json\r\n"
                    + "Access-Control-Allow-Origin: *\r\n"
                    + "Content-Length: " + bytes.length + "\r\n\r\n";
            output.write(headers.getBytes("UTF-8"));
            output.write(bytes);
            output.flush();
            socket.close();
        }
    }

    private void applyReceiptConfig(JSONObject receipt) throws Exception {
        JSONObject header = receipt.optJSONObject("header");
        if (header != null) header.put("businessName", prefs.getString("businessName", "Sistema Stocky"));
        JSONObject footer = receipt.optJSONObject("footer");
        if (footer != null) footer.put("message", prefs.getString("footer", "Gracias por su compra"));
        if (prefs.getBoolean("tipEnabled", false)) {
            JSONObject totals = receipt.optJSONObject("totals");
            if (totals != null) {
                int tip = prefs.getInt("tipValue", 0);
                int base = totals.optInt("subtotal", totals.optInt("total", 0));
                totals.put("voluntaryTip", tip);
                totals.put("voluntaryTipText", tip + " COP");
                totals.put("total", base + tip);
                totals.put("totalText", (base + tip) + " COP");
            }
        }
    }

    private String sanitize(String value) {
        return value == null ? "error" : value.replace("\"", "'");
    }

    public static class EscPos {
        private static final int ESC = 0x1b;
        private static final int GS = 0x1d;

        static byte[] serialize(JSONObject receipt, int paperWidth) throws Exception {
            int columns = paperWidth == 58 ? 32 : paperWidth == 104 ? 64 : 48;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            cmd(out, ESC, 0x40);
            align(out, 1);
            bold(out, true);
            size(out, true);
            writeLine(out, receipt.optJSONObject("header").optString("title", "COMPROBANTE"));
            size(out, false);
            writeLine(out, receipt.optJSONObject("header").optString("businessName", "Sistema Stocky"));
            bold(out, false);
            writeLine(out, receipt.optJSONObject("header").optString("dateText", ""));
            align(out, 0);
            sep(out, columns);

            JSONArray metadata = receipt.optJSONArray("metadata");
            if (metadata != null) {
                for (int i = 0; i < metadata.length(); i++) {
                    JSONObject row = metadata.getJSONObject(i);
                    twoCols(out, row.optString("label") + ":", row.optString("value"), columns);
                }
            }
            sep(out, columns);
            bold(out, true);
            writeLine(out, "Producto");
            bold(out, false);

            JSONArray items = receipt.optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.getJSONObject(i);
                    String right = "x" + item.optInt("quantity", 0) + " " + item.optString("subtotalText", "");
                    twoCols(out, item.optString("name", "Item"), right, columns);
                }
            }

            sep(out, columns);
            JSONObject totals = receipt.optJSONObject("totals");
            if (totals != null && totals.optInt("voluntaryTip", 0) > 0) {
                twoCols(out, "Propina voluntaria:", totals.optString("voluntaryTipText"), columns);
            }
            bold(out, true);
            twoCols(out, "TOTAL:", totals == null ? "" : totals.optString("totalText", ""), columns);
            bold(out, false);
            sep(out, columns);
            JSONObject payment = receipt.optJSONObject("payment");
            twoCols(out, "Metodo:", payment == null ? "No especificado" : payment.optString("methodText", "No especificado"), columns);
            align(out, 1);
            JSONObject footer = receipt.optJSONObject("footer");
            writeLine(out, footer == null ? "Gracias por su compra" : footer.optString("message", "Gracias por su compra"));
            align(out, 0);
            cmd(out, ESC, 0x64, 0x03);
            cmd(out, GS, 0x56, 0x42, 0x00);
            return out.toByteArray();
        }

        private static void cmd(ByteArrayOutputStream out, int... bytes) {
            for (int b : bytes) out.write(b);
        }

        private static void align(ByteArrayOutputStream out, int mode) {
            cmd(out, ESC, 0x61, mode);
        }

        private static void bold(ByteArrayOutputStream out, boolean enabled) {
            cmd(out, ESC, 0x45, enabled ? 1 : 0);
        }

        private static void size(ByteArrayOutputStream out, boolean large) {
            cmd(out, GS, 0x21, large ? 0x11 : 0x00);
        }

        private static void sep(ByteArrayOutputStream out, int columns) throws Exception {
            writeLine(out, repeat("-", columns));
        }

        private static void twoCols(ByteArrayOutputStream out, String left, String right, int columns) throws Exception {
            left = clean(left);
            right = clean(right);
            int spaces = Math.max(1, columns - left.length() - right.length());
            if (left.length() + right.length() + spaces <= columns) {
                writeLine(out, left + repeat(" ", spaces) + right);
            } else {
                writeLine(out, left);
                writeLine(out, right);
            }
        }

        private static void writeLine(ByteArrayOutputStream out, String value) throws Exception {
            out.write((clean(value) + "\n").getBytes("US-ASCII"));
        }

        private static String clean(String value) {
            String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD);
            return normalized.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "").replaceAll("[^\\x20-\\x7E]", "");
        }

        private static String repeat(String value, int count) {
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < count; i++) builder.append(value);
            return builder.toString();
        }
    }
}
