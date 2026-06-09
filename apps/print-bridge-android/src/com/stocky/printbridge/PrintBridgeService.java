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
        final String jobId = printJob.getId() != null ? printJob.getId().toString() : "unknown";
        final String jobLabel = printJob.getInfo() != null ? String.valueOf(printJob.getInfo().getLabel()) : "unknown";
        Log.i(TAG, "Job received: id=" + jobId + " label=" + jobLabel);

        final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        final byte[] documentData;
        try {
            documentData = readDocument(printJob);
            Log.d(TAG, "Document read: " + documentData.length + " bytes");
        } catch (Throwable e) {
            Log.e(TAG, "Failed to read document for job " + jobId, e);
            printJob.fail(safeError(e));
            return;
        }

        PrintAttributes attrs = printJob.getInfo().getAttributes();
        int w = "58".equals(prefs.getString("lastPaperWidth", prefs.getString("paper", "58"))) ? 58 : 80;
        if (attrs != null && attrs.getMediaSize() != null) {
            w = attrs.getMediaSize().getWidthMils() <= 2600 ? 58 : 80;
        }
        final int paperWidthMm = w;
        Log.d(TAG, "Paper width: " + paperWidthMm + "mm for job " + jobId);

        final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            Log.e(TAG, "BluetoothAdapter is null on this device");
            printJob.fail("Bluetooth no disponible en este dispositivo");
            return;
        }
        Log.d(TAG, "Bluetooth adapter: " + (adapter.isEnabled() ? "enabled" : "disabled"));

        final boolean openCashDrawer = prefs.getBoolean("cashDrawer", false);
        final String deviceAddr = prefs.getString("deviceAddress", "");
        Log.d(TAG, "Target printer: " + deviceAddr + " openCashDrawer=" + openCashDrawer);

        printJob.start();
        Log.d(TAG, "Job " + jobId + " started, launching processing thread");

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "Processing job " + jobId + ": size=" + documentData.length + " isPdf=" + isPdf(documentData));
                    byte[] output;

                    if (documentData.length == 0 || isPdf(documentData)) {
                        if (documentData.length == 0) {
                            Log.d(TAG, "Empty document for job " + jobId + " - printing test receipt");
                            PrintJobData job = new PrintJobData();
                            job.rawText = "";
                            job.paperWidthMm = paperWidthMm;
                            job.header = prefs.getString("header", "RECIBO");
                            job.footer = prefs.getString("footer", "Gracias por su compra");
                            job.openCashDrawer = openCashDrawer;
                            output = BluetoothPrinter.serialize(job);
                        } else {
                            Log.d(TAG, "Rasterizing PDF for job " + jobId + ": " + documentData.length + " bytes, " + paperWidthMm + "mm");
                            output = PdfRasterizer.renderToEscPos(documentData, paperWidthMm);
                            Log.d(TAG, "Rasterized job " + jobId + " to " + output.length + " bytes ESC/POS");
                        }
                        BluetoothPrinter.sendRaw(output, openCashDrawer, adapter, prefs);
                        Log.i(TAG, "Job " + jobId + " sent to printer successfully via Bluetooth");
                    } else {
                        Log.d(TAG, "Sending raw data for job " + jobId + ": " + documentData.length + " bytes");
                        BluetoothPrinter.sendRaw(documentData, openCashDrawer, adapter, prefs);
                        Log.i(TAG, "Raw data for job " + jobId + " sent to printer");
                    }

                    Log.d(TAG, "Job " + jobId + " completed successfully");
                    final int usedWidth = paperWidthMm;
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            prefs.edit().putString("lastPaperWidth", String.valueOf(usedWidth)).apply();
                            printJob.complete();
                            Log.i(TAG, "Job " + jobId + " marked complete");
                        }
                    });
                } catch (final Throwable err) {
                    Log.e(TAG, "Print failed for job " + jobId, err);
                    final String msg = safeError(err);
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            printJob.fail(msg);
                            Log.e(TAG, "Job " + jobId + " marked failed: " + msg);
                        }
                    });
                }
            }
        }, "PrintBridgeJob-" + jobId).start();
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
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String lastPaper = prefs.getString("lastPaperWidth", prefs.getString("paper", "58"));
        boolean is58 = "58".equals(lastPaper);

        PrinterCapabilitiesInfo.Builder caps = new PrinterCapabilitiesInfo.Builder(id);

        android.print.PrintAttributes.MediaSize roll58 =
            new android.print.PrintAttributes.MediaSize("ROLL_58", "Rollo 58mm", 2280, 2280);
        android.print.PrintAttributes.MediaSize roll80 =
            new android.print.PrintAttributes.MediaSize("ROLL_80", "Rollo 80mm", 3150, 3150);
        android.print.PrintAttributes.MediaSize isoA4 = android.print.PrintAttributes.MediaSize.ISO_A4;
        android.print.PrintAttributes.MediaSize naLetter = android.print.PrintAttributes.MediaSize.NA_LETTER;

        caps.addMediaSize(roll58, is58);
        caps.addMediaSize(roll80, !is58);
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
