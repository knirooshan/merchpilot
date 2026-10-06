import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  Download,
  Truck,
  Mail,
  DollarSign,
  XCircle,
  Package,
} from "lucide-react";
import { useSelector } from "react-redux";
import InvoicePDF from "../components/InvoicePDF";
import DeliveryReceiptPDF from "../components/DeliveryReceiptPDF";
import PaymentModal from "../components/PaymentModal";
import { formatCurrency, getDocumentCurrencySettings } from "../utils/currency";
import { formatDate } from "../utils/date";
import { getTaxDisplay } from "../utils/taxDisplay";
import { urlToBase64 } from "../utils/imageUtils";
import DeliveryUpdateModal from "../components/DeliveryUpdateModal";

const InvoiceView = () => {
  const { id } = useParams();
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const [invoice, setInvoice] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const invRes = await axios.get(ENDPOINTS.INVOICE_BY_ID(id), config);

      const invoiceData = invRes.data;

      // Convert product images to base64 for items
      const itemsWithImages = await Promise.all(
        invoiceData.items.map(async (item) => {
          if (item.product?.images && item.product.images.length > 0) {
            try {
              const base64Image = await urlToBase64(
                item.product.images[0],
                token,
              );
              return { ...item, image: base64Image };
            } catch (error) {
              console.error("Error converting product image to base64:", error);
              return { ...item, image: null };
            }
          }
          return { ...item, image: null };
        }),
      );

      invoiceData.items = itemsWithImages;
      setInvoice(invoiceData);

      // Convert logo URL to base64 for PDF
      if (settings?.logo) {
        const base64Logo = await urlToBase64(settings.logo, token);
        setLogoBase64(base64Logo);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user.token, settings]);

  const handleSendEmail = async () => {
    if (!window.confirm("Send this invoice to the customer via email?")) return;
    setSendingEmail(true);
    try {
      // Generate PDF blob from React component
      const pdfDoc = (
        <InvoicePDF
          invoice={invoice}
          settings={{ ...settings, logo: logoBase64 }}
        />
      );
      const blob = await pdf(pdfDoc).toBlob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(blob);
      const pdfBase64 = await base64Promise;

      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(ENDPOINTS.EMAIL_SEND_INVOICE(id), { pdfBase64 }, config);
      alert("Email sent successfully!");
    } catch (error) {
      console.error("Error sending email:", error);
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to send email. Please check SMTP settings.",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePaymentSave = async (paymentData) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(ENDPOINTS.PAYMENTS, paymentData, config);
      setIsPaymentModalOpen(false);
      fetchData(); // Refresh invoice data
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Failed to save payment");
    }
  };

  const handleWriteOff = async () => {
    if (
      !window.confirm(
        "Are you sure you want to write off the remaining balance? This cannot be undone.",
      )
    )
      return;
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(ENDPOINTS.INVOICE_WRITE_OFF(id), {}, config);
      fetchData();
    } catch (error) {
      console.error("Error writing off invoice:", error);
      alert("Failed to write off invoice");
    }
  };

  const handleDownloadInvoicePDF = async () => {
    setDownloadingPDF(true);
    try {
      const pdfDoc = (
        <InvoicePDF
          invoice={invoice}
          settings={{ ...settings, logo: logoBase64 }}
        />
      );
      const blob = await pdf(pdfDoc).toBlob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading invoice PDF:", error);
      alert("Failed to download invoice PDF. Please try again.");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadDeliveryReceipt = async () => {
    setDownloadingPDF(true);
    try {
      const pdfDoc = (
        <DeliveryReceiptPDF
          invoice={invoice}
          settings={{ ...settings, logo: logoBase64 }}
        />
      );
      const blob = await pdf(pdfDoc).toBlob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceNumber}-delivery-receipt.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading delivery receipt:", error);
      alert("Failed to download delivery receipt. Please try again.");
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) return <div className="text-white">Loading...</div>;
  if (!invoice) return <div>Invoice not found</div>;

  const effectiveSettings = getDocumentCurrencySettings(invoice, settings);

  const balanceDue =
    invoice.balanceDue !== undefined
      ? invoice.balanceDue
      : invoice.total - (invoice.amountPaid || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Link
          to="/invoices"
          className="flex items-center text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Invoices
        </Link>
        <div className="flex gap-4">
          {balanceDue > 0 &&
            !invoice.isWrittenOff &&
            user?.role === "admin" && (
              <>
                <button
                  onClick={handleWriteOff}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  Write Off
                </button>
              </>
            )}
          {invoice?.customer?.email && (
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Mail className="mr-2 h-5 w-5" />
              {sendingEmail ? "Sending..." : "Send Email"}
            </button>
          )}
          <button
            onClick={handleDownloadInvoicePDF}
            disabled={downloadingPDF}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="mr-2 h-5 w-5" />
            {downloadingPDF ? "Generating..." : "Invoice"}
          </button>
          <button
            onClick={() => setIsDeliveryModalOpen(true)}
            className="flex items-center px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
          >
            <Package className="mr-2 h-5 w-5" />
            Track Delivery
          </button>
          <button
            onClick={handleDownloadDeliveryReceipt}
            disabled={downloadingPDF}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Truck className="mr-2 h-5 w-5" />
            Delivery Receipt
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-8 border border-slate-200">
        {/* Header */}
        <div className="flex justify-between border-b border-slate-200 pb-8 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {invoice.invoiceType === "proforma"
                ? "PROFORMA INVOICE"
                : getTaxDisplay(invoice, settings).registered
                  ? "TAX INVOICE"
                  : "INVOICE"}
            </h1>
            <p className="text-slate-600">#{invoice.invoiceNumber}</p>
            <p className="text-slate-600">
              Date: {formatDate(invoice.createdAt, settings)}
            </p>
            <p className="text-slate-600">
              Due Date:{" "}
              {invoice.dueDate ? formatDate(invoice.dueDate, settings) : "-"}
            </p>
            {invoice.reference && (
              <p className="text-slate-600">Reference: {invoice.reference}</p>
            )}
            <p className="text-slate-600">
              Status:{" "}
              <span
                className={`font-semibold uppercase ${
                  invoice.status === "paid"
                    ? "text-green-600"
                    : invoice.status === "overdue" ||
                        invoice.status === "written-off"
                      ? "text-red-600"
                      : "text-yellow-600"
                }`}
              >
                {invoice.status.replace("_", " ")}
              </span>
            </p>
            {invoice.currency?.code &&
              invoice.currency.code !== settings?.currency?.code && (
                <p className="text-slate-600 mt-1">
                  Currency:{" "}
                  <span className="font-semibold text-amber-600">
                    {invoice.currency.code}
                  </span>
                  {invoice.exchangeRate?.rate > 0 && (
                    <span className="text-slate-500 text-sm ml-1">
                      (1 {invoice.currency.code} = {invoice.exchangeRate.rate}{" "}
                      {invoice.exchangeRate.baseCurrency})
                    </span>
                  )}
                </p>
              )}
          </div>
          <div className="text-right">
            {settings?.logo && (
              <img
                src={settings.logo}
                alt={settings.storeName}
                className="h-12 mb-4 ml-auto object-contain"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <h2 className="text-xl font-bold text-slate-900">
              {settings?.storeName}
            </h2>
            <p className="text-slate-600">{settings?.address?.street}</p>
            <p className="text-slate-600">{settings?.address?.city}</p>
            <p className="text-slate-600">{settings?.contact?.email}</p>
            {settings?.registrationNo && (
              <p className="text-slate-600">
                Reg No: {settings.registrationNo}
              </p>
            )}
            {settings?.taxIdNo && (
              <p className="text-slate-600">Tax ID: {settings.taxIdNo}</p>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="mb-8">
          <h3 className="text-slate-600 font-semibold mb-2">Bill To:</h3>
          <p className="text-slate-900 font-medium">
            {invoice.customer?.salutation
              ? `${invoice.customer.salutation} `
              : ""}
            {invoice.customer?.firstName || invoice.customer?.lastName
              ? `${invoice.customer.firstName || ""} ${
                  invoice.customer.lastName || ""
                }`.trim()
              : invoice.customer?.billing?.company || "Unnamed Customer"}
          </p>
          {invoice.customer?.billing?.company &&
            (invoice.customer?.firstName || invoice.customer?.lastName) && (
              <p className="text-slate-600 font-medium">
                {invoice.customer.billing.company}
              </p>
            )}
          <p className="text-slate-600">
            {invoice.customer?.billing?.address_1}
          </p>
          <p className="text-slate-600">
            {invoice.customer?.billing?.city}
            {invoice.customer?.billing?.city &&
              invoice.customer?.billing?.postcode &&
              ", "}
            {invoice.customer?.billing?.postcode}
          </p>
          <p className="text-slate-600">{invoice.customer?.email}</p>
          {invoice.customer?.billing?.phone && (
            <p className="text-slate-600">{invoice.customer.billing.phone}</p>
          )}
          {invoice.customer?.taxNumber && (
            <p className="text-slate-600 font-medium">
              {settings?.tax?.label && settings.tax.label !== "Tax"
                ? settings.tax.label
                : "TIN"}
              : {invoice.customer.taxNumber}
            </p>
          )}
        </div>

        {/* Items */}
        <table className="min-w-full mb-8">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-3 text-slate-600 w-20">Image</th>
              <th className="text-left py-3 text-slate-600">Item</th>
              <th className="text-right py-3 text-slate-600">Price</th>
              <th className="text-right py-3 text-slate-600">Qty</th>
              <th className="text-right py-3 text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b border-slate-200">
                <td className="py-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 object-contain"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                      <Package size={24} />
                    </div>
                  )}
                </td>
                <td className="py-3 text-slate-900">
                  <div className="font-medium">{item.name}</div>
                  {(item.description || item.product?.shortDescription) && (
                    <div
                      className="text-xs text-slate-500 mt-1 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html:
                          item.description || item.product.shortDescription,
                      }}
                    />
                  )}
                  {item.discount > 0 && (
                    <div className="text-xs text-red-500 mt-1">
                      Discount: -
                      {item.discountType === "percentage"
                        ? `${item.discount}%`
                        : formatCurrency(item.discount, effectiveSettings)}
                    </div>
                  )}
                  {item.isTaxable && (
                    <div className="text-xs text-blue-500 mt-1">
                      {settings?.tax?.label || "Tax"} ({item.taxMethod})
                    </div>
                  )}
                </td>
                <td className="text-right py-3 text-slate-600">
                  {formatCurrency(item.price, effectiveSettings)}
                </td>
                <td className="text-right py-3 text-slate-600">
                  {item.quantity}
                </td>
                <td className="text-right py-3 text-slate-900 font-medium">
                  {formatCurrency(item.total, effectiveSettings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex flex-col items-end space-y-2">
          <div className="flex justify-between w-64">
            <span className="text-slate-600">Subtotal:</span>
            <span className="text-slate-900">
              {formatCurrency(invoice.subtotal, effectiveSettings)}
            </span>
          </div>
          <div className="flex justify-between w-64">
            <span className="text-slate-600">
              {getTaxDisplay(invoice, settings).lineLabel}:
            </span>
            <span className="text-slate-900">
              {formatCurrency(invoice.tax || 0, effectiveSettings)}
            </span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between w-64">
              <span className="text-slate-600">Discount:</span>
              <span className="text-slate-900">
                -{formatCurrency(invoice.discount, effectiveSettings)}
              </span>
            </div>
          )}
          {invoice.deliveryCharge > 0 && (
            <div className="flex justify-between w-64">
              <span className="text-slate-600">Delivery Charge:</span>
              <span className="text-slate-900">
                {formatCurrency(invoice.deliveryCharge, effectiveSettings)}
              </span>
            </div>
          )}
          <div className="flex justify-between w-64 text-xl font-bold pt-4 border-t border-slate-200 text-slate-900">
            <span>Total:</span>
            <span>{formatCurrency(invoice.total, effectiveSettings)}</span>
          </div>
          <div className="flex justify-between w-64 text-slate-600">
            <span>Amount Paid:</span>
            <span>
              {formatCurrency(invoice.amountPaid || 0, effectiveSettings)}
            </span>
          </div>
          <div className="flex justify-between w-64 text-lg font-semibold text-red-600">
            <span>Balance Due:</span>
            <span>{formatCurrency(balanceDue, effectiveSettings)}</span>
          </div>
        </div>

        {/* Payments List */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="text-slate-600 font-semibold mb-4">
              Payments History
            </h3>
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-slate-600">Date</th>
                  <th className="text-left py-2 text-slate-600">Method</th>
                  <th className="text-left py-2 text-slate-600">Reference</th>
                  <th className="text-right py-2 text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-2 text-slate-900">
                      {formatDate(payment.date, settings)}
                    </td>
                    <td className="py-2 text-slate-900">{payment.method}</td>
                    <td className="py-2 text-slate-900">
                      {payment.reference || "-"}
                    </td>
                    <td className="text-right py-2 text-slate-900 font-medium">
                      {formatCurrency(payment.amount, effectiveSettings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms || invoice.deliveryNote) && (
          <div className="mt-8 pt-8 border-t border-slate-200">
            {invoice.notes && (
              <div className="mb-6">
                <h3 className="text-slate-600 font-semibold mb-2">Notes:</h3>
                <div
                  className="text-slate-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: invoice.notes }}
                />
              </div>
            )}
            {invoice.terms && (
              <div className="mb-6">
                <h3 className="text-slate-600 font-semibold mb-2">
                  Terms & Conditions:
                </h3>
                <div
                  className="text-slate-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: invoice.terms }}
                />
              </div>
            )}
            {invoice.deliveryNote && (
              <div>
                <h3 className="text-slate-600 font-semibold mb-2">
                  Delivery Note:
                </h3>
                <div
                  className="text-slate-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: invoice.deliveryNote }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSave={handlePaymentSave}
        invoice={invoice}
        totalDue={balanceDue}
      />

      {isDeliveryModalOpen && (
        <DeliveryUpdateModal
          isOpen={isDeliveryModalOpen}
          onClose={() => setIsDeliveryModalOpen(false)}
          invoiceNumber={invoice.invoiceNumber}
        />
      )}
    </div>
  );
};

export default InvoiceView;
