package com.stocky.printbridge;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
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
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class MainActivity extends Activity {
    private static final String PREFS = "stocky_print_bridge";
    private static final int INDIGO = Color.rgb(67, 56, 202);
    private static final int BG = Color.rgb(241, 245, 249);
    private static final int TEXT = Color.rgb(15, 23, 42);
    private static final int MUTED = Color.rgb(100, 116, 139);

    private SharedPreferences prefs;
    private BluetoothAdapter bluetoothAdapter;
    private final List<BluetoothDevice> devices = new ArrayList<>();
    private ArrayAdapter<String> deviceAdapter;
    private Spinner deviceSpinner;
    private Spinner paperSpinner;
    private CheckBox cashDrawerCheck;
    private TextView statusText;
    private EditText headerInput;
    private EditText footerInput;
    private EditText tokenInput;
    private PrintBridgeHttpServer httpServer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        requestBluetoothPermissions();
        buildUi();
        loadSettings();
        refreshBondedDevices();
        startHttpServerIfConfigured();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopHttpServer();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(24), dp(18), dp(24));
        scroll.addView(root);

        TextView eyebrow = text("Stocky print", 13, INDIGO, true);
        root.addView(eyebrow);

        TextView title = text("Bridge de impresion ESC/POS", 26, TEXT, true);
        title.setPadding(0, dp(4), 0, dp(6));
        root.addView(title);

        TextView subtitle = text("Selecciona una impresora Bluetooth y usa Imprimir desde cualquier app.", 14, MUTED, false);
        root.addView(subtitle);

        statusText = pill("Listo para configurar");
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
        ArrayAdapter<String> paperAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"58mm", "80mm"});
        paperSpinner.setAdapter(paperAdapter);
        root.addView(paperSpinner);

        cashDrawerCheck = new CheckBox(this);
        cashDrawerCheck.setText("Abrir caja al finalizar");
        cashDrawerCheck.setTextColor(TEXT);
        root.addView(cashDrawerCheck);

        root.addView(label("Titulo del recibo"));
        headerInput = input("RECIBO", false);
        root.addView(headerInput);

        root.addView(label("Mensaje final"));
        footerInput = input("Gracias por su compra", false);
        root.addView(footerInput);

        root.addView(label("Token de integracion"));
        tokenInput = input("Generado automaticamente", false);
        tokenInput.setEnabled(false);
        root.addView(tokenInput);

        LinearLayout actions = row();
        Button testButton = button("Imprimir prueba", false);
        testButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                printTest();
            }
        });
        Button saveButton = button("Guardar", true);
        saveButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                saveSettings();
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
        paperSpinner.setSelection("58".equals(paper) ? 0 : 1);
        cashDrawerCheck.setChecked(prefs.getBoolean("cashDrawer", false));
        headerInput.setText(prefs.getString("header", "RECIBO"));
        footerInput.setText(prefs.getString("footer", "Gracias por su compra"));

        String token = prefs.getString("token", "");
        if (token.isEmpty()) {
            token = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            prefs.edit().putString("token", token).apply();
        }
        tokenInput.setText(token);
    }

    private void saveSettings() {
        int selected = deviceSpinner.getSelectedItemPosition();
        String address = prefs.getString("deviceAddress", "");
        String name = prefs.getString("deviceName", "");
        if (selected >= 0 && selected < devices.size()) {
            address = devices.get(selected).getAddress();
            name = safeDeviceName(devices.get(selected));
        }
        String paper = paperSpinner.getSelectedItem().toString().replace("mm", "");

        boolean saved = prefs.edit()
                .putString("deviceAddress", address)
                .putString("deviceName", name)
                .putString("paper", paper)
                .putBoolean("cashDrawer", cashDrawerCheck.isChecked())
                .putString("header", headerInput.getText().toString().trim())
                .putString("footer", footerInput.getText().toString().trim())
                .putString("token", tokenInput.getText().toString().trim())
                .commit();

        setStatus(address.isEmpty() ? "Guarda una impresora emparejada" : "Configuracion guardada");
        toast(saved ? "Configuracion guardada" : "No se pudo guardar");
        startHttpServerIfConfigured();
    }

    private void printTest() {
        saveSettings();
        try {
            PrintJobData job = new PrintJobData();
            job.header = prefs.getString("header", "RECIBO");
            job.footer = prefs.getString("footer", "Gracias por su compra");
            job.paperWidthMm = parseInt(prefs.getString("paper", "80"), 80);
            job.openCashDrawer = prefs.getBoolean("cashDrawer", false);
            job.rawText = "Impresion de prueba\nStocky print\n\n";
            BluetoothPrinter.print(job, bluetoothAdapter, prefs);
            setStatus("Prueba enviada");
        } catch (Exception err) {
            setStatus("Error imprimiendo");
            toast(err.getMessage());
        }
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

    private synchronized void startHttpServerIfConfigured() {
        String address = prefs.getString("deviceAddress", "");
        if (address.isEmpty()) return;
        if (httpServer != null) return;
        httpServer = new PrintBridgeHttpServer(bluetoothAdapter, prefs);
        httpServer.start();
        setStatus("Servidor HTTP iniciado en :41781");
    }

    private synchronized void stopHttpServer() {
        if (httpServer != null) {
            httpServer.stop();
            httpServer = null;
        }
    }
}
