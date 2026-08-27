export function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toLocaleString()}`;
  }
}

