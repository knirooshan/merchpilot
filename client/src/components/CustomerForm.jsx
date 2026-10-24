import { useState, useEffect } from "react";
import { X } from "lucide-react";

const CustomerForm = ({ customer, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    salutation: "",
    firstName: "",
    lastName: "",
    taxNumber: "",
    email: "",
    billing: {
      phone: "",
      address_1: "",
      city: "",
      postcode: "",
      country: "",
    },
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (customer) {
      setFormData({
        salutation: customer.salutation || "",
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        taxNumber: customer.taxNumber || "",
        email: customer.email || "",
        billing: {
          phone: customer.billing?.phone || "",
          company: customer.billing?.company || "",
          address_1: customer.billing?.address_1 || "",
          city: customer.billing?.city || "",
          postcode: customer.billing?.postcode || "",
          country: customer.billing?.country || "",
        },
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("billing.")) {
      const billingField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        billing: { ...prev.billing, [billingField]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const hasFirstName = formData.firstName?.trim();
    const hasCompany = formData.billing?.company?.trim();

    if (!hasFirstName && !hasCompany) {
      setError("Either First Name or Company Name is required");
      return;
    }

    setError("");
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {customer ? "Edit Customer" : "Add New Customer"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-500 px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Salutation
            </label>
            <select
              name="salutation"
              value={formData.salutation}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="Mr.">Mr.</option>
              <option value="Mrs.">Mrs.</option>
              <option value="Ms.">Ms.</option>
              <option value="Miss">Miss</option>
              <option value="Dr.">Dr.</option>
              <option value="Prof.">Prof.</option>
              <option value="Rev.">Rev.</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              name="billing.company"
              value={formData.billing.company || ""} // Handle undefined
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              TIN / VAT Number
            </label>
            <input
              type="text"
              name="taxNumber"
              value={formData.taxNumber}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              name="billing.phone"
              value={formData.billing.phone}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Address
            </label>
            <input
              type="text"
              name="billing.address_1"
              value={formData.billing.address_1}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                name="billing.city"
                value={formData.billing.city}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Postcode
              </label>
              <input
                type="text"
                name="billing.postcode"
                value={formData.billing.postcode}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Country
              </label>
              <input
                type="text"
                name="billing.country"
                value={formData.billing.country}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {customer ? "Update Customer" : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerForm;
