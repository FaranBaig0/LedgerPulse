export type SupportedCurrency = "USD" | "GBP" | "EUR" | "PKR";

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", label: "USD ($) - US Dollar" },
  GBP: { code: "GBP", symbol: "£", label: "GBP (£) - British Pound" },
  EUR: { code: "EUR", symbol: "€", label: "EUR (€) - Euro" },
  PKR: { code: "PKR", symbol: "Rs ", label: "PKR (Rs) - Pakistani Rupee" }
};

/**
 * Formats dollar float amount according to the tenant base currency
 */
export function formatCurrency(amount: number, currencyCode: string = "USD"): string {
  const code = (currencyCode.toUpperCase() as SupportedCurrency) in SUPPORTED_CURRENCIES
    ? (currencyCode.toUpperCase() as SupportedCurrency)
    : "USD";

  const config = SUPPORTED_CURRENCIES[code];
  const formattedNumber = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const sign = amount < 0 ? "-" : "";

  if (code === "PKR") {
    return `${sign}Rs ${formattedNumber}`;
  }

  return `${sign}${config.symbol}${formattedNumber}`;
}
