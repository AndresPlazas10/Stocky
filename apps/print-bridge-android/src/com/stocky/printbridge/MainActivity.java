package com.stocky.printbridge;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
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
    private static final int PRIMARY = Color.rgb(99, 102, 241);
    private static final int PRIMARY_DARK = Color.rgb(79, 70, 229);
    private static final int PRIMARY_LIGHT = Color.rgb(199, 210, 254);
    private static final int SURFACE = Color.rgb(255, 255, 255);
    private static final int BG = Color.rgb(248, 250, 252);
    private static final int TEXT = Color.rgb(15, 23, 42);
    private static final int MUTED = Color.rgb(100, 116, 139);
    private static final int SUCCESS = Color.rgb(34, 197, 94);
    private static final int ERROR = Color.rgb(239, 68, 68);
    private static final int CARD_BORDER = Color.rgb(226, 232, 240);

    private SharedPreferences prefs;
    private BluetoothAdapter bluetoothAdapter;
    private final List<BluetoothDevice> devices = new ArrayList<>();
    private ArrayAdapter<String> deviceAdapter;
    private Spinner deviceSpinner;
    private Spinner paperSpinner;
    private CheckBox cashDrawerCheck;
    private TextView statusText;
    private TextView statusDot;
    private EditText headerInput;
    private EditText footerInput;
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
    protected void onResume() {
        super.onResume();
        if (bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
            refreshBondedDevices();
        }
        startHttpServerIfConfigured();
    }

    @Override
    protected void onPause() {
        super.onPause();
        saveSettings();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 10 || requestCode == 11) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                refreshBondedDevices();
            } else {
                setStatus("Permisos Bluetooth requeridos", ERROR);
                toast("Concede los permisos Bluetooth para continuar");
            }
        }
    }

    @Override
    protected void onDestroy() {
        saveSettings();
        stopHttpServer();
        super.onDestroy();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        // --- HERO HEADER ---
        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(24), dp(32), dp(24), dp(28));
        GradientDrawable heroBg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { PRIMARY_DARK, Color.rgb(129, 140, 248) }
        );
        heroBg.setCornerRadii(new float[] { 0, 0, dp(24), dp(24), 0, 0, 0, 0 });
        hero.setBackground(heroBg);
        root.addView(hero);

        // Badge
        TextView badge = new TextView(this);
        badge.setText("BETA v1.0");
        badge.setTextSize(10);
        badge.setTextColor(Color.argb(180, 255, 255, 255));
        badge.setTypeface(null, 1);
        badge.setPadding(dp(10), dp(4), dp(10), dp(5));
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.argb(30, 255, 255, 255));
        badgeBg.setCornerRadius(dp(20));
        badge.setBackground(badgeBg);
        LinearLayout badgeRow = new LinearLayout(this);
        badgeRow.setOrientation(LinearLayout.HORIZONTAL);
        badgeRow.addView(badge);
        hero.addView(badgeRow);

        TextView logo = new TextView(this);
        logo.setText("\u2699\uFE0F  Stocky print");
        logo.setTextSize(28);
        logo.setTextColor(Color.WHITE);
        logo.setTypeface(null, 1);
        logo.setPadding(0, dp(12), 0, dp(4));
        hero.addView(logo);

        TextView tagline = new TextView(this);
        tagline.setText("Impresion termica Bluetooth ESC/POS");
        tagline.setTextSize(14);
        tagline.setTextColor(Color.argb(200, 255, 255, 255));
        tagline.setLineSpacing(0, 1.15f);
        hero.addView(tagline);

        // --- MAIN CONTENT ---
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(20), dp(16), dp(24));
        root.addView(content);

        // Status card
        LinearLayout statusCard = card();
        LinearLayout statusRow = new LinearLayout(this);
        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        statusRow.setPadding(dp(16), dp(14), dp(16), dp(14));
        statusCard.addView(statusRow);

        statusDot = new TextView(this);
        statusDot.setText("\u25CF");
        statusDot.setTextSize(10);
        statusDot.setTextColor(MUTED);
        statusDot.setPadding(0, 0, dp(8), 0);
        statusRow.addView(statusDot);

        statusText = new TextView(this);
        statusText.setText("Listo para configurar");
        statusText.setTextSize(13);
        statusText.setTextColor(MUTED);
        statusText.setTypeface(null, 0);
        statusRow.addView(statusText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        TextView statusIcon = new TextView(this);
        statusIcon.setText("\u2139\uFE0F");
        statusIcon.setTextSize(16);
        statusIcon.setPadding(dp(4), 0, 0, 0);
        statusRow.addView(statusIcon);
        content.addView(statusCard);
        content.addView(space(12));

        // Connection card
        content.addView(sectionHeader("\uD83D\uDD0C  Conexion"));
        LinearLayout connCard = card();
        deviceSpinner = new Spinner(this);
        deviceAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new ArrayList<String>());
        deviceSpinner.setAdapter(deviceAdapter);
        deviceSpinner.setPadding(dp(12), dp(10), dp(12), dp(10));
        connCard.addView(deviceSpinner);

        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setPadding(dp(8), dp(6), dp(8), dp(10));
        Button scanBtn = secondaryBtn("\uD83D\uDD0D  Escanear");
        scanBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { refreshBondedDevices(); }
        });
        Button btBtn = secondaryBtn("\u2699\uFE0F  Ajustes BT");
        btBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); }
        });
        btnRow.addView(scanBtn, weightParams());
        btnRow.addView(spaceHoriz(8));
        btnRow.addView(btBtn, weightParams());
        connCard.addView(btnRow);
        content.addView(connCard);
        content.addView(space(16));

        // Settings card
        content.addView(sectionHeader("\u2699\uFE0F  Configuracion"));
        LinearLayout settingsCard = card();

        settingsCard.addView(cardLabel("\uD83D\uDCC4  Tamano de papel"));
        paperSpinner = new Spinner(this);
        ArrayAdapter<String> paperAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{
            "\uD83D\uDCC4 58 mm  \u2014  Ticket pequeno",
            "\uD83D\uDCC3 80 mm  \u2014  Ticket estandar"
        });
        paperSpinner.setAdapter(paperAdapter);
        paperSpinner.setPadding(dp(12), dp(8), dp(12), dp(8));
        settingsCard.addView(paperSpinner);

        settingsCard.addView(divider());
        settingsCard.addView(cardLabel("\uD83D\uDCB0  Cajon monedero"));
        cashDrawerCheck = new CheckBox(this);
        cashDrawerCheck.setText("Abrir caja al finalizar cada impresion");
        cashDrawerCheck.setTextSize(13);
        cashDrawerCheck.setTextColor(TEXT);
        cashDrawerCheck.setPadding(dp(12), dp(6), dp(12), dp(6));
        cashDrawerCheck.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton btn, boolean checked) {
                btn.setTextColor(checked ? PRIMARY : TEXT);
            }
        });
        settingsCard.addView(cashDrawerCheck);

        settingsCard.addView(divider());
        settingsCard.addView(cardLabel("\uD83C\uDFF7\uFE0F  Titulo del recibo"));
        headerInput = styledInput("RECIBO", false);
        settingsCard.addView(headerInput);

        settingsCard.addView(divider());
        settingsCard.addView(cardLabel("\uD83D\uDC4B  Mensaje final"));
        footerInput = styledInput("Gracias por su compra", false);
        settingsCard.addView(footerInput);

        content.addView(settingsCard);
        content.addView(space(20));

        // Action buttons
        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, dp(8), 0, dp(12));

        Button testBtn = primaryBtn("\uD83D\uDDB6\uFE0F  Imprimir prueba");
        testBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { printTest(); }
        });
        Button saveBtn = primaryFilledBtn("\u2714\uFE0F  Guardar configuracion");
        saveBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { saveSettings(); }
        });

        actions.addView(testBtn, weightParams());
        actions.addView(spaceHoriz(10));
        actions.addView(saveBtn, weightParams());
        content.addView(actions);

        // Footer
        TextView footer = new TextView(this);
        footer.setText("Abierto para todos \u00B7  Sin licencia");
        footer.setTextSize(11);
        footer.setTextColor(Color.rgb(148, 163, 184));
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, dp(8), 0, dp(16));
        content.addView(footer);

        scroll.addView(root);
        setContentView(scroll);
    }

    // --- UI helpers ---

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(0, dp(4), 0, dp(4));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(SURFACE);
        bg.setCornerRadius(dp(16));
        bg.setStroke(1, CARD_BORDER);
        card.setBackground(bg);
        card.setElevation(dp(1));
        return card;
    }

    private TextView sectionHeader(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextSize(15);
        tv.setTextColor(TEXT);
        tv.setTypeface(null, 1);
        tv.setPadding(dp(4), 0, 0, dp(10));
        return tv;
    }

    private TextView cardLabel(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextSize(12);
        tv.setTextColor(MUTED);
        tv.setTypeface(null, 1);
        tv.setPadding(dp(16), dp(12), dp(16), dp(4));
        tv.setLetterSpacing(0.04f);
        return tv;
    }

    private View divider() {
        View v = new View(this);
        v.setBackgroundColor(Color.rgb(241, 245, 249));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1));
        p.setMargins(dp(12), dp(4), dp(12), dp(4));
        v.setLayoutParams(p);
        return v;
    }

    private EditText styledInput(String hint, boolean number) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        input.setTextSize(14);
        input.setTextColor(TEXT);
        input.setHintTextColor(Color.rgb(203, 213, 225));
        input.setInputType(number ? InputType.TYPE_CLASS_NUMBER : InputType.TYPE_CLASS_TEXT);
        input.setPadding(dp(16), dp(12), dp(16), dp(12));
        input.setBackgroundColor(Color.TRANSPARENT);
        return input;
    }

    private Button primaryBtn(String label) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTextSize(13);
        btn.setTextColor(PRIMARY);
        btn.setTypeface(null, 1);
        btn.setAllCaps(false);
        btn.setPadding(dp(8), dp(14), dp(8), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.TRANSPARENT);
        bg.setCornerRadius(dp(14));
        bg.setStroke((int)(1.5f * getResources().getDisplayMetrics().density), PRIMARY);
        btn.setBackground(bg);
        return btn;
    }

    private Button primaryFilledBtn(String label) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTextSize(13);
        btn.setTextColor(Color.WHITE);
        btn.setTypeface(null, 1);
        btn.setAllCaps(false);
        btn.setPadding(dp(8), dp(14), dp(8), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(PRIMARY);
        bg.setCornerRadius(dp(14));
        btn.setBackground(bg);
        return btn;
    }

    private Button secondaryBtn(String label) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTextSize(11);
        btn.setTextColor(MUTED);
        btn.setTypeface(null, 0);
        btn.setAllCaps(false);
        btn.setPadding(dp(4), dp(10), dp(4), dp(10));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.rgb(248, 250, 252));
        bg.setCornerRadius(dp(10));
        bg.setStroke(1, Color.rgb(226, 232, 240));
        btn.setBackground(bg);
        return btn;
    }

    private LinearLayout.LayoutParams weightParams() {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
    }

    private View space(int dpVal) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(dpVal)));
        return v;
    }

    private View spaceHoriz(int dpVal) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(dp(dpVal), 0));
        return v;
    }

    // --- Bluetooth / permissions ---

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
            String address = prefs.getString("deviceAddress", "");
            setStatus(address.isEmpty() ? "Bluetooth no disponible" : "Impresora guardada \u2014 Bluetooth no disponible", ERROR);
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            String address = prefs.getString("deviceAddress", "");
            if (!address.isEmpty()) {
                toast("Bluetooth apagado. La impresora sigue configurada.");
            } else {
                toast("Activa Bluetooth para listar impresoras");
            }
            setStatus(address.isEmpty() ? "Bluetooth apagado" : "Impresora guardada \u2014 Bluetooth apagado", Color.rgb(245, 158, 11));
            return;
        }

        try {
            Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
            String selectedAddress = prefs.getString("deviceAddress", "");
            int selectedIndex = -1;
            int index = 0;
            for (BluetoothDevice device : bonded) {
                devices.add(device);
                String label = safeDeviceName(device) + "  \u2014  " + device.getAddress();
                deviceAdapter.add(label);
                if (device.getAddress().equals(selectedAddress)) selectedIndex = index;
                index++;
            }
            if (devices.isEmpty()) deviceAdapter.add("No hay dispositivos emparejados");
            if (selectedIndex >= 0) deviceSpinner.setSelection(selectedIndex);
            boolean hasSavedPrinter = !selectedAddress.isEmpty();
            boolean printerFound = hasSavedPrinter && selectedIndex >= 0;
            setStatus(
                !hasSavedPrinter ? "Configura una impresora Bluetooth" :
                printerFound ? "Conectado y listo para imprimir" :
                "Impresora no detectada \u2014 Verifica emparejamiento",
                !hasSavedPrinter ? MUTED :
                printerFound ? SUCCESS : Color.rgb(245, 158, 11)
            );
        } catch (SecurityException err) {
            setStatus("Permisos Bluetooth pendientes", ERROR);
            toast("Concede permisos Bluetooth");
        }
    }

    private void loadSettings() {
        String paper = prefs.getString("paper", "80");
        paperSpinner.setSelection("58".equals(paper) ? 0 : 1);
        cashDrawerCheck.setChecked(prefs.getBoolean("cashDrawer", false));
        cashDrawerCheck.setTextColor(cashDrawerCheck.isChecked() ? PRIMARY : TEXT);
        headerInput.setText(prefs.getString("header", "RECIBO"));
        footerInput.setText(prefs.getString("footer", "Gracias por su compra"));
        String address = prefs.getString("deviceAddress", "");
        String deviceName = prefs.getString("deviceName", "");
        if (!address.isEmpty()) {
            setStatus("Configuracion guardada" + (deviceName.isEmpty() ? "" : " \u2014 " + deviceName), SUCCESS);
        } else {
            setStatus("Configura una impresora Bluetooth", MUTED);
        }
    }

    private void saveSettings() {
        int selected = deviceSpinner.getSelectedItemPosition();
        String address = prefs.getString("deviceAddress", "");
        String name = prefs.getString("deviceName", "");
        if (selected >= 0 && selected < devices.size()) {
            address = devices.get(selected).getAddress();
            name = safeDeviceName(devices.get(selected));
        }
        String paper = paperSpinner.getSelectedItemPosition() == 0 ? "58" : "80";

        boolean saved = prefs.edit()
                .putString("deviceAddress", address)
                .putString("deviceName", name)
                .putString("paper", paper)
                .putBoolean("cashDrawer", cashDrawerCheck.isChecked())
                .putString("header", headerInput.getText().toString().trim())
                .putString("footer", footerInput.getText().toString().trim())
                .commit();

        if (address.isEmpty()) {
            setStatus("Selecciona una impresora emparejada", Color.rgb(245, 158, 11));
        } else {
            setStatus("Configuracion guardada" + (name.isEmpty() ? "" : " \u2014 " + name), SUCCESS);
        }
        toast(saved ? "\u2714\uFE0F  Configuracion guardada" : "No se pudo guardar");
        startHttpServerIfConfigured();
    }

    private void printTest() {
        saveSettings();
        final PrintJobData job = new PrintJobData();
        job.header = prefs.getString("header", "RECIBO");
        job.footer = prefs.getString("footer", "Gracias por su compra");
        job.paperWidthMm = parseInt(prefs.getString("paper", "80"), 80);
        job.openCashDrawer = prefs.getBoolean("cashDrawer", false);
        job.rawText = "Impresion de prueba\nStocky print\n\n";

        setStatus("Enviando prueba...", Color.rgb(245, 158, 11));
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    BluetoothPrinter.print(job, bluetoothAdapter, prefs);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            setStatus("Prueba de impresion enviada", SUCCESS);
                            toast("\u2705  Impresion enviada a la impresora");
                        }
                    });
                } catch (final Exception err) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            setStatus("Error al imprimir: " + err.getMessage(), ERROR);
                            toast(err.getMessage());
                        }
                    });
                }
            }
        }).start();
    }

    private String safeDeviceName(BluetoothDevice device) {
        try {
            String name = device.getName();
            return name == null || name.trim().isEmpty() ? "Impresora Bluetooth" : name;
        } catch (SecurityException err) {
            return "Impresora Bluetooth";
        }
    }

    private void setStatus(String value, int color) {
        statusText.setText(value);
        statusText.setTextColor(color);
        statusDot.setTextColor(color);
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
    }

    private synchronized void stopHttpServer() {
        if (httpServer != null) {
            httpServer.stop();
            httpServer = null;
        }
    }
}
