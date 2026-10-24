import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  Download,
  Printer,
  FileText,
  Mail,
  Package,
} from "lucide-react";
import { useSelector } from "react-redux";
import QuotationPDF from "../components/QuotationPDF";
import {
  formatCurrency,
  getDocumentCurrencySettings,
  isForeignCurrency,
} from "../utils/currency";
import { formatDate } from "../utils/date";
import { getTaxDisplay } from "../utils/taxDisplay";
import { urlToBase64 } from "../utils/imageUtils";
import toast from "react-hot-toast";

const QuotationView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.QUOTATION_BY_ID(id));
      const quotationData = { ...data };
      const token = user?.token;

      // Convert product images to base64 for items
      const itemsWithImages = await Promise.all(
        (quotationData.items || []).map(async (item) => {
          if (item.product?.images && item.product.images.length > 0) {
            try {
              const base64Image = await urlToBase64(
                item.product.images[0],
                token,
              );
              return { ...item, image: base64Image };
            } catch (error) {
              console.error(
                "Error converting product image to base64:",
                error,
              );
              return { ...item, image: null };
            }
          }
          return { ...item, image: null };
        }),
      );

      quotationData.items = itemsWithImages;
      return quotationData;
    },
    enabled: Boolean(id),
  });

  const { data: logoBase64 } = useQuery({
    queryKey: ["logoBase64", settings?.logo],
    queryFn: async () => {
      if (!settings?.logo) return null;
      return urlToBase64(settings.logo, user?.token);
    },
    enabled: Boolean(settings?.logo),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ pdfBase64 }) => {
      return apiClient.post(ENDPOINTS.EMAIL_SEND_QUOTATION(id), { pdfBase64 });
    },
    onSuccess: () => {
      toast.success("Email sent successfully!");
    },
    onError: (error) => {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please check SMTP settings.");
    },
  });

  const handleConvertToInvoice = () => {
    navigate("/invoices/create", {
      state: { quotationData: quotation },
    });
  };

  const handleSendEmail = async () => {
    if (!quotation?.customer?.email) {
      toast.error(
        "This customer does not have an email address. Please add an email to the customer profile first.",
      );
      return;
    }

    if (!window.confirm("Send this quotation to the customer via email?"))
      return;

    try {
      const pdfDoc = (
        <QuotationPDF
          quotation={quotation}
          settings={{ ...settings, logo: logoBase64 }}
        />
      );
      const blob = await pdf(pdfDoc).toBlob();

      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(blob);
      const pdfBase64 = await base64Promise;

      sendEmailMutation.mutate({ pdfBase64 });
    } catch (error) {
      console.error("Error generating PDF for email:", error);
      toast.error("Failed to generate PDF for email.");
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const pdfDoc = (
        <QuotationPDF
          quotation={quotation}
          settings={{ ...settings, logo: logoBase64 }}
        />
      );
      const blob = await pdf(pdfDoc).toBlob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quotation.quotationNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (isLoading) return <div className="text-white">Loading...</div>;
  if (!quotation) return <div className="text-white">Quotation not found</div>;

  const effectiveSettings = getDocumentCurrencySettings(quotation, settings);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Link
          to="/quotations"
          className="flex items-center text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Quotations
        </Link>
        <div className="flex gap-4">
          <button
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Mail className="mr-2 h-5 w-5" />
            {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
          </button>
          <button
            onClick={handleConvertToInvoice}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <FileText className="mr-2 h-5 w-5" /> Convert to Invoice
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="mr-2 h-5 w-5" />
            {downloadingPDF ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-8 border border-slate-200">
        {/* Header */}
        <div className="flex justify-between border-b border-slate-200 pb-8 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              QUOTATION
            </h1>
            <p className="text-slate-600">#{quotation.quotationNumber}</p>
            <p className="text-slate-600">
              Date:{" "}
              {formatDate(
                quotation.quotationDate || quotation.createdAt,
                settings,
              )}
            </p>
            <p className="text-slate-600">
              Status:{" "}
              <span className="font-semibold uppercase text-blue-600">
                {quotation.status}
              </span>
            </p>
            {isForeignCurrency(quotation, settings) && (
              <p className="text-slate-600 mt-1">
                Currency:{" "}
                <span className="font-semibold text-amber-600">
                  {quotation.currency.code}
                </span>
                {quotation.exchangeRate?.rate > 0 && (
                  <span className="text-slate-500 text-sm ml-1">
                    (1 {quotation.currency.code} = {quotation.exchangeRate.rate}{" "}
                    {quotation.exchangeRate.baseCurrency ||
                      settings?.currency?.code ||
                      "LKR"})
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
            {quotation.customer?.salutation
              ? `${quotation.customer.salutation} `
              : ""}
            {quotation.customer?.firstName || quotation.customer?.lastName
              ? `${quotation.customer.firstName || ""} ${quotation.customer.lastName || ""
                }`.trim()
              : quotation.customer?.billing?.company || "Unnamed Customer"}
          </p>
          {quotation.customer?.billing?.company &&
            (quotation.customer?.firstName || quotation.customer?.lastName) && (
              <p className="text-slate-600 font-medium">
                {quotation.customer.billing.company}
              </p>
            )}
          {quotation.customer?.billing?.address_1 && (
            <p className="text-slate-600">
              {quotation.customer.billing.address_1}
            </p>
          )}
          {quotation.customer?.billing?.address_2 && (
            <p className="text-slate-600">
              {quotation.customer.billing.address_2}
            </p>
          )}
          {(quotation.customer?.billing?.city ||
            quotation.customer?.billing?.state ||
            quotation.customer?.billing?.postcode) && (
              <p className="text-slate-600">
                {[
                  quotation.customer?.billing?.city,
                  quotation.customer?.billing?.state,
                  quotation.customer?.billing?.postcode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          {quotation.customer?.billing?.country && (
            <p className="text-slate-600">
              {quotation.customer.billing.country}
            </p>
          )}
          {quotation.customer?.billing?.phone && (
            <p className="text-slate-600">{quotation.customer.billing.phone}</p>
          )}
          <p className="text-slate-600">{quotation.customer?.email}</p>
          {quotation.customer?.taxNumber && (
            <p className="text-slate-600 font-medium">
              {settings?.tax?.label && settings.tax.label !== "Tax"
                ? settings.tax.label
                : "TIN"}
              : {quotation.customer.taxNumber}
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
            {quotation.items.map((item, index) => (
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
            <span className="font-medium text-slate-900">
              {formatCurrency(quotation.subtotal, effectiveSettings)}
            </span>
          </div>
          <div className="flex justify-between w-64">
            <span className="text-slate-600">
              {getTaxDisplay(quotation, settings).lineLabel}:
            </span>
            <span className="font-medium text-slate-900">
              {formatCurrency(quotation.tax || 0, effectiveSettings)}
            </span>
          </div>
          {quotation.discount > 0 && (
            <div className="flex justify-between w-64">
              <span className="text-slate-600">Discount:</span>
              <span className="font-medium text-slate-900">
                -{formatCurrency(quotation.discount, effectiveSettings)}
              </span>
            </div>
          )}
          {quotation.deliveryCharge > 0 && (
            <div className="flex justify-between w-64">
              <span className="text-slate-600">Delivery Charge:</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(quotation.deliveryCharge, effectiveSettings)}
              </span>
            </div>
          )}
          <div className="flex justify-between w-64 text-xl font-bold pt-4 border-t border-slate-200 text-slate-900">
            <span>Total:</span>
            <span>{formatCurrency(quotation.total, effectiveSettings)}</span>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quotation.notes || quotation.terms || quotation.deliveryNote) && (
          <div className="mt-8 pt-8 border-t border-slate-200">
            {quotation.notes && (
              <div className="mb-6">
                <h3 className="text-slate-600 font-semibold mb-2">Notes:</h3>
                <div
                  className="text-slate-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: quotation.notes }}
                />
              </div>
            )}
            {quotation.terms && (
              <div className="mb-6">
                <h3 className="text-slate-600 font-semibold mb-2">
                  Terms & Conditions:
                </h3>
                <div
                  className="text-slate-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: quotation.terms }}
                />
              </div>
            )}
            {quotation.deliveryNote && (
              <div>
                <h3 className="text-slate-600 font-semibold mb-2">
                  Delivery Note:
                </h3>
                <div
                  className="text-slate-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: quotation.deliveryNote }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotationView;
