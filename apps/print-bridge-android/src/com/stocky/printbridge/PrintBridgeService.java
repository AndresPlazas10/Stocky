package com.stocky.printbridge;

import android.bluetooth.BluetoothAdapter;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrinterCapabilitiesInfo;
import android.print.PrinterId;
import android.print.PrinterInfo;
import android.printservice.PrintJob;
import android.printservice.PrintService;
import android.printservice.PrinterDiscoverySession;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;

public class PrintBridgeService extends PrintService {
    private static final String TAG = "PrintBridge";
    private static final String PREFS = "stocky_print_bridge";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected PrinterDiscoverySession onCreatePrinterDiscoverySession() {
        return new PrinterDiscoverySession() {
            @Override
            public void onStartPrinterDiscovery(java.util.List<PrinterId> priorityList) {
                PrinterId id = generatePrinterId("stocky-print");
                addPrinters(java.util.Collections.singletonList(buildPrinterInfo(id)));
            }
            @Override public void onStopPrinterDiscovery() {}
            @Override public void onValidatePrinters(java.util.List<PrinterId> printerIds) {}
            @Override
            public void onStartPrinterStateTracking(PrinterId printerId) {
                addPrinters(java.util.Collections.singletonList(buildPrinterInfo(printerId)));
            }
            @Override public void onStopPrinterStateTracking(PrinterId printerId) {}
            @Override public void onDestroy() {}
        };
    }

    @Override
    protected void onPrintJobQueued(final PrintJob printJob) {
        final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        final byte[] documentData;
        try {
            documentData = readDocument(printJob);
        } catch (Exception e) {
            printJob.fail(e.getMessage() != null ? e.getMessage() : "Error de impresion");
            return;
        }

        PrintAttributes attrs = printJob.getInfo().getAttributes();
        int w = "58".equals(prefs.getString("paper", "80")) ? 58 : 80;
        if (attrs != null && attrs.getMediaSize() != null) {
            w = attrs.getMediaSize().getWidthMils() <= 2600 ? 58 : 80;
        }
        final int paperWidthMm = w;

        final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        final boolean openCashDrawer = prefs.getBoolean("cashDrawer", false);
        final boolean[] cancelled = new boolean[1];

        printJob.start();

        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (cancelled[0]) return;
                    byte[] raster;
                    if (documentData.length == 0 || isPdf(documentData)) {
                        if (cancelled[0]) return;
                        if (documentData.length == 0) {
                            PrintJobData job = new PrintJobData();
                            job.rawText = "";
                            job.paperWidthMm = paperWidthMm;
                            job.header = prefs.getString("header", "RECIBO");
                            job.footer = prefs.getString("footer", "Gracias por su compra");
                            job.openCashDrawer = openCashDrawer;
                            raster = BluetoothPrinter.serialize(job);
                        } else {
                            raster = PdfRasterizer.renderToEscPos(documentData, paperWidthMm);
                        }
                        if (cancelled[0]) return;
                        BluetoothPrinter.sendRaw(raster, openCashDrawer, adapter, prefs);
                    } else {
                        if (cancelled[0]) return;
                        BluetoothPrinter.sendRaw(documentData, openCashDrawer, adapter, prefs);
                    }

                    if (!cancelled[0]) {
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                printJob.complete();
                            }
                        });
                    }
                } catch (final Exception err) {
                    Log.e(TAG, "Print failed", err);
                    if (!cancelled[0]) {
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                printJob.fail(err.getMessage() != null ? err.getMessage() : "Error de impresion");
                            }
                        });
                    }
                }
            }
        });
        worker.start();

        printJob.setTag("cancel_flag");
        cancelled[0] = false;
    }

    @Override
    protected void onRequestCancelPrintJob(PrintJob printJob) {
        printJob.cancel();
    }

    @Override
    protected void onConnected() {
        Log.d(TAG, "Service connected");
    }

    @Override
    protected void onDisconnected() {
        Log.d(TAG, "Service disconnected");
    }

    private byte[] readDocument(PrintJob printJob) throws Exception {
        android.printservice.PrintDocument doc = printJob.getDocument();
        if (doc == null) return new byte[0];

        FileInputStream fis = null;
        BufferedInputStream bis = null;
        try {
            fis = new FileInputStream(doc.getData().getFileDescriptor());
            bis = new BufferedInputStream(fis);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = bis.read(buf)) > 0) {
                bos.write(buf, 0, n);
            }
            return bos.toByteArray();
        } finally {
            if (bis != null) try { bis.close(); } catch (Exception ignored) {}
            if (fis != null) try { fis.close(); } catch (Exception ignored) {}
            try { doc.getData().close(); } catch (Exception ignored) {}
        }
    }

    private boolean isPdf(byte[] data) {
        return data.length >= 5 && data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F' && data[4] == '-';
    }

    private PrinterInfo buildPrinterInfo(PrinterId id) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean hasPrinter = prefs.getString("deviceAddress", "").trim().length() > 0;
        int status = hasPrinter ? PrinterInfo.STATUS_IDLE : PrinterInfo.STATUS_UNAVAILABLE;
        boolean is58 = "58".equals(prefs.getString("paper", "80"));

        PrinterCapabilitiesInfo.Builder caps = new PrinterCapabilitiesInfo.Builder(id);
        caps.addMediaSize(
            new android.print.PrintAttributes.MediaSize("ROLL_58", "Roll 58mm", 2280, 10000), is58);
        caps.addMediaSize(
            new android.print.PrintAttributes.MediaSize("ROLL_80", "Roll 80mm", 3150, 10000), !is58);
        caps.addResolution(
            new android.print.PrintAttributes.Resolution("THERMAL", "Thermal", 203, 203), true);
        caps.setMinMargins(new android.print.PrintAttributes.Margins(0, 0, 0, 0));
        caps.setColorModes(
            android.print.PrintAttributes.COLOR_MODE_MONOCHROME,
            android.print.PrintAttributes.COLOR_MODE_MONOCHROME);

        return new PrinterInfo.Builder(id, "Stocky print", status)
                .setDescription("Bluetooth ESC/POS")
                .setCapabilities(caps.build())
                .build();
    }
}
