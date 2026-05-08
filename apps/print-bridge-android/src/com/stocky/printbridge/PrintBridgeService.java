package com.stocky.printbridge;

import android.bluetooth.BluetoothAdapter;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PrintAttributes;
import android.print.PrinterCapabilitiesInfo;
import android.print.PrinterId;
import android.print.PrinterInfo;
import android.printservice.PrintJob;
import android.printservice.PrintService;
import android.printservice.PrinterDiscoverySession;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

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
        } catch (Throwable e) {
            Log.e(TAG, "Failed to read document", e);
            printJob.fail(safeError(e));
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

        printJob.start();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "Processing job: size=" + documentData.length + " isPdf=" + isPdf(documentData));
                    byte[] output;

                    if (documentData.length == 0 || isPdf(documentData)) {
                        if (documentData.length == 0) {
                            Log.d(TAG, "Empty document - printing test receipt");
                            PrintJobData job = new PrintJobData();
                            job.rawText = "";
                            job.paperWidthMm = paperWidthMm;
                            job.header = prefs.getString("header", "RECIBO");
                            job.footer = prefs.getString("footer", "Gracias por su compra");
                            job.openCashDrawer = openCashDrawer;
                            output = BluetoothPrinter.serialize(job);
                        } else {
                            Log.d(TAG, "Rasterizing PDF: " + documentData.length + " bytes, " + paperWidthMm + "mm");
                            output = PdfRasterizer.renderToEscPos(documentData, paperWidthMm);
                            Log.d(TAG, "Rasterized to " + output.length + " bytes");
                        }
                        BluetoothPrinter.sendRaw(output, openCashDrawer, adapter, prefs);
                    } else {
                        Log.d(TAG, "Sending raw data: " + documentData.length + " bytes");
                        BluetoothPrinter.sendRaw(documentData, openCashDrawer, adapter, prefs);
                    }

                    Log.d(TAG, "Job completed successfully");
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            printJob.complete();
                        }
                    });
                } catch (final Throwable err) {
                    Log.e(TAG, "Print failed", err);
                    final String msg = safeError(err);
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            printJob.fail(msg);
                        }
                    });
                }
            }
        }).start();
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
        if (doc == null) {
            Log.w(TAG, "PrintDocument is null");
            return new byte[0];
        }

        ParcelFileDescriptor pfd = doc.getData();
        if (pfd == null) {
            Log.w(TAG, "ParcelFileDescriptor is null");
            return new byte[0];
        }

        InputStream input = null;
        try {
            input = new ParcelFileDescriptor.AutoCloseInputStream(pfd);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = input.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            byte[] result = bos.toByteArray();
            Log.d(TAG, "Read " + result.length + " bytes from document");
            return result;
        } finally {
            if (input != null) {
                try { input.close(); } catch (Exception ignored) {}
            }
        }
    }

    private boolean isPdf(byte[] data) {
        return data.length >= 5 && data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F' && data[4] == '-';
    }

    private static String safeError(Throwable e) {
        if (e == null) return "Error de impresion";
        String msg = e.getMessage();
        if (msg != null && !msg.trim().isEmpty()) return msg;
        String name = e.getClass().getSimpleName();
        if (name != null && !name.isEmpty()) return name;
        return "Error de impresion";
    }

    private PrinterInfo buildPrinterInfo(PrinterId id) {
        PrinterCapabilitiesInfo.Builder caps = new PrinterCapabilitiesInfo.Builder(id);

        android.print.PrintAttributes.MediaSize roll58 =
            new android.print.PrintAttributes.MediaSize("ROLL_58", "Rollo 58mm", 2280, 2280);
        android.print.PrintAttributes.MediaSize roll80 =
            new android.print.PrintAttributes.MediaSize("ROLL_80", "Rollo 80mm", 3150, 3150);
        android.print.PrintAttributes.MediaSize isoA4 = android.print.PrintAttributes.MediaSize.ISO_A4;
        android.print.PrintAttributes.MediaSize naLetter = android.print.PrintAttributes.MediaSize.NA_LETTER;

        caps.addMediaSize(roll80, true);
        caps.addMediaSize(roll58, false);
        caps.addMediaSize(isoA4, false);
        caps.addMediaSize(naLetter, false);

        caps.addResolution(
            new android.print.PrintAttributes.Resolution("THERMAL", "Thermal", 203, 203), true);
        caps.addResolution(
            new android.print.PrintAttributes.Resolution("DRAFT", "Draft", 100, 100), false);

        caps.setMinMargins(new android.print.PrintAttributes.Margins(0, 0, 0, 0));
        caps.setColorModes(
            android.print.PrintAttributes.COLOR_MODE_MONOCHROME | android.print.PrintAttributes.COLOR_MODE_COLOR,
            android.print.PrintAttributes.COLOR_MODE_MONOCHROME);

        return new PrinterInfo.Builder(id, "Stocky print", PrinterInfo.STATUS_IDLE)
                .setDescription("Impresora termica Bluetooth ESC/POS")
                .setCapabilities(caps.build())
                .build();
    }
}
