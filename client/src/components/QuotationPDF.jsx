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

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#2563EB", // Blue accent
    paddingBottom: 20,
  },
  logo: {
    width: 120,
    height: 50,
    objectFit: "contain",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2563EB", // Blue accent
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  companyInfo: {
    fontSize: 9,
    color: "#4B5563",
    marginTop: 2,
    textAlign: "right",
  },
  infoGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  infoSection: {
    width: "45%",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 10,
    color: "#1F2937",
    marginBottom: 3,
    lineHeight: 1.4,
  },
  table: {
    display: "table",
    width: "auto",
    marginTop: 10,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 8,
    alignItems: "flex-start",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
  },
  colItem: {
    width: "35%",
    paddingLeft: 4,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  colImage: { width: "10%", paddingLeft: 4 },
  colPrice: { width: "20%", textAlign: "right" },
  colQty: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right", paddingRight: 4 },
  productImage: {
    width: 30,
    height: 30,
    objectFit: "contain",
    marginRight: 8,
  },
  imagePlaceholder: {
    width: 30,
    height: 30,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    marginRight: 8,
  },

  tableCellHeader: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#4B5563",
    textTransform: "uppercase",
  },
  tableCell: {
    fontSize: 10,
    color: "#1F2937",
  },
  tableCellSub: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 2,
  },
  totals: {
    marginTop: 10,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: "row",
    marginBottom: 4,
    justifyContent: "flex-end",
  },
  totalLabel: {
    width: 100,
    fontSize: 10,
    color: "#6B7280",
    textAlign: "right",
    marginRight: 10,
  },
  totalValue: {
    width: 150,
    fontSize: 10,
    color: "#111827",
    textAlign: "right",
    fontWeight: "medium",
  },
  grandTotal: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#2563EB",
  },
  grandTotalLabel: {
    width: 100,
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
    marginRight: 10,
  },
  grandTotalValue: {
    width: 150,
    fontSize: 14,
    fontWeight: "bold",
    color: "#2563EB",
    textAlign: "right",
  },
  notes: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9CA3AF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 15,
  },
});

const QuotationPDF = ({ quotation, settings }) => {
  const effectiveSettings = getDocumentCurrencySettings(quotation, settings);
  const taxInfo = getTaxDisplay(quotation, settings);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>QUOTATION</Text>
            <Text style={styles.subTitle}>#{quotation.quotationNumber}</Text>
          </View>
          <View style={{ alignItems: "flex-end", maxWidth: "50%" }}>
            {settings?.logo && (
              <Image style={styles.logo} src={settings.logo} />
            )}
            <Text
              style={[styles.companyInfo, { fontWeight: "bold", fontSize: 11 }]}
            >
              {settings?.storeName}
            </Text>
            {settings?.address?.street && (
              <Text style={styles.companyInfo}>{settings.address.street}</Text>
            )}
            {(settings?.address?.city || settings?.address?.zip) && (
              <Text style={styles.companyInfo}>
                {settings?.address?.city}
                {settings?.address?.city && settings?.address?.zip && ", "}
                {settings?.address?.zip}
              </Text>
            )}
            {settings?.contact?.phone && (
              <Text style={styles.companyInfo}>
                Phone: {settings.contact.phone}
              </Text>
            )}
            {settings?.contact?.email && (
              <Text style={styles.companyInfo}>{settings.contact.email}</Text>
            )}
            {settings?.registrationNo && (
              <Text style={styles.companyInfo}>
                Reg No: {settings.registrationNo}
              </Text>
            )}
            {settings?.taxIdNo && (
              <Text style={styles.companyInfo}>Tax ID: {settings.taxIdNo}</Text>
            )}
          </View>
        </View>

        {/* Info Group */}
        <View style={styles.infoGroup}>
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={[styles.text, { fontWeight: "bold" }]}>
              {quotation.customer?.salutation
                ? `${quotation.customer.salutation} `
                : ""}
              {quotation.customer?.firstName} {quotation.customer?.lastName}
            </Text>
            {quotation.customer?.billing?.company && (
              <Text style={styles.text}>
                {quotation.customer.billing.company}
              </Text>
            )}
            {quotation.customer?.billing?.address_1 && (
              <Text style={styles.text}>
                {quotation.customer.billing.address_1}
              </Text>
            )}
            {quotation.customer?.billing?.address_2 && (
              <Text style={styles.text}>
                {quotation.customer.billing.address_2}
              </Text>
            )}
            {(quotation.customer?.billing?.city ||
              quotation.customer?.billing?.state ||
              quotation.customer?.billing?.postcode) && (
              <Text style={styles.text}>
                {[
                  quotation.customer?.billing?.city,
                  quotation.customer?.billing?.state,
                  quotation.customer?.billing?.postcode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            )}
            {quotation.customer?.billing?.country && (
              <Text style={styles.text}>
                {quotation.customer.billing.country}
              </Text>
            )}
            {quotation.customer?.billing?.phone && (
              <Text style={styles.text}>
                {quotation.customer.billing.phone}
              </Text>
            )}
            {quotation.customer?.email && (
              <Text style={styles.text}>{quotation.customer.email}</Text>
            )}
            {quotation.customer?.taxNumber && (
              <Text style={styles.text}>
                {settings?.tax?.label && settings.tax.label !== "Tax"
                  ? settings.tax.label
                  : "TIN"}
                : {quotation.customer.taxNumber}
              </Text>
            )}
          </View>
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Quotation Details</Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={styles.text}>Date Issued:</Text>
              <Text style={[styles.text, { fontWeight: "bold" }]}>
                {formatDate(
                  quotation.quotationDate || quotation.createdAt,
                  settings,
                )}
              </Text>
            </View>
            {quotation.validUntil && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.text}>Valid Until:</Text>
                <Text style={[styles.text, { fontWeight: "bold" }]}>
                  {formatDate(quotation.validUntil, settings)}
                </Text>
              </View>
            )}
            {quotation.currency?.code &&
              quotation.currency.code !== settings?.currency?.code && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <Text style={styles.text}>Currency:</Text>
                  <Text
                    style={[
                      styles.text,
                      { fontWeight: "bold", color: "#d97706" },
                    ]}
                  >
                    {quotation.currency.code}
                  </Text>
                </View>
              )}
            {quotation.exchangeRate?.rate > 0 &&
              quotation.currency?.code !== settings?.currency?.code && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.text}>Exchange Rate:</Text>
                  <Text style={styles.text}>
                    1 {quotation.currency.code} = {quotation.exchangeRate.rate}{" "}
                    {quotation.exchangeRate.baseCurrency}
                  </Text>
                </View>
              )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colImage}>
              <Text style={styles.tableCellHeader}>Image</Text>
            </View>
            <View style={styles.colItem}>
              <Text style={styles.tableCellHeader}>Item Description</Text>
            </View>
            <View style={styles.colPrice}>
              <Text style={styles.tableCellHeader}>Price</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.tableCellHeader}>Qty</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableCellHeader}>Total</Text>
            </View>
          </View>
          {quotation.items.map((item, index) => {
            return (
              <View style={styles.tableRow} key={index}>
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
                <View style={styles.colItem}>
                  <View>
                    <Text style={styles.tableCell}>{item.name}</Text>
                    {item.sku ? (
                      <Text style={styles.tableCellSub}>SKU: {item.sku}</Text>
                    ) : null}
                    {(item.description || item.product?.shortDescription) && (
                      <View style={{ marginTop: 2 }}>
                        {renderHtmlToPdf(
                          item.description || item.product.shortDescription,
                          styles.tableCellSub,
                        )}
                      </View>
                    )}
                    {item.discount > 0 && (
                      <Text style={[styles.tableCellSub, { color: "#EF4444" }]}>
                        Discount: -
                        {item.discountType === "percentage"
                          ? `${item.discount}%`
                          : formatCurrency(item.discount, effectiveSettings)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.colPrice}>
                  <Text style={styles.tableCell}>
                    {formatCurrency(item.price, effectiveSettings)}
                  </Text>
                </View>
                <View style={styles.colQty}>
                  <Text style={styles.tableCell}>{item.quantity}</Text>
                </View>
                <View style={styles.colTotal}>
                  <Text style={[styles.tableCell, { fontWeight: "bold" }]}>
                    {formatCurrency(item.total, effectiveSettings)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(quotation.subtotal, effectiveSettings)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{taxInfo.lineLabel}</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(quotation.tax || 0, effectiveSettings)}
            </Text>
          </View>
          {quotation.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, { color: "#EF4444" }]}>
                -{formatCurrency(quotation.discount, effectiveSettings)}
              </Text>
            </View>
          )}
          {quotation.deliveryCharge > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Charge</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(quotation.deliveryCharge, effectiveSettings)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(quotation.total, effectiveSettings)}
            </Text>
          </View>
        </View>

        {/* Notes & Terms */}
        {(quotation.notes || quotation.terms || quotation.deliveryNote) && (
          <View style={styles.notes}>
            {quotation.notes && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                  Notes
                </Text>
                <View>{renderHtmlToPdf(quotation.notes)}</View>
              </View>
            )}
            {quotation.terms && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                  Terms & Conditions
                </Text>
                <View>{renderHtmlToPdf(quotation.terms)}</View>
              </View>
            )}
            {quotation.deliveryNote && (
              <View>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                  Delivery Note
                </Text>
                <View>{renderHtmlToPdf(quotation.deliveryNote)}</View>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          {settings?.bank?.accountName && (
            <View style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={{ fontWeight: "bold", marginBottom: 2 }}>
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
        </View>
      </Page>
    </Document>
  );
};

export default QuotationPDF;
