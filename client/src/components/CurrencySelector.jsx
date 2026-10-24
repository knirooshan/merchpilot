import { Globe } from "lucide-react";

// Common international currencies
const CURRENCIES = [
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", position: "before" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", position: "before" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", position: "before" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", position: "before" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", position: "before" },
  { code: "EUR", symbol: "€", name: "Euro", position: "before" },
  { code: "GBP", symbol: "£", name: "British Pound", position: "before" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", position: "before" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", position: "before" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", position: "before" },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar", position: "before" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", position: "before" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", position: "before" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", position: "before" },
  { code: "OMR", symbol: "﷼", name: "Omani Rial", position: "before" },
  { code: "QAR", symbol: "﷼", name: "Qatari Rial", position: "before" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", position: "before" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", position: "before" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", position: "before" },
  { code: "USD", symbol: "$", name: "US Dollar", position: "before" },
];

/**
 * CurrencySelector
 *
 * Props:
 *   settings         - global store settings (contains base currency)
 *   currency         - current { code, symbol, position } state
 *   exchangeRate     - current { rate, baseCurrency } state
 *   onChange         - ({ currency, exchangeRate }) => void
 */
const CurrencySelector = ({ settings, currency, exchangeRate, onChange }) => {
  const baseCurrencyCode =
    settings?.currency?.code || exchangeRate?.baseCurrency || "LKR";

  const isBaseCurrency =
    !currency?.code ||
    currency.code.toUpperCase() === baseCurrencyCode.toUpperCase() ||
    (exchangeRate?.baseCurrency &&
      currency.code.toUpperCase() ===
      exchangeRate.baseCurrency.toUpperCase());

  const handleCurrencyChange = (e) => {
    const code = e.target.value;
    if (
      !code ||
      code.toUpperCase() === baseCurrencyCode.toUpperCase() ||
      (exchangeRate?.baseCurrency &&
        code.toUpperCase() === exchangeRate.baseCurrency.toUpperCase())
    ) {
      onChange({ currency: null, exchangeRate: null });
    } else {
      const found = CURRENCIES.find((c) => c.code === code);
      onChange({
        currency: found
          ? { code: found.code, symbol: found.symbol, position: found.position }
          : { code, symbol: code, position: "before" },
        exchangeRate: {
          rate: exchangeRate?.rate || "",
          baseCurrency: baseCurrencyCode,
        },
      });
    }
  };

  const handleRateChange = (e) => {
    const rate = parseFloat(e.target.value) || "";
    onChange({
      currency,
      exchangeRate: { rate, baseCurrency: baseCurrencyCode },
    });
  };

  const selectedCode = currency?.code || baseCurrencyCode;

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md px-3 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-300">Currency</span>
        {!isBaseCurrency && (
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
            Foreign
          </span>
        )}
      </div>
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Select currency</label>
          <select
            value={selectedCode}
            onChange={handleCurrencyChange}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-[180px]"
          >
            <option value={baseCurrencyCode}>
              {baseCurrencyCode} (Base - no conversion)
            </option>
            {CURRENCIES.filter((c) => c.code !== baseCurrencyCode).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {!isBaseCurrency && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">
              Exchange rate (1 {currency?.code} = ? {baseCurrencyCode})
            </label>
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder="e.g. 320"
              value={exchangeRate?.rate || ""}
              onChange={handleRateChange}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        )}

        {!isBaseCurrency && exchangeRate?.rate > 0 && (
          <div className="text-xs text-slate-400 pb-2">
            1 {currency?.code} ={" "}
            <span className="text-green-400 font-medium">
              {Number(exchangeRate.rate).toLocaleString()} {baseCurrencyCode}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrencySelector;
