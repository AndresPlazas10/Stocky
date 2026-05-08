package com.stocky.printbridge;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;

public class PdfRasterizer {
    public static byte[] renderToEscPos(byte[] pdfData, int paperWidthMm) throws Exception {
        File temp = null;
        ParcelFileDescriptor fd = null;
        PdfRenderer renderer = null;

        try {
            temp = File.createTempFile("printjob", ".pdf");
            FileOutputStream output = new FileOutputStream(temp);
            output.write(pdfData);
            output.flush();
            output.close();

            fd = ParcelFileDescriptor.open(temp, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fd);

            int targetWidth = paperWidthMm <= 58 ? 384 : 576;
            ByteArrayOutputStream out = new ByteArrayOutputStream();

            int pageCount = renderer.getPageCount();
            for (int i = 0; i < pageCount; i++) {
                PdfRenderer.Page page = null;
                Bitmap bitmap = null;
                Bitmap trimmed = null;
                try {
                    page = renderer.openPage(i);
                    int pageW = page.getWidth();
                    int pageH = page.getHeight();
                    if (pageW <= 0 || pageH <= 0) continue;

                    float scale = targetWidth / (float) pageW;
                    int height = Math.max(1, Math.round(pageH * scale));

                    bitmap = Bitmap.createBitmap(targetWidth, height, Bitmap.Config.ARGB_8888);
                    bitmap.eraseColor(Color.WHITE);
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);

                    trimmed = EscPosRaster.trimBottomWhitespace(bitmap);
                    out.write(EscPosRaster.bitmapToRaster(trimmed));
                    out.write(EscPosRaster.feed(1));
                } finally {
                    if (trimmed != null && trimmed != bitmap) trimmed.recycle();
                    if (bitmap != null) bitmap.recycle();
                    if (page != null) page.close();
                }
            }

            return out.toByteArray();
        } finally {
            if (renderer != null) {
                try { renderer.close(); } catch (Exception ignored) {}
            }
            if (fd != null) {
                try { fd.close(); } catch (Exception ignored) {}
            }
            if (temp != null) {
                temp.delete();
            }
        }
    }
}
