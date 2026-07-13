export interface ReceiptLabels {
  title: string;
  receiptNumber: string;
  seller: string;
  sellerDefault: string;
  customer: string;
  customerDefault: string;
  productHeader: string;
  quantityAbbreviation: string;
  total: string;
  tip: string;
  method: string;
  notSpecified: string;
  footer: string;
  invalidDate: string;
  kitchenTitle: string;
  kitchenTable: string;
  kitchenFooter: string;
  kitchenSystem: string;
  statusOccupied: string;
  statusAvailable: string;
  itemsLabel: string;
  printError: string;
  printerError: string;
}

export function buildReceiptLabels(
  t: (key: string, opts?: { defaultValue?: string }) => string,
): ReceiptLabels {
  return {
    title: t('mesas:receipt.title'),
    receiptNumber: t('mesas:receipt.receiptNumber'),
    seller: t('mesas:receipt.seller'),
    sellerDefault: t('mesas:receipt.sellerDefault'),
    customer: t('mesas:receipt.customer'),
    customerDefault: t('mesas:receipt.customerDefault'),
    productHeader: t('mesas:receipt.productHeader'),
    quantityAbbreviation: t('mesas:receipt.quantityAbbreviation'),
    total: t('mesas:receipt.total'),
    tip: t('mesas:receipt.tip'),
    method: t('mesas:receipt.method'),
    notSpecified: t('mesas:receipt.notSpecified'),
    footer: t('mesas:receipt.footer'),
    invalidDate: t('mesas:receipt.invalidDate'),
    kitchenTitle: t('mesas:receipt.kitchenTitle'),
    kitchenTable: t('mesas:receipt.kitchenTable'),
    kitchenFooter: t('mesas:receipt.kitchenFooter'),
    kitchenSystem: t('mesas:receipt.kitchenSystem'),
    statusOccupied: t('mesas:receipt.statusOccupied'),
    statusAvailable: t('mesas:receipt.statusAvailable'),
    itemsLabel: t('mesas:receipt.itemsLabel'),
    printError: t('mesas:receipt.printError'),
    printerError: t('mesas:receipt.printerError'),
  };
}
