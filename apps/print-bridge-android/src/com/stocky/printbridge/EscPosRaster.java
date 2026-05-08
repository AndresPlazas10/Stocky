package com.stocky.printbridge;

import android.graphics.Bitmap;

import java.io.ByteArrayOutputStream;

public class EscPosRaster {
    private static final int ESC = 0x1b;
    private static final int GS = 0x1d;

    public static Bitmap trimBottomWhitespace(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int lastContentRow = -1;
        int[] pixels = new int[width];
        for (int y = height - 1; y >= 0; y--) {
            bitmap.getPixels(pixels, 0, width, 0, y, width, 1);
            for (int x = 0; x < width; x++) {
                int pixel = pixels[x];
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8) & 0xFF;
                int b = pixel & 0xFF;
                int luminance = (r * 299 + g * 587 + b * 114) / 1000;
                if (luminance < 160) {
                    lastContentRow = y;
                    break;
                }
            }
            if (lastContentRow >= 0) break;
        }
        if (lastContentRow < 0) return bitmap;
        int trimmedHeight = Math.min(height, lastContentRow + 8);
        return Bitmap.createBitmap(bitmap, 0, 0, width, trimmedHeight);
    }

    public static byte[] bitmapToRaster(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int bytesPerRow = (width + 7) / 8;
        byte[] image = new byte[bytesPerRow * height];
        int[] rowPixels = new int[width];

        for (int y = 0; y < height; y++) {
            bitmap.getPixels(rowPixels, 0, width, 0, y, width, 1);
            int rowOffset = y * bytesPerRow;
            for (int x = 0; x < width; x++) {
                int pixel = rowPixels[x];
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
        out.write(ESC);
        out.write(0x45);
        out.write(0x01);
        out.write(GS);
        out.write(0x76);
        out.write(0x30);
        out.write(0x00);
        out.write(bytesPerRow & 0xFF);
        out.write((bytesPerRow >> 8) & 0xFF);
        out.write(height & 0xFF);
        out.write((height >> 8) & 0xFF);
        out.write(image, 0, image.length);
        out.write(ESC);
        out.write(0x45);
        out.write(0x00);
        return out.toByteArray();
    }

    public static byte[] feed(int lines) {
        return new byte[]{(byte) ESC, 0x64, (byte) Math.max(1, lines)};
    }
}
