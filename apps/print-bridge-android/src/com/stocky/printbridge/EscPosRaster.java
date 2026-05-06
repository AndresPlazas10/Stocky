package com.stocky.printbridge;

import android.graphics.Bitmap;

import java.io.ByteArrayOutputStream;

public class EscPosRaster {
    private static final int ESC = 0x1b;
    private static final int GS = 0x1d;

    public static byte[] bitmapToRaster(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int bytesPerRow = (width + 7) / 8;
        byte[] image = new byte[bytesPerRow * height];

        for (int y = 0; y < height; y++) {
            int rowOffset = y * bytesPerRow;
            for (int x = 0; x < width; x++) {
                int pixel = bitmap.getPixel(x, y);
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8) & 0xFF;
                int b = pixel & 0xFF;
                int luminance = (r * 299 + g * 587 + b * 114) / 1000;
                if (luminance < 160) {
                    int index = rowOffset + (x / 8);
                    image[index] |= (byte) (0x80 >> (x % 8));
                }
            }
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(GS);
        out.write(0x76);
        out.write(0x30);
        out.write(0x00);
        out.write(bytesPerRow & 0xFF);
        out.write((bytesPerRow >> 8) & 0xFF);
        out.write(height & 0xFF);
        out.write((height >> 8) & 0xFF);
        out.write(image, 0, image.length);
        return out.toByteArray();
    }

    public static byte[] feed(int lines) {
        return new byte[]{(byte) ESC, 0x64, (byte) Math.max(1, lines)};
    }
}
