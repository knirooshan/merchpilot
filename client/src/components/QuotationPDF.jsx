import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import {
  formatCurrency,
  getDocumentCurrencySettings,
  isForeignCurrency,
} from "../utils/currency";
import { formatDate } from "../utils/date";
import { getTaxDisplay } from "../utils/taxDisplay";
import { getDocumentColors } from "../utils/documentColors";
import { renderHtmlToPdf } from "../utils/pdfUtils.jsx";

// ---------------------------------------------------------------------------
// Number to words (LKR-style: up to billions)
// ---------------------------------------------------------------------------
const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function numberToWords(n) {
  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numberToWords(-n);
  if (n < 20) return ones[n];
  if (n < 100)
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000)
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + numberToWords(n % 100) : "")
    );
  if (n < 100000)
    return (
      numberToWords(Math.floor(n / 1000)) +
      " Thousand" +
      (n % 1000 ? " " + numberToWords(n % 1000) : "")
    );
  if (n < 10000000)
    return (
      numberToWords(Math.floor(n / 100000)) +
      " Lakh" +
      (n % 100000 ? " " + numberToWords(n % 100000) : "")
    );
  return (
    numberToWords(Math.floor(n / 10000000)) +
    " Crore" +
    (n % 10000000 ? " " + numberToWords(n % 10000000) : "")
  );
}

function amountInWords(amount, settings) {
  const total = Math.abs(parseFloat(amount) || 0);
  const rupees = Math.floor(total);
  const cents = Math.round((total - rupees) * 100);
  const currencyName =
    settings?.currency?.code === "LKR"
      ? "Rupees"
      : settings?.currency?.code === "USD"
        ? "Dollars"
        : settings?.currency?.code === "GBP"
          ? "Pounds"
          : settings?.currency?.code || "Units";
  const centName = "Cents";

  let words = numberToWords(rupees) + " " + currencyName;
  if (cents > 0) words += " and " + numberToWords(cents) + " " + centName;
  return words + " Only";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 36,
    fontFamily: "Helvetica",
    color: "#111827",
    fontSize: 9,
  },
  // ── Header ──────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  titleBlock: {
    flexDirection: "column",
  },
  titleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E3A8A",
    letterSpacing: 2,
  },
  taxInvNoLabel: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 4,
  },
  taxInvNoValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginTop: 2,
  },
  logo: {
    width: 100,
    height: 44,
    objectFit: "contain",
    marginTop: 4,
  },
  // ── Blue header divider ──────────────────────────────────
  headerDivider: {
    height: 2,
    backgroundColor: "#1E3A8A",
    marginBottom: 20,
  },
  // ── Two-column info grid ─────────────────────────────────
  infoGrid: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 16,
  },
  infoCol: {
    width: "50%",
    padding: 10,
    borderRightWidth: 0.5,
    borderRightColor: "#E5E7EB",
  },
  infoColRight: {
    width: "50%",
    padding: 10,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
  },
  infoText: {
    fontSize: 9,
    color: "#1F2937",
    marginBottom: 0,
    lineHeight: 1.4,
  },
  infoTextBold: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 0,
  },
  tinText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 0,
  },
  // ── Details bar (date issued, valid until, etc.) ─────────
  detailsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#F8FAFC",
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    padding: 8,
    marginBottom: 10,
    gap: 0,
  },
  detailCell: {
    width: "25%",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 7,
    color: "#6B7280",
    marginBottom: 1,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 9,
    color: "#111827",
    fontWeight: "bold",
  },
  // ── Table ────────────────────────────────────────────────
  table: {
    marginTop: 4,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E3A8A",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "flex-start",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  colRef: { width: "6%", paddingRight: 2 },
  colImage: { width: "10%", paddingRight: 4 },
  colDesc: { width: "36%", paddingRight: 4 },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "18%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  productImage: {
    width: 30,
    height: 30,
    objectFit: "contain",
  },
  imagePlaceholder: {
    width: 30,
    height: 30,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
  },
  thText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tdText: {
    fontSize: 9,
    color: "#1F2937",
  },
  tdSub: {
    fontSize: 7,
    color: "#6B7280",
    marginTop: 1,
  },
  // ── Totals ────────────────────────────────────────────────
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  totalsTable: {
    width: "45%",
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    borderRadius: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  totalLabelText: {
    fontSize: 9,
    color: "#6B7280",
  },
  totalValueText: {
    fontSize: 9,
    color: "#111827",
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#1E3A8A",
    borderRadius: 2,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "right",
  },
  // ── Amount in words ───────────────────────────────────────
  amountWords: {
    marginBottom: 8,
    padding: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 3,
  },
  amountWordsLabel: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  amountWordsText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  // ── Notes ────────────────────────────────────────────────
  notes: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  noteTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  // ── Footer ────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 25,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 7,
    color: "#9CA3AF",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  footerNote: {
    fontSize: 6.5,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const hasContent = (html) => {
  if (!html) return false;
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim() !== ""
  );
};

const QuotationPDF = ({ quotation, settings }) => {
  const effectiveSettings = getDocumentCurrencySettings(quotation, settings);
  const colors = getDocumentColors(settings);
  const taxInfo = getTaxDisplay(quotation, settings);
  const supplierTIN = settings?.taxIdNo || "";
  const purchaserTIN = quotation.customer?.taxNumber || "";

  const customerName = [
    quotation.customer?.salutation || "",
    quotation.customer?.firstName || "",
    quotation.customer?.lastName || "",
  ]
    .filter(Boolean)
    .join(" ");

  const customerAddress = [
    quotation.customer?.billing?.company || "",
    quotation.customer?.billing?.address_1 || "",
    quotation.customer?.billing?.address_2 || "",
    [
      quotation.customer?.billing?.city || "",
      quotation.customer?.billing?.state || "",
      quotation.customer?.billing?.postcode || "",
    ]
      .filter(Boolean)
      .join(", "),
    quotation.customer?.billing?.country || "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.titleText, { color: colors.quotationPrimary }]}>
              QUOTATION
            </Text>
            <Text style={styles.taxInvNoLabel}>Quotation No.</Text>
            <Text
              style={[
                styles.taxInvNoValue,
                { color: colors.quotationPrimary },
              ]}
            >
              {quotation.quotationNumber}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {settings?.logo && (
              <Image style={styles.logo} src={settings.logo} />
            )}
          </View>
        </View>

        <View
          style={[
            styles.headerDivider,
            { backgroundColor: colors.quotationAccent },
          ]}
        />

        {/* ── Supplier & Customer Info ── */}
        <View style={styles.infoGrid}>
          {/* Supplier (left) */}
          <View style={styles.infoCol}>
            <Text style={styles.sectionLabel}>Supplier</Text>
            <Text style={styles.infoTextBold}>{settings?.storeName || ""}</Text>
            {supplierTIN ? (
              <Text style={styles.tinText}>TIN/VAT: {supplierTIN}</Text>
            ) : null}
            {settings?.registrationNo ? (
              <Text style={styles.infoText}>
                Reg: {settings.registrationNo}
              </Text>
            ) : null}
            {settings?.address?.street ? (
              <Text style={styles.infoText}>{settings.address.street}</Text>
            ) : null}
            {settings?.address?.city || settings?.address?.zip ? (
              <Text style={styles.infoText}>
                {settings?.address?.city}
                {settings?.address?.city && settings?.address?.zip ? ", " : ""}
                {settings?.address?.zip}
              </Text>
            ) : null}
            {settings?.contact?.phone ? (
              <Text style={styles.infoText}>Tel: {settings.contact.phone}</Text>
            ) : null}
            {settings?.contact?.email ? (
              <Text style={styles.infoText}>{settings.contact.email}</Text>
            ) : null}
          </View>

          {/* Customer (right) */}
          <View style={styles.infoColRight}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <Text style={styles.infoTextBold}>{customerName}</Text>
            {customerAddress ? (
              <Text style={styles.infoText}>{customerAddress}</Text>
            ) : null}
            {purchaserTIN ? (
              <Text style={styles.tinText}>TIN/VAT: {purchaserTIN}</Text>
            ) : null}
            {quotation.customer?.billing?.phone && (
              <Text style={styles.infoText}>
                Tel: {quotation.customer.billing.phone}
              </Text>
            )}
            {quotation.customer?.email && (
              <Text style={styles.infoText}>{quotation.customer.email}</Text>
            )}
          </View>
        </View>

        {/* ── Details Bar ── */}
        <View style={styles.detailsBar}>
          <View style={styles.detailCell}>
            <Text style={styles.detailLabel}>Date Issued</Text>
            <Text style={styles.detailValue}>
              {formatDate(quotation.quotationDate || quotation.createdAt, {
                dateTime: { dateFormat: "MM/DD/YYYY" },
              })}
            </Text>
          </View>
          {quotation.validUntil && (
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Valid Until</Text>
              <Text style={styles.detailValue}>
                {formatDate(quotation.validUntil, {
                  dateTime: { dateFormat: "MM/DD/YYYY" },
                })}
              </Text>
            </View>
          )}
          {isForeignCurrency(quotation, settings) && (
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Currency</Text>
              <Text style={[styles.detailValue, { color: "#d97706" }]}>
                {quotation.currency.code}
                {quotation.exchangeRate?.rate > 0
                  ? `  (1 ${quotation.currency.code} = ${quotation.exchangeRate.rate} ${
                      quotation.exchangeRate.baseCurrency ||
                      settings?.currency?.code ||
                      "LKR"
                    })`
                  : ""}
              </Text>
            </View>
          )}
        </View>

        {/* ── Items Table ── */}
        <View style={styles.table}>
          {/* Header */}
          <View
            style={[
              styles.tableHeader,
              { backgroundColor: colors.quotationPrimary },
            ]}
          >
            <View style={styles.colRef}>
              <Text style={styles.thText}>Ref</Text>
            </View>
            <View style={styles.colImage}>
              <Text style={styles.thText}>Image</Text>
            </View>
            <View style={styles.colDesc}>
              <Text style={styles.thText}>Description of Goods / Services</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={[styles.thText, { textAlign: "right" }]}>Qty</Text>
            </View>
            <View style={styles.colUnit}>
              <Text style={[styles.thText, { textAlign: "right" }]}>
                Unit Price
              </Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={[styles.thText, { textAlign: "right" }]}>
                Amount
              </Text>
            </View>
          </View>

          {/* Rows */}
          {(quotation.items || []).map((item, index) => (
            <View
              style={[
                styles.tableRow,
                index % 2 === 1 ? styles.tableRowAlt : {},
              ]}
              key={index}
            >
              <View style={styles.colRef}>
                <Text style={styles.tdText}>{index + 1}</Text>
              </View>
              <View style={styles.colImage}>
                {item.image ? (
                  <Image
                    style={styles.productImage}
                    src={item.image}
                    cache={false}
                  />
                ) : (
                  <View style={styles.imagePlaceholder} />
                )}
              </View>
              <View style={styles.colDesc}>
                <Text style={styles.tdText}>{item.name}</Text>
                {item.sku ? (
                  <Text style={styles.tdSub}>SKU: {item.sku}</Text>
                ) : null}
                {(item.description || item.product?.shortDescription) && (
                  <View style={{ marginTop: 2 }}>
                    {renderHtmlToPdf(
                      item.description || item.product.shortDescription,
                      styles.tdSub,
                    )}
                  </View>
                )}
                {item.discount > 0 && (
                  <Text style={[styles.tdSub, { color: "#EF4444" }]}>
                    Discount:{" "}
                    {item.discountType === "percentage"
                      ? `${item.discount}%`
                      : formatCurrency(item.discount, effectiveSettings)}
                  </Text>
                )}
              </View>
              <View style={styles.colQty}>
                <Text style={[styles.tdText, { textAlign: "right" }]}>
                  {item.quantity}
                </Text>
              </View>
              <View style={styles.colUnit}>
                <Text style={[styles.tdText, { textAlign: "right" }]}>
                  {formatCurrency(item.price, effectiveSettings)}
                </Text>
              </View>
              <View style={styles.colTotal}>
                <Text
                  style={[
                    styles.tdText,
                    { textAlign: "right", fontWeight: "bold" },
                  ]}
                >
                  {formatCurrency(item.total, effectiveSettings)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            {/* Subtotal */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelText}>Subtotal</Text>
              <Text style={styles.totalValueText}>
                {formatCurrency(quotation.subtotal, effectiveSettings)}
              </Text>
            </View>

            {/* Tax line is always shown, even at 0% */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelText}>{taxInfo.lineLabel}</Text>
              <Text style={styles.totalValueText}>
                {formatCurrency(quotation.tax || 0, effectiveSettings)}
              </Text>
            </View>

            {/* Discount */}
            {quotation.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelText}>Discount</Text>
                <Text style={[styles.totalValueText, { color: "#EF4444" }]}>
                  -{formatCurrency(quotation.discount, effectiveSettings)}
                </Text>
              </View>
            )}

            {/* Delivery */}
            {quotation.deliveryCharge > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelText}>Delivery Charge</Text>
                <Text style={styles.totalValueText}>
                  {formatCurrency(quotation.deliveryCharge, effectiveSettings)}
                </Text>
              </View>
            )}

            {/* Grand Total */}
            <View
              style={[
                styles.grandTotalRow,
                { backgroundColor: colors.quotationPrimary },
              ]}
            >
              <Text style={styles.grandTotalLabel}>Total Amount</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(quotation.total, effectiveSettings)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Total in Words ── */}
        <View
          style={[
            styles.amountWords,
            { backgroundColor: colors.amountWordsBg },
          ]}
        >
          <Text style={styles.amountWordsLabel}>Total Amount in Words</Text>
          <Text
            style={[
              styles.amountWordsText,
              { color: colors.quotationPrimary },
            ]}
          >
            {amountInWords(quotation.total, effectiveSettings)}
          </Text>
        </View>

        {/* ── Notes & Terms ── */}
        {(hasContent(quotation.notes) ||
          hasContent(quotation.terms) ||
          hasContent(quotation.deliveryNote)) && (
          <View style={styles.notes}>
            {hasContent(quotation.notes) && (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.noteTitle}>Notes</Text>
                <View>
                  {renderHtmlToPdf(quotation.notes, {
                    fontSize: 8,
                    color: "#1F2937",
                  })}
                </View>
              </View>
            )}
            {hasContent(quotation.terms) && (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.noteTitle}>Terms & Conditions</Text>
                <View>
                  {renderHtmlToPdf(quotation.terms, {
                    fontSize: 8,
                    color: "#1F2937",
                  })}
                </View>
              </View>
            )}
            {hasContent(quotation.deliveryNote) && (
              <View>
                <Text style={styles.noteTitle}>Delivery Note</Text>
                <View>
                  {renderHtmlToPdf(quotation.deliveryNote, {
                    fontSize: 8,
                    color: "#1F2937",
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          {settings?.bank?.accountName && (
            <View style={{ marginTop: 6, alignItems: "center" }}>
              <Text style={{ fontWeight: "bold", marginBottom: 1 }}>
                Bank Details:
              </Text>
              <Text>
                {settings.bank.bankName}
                {settings.bank.branch ? `, ${settings.bank.branch}` : ""}
              </Text>
              <Text>
                Account Name: {settings.bank.accountName} | Account No:{" "}
                {settings.bank.accountNumber}
              </Text>
              {settings.bank.swiftCode && (
                <Text>Swift Code: {settings.bank.swiftCode}</Text>
              )}
            </View>
          )}
          <Text style={styles.footerNote}>
            This is a computer-generated Quotation. No signature is required.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default QuotationPDF;
