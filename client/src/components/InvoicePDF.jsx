import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { formatCurrency, getDocumentCurrencySettings } from "../utils/currency";
import { formatDate } from "../utils/date";
import { getTaxDisplay } from "../utils/taxDisplay";
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
  const centName = settings?.currency?.code === "LKR" ? "Cents" : "Cents";

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
  titleTextProforma: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#065F46",
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
  taxInvNoValueProforma: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#065F46",
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
  headerDividerProforma: {
    height: 2,
    backgroundColor: "#065F46",
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
  // ── Details bar (invoice date, due date, etc.) ───────────
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
  colRef: { width: "8%", paddingRight: 2 },
  colDesc: { width: "42%", paddingRight: 4 },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "18%", textAlign: "right" },
  colTotal: { width: "22%", textAlign: "right" },
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
  // ── Mode of payment ───────────────────────────────────────
  modeRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 4,
    alignItems: "center",
  },
  modeLabel: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "bold",
  },
  modeValue: {
    fontSize: 9,
    color: "#111827",
    fontWeight: "bold",
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

const InvoicePDF = ({ invoice, settings }) => {
  const isProforma = invoice?.invoiceType === "proforma";
  const effectiveSettings = getDocumentCurrencySettings(invoice, settings);
  const amountPaid = invoice.amountPaid || 0;
  const balanceDue =
    invoice.balanceDue !== undefined
      ? invoice.balanceDue
      : invoice.total - amountPaid;

  const taxInfo = getTaxDisplay(invoice, settings);
  const documentTitle = isProforma
    ? "Proforma Invoice"
    : taxInfo.registered
      ? "Tax Invoice"
      : "Invoice";
  const supplierTIN = settings?.taxIdNo || "";
  const purchaserTIN =
    invoice.customer?.taxNumber || invoice.customerInfo?.taxNumber || "";

  const customerName = [
    invoice.customer?.salutation || "",
    invoice.customer?.firstName || invoice.customerInfo?.firstName || "",
    invoice.customer?.lastName || invoice.customerInfo?.lastName || "",
  ]
    .filter(Boolean)
    .join(" ");

  const customerAddress = [
    invoice.customer?.billing?.company || invoice.customerInfo?.company || "",
    invoice.customer?.billing?.address_1 || "",
    invoice.customer?.billing?.address_2 || "",
    [
      invoice.customer?.billing?.city || "",
      invoice.customer?.billing?.state || "",
      invoice.customer?.billing?.postcode || "",
    ]
      .filter(Boolean)
      .join(", "),
    invoice.customer?.billing?.country || invoice.customerInfo?.country || "",
  ]
    .filter(Boolean)
    .join("\n");

  const supplierAddress = [
    settings?.address?.street || "",
    [settings?.address?.city || "", settings?.address?.zip || ""]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text
              style={isProforma ? styles.titleTextProforma : styles.titleText}
            >
              {isProforma ? "PROFORMA INVOICE" : documentTitle.toUpperCase()}
            </Text>
            <Text style={styles.taxInvNoLabel}>
              {`${documentTitle} No.`}
            </Text>
            <Text
              style={
                isProforma ? styles.taxInvNoValueProforma : styles.taxInvNoValue
              }
            >
              {invoice.taxInvoiceNumber || invoice.invoiceNumber}
            </Text>
            {invoice.invoiceNumber &&
              invoice.taxInvoiceNumber &&
              invoice.taxInvoiceNumber !== invoice.invoiceNumber && (
                <Text style={[styles.taxInvNoLabel, { marginTop: 1 }]}>
                  Ref: {invoice.invoiceNumber}
                </Text>
              )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {settings?.logo && (
              <Image style={styles.logo} src={settings.logo} />
            )}
          </View>
        </View>

        <View
          style={
            isProforma ? styles.headerDividerProforma : styles.headerDivider
          }
        />

        {/* ── Supplier & Purchaser Info ── */}
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

          {/* Purchaser (right) */}
          <View style={styles.infoColRight}>
            <Text style={styles.sectionLabel}>Purchaser</Text>
            <Text style={styles.infoTextBold}>{customerName}</Text>
            {customerAddress ? (
              <Text style={styles.infoText}>{customerAddress}</Text>
            ) : null}
            {purchaserTIN ? (
              <Text style={styles.tinText}>TIN/VAT: {purchaserTIN}</Text>
            ) : null}
            {(invoice.customer?.billing?.phone ||
              invoice.customerInfo?.phone) && (
              <Text style={styles.infoText}>
                Tel:{" "}
                {invoice.customer?.billing?.phone ||
                  invoice.customerInfo?.phone}
              </Text>
            )}
            {(invoice.customer?.email || invoice.customerInfo?.email) && (
              <Text style={styles.infoText}>
                {invoice.customer?.email || invoice.customerInfo?.email}
              </Text>
            )}
          </View>
        </View>

        {/* ── Details Bar ── */}
        <View style={styles.detailsBar}>
          <View style={styles.detailCell}>
            <Text style={styles.detailLabel}>Date of Invoice</Text>
            <Text style={styles.detailValue}>
              {formatDate(invoice.invoiceDate || invoice.createdAt, {
                dateTime: { dateFormat: "MM/DD/YYYY" },
              })}
            </Text>
          </View>
          <View style={styles.detailCell}>
            <Text style={styles.detailLabel}>Date of Delivery</Text>
            <Text style={styles.detailValue}>
              {formatDate(
                invoice.deliveryDate ||
                  invoice.invoiceDate ||
                  invoice.createdAt,
                {
                  dateTime: { dateFormat: "MM/DD/YYYY" },
                },
              )}
            </Text>
          </View>
          {invoice.placeOfSupply && (
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Place of Supply</Text>
              <Text style={styles.detailValue}>{invoice.placeOfSupply}</Text>
            </View>
          )}
          {invoice.reference && (
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={styles.detailValue}>{invoice.reference}</Text>
            </View>
          )}
          {invoice.currency?.code &&
            invoice.currency.code !== settings?.currency?.code && (
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Currency</Text>
                <Text style={[styles.detailValue, { color: "#d97706" }]}>
                  {invoice.currency.code}
                  {invoice.exchangeRate?.rate > 0
                    ? `  (1 ${invoice.currency.code} = ${invoice.exchangeRate.rate} ${invoice.exchangeRate.baseCurrency})`
                    : ""}
                </Text>
              </View>
            )}
          {invoice.dueDate === undefined || !invoice.placeOfSupply ? (
            /* Fill empty cell to keep alignment tidy */
            <View style={styles.detailCell} />
          ) : null}
        </View>

        {/* ── Items Table ── */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colRef}>
              <Text style={styles.thText}>Ref</Text>
            </View>
            <View style={styles.colDesc}>
              <Text style={styles.thText}>Description of Goods / Services</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.thText}>Qty</Text>
            </View>
            <View style={styles.colUnit}>
              <Text style={[styles.thText, { textAlign: "right" }]}>
                Unit Price
              </Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={[styles.thText, { textAlign: "right" }]}>
                Amount Excl. VAT (Rs.)
              </Text>
            </View>
          </View>

          {/* Rows */}
          {invoice.items.map((item, index) => (
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
            {/* Subtotal / Total Value of Supply */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelText}>Total Value of Supply</Text>
              <Text style={styles.totalValueText}>
                {formatCurrency(invoice.subtotal, effectiveSettings)}
              </Text>
            </View>

            {/* Tax line is always shown, even at 0% */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelText}>{taxInfo.lineLabel}</Text>
              <Text style={styles.totalValueText}>
                {formatCurrency(invoice.tax || 0, effectiveSettings)}
              </Text>
            </View>

            {/* Discount */}
            {invoice.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelText}>Discount</Text>
                <Text style={[styles.totalValueText, { color: "#EF4444" }]}>
                  -{formatCurrency(invoice.discount, effectiveSettings)}
                </Text>
              </View>
            )}

            {/* Delivery */}
            {invoice.deliveryCharge > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelText}>Delivery Charge</Text>
                <Text style={styles.totalValueText}>
                  {formatCurrency(invoice.deliveryCharge, effectiveSettings)}
                </Text>
              </View>
            )}

            {/* Grand Total */}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total Amount</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(invoice.total, effectiveSettings)}
              </Text>
            </View>

            {/* Amount Paid & Balance */}
            {(amountPaid > 0 || invoice.status === "paid") && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabelText}>Amount Paid</Text>
                  <Text style={styles.totalValueText}>
                    {formatCurrency(amountPaid, effectiveSettings)}
                  </Text>
                </View>
                <View style={[styles.totalRow, { borderBottomWidth: 0 }]}>
                  <Text
                    style={[
                      styles.totalLabelText,
                      { fontWeight: "bold", color: "#111827" },
                    ]}
                  >
                    Balance Due
                  </Text>
                  <Text style={[styles.totalValueText, { fontWeight: "bold" }]}>
                    {formatCurrency(balanceDue, effectiveSettings)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Total in Words ── */}
        <View style={styles.amountWords}>
          <Text style={styles.amountWordsLabel}>Total Amount in Words</Text>
          <Text style={styles.amountWordsText}>
            {amountInWords(invoice.total, effectiveSettings)}
          </Text>
        </View>

        {/* ── Mode of Payment ── */}
        {invoice.paymentMethod && (
          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>Mode of Payment: </Text>
            <Text style={styles.modeValue}>{invoice.paymentMethod}</Text>
          </View>
        )}

        {/* ── Notes & Terms ── */}
        {(hasContent(invoice.notes) ||
          hasContent(invoice.terms) ||
          hasContent(invoice.deliveryNote)) && (
          <View style={styles.notes}>
            {hasContent(invoice.notes) && (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.noteTitle}>Notes</Text>
                <View>
                  {renderHtmlToPdf(invoice.notes, {
                    fontSize: 8,
                    color: "#1F2937",
                  })}
                </View>
              </View>
            )}
            {hasContent(invoice.terms) && (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.noteTitle}>Terms & Conditions</Text>
                <View>
                  {renderHtmlToPdf(invoice.terms, {
                    fontSize: 8,
                    color: "#1F2937",
                  })}
                </View>
              </View>
            )}
            {hasContent(invoice.deliveryNote) && (
              <View>
                <Text style={styles.noteTitle}>Delivery Note</Text>
                <View>
                  {renderHtmlToPdf(invoice.deliveryNote, {
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
            {`This is a computer-generated ${documentTitle}. No signature is required.`}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDF;
