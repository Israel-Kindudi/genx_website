export function formatCurrencyAmount(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
