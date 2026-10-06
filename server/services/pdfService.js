const PDFDocument = require("pdfkit");
const axios = require("axios");
const { getTaxDisplay } = require("../utils/taxDisplay");

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
const addTableHeader = (doc, y, settings) => {
  doc
    .rect(50, y, 500, 26)
    .fill("#1E3A8A")
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
      const invoiceTitleText = docTypeName.toUpperCase();
      doc
        .fillColor(isProforma ? "#065F46" : "#1E3A8A")
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
        .fillColor(isProforma ? "#065F46" : "#1E3A8A")
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

      tableY = addTableHeader(doc, tableY, settings);

      invoice.items.forEach((item, index) => {
        if (tableY > 680) {
          doc.addPage();
          tableY = 36;
          tableY = addTableHeader(doc, tableY, settings);
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
      doc.rect(totalsLeft, tableY, 220, 22).fill("#1E3A8A");
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
      doc.rect(LEFT, tableY, PAGE_WIDTH, 20).fill("#EFF6FF");
      doc
        .fillColor("#6B7280")
        .fontSize(7)
        .font("Helvetica")
        .text("TOTAL AMOUNT IN WORDS:", LEFT + 6, tableY + 4);
      doc
        .fillColor("#1E3A8A")
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

// Generate Quotation PDF
const generateQuotationPDF = async (quotation, settings) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
        info: {
          Title: `Quotation #${quotation.quotationNumber}`,
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

      // Header Section
      doc
        .fillColor("#2563EB")
        .fontSize(32)
        .font("Helvetica-Bold")
        .text("QUOTATION", 50, 50);

      // Logo (top right)
      if (settings?.logo) {
        await embedLogo(doc, settings.logo, 450, 50, 100, 50);
      }

      // Quotation Number
      doc
        .fillColor("#6B7280")
        .fontSize(12)
        .font("Helvetica")
        .text(`#${quotation.quotationNumber}`, 50, 90);

      // Company Info (right side)
      let companyY = 110;
      doc
        .fillColor("#111827")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(settings?.storeName || "Company Name", 350, companyY, {
          width: 200,
          align: "right",
        });

      companyY += 15;
      doc
        .fillColor("#4B5563")
        .fontSize(9)
        .font("Helvetica")
        .text(settings?.address?.street || "", 350, companyY, {
          width: 200,
          align: "right",
        });

      if (settings?.address?.city || settings?.address?.zip) {
        companyY += 12;
        doc.text(
          `${settings?.address?.city || ""}${
            settings?.address?.city && settings?.address?.zip ? ", " : ""
          }${settings?.address?.zip || ""}`,
          350,
          companyY,
          { width: 200, align: "right" },
        );
      }

      if (settings?.contact?.phone) {
        companyY += 12;
        doc.text(`Phone: ${settings.contact.phone}`, 350, companyY, {
          width: 200,
          align: "right",
        });
      }

      if (settings?.contact?.email) {
        companyY += 12;
        doc.text(settings.contact.email, 350, companyY, {
          width: 200,
          align: "right",
        });
      }

      // Blue header line (moved down to accommodate company info)
      const headerLineY = Math.max(companyY + 15, 175);
      drawLine(doc, headerLineY, "#2563EB", 2);

      // Bill To & Quotation Details
      let detailsY = headerLineY + 20;

      // Bill To (Left)
      doc
        .fillColor("#9CA3AF")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("BILL TO", 50, detailsY);

      detailsY += 18;
      doc
        .fillColor("#111827")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(
          `${quotation.customer?.salutation || ""}${
            quotation.customer?.salutation ? " " : ""
          }${quotation.customer?.firstName || ""} ${
            quotation.customer?.lastName || ""
          }`,
          50,
          detailsY,
        );

      if (quotation.customer?.billing?.company) {
        detailsY += 15;
        doc
          .fillColor("#1F2937")
          .font("Helvetica")
          .text(quotation.customer.billing.company, 50, detailsY);
      }

      if (quotation.customer?.billing?.address_1) {
        detailsY += 15;
        doc
          .fillColor("#1F2937")
          .font("Helvetica")
          .text(quotation.customer.billing.address_1, 50, detailsY);
      }

      if (
        quotation.customer?.billing?.city ||
        quotation.customer?.billing?.postcode
      ) {
        detailsY += 12;
        doc.text(
          `${quotation.customer?.billing?.city || ""}${
            quotation.customer?.billing?.city &&
            quotation.customer?.billing?.postcode
              ? ", "
              : ""
          }${quotation.customer?.billing?.postcode || ""}`,
          50,
          detailsY,
        );
      }

      if (quotation.customer?.email) {
        detailsY += 12;
        doc.text(quotation.customer.email, 50, detailsY);
      }

      if (quotation.customer?.billing?.phone) {
        detailsY += 12;
        doc.text(quotation.customer.billing.phone, 50, detailsY);
      }

      if (quotation.customer?.taxNumber) {
        const taxLabel =
          settings?.tax?.label && settings.tax.label !== "Tax"
            ? settings.tax.label
            : "TIN";
        detailsY += 12;
        doc.text(`${taxLabel}: ${quotation.customer.taxNumber}`, 50, detailsY);
      }

      // Quotation Details (Right)
      let quotationDetailsY = detailsY;
      doc
        .fillColor("#9CA3AF")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("QUOTATION DETAILS", 350, quotationDetailsY);

      quotationDetailsY += 18;
      doc
        .fillColor("#1F2937")
        .fontSize(10)
        .font("Helvetica")
        .text("Date Issued:", 350, quotationDetailsY, {
          width: 100,
          align: "left",
        });
      doc
        .font("Helvetica-Bold")
        .text(
          formatDate(quotation.quotationDate || quotation.createdAt, settings),
          450,
          quotationDetailsY,
          { width: 100, align: "right" },
        );

      if (quotation.validUntil) {
        quotationDetailsY += 15;
        doc.font("Helvetica").text("Valid Until:", 350, quotationDetailsY, {
          width: 100,
          align: "left",
        });
        doc
          .font("Helvetica-Bold")
          .text(
            formatDate(quotation.validUntil, settings),
            450,
            quotationDetailsY,
            { width: 100, align: "right" },
          );
      }

      // Items Table
      let tableY = Math.max(detailsY, quotationDetailsY) + 40;

      // Check if we need a new page
      if (tableY > 650) {
        doc.addPage();
        tableY = 50;
      }

      tableY = addTableHeader(doc, tableY, settings);

      quotation.items.forEach((item, index) => {
        // Check if we need a new page for this item
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
          tableY = addTableHeader(doc, tableY, settings);
        }

        tableY = addTableRow(
          doc,
          tableY,
          item,
          settings,
          index === quotation.items.length - 1,
        );
      });

      // Totals Section
      tableY += 20;
      drawLine(doc, tableY - 10, "#E5E7EB", 1);

      const totalsX = 420;

      // Subtotal
      doc
        .fillColor("#6B7280")
        .fontSize(10)
        .font("Helvetica")
        .text("Subtotal", totalsX - 100, tableY, {
          width: 100,
          align: "right",
        });
      doc
        .fillColor("#111827")
        .font("Helvetica")
        .text(formatCurrency(quotation.subtotal, settings), totalsX, tableY, {
          width: 125,
          align: "right",
        });

      // Tax (always shown, even at 0%)
      const quotationTaxInfo = getTaxDisplay(quotation, settings);
      tableY += 20;
      doc
        .fillColor("#6B7280")
        .text(quotationTaxInfo.lineLabel, totalsX - 150, tableY, {
          width: 150,
          align: "right",
        });
      doc
        .fillColor("#111827")
        .text(formatCurrency(quotation.tax || 0, settings), totalsX, tableY, {
          width: 125,
          align: "right",
        });

      // Discount
      if (quotation.discount > 0) {
        tableY += 20;
        doc.fillColor("#6B7280").text("Discount", totalsX - 100, tableY, {
          width: 100,
          align: "right",
        });
        doc
          .fillColor("#EF4444")
          .text(
            `-${formatCurrency(quotation.discount, settings)}`,
            totalsX,
            tableY,
            { width: 125, align: "right" },
          );
      }

      // Grand Total
      tableY += 25;
      drawLine(doc, tableY - 5, "#2563EB", 2);
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Total", totalsX - 100, tableY, { width: 100, align: "right" });
      doc
        .fillColor("#2563EB")
        .fontSize(14)
        .text(formatCurrency(quotation.total, settings), totalsX, tableY, {
          width: 125,
          align: "right",
        });

      // Notes
      if (quotation.notes) {
        tableY += 40;

        // Check if we need a new page for notes
        if (tableY > 650) {
          doc.addPage();
          tableY = 50;
        }

        doc
          .roundedRect(50, tableY, 500, 60, 4)
          .fill("#F9FAFB")
          .fillColor("#9CA3AF")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("NOTES", 60, tableY + 10);

        doc
          .fillColor("#1F2937")
          .fontSize(10)
          .font("Helvetica")
          .text(quotation.notes, 60, tableY + 25, {
            width: 480,
            align: "left",
          });

        tableY += 70;
      }

      // Check if we need a new page for footer (needs ~80 points)
      if (tableY > 670) {
        doc.addPage();
      }

      // Footer (only once at the bottom)
      drawLine(doc, 750, "#E5E7EB", 1);

      doc
        .fillColor("#9CA3AF")
        .fontSize(8)
        .font("Helvetica")
        .text("Thank you for your interest!", 50, 760, {
          width: 500,
          align: "center",
        });

      // Bank Details
      if (settings?.bank?.accountName) {
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("Bank Details:", 50, 775, { width: 500, align: "center" });

        doc
          .font("Helvetica")
          .text(
            `${settings.bank.bankName || ""}${
              settings.bank.branch ? `, ${settings.bank.branch}` : ""
            }`,
            50,
            787,
            { width: 500, align: "center" },
          );

        doc.text(
          `Account Name: ${settings.bank.accountName} | Account No: ${settings.bank.accountNumber}`,
          50,
          797,
          { width: 500, align: "center" },
        );

        if (settings.bank.swiftCode) {
          doc.text(`Swift Code: ${settings.bank.swiftCode}`, 50, 807, {
            width: 500,
            align: "center",
          });
        }
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
