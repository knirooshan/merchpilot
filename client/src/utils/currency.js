/**
 * Format currency based on store settings
 * @param {number} amount - The amount to format
 * @param {object} settings - Store settings object containing currency info
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, settings) => {
  const numAmount = Number(amount);
  if (isNaN(numAmount)) return `$0.00`;

  if (!settings?.currency) {
    // Fallback to USD if no settings
    return `$${addThousandSeparators(numAmount.toFixed(2))}`;
  }

  const { symbol, position } = settings.currency;
  const formattedAmount = addThousandSeparators(numAmount.toFixed(2));

  if (position === "after") {
    return `${formattedAmount}${symbol}`;
  }

  // Default: before
  return `${symbol}${formattedAmount}`;
};

/**
 * Add thousand separators to a formatted number string
 * "1234567.89" → "1,234,567.89"
 */
const addThousandSeparators = (numStr) => {
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

/**
 * Get currency symbol from settings
 * @param {object} settings - Store settings object
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (settings) => {
  return settings?.currency?.symbol || "$";
};

/**
 * Get currency code from settings
 * @param {object} settings - Store settings object
 * @returns {string} Currency code (e.g., USD, EUR, INR)
 */
export const getCurrencyCode = (settings) => {
  return settings?.currency?.code || "USD";
};

/**
 * Get effective currency settings for a document (quotation/invoice).
 * If the document has its own currency stored, use it; otherwise fall back to global settings.
 * @param {object} document - Quotation or Invoice object (may have .currency field)
 * @param {object} settings - Global store settings
 * @returns {object} Settings-like object with { currency: { code, symbol, position } }
 */
export const getDocumentCurrencySettings = (document, settings) => {
  if (document?.currency?.code) {
    return {
      ...settings,
      currency: {
        code: document.currency.code,
        symbol: document.currency.symbol || document.currency.code,
        position: document.currency.position || "before",
      },
    };
  }
  return settings;
};

/**
 * Check if a document (quotation or invoice) is in a foreign currency.
 * Returns false if it's in the base currency (or no currency specified).
 * @param {object} document - Quotation or Invoice object (or { currency, exchangeRate })
 * @param {object} settings - Global store settings
 * @returns {boolean} True if foreign currency, false if base currency
 */
export const isForeignCurrency = (document, settings) => {
  if (!document?.currency?.code) return false;
  const baseCode =
    settings?.currency?.code ||
    document?.exchangeRate?.baseCurrency ||
    "LKR";
  if (document.currency.code.toUpperCase() === baseCode.toUpperCase()) {
    return false;
  }
  if (
    document?.exchangeRate?.baseCurrency &&
    document.currency.code.toUpperCase() ===
    document.exchangeRate.baseCurrency.toUpperCase()
  ) {
    return false;
  }
  return true;
};

