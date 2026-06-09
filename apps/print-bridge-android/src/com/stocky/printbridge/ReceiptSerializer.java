package com.stocky.printbridge;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;

public class ReceiptSerializer {
    private static final int ESC = 0x1b;
    private static final int GS = 0x1d;

    public static byte[] serialize(JSONObject receipt, int paperWidthMm) throws Exception {
        int columns = paperWidthMm <= 58 ? 32 : (paperWidthMm <= 80 ? 48 : 64);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        cmd(out, ESC, 0x40);
        cmd(out, ESC, 0x74, 0x10);

        JSONObject header = receipt.optJSONObject("header");
        String headerAlign = header != null ? header.optString("alignment", "center") : "center";

        align(out, "center".equals(headerAlign) ? 1 : ("right".equals(headerAlign) ? 2 : 0));
        bold(out, true);
        size(out, true);
        String title = header != null ? header.optString("title", "COMPROBANTE") : "COMPROBANTE";
        writeLine(out, title);
        size(out, false);
        bold(out, false);

        feed(out, 1);

        bold(out, true);
        lineSpacing(out, 42);
        String businessName = header != null ? header.optString("businessName", "Sistema Stocky") : "Sistema Stocky";
        writeLine(out, businessName);
        bold(out, false);
        lineSpacing(out, 42);

        String dateText = header != null ? header.optString("dateText", "") : "";
        if (!dateText.isEmpty()) {
            writeLine(out, dateText);
        }

        feed(out, 1);
        align(out, 0);
        fullSeparator(out, columns);
        feed(out, 1);

        JSONArray metadata = receipt.optJSONArray("metadata");
        if (metadata != null) {
            bold(out, true);
            for (int i = 0; i < metadata.length(); i++) {
                JSONObject row = metadata.optJSONObject(i);
                if (row == null) continue;
                String label = row.optString("label", "");
                String value = row.optString("value", "");
                twoColumns(out, label + ":", value, columns);
            }
            bold(out, false);
        }

        feed(out, 1);
        fullSeparator(out, columns);
        feed(out, 1);

        bold(out, true);
        size(out, true);
        align(out, 0);
        writeLine(out, "PRODUCTO       CANT.      TOTAL");
        size(out, false);
        bold(out, false);
        feed(out, 1);

        JSONArray items = receipt.optJSONArray("items");
        if (items != null) {
            bold(out, true);
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                itemLines(out, item, columns);
                feed(out, 1);
            }
            bold(out, false);
        }

        fullSeparator(out, columns);
        feed(out, 1);

        JSONObject totals = receipt.optJSONObject("totals");
        if (totals != null) {
            double voluntaryTip = totals.optDouble("voluntaryTip", 0);
            if (voluntaryTip > 0) {
                bold(out, true);
                String tipText = totals.optString("voluntaryTipText", String.valueOf(voluntaryTip));
                twoColumns(out, "Propina:", tipText, columns);
                bold(out, false);
                feed(out, 1);
            }

            bold(out, true);
            size(out, true);
            String totalText = totals.optString("totalText", "");
            twoColumns(out, "TOTAL:", totalText, columns);
            size(out, false);
            bold(out, false);
        }

        feed(out, 2);
        fullSeparator(out, columns);
        feed(out, 1);

        JSONObject payment = receipt.optJSONObject("payment");
        String methodText = payment != null ? payment.optString("methodText", "No especificado") : "No especificado";
        bold(out, true);
        twoColumns(out, "Metodo:", methodText, columns);
        bold(out, false);

        feed(out, 3);

        JSONObject ft = receipt.optJSONObject("footer");
        String footerAlign = ft != null ? ft.optString("alignment", "center") : "center";
        align(out, "center".equals(footerAlign) ? 1 : ("right".equals(footerAlign) ? 2 : 0));

        bold(out, true);
        size(out, true);
        String footerMessage = ft != null ? ft.optString("message", "Gracias por su compra") : "Gracias por su compra";
        writeLine(out, footerMessage);
        size(out, false);
        bold(out, false);

        align(out, 0);
        feed(out, 2);

        return out.toByteArray();
    }

    private static String clean(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD);
        return normalized.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "").replaceAll("[^\\x20-\\x7E]", "");
    }

    private static List<String> wrapText(String text, int width) {
        List<String> result = new ArrayList<>();
        String[] words = clean(text).split("\\s+");
        if (words.length == 0 || (words.length == 1 && words[0].isEmpty())) {
            result.add("");
            return result;
        }

        StringBuilder current = new StringBuilder();
        for (String word : words) {
            if (word.isEmpty()) continue;
            if (current.length() == 0) {
                current.append(word);
            } else if (current.length() + word.length() + 1 <= width) {
                current.append(' ').append(word);
            } else {
                result.add(current.toString());
                current = new StringBuilder(word);
            }
        }
        if (current.length() > 0) {
            result.add(current.toString());
        }
        return result.isEmpty() ? java.util.Collections.singletonList("") : result;
    }

    private static void twoColumns(ByteArrayOutputStream out, String left, String right, int columns) throws Exception {
        String cleanRight = clean(right);
        int rightWidth = Math.min(cleanRight.length(), (int) (columns * 0.45));
        int leftWidth = Math.max(1, columns - rightWidth - 1);
        List<String> leftLines = wrapText(left, leftWidth);

        for (int i = 0; i < leftLines.size(); i++) {
            if (i > 0) {
                writeLine(out, leftLines.get(i));
            } else {
                String leftLine = leftLines.get(i);
                int spaces = Math.max(1, columns - leftLine.length() - cleanRight.length());
                StringBuilder sb = new StringBuilder(leftLine);
                for (int s = 0; s < spaces; s++) sb.append(' ');
                sb.append(cleanRight);
                writeLine(out, sb.toString());
            }
        }
    }

    private static void itemLines(ByteArrayOutputStream out, JSONObject item, int columns) throws Exception {
        int quantity = item.optInt("quantity", 0);
        String total = clean(item.optString("subtotalText", item.optString("subtotal", "")));
        String qtyTotal = "x" + quantity + " " + total;
        int nameWidth = Math.max(12, columns - qtyTotal.length() - 1);
        String name = item.optString("name", "Item");
        List<String> names = wrapText(name, nameWidth);

        for (int i = 0; i < names.size(); i++) {
            if (i > 0) {
                writeLine(out, names.get(i));
            } else {
                String nameLine = names.get(i);
                int spaces = Math.max(1, columns - nameLine.length() - qtyTotal.length());
                StringBuilder sb = new StringBuilder(nameLine);
                for (int s = 0; s < spaces; s++) sb.append(' ');
                sb.append(qtyTotal);
                writeLine(out, sb.toString());
            }
        }
    }

    private static void separator(ByteArrayOutputStream out, int columns) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < columns; i++) sb.append('-');
        writeLine(out, sb.toString());
    }

    private static void fullSeparator(ByteArrayOutputStream out, int columns) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < columns; i++) sb.append('=');
        writeLine(out, sb.toString());
    }

    private static void lineSpacing(ByteArrayOutputStream out, int dots) {
        cmd(out, ESC, 0x33, dots);
    }

    private static void align(ByteArrayOutputStream out, int mode) {
        cmd(out, ESC, 0x61, mode);
    }

    private static void bold(ByteArrayOutputStream out, boolean enabled) {
        cmd(out, ESC, 0x45, enabled ? 1 : 0);
    }

    private static void size(ByteArrayOutputStream out, boolean large) {
        cmd(out, GS, 0x21, large ? 0x11 : 0x00);
    }

    private static void feed(ByteArrayOutputStream out, int lines) {
        cmd(out, ESC, 0x64, Math.max(1, lines));
    }

    private static void writeLine(ByteArrayOutputStream out, String value) throws Exception {
        out.write((clean(value) + "\n").getBytes("US-ASCII"));
    }

    private static void cmd(ByteArrayOutputStream out, int... bytes) {
        for (int b : bytes) out.write(b);
    }
}
