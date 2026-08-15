import {
  buildTicketCss,
  getBaseFontPx,
  getReceiptColumns,
  getTicketPrintableHeightMm,
  getTicketPrintableWidthMm,
  TICKET_DOUBLE_LINE_HEIGHT_MM,
  TICKET_LINE_HEIGHT_MM,
  TICKET_MAX_PAGE_HEIGHT_MM,
  fullSeparator,
} from './receiptLayout.js';
import { TICKET_FONT_STACK } from './receiptLayout.js';

export function buildDiagnosticHtml(printerWidthMm: number, pageHeightMm: number = TICKET_MAX_PAGE_HEIGHT_MM): string {
  const columns = getReceiptColumns(printerWidthMm);
  const baseFontPx = getBaseFontPx(printerWidthMm);
  const printableWidthMm = getTicketPrintableWidthMm(printerWidthMm);
  const printableHeightMm = getTicketPrintableHeightMm(pageHeightMm);

  const bar = (heightMm: number) => `<div class="bar" style="height:${heightMm}mm"></div>`;
  const h1Text = 'DIAGNOSTICO STOCKY';
  const maxH1FontPx = (printableWidthMm * (96 / 25.4)) / (h1Text.length * 0.65);
  const h1FontPx = Math.min(baseFontPx * 2, maxH1FontPx);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Diagnostico Stocky</title>
<style>
${buildTicketCss(printerWidthMm, pageHeightMm)}
  body {
    width:${printableWidthMm}mm; max-width:${printableWidthMm}mm; margin:0; padding:1mm 0;
    font-family:${TICKET_FONT_STACK}; font-size:${baseFontPx}px; line-height:1.35; color:#000; background:#fff;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .ticket { width:100%; padding:1mm 0; box-sizing:border-box; break-inside:avoid; page-break-inside:avoid; }
  .ticket div { white-space:pre; overflow:hidden; height:${TICKET_LINE_HEIGHT_MM}mm; line-height:${TICKET_LINE_HEIGHT_MM}mm; }
  .ticket h1 { font-size:${h1FontPx.toFixed(1)}px; text-align:center; font-weight:700; height:${TICKET_DOUBLE_LINE_HEIGHT_MM}mm; line-height:${TICKET_DOUBLE_LINE_HEIGHT_MM}mm; }
  .bar { width:100%; box-sizing:border-box; border-top:2px solid #000; border-bottom:2px solid #000; background:#000; }
</style></head>
<body>
  <div class="ticket">
    <h1>DIAGNOSTICO STOCKY</h1>
    <div style="text-align:center">Mide las barras con una regla</div>
    <div></div>
    <div>Papel: ${printerWidthMm}mm ancho, ${pageHeightMm}mm largo</div>
    <div>Area imprimible: ${printableWidthMm}mm</div>
    <div>Altura imprimible: ${printableHeightMm}mm</div>
    <div></div>
    <div>${fullSeparator(columns)}</div>
    <div></div>
    <div style="font-weight:700">Barra A = 50mm</div>
    ${bar(50)}
    <div style="font-weight:700">Barra B = 100mm</div>
    ${bar(100)}
    <div></div>
    <div>${fullSeparator(columns)}</div>
    <div></div>
    <div>Si A no mide ~50mm y B ~100mm,</div>
    <div>el dialogo esta con Escala != 100%</div>
    <div>o el papel del driver no es 58(48)mm</div>
    <div></div>
    <div>Si ves 2 paginas en el dialogo,</div>
    <div>imprime solo la pagina 1 y reporta</div>
    <div>cuanto papel en blanco queda despues</div>
    <div></div>
    <div>Regla (aprox):</div>
    <div>0---10---20---30---40---50---60mm</div>
  </div>
</body>
</html>`;
}

export function printDiagnostic(printerWidthMm: number, pageHeightMm: number = TICKET_MAX_PAGE_HEIGHT_MM): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildDiagnosticHtml(printerWidthMm, pageHeightMm));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
