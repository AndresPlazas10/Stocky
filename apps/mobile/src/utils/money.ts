const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

export function formatCopAmount(value: number | null | undefined): string {
  const amount = Number(value || 0);
  const absoluteAmount = Math.abs(Math.round(amount));
  const formattedAmount = COP_FORMATTER.format(absoluteAmount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$ ${formattedAmount}`;
}

export function formatCop(value: number | null | undefined): string {
  return formatCopAmount(value);
}
