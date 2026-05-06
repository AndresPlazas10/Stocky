package com.stocky.printbridge;

import android.bluetooth.BluetoothAdapter;
import android.content.SharedPreferences;
import android.print.PrintAttributes;
import android.printservice.PrintJob;
import android.print.PrinterId;
import android.print.PrinterInfo;
import android.print.PrinterCapabilitiesInfo;
import android.printservice.PrintService;
import android.printservice.PrinterDiscoverySession;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;

public class PrintBridgeService extends PrintService {
    private static final String TAG = "PrintBridgeService";
    private static final String PREFS = "stocky_print_bridge";

    @Override
    protected PrinterDiscoverySession onCreatePrinterDiscoverySession() {
        return new PrinterDiscoverySession() {
            @Override
            public void onStartPrinterDiscovery(java.util.List<PrinterId> priorityList) {
                PrinterId id = generatePrinterId("stocky-print");
                PrinterInfo info = buildPrinterInfo(id);
                addPrinters(java.util.Collections.singletonList(info));
            }

            @Override
            public void onStopPrinterDiscovery() {
            }

            @Override
            public void onValidatePrinters(java.util.List<PrinterId> printerIds) {
            }

            @Override
            public void onStartPrinterStateTracking(PrinterId printerId) {
                PrinterInfo info = buildPrinterInfo(printerId);
                addPrinters(java.util.Collections.singletonList(info));
            }

            @Override
            public void onStopPrinterStateTracking(PrinterId printerId) {
            }

            @Override
            public void onDestroy() {
            }
        };
    }

    @Override
    protected void onPrintJobQueued(PrintJob printJob) {
        PrintAttributes attributes = printJob.getInfo().getAttributes();
        int widthMm = 80;
        if (attributes != null && attributes.getMediaSize() != null) {
            int mils = attributes.getMediaSize().getWidthMils();
            widthMm = mils <= 2300 ? 58 : 80;
        }
        final int paperWidthMm = widthMm;

        new Thread(new Runnable() {
            @Override
            public void run() {
                SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                try {
                    byte[] data = readRawBytes(printJob);
                    boolean openCashDrawer = prefs.getBoolean("cashDrawer", false);
                    if (data.length == 0) {
                        PrintJobData job = new PrintJobData();
                        job.rawText = "";
                        job.paperWidthMm = paperWidthMm;
                        job.header = prefs.getString("header", "RECIBO");
                        job.footer = prefs.getString("footer", "Gracias por su compra");
                        job.openCashDrawer = openCashDrawer;
                        BluetoothPrinter.print(job, adapter, prefs);
                    } else if (isPdf(data)) {
                        byte[] raster = PdfRasterizer.renderToEscPos(data, paperWidthMm);
                        BluetoothPrinter.printBytes(raster, openCashDrawer, adapter, prefs);
                    } else {
                        BluetoothPrinter.printBytes(data, openCashDrawer, adapter, prefs);
                    }
                    printJob.complete();
                } catch (Exception err) {
                    Log.e(TAG, "Print failed", err);
                    printJob.fail(err.getMessage());
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
        Log.d(TAG, "Print service connected");
    }

    @Override
    protected void onDisconnected() {
        Log.d(TAG, "Print service disconnected");
    }

    private byte[] readRawBytes(PrintJob printJob) throws Exception {
        android.printservice.PrintDocument document = printJob.getDocument();
        if (document == null) return new byte[0];
        java.io.FileInputStream fileInput = new java.io.FileInputStream(document.getData().getFileDescriptor());
        BufferedInputStream input = new BufferedInputStream(fileInput);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[2048];
        int count;
        while ((count = input.read(buffer)) > 0) {
            out.write(buffer, 0, count);
        }
        input.close();
        document.getData().close();
        return out.toByteArray();
    }

    private boolean isPdf(byte[] data) {
        if (data.length < 5) return false;
        return data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F' && data[4] == '-';
    }

    private PrinterInfo buildPrinterInfo(PrinterId id) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean hasPrinter = prefs.getString("deviceAddress", "").trim().length() > 0;
        int status = hasPrinter ? PrinterInfo.STATUS_IDLE : PrinterInfo.STATUS_UNAVAILABLE;

        PrinterCapabilitiesInfo.Builder caps = new PrinterCapabilitiesInfo.Builder(id);
        android.print.PrintAttributes.MediaSize roll58 = new android.print.PrintAttributes.MediaSize("ROLL_58", "Roll 58mm", 2280, 10000);
        android.print.PrintAttributes.MediaSize roll80 = new android.print.PrintAttributes.MediaSize("ROLL_80", "Roll 80mm", 3150, 10000);
        caps.addMediaSize(roll58, true);
        caps.addMediaSize(roll80, false);
        caps.addResolution(new android.print.PrintAttributes.Resolution("THERMAL", "Thermal", 203, 203), true);
        caps.setMinMargins(new android.print.PrintAttributes.Margins(0, 0, 0, 0));
        caps.setColorModes(android.print.PrintAttributes.COLOR_MODE_MONOCHROME, android.print.PrintAttributes.COLOR_MODE_MONOCHROME);

        return new PrinterInfo.Builder(id, "Stocky print", status)
                .setDescription("Bluetooth ESC/POS")
                .setCapabilities(caps.build())
                .build();
    }
}
