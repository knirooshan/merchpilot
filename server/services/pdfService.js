const PDFDocument = require("pdfkit");
const axios = require("axios");
const sharp = require("sharp");
const { getTaxDisplay } = require("../utils/taxDisplay");

const DEFAULT_DOCUMENT_COLORS = {
  invoicePrimary: "#1E3A8A",
  invoiceAccent: "#1E3A8A",
  proformaPrimary: "#065F46",
  proformaAccent: "#065F46",
  quotationPrimary: "#1E3A8A",
  quotationAccent: "#1E3A8A",
  amountWordsBg: "#EFF6FF",
};

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

const normalizeHexColor = (value, fallback) => {
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

const getDocumentColors = (settings) => {
  const raw = settings?.documentColors || {};
  return {
    invoicePrimary: normalizeHexColor(
      raw.invoicePrimary,
      DEFAULT_DOCUMENT_COLORS.invoicePrimary,
    ),
    invoiceAccent: normalizeHexColor(
      raw.invoiceAccent,
      DEFAULT_DOCUMENT_COLORS.invoiceAccent,
    ),
    proformaPrimary: normalizeHexColor(
      raw.proformaPrimary,
      DEFAULT_DOCUMENT_COLORS.proformaPrimary,
    ),
    proformaAccent: normalizeHexColor(
      raw.proformaAccent,
      DEFAULT_DOCUMENT_COLORS.proformaAccent,
    ),
    quotationPrimary: normalizeHexColor(
      raw.quotationPrimary,
      DEFAULT_DOCUMENT_COLORS.quotationPrimary,
    ),
    quotationAccent: normalizeHexColor(
      raw.quotationAccent,
      DEFAULT_DOCUMENT_COLORS.quotationAccent,
    ),
    amountWordsBg: normalizeHexColor(
      raw.amountWordsBg,
      DEFAULT_DOCUMENT_COLORS.amountWordsBg,
    ),
  };
};

// ---------------------------------------------------------------------------
// Number to Words (LKR-style)
// ---------------------------------------------------------------------------
const _ones = [
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
const _tens = [
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

const _n2w = (n) => {
  if (n === 0) return "Zero";
  if (n < 20) return _ones[n];
  if (n < 100)
    return _tens[Math.floor(n / 10)] + (n % 10 ? " " + _ones[n % 10] : "");
  if (n < 1000)
    return (
      _ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + _n2w(n % 100) : "")
    );
  if (n < 100000)
    return (
      _n2w(Math.floor(n / 1000)) +
      " Thousand" +
      (n % 1000 ? " " + _n2w(n % 1000) : "")
    );
  if (n < 10000000)
    return (
      _n2w(Math.floor(n / 100000)) +
      " Lakh" +
      (n % 100000 ? " " + _n2w(n % 100000) : "")
    );
  return (
    _n2w(Math.floor(n / 10000000)) +
    " Crore" +
    (n % 10000000 ? " " + _n2w(n % 10000000) : "")
  );
};

const amountInWords = (amount, settings) => {
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
  let words = _n2w(rupees) + " " + currencyName;
  if (cents > 0) words += " and " + _n2w(cents) + " Cents";
  return words + " Only";
};

// Helper to add thousand separators
const addThousandSeparators = (numStr) => {
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

// Helper to format currency
const formatCurrency = (amount, settings) => {
  if (!settings?.currency) {
    return `$${addThousandSeparators(parseFloat(amount || 0).toFixed(2))}`;
  }

  const { symbol, position } = settings.currency;
  const formattedAmount = addThousandSeparators(
    parseFloat(amount || 0).toFixed(2),
  );

  if (position === "before") {
    return `${symbol}${formattedAmount}`;
  } else {
    return `${formattedAmount}${symbol}`;
  }
};

// Helper to format date based on settings
const formatDate = (date, settings) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const format = settings?.dateTime?.dateFormat || "MM/DD/YYYY";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();

  switch (format) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD-MM-YYYY":
      return `${day}-${month}-${year}`;
    case "MM/DD/YYYY":
    default:
      return `${month}/${day}/${year}`;
  }
};

// Helper to format time based on settings
const formatTime = (date, settings) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const format = settings?.dateTime?.timeFormat || "12h";
  if (format === "24h") {
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return d.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

// Helper to fetch and embed logo
const embedLogo = async (
  doc,
  logoUrl,
  x,
  y,
  maxWidth = 100,
  maxHeight = 50,
) => {
  try {
    if (!logoUrl) return;

    const response = await axios.get(logoUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const imageBuffer = Buffer.from(response.data, "binary");
    doc.image(imageBuffer, x, y, {
      fit: [maxWidth, maxHeight],
      align: "right",
    });
  } catch (error) {
    console.error("Error embedding logo:", error.message);
    // Continue without logo if fetch fails
  }
};

// Helper to draw a horizontal line
const drawLine = (doc, y, color = "#E5E7EB", lineWidth = 1) => {
  doc
    .strokeColor(color)
    .lineWidth(lineWidth)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
};

// Helper to add table header (gazette-compliant columns)
const addTableHeader = (doc, y, settings, primaryColor = "#1E3A8A") => {
  doc
    .rect(50, y, 500, 26)
    .fill(primaryColor)
    .fillColor("#FFFFFF")
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("#", 55, y + 9, { width: 20, align: "left" })
    .text("DESCRIPTION OF GOODS / SERVICES", 78, y + 9, {
      width: 210,
      align: "left",
    })
    .text("QTY", 290, y + 9, { width: 50, align: "right" })
    .text("UNIT PRICE", 345, y + 9, { width: 80, align: "right" })
    .text("AMOUNT EXCL. VAT (Rs.)", 430, y + 9, { width: 115, align: "right" });

  return y + 26;
};

// Helper to add table row (gazette-compliant columns)
const addTableRow = (doc, y, item, settings, isLast = false, rowIndex = 0) => {
  let extraHeight = 0;
  if (item.sku) extraHeight += 10;
  if (item.product?.shortDescription) extraHeight += 10;
  const rowHeight = Math.max(28, 20 + extraHeight);

  if (rowIndex % 2 === 1) {
    doc.rect(50, y, 500, rowHeight).fill("#F9FAFB");
  }

  doc
    .fillColor("#6B7280")
    .fontSize(9)
    .font("Helvetica")
    .text((rowIndex + 1).toString(), 55, y + 11, { width: 20, align: "left" });

  doc
    .fillColor("#1F2937")
    .fontSize(9)
    .font("Helvetica")
    .text(item.name, 78, y + 11, { width: 210, align: "left" });

  let textY = y + 23;

  if (item.sku) {
    doc
      .fillColor("#6B7280")
      .fontSize(7)
      .text(`SKU: ${item.sku}`, 78, textY, { width: 210 });
    textY += 10;
  }

  if (item.product?.shortDescription) {
    doc
      .fillColor("#6B7280")
      .fontSize(7)
      .text(item.product.shortDescription, 78, textY, { width: 210 });
  }

  doc
    .fillColor("#1F2937")
    .fontSize(9)
    .font("Helvetica")
    .text(item.quantity.toString(), 290, y + 11, { width: 50, align: "right" })
    .text(formatCurrency(item.price, settings), 345, y + 11, {
      width: 80,
      align: "right",
    })
    .font("Helvetica-Bold")
    .text(formatCurrency(item.total, settings), 430, y + 8, {
      width: 115,
      align: "right",
    });

  if (!isLast) {
    drawLine(doc, y + rowHeight, "#E5E7EB", 0.5);
  }

  return y + rowHeight;
};

// Generate Invoice PDF (IRD Sri Lanka Gazette 2481/22 compliant)
const generateInvoicePDF = async (invoice, settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      const colors = getDocumentColors(settings);
      const taxInfo = getTaxDisplay(invoice, settings);
      // Only VAT-registered suppliers may issue a "Tax Invoice"
      const docTypeName =
        invoice.invoiceType === "proforma"
          ? "Proforma Invoice"
          : taxInfo.registered
            ? "Tax Invoice"
            : "Invoice";
      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        bufferPages: true,
        info: {
          Title: `${docTypeName} ${invoice.taxInvoiceNumber || invoice.invoiceNumber}`,
          Author: settings?.storeName || "MerchPilot",
          Subject:
            docTypeName === "Tax Invoice"
              ? "Tax Invoice - IRD Sri Lanka Gazette 2481/22"
              : docTypeName,
        },
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on("error", reject);

      const LEFT = 36;
      const RIGHT_EDGE = 559;
      const PAGE_WIDTH = RIGHT_EDGE - LEFT;

      // ── HEADER ──────────────────────────────────────────────────────────
      // Invoice title (left)
      const isProforma = invoice.invoiceType === "proforma";
      const headerColor = isProforma
        ? colors.proformaPrimary
        : colors.invoicePrimary;
      const invoiceTitleText = docTypeName.toUpperCase();
      doc
        .fillColor(headerColor)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(invoiceTitleText, LEFT, 36, { characterSpacing: 2 });

      // Invoice Number below title
      const taxInvNo = invoice.taxInvoiceNumber || invoice.invoiceNumber;
      const invoiceNoLabel = `${docTypeName} No.`;
      doc
        .fillColor("#6B7280")
        .fontSize(9)
        .font("Helvetica")
        .text(invoiceNoLabel, LEFT, 60);
      doc
        .fillColor(headerColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(taxInvNo, LEFT, 71);

      if (
        invoice.invoiceNumber &&
        invoice.taxInvoiceNumber &&
        invoice.taxInvoiceNumber !== invoice.invoiceNumber
      ) {
        doc
          .fillColor("#9CA3AF")
          .fontSize(9)
          .font("Helvetica")
          .text(`Ref: ${invoice.invoiceNumber}`, LEFT, 86);
      }

      // Logo (top right)
      if (settings?.logo) {
        await embedLogo(doc, settings.logo, 450, 40, 105, 50);
      }

      // Header divider line
      const dividerColor = isProforma
        ? colors.proformaAccent
        : colors.invoiceAccent;
      doc.rect(LEFT, 104, PAGE_WIDTH, 2).fill(dividerColor);

      // ── SUPPLIER & PURCHASER ─────────────────────────────────────────────
      let boxTopY = 120; // Increased spacing below header
      let supplierY = boxTopY + 15; // Increased padding inside box
      let purchaserY = boxTopY + 15;
      const colMid = LEFT + PAGE_WIDTH / 2;
      const padding = 15;
      const lineGap = 4;

      // Supplier (left column)
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("SUPPLIER", LEFT + padding, supplierY);
      supplierY = doc.y + lineGap + 2;

      if (settings?.storeName) {
        doc
          .fillColor("#111827")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(settings.storeName, LEFT + padding, supplierY, {
            width: PAGE_WIDTH / 2 - padding * 2,
          });
        supplierY = doc.y + 2;
      }

      const supplierDetails = [];
      if (settings?.taxIdNo)
        supplierDetails.push(`TIN/VAT: ${settings.taxIdNo}`);
      if (settings?.registrationNo)
        supplierDetails.push(`Reg: ${settings.registrationNo}`);
      if (settings?.address?.street)
        supplierDetails.push(settings.address.street);
      const supplierCityZip = [settings?.address?.city, settings?.address?.zip]
        .filter(Boolean)
        .join(", ");
      if (supplierCityZip) supplierDetails.push(supplierCityZip);
      if (settings?.contact?.phone)
        supplierDetails.push(`Tel: ${settings.contact.phone}`);
      if (settings?.contact?.email)
        supplierDetails.push(settings.contact.email);

      if (supplierDetails.length > 0) {
        doc
          .fillColor("#1F2937")
          .fontSize(9)
          .font("Helvetica")
          .text(supplierDetails.join("\n"), LEFT + padding, supplierY, {
            width: PAGE_WIDTH / 2 - padding * 2,
            lineGap: 3,
          });
        supplierY = doc.y + lineGap;
      } else {
        supplierY += lineGap;
      }

      // Purchaser (right column)
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("PURCHASER", colMid + padding, purchaserY);
      purchaserY = doc.y + lineGap + 2;

      const custName = [
        invoice.customer?.salutation || "",
        invoice.customer?.firstName || invoice.customerInfo?.firstName || "",
        invoice.customer?.lastName || invoice.customerInfo?.lastName || "",
      ]
        .filter(Boolean)
        .join(" ");

      if (custName) {
        doc
          .fillColor("#111827")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(custName, colMid + padding, purchaserY, {
            width: PAGE_WIDTH / 2 - padding * 2,
          });
        purchaserY = doc.y + 2;
      }

      const purchaserDetails = [];
      const purchaserTIN =
        invoice.customer?.taxNumber || invoice.customerInfo?.taxNumber;

      const company =
        invoice.customer?.billing?.company || invoice.customerInfo?.company;
      if (company) purchaserDetails.push(company);

      if (purchaserTIN) purchaserDetails.push(`TIN/VAT: ${purchaserTIN}`);

      const address1 = invoice.customer?.billing?.address_1;
      if (address1) purchaserDetails.push(address1);

      const address2 = invoice.customer?.billing?.address_2;
      if (address2) purchaserDetails.push(address2);

      const purchaserCityPost = [
        invoice.customer?.billing?.city,
        invoice.customer?.billing?.state,
        invoice.customer?.billing?.postcode,
      ]
        .filter(Boolean)
        .join(", ");
      if (purchaserCityPost) purchaserDetails.push(purchaserCityPost);

      const purchaserCountry =
        invoice.customer?.billing?.country || invoice.customerInfo?.country;
      if (purchaserCountry) purchaserDetails.push(purchaserCountry);

      const purchaserPhone =
        invoice.customer?.billing?.phone || invoice.customerInfo?.phone;
      if (purchaserPhone) purchaserDetails.push(`Tel: ${purchaserPhone}`);

      const purchaserEmail =
        invoice.customer?.email || invoice.customerInfo?.email;
      if (purchaserEmail) purchaserDetails.push(purchaserEmail);

      if (purchaserDetails.length > 0) {
        doc
          .fillColor("#1F2937")
          .fontSize(9)
          .font("Helvetica")
          .text(purchaserDetails.join("\n"), colMid + padding, purchaserY, {
            width: PAGE_WIDTH / 2 - padding * 2,
            lineGap: 3,
          });
        purchaserY = doc.y + lineGap;
      } else {
        purchaserY += lineGap;
      }

      // Draw table borders for supplier/purchaser
      const boxHeight =
        Math.max(supplierY, purchaserY) - boxTopY + 15 - lineGap;
      doc
        .rect(LEFT, boxTopY, PAGE_WIDTH, boxHeight)
        .lineWidth(0.5)
        .strokeColor("#E5E7EB")
        .stroke();
      doc
        .moveTo(colMid, boxTopY)
        .lineTo(colMid, boxTopY + boxHeight)
        .lineWidth(0.5)
        .strokeColor("#E5E7EB")
        .stroke();

      // ── DETAILS BAR ──────────────────────────────────────────────────────
      let detailsBarY = boxTopY + boxHeight + 24;

      doc.rect(LEFT, detailsBarY, PAGE_WIDTH, 2).fill("#E5E7EB");
      detailsBarY += 6;

      const detailsData = [
        {
          label: "Date of Invoice",
          value: formatDate(invoice.invoiceDate || invoice.createdAt, {
            dateTime: { dateFormat: "MM/DD/YYYY" },
          }),
        },
        {
          label: "Date of Delivery",
          value: formatDate(invoice.invoiceDate || invoice.createdAt, {
            dateTime: { dateFormat: "MM/DD/YYYY" },
          }),
        },
        invoice.placeOfSupply
          ? { label: "Place of Supply", value: invoice.placeOfSupply }
          : null,
        invoice.reference
          ? { label: "Reference", value: invoice.reference }
          : null,
      ].filter(Boolean);

      const cellWidth = PAGE_WIDTH / Math.max(detailsData.length, 2);
      detailsData.forEach((detail, i) => {
        const cx = LEFT + i * cellWidth;
        doc
          .fillColor("#6B7280")
          .fontSize(7)
          .font("Helvetica")
          .text(detail.label.toUpperCase(), cx, detailsBarY, {
            width: cellWidth - 5,
          });
        doc
          .fillColor("#111827")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(detail.value, cx, detailsBarY + 10, { width: cellWidth - 5 });
      });

      let tableY = detailsBarY + 36;
      doc.rect(LEFT, tableY - 4, PAGE_WIDTH, 1).fill("#E5E7EB");
      tableY += 4;

      // ── ITEMS TABLE ──────────────────────────────────────────────────────
      if (tableY > 600) {
        doc.addPage();
        tableY = 36;
      }

      tableY = addTableHeader(doc, tableY, settings, colors.invoicePrimary);

      invoice.items.forEach((item, index) => {
        if (tableY > 680) {
          doc.addPage();
          tableY = 36;
          tableY = addTableHeader(doc, tableY, settings, colors.invoicePrimary);
        }
        tableY = addTableRow(
          doc,
          tableY,
          item,
          settings,
          index === invoice.items.length - 1,
          index,
        );
      });

      // ── TOTALS ───────────────────────────────────────────────────────────
      tableY += 24;
      drawLine(doc, tableY, "#E5E7EB", 1);
      tableY += 16;

      const totalsLeft = RIGHT_EDGE - 220;

      const drawTotalRow = (
        label,
        value,
        bold = false,
        color = "#111827",
        valueColor = "#111827",
      ) => {
        doc
          .fillColor("#6B7280")
          .fontSize(9)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .text(label, totalsLeft, tableY, { width: 110, align: "left" });
        doc
          .fillColor(valueColor)
          .fontSize(9)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .text(value, totalsLeft + 110, tableY, {
            width: 110,
            align: "right",
          });
        tableY = doc.y + 6;
      };

      drawTotalRow(
        "Total Value of Supply",
        formatCurrency(invoice.subtotal, settings),
      );

      drawTotalRow(
        taxInfo.lineLabel,
        formatCurrency(invoice.tax || 0, settings),
      );
      if (invoice.discount > 0) {
        drawTotalRow(
          "Discount",
          `-${formatCurrency(invoice.discount, settings)}`,
          false,
          "#6B7280",
          "#EF4444",
        );
      }
      if (invoice.deliveryCharge > 0) {
        drawTotalRow(
          "Delivery Charge",
          formatCurrency(invoice.deliveryCharge, settings),
        );
      }

      // Grand Total bar
      tableY += 8;
      doc.rect(totalsLeft, tableY, 220, 22).fill(colors.invoicePrimary);
      doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Total Amount", totalsLeft + 6, tableY + 6, {
          width: 110,
          align: "left",
        });
      doc
        .fillColor("#FFFFFF")
        .fontSize(11)
        .text(
          formatCurrency(invoice.total, settings),
          totalsLeft + 110,
          tableY + 5,
          { width: 110, align: "right" },
        );
      tableY += 36;

      // Amount Paid & Balance Due
      const amountPaid = invoice.amountPaid || 0;
      const balanceDue =
        invoice.balanceDue !== undefined
          ? invoice.balanceDue
          : invoice.total - amountPaid;

      if (amountPaid > 0 || invoice.status === "paid") {
        drawTotalRow("Amount Paid", formatCurrency(amountPaid, settings));
        drawTotalRow("Balance Due", formatCurrency(balanceDue, settings), true);
      }

      // ── TOTAL IN WORDS ────────────────────────────────────────────────────
      tableY += 16;
      doc.rect(LEFT, tableY, PAGE_WIDTH, 20).fill(colors.amountWordsBg);
      doc
        .fillColor("#6B7280")
        .fontSize(7)
        .font("Helvetica")
        .text("TOTAL AMOUNT IN WORDS:", LEFT + 6, tableY + 4);
      doc
        .fillColor(colors.invoicePrimary)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(amountInWords(invoice.total, settings), LEFT + 130, tableY + 4, {
          width: PAGE_WIDTH - 136,
        });
      tableY += 26;

      // ── MODE OF PAYMENT ───────────────────────────────────────────────────
      if (invoice.paymentMethod) {
        tableY += 12; // Add some space before mode of payment
        doc
          .fillColor("#6B7280")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("Mode of Payment: ", LEFT, tableY);
        doc
          .fillColor("#111827")
          .fontSize(9)
          .font("Helvetica")
          .text(invoice.paymentMethod, LEFT + 110, tableY);
        tableY = doc.y + 12;
      }

      // ── NOTES & TERMS ────────────────────────────────────────────────────────────
      const hasContent = (html) => {
        if (!html) return false;
        return (
          html
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim() !== ""
        );
      };

      const sections = [
        { title: "NOTES", content: invoice.notes },
        { title: "TERMS & CONDITIONS", content: invoice.terms },
        { title: "DELIVERY NOTE", content: invoice.deliveryNote },
      ].filter((s) => hasContent(s.content));

      if (sections.length > 0) {
        tableY += 16;

        sections.forEach((section) => {
          if (tableY > 700) {
            doc.addPage();
            tableY = 36;
          }

          doc.rect(LEFT, tableY, PAGE_WIDTH, 14).fill("#F3F4F6");
          doc
            .fillColor("#6B7280")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text(section.title, LEFT + 6, tableY + 4);
          tableY += 18;

          doc
            .fillColor("#1F2937")
            .fontSize(8)
            .font("Helvetica")
            .text(section.content.replace(/<[^>]*>/g, ""), LEFT, tableY, {
              width: PAGE_WIDTH,
              align: "left",
            });

          tableY = doc.y + 16;
        });
      }

      // ── FOOTER ───────────────────────────────────────────────────────────
      const footerY = 790;
      drawLine(doc, footerY, "#E5E7EB", 0.5);

      doc
        .fillColor("#9CA3AF")
        .fontSize(7)
        .font("Helvetica")
        .text("Thank you for your business!", LEFT, footerY + 6, {
          width: PAGE_WIDTH,
          align: "center",
        });

      if (settings?.bank?.accountName) {
        doc
          .fontSize(7)
          .font("Helvetica-Bold")
          .text("Bank Details: ", LEFT, footerY + 16, { continued: true })
          .font("Helvetica")
          .text(
            `${settings.bank.bankName || ""}${settings.bank.branch ? ", " + settings.bank.branch : ""} | ` +
              `Account: ${settings.bank.accountName} - ${settings.bank.accountNumber}` +
              (settings.bank.swiftCode
                ? ` | Swift: ${settings.bank.swiftCode}`
                : ""),
            { width: PAGE_WIDTH },
          );
      }

      // Page numbers & gazette compliance note
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fillColor("#9CA3AF")
          .fontSize(6.5)
          .text(
            `This is a computer-generated ${docTypeName}. No signature is required. | Page ${i + 1} of ${range.count}`,
            LEFT,
            doc.page.height - 18,
            { width: PAGE_WIDTH, align: "center" },
          );
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Helper to fetch/decode and normalize item image buffers for PDFKit
const fetchImageBuffer = async (imageUrl) => {
  try {
    if (!imageUrl || typeof imageUrl !== "string") return null;

    let rawBuffer;
    if (imageUrl.startsWith("data:")) {
      const commaIndex = imageUrl.indexOf(",");
      if (commaIndex === -1) return null;
      const base64Data = imageUrl.slice(commaIndex + 1);
      rawBuffer = Buffer.from(base64Data, "base64");
    } else {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
      });
      rawBuffer = Buffer.from(response.data);
    }

    try {
      return await sharp(rawBuffer).png().toBuffer();
    } catch {
      return rawBuffer;
    }
  } catch (error) {
    console.error("Error fetching item image:", error.message);
    return null;
  }
};

// Helper to add quotation table header (Invoice layout with Image column)
const addQuotationTableHeader = (doc, y, primaryColor = "#1E3A8A") => {
  doc
    .rect(36, y, 523, 26)
    .fill(primaryColor)
    .fillColor("#FFFFFF")
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("#", 42, y + 9, { width: 22, align: "left" })
    .text("IMAGE", 68, y + 9, { width: 40, align: "left" })
    .text("DESCRIPTION OF GOODS / SERVICES", 114, y + 9, {
      width: 185,
      align: "left",
    })
    .text("QTY", 303, y + 9, { width: 45, align: "right" })
    .text("UNIT PRICE", 352, y + 9, { width: 90, align: "right" })
    .text("AMOUNT", 446, y + 9, { width: 107, align: "right" });

  return y + 26;
};

// Helper to add quotation table row (Invoice layout with Image column)
const addQuotationTableRow = (
  doc,
  y,
  item,
  imageBuffer,
  effectiveSettings,
  isLast = false,
  rowIndex = 0,
) => {
  const descText = (item.description || item.product?.shortDescription || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  doc.font("Helvetica").fontSize(9);
  const nameHeight = doc.heightOfString(item.name || "", { width: 185 });
  doc.font("Helvetica").fontSize(7);
  const skuHeight = item.sku
    ? doc.heightOfString(`SKU: ${item.sku}`, { width: 185 }) + 2
    : 0;
  const descHeight = descText
    ? doc.heightOfString(descText, { width: 185 }) + 2
    : 0;
  const discountLabel =
    item.discount > 0
      ? `Discount: ${
          item.discountType === "percentage"
            ? `${item.discount}%`
            : formatCurrency(item.discount, effectiveSettings)
        }`
      : "";
  const discountHeight = discountLabel
    ? doc.heightOfString(discountLabel, { width: 185 }) + 2
    : 0;

  const contentHeight =
    nameHeight + skuHeight + descHeight + discountHeight + 16;
  const rowHeight = Math.max(44, contentHeight);

  if (rowIndex % 2 === 1) {
    doc.rect(36, y, 523, rowHeight).fill("#F9FAFB");
  }

  // #
  doc
    .fillColor("#6B7280")
    .fontSize(9)
    .font("Helvetica")
    .text((rowIndex + 1).toString(), 42, y + 10, { width: 22, align: "left" });

  // Image or placeholder
  if (imageBuffer) {
    try {
      doc.image(imageBuffer, 68, y + 6, {
        fit: [32, 32],
        align: "center",
        valign: "center",
      });
    } catch {
      doc.rect(68, y + 6, 32, 32).fill("#F3F4F6");
    }
  } else {
    doc.rect(68, y + 6, 32, 32).fill("#F3F4F6");
  }

  // Description column
  let textY = y + 8;
  doc
    .fillColor("#1F2937")
    .fontSize(9)
    .font("Helvetica")
    .text(item.name || "", 114, textY, { width: 185, align: "left" });
  textY += nameHeight + 2;

  if (item.sku) {
    doc
      .fillColor("#6B7280")
      .fontSize(7)
      .font("Helvetica")
      .text(`SKU: ${item.sku}`, 114, textY, { width: 185 });
    textY += skuHeight;
  }

  if (descText) {
    doc
      .fillColor("#6B7280")
      .fontSize(7)
      .font("Helvetica")
      .text(descText, 114, textY, { width: 185 });
    textY += descHeight;
  }

  if (discountLabel) {
    doc
      .fillColor("#EF4444")
      .fontSize(7)
      .font("Helvetica")
      .text(discountLabel, 114, textY, { width: 185 });
  }

  // Qty, Unit Price, Amount
  doc
    .fillColor("#1F2937")
    .fontSize(9)
    .font("Helvetica")
    .text(String(item.quantity ?? ""), 303, y + 10, {
      width: 45,
      align: "right",
    })
    .text(formatCurrency(item.price, effectiveSettings), 352, y + 10, {
      width: 90,
      align: "right",
    })
    .font("Helvetica-Bold")
    .text(formatCurrency(item.total, effectiveSettings), 446, y + 10, {
      width: 107,
      align: "right",
    });

  if (!isLast) {
    doc
      .strokeColor("#E5E7EB")
      .lineWidth(0.5)
      .moveTo(36, y + rowHeight)
      .lineTo(559, y + rowHeight)
      .stroke();
  }

  return y + rowHeight;
};

// Generate Quotation PDF
const generateQuotationPDF = async (quotation, settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      const colors = getDocumentColors(settings);
      const effectiveSettings = quotation?.currency?.code
        ? {
            ...(settings?.toObject ? settings.toObject() : settings),
            currency: {
              ...settings?.currency,
              ...quotation.currency,
            },
          }
        : settings;
      const taxInfo = getTaxDisplay(quotation, settings);
      const isForeign =
        Boolean(quotation?.currency?.code) &&
        quotation.currency.code !== (settings?.currency?.code || "");

      const itemImageBuffers = await Promise.all(
        (quotation.items || []).map((item) =>
          fetchImageBuffer(
            item.image ||
              item.product?.images?.[0] ||
              item.product?.thumbnail ||
              null,
          ),
        ),
      );

      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        bufferPages: true,
        info: {
          Title: `Quotation ${quotation.quotationNumber}`,
          Author: settings?.storeName || "MerchPilot",
          Subject: "Quotation",
        },
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on("error", reject);

      const LEFT = 36;
      const RIGHT_EDGE = 559;
      const PAGE_WIDTH = RIGHT_EDGE - LEFT;

      // ── HEADER ──────────────────────────────────────────────────────────
      doc
        .fillColor(colors.quotationPrimary)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("QUOTATION", LEFT, 36, { characterSpacing: 2 });

      doc
        .fillColor("#6B7280")
        .fontSize(9)
        .font("Helvetica")
        .text("Quotation No.", LEFT, 60);
      doc
        .fillColor(colors.quotationPrimary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(quotation.quotationNumber || "", LEFT, 71);

      // Logo (top right)
      if (settings?.logo) {
        await embedLogo(doc, settings.logo, 450, 40, 105, 44);
      }

      // Blue header divider
      doc.rect(LEFT, 96, PAGE_WIDTH, 2).fill(colors.quotationAccent);

      // ── SUPPLIER & CUSTOMER ─────────────────────────────────────────────
      const boxTopY = 114;
      let supplierY = boxTopY + 15;
      let customerY = boxTopY + 15;
      const colMid = LEFT + PAGE_WIDTH / 2;
      const padding = 15;
      const lineGap = 4;

      // Supplier (left column)
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("SUPPLIER", LEFT + padding, supplierY);
      supplierY = doc.y + lineGap + 2;

      if (settings?.storeName) {
        doc
          .fillColor("#111827")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(settings.storeName, LEFT + padding, supplierY, {
            width: PAGE_WIDTH / 2 - padding * 2,
          });
        supplierY = doc.y + 2;
      }

      const supplierDetails = [];
      if (settings?.taxIdNo)
        supplierDetails.push(`TIN/VAT: ${settings.taxIdNo}`);
      if (settings?.registrationNo)
        supplierDetails.push(`Reg: ${settings.registrationNo}`);
      if (settings?.address?.street)
        supplierDetails.push(settings.address.street);
      const supplierCityZip = [settings?.address?.city, settings?.address?.zip]
        .filter(Boolean)
        .join(", ");
      if (supplierCityZip) supplierDetails.push(supplierCityZip);
      if (settings?.contact?.phone)
        supplierDetails.push(`Tel: ${settings.contact.phone}`);
      if (settings?.contact?.email)
        supplierDetails.push(settings.contact.email);

      if (supplierDetails.length > 0) {
        doc
          .fillColor("#1F2937")
          .fontSize(9)
          .font("Helvetica")
          .text(supplierDetails.join("\n"), LEFT + padding, supplierY, {
            width: PAGE_WIDTH / 2 - padding * 2,
            lineGap: 3,
          });
        supplierY = doc.y + lineGap;
      } else {
        supplierY += lineGap;
      }

      // Customer (right column)
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("CUSTOMER", colMid + padding, customerY);
      customerY = doc.y + lineGap + 2;

      const custName = [
        quotation.customer?.salutation || "",
        quotation.customer?.firstName || "",
        quotation.customer?.lastName || "",
      ]
        .filter(Boolean)
        .join(" ");

      if (custName) {
        doc
          .fillColor("#111827")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(custName, colMid + padding, customerY, {
            width: PAGE_WIDTH / 2 - padding * 2,
          });
        customerY = doc.y + 2;
      }

      const customerDetails = [];
      if (quotation.customer?.billing?.company)
        customerDetails.push(quotation.customer.billing.company);
      if (quotation.customer?.taxNumber)
        customerDetails.push(`TIN/VAT: ${quotation.customer.taxNumber}`);
      if (quotation.customer?.billing?.address_1)
        customerDetails.push(quotation.customer.billing.address_1);
      if (quotation.customer?.billing?.address_2)
        customerDetails.push(quotation.customer.billing.address_2);

      const customerCityPost = [
        quotation.customer?.billing?.city,
        quotation.customer?.billing?.state,
        quotation.customer?.billing?.postcode,
      ]
        .filter(Boolean)
        .join(", ");
      if (customerCityPost) customerDetails.push(customerCityPost);
      if (quotation.customer?.billing?.country)
        customerDetails.push(quotation.customer.billing.country);
      if (quotation.customer?.billing?.phone)
        customerDetails.push(`Tel: ${quotation.customer.billing.phone}`);
      if (quotation.customer?.email)
        customerDetails.push(quotation.customer.email);

      if (customerDetails.length > 0) {
        doc
          .fillColor("#1F2937")
          .fontSize(9)
          .font("Helvetica")
          .text(customerDetails.join("\n"), colMid + padding, customerY, {
            width: PAGE_WIDTH / 2 - padding * 2,
            lineGap: 3,
          });
        customerY = doc.y + lineGap;
      } else {
        customerY += lineGap;
      }

      // Draw table borders for supplier/customer
      const boxHeight =
        Math.max(supplierY, customerY) - boxTopY + 15 - lineGap;
      doc
        .rect(LEFT, boxTopY, PAGE_WIDTH, boxHeight)
        .lineWidth(0.5)
        .strokeColor("#E5E7EB")
        .stroke();
      doc
        .moveTo(colMid, boxTopY)
        .lineTo(colMid, boxTopY + boxHeight)
        .lineWidth(0.5)
        .strokeColor("#E5E7EB")
        .stroke();

      // ── DETAILS BAR ──────────────────────────────────────────────────────
      let detailsBarY = boxTopY + boxHeight + 18;
      doc.rect(LEFT, detailsBarY, PAGE_WIDTH, 2).fill("#E5E7EB");
      detailsBarY += 6;

      const exchangeText = isForeign
        ? `${quotation.currency.code}${
            quotation.exchangeRate?.rate > 0
              ? ` (1 ${quotation.currency.code} = ${quotation.exchangeRate.rate} ${
                  quotation.exchangeRate.baseCurrency ||
                  settings?.currency?.code ||
                  "LKR"
                })`
              : ""
          }`
        : null;

      const detailsData = [
        {
          label: "Date Issued",
          value: formatDate(quotation.quotationDate || quotation.createdAt, {
            dateTime: { dateFormat: "MM/DD/YYYY" },
          }),
        },
        quotation.validUntil
          ? {
              label: "Valid Until",
              value: formatDate(quotation.validUntil, {
                dateTime: { dateFormat: "MM/DD/YYYY" },
              }),
            }
          : null,
        exchangeText
          ? {
              label: "Currency",
              value: exchangeText,
              color: "#d97706",
            }
          : null,
      ].filter(Boolean);

      const cellWidth = PAGE_WIDTH / Math.max(detailsData.length, 2);
      detailsData.forEach((detail, i) => {
        const cx = LEFT + i * cellWidth;
        doc
          .fillColor("#6B7280")
          .fontSize(7)
          .font("Helvetica")
          .text(detail.label.toUpperCase(), cx, detailsBarY, {
            width: cellWidth - 5,
          });
        doc
          .fillColor(detail.color || "#111827")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(detail.value, cx, detailsBarY + 10, { width: cellWidth - 5 });
      });

      let tableY = detailsBarY + 34;
      doc.rect(LEFT, tableY - 4, PAGE_WIDTH, 1).fill("#E5E7EB");
      tableY += 4;

      // ── ITEMS TABLE ──────────────────────────────────────────────────────
      if (tableY > 600) {
        doc.addPage();
        tableY = 36;
      }

      tableY = addQuotationTableHeader(doc, tableY, colors.quotationPrimary);

      (quotation.items || []).forEach((item, index) => {
        if (tableY > 680) {
          doc.addPage();
          tableY = 36;
          tableY = addQuotationTableHeader(
            doc,
            tableY,
            colors.quotationPrimary,
          );
        }
        tableY = addQuotationTableRow(
          doc,
          tableY,
          item,
          itemImageBuffers[index],
          effectiveSettings,
          index === quotation.items.length - 1,
          index,
        );
      });

      // ── TOTALS ───────────────────────────────────────────────────────────
      if (tableY > 640) {
        doc.addPage();
        tableY = 36;
      }
      tableY += 20;
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(LEFT, tableY)
        .lineTo(RIGHT_EDGE, tableY)
        .stroke();
      tableY += 16;

      const totalsLeft = RIGHT_EDGE - 220;

      const drawTotalRow = (
        label,
        value,
        bold = false,
        valueColor = "#111827",
      ) => {
        doc
          .fillColor("#6B7280")
          .fontSize(9)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .text(label, totalsLeft, tableY, { width: 110, align: "left" });
        doc
          .fillColor(valueColor)
          .fontSize(9)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .text(value, totalsLeft + 110, tableY, {
            width: 110,
            align: "right",
          });
        tableY = doc.y + 6;
      };

      drawTotalRow(
        "Subtotal",
        formatCurrency(quotation.subtotal, effectiveSettings),
      );

      drawTotalRow(
        taxInfo.lineLabel,
        formatCurrency(quotation.tax || 0, effectiveSettings),
      );

      if (quotation.discount > 0) {
        drawTotalRow(
          "Discount",
          `-${formatCurrency(quotation.discount, effectiveSettings)}`,
          false,
          "#EF4444",
        );
      }

      if (quotation.deliveryCharge > 0) {
        drawTotalRow(
          "Delivery Charge",
          formatCurrency(quotation.deliveryCharge, effectiveSettings),
        );
      }

      // Grand Total bar
      tableY += 8;
      doc.rect(totalsLeft, tableY, 220, 22).fill(colors.quotationPrimary);
      doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Total Amount", totalsLeft + 6, tableY + 6, {
          width: 110,
          align: "left",
        });
      doc
        .fillColor("#FFFFFF")
        .fontSize(11)
        .text(
          formatCurrency(quotation.total, effectiveSettings),
          totalsLeft + 110,
          tableY + 5,
          { width: 110, align: "right" },
        );
      tableY += 36;

      // ── TOTAL IN WORDS ────────────────────────────────────────────────────
      if (tableY > 700) {
        doc.addPage();
        tableY = 36;
      }
      tableY += 8;
      doc.rect(LEFT, tableY, PAGE_WIDTH, 20).fill(colors.amountWordsBg);
      doc
        .fillColor("#6B7280")
        .fontSize(7)
        .font("Helvetica")
        .text("TOTAL AMOUNT IN WORDS:", LEFT + 6, tableY + 6);
      doc
        .fillColor(colors.quotationPrimary)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(
          amountInWords(quotation.total, effectiveSettings),
          LEFT + 130,
          tableY + 6,
          {
            width: PAGE_WIDTH - 136,
          },
        );
      tableY += 26;

      // ── NOTES & TERMS ────────────────────────────────────────────────────
      const hasContent = (html) => {
        if (!html) return false;
        return (
          html
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim() !== ""
        );
      };

      const sections = [
        { title: "NOTES", content: quotation.notes },
        { title: "TERMS & CONDITIONS", content: quotation.terms },
        { title: "DELIVERY NOTE", content: quotation.deliveryNote },
      ].filter((s) => hasContent(s.content));

      if (sections.length > 0) {
        tableY += 16;

        sections.forEach((section) => {
          if (tableY > 700) {
            doc.addPage();
            tableY = 36;
          }

          doc.rect(LEFT, tableY, PAGE_WIDTH, 14).fill("#F3F4F6");
          doc
            .fillColor("#6B7280")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text(section.title, LEFT + 6, tableY + 4);
          tableY += 18;

          doc
            .fillColor("#1F2937")
            .fontSize(8)
            .font("Helvetica")
            .text(
              section.content
                .replace(/<[^>]*>/g, "")
                .replace(/&nbsp;/g, " ")
                .trim(),
              LEFT,
              tableY,
              {
                width: PAGE_WIDTH,
                align: "left",
              },
            );

          tableY = doc.y + 16;
        });
      }

      // ── FOOTER ───────────────────────────────────────────────────────────
      const footerY = 790;
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .moveTo(LEFT, footerY)
        .lineTo(RIGHT_EDGE, footerY)
        .stroke();

      doc
        .fillColor("#9CA3AF")
        .fontSize(7)
        .font("Helvetica")
        .text("Thank you for your business!", LEFT, footerY + 6, {
          width: PAGE_WIDTH,
          align: "center",
        });

      if (settings?.bank?.accountName) {
        doc
          .fontSize(7)
          .font("Helvetica-Bold")
          .text("Bank Details: ", LEFT, footerY + 16, { continued: true })
          .font("Helvetica")
          .text(
            `${settings.bank.bankName || ""}${settings.bank.branch ? ", " + settings.bank.branch : ""} | ` +
              `Account: ${settings.bank.accountName} - ${settings.bank.accountNumber}` +
              (settings.bank.swiftCode
                ? ` | Swift: ${settings.bank.swiftCode}`
                : ""),
            { width: PAGE_WIDTH },
          );
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fillColor("#9CA3AF")
          .fontSize(6.5)
          .text(
            `This is a computer-generated Quotation. No signature is required. | Page ${i + 1} of ${range.count}`,
            LEFT,
            doc.page.height - 18,
            { width: PAGE_WIDTH, align: "center" },
          );
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const generateSalesReportPDF = (
  reportData,
  salesList,
  stats,
  settings,
  timeframe,
  dateRange,
  productBreakdown = [],
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        bufferPages: true,
        info: {
          Title: "Sales Report",
          Author: settings?.storeName || "MerchPilot",
          Subject: "Financial Report",
        },
      });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Header
      if (settings?.logo) {
        await embedLogo(doc, settings.logo, 450, 45, 100, 50);
      }

      doc
        .fillColor("#111827")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Sales Report", 50, 50);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#6B7280")
        .text(
          `Generated on: ${formatDate(new Date(), settings)} ${formatTime(
            new Date(),
            settings,
          )}`,
          50,
          75,
        );

      const reportId = `SR-${Date.now().toString().slice(-6)}`;
      doc.text(`Report ID: ${reportId}`, 50, 90);

      doc.text(
        `Period: ${dateRange.startDate || "All Time"} to ${
          dateRange.endDate || "Present"
        }`,
        50,
        105,
      );
      doc.text(`Timeframe: ${timeframe.toUpperCase()}`, 50, 120);

      // Company Info
      if (settings?.storeName) {
        doc
          .fillColor("#111827")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(settings.storeName, 50, 145);

        const addressParts = [
          settings.address?.street,
          settings.address?.city,
          settings.address?.zip,
          settings.address?.country,
        ].filter(Boolean);

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4B5563")
          .text(addressParts.join(", "), 50, 160)
          .text(
            `${settings.contact?.email || ""} ${
              settings.contact?.phone ? "| " + settings.contact.phone : ""
            }`,
            50,
            172,
          );

        if (settings.website) {
          doc.text(settings.website, 50, 184);
        }
      }

      drawLine(doc, 205);

      // Currency Statement
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text(
          `All amounts are in ${settings?.currency?.code || "USD"} (${
            settings?.currency?.symbol || "$"
          })`,
          50,
          215,
          { align: "right" },
        );

      // Summary
      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Sales Summary", 50, 230);

      doc.rect(50, 255, 500, 60).fill("#F9FAFB");
      doc
        .fillColor("#4B5563")
        .fontSize(10)
        .font("Helvetica")
        .text("TOTAL SALES VOLUME", 65, 270);
      doc
        .fillColor("#4F46E5")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(formatCurrency(stats.totalSales, settings), 65, 285);

      // Detailed Table
      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Sales Breakdown", 50, 340);

      let y = 365;
      doc
        .rect(50, y, 500, 25)
        .fill("#F3F4F6")
        .fillColor("#4B5563")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("PERIOD", 60, y + 8)
        .text("SALES AMOUNT", 400, y + 8, { width: 140, align: "right" });

      y += 25;

      doc.font("Helvetica").fontSize(9);
      reportData.forEach((item, index) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        const bgColor = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
        doc.rect(50, y, 500, 20).fill(bgColor);
        doc
          .fillColor("#111827")
          .text(item.name, 60, y + 6)
          .text(formatCurrency(item.sales, settings), 400, y + 6, {
            width: 140,
            align: "right",
          });
        y += 20;
      });

      // Detailed Sales List
      y += 30;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Detailed Sales List", 50, y);
      y += 25;

      doc
        .rect(50, y, 500, 25)
        .fill("#F3F4F6")
        .fillColor("#4B5563")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("DATE", 60, y + 8)
        .text("INVOICE #", 120, y + 8)
        .text("CUSTOMER", 200, y + 8)
        .text("METHOD", 350, y + 8)
        .text("AMOUNT", 450, y + 8, { width: 90, align: "right" });
      y += 25;

      doc.font("Helvetica").fontSize(8);
      salesList.forEach((s, index) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        doc.fillColor("#111827").text(formatDate(s.date, settings), 60, y + 6);
        doc.text(s.invoice?.invoiceNumber || "N/A", 120, y + 6);
        doc.text(
          s.customer?.firstName
            ? `${s.customer.firstName} ${s.customer.lastName || ""}`
            : "N/A",
          200,
          y + 6,
          { width: 140 },
        );
        doc.text(s.method || "N/A", 350, y + 6);
        doc.text(formatCurrency(s.amount, settings), 450, y + 6, {
          width: 90,
          align: "right",
        });
        y += 15;
      });

      // Product Breakdown
      if (productBreakdown && productBreakdown.length > 0) {
        y += 30;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc
          .fillColor("#111827")
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("Product Breakdown", 50, y);
        y += 25;

        doc
          .rect(50, y, 500, 25)
          .fill("#F3F4F6")
          .fillColor("#4B5563")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("PRODUCT", 60, y + 8)
          .text("SKU", 250, y + 8)
          .text("QTY", 330, y + 8, { width: 40, align: "right" })
          .text("AVG PRICE", 380, y + 8, { width: 70, align: "right" })
          .text("REVENUE", 460, y + 8, { width: 80, align: "right" });
        y += 25;

        doc.font("Helvetica").fontSize(8);
        productBreakdown.forEach((p, index) => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          const bgColor = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
          doc.rect(50, y, 500, 20).fill(bgColor);
          doc
            .fillColor("#111827")
            .text(p.name || "Unknown Product", 60, y + 6, { width: 180 })
            .text(p.sku || "-", 250, y + 6)
            .text(p.quantity.toString(), 330, y + 6, {
              width: 40,
              align: "right",
            })
            .text(formatCurrency(p.avgPrice, settings), 380, y + 6, {
              width: 70,
              align: "right",
            })
            .text(formatCurrency(p.revenue, settings), 460, y + 6, {
              width: 80,
              align: "right",
            });
          y += 20;
        });
      }

      // Add page numbers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fontSize(8)
          .fillColor("#9CA3AF")
          .text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 30, {
            align: "center",
          });
        doc
          .fontSize(7)
          .text(
            "This is a computer-generated document. No signature is required.",
            50,
            doc.page.height - 20,
            { align: "center" },
          );
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const generateOutstandingReportPDF = (
  invoices,
  customerSummary,
  summary,
  settings,
  dateRange = {},
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        bufferPages: true,
        info: {
          Title: "Outstanding Invoices Report",
          Author: settings?.storeName || "MerchPilot",
          Subject: "Financial Report",
        },
      });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Header
      if (settings?.logo) {
        await embedLogo(doc, settings.logo, 450, 45, 100, 50);
      }

      doc
        .fillColor("#111827")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Outstanding Invoices Report", 50, 50);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#6B7280")
        .text(
          `Generated on: ${formatDate(new Date(), settings)} ${formatTime(
            new Date(),
            settings,
          )}`,
          50,
          75,
        );

      const reportId = `OR-${Date.now().toString().slice(-6)}`;
      doc.text(`Report ID: ${reportId}`, 50, 90);

      doc.text(
        `Period: ${dateRange.startDate || "All Time"} to ${
          dateRange.endDate || "Present"
        }`,
        50,
        105,
      );

      // Company Info
      if (settings?.storeName) {
        doc
          .fillColor("#111827")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(settings.storeName, 50, 130);

        const addressParts = [
          settings.address?.street,
          settings.address?.city,
          settings.address?.zip,
          settings.address?.country,
        ].filter(Boolean);

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4B5563")
          .text(addressParts.join(", "), 50, 145)
          .text(
            `${settings.contact?.email || ""} ${
              settings.contact?.phone ? "| " + settings.contact.phone : ""
            }`,
            50,
            157,
          );
      }

      drawLine(doc, 190);

      // Currency Statement
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text(
          `All amounts are in ${settings?.currency?.code || "USD"} (${
            settings?.currency?.symbol || "$"
          })`,
          50,
          200,
          { align: "right" },
        );

      // Summary
      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Summary", 50, 215);

      const cardWidth = 118;
      const cardGap = 8;
      const cardY = 240;
      const cards = [
        {
          label: "TOTAL OUTSTANDING",
          value: formatCurrency(summary.totalOutstanding || 0, settings),
          color: "#DC2626",
        },
        {
          label: "OVERDUE INVOICES",
          value: String(summary.overdueCount || 0),
          color: "#EA580C",
        },
        {
          label: "PARTIALLY PAID",
          value: String(summary.partiallyPaidCount || 0),
          color: "#D97706",
        },
        {
          label: "CUSTOMERS OWING",
          value: String(summary.customersWithDebt || 0),
          color: "#2563EB",
        },
      ];
      cards.forEach((card, i) => {
        const x = 50 + i * (cardWidth + cardGap);
        doc.rect(x, cardY, cardWidth, 55).fill("#F9FAFB");
        doc
          .fillColor("#4B5563")
          .fontSize(7.5)
          .font("Helvetica")
          .text(card.label, x + 10, cardY + 12, { width: cardWidth - 20 });
        doc
          .fillColor(card.color)
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(card.value, x + 10, cardY + 28, { width: cardWidth - 20 });
      });

      // Detailed Invoice Table
      let y = cardY + 80;
      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Outstanding Invoices", 50, y);
      y += 25;

      const drawInvoiceHeader = (yy) => {
        doc
          .rect(50, yy, 500, 22)
          .fill("#F3F4F6")
          .fillColor("#4B5563")
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("INVOICE #", 55, yy + 7, { width: 65 })
          .text("CUSTOMER", 120, yy + 7, { width: 100 })
          .text("DUE DATE", 220, yy + 7, { width: 60 })
          .text("TOTAL", 285, yy + 7, { width: 65, align: "right" })
          .text("PAID", 355, yy + 7, { width: 65, align: "right" })
          .text("BALANCE", 425, yy + 7, { width: 65, align: "right" })
          .text("OVERDUE", 495, yy + 7, { width: 50, align: "right" });
        return yy + 22;
      };

      y = drawInvoiceHeader(y);

      doc.font("Helvetica").fontSize(8);
      invoices.forEach((inv, index) => {
        if (y > 740) {
          doc.addPage();
          y = 50;
          y = drawInvoiceHeader(y);
          doc.font("Helvetica").fontSize(8);
        }
        const bgColor = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
        doc.rect(50, y, 500, 20).fill(bgColor);

        const custName = inv.customer
          ? `${inv.customer.firstName || ""} ${inv.customer.lastName || ""}`.trim() ||
            inv.customerInfo?.company ||
            "Unknown"
          : inv.customerInfo?.firstName
            ? `${inv.customerInfo.firstName} ${inv.customerInfo.lastName || ""}`.trim()
            : "Unknown";

        doc
          .fillColor("#111827")
          .text(inv.invoiceNumber || "N/A", 55, y + 6, { width: 65 })
          .text(custName, 120, y + 6, { width: 100 })
          .text(
            inv.dueDate ? formatDate(inv.dueDate, settings) : "-",
            220,
            y + 6,
            {
              width: 60,
            },
          )
          .text(formatCurrency(inv.total, settings), 285, y + 6, {
            width: 65,
            align: "right",
          })
          .text(formatCurrency(inv.amountPaid || 0, settings), 355, y + 6, {
            width: 65,
            align: "right",
          })
          .fillColor("#DC2626")
          .text(formatCurrency(inv.balanceDue, settings), 425, y + 6, {
            width: 65,
            align: "right",
          })
          .fillColor("#111827")
          .text(inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : "-", 495, y + 6, {
            width: 50,
            align: "right",
          });
        y += 20;
      });

      // Totals row
      doc.rect(50, y, 500, 22).fill("#F3F4F6");
      doc
        .fillColor("#111827")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("TOTAL OUTSTANDING", 220, y + 7, { width: 195, align: "right" })
        .fillColor("#DC2626")
        .text(
          formatCurrency(summary.totalOutstanding || 0, settings),
          425,
          y + 7,
          {
            width: 65,
            align: "right",
          },
        );
      y += 40;

      // Customer Summary
      if (customerSummary && customerSummary.length > 0) {
        if (y > 680) {
          doc.addPage();
          y = 50;
        }
        doc
          .fillColor("#111827")
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("Customer Balance Summary", 50, y);
        y += 25;

        doc
          .rect(50, y, 500, 22)
          .fill("#F3F4F6")
          .fillColor("#4B5563")
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("CUSTOMER", 55, y + 7, { width: 220 })
          .text("INVOICES", 280, y + 7, { width: 70, align: "right" })
          .text("OVERDUE", 355, y + 7, { width: 70, align: "right" })
          .text("BALANCE DUE", 430, y + 7, { width: 115, align: "right" });
        y += 22;

        doc.font("Helvetica").fontSize(8);
        customerSummary.forEach((cust, index) => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          const bgColor = index % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
          doc.rect(50, y, 500, 20).fill(bgColor);
          doc
            .fillColor("#111827")
            .text(cust.customerName || "Unknown", 55, y + 6, { width: 220 })
            .text(String(cust.invoiceCount || 0), 280, y + 6, {
              width: 70,
              align: "right",
            })
            .text(String(cust.overdueCount || 0), 355, y + 6, {
              width: 70,
              align: "right",
            })
            .fillColor("#DC2626")
            .text(
              formatCurrency(cust.totalOutstanding || 0, settings),
              430,
              y + 6,
              {
                width: 115,
                align: "right",
              },
            );
          y += 20;
        });
      }

      // Add page numbers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fontSize(8)
          .fillColor("#9CA3AF")
          .text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 30, {
            align: "center",
          });
        doc
          .fontSize(7)
          .text(
            "This is a computer-generated document. No signature is required.",
            50,
            doc.page.height - 20,
            { align: "center" },
          );
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const generateProfitLossReportPDF = (
  reportData,
  payments,
  expenses,
  stats,
  settings,
  timeframe,
  dateRange,
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        bufferPages: true,
        info: {
          Title: "Profit & Loss Report",
          Author: settings?.storeName || "MerchPilot",
          Subject: "Financial Report",
        },
      });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Header
      if (settings?.logo) {
        await embedLogo(doc, settings.logo, 450, 45, 100, 50);
      }

      doc
        .fillColor("#111827")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Profit & Loss Report", 50, 50);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#6B7280")
        .text(
          `Generated on: ${formatDate(new Date(), settings)} ${formatTime(
            new Date(),
            settings,
          )}`,
          50,
          75,
        );

      const reportId = `PL-${Date.now().toString().slice(-6)}`;
      doc.text(`Report ID: ${reportId}`, 50, 90);

      doc.text(
        `Period: ${dateRange.startDate || "All Time"} to ${
          dateRange.endDate || "Present"
        }`,
        50,
        105,
      );
      doc.text(`Timeframe: ${timeframe.toUpperCase()}`, 50, 120);

      // Company Info
      if (settings?.storeName) {
        doc
          .fillColor("#111827")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(settings.storeName, 50, 145);

        const addressParts = [
          settings.address?.street,
          settings.address?.city,
          settings.address?.zip,
          settings.address?.country,
        ].filter(Boolean);

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4B5563")
          .text(addressParts.join(", "), 50, 160)
          .text(
            `${settings.contact?.email || ""} ${
              settings.contact?.phone ? "| " + settings.contact.phone : ""
            }`,
            50,
            172,
          );

        if (settings.website) {
          doc.text(settings.website, 50, 184);
        }
      }

      drawLine(doc, 205);

      // Currency Statement
      doc
        .fillColor("#6B7280")
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text(
          `All amounts are in ${settings?.currency?.code || "USD"} (${
            settings?.currency?.symbol || "$"
          })`,
          50,
          215,
          { align: "right" },
        );

      // Summary Cards
      doc.rect(50, 230, 160, 60).fill("#F9FAFB");
      doc.fillColor("#4B5563").fontSize(8).text("TOTAL SALES", 60, 245);
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(formatCurrency(stats.totalSales, settings), 60, 260);

      doc.rect(220, 230, 160, 60).fill("#F9FAFB");
      doc.fillColor("#4B5563").fontSize(8).text("TOTAL EXPENSES", 230, 245);
      doc
        .fillColor("#EF4444")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(formatCurrency(stats.totalExpenses, settings), 230, 260);

      doc.rect(390, 230, 160, 60).fill("#F9FAFB");
      doc.fillColor("#4B5563").fontSize(8).text("NET PROFIT", 400, 245);
      doc
        .fillColor(stats.netProfit >= 0 ? "#10B981" : "#EF4444")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(formatCurrency(stats.netProfit, settings), 400, 260);

      let y = 310;

      // 1. Payments List
      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Payments Received", 50, y);
      y += 25;
      doc.rect(50, y, 500, 20).fill("#F3F4F6");
      doc
        .fillColor("#4B5563")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("DATE", 60, y + 6)
        .text("INVOICE #", 120, y + 6)
        .text("CUSTOMER", 200, y + 6)
        .text("METHOD", 350, y + 6)
        .text("AMOUNT", 450, y + 6, { width: 90, align: "right" });
      y += 20;

      doc.font("Helvetica").fontSize(8);
      payments.forEach((p, idx) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        doc.fillColor("#111827").text(formatDate(p.date, settings), 60, y + 6);
        doc.text(p.invoice?.invoiceNumber || "N/A", 120, y + 6);
        doc.text(
          p.customer?.firstName
            ? `${p.customer.firstName} ${p.customer.lastName || ""}`
            : "N/A",
          200,
          y + 6,
          { width: 140 },
        );
        doc.text(p.method || "N/A", 350, y + 6);
        doc.text(formatCurrency(p.amount, settings), 450, y + 6, {
          width: 90,
          align: "right",
        });
        y += 15;
      });

      y += 30;

      // 2. Expenses List
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc
        .fillColor("#111827")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Expenses Paid", 50, y);
      y += 25;
      doc.rect(50, y, 500, 20).fill("#F3F4F6");
      doc
        .fillColor("#4B5563")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("DATE", 60, y + 6)
        .text("CATEGORY", 150, y + 6)
        .text("DESCRIPTION", 250, y + 6)
        .text("AMOUNT", 450, y + 6, { width: 90, align: "right" });
      y += 20;

      doc.font("Helvetica").fontSize(8);
      expenses.forEach((e, idx) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        doc.fillColor("#111827").text(formatDate(e.date, settings), 60, y + 6);
        doc.text(e.category || "N/A", 150, y + 6);
        doc.text(e.description || "N/A", 250, y + 6, { width: 190 });
        doc.text(formatCurrency(e.amount, settings), 450, y + 6, {
          width: 90,
          align: "right",
        });
        y += 15;
      });

      // Add page numbers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fontSize(8)
          .fillColor("#9CA3AF")
          .text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 30, {
            align: "center",
          });
        doc
          .fontSize(7)
          .text(
            "This is a computer-generated document. No signature is required.",
            50,
            doc.page.height - 20,
            { align: "center" },
          );
        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDF,
  generateQuotationPDF,
  generateSalesReportPDF,
  generateProfitLossReportPDF,
  generateOutstandingReportPDF,
};
