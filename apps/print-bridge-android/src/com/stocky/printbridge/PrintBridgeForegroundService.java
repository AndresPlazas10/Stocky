package com.stocky.printbridge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

public class PrintBridgeForegroundService extends Service {
    private static final String TAG = "PrintBridgeFG";
    private static final String CHANNEL_ID = "stocky_print_bridge_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final String PREFS = "stocky_print_bridge";

    private PrintBridgeHttpServer httpServer;
    private BluetoothAdapter bluetoothAdapter;
    private SharedPreferences prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Foreground service created");
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "Foreground service starting");

        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startHttpServerIfConfigured();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Foreground service destroyed");
        stopHttpServer();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        String printerName = prefs.getString("deviceName", "");
        String contentText = printerName.isEmpty()
            ? "Esperando trabajos de impresion..."
            : "Impresora: " + printerName;

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Stocky print activo")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_launcher)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .setContentIntent(pendingIntent);

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Stocky Print Bridge",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Estado del servidor de impresion Stocky");
            channel.setShowBadge(false);

            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created");
            }
        }
    }

    private synchronized void startHttpServerIfConfigured() {
        if (httpServer != null) {
            Log.d(TAG, "HTTP server already running");
            return;
        }
        httpServer = new PrintBridgeHttpServer(bluetoothAdapter, prefs);
        httpServer.start();
        Log.i(TAG, "HTTP server started from foreground service");
    }

    private synchronized void stopHttpServer() {
        if (httpServer != null) {
            httpServer.stop();
            httpServer = null;
            Log.i(TAG, "HTTP server stopped from foreground service");
        }
    }
}
