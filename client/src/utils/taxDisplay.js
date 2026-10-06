// Builds the tax line label and registration status for invoices/quotations.
// The tax line is always displayed (even at 0%) as "<label> (<rate>%)".
export const getTaxDisplay = (doc, settings) => {
  const label = settings?.tax?.label || "Tax";
  const settingsRate = Number(settings?.tax?.rate) || 0;
  const docRate = Number(doc?.taxRate) || 0;
  // Older documents may have tax charged but no stored rate
  const rate = docRate > 0 ? docRate : doc?.tax > 0 ? settingsRate : 0;
  // Charging tax implies the supplier is registered
  const registered = settings?.tax?.registered === true || rate > 0;

  return {
    label,
    rate,
    registered,
    lineLabel: `${label} (${rate}%)`,
  };
};
