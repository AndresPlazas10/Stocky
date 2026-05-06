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
        File temp = File.createTempFile("printjob", ".pdf");
        FileOutputStream output = new FileOutputStream(temp);
        output.write(pdfData);
        output.flush();
        output.close();

        ParcelFileDescriptor fd = ParcelFileDescriptor.open(temp, ParcelFileDescriptor.MODE_READ_ONLY);
        PdfRenderer renderer = new PdfRenderer(fd);

        int targetWidth = paperWidthMm <= 58 ? 384 : 576;
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        for (int i = 0; i < renderer.getPageCount(); i++) {
            PdfRenderer.Page page = renderer.openPage(i);
            float scale = targetWidth / (float) page.getWidth();
            int height = Math.max(1, Math.round(page.getHeight() * scale));
            Bitmap bitmap = Bitmap.createBitmap(targetWidth, height, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(Color.WHITE);
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
            out.write(EscPosRaster.bitmapToRaster(bitmap));
            out.write(EscPosRaster.feed(3));
            page.close();
            bitmap.recycle();
        }

        renderer.close();
        fd.close();
        temp.delete();
        return out.toByteArray();
    }
}
