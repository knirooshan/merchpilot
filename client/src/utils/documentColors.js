export const DEFAULT_DOCUMENT_COLORS = {
  invoicePrimary: "#1E3A8A",
  proformaPrimary: "#065F46",
  quotationPrimary: "#1E3A8A",
  amountWordsBg: "#EFF6FF",
};

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export const normalizeHexColor = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return fallback;
  if (trimmed.length === 4) {
    return (
      "#" +
      trimmed
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase()
    );
  }
  return trimmed.toUpperCase();
};

export const getDocumentColors = (settings) => {
  const raw = settings?.documentColors || {};
  return {
    invoicePrimary: normalizeHexColor(
      raw.invoicePrimary,
      DEFAULT_DOCUMENT_COLORS.invoicePrimary,
    ),
    proformaPrimary: normalizeHexColor(
      raw.proformaPrimary,
      DEFAULT_DOCUMENT_COLORS.proformaPrimary,
    ),
    quotationPrimary: normalizeHexColor(
      raw.quotationPrimary,
      DEFAULT_DOCUMENT_COLORS.quotationPrimary,
    ),
    amountWordsBg: normalizeHexColor(
      raw.amountWordsBg,
      DEFAULT_DOCUMENT_COLORS.amountWordsBg,
    ),
  };
};
