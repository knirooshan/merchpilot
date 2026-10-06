import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ENDPOINTS } from "../config/api";
import axios from "axios";
import { Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { fetchSettings } from "../store/slices/settingsSlice";

import MediaLibraryModal from "../components/MediaLibraryModal";
import RichTextEditor from "../components/RichTextEditor";

import { toast } from "react-hot-toast";

const Settings = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings, loading: settingsLoading } = useSelector(
    (state) => state.settings,
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  const [formData, setFormData] = useState({
    storeName: "",
    website: "",
    registrationNo: "",
    taxIdNo: "",
    logo: "",
    address: { street: "", city: "", zip: "", country: "" },
    contact: { phone: "", email: "" },
    smtp: { host: "", port: 587, user: "", pass: "", secure: false },
    bank: { accountName: "", accountNumber: "", bankName: "", branch: "" },
    currency: { code: "USD", symbol: "$", position: "before" },
    tax: {
      rate: 0,
      label: "Tax",
      defaultMethod: "exclusive",
      registered: false,
    },
    dateTime: { dateFormat: "MM/DD/YYYY", timeFormat: "12h", timezone: "UTC" },
    terms: { invoice: "", quotation: "", deliveryReceipt: "" },
    ird: { departmentCode: "BR01", placeOfSupply: "" },
    wooCommerce: { url: "", consumerKey: "", consumerSecret: "" },
    medusa: { url: "", apiKey: "", publishableKey: "" },
    modules: { woocommerce: true, pos: true, medusaSync: false },
  });

  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Unauthorized access");
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (e, section = null) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    if (section) {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [name]: val },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: val }));
    }
  };

  const handleLogoSelect = (media) => {
    setFormData((prev) => ({ ...prev, logo: media.url }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(ENDPOINTS.SETTINGS, formData, config);
      setMessage("Settings saved successfully!");
      dispatch(fetchSettings()); // Refresh settings in Redux
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  if (settingsLoading && !settings)
    return <div className="text-white">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Store Settings</h1>
        <div className="flex items-center gap-4">
          {user?.role === "admin" && (
            <Link
              to="/activity-log"
              className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              View Activity Log
            </Link>
          )}
          {message && (
            <span
              className={`px-4 py-2 rounded text-sm ${
                message.includes("Error")
                  ? "bg-red-900/50 text-red-200 border border-red-800"
                  : "bg-green-900/50 text-green-200 border border-green-800"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Info */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            General Information
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Store Name
              </label>
              <input
                type="text"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Website (https://...)
              </label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://yourstore.com"
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Registration No.
              </label>
              <input
                type="text"
                name="registrationNo"
                value={formData.registrationNo || ""}
                onChange={handleChange}
                placeholder="Company registration number"
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Tax ID No.
              </label>
              <input
                type="text"
                name="taxIdNo"
                value={formData.taxIdNo || ""}
                onChange={handleChange}
                placeholder="Tax identification number"
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Logo
              </label>
              <div className="flex items-center gap-4">
                {formData.logo && (
                  <div className="h-16 w-16 bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                    <img
                      src={formData.logo}
                      alt="Store Logo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-md hover:bg-slate-700 hover:text-white transition-colors text-sm"
                >
                  {formData.logo ? "Change Logo" : "Select Logo"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <MediaLibraryModal
          isOpen={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          onSelect={handleLogoSelect}
        />

        {/* Address & Contact */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Address & Contact
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Street Address
              </label>
              <input
                type="text"
                name="street"
                value={formData.address.street}
                onChange={(e) => handleChange(e, "address")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.address.city}
                onChange={(e) => handleChange(e, "address")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Phone
              </label>
              <input
                type="text"
                name="phone"
                value={formData.contact.phone}
                onChange={(e) => handleChange(e, "contact")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.contact.email}
                onChange={(e) => handleChange(e, "contact")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* SMTP Settings */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            SMTP Configuration (Email)
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Host
              </label>
              <input
                type="text"
                name="host"
                value={formData.smtp.host}
                onChange={(e) => handleChange(e, "smtp")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Port
              </label>
              <input
                type="number"
                name="port"
                value={formData.smtp.port}
                onChange={(e) => handleChange(e, "smtp")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                User
              </label>
              <input
                type="text"
                name="user"
                value={formData.smtp.user}
                onChange={(e) => handleChange(e, "smtp")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                type="password"
                name="pass"
                value={formData.smtp.pass}
                onChange={(e) => handleChange(e, "smtp")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Bank Details
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Account Name
              </label>
              <input
                type="text"
                name="accountName"
                value={formData.bank.accountName}
                onChange={(e) => handleChange(e, "bank")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Account Number
              </label>
              <input
                type="text"
                name="accountNumber"
                value={formData.bank.accountNumber}
                onChange={(e) => handleChange(e, "bank")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Bank Name
              </label>
              <input
                type="text"
                name="bankName"
                value={formData.bank.bankName}
                onChange={(e) => handleChange(e, "bank")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Branch
              </label>
              <input
                type="text"
                name="branch"
                value={formData.bank.branch}
                onChange={(e) => handleChange(e, "bank")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Swift Code
              </label>
              <input
                type="text"
                name="swiftCode"
                value={formData.bank.swiftCode || ""}
                onChange={(e) => handleChange(e, "bank")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Tax Configuration
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Tax Rate (%)
              </label>
              <input
                type="number"
                name="rate"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax.rate}
                onChange={(e) => handleChange(e, "tax")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-slate-400">
                Enter 0 for no tax. Default tax rate applied to transactions.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Tax Label
              </label>
              <input
                type="text"
                name="label"
                value={formData.tax.label}
                onChange={(e) => handleChange(e, "tax")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                placeholder="Tax"
              />
              <p className="mt-1 text-xs text-slate-400">
                Label shown on invoices (e.g., VAT, GST, Sales Tax)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Default Tax Method
              </label>
              <select
                name="defaultMethod"
                value={formData.tax.defaultMethod || "exclusive"}
                onChange={(e) => handleChange(e, "tax")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              >
                <option value="exclusive">
                  Exclusive (tax added on top of price)
                </option>
                <option value="inclusive">
                  Inclusive (tax included in price)
                </option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Default tax method for new items on invoices and quotations
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-300">
                <input
                  type="checkbox"
                  name="registered"
                  checked={!!formData.tax.registered}
                  onChange={(e) => handleChange(e, "tax")}
                  className="mr-2 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-600"
                />
                Registered for VAT / tax
              </label>
              <p className="mt-1 text-xs text-slate-400">
                Only VAT-registered suppliers may issue a "TAX INVOICE" (IRD
                Gazette 2481/22). If unchecked, invoices are titled "INVOICE".
              </p>
            </div>
          </div>
        </div>

        {/* Date & Time Configuration */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Date & Time Configuration
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Date Format
              </label>
              <select
                name="dateFormat"
                value={formData.dateTime?.dateFormat || "MM/DD/YYYY"}
                onChange={(e) => handleChange(e, "dateTime")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 12/31/2024)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 31/12/2024)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2024-12-31)</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 31-12-2024)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Time Format
              </label>
              <select
                name="timeFormat"
                value={formData.dateTime?.timeFormat || "12h"}
                onChange={(e) => handleChange(e, "dateTime")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              >
                <option value="12h">12-hour (e.g. 01:30 PM)</option>
                <option value="24h">24-hour (e.g. 13:30)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300">
                Timezone
              </label>
              <select
                name="timezone"
                value={formData.dateTime?.timezone || "UTC"}
                onChange={(e) => handleChange(e, "dateTime")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              >
                <option value="UTC">
                  UTC+0 - UTC (Coordinated Universal Time)
                </option>
                <option value="Europe/London">UTC+0/+1 - London</option>
                <option value="Europe/Paris">
                  UTC+1/+2 - Paris, Berlin, Rome, Madrid
                </option>
                <option value="Europe/Helsinki">
                  UTC+2/+3 - Helsinki, Athens, Cairo
                </option>
                <option value="Europe/Moscow">UTC+3 - Moscow, Nairobi</option>
                <option value="Asia/Dubai">UTC+4 - Dubai, Abu Dhabi</option>
                <option value="Asia/Karachi">UTC+5 - Karachi, Tashkent</option>
                <option value="Asia/Kolkata">UTC+5:30 - India (IST)</option>
                <option value="Asia/Kathmandu">
                  UTC+5:45 - Kathmandu (Nepal)
                </option>
                <option value="Asia/Dhaka">UTC+6 - Dhaka, Almaty</option>
                <option value="Asia/Rangoon">
                  UTC+6:30 - Yangon (Myanmar)
                </option>
                <option value="Asia/Bangkok">
                  UTC+7 - Bangkok, Jakarta, Hanoi
                </option>
                <option value="Asia/Singapore">
                  UTC+8 - Singapore, Kuala Lumpur, Beijing
                </option>
                <option value="Asia/Tokyo">UTC+9 - Tokyo, Seoul</option>
                <option value="Australia/Darwin">
                  UTC+9:30 - Darwin (ACST)
                </option>
                <option value="Australia/Sydney">
                  UTC+10/+11 - Sydney, Melbourne (AEST)
                </option>
                <option value="Pacific/Auckland">
                  UTC+12/+13 - Auckland (NZST)
                </option>
                <option value="Pacific/Midway">
                  UTC-11 - Midway Island, Samoa
                </option>
                <option value="Pacific/Honolulu">UTC-10 - Hawaii (HST)</option>
                <option value="America/Anchorage">
                  UTC-9/-8 - Anchorage (AKST)
                </option>
                <option value="America/Los_Angeles">
                  UTC-8/-7 - Los Angeles, Seattle (PST)
                </option>
                <option value="America/Denver">
                  UTC-7/-6 - Denver, Phoenix (MST)
                </option>
                <option value="America/Chicago">
                  UTC-6/-5 - Chicago, Mexico City (CST)
                </option>
                <option value="America/New_York">
                  UTC-5/-4 - New York, Toronto (EST)
                </option>
                <option value="America/Caracas">UTC-4 - Caracas, La Paz</option>
                <option value="America/St_Johns">
                  UTC-3:30/-2:30 - St. John&apos;s (NST)
                </option>
                <option value="America/Sao_Paulo">
                  UTC-3/-2 - São Paulo, Buenos Aires
                </option>
                <option value="Atlantic/South_Georgia">
                  UTC-2 - South Georgia
                </option>
                <option value="Atlantic/Azores">UTC-1/0 - Azores</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Used by the server for date range filtering. Defaults to UTC if
                not set.
              </p>
            </div>
          </div>
        </div>

        {/* Terms & Conditions Defaults */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Default Terms & Conditions
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Invoice Terms
              </label>
              <RichTextEditor
                value={formData.terms?.invoice || ""}
                onChange={(val) =>
                  handleChange(
                    { target: { name: "invoice", value: val } },
                    "terms",
                  )
                }
                placeholder="Enter default terms for invoices..."
                className="h-48"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Quotation Terms
              </label>
              <RichTextEditor
                value={formData.terms?.quotation || ""}
                onChange={(val) =>
                  handleChange(
                    { target: { name: "quotation", value: val } },
                    "terms",
                  )
                }
                placeholder="Enter default terms for quotations..."
                className="h-48"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Delivery Receipt Notes
              </label>
              <RichTextEditor
                value={formData.terms?.deliveryReceipt || ""}
                onChange={(val) =>
                  handleChange(
                    { target: { name: "deliveryReceipt", value: val } },
                    "terms",
                  )
                }
                placeholder="Enter default delivery notes..."
                className="h-48"
              />
            </div>
          </div>
        </div>

        {/* Currency Settings */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Currency Configuration
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Currency Code
              </label>
              <select
                name="code"
                value={formData.currency.code}
                onChange={(e) => handleChange(e, "currency")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="LKR">LKR - Sri Lankan Rupee</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Currency Symbol
              </label>
              <input
                type="text"
                name="symbol"
                value={formData.currency.symbol}
                onChange={(e) => handleChange(e, "currency")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                placeholder="$"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Symbol Position
              </label>
              <select
                name="position"
                value={formData.currency.position}
                onChange={(e) => handleChange(e, "currency")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
              >
                <option value="before">Before (e.g., $100)</option>
                <option value="after">After (e.g., 100$)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feature Modules */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
            Feature Modules
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  WooCommerce Sync
                </label>
                <p className="text-xs text-slate-400 mt-1">
                  Enable syncing products and orders from WooCommerce. When
                  disabled, sync buttons and features will be hidden.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="woocommerce"
                  checked={formData.modules?.woocommerce ?? true}
                  onChange={(e) => handleChange(e, "modules")}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  POS (Point of Sale)
                </label>
                <p className="text-xs text-slate-400 mt-1">
                  Enable the POS module. When disabled, the POS page and
                  navigation will be hidden.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="pos"
                  checked={formData.modules?.pos ?? true}
                  onChange={(e) => handleChange(e, "modules")}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Medusa Sync
                </label>
                <p className="text-xs text-slate-400 mt-1">
                  Enable pushing products to your Medusa storefront backend.
                  Configure credentials in the Medusa Configuration section
                  below.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="medusaSync"
                  checked={formData.modules?.medusaSync ?? false}
                  onChange={(e) => handleChange(e, "modules")}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* WooCommerce Settings */}
        {formData.modules?.woocommerce && (
          <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
            <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
              WooCommerce Configuration
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Store URL
                </label>
                <input
                  type="text"
                  name="url"
                  value={formData.wooCommerce?.url || ""}
                  onChange={(e) => handleChange(e, "wooCommerce")}
                  className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Consumer Key
                </label>
                <input
                  type="text"
                  name="consumerKey"
                  value={formData.wooCommerce?.consumerKey || ""}
                  onChange={(e) => handleChange(e, "wooCommerce")}
                  className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                  placeholder="ck_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Consumer Secret
                </label>
                <input
                  type="password"
                  name="consumerSecret"
                  value={formData.wooCommerce?.consumerSecret || ""}
                  onChange={(e) => handleChange(e, "wooCommerce")}
                  className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm"
                  placeholder="cs_..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Medusa Configuration */}
        {formData.modules?.medusaSync && (
          <div className="bg-slate-900 shadow rounded-lg p-6 border border-slate-800">
            <h2 className="text-lg font-medium text-white mb-4 border-b border-slate-800 pb-2">
              Medusa Configuration
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Medusa Backend URL
                </label>
                <input
                  type="text"
                  name="url"
                  value={formData.medusa?.url || ""}
                  onChange={(e) => handleChange(e, "medusa")}
                  className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-purple-600 focus:border-purple-600 sm:text-sm"
                  placeholder="https://your-medusa-backend.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Admin API Key
                </label>
                <input
                  type="password"
                  name="apiKey"
                  value={formData.medusa?.apiKey || ""}
                  onChange={(e) => handleChange(e, "medusa")}
                  className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-purple-600 focus:border-purple-600 sm:text-sm"
                  placeholder="sk_..."
                />
                <p className="mt-1 text-xs text-slate-500">
                  Found in your Medusa admin: Settings → API Keys → Create API
                  Key (secret key).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Publishable Key (optional)
                </label>
                <input
                  type="text"
                  name="publishableKey"
                  value={formData.medusa?.publishableKey || ""}
                  onChange={(e) => handleChange(e, "medusa")}
                  className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-purple-600 focus:border-purple-600 sm:text-sm"
                  placeholder="pk_..."
                />
              </div>
            </div>
          </div>
        )}

        {/* IRD Tax Compliance */}
        <div className="bg-slate-900 shadow rounded-lg p-6 border border-amber-800/40">
          <div className="flex items-start gap-3 mb-4 border-b border-slate-800 pb-3">
            <div className="flex-1">
              <h2 className="text-lg font-medium text-amber-400 mb-1">
                🏛️ IRD Tax Compliance (Gazette No. 2481/22)
              </h2>
              <p className="text-xs text-slate-400">
                Mandatory for all Sri Lankan taxpayers effective 1st July 2026.
                Tax Invoice Numbers are auto-generated in the format:{" "}
                <span className="font-mono text-amber-300">
                  YYMMM_DEPT_SERIAL
                </span>{" "}
                (e.g.{" "}
                <span className="font-mono text-amber-300">26JUL_BR01_1</span>)
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Department / Branch Code
              </label>
              <input
                type="text"
                name="departmentCode"
                value={formData.ird?.departmentCode || "BR01"}
                onChange={(e) => handleChange(e, "ird")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-amber-600 focus:border-amber-600 sm:text-sm font-mono uppercase"
                placeholder="BR01"
                maxLength={10}
              />
              <p className="mt-1 text-xs text-slate-400">
                Used as the DEPT part of the Tax Invoice Number (e.g. BR01,
                BR03). Max 10 characters.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Default Place of Supply
              </label>
              <input
                type="text"
                name="placeOfSupply"
                value={formData.ird?.placeOfSupply || ""}
                onChange={(e) => handleChange(e, "ird")}
                className="mt-1 block w-full bg-slate-950 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-amber-600 focus:border-amber-600 sm:text-sm"
                placeholder="e.g. Colombo"
              />
              <p className="mt-1 text-xs text-slate-400">
                Default place of supply printed on invoices. Can be overridden
                per invoice.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Save className="mr-2 h-5 w-5" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
